---
phase: 06-dashboards-notifications-localization
reviewed: 2026-08-13T17:49:00Z
depth: standard
files_reviewed: 52
files_reviewed_list:
  - app/admin/layout.tsx
  - app/api/locale/route.ts
  - app/api/notifications/[id]/read/route.ts
  - app/api/notifications/route.ts
  - app/api/patient/favorites/[id]/route.ts
  - app/api/patient/favorites/route.ts
  - app/doctor/(gated)/appointments/page.tsx
  - app/doctor/(gated)/layout.tsx
  - app/doctor/(gated)/page.tsx
  - app/doctor/(gated)/schedule/page.tsx
  - app/doctor/change-password/page.tsx
  - app/doctor/layout.tsx
  - app/doctors/[id]/page.tsx
  - app/layout.tsx
  - app/login/page.tsx
  - app/page.tsx
  - app/patient/appointments/page.tsx
  - app/patient/favorites/page.tsx
  - app/patient/layout.tsx
  - app/patient/page.tsx
  - app/search/page.tsx
  - app/signup/page.tsx
  - components/favorite-toggle.tsx
  - components/language-switcher.tsx
  - components/logout-button.tsx
  - components/notification-bell.tsx
  - components/search/doctor-card.tsx
  - components/search/search-filters.tsx
  - components/search/search-results.tsx
  - components/site-header.tsx
  - components/ui/popover.tsx
  - dictionaries/en.json
  - dictionaries/he.json
  - lib/appointments.ts
  - lib/i18n/dictionaries.ts
  - lib/i18n/locale-provider.tsx
  - lib/i18n/notification-copy.ts
  - lib/i18n/server.ts
  - lib/i18n/validation-messages.ts
  - lib/validation/favorites.ts
  - lib/validation/locale.ts
  - supabase/migrations/20260812090000_enable_notifications_realtime.sql
  - tests/e2e/admin-doctor-link-account.spec.ts
  - tests/e2e/appointment-history.spec.ts
  - tests/e2e/auth-doctor-login.spec.ts
  - tests/e2e/auth-login.spec.ts
  - tests/e2e/auth-session-persistence.spec.ts
  - tests/e2e/auth-signup.spec.ts
  - tests/e2e/doctor-dashboard.spec.ts
  - tests/e2e/helpers/favorites.ts
  - tests/e2e/helpers/notifications.ts
  - tests/e2e/locale-switching.spec.ts
  - tests/e2e/notifications-realtime.spec.ts
  - tests/e2e/patient-dashboard.spec.ts
  - tests/e2e/patient-favorites.spec.ts
  - tests/e2e/route-protection-role-mismatch.spec.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-08-13T17:49:00Z
**Depth:** standard
**Files Reviewed:** 52
**Status:** issues_found

## Summary

This phase adds patient/doctor dashboards, favorites, an in-app notification bell with Realtime delivery, and a full custom i18n retrofit across the public/auth/authenticated surfaces plus the RTL contract closure. The areas the workflow specifically flagged as high-risk all check out clean:

- **Favorites and notifications API routes** (`app/api/patient/favorites/**`, `app/api/notifications/**`) correctly restate ownership (`patient_id`/`user_id = <caller>`) in the same `WHERE` clause as the id filter, return byte-identical 404s for foreign/missing/malformed ids (never a 403 that would act as an existence oracle), and reject malformed UUIDs before they reach Postgres. This is solid IDOR-resistant design.
- **The eligibility-predicate change in `lib/appointments.ts`** (`appointmentBadge().labelKey`) is consumed correctly at both call sites (`app/patient/appointments/page.tsx:107-110`, `app/doctor/(gated)/appointments/page.tsx:69-72`) — both compare against the stable key `"appointment_status.confirmed"`, never against rendered/translated badge text. No permission decision is keyed on translatable text anywhere in the reviewed surface (verified by grep across `app/` and `components/`).
- **`app/admin/**` / `components/admin/**` exclusion (D-04) held** — the only admin-side diff in this phase is the removal of the now-redundant per-page `<SiteHeader />` mount from `app/admin/layout.tsx`, consistent with the header being centralized in the root layout. No admin copy was translated, no admin logic was touched.
- **`dictionaries/en.json` and `dictionaries/he.json` are structurally parallel** — 213 keys on each side, zero missing on either side (verified programmatically).
- **Logical-property CSS usage held** — `favorite-toggle.tsx`, `notification-bell.tsx`, `doctor-card.tsx`, and `site-header.tsx` use only `ps-`/`pe-`/`start-`/`end-` and no physical-direction (`ml-`/`mr-`/`left-`/`right-`) utilities. The one grep hit outside these files (`components/ui/popover.tsx`'s `data-[side=left]`/`data-[side=right]` animation classes) is a Base UI-generated primitive keyed to the library's own computed placement side, not to page text direction, and is out of scope for the D-06 contract.
- `tsc --noEmit` and `eslint` both pass clean on the full reviewed file set.

Three real, if second-order, defects were found beyond the flagged risk areas — the most notable being a client/server state-sync gap in the notification bell's mark-as-read flow, and a Hebrew grammar bug from the suffix-concatenation pluralization pattern on the search results count. See below.

## Warnings

### WR-01: Notification bell never reflects "marked read" locally — badge and unread dots stay stale for the rest of the session

**File:** `components/notification-bell.tsx:157-171`
**Issue:** `handleOpenChange` fires one fire-and-forget `PATCH /api/notifications/{id}/read` per currently-unread row when the popover opens, but never updates the component's own `rows` state to reflect the new `read_at`. Both `unreadCount` (line 154, drives the badge number and its visibility) and each list item's unread dot/bold treatment (lines 221-232) are derived purely from `rows`, which is only ever replaced by `load()` (mount + manual retry) or prepended to by `handleInsert` (a live INSERT). Neither path re-fetches after the PATCH.

Concretely: a patient/doctor opens the bell, sees N unread items, the PATCH calls all succeed server-side (proven by the API-contract test suite), the popover closes — and the badge still shows N, and every item is still rendered bold-with-dot, for the remainder of the browser session (until a full page reload re-triggers `load()`, since `SiteHeader`/`NotificationBell` are mounted once in the root layout and persist across client-side navigations). This silently defeats the documented "mark-all-on-open" interaction referenced in `app/api/notifications/[id]/read/route.ts`'s own comment. No existing test catches this: `notifications-realtime.spec.ts`'s badge test only exercises the increment path (1 → 2 via a live INSERT), never a decrement after opening the dropdown.

**Fix:** Update local state optimistically alongside firing the PATCHes, e.g.:
```tsx
function handleOpenChange(nextOpen: boolean) {
  setOpen(nextOpen);

  if (nextOpen) {
    const unreadIds = rows.filter((row) => row.read_at === null).map((row) => row.id);
    if (unreadIds.length > 0) {
      const readAt = new Date().toISOString();
      setRows((current) =>
        current.map((row) =>
          unreadIds.includes(row.id) ? { ...row, read_at: readAt } : row,
        ),
      );
      for (const id of unreadIds) {
        void fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      }
    }
  }
}
```

### WR-02: `notifications` Realtime publication broadcasts the full row, including the `message` column the REST route deliberately withholds

**File:** `supabase/migrations/20260812090000_enable_notifications_realtime.sql:14`, consumed at `components/notification-bell.tsx:80-86`
**Issue:** `GET /api/notifications` (`app/api/notifications/route.ts:16`) goes out of its way to exclude `message` from its select list, with an explicit comment that omitting it entirely is "a stronger guarantee than fetching and discarding it — it removes the possibility of a future component reading it off a response object" (D-03: the stored English text must never be rendered). `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;` publishes the table with no column list, so every `postgres_changes` INSERT event delivered over the websocket carries the complete row — `message` included — to the client for that user's own notifications. `useNotificationRealtime`'s handler (`notification-bell.tsx:82-86`) receives this full payload and only narrows it by field access when building `NotificationRow`, but the underlying object with `message` is fully present in browser memory and inspectable (React DevTools, WS frame inspection) for the lifetime of that closure. This doesn't currently leak into the DOM (the handler never reads `row.message`), but it quietly reopens exactly the channel the REST route's select-based minimization was designed to close, and a future edit to the realtime handler could trivially reintroduce the leak the GET route worked to prevent.
**Fix:** If PostgreSQL 15+ column-list publications are available on the Supabase Postgres version in use, scope the publication to the columns actually needed for delivery/dedup (e.g. `id, type, related_appointment_id, read_at, created_at, user_id`), explicitly excluding `message`:
```sql
alter publication supabase_realtime add table public.notifications
  (id, type, related_appointment_id, read_at, created_at, user_id);
```
If column-list publications aren't available in this environment, at minimum strip `message` from the payload the moment it's received in `useNotificationRealtime`'s `.on("postgres_changes", ...)` handler before it's ever stored in state, so the field never survives past the subscription boundary.

### WR-03: Hebrew search-results count pluralization produces an ungrammatical word via suffix concatenation

**File:** `dictionaries/he.json:186-187`, rendered at `components/search/search-results.tsx:101-104`
**Issue:** The English pluralization pattern is a simple suffix append — `"result"` + `"s"` → `"results"` — which is valid English morphology. The same mechanism was reused for Hebrew: `"search.results.count_label": "תוצאה"` (result, singular) + `"search.results.count_plural_suffix": "ות"` (a plural suffix), concatenated with no space by `search-results.tsx`:
```tsx
{total} {t("search.results.count_label")}
{total === 1 ? "" : t("search.results.count_plural_suffix")}
```
For `total !== 1` this renders `"תוצאה" + "ות"` = `"תוצאהות"`. Hebrew pluralizes this specific noun by replacing the trailing ה with ות (תוצאה → תוצאות), not by appending ות after the ה — the concatenation approach that works for English produces a non-word in Hebrew. Every Hebrew-locale visitor to `/search` with any result count other than exactly 1 sees this on one of the app's highest-traffic screens, in the language this project's own constraints identify as a primary target market (Israel, hebrew/english parity is a stated core requirement).
**Fix:** Give Hebrew its own complete plural string rather than a suffix to append, e.g. two independent full-word keys instead of a label+suffix pair:
```json
"search.results.count_label_singular": "תוצאה",
"search.results.count_label_plural": "תוצאות"
```
```tsx
{total} {t(total === 1 ? "search.results.count_label_singular" : "search.results.count_label_plural")}
```
(English can keep its existing label+suffix pair, or be migrated to the same two-key shape for consistency.)

## Info

### IN-01: Locale cookie is set without the `Secure` attribute

**File:** `app/api/locale/route.ts:28-32`
**Issue:** `cookieStore.set(LOCALE_COOKIE_NAME, locale, { path: "/", maxAge: ..., sameSite: "lax" })` omits `secure: true`. This is a low-sensitivity, non-auth preference cookie, so this is not an exploitable issue, but Next.js does not implicitly add `Secure` in production; omitting it is inconsistent with defense-in-depth cookie hygiene the rest of the app appears to follow for its auth cookies.
**Fix:** Add `secure: process.env.NODE_ENV === "production"` (or unconditionally `secure: true`, since local dev over `http://localhost` still accepts `Secure` cookies from most modern browsers when the origin is `localhost`).

### IN-02: `auth.change_password`'s field errors are translated at set-time, not at render-time like every other form in this phase

**File:** `app/doctor/change-password/page.tsx:36-41`
**Issue:** Every other retrofitted form (`app/signup/page.tsx:42-46`, `app/login/page.tsx:46-49`) stores the raw, untranslated validator string in `fieldErrors` and calls `translateValidationMessage(fieldErrors.x, t)` at render time, so an error already on screen re-renders correctly if the visitor switches language via the header's `LanguageSwitcher` mid-session. `DoctorChangePasswordPage` instead calls `translateValidationMessage(passwordError, t)` once, at the moment the error is set, and stores the already-translated string. If the doctor switches locale while this error is visible, the change-password error text stays in the pre-switch language (the language-switcher's `router.refresh()` does not remount this client component or reset its state) while identical errors elsewhere in the app update immediately. Low impact (narrow window, single form), but it is the one inconsistency against an otherwise-consistent "translate untranslated state at the render boundary" convention this phase establishes.
**Fix:** Store `passwordError` (and the mismatch condition) untranslated in state, and call `translateValidationMessage`/`t()` only in the JSX, matching `signup`/`login`.

---

_Reviewed: 2026-08-13T17:49:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
