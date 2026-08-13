---
phase: 06-dashboards-notifications-localization
plan: 09
subsystem: ui
tags: [i18n, react, nextjs, playwright]

requires:
  - phase: 06-dashboards-notifications-localization
    provides: dictionaries/en.json + dictionaries/he.json translation key inventory, useT()/getT() runtime, translateValidationMessage() bridge (06-05, 06-07)
provides:
  - Site header controls (logout, favorite toggle), both appointment pages, the patient dashboard, the favorites page, the doctor dashboard, the doctor schedule page and the change-password page fully retrofitted to render through t()
  - appointmentBadge() returns a stable labelKey instead of an English sentence; both appointment pages' cancel/reschedule eligibility predicates key off that stable identifier instead of rendered text (T-06-40 closed)
affects: [06-10]

actuals:
  tokens: 15476
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Server Components resolve translations via `await getT()` (lib/i18n/server.ts); Client Components via `useT()` (lib/i18n/locale-provider.tsx)"
    - "AppointmentBadge.labelKey: TranslationKey replaces the former label: string member; every render site calls t(badge.labelKey) instead of printing the derived sentence directly"
    - "Eligibility predicates that gate a mutating control (Reschedule/Cancel) compare badge.labelKey against the appointment_status.confirmed key, never against rendered/translated text — closes the elevation-of-privilege pattern where UI language could theoretically affect a permission decision"
    - "A component with zero translatable literals of its own (a pure composition wrapper hosting already-translated children) correctly receives no t()/getT()/useT() call — translation coverage is measured per-string, not per-file"

key-files:
  created: []
  modified:
    - components/logout-button.tsx
    - components/favorite-toggle.tsx
    - lib/appointments.ts
    - app/patient/page.tsx
    - app/patient/appointments/page.tsx
    - app/doctor/(gated)/appointments/page.tsx
    - app/patient/favorites/page.tsx
    - app/doctor/(gated)/page.tsx
    - app/doctor/(gated)/schedule/page.tsx
    - app/doctor/change-password/page.tsx

key-decisions:
  - "components/site-header.tsx and components/notification-bell.tsx received no edit in this plan — see Deviations below"
  - "AppointmentBadge's first member renamed label -> labelKey: TranslationKey; all three call sites (both appointment pages, patient dashboard) migrated in the same task since the signature change breaks compilation until every site is updated"
  - "Both appointment pages' Reschedule/Cancel eligibility predicates switched from comparing rendered label text to comparing badge?.labelKey against the appointment_status confirmed key, closing T-06-40 (elevation-of-privilege via a translatable-string-keyed permission decision)"

requirements-completed: [I18N-01]

coverage:
  - id: D1
    description: "Site header controls (logout button, favorite toggle) translate fully; site-header.tsx itself and notification-bell.tsx needed no change"
    requirement: "I18N-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/auth-logout.spec.ts, tests/e2e/patient-favorites.spec.ts (unedited)"
        status: pass
    human_judgment: false
  - id: D2
    description: "appointmentBadge() returns labelKey; both appointment pages and the patient dashboard translate the derived status via t(badge.labelKey); eligibility predicates key off labelKey, not rendered text"
    requirement: "I18N-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-history.spec.ts, tests/e2e/appointment-cancel.spec.ts, tests/e2e/appointment-reschedule.spec.ts, tests/e2e/patient-dashboard.spec.ts (unedited)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Favorites page, doctor dashboard, doctor schedule page and change-password page translate all copy including validation messages via translateValidationMessage()"
    requirement: "I18N-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-add-slot.spec.ts, tests/e2e/doctor-schedule-block-period.spec.ts, tests/e2e/doctor-schedule-delete-slot.spec.ts, tests/e2e/doctor-schedule-overlap.spec.ts, tests/e2e/doctor-schedule-visibility.spec.ts, tests/e2e/doctor-dashboard.spec.ts (unedited)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Full suite green modulo pre-existing, already-tracked shared-dev-DB/Supabase-Auth-under-load flakiness (WINDOWS.md); tsc/lint/build all exit clean"
    requirement: "I18N-01"
    verification:
      - kind: e2e
        ref: "npx playwright test (full suite): 311 passed / 10 failed, 31.8min; all 10 failures logged as WINDOWS.md id 11, none touch this plan's files"
        status: pass
    human_judgment: false
  - id: D5
    description: "With the locale cookie set to he, every retrofitted authenticated page and the header controls render Hebrew copy"
    verification: []
    human_judgment: true
    rationale: "Requires visually inspecting rendered Hebrew text and RTL layout in a live browser session — no automated assertion covers the actual Hebrew string content beyond the dictionary lookup itself"

duration: 45min
completed: 2026-08-13
status: complete
---

# Phase 6 Plan 9: Authenticated Surface and Shared Component Localization Summary

**Retrofitted the site header's hosted controls, both appointment pages, the patient dashboard, the favorites page, the doctor dashboard, the doctor schedule page and the change-password page to render entirely through `t()`, and changed `appointmentBadge()` to return a stable dictionary key instead of an English sentence so the cancel/reschedule eligibility predicate no longer depends on the interface language.**

## Performance

- **Duration:** ~45 min (execution) + this closure session (verification only, no new implementation)
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Ten authenticated-surface and shared-component files now resolve every user-facing string through `getT()` (Server Components) or `useT()` (Client Components) against the 06-07 dictionary inventory — no new dictionary keys added (`git diff --stat dictionaries/` empty across all three commits)
- `AppointmentBadge.label: string` became `AppointmentBadge.labelKey: TranslationKey` in `lib/appointments.ts`; all three call sites (both appointment pages, patient dashboard) migrated in the same commit since the signature change breaks compilation until every site updates
- Both appointment pages' Reschedule/Cancel eligibility predicates now compare `badge?.labelKey` against the `appointment_status` confirmed key instead of comparing rendered/translated text — closes T-06-40 (an interface-language-dependent permission decision), confirmed with the locale cookie set to `he`: a confirmed upcoming appointment still exposes both controls
- `app/patient/favorites/page.tsx`, `app/doctor/(gated)/page.tsx`, `app/doctor/(gated)/schedule/page.tsx` and `app/doctor/change-password/page.tsx` fully translated, including every `lib/validation/*.ts` message routed through `translateValidationMessage()` at the render boundary — no validator or route handler modified
- `git diff --name-only` across all three commits lists no file under `app/admin/` or `components/admin/`; `git diff --stat lib/timezone.ts lib/validation/` reports no change
- `npx tsc --noEmit`, `npm run lint` and `npm run build` all exit clean
- Full Playwright suite (321 tests, 31.8 min): 311 passed / 10 failed, with every failure independently confirmed to be pre-existing, already-tracked flakiness unrelated to this plan (see Issues Encountered and WINDOWS.md id 11)

## Task Commits

Each task was committed atomically (all three predate this closure session):

1. **Task 1: Site header controls (logout, favorite toggle)** - `ec500f2` (feat) — `components/favorite-toggle.tsx`, `components/logout-button.tsx`
2. **Task 2: Appointment status labels become dictionary keys, across both appointment pages and the patient dashboard** - `85d5e76` (feat) — `lib/appointments.ts`, `app/patient/appointments/page.tsx`, `app/doctor/(gated)/appointments/page.tsx`, `app/patient/page.tsx`
3. **Task 3: Favorites page, doctor dashboard, doctor schedule and change-password page** - `12a01e6` (feat) — `app/patient/favorites/page.tsx`, `app/doctor/(gated)/page.tsx`, `app/doctor/(gated)/schedule/page.tsx`, `app/doctor/change-password/page.tsx`

**Plan metadata:** (this commit)

## Files Created/Modified

- `components/logout-button.tsx` - visible label and failure message translated via `useT()`
- `components/favorite-toggle.tsx` - both aria-labels and the failure message translated via `useT()`
- `lib/appointments.ts` - `AppointmentBadge.labelKey: TranslationKey` replaces `label: string`; `appointmentBadge()` returns the four `appointment_status` keys instead of literal sentences
- `app/patient/page.tsx` - dashboard headings, empty state, quick-link labels and the badge render translated via `getT()`/`t(badge.labelKey)`
- `app/patient/appointments/page.tsx` - headings, dialogs, buttons, aria-labels and the eligibility predicate (now keyed on `labelKey`) translated
- `app/doctor/(gated)/appointments/page.tsx` - mirrors the patient page's translation and eligibility-predicate migration
- `app/patient/favorites/page.tsx` - page title, empty state, CTA, load error and next-available line translated
- `app/doctor/(gated)/page.tsx` - heading, stat-card captions, quick links and Suspense fallback translated via `getT()`
- `app/doctor/(gated)/schedule/page.tsx` - slot form, blocked-period form, list headings, delete confirmations, error messages and aria-labels translated; validation messages routed through `translateValidationMessage()`
- `app/doctor/change-password/page.tsx` - headings, field labels, submit copy, success/failure messages translated

## Decisions Made

- `AppointmentBadge`'s first member renamed `label` → `labelKey: TranslationKey`; every render site (`t(badge.labelKey)`) and every eligibility comparison migrated in the same task/commit, since the type change is a hard compile break until all three call sites move together
- Both appointment pages' cancel/reschedule eligibility predicates switched from comparing rendered label text to comparing `badge?.labelKey` against the `appointment_status` confirmed key — the server-side `cancel_appointment()`/`reschedule_appointment()` guards remain the actual authorization boundary regardless, but this closes the display-layer language-dependency named in T-06-40
- Form-surfaced validator messages on the schedule and change-password pages are wrapped in `translateValidationMessage(message, t)` at the point they render; `lib/validation/*.ts` itself and every route handler are untouched

## Deviations from Plan

### `components/site-header.tsx` received no edit — deliberately, not a gap

The plan's `must_haves.artifacts` and Task 1's acceptance criteria expected `components/site-header.tsx` to contain `getT`. On inspection, `site-header.tsx` (as left by 06-05/06-06) is a pure composition wrapper: it fetches `full_name`/`role`, renders the brand link (`MedRDV`, a proper noun, deliberately never translated), and mounts the language switcher, notification bell, favorite-toggle-hosting children, and logout button — every one of which is already a self-translating component. The file itself carries zero translatable string literals. Adding a no-op `getT()` import purely to satisfy a speculative acceptance criterion would have been dead code. `git diff --stat components/site-header.tsx` across all three commits is empty; `grep -c "getT\|useT" components/site-header.tsx` returns 0, confirming the file both needed and received no translation call. Translation coverage in this plan is verified per-string (every user-facing literal resolves through the dictionary), not per-file, and by that measure the header is fully covered by its already-translated children.

### `components/notification-bell.tsx` received no edit — already fully translated by 06-06

The plan's Task 1 `<read_first>` flagged this file "for any literal that escaped 06-06 — most notably the Retry button label." On inspection, `notification-bell.tsx` already calls `useT()` (imported from `@/lib/i18n/locale-provider`) and every visible string, including the retry control, already resolves through `t()` (e.g. `t("common.retry")`) as built in 06-06. No literal had escaped; there was nothing left for this plan to change. `git diff --stat components/notification-bell.tsx` across all three commits is empty.

### No other deviations

All three tasks otherwise executed exactly as planned. No dictionary key was added, renamed or removed (`git diff --stat dictionaries/` empty). No file under `app/admin/` or `components/admin/` was touched. `lib/timezone.ts` and `lib/validation/` are untouched.

## Issues Encountered

### Environment setup required before the full-suite verification could run

This closure session needed three environment fixes before `npx playwright test` (full suite) could execute at all — none are code defects:

1. A stale `node.exe` dev-server process (PID 36460) from an earlier interrupted session was already bound to port 3000 and responding with HTTP 500, causing Playwright's `webServer` to detect "Another next dev server is already running" and fail immediately. Killed the stale process; port 3000 came up clean afterward.
2. On the next attempt, Turbopack crashed with `FATAL: An unexpected Turbopack error occurred` (`node process exited ... exit code: 0xc0000142`, i.e. Windows `STATUS_DLL_INIT_FAILED`) while writing the root page's CSS chunk. This is a Windows/Turbopack-level crash (plausibly antivirus/EDR interference with Turbopack's on-disk chunk writes, given a Cynet MS agent process observed running at the time), not related to any code in this plan. Clearing `.next` (`rm -rf .next`) and retrying resolved it; the dev server then started and served requests cleanly.
3. With the environment clean, `npx playwright test` ran to completion: 321 tests, 311 passed / 10 failed, 31.8 minutes.

### Full-suite run: 10 pre-existing failures, all logged, none touching this plan's files

All 10 failures are independently confirmed to belong to already-tracked flakiness classes:

- **`admin-doctor-crud.spec.ts:37`** and **7 cascading failures in `admin-doctor-link-account.spec.ts`** (tests 1–6, 8 of that describe block): the admin doctor-creation and doctor-login-linking flows timed out waiting for UI confirmation (`getByText('Login created')` never appearing; one downstream case surfaced a raw `TypeError: Cannot read properties of undefined (reading 'trim')` in `lib/validation/auth.ts`'s `validateEmail` when a prior step's undefined state cascaded forward). This is a worse-than-usual recurrence of the Supabase-Auth-under-load flakiness class already flagged in `STATE.md`'s 06-05 blocker entry ("Supabase Auth 'Could not create a login' — plausibly rate-limiting from this session's several consecutive full-suite runs"). Neither spec file, `app/admin/`, `components/admin/`, nor `lib/validation/auth.ts` is in this plan's file scope.
- **`appointment-reschedule.spec.ts:764`**: failed only on its `afterAll` cleanup hook (30000ms timeout) — the test's own eligibility assertion ("exactly one Reschedule control exists and it belongs to the upcoming row") passed. Same recurring class as WINDOWS.md ids 6, 9, 10.
- **`seed-availability.spec.ts:170`**: doctor slot count assertion (`expect >= 6, received 3`), the same recurring shared-dev-DB residue class as WINDOWS.md ids 1, 3, 5, 7, 8, 10.

Every task-scoped spec for this plan's own files passed cleanly in the same run: `auth-logout.spec.ts` (5/5), `patient-favorites.spec.ts` (6/6), `appointment-history.spec.ts` (11/11), `appointment-cancel.spec.ts` (18/18, including its own UI-eligibility assertion), `appointment-reschedule.spec.ts` (all assertions except the cleanup-hook timeout above), `patient-dashboard.spec.ts` (3/3), `doctor-dashboard.spec.ts` (4/4), `doctor-schedule-add-slot.spec.ts` (11/11), `doctor-schedule-block-period.spec.ts` (14/14), `doctor-schedule-delete-slot.spec.ts` (11/11), `doctor-schedule-overlap.spec.ts` and `doctor-schedule-visibility.spec.ts` (full), `notifications-realtime.spec.ts` (13/13), `locale-switching.spec.ts` (5/5).

Logged as WINDOWS.md id 11, consistent with every prior 06-0X plan's full-suite closure run.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The authenticated surface (patient dashboard, both appointment pages, favorites, doctor dashboard, doctor schedule, change-password) and every shared component (header controls, notification bell) are now fully bilingual
- Combined with 06-08's public/auth surface, every non-admin page in the application renders entirely through the dictionary in both English and Hebrew (I18N-01 complete for this phase's scope)
- No blockers introduced by this plan; 06-10 can proceed without any dependency on this plan's remaining work

---
*Phase: 06-dashboards-notifications-localization*
*Completed: 2026-08-13*

## Self-Check: PASSED

All 10 modified files and the SUMMARY.md exist on disk; all 3 task commits (`ec500f2`, `85d5e76`, `12a01e6`) verified present in `git log --oneline --all`.
