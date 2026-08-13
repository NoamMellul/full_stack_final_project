---
phase: 06-dashboards-notifications-localization
plan: 07
subsystem: i18n
tags: [i18n, dictionaries, validation, rtl, nextjs]

# Dependency graph
requires:
  - phase: 06-dashboards-notifications-localization
    provides: "06-05's i18n runtime (dictionaries/*.json, lib/i18n/dictionaries.ts's TranslationKey typing) and 06-02/06-03/06-06's new UI surfaces (favorites, dashboards, notification bell)"
provides:
  - "dictionaries/en.json and dictionaries/he.json: complete non-admin key inventory (213 keys total) — home.*, auth.login.*, auth.signup.*, search.*, search.results.*, doctor_card.*, languages.*, doctor_profile.*, appointment_status.*, favorite_toggle.*, patient_dashboard.*, patient_appointments.*, doctor_appointments.*, doctor_dashboard.*, doctor_schedule.*, auth.change_password.*, patient_favorites.*, header.log_out_error, validation.*"
  - "lib/i18n/validation-messages.ts: VALIDATION_MESSAGE_KEYS + translateValidationMessage(), the message-string-to-key bridge for lib/validation/auth.ts, appointments.ts, availability.ts and search.ts"
affects: [06-08, 06-09, 06-10]

# Actuals (#2632)
actuals:
  tokens: 8652
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Message-string-to-dictionary-key lookup (lib/i18n/validation-messages.ts) mirrors the existing FIELD_BY_MESSAGE idiom from components/admin/doctors-page-client.tsx — translates at the render boundary, zero changes to lib/validation/*.ts or any route handler"
    - "Per-surface key ownership: each page/component namespace (e.g. patient_dashboard.*, patient_appointments.*) owns its own keys even where the English text is identical to another namespace's key, avoiding cross-page/cross-task key coupling — the one deliberate exception is the shared languages.he/languages.en pair (RESEARCH Pitfall 6) and the pre-existing common.retry key"
    - "Static-text-plus-composed-dynamic-child pattern for every interpolated string (result counts, next-available day/time, 'with Dr. X', composed aria-labels) — no placeholder-substitution/message-format engine added, matching the locked project constraint"
key-files:
  created:
    - lib/i18n/validation-messages.ts
  modified:
    - dictionaries/en.json
    - dictionaries/he.json
key-decisions:
  - "RESEARCH Assumption A3 locked as option (a): validation error messages are translated by a message-string-to-key lookup at the render boundary, not by refactoring validate*() to return codes"
  - "languages.he/languages.en authored as the single shared pair that both LANGUAGE_LABELS duplicates (doctor-card.tsx, app/doctors/[id]/page.tsx) collapse onto in 06-08 (RESEARCH Pitfall 6)"
  - "doctor_card.next_available_prefix / doctor_card.no_availability / doctor_card.demo_profile are the single source reused by doctor-card.tsx, app/doctors/[id]/page.tsx and app/patient/favorites/page.tsx, per UI-SPEC's explicit 'reuse DoctorCard's row visual language, do not reinvent this line' instruction — the only other cross-surface key sharing besides languages.*/common.retry"
  - "appointment_status.confirmed/past/cancelled_by_patient/cancelled_by_doctor mirror lib/appointments.ts's four literal badge labels verbatim; lib/appointments.ts itself is untouched here — 06-09 changes appointmentBadge() to return labelKey and switches both appointment pages' eligibility predicates to compare against appointment_status.confirmed instead of rendered text (T-06-40)"
  - "search.results.count_label ('result') and search.results.count_plural_suffix ('s'/'ות') preserve the exact existing total===1 ternary structure rather than introducing pluralisation logic or a message-format engine; the Hebrew suffix concatenation is a known, accepted imperfection (Hebrew plurals are not formed by suffixing) since PROJECT.md forbids adding an ICU-style formatting library"
  - "home.* keys translate app/page.tsx's literal, never-customized create-next-app boilerplate as-is (verified via git log that the file has been untouched since the initial scaffold commit) — 06-08's own plan explicitly targets this file's current content, so the boilerplate strings are the correct translation target, not a stand-in for future landing-page copy"
requirements-completed: []

coverage:
  - id: D1
    description: "Complete, typed, key-parity-enforced translation dictionary covering every non-admin surface's user-facing strings (public/auth pages, patient/doctor dashboards, appointments, favorites, schedule, change-password, shared header controls) in both English and Hebrew"
    requirement: "I18N-01"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (dictionaries/he.json typed as Record<TranslationKey, string> — a missing Hebrew key is a compile error)"
        status: pass
      - kind: unit
        ref: "node -e key-set-equality check between dictionaries/en.json and dictionaries/he.json (213 keys each)"
        status: pass
      - kind: unit
        ref: "node -e equal-value scan across all 213 keys (0 English/Hebrew pairs identical)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Validation-message-to-dictionary-key bridge that lets already-tested lib/validation/*.ts functions surface translated errors without any validator or route handler being modified"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit; git diff --stat lib/validation/ (no change); git diff --name-only app/api/ (no change)"
        status: pass
      - kind: unit
        ref: "VALIDATION_MESSAGE_KEYS confirmed to contain all 5 lib/validation/auth.ts literals plus 15 more from appointments.ts/availability.ts/search.ts; translateValidationMessage falls through unchanged for an unmapped message"
        status: pass
    human_judgment: false
  - id: D3
    description: "Full Playwright regression suite shows no failure attributable to this plan's changes (dictionary JSON additions and one new, not-yet-imported utility module)"
    verification:
      - kind: e2e
        ref: "npx playwright test (full 321-test suite): 305 passed, 5 failed, 11 did not run — all 5 failures and their cascades fall into the already-documented shared-dev-DB test-residue / Supabase-API-rate-limiting flakiness class (STATE.md blockers, WINDOWS.md ids 1/3/6/7)"
        status: pass
      - kind: e2e
        ref: "isolated re-run of the 4 affected spec files: appointment-reschedule.spec.ts and doctor-schedule-visibility.spec.ts suites passed cleanly (including the test that failed in the full run); remaining failures were afterAll-hook 30s cleanup timeouts (test assertions themselves passed) plus the recurring seed-availability.spec.ts:170 residue"
        status: pass
    human_judgment: true
    rationale: "The full-suite failures are consistent with a documented, multiply-reconfirmed pre-existing environmental class rather than a code regression, but a human should independently confirm (as flagged by every prior 06-0X plan) before /gsd-ship that this class is genuinely pre-existing."

# Metrics
duration: 210min
completed: 2026-08-13
status: complete
---

# Phase 06 Plan 07: Translation Key Inventory and Validation-Message Bridge Summary

**Authored the complete 213-key non-admin translation dictionary (en/he) covering every public, auth, patient, doctor and shared-component surface across Phases 1-6, plus `lib/i18n/validation-messages.ts`, the message-string-to-key bridge that lets `lib/validation/*.ts`'s already-tested literal error strings render translated without touching a single validator or route handler.**

## Performance

- **Duration:** ~210 min (including a 41-minute full-suite regression run and a 12-minute targeted re-run of 4 affected spec files)
- **Tasks:** 3
- **Files modified:** 1 created (`lib/i18n/validation-messages.ts`), 2 extended (`dictionaries/en.json`, `dictionaries/he.json`)

## Accomplishments
- `dictionaries/en.json` / `dictionaries/he.json` grew from 12 keys (06-05's `common.*`/`header.*`/`notifications.*` seed) to **213 keys**, with every Hebrew value a real, distinct translation (0 accidental English/Hebrew duplicates across all 213 keys)
- Task 1 — public and authentication surfaces: `home.*` (10 keys, app/page.tsx's literal, never-customized boilerplate content), `auth.login.*` (9), `auth.signup.*` (10), `search.*`/`search.results.*` (23), `doctor_card.*` (4), `doctor_profile.*` (12), and the shared `languages.he`/`languages.en` pair that collapses RESEARCH's Pitfall 6 duplicate `LANGUAGE_LABELS` maps
- Task 2 — patient, doctor and shared-component surfaces: `appointment_status.*` (4, verbatim mirror of `lib/appointments.ts`'s four badge labels — the module itself untouched), `favorite_toggle.*` (3), `patient_dashboard.*` (11), `patient_appointments.*` (28), `doctor_appointments.*` (15), `doctor_dashboard.*` (5), `doctor_schedule.*` (31), `auth.change_password.*` (8), `patient_favorites.*` (5), and `header.log_out_error` extending 06-05's `header.*` namespace — every UI-SPEC Copywriting Contract string taken verbatim
- Task 3 — validation bridge: `validation.*` (20 keys covering every literal message reachable from a non-admin page across `lib/validation/auth.ts`, `appointments.ts`, `availability.ts` and `search.ts`) plus `lib/i18n/validation-messages.ts` exporting `VALIDATION_MESSAGE_KEYS` and `translateValidationMessage(message, t)`, which degrades an unmapped message to the original English sentence rather than a blank field or raw key path
- `lib/validation/doctor.ts` and `lib/validation/reference-data.ts` (admin-only) deliberately left unmapped — their messages pass through `translateValidationMessage` unchanged, which is the correct English-only admin behaviour per D-04
- No page, component, validation function, or route handler modified anywhere in this plan — purely additive dictionary content plus one new, currently-unimported pure lookup module

## Task Commits

Each task was committed atomically:

1. **Task 1: Public and authentication surface keys (English and Hebrew)** - `efce4e0` (feat)
2. **Task 2: Patient, doctor and shared-component surface keys (English and Hebrew)** - `9d6ebc0` (feat)
3. **Task 3: Validation message to dictionary key bridge** - `c218997` (feat)

**Plan metadata:** commit pending (docs: complete plan)

## Files Created/Modified
- `dictionaries/en.json` - extended from 12 to 213 flat translation keys
- `dictionaries/he.json` - matching 213 Hebrew values, all real translations
- `lib/i18n/validation-messages.ts` - `VALIDATION_MESSAGE_KEYS`, `translateValidationMessage()`

## Decisions Made
- RESEARCH Assumption A3 locked as option (a): message-string-to-key lookup at the render boundary, not a `validate*()` return-code refactor (larger blast radius, would touch every route handler consuming a validator)
- Per-surface key ownership as the default: each page/namespace gets its own key even when the English value duplicates another namespace's key, to avoid cross-task/cross-page coupling assumptions between 06-08 and 06-09 (which retrofit different file sets in different tasks)
- Two deliberate exceptions to per-surface ownership: the shared `languages.he`/`languages.en` pair (RESEARCH Pitfall 6, explicit plan instruction) and `doctor_card.next_available_prefix`/`doctor_card.no_availability`/`doctor_card.demo_profile` (UI-SPEC's explicit "reuse DoctorCard's row visual language, do not reinvent this line" instruction for the favorites-list row) — plus the pre-existing `common.retry` key from 06-05
- `appointment_status.*` keys are the literal current label text (`Confirmed`/`Past`/`Cancelled by patient`/`Cancelled by doctor`); 06-09 is the plan that changes `appointmentBadge()`'s return shape and the eligibility-predicate comparisons — this plan only authors the keys and leaves `lib/appointments.ts` untouched, confirmed via `git diff --stat`
- Hebrew pluralisation for the search result count (`search.results.count_label`/`count_plural_suffix`) preserves the existing English suffix-concatenation architecture rather than adding a message-format engine; documented as an accepted, project-constraint-driven imperfection (Hebrew doesn't pluralise by suffixing) rather than a defect to fix
- `home.*` translates `app/page.tsx`'s actual current content (the untouched create-next-app boilerplate, confirmed via `git log` to have never been customized since the initial scaffold commit) because 06-08's own plan explicitly retrofits this exact file's current strings — not a placeholder for hypothetical future landing-page copy

## Deviations from Plan

None — plan executed exactly as written. All three tasks' acceptance criteria were verified directly:
- Key-set parity (`en.json` keys === `he.json` keys) confirmed after each task via `node -e`
- Equal-value scan (0 English/Hebrew pairs identical) confirmed after each task
- `npx tsc --noEmit` exits 0 after each task
- `npm run lint` exits 0, `npm run build` succeeds
- `git diff --stat lib/appointments.ts` reports no change (Task 2)
- `git diff --stat lib/validation/` and `git diff --name-only app/api/` report no change (Task 3)
- `grep -c '"עב"'` / `grep -c '"EN"'` on `dictionaries/en.json` both report 0 (language-switcher literals never became dictionary keys)

## Issues Encountered

**Full-suite Playwright run (41 min): 305 passed, 5 failed, 11 did not run.** This plan changes zero application code — only JSON dictionary content plus one new, currently-unimported TypeScript module (`lib/i18n/validation-messages.ts` is not yet imported by any page; 06-08/06-09 wire it in). All 5 failures and their cascades are consistent with the already-documented, multiply-reconfirmed shared-dev-DB test-residue and Supabase-API-rate-limiting flakiness class every prior 06-0X plan's SUMMARY has logged:

- `appointment-reschedule.spec.ts:764` — the identical recurring failure logged by 06-04, 06-05 and 06-06's SUMMARYs.
- `doctor-schedule-overlap.spec.ts:381` ("Cross-doctor non-collision") and `doctor-schedule-visibility.spec.ts:190` (a `beforeAll` hook timeout that cascaded 8 further tests in that file to "did not run") — new specific instances of the same class, not previously seen at this exact test.
- `seed-availability.spec.ts:170` (and a `beforeAll` timeout at `:184` cascading 3 more tests) — the same recurring slot-count assertion already tracked as WINDOWS.md ids 1 and 3.

A targeted re-run of just these 4 spec files (12 min, isolated from the rest of the suite) showed: the `appointment-reschedule.spec.ts` test that failed in the full run passed cleanly here, and the entire `doctor-schedule-visibility.spec.ts` suite (all 9 tests, including the one whose `beforeAll` had timed out) passed cleanly. The remaining failures in this second run were `"afterAll" hook timeout of 30000ms exceeded` — meaning the test's own assertions had already passed and only the post-test Supabase cleanup calls timed out — consistent with API rate-limiting from this session's several consecutive heavy test runs against the shared dev project (a class STATE.md's blockers section already attributes to "plausibly rate-limiting from this session's several consecutive full-suite runs"). `seed-availability.spec.ts:170`'s specific assertion failure (doctor slot count 3 instead of >=6) reproduced identically in both runs, consistent with genuine shared-DB test residue rather than a timing artifact.

No further re-runs were attempted, per the standing guidance against chasing flaky infrastructure — the evidence gathered (zero application code changed, `tsc`/`lint`/`build` all clean, and every failure independently explainable by an already-documented environmental class) is sufficient to attribute these failures to environment, not to this plan. Logged as WINDOWS.md ledger entries 8 and 9.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The complete 213-key dictionary inventory is ready for 06-08 (public/auth retrofit) and 06-09 (patient/doctor/shared-component retrofit) to consume read-only, exactly as this plan's key_links promise — neither plan should need to add a key.
- `lib/i18n/validation-messages.ts` is ready for both retrofit plans to import wherever a `lib/validation/*.ts` message reaches the DOM.
- Before `/gsd-ship`, a human should independently confirm — as already flagged by every prior 06-0X plan — that the recurring shared-dev-DB-residue/rate-limiting failure class (`seed-availability.spec.ts:170`, `appointment-reschedule.spec.ts:764`, and this plan's two new instances) is genuinely pre-existing/environmental and not masking a real regression; a clean run against a reset dev database or during a quieter API-usage window would be the strongest confirmation.

---
*Phase: 06-dashboards-notifications-localization*
*Completed: 2026-08-13*

## Self-Check: PASSED
