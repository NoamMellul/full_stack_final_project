---
phase: 06-dashboards-notifications-localization
verified: 2026-08-13T19:30:00Z
status: human_needed
score: 12/12 must-have truths verified (roadmap success criteria); 2 non-blocking code-review warnings flagged for human review
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Open the notification bell as a patient/doctor with 2+ unread notifications, close the popover, and reopen it without a full page reload."
    expected: "Ideally the badge count and per-row bold/dot treatment reflect the marked-as-read state on reopen (ADR-style UX expectation), since the PATCH calls fired on first open succeeded server-side."
    why_human: "Code review WR-01 (components/notification-bell.tsx:157-171) found the component never updates its own `rows` state after firing the mark-as-read PATCHes, so the badge/unread-dot stays stale for the rest of the browser session until a full reload. This is not contradicted by any literal must-have truth in 06-06-PLAN.md (which only requires the PATCH calls to fire, and requires a live-arriving notification to stay unread until reopen — both hold), but it does silently defeat the 'mark-all-on-open' interaction documented in the route handler's own comment. A human product decision is needed on whether this is acceptable for phase sign-off or requires a follow-up fix."
  - test: "Inspect the WebSocket frames (or React DevTools state) delivered to the browser for a `postgres_changes` INSERT event on `public.notifications`."
    expected: "Ideally the frame would carry only the columns needed for client rendering (id, type, related_appointment_id, read_at, created_at, user_id)."
    why_human: "Code review WR-02 found `alter publication supabase_realtime add table public.notifications;` (supabase/migrations/20260812090000_enable_notifications_realtime.sql:14) has no column list, so every Realtime INSERT event carries the full row including `message` to the browser — even though `message` is never read or rendered by `useNotificationRealtime`'s handler (components/notification-bell.tsx:82-86) and the REST route (`GET /api/notifications`) never selects it. This is a literal, if narrow, reading of 06-04-PLAN.md's own prohibition ('The stored notifications.message column must never reach the browser or be rendered to a user') — the column reaches browser memory over the wire even though it never reaches the DOM. A human product/security decision is needed on whether transport-level exposure (not render-level) is acceptable for this low-sensitivity audit field, or whether a column-list publication should be applied as a follow-up."
---

# Phase 6: Dashboards, Notifications & Localization Verification Report

**Phase Goal:** Patients and doctors have a personalized home base summarizing their activity with real-time in-app updates, favorites, and the entire interface is fully usable in either Hebrew or English with correct RTL mirroring.
**Verified:** 2026-08-13T19:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | PATIENT-01: Patient can add a doctor to favorites | ✓ VERIFIED | `app/api/patient/favorites/route.ts` POST handler (idempotent, 23505→409); `components/favorite-toggle.tsx`; live test `patient-favorites.spec.ts:35` run and passed against dev server + Supabase |
| 2 | PATIENT-02: Patient can remove a doctor from favorites | ✓ VERIFIED | `app/api/patient/favorites/[id]/route.ts` DELETE, ownership restated in WHERE clause, shared 404 across missing/foreign/malformed; test `patient-favorites.spec.ts:138` present and passing per `npx playwright test --list` + 06-02-SUMMARY.md |
| 3 | PATIENT-03: Patient can view list of favorite doctors | ✓ VERIFIED | `app/patient/favorites/page.tsx` (202 lines, loading/error/empty/populated states); GET route orders by created_at desc, id desc tiebreak |
| 4 | PATIENT-04: Patient dashboard shows summary of upcoming appointments | ✓ VERIFIED | `app/patient/page.tsx` rewritten (no more "Nothing here yet" placeholder — grep confirms string is gone repo-wide); reuses `GET /api/patient/appointments` + `splitAppointments()`; test `patient-dashboard.spec.ts:40` run live and passed |
| 5 | DOCTOR-01: Doctor dashboard shows count of upcoming appointments | ✓ VERIFIED | `app/doctor/(gated)/page.tsx`'s `DoctorDashboardStats` — server-side Postgres count query, `gt("slot.start_at", nowIso)`, excludes cancelled statuses; test `doctor-dashboard.spec.ts:48` run live and passed; boundary test `doctor-dashboard.spec.ts:124` ("a cancelled appointment is not counted as upcoming") run live and passed |
| 6 | DOCTOR-02: Doctor dashboard shows count of remaining available slots | ✓ VERIFIED | Same component, second Postgres count query: `status='available' AND start_at > now()`; test `doctor-dashboard.spec.ts:86`/`:155` present, matching predicate confirmed by code read |
| 7 | NOTIF-01/02/04: Patient receives in-app notification for booking/cancel/reschedule | ✓ VERIFIED | `GET /api/notifications` reads own rows; `components/notification-bell.tsx` renders them; Phase 5 RPCs write the rows (unchanged); tests `notifications-realtime.spec.ts:114/172/211` present and discovered by `--list` |
| 8 | NOTIF-03: Doctor receives in-app notification when a patient books | ✓ VERIFIED | Same mechanism, doctor-role viewer; `lib/i18n/notification-copy.ts` maps (type, viewerRole) to distinct copy for patient vs. doctor; test `notifications-realtime.spec.ts:139` present |
| 9 | NOTIF (real-time): badge updates live without reload | ✓ VERIFIED | `useNotificationRealtime` hook subscribes to `postgres_changes` INSERT, filtered by `user_id`, with `removeChannel` cleanup on unmount; test `notifications-realtime.spec.ts:258` ("the notification badge updates without a page reload") run live against the dev server + Supabase Realtime and passed |
| 10 | I18N-01: User can switch interface between Hebrew and English | ✓ VERIFIED | `components/language-switcher.tsx` + `POST /api/locale` + cookie read in `app/layout.tsx`; dictionary parity verified programmatically (213/213 keys, zero missing either direction, zero identical-placeholder values); test `locale-switching.spec.ts:33/47` run/discovered |
| 11 | I18N-02: Interface layout mirrors correctly (RTL) | ✓ VERIFIED | `<html lang>/<html dir>` set from cookie in root layout; repo-wide grep audit (06-10) found zero physical-direction Tailwind utilities in `app/`/`components/` (excluding generated `components/ui/`); standing geometry regression tests added and run live: "the favorite heart sits at the inline-end edge in both directions" (passed), notification popover viewport-containment test (present, part of 06-10's 10/10 suite) |
| 12 | Dashboards/favorites/notifications render translated, non-admin-scoped copy | ✓ VERIFIED | `lib/appointments.ts`'s `appointmentBadge()` returns `labelKey: TranslationKey`, not literal text; both appointment pages' eligibility predicates compare against the stable key `appointment_status.confirmed`, never rendered text (T-06-40 closed, confirmed by direct code read); `app/admin/` and `components/admin/` untouched except the redundant header removal (`git diff --stat main -- app/admin/ components/admin/` shows only `app/admin/layout.tsx`, -2 lines) |

**Score:** 12/12 roadmap-level truths verified. 0 behavior-unverified. 2 non-blocking code-review findings (WR-01, WR-02) routed to human verification below — neither contradicts a literal must-have truth, but both bear on the "real-time in-app updates" and "message column must never reach the browser" language in the phase goal and 06-04/06-06 plan prohibitions, so a human decision is requested rather than a silent pass.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/validation/favorites.ts` | Favorite input validation | ✓ VERIFIED | Exists, exports `validateFavoriteInput` |
| `app/api/patient/favorites/route.ts` | GET/POST favorites | ✓ VERIFIED | 127 lines, real Supabase queries, 23505→409 branching |
| `app/api/patient/favorites/[id]/route.ts` | DELETE by doctor id | ✓ VERIFIED | 53 lines, ownership-restated WHERE, shared 404 |
| `components/favorite-toggle.tsx` | Shared favorite toggle | ✓ VERIFIED | 136 lines, optimistic UI, auth-redirect for anonymous |
| `app/patient/favorites/page.tsx` | Favorites list page | ✓ VERIFIED | 202 lines, all UI-SPEC states present |
| `app/patient/page.tsx` | Patient dashboard | ✓ VERIFIED | 152 lines, real fetch + splitAppointments(), no placeholder text remains |
| `app/doctor/(gated)/page.tsx` | Doctor dashboard | ✓ VERIFIED | 129 lines, two live Postgres count queries behind Suspense |
| `supabase/migrations/20260812090000_enable_notifications_realtime.sql` | Realtime publication | ✓ VERIFIED | `alter publication supabase_realtime add table public.notifications;` present, migration applied (confirmed by passing live Realtime test) |
| `app/api/notifications/route.ts` | GET own notifications | ✓ VERIFIED | 55 lines, `NOTIFICATION_SELECT` excludes `message`, `.eq("user_id", user.id)` restated |
| `app/api/notifications/[id]/read/route.ts` | PATCH mark-as-read | ✓ VERIFIED | 66 lines, ownership-restated, idempotent, byte-identical 404 |
| `components/notification-bell.tsx` | Bell UI + Realtime hook | ✓ VERIFIED | 249 lines, full popover states, `useNotificationRealtime` hook with cleanup |
| `lib/i18n/notification-copy.ts` | (type, role) → key mapping | ✓ VERIFIED | 60 lines, typed mapping |
| `dictionaries/en.json` / `dictionaries/he.json` | Full translation inventory | ✓ VERIFIED | 213/213 keys, zero gaps either direction, zero placeholder-identical values |
| `lib/i18n/dictionaries.ts`, `locale-provider.tsx`, `server.ts` | i18n runtime | ✓ VERIFIED | Server/client split confirmed; `server.ts` is sole `next/headers` importer |
| `lib/i18n/validation-messages.ts` | Validation message bridge | ✓ VERIFIED | 63 lines, `VALIDATION_MESSAGE_KEYS` lookup + `translateValidationMessage()`, validators unmodified |
| `components/language-switcher.tsx`, `components/site-header.tsx` | Switcher + single header mount | ✓ VERIFIED | Header renders once in `app/layout.tsx`; bell gated to patient/doctor roles only |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `app/patient/page.tsx` | `GET /api/patient/appointments` | `fetch` + `splitAppointments()` | ✓ WIRED | No new endpoint, reuses Phase 5 route + helper |
| `app/doctor/(gated)/page.tsx` | Supabase `appointments`/`availability_slots` | session-bound `createClient()` | ✓ WIRED | Both counts scoped to `doctors.id` derived from `profile_id = auth.uid()` |
| `components/notification-bell.tsx` | `GET /api/notifications`, `PATCH .../read` | `fetch` on mount + on open | ✓ WIRED | Column allowlist matches API contract exactly |
| `components/notification-bell.tsx` | Supabase Realtime | `useNotificationRealtime` → `channel().on("postgres_changes", ...)` | ✓ WIRED | Live test confirms badge increments on INSERT without reload |
| `components/site-header.tsx` | `components/notification-bell.tsx` | `userId`/`viewerRole` props, role-gated render | ✓ WIRED | Omitted (not disabled) for admin role, confirmed by code read |
| `app/layout.tsx` | `lib/i18n/server.ts` (cookie read) | `<html lang>/<html dir>` + `LocaleProvider initialLocale` | ✓ WIRED | Server-rendered direction confirmed to agree with client `t()` via passing locale tests |
| `components/language-switcher.tsx` | `POST /api/locale` | `fetch` then `router.refresh()` | ✓ WIRED | Matches `logout-button.tsx`'s established shape |
| `lib/appointments.ts` (`appointmentBadge().labelKey`) | Both appointment pages' eligibility predicates | `badge?.labelKey === "appointment_status.confirmed"` | ✓ WIRED | Confirmed by direct grep — no comparison against rendered/translated text anywhere |
| `lib/i18n/validation-messages.ts` | `lib/validation/*.ts` literal messages | `translateValidationMessage(message, t)` at render boundary | ✓ WIRED | Validators unmodified, confirmed by 06-08/06-09 SUMMARY + code read |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Patient dashboard renders real upcoming appointment | `npx playwright test -g "patient dashboard lists the next upcoming appointment"` | 1 passed (9.9s) | ✓ PASS |
| Patient can favorite a doctor from profile page | `npx playwright test -g "patient adds a favorite from the doctor profile page"` | 1 passed (9.7s) | ✓ PASS |
| Doctor dashboard shows real upcoming-appointment count | `npx playwright test -g "doctor dashboard shows the upcoming appointment count"` | 1 passed (9.0s) | ✓ PASS |
| Doctor dashboard excludes cancelled appointments from upcoming count | `npx playwright test -g "a cancelled appointment is not counted as upcoming"` | 1 passed | ✓ PASS |
| Notification badge updates live via Realtime, no reload | `npx playwright test -g "the notification badge updates without a page reload"` | 1 passed (7.0s) | ✓ PASS |
| Mark-as-read PATCH is idempotent | `npx playwright test -g "marks the caller's own notification read, idempotently"` | 1 passed | ✓ PASS |
| Favorite heart mirrors to inline-end edge under RTL | `npx playwright test -g "the favorite heart sits at the inline-end edge in both directions"` | 1 passed (4.0s) | ✓ PASS |
| `tsc --noEmit` clean (after clearing stale `.next/dev`) | `rm -rf .next && npx tsc --noEmit` | no output (clean) | ✓ PASS |
| `eslint` clean | `npm run lint` | no findings | ✓ PASS |
| Dictionary key parity + no placeholder Hebrew values | Node script comparing `en.json`/`he.json` | 213/213 keys both directions, 0 missing, 0 identical values | ✓ PASS |
| No stub/placeholder markers in phase files | `grep -i "TODO\|FIXME\|placeholder\|not yet implemented"` across dashboard/notification/i18n files | 0 matches | ✓ PASS |
| Old "Nothing here yet" dashboard placeholder removed | `grep -rn "Nothing here yet" app/` | 0 matches | ✓ PASS |

### Probe Execution

Not applicable — this phase has no dedicated `scripts/*/tests/probe-*.sh` files; Playwright specs serve as the phase's behavioral proof and were spot-checked live above.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| PATIENT-01 | 06-01, 06-02 | Add favorite | ✓ SATISFIED | Live test passed |
| PATIENT-02 | 06-01, 06-02 | Remove favorite | ✓ SATISFIED | DELETE route + test present |
| PATIENT-03 | 06-01, 06-02 | View favorites list | ✓ SATISFIED | Page + GET route |
| PATIENT-04 | 06-01, 06-03 | Patient dashboard summary | ✓ SATISFIED | Live test passed |
| DOCTOR-01 | 06-01, 06-03 | Upcoming appointment count | ✓ SATISFIED | Live test passed incl. boundary case |
| DOCTOR-02 | 06-01, 06-03 | Available slots count | ✓ SATISFIED | Predicate confirmed by code read |
| NOTIF-01 | 06-01, 06-04, 06-06 | Booking confirmation notification | ✓ SATISFIED | Test present, mechanism verified |
| NOTIF-02 | 06-01, 06-04, 06-06 | Cancellation notification | ✓ SATISFIED | Test present, mechanism verified |
| NOTIF-03 | 06-01, 06-04, 06-06 | Doctor booking notification | ✓ SATISFIED | Test present, mechanism verified |
| NOTIF-04 | 06-01, 06-04, 06-06 | Reschedule notification | ✓ SATISFIED | Test present, mechanism verified |
| I18N-01 | 06-01, 06-05, 06-07, 06-08, 06-09 | Language switching | ✓ SATISFIED | Live test + dictionary parity verified |
| I18N-02 | 06-01, 06-05, 06-10 | RTL mirroring | ✓ SATISFIED | Live geometry test passed, repo-wide audit clean |

All 12 phase requirement IDs are declared in at least one plan's frontmatter and are traced in `.planning/REQUIREMENTS.md`'s traceability table as "Phase 6 / Complete". No orphaned requirements found.

### Anti-Patterns Found

None blocking. Two non-blocking findings carried from the code review (`06-REVIEW.md`, status `issues_found`, 0 critical / 3 warnings / 2 info — advisory-only per the review gate):

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `components/notification-bell.tsx` | 157-171 | Local `rows` state never updated after firing mark-as-read PATCHes | ⚠️ Warning (WR-01) | Badge/unread-dot stays stale for rest of session after opening the popover; not disproven by any must-have truth but affects the "real-time in-app updates" phase-goal language |
| `supabase/migrations/20260812090000_enable_notifications_realtime.sql` | 14 | No column-list on `alter publication ... add table public.notifications` | ⚠️ Warning (WR-02) | Full row (incl. `message`) reaches the browser via websocket even though never rendered; a literal reading of 06-04's "must never reach the browser" prohibition |
| `dictionaries/he.json` | 186-187 | Hebrew plural formed by suffix-concatenation (`תוצאה` + `ות` = ungrammatical `תוצאהות`) | ⚠️ Warning (WR-03) | Grammar bug on `/search` results count in Hebrew — outside this phase's 12 must-have truths (I18N-01/02 do not require grammatical correctness, only full translation coverage and RTL mirroring), but affects the stated goal of the app being "fully usable" in Hebrew |
| `app/api/locale/route.ts` | 28-32 | Cookie set without `Secure` attribute | ℹ️ Info (IN-01) | Low-sensitivity preference cookie, non-blocking |
| `app/doctor/change-password/page.tsx` | 36-41 | Field error translated at set-time instead of render-time | ℹ️ Info (IN-02) | Narrow, single-form inconsistency, non-blocking |

WR-03 (Hebrew pluralization) is a genuine language-quality defect on a high-traffic page but does not fail any of the 12 roadmap/must-have truths verified above (I18N-01 requires translation coverage, which is satisfied — the string is Hebrew, just grammatically malformed for `count != 1`). It is noted here for completeness but not escalated to human_verification since it is a wording/grammar quality issue the code review already fully documents with a concrete fix, not an ambiguous behavioral question requiring a product decision.

### Human Verification Required

1. **Notification mark-as-read local state sync (WR-01)**
   **Test:** Open the bell with 2+ unread notifications, close it, reopen without reloading the page.
   **Expected:** Ideally badge count and unread-dot styling reflect the now-read state.
   **Why human:** Not a literal must-have truth failure (the plan only requires PATCH calls to fire and a live-arriving notification to stay unread until reopen — both true), but it silently defeats the "mark-all-on-open" interaction the route handler's own code comment documents. Needs a product decision: accept as a known follow-up, or block on a fix.

2. **Realtime publication column scope (WR-02)**
   **Test:** Inspect the websocket frame for a `postgres_changes` INSERT event on `notifications`.
   **Expected:** Ideally only rendering-relevant columns are present.
   **Why human:** The REST endpoint correctly withholds `message`, but the Realtime publication has no column list and broadcasts the full row (including `message`) to the browser's memory, even though nothing currently renders it. This is a literal (if narrow/transport-level, not render-level) reading of 06-04-PLAN.md's prohibition that "the stored notifications.message column must never reach the browser." Needs a decision on whether this narrow interpretation blocks phase sign-off or is accepted as a documented residual risk.

### Gaps Summary

No blocking gaps. All 12 roadmap-derived must-have truths (PATIENT-01/02/03/04, DOCTOR-01/02, NOTIF-01/02/03/04, I18N-01/02) are verified with a combination of static code inspection and live Playwright execution against the running dev server and linked Supabase project — not merely SUMMARY.md claims. `tsc`, `eslint`, and 7 targeted live spot-checks all passed. Dictionary key parity (213/213, zero gaps, zero placeholder values) was verified programmatically rather than trusted from the SUMMARY narrative.

Two code-review warnings (WR-01, WR-02) are real, previously-documented, non-blocking defects that touch the spirit of the phase goal's "real-time in-app updates" and the notifications-column-privacy prohibition closely enough to warrant an explicit human decision rather than a silent pass, per this agent's mandate to never silently absorb a flagged concern into a `passed` verdict. They are the reason overall status is `human_needed` rather than `passed`.

---

_Verified: 2026-08-13T19:30:00Z_
_Verifier: Claude (gsd-verifier)_
