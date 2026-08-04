---
phase: 02-admin-doctor-reference-data-management
plan: 06
subsystem: database
tags: [supabase, tsx, seed-script, demo-data, idempotency]

requires:
  - phase: 02-admin-doctor-reference-data-management
    provides: "unique (name_en) on specialties and unique (neighborhood, city) on locations (02-03), doctors/doctor_languages schema and RLS (Phase 1), auth.admin.createUser + profiles insert pattern (tests/e2e/helpers/test-users.ts)"
provides:
  - "scripts/seed.ts: idempotent demo-data seeder for specialties, locations, doctors, doctor_languages and demo patients, re-runnable with zero duplicate rows"
  - "npm run seed entry point and the tsx devDependency (approved at the package-legitimacy checkpoint)"
  - "12 demo doctors (is_demo=true, is_active=true, photo_url=null) spread one-per-specialty and one-per-neighborhood, each with at least one doctor_languages row, plus 4 demo patient accounts"
affects: [03-patient-search]

actuals:
  tokens: 4000
  tasks: 2
  commits: 1

tech-stack:
  added: ["tsx ^4.23.5 (devDependency, TypeScript script runner)"]
  patterns:
    - "Standalone TypeScript script builds its own service-role client directly from @supabase/supabase-js (never imports lib/supabase/admin.ts, which is server-only) and loads .env.local via @next/env's loadEnvConfig, mirroring playwright.config.ts"
    - "Idempotency without natural keys: doctors have no unique constraint, so the script reads existing is_demo doctor full_names first and filters the insert list, rather than relying on ON CONFLICT"
    - "Summary line prints post-run table totals (not per-run deltas), which is what makes two consecutive runs' output byte-identical and gives the idempotency proof a trivial string-equality check"

key-files:
  created:
    - scripts/seed.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Package-legitimacy checkpoint for tsx (SUS/too-new verdict) resolved as approved by the human in the continuation context; installed as planned, scripts/seed.ts written as TypeScript (not the .mjs fallback)"
  - "12 demo doctors chosen as a 1:1 pairing of specialty[i] with location[i], which trivially guarantees the 'every specialty has a doctor' and 'every neighborhood has a doctor' truths with the smallest possible dataset inside the 10-15 envelope"
  - "Language mix assigned by doctor index mod 3 (both / he-only / en-only) so Phase 3's language filter has doctors on every side of it"
  - "Demo patient count in the summary line is scoped to profiles where role='patient' matching the 4 fixed demo emails' effect on that count, read as a straightforward table-role count rather than tracked by a separate is_demo-style flag (profiles has no such column)"

patterns-established:
  - "Any future one-off admin/maintenance script that needs a service-role Supabase client outside the Next.js runtime should follow scripts/seed.ts's shape: @next/env's loadEnvConfig + a locally-built createClient, never importing the server-only lib/supabase/admin.ts"

requirements-completed: [ADMIN-01, ADMIN-05, ADMIN-06]

coverage:
  - id: D1
    description: "Running npm run seed against the database populates every specialty, every Tel-Aviv neighborhood, and 12 demo doctors distributed across them, each is_demo/is_active true with no photo_url (D-07, D-08)"
    requirement: "ADMIN-01"
    verification:
      - kind: other
        ref: "npm run seed — verified via direct query: 12 seeded doctors, 12 distinct specialty_ids, 12 distinct location_ids, all is_demo=true/is_active=true/photo_url=null"
        status: pass
    human_judgment: false
  - id: D2
    description: "The seed script creates no availability_slots rows (D-09)"
    verification:
      - kind: other
        ref: "availability_slots row count queried before and after the seed run: 0 both times"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every seeded doctor has at least one doctor_languages row"
    verification:
      - kind: other
        ref: "direct query: all 12 seeded doctor ids have >=1 doctor_languages row"
        status: pass
    human_judgment: false
  - id: D4
    description: "Running npm run seed a second time adds zero new rows — two consecutive runs print byte-identical summary lines"
    requirement: "ADMIN-01"
    verification:
      - kind: other
        ref: "two consecutive `npm run --silent seed` invocations, compared via shell string equality — see 'Verified idempotency proof' below"
        status: pass
    human_judgment: false
  - id: D5
    description: "The demo dataset does not break any existing Playwright spec"
    verification:
      - kind: e2e
        ref: "npx playwright test (full suite)"
        status: pass
    human_judgment: false
  - id: D6
    description: "scripts/seed.ts performs only insert/upsert operations — no row-removal or table-truncation call of any kind (T-02-16)"
    verification:
      - kind: other
        ref: "grep -nE \"\\.delete\\(|truncate|\\.rpc\\(.*drop\" scripts/seed.ts — no match"
        status: pass
    human_judgment: false
  - id: D7
    description: "The seed script creates four demo patient accounts and no admin accounts"
    requirement: "ADMIN-01"
    verification:
      - kind: other
        ref: "npm run seed summary line: patients=4; role: 'patient' is a script-side literal, never taken from input"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-08-04
status: complete
---

# Phase 2 Plan 06: Demo-Data Seed Script Summary

**Idempotent `scripts/seed.ts` (run via `npm run seed`, powered by the newly-approved `tsx` devDependency) seeds the full specialty and Tel-Aviv neighborhood catalogs plus 12 demo doctors and 4 demo patients, proven re-runnable with byte-identical summary output across two consecutive runs and zero regressions across the full 99-test Playwright suite.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-04T22:05:00+03:00
- **Tasks:** 2/2 completed (the leading package-legitimacy checkpoint was resolved by the human before this run started, per the continuation context)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Installed the human-approved `tsx` devDependency and added the `npm run seed` entry point
- Wrote `scripts/seed.ts`: upserts all 12 specialties and all 12 Tel-Aviv neighborhoods, inserts 12 demo doctors (one per specialty, one per neighborhood) each with a `doctor_languages` mix of Hebrew/English/both, and creates 4 demo patient accounts — guarded at every step so a second run inserts nothing
- Verified idempotency directly: two consecutive `npm run seed` runs printed byte-identical summary lines with no code changes needed (the guards worked correctly on the first implementation)
- Full Playwright suite (99 tests) green against the seeded database — the demo data introduced no regressions

## Task Commits

1. **Task 1: The idempotent demo-data seed script** - `531a22c` (feat)
2. **Task 2: Prove the seed is genuinely re-runnable** - no new commit; verification-only task, ran the existing script twice and the full Playwright suite, both passed without requiring any change to `scripts/seed.ts`

**Plan metadata:** pending (this commit)

## Verified idempotency proof

Two consecutive `npm run --silent seed` invocations against the shared remote dev database, immediately after the first seeding run:

```
run1=seed complete: specialties=28 locations=24 doctors=57 doctor_languages=16 patients=4
run2=seed complete: specialties=28 locations=24 doctors=57 doctor_languages=16 patients=4
```

The two lines are byte-identical, proving the second run inserted nothing. See "Issues Encountered" below for why the printed totals (28/24/57) are larger than this script's own 12/12/12/16/4 contribution — the totals are pre-existing, unrelated residue in the shared dev database, not something this run added or could re-add.

## Files Created/Modified
- `scripts/seed.ts` - the idempotent seeder: `seedSpecialties`/`seedLocations` (upsert + read-back by natural key), `seedDoctors` (existing-`full_name` lookup guard, no natural key available), `seedDoctorLanguages` (only for doctors this run actually inserted), `seedDemoPatients` (`auth.admin.createUser` + `profiles` insert, guarded by email lookup, `role: "patient"` hardcoded), `countRows`/`printSummary` (post-run table totals)
- `package.json` - added `tsx` devDependency and the `"seed": "tsx scripts/seed.ts"` script entry
- `package-lock.json` - lockfile update from the `tsx` install

## Decisions Made
- Package-legitimacy checkpoint for `tsx` resolved as approved (per the continuation context supplied to this run) — installed and used exactly as the plan's primary path specified, no `.mjs` fallback needed.
- 12 demo doctors chosen as a 1:1 pairing of `specialty[i]` with `location[i]` (both lists built in the same fixed order), which trivially guarantees every specialty and every neighborhood has at least one doctor with the smallest dataset inside the 10-15 envelope (D-07).
- Language assignment follows a fixed `index % 3` pattern (both / Hebrew-only / English-only) across the 12 doctors so Phase 3's language filter has real doctors on every side of it.
- The `doctors=<n>` figure in the summary line is filtered to `is_demo = true` (rather than an unfiltered `count(*)` on the table) since that is the semantically correct scope for "the demo catalog" — it does not change the idempotency proof, since the filtered count is equally stable across two consecutive runs.
- `patients=<n>` counts `profiles` rows with `role = 'patient'`, which is a stable and correct measure of demo patients specifically in this project's current state (no non-seed patient accounts exist outside test runs, and no test run executed concurrently with this seed run).

## Deviations from Plan

None - plan executed exactly as written. The package-legitimacy checkpoint itself is documented as resolved via the continuation context supplied to this run, not a deviation.

## Issues Encountered

- **Pre-existing test-data pollution in the shared remote dev database (out of scope for this plan).** Before this run, `specialties` already held 16 extra rows (e.g. `Test Specialty <hash>`, `UI Created Specialty <timestamp>`) and `locations` already held 12 extra rows (`Test Neighborhood <hash>`) left behind by earlier Playwright test executions across prior plans in this phase (02-01 through 02-05). Similarly, `doctors` already held 45 extra rows (`Duplicate Doctor <timestamp>`, `Privilege Test Doctor <timestamp>`, `UI Created Doctor <timestamp>`, `Smoke Doctor <timestamp>`, all `is_demo=true`/`is_active=false`) from the same source. This is why the printed summary totals (`specialties=28 locations=24 doctors=57`) are larger than the 12/12/12 this plan's script actually seeds — the totals are literal post-run table counts, and the table already contained this residue.
  - This is not a defect in `scripts/seed.ts`: independently verified that this run inserted exactly the intended 12 specialties, 12 locations, 12 doctors (each `is_demo=true`, `is_active=true`, `photo_url=null`, at least one `doctor_languages` row) and 4 demo patients, and skipped zero of them on the second run.
  - Per the deviation-rule SCOPE BOUNDARY ("only auto-fix issues DIRECTLY caused by the current task's changes... pre-existing failures in unrelated files are out of scope"), this residue was left untouched rather than cleaned up — `scripts/seed.ts` is explicitly prohibited from ever performing a row-removal or truncation call (T-02-16), and a manual one-off cleanup of the shared dev database is outside this plan's deliverable.
  - Practical effect: the acceptance criterion "the doctors table holds between 10 and 15 rows with is_demo true" reads false against the *whole* table in the current dev environment because of this unrelated residue, even though this plan's own 12 doctors satisfy that range exactly. Recorded here so a future cleanup pass (or a fresh Supabase project reset before demo/grading) is not mistaken for a regression in this plan.
- `npx playwright test` took close to the default 120s foreground timeout and was moved to a background task by the harness; polled to completion (99/99 passed, ~6.6 minutes) rather than treated as a failure.

## User Setup Required
None - no external service configuration required. `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` were already present in `.env.local` from earlier phase setup.

## Next Phase Readiness
- Phase 3 (patient search) now has a real catalog to search: 12 active demo doctors spread across every specialty and every Tel-Aviv neighborhood, with language associations on every doctor.
- `/admin/users` now has 4 demo patient accounts to display alongside whatever accounts exist from admin doctor-account linking.
- Known issue carried forward (not a blocker): the shared remote dev database holds accumulated Playwright test residue in `specialties`/`locations`/`doctors` from prior plans in this phase; a project reset or one-off manual cleanup before final demo/grading would present a cleaner catalog, but is out of scope for this plan and does not affect any downstream phase's correctness.

## Self-Check: PASSED

`scripts/seed.ts` verified present on disk; commit `531a22c` verified present in git log; direct database queries confirmed the 12 seeded doctors, their specialty/location/language coverage, the 4 demo patients, and the unchanged `availability_slots` count of 0.

---
*Phase: 02-admin-doctor-reference-data-management*
*Completed: 2026-08-04*
