---
phase: 06-dashboards-notifications-localization
verified: 2026-08-13T19:30:00Z
reverified: 2026-08-27T00:00:00Z
status: passed
score: 12/12 must-have truths verified (roadmap success criteria); 2/2 non-blocking code-review warnings resolved (WR-01 fully, WR-02 at the Postgres-catalog level with a documented, human-accepted residual risk at the managed Realtime service layer)
behavior_unverified: 0
overrides_applied: 0
resolved_human_verification:
  - test: "Open the notification bell as a patient/doctor with 2+ unread notifications, close the popover, and reopen it without a full page reload."
    expected: "Ideally the badge count and per-row bold/dot treatment reflect the marked-as-read state on reopen (ADR-style UX expectation), since the PATCH calls fired on first open succeeded server-side."
    resolution: "WR-01 (components/notification-bell.tsx:157-171 at the time of the original finding) was already fixed by commit 163b37d (quick task 260817-fhm, 2026-08-17) — `markReadOnOpen` awaits `Promise.allSettled` over the per-id PATCH calls, builds the set of server-confirmed ids, and calls `setRows` with a functional updater that flips only those ids to a read timestamp; `handleOpenChange` snapshots the unread ids synchronously at open time. Re-confirmed by direct code read (quick task 260827-isc, 2026-08-27) with zero new edits to the component. Proven by the existing live test `tests/e2e/notifications-realtime.spec.ts` — \"the unread badge clears after opening the bell, without a page reload\" — which asserts the badge is hidden immediately after opening the popover (no reload) and still hidden after a subsequent full reload."
  - test: "Inspect the WebSocket frames (or React DevTools state) delivered to the browser for a `postgres_changes` INSERT event on `public.notifications`."
    expected: "Ideally the frame would carry only the columns needed for client rendering (id, type, related_appointment_id, read_at, created_at, user_id)."
    resolution: "Quick task 260827-isc applied `supabase/migrations/20260827120000_scope_notifications_realtime_columns.sql` (drop + re-add `public.notifications` on `supabase_realtime` with an explicit 6-column list), live via `db push --linked`, and independently confirmed via `select attnames from pg_publication_tables where tablename = 'notifications'` that the Postgres catalog is now correctly scoped to exactly `{id,user_id,type,related_appointment_id,read_at,created_at}` — `message` is genuinely absent from the publication definition, which is the authoritative security boundary Postgres itself enforces. A wire-level Playwright test (`tests/e2e/notifications-realtime.spec.ts`, \"notifications publication withholds the message column from the wire\", currently `test.fixme`) still observed `message` in the decoded payload across 5 consecutive live runs, pointing at the managed Realtime service's own CDC decoder caching or not honoring the new column list — an infrastructure-layer gap outside this project's CLI/application-layer reach (no restart/cache-invalidation subcommand exists). **Human decision (2026-08-27): accepted as a documented residual risk.** Rationale: `message` is a short server-generated informational string (e.g. \"Your appointment with Dr. X was confirmed\") — never medical data, per this project's constraint that no sensitive medical data is ever stored — so the practical exposure is minimal even in the unresolved case; the Postgres-catalog fix is real defense-in-depth and closes the authoritative half of the boundary; a full project restart (the only known remaining lever) is disruptive and not undertaken for this residual risk level. Not re-opened as blocking; carried forward in Blockers/Concerns for optional follow-up (e.g. before a production deploy with real user data)."
---

# Phase 6: Dashboards, Notifications & Localization Verification Report

**Phase Goal:** Patients and doctors have a personalized home base summarizing their activity with real-time in-app updates, favorites, and the entire interface is fully usable in either Hebrew or English with correct RTL mirroring.
**Verified:** 2026-08-13T19:30:00Z
**Status:** passed
**Re-verification:** Yes — 2026-08-27T00:00:00Z (quick task 260827-isc): WR-01 confirmed resolved (already fixed, no new edit); WR-02 addressed at the Postgres-catalog level (confirmed live) with a wire-level gap at the managed Realtime service layer accepted as a documented residual risk by human decision on 2026-08-27 (see `resolved_human_verification` in frontmatter for full rationale). Both former blockers now resolved — status flips to `passed`.

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

**Score:** 12/12 roadmap-level truths verified. 0 behavior-unverified. Both of the 2 non-blocking code-review findings routed to human verification are now resolved: WR-01 with commit + automated-test proof, WR-02 with a real Postgres-catalog fix plus a human-accepted decision on the remaining managed-service wire-level gap (see `resolved_human_verification` in frontmatter for both).

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

None blocking. Two non-blocking findings carried from the code review (`06-REVIEW.md`, status `issues_found`, 0 critical / 3 warnings / 2 info — advisory-only per the review gate), both now resolved:

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `components/notification-bell.tsx` | 157-171 | ~~Local `rows` state never updated after firing mark-as-read PATCHes~~ — **RESOLVED**, commit 163b37d (quick 260817-fhm) | ✅ Resolved (WR-01) | `markReadOnOpen` now applies a functional `setRows` update over server-confirmed ids; proven by `tests/e2e/notifications-realtime.spec.ts` "the unread badge clears after opening the bell, without a page reload" |
| `supabase/migrations/20260812090000_enable_notifications_realtime.sql` | 14 | No column-list on `alter publication ... add table public.notifications` | ⚠️ Warning (WR-02) — **RESOLVED at the Postgres-catalog level; wire-level gap accepted as residual risk** | `supabase/migrations/20260827120000_scope_notifications_realtime_columns.sql` (quick 260827-isc) re-scopes the publication to 6 explicit columns, confirmed correct at the Postgres catalog level (`pg_publication_tables`) — `message` is genuinely absent from Postgres's own authorization boundary. A wire-level test still observes `message` in the live decoded payload after 5 consecutive runs (a managed Realtime-service-side, not Postgres-side, propagation gap). Human-accepted 2026-08-27 as a documented residual risk: `message` is non-medical, server-generated informational text, never rendered client-side |
| `dictionaries/he.json` | 186-187 | Hebrew plural formed by suffix-concatenation (`תוצאה` + `ות` = ungrammatical `תוצאהות`) | ⚠️ Warning (WR-03) | Grammar bug on `/search` results count in Hebrew — outside this phase's 12 must-have truths (I18N-01/02 do not require grammatical correctness, only full translation coverage and RTL mirroring), but affects the stated goal of the app being "fully usable" in Hebrew |
| `app/api/locale/route.ts` | 28-32 | Cookie set without `Secure` attribute | ℹ️ Info (IN-01) | Low-sensitivity preference cookie, non-blocking |
| `app/doctor/change-password/page.tsx` | 36-41 | Field error translated at set-time instead of render-time | ℹ️ Info (IN-02) | Narrow, single-form inconsistency, non-blocking |

WR-03 (Hebrew pluralization) is a genuine language-quality defect on a high-traffic page but does not fail any of the 12 roadmap/must-have truths verified above (I18N-01 requires translation coverage, which is satisfied — the string is Hebrew, just grammatically malformed for `count != 1`). It is noted here for completeness but not escalated to human_verification since it is a wording/grammar quality issue the code review already fully documents with a concrete fix, not an ambiguous behavioral question requiring a product decision.

**Residual non-blocking items carried forward unchanged, out of this task's scope:** WR-03 (Hebrew pluralization), IN-01 (locale cookie `Secure` attribute), IN-02 (doctor change-password field-error translation timing). None of the three was touched by quick task 260827-isc.

### Human Verification Required

Both items below have been resolved and no longer require human verification. Kept here (struck through) for audit history.

1. ~~**Notification mark-as-read local state sync (WR-01)**~~ — **RESOLVED.**
   **Resolution:** Already fixed by commit 163b37d (quick task 260817-fhm, 2026-08-17), before this warning was even filed. `markReadOnOpen` in `components/notification-bell.tsx` awaits `Promise.allSettled` over the per-id PATCH calls and applies a functional `setRows` update to only the server-confirmed ids; `handleOpenChange` snapshots unread ids synchronously at open time. Re-confirmed by direct code read (quick task 260827-isc, 2026-08-27) with zero new edits. Proven by the existing live test `tests/e2e/notifications-realtime.spec.ts` — "the unread badge clears after opening the bell, without a page reload".

2. ~~**Realtime publication column scope (WR-02)**~~ — **RESOLVED (Postgres-catalog fix + accepted residual risk).**
   **What changed (quick task 260827-isc, 2026-08-27):** `supabase/migrations/20260827120000_scope_notifications_realtime_columns.sql` re-scopes the `supabase_realtime` publication to exactly 6 columns (drop + re-add with an explicit list), applied live via `db push --linked` and independently confirmed correct via a direct `pg_publication_tables` query on the linked project — `message` is genuinely absent from the Postgres publication catalog, which is the authoritative security boundary Postgres itself enforces.
   **Remaining wire-level gap, human-accepted 2026-08-27:** A wire-level test (`tests/e2e/notifications-realtime.spec.ts`, "notifications publication withholds the message column from the wire", currently `test.fixme`) still observed `message` in the decoded payload across 5 consecutive live runs — pointing at the managed Realtime service's `wal2json`-based CDC decoder, not Postgres itself, either caching the pre-ALTER schema or not honoring the new column list for this decoding path. No CLI subcommand exists to restart or inspect the Realtime tenant's internal state; the only known remaining lever is a full Supabase dashboard project restart. **Decision:** accepted as a documented residual risk rather than pursued further — `message` is short, server-generated, non-medical informational text (e.g. "Your appointment with Dr. X was confirmed"), never rendered client-side by design (D-03), so practical exposure is minimal; the Postgres-catalog fix already closes the authoritative half of the boundary. Carried forward in STATE.md Blockers/Concerns for optional follow-up before a production deploy with real user data.

### Gaps Summary

No blocking gaps in the 12 roadmap-derived must-have truths (PATIENT-01/02/03/04, DOCTOR-01/02, NOTIF-01/02/03/04, I18N-01/02) — verified with a combination of static code inspection and live Playwright execution against the running dev server and linked Supabase project, not merely SUMMARY.md claims. `tsc`, `eslint`, and 7 targeted live spot-checks all passed. Dictionary key parity (213/213, zero gaps, zero placeholder values) was verified programmatically rather than trusted from the SUMMARY narrative.

Of the two code-review warnings that gated `human_needed` status: **WR-01 is now resolved** with a commit reference and an already-passing automated test (quick task 260827-isc, 2026-08-27). **WR-02 is now resolved** at the Postgres-catalog level (the authoritative RLS-adjacent boundary), with a remaining managed-service wire-level gap explicitly accepted by human decision on 2026-08-27 as a documented, non-blocking residual risk (rationale: non-medical informational text, never rendered). Both warnings that gated status are closed — **status flips to `passed`**. WR-03 (Hebrew pluralization), IN-01 (locale cookie `Secure` attribute), and IN-02 (doctor change-password translation timing) remain exactly as originally documented — untouched, non-blocking, carried forward, not gating.

---

_Verified: 2026-08-13T19:30:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verified: 2026-08-27T00:00:00Z (quick task 260827-isc + human decision) — WR-01 resolved, WR-02 resolved at Postgres-catalog level with wire-level gap accepted as residual risk, status flips to `passed`_
