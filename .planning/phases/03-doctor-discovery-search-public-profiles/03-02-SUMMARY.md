---
phase: 03-doctor-discovery-search-public-profiles
plan: 02
subsystem: database
tags: [supabase, timezone, seed-script, playwright, availability]

# Dependency graph
requires:
  - phase: 03-doctor-discovery-search-public-profiles (plan 01)
    provides: doctor_search_view (computes next_available_at from availability_slots, which this plan populates)
  - phase: 02-admin-doctor-reference-data-management
    provides: idempotent scripts/seed.ts (specialties/locations/doctors/languages/patients) that this plan extends
provides:
  - lib/timezone.ts — the project's single Asia/Jerusalem conversion module (8 exports)
  - seedAvailabilitySlots() — idempotent demo availability_slots generation in scripts/seed.ts
  - DOCTORS_WITHOUT_SLOTS — the two demo doctors deliberately left with no availability (D-02)
  - tests/e2e/helpers/availability.ts — slot fixture helper (createTestSlots/cleanupTestSlots) for later phase specs
  - tests/e2e/seed-availability.spec.ts — automated proof of seed idempotency and D-01/D-02 shape rules
affects: [03-03 (search filters/sort/pagination), 03-04 (doctor profile upcoming slots), 03-05 (search filters incl. availability), 03-06 (search sort/pagination)]

# Actuals (#2632)
actuals:
  tokens: 15500
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single shared Asia/Jerusalem conversion module (lib/timezone.ts), imported by both Client Components and the Node-run seed script — no server-only guard, no 'use client' directive"
    - "Seed script idempotency for a table under a GiST exclusion constraint: check for FUTURE rows only (not any row), read the doctor set back from the database rather than from a prior insert step's return value"

key-files:
  created:
    - lib/timezone.ts
    - tests/e2e/helpers/availability.ts
    - tests/e2e/seed-availability.spec.ts
  modified:
    - app/admin/appointments/page.tsx
    - scripts/seed.ts

key-decisions:
  - "lib/timezone.ts moved JERUSALEM_TIME_ZONE/getTimeZoneOffsetMs/jerusalemBoundaryToUtcIso out of app/admin/appointments/page.tsx verbatim, plus added jerusalemWallClockToUtc/jerusalemWeekday/jerusalemDayKey/formatJerusalemDayHeading/formatJerusalemTime for the seed script and upcoming search/profile UI"
  - "seedAvailabilitySlots() reads the demo doctor set back from the database (never from seedDoctors()'s return value, which is empty on every re-run) and idempotency-checks strictly on FUTURE availability_slots rows (D-03), so an expired doctor is re-seeded and a doctor with any future slot is left untouched"
  - "Dr. Liora Segal and Dr. Amit Friedman (last two DOCTORS entries) are DOCTORS_WITHOUT_SLOTS — deliberately zero availability so the no-availability UI state stays reachable (D-02)"
  - "Each eligible doctor gets 3 days x 3 slots = 9 future, non-overlapping, Sun-Thu 09:00-17:00 Israel-time slots, staggered per doctor index so not every doctor's slots start at the same minute"
  - "tests/e2e/seed-availability.spec.ts hardcodes its own copy of the DOCTOR_NAMES/DOCTORS_WITHOUT_SLOTS literals rather than importing scripts/seed.ts, because importing that script would re-execute its top-level main().catch(...) seed run as an import side effect"

patterns-established:
  - "Non-browser Playwright spec that shells out to a CLI command (execSync) and asserts over the tool's own side effects, with test.setTimeout raised well above playwright.config.ts's 30s default"

requirements-completed: [SEARCH-05, SEARCH-07, PROFILE-03]

coverage:
  - id: D1
    description: "lib/timezone.ts is the project's single Asia/Jerusalem conversion module; app/admin/appointments/page.tsx imports it with byte-identical behavior"
    verification:
      - kind: unit
        ref: "manual npx tsx invocation confirming jerusalemWallClockToUtc(2026,8,10,9,0) is 3h behind wall clock (IDT) and jerusalemWallClockToUtc(2026,1,10,9,0) is 2h behind (IST)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-oversight-views.spec.ts (10/10 passed) — regression guard for the moved date-range filter logic"
        status: pass
    human_judgment: false
  - id: D2
    description: "seedAvailabilitySlots() idempotently seeds 6-10 future, non-overlapping, Sun-Thu 09:00-17:00 Israel-time available slots per eligible demo doctor, creates zero appointments, and a re-run is a verified no-op"
    requirement: "SEARCH-05, SEARCH-07, PROFILE-03 (data substrate)"
    verification:
      - kind: e2e
        ref: "tests/e2e/seed-availability.spec.ts (8/8 passed, run twice independently)"
        status: pass
      - kind: integration
        ref: "npm run seed executed twice live: both runs report availability_slots=90 (10 eligible doctors x 9), zero 23P01 errors"
        status: pass
    human_judgment: false
  - id: D3
    description: "tests/e2e/helpers/availability.ts slot fixture helper available for later phase specs"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit and npm run lint clean; exercised indirectly via the same testAdminClient pattern proven by tests/e2e/seed-availability.spec.ts"
        status: pass
    human_judgment: false

# Metrics
duration: 26min
completed: 2026-08-06
status: complete
---

# Phase 3 Plan 2: Availability Seed Data & Shared Timezone Module Summary

**Idempotent 9-slots-per-doctor demo availability generator plus a single shared Asia/Jerusalem conversion module (lib/timezone.ts) consumed by both the admin UI and the seed script.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-08-06T15:21:28+03:00
- **Completed:** 2026-08-06T15:47:39+03:00
- **Tasks:** 3
- **Files modified:** 5 (2 created new modules + 1 new spec + 1 new helper, 2 edited)

## Accomplishments
- Extracted `lib/timezone.ts` as the project's single Asia/Jerusalem conversion module: the three symbols already live in `app/admin/appointments/page.tsx` moved out verbatim, plus five new exports (`jerusalemWallClockToUtc`, `jerusalemWeekday`, `jerusalemDayKey`, `formatJerusalemDayHeading`, `formatJerusalemTime`) that the seed script and upcoming search/profile UI consume
- Added `seedAvailabilitySlots()` to `scripts/seed.ts`: every active demo doctor except `Dr. Liora Segal` and `Dr. Amit Friedman` (the two `DOCTORS_WITHOUT_SLOTS` exclusions, D-02) now gets 9 future, non-overlapping, Sunday-through-Thursday, 09:00-17:00 Israel-time `available` slots; a second `npm run seed` run is a verified no-op (D-03) — live run confirmed `availability_slots=90` identically on both invocations with zero `23P01` exclusion-constraint errors
- Added `tests/e2e/helpers/availability.ts` (slot fixture helper for later phase specs) and `tests/e2e/seed-availability.spec.ts`, an automated non-browser spec that shells out to `npm run seed` twice and proves every D-01/D-02/D-03 shape rule that was previously manual-only

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract Asia/Jerusalem conversion into lib/timezone.ts** - `4ac6b7f` (refactor)
2. **Task 2: Add an idempotent seedAvailabilitySlots step to scripts/seed.ts** - `2e33f5d` (feat)
3. **Task 3: Slot fixture helper plus an automated seed-shape and idempotency spec** - `4782955` (test)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified
- `lib/timezone.ts` - Single Asia/Jerusalem conversion/display module (8 exports)
- `app/admin/appointments/page.tsx` - Now imports JERUSALEM_TIME_ZONE/jerusalemBoundaryToUtcIso from @/lib/timezone instead of defining them locally; behavior unchanged
- `scripts/seed.ts` - Added `DOCTORS_WITHOUT_SLOTS`, generation constants, and `seedAvailabilitySlots()` called from `main()` between `seedDoctorLanguages` and `seedDemoPatients`; `printSummary()` now reports `availability_slots` count
- `tests/e2e/helpers/availability.ts` - `createTestSlots`/`cleanupTestSlots` slot fixture helper
- `tests/e2e/seed-availability.spec.ts` - Automated seed idempotency and D-01/D-02 shape-rule spec (8 assertions)

## Decisions Made
- `jerusalemWallClockToUtc`/`jerusalemWeekday`/`jerusalemDayKey` implemented by reusing `getTimeZoneOffsetMs`'s existing DST-safe offset-resolution technique rather than a naive fixed-offset assumption
- `seedAvailabilitySlots` resolves business days via a direction-flipping day-walker (`resolveBusinessDayOffset`) that advances past Fri/Sat but switches to retreating once advancing would exceed the 21-day horizon, with a bounded collision-avoidance loop (`resolveDoctorSlotDays`) so three raw day offsets never resolve to the same calendar date
- `tests/e2e/seed-availability.spec.ts` hardcodes its own literal copy of the demo doctor names and `DOCTORS_WITHOUT_SLOTS`, rather than importing `scripts/seed.ts` (which would re-run the entire seed as an import side effect via its top-level `main().catch(...)`)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The shared remote dev database's pre-existing Playwright test residue (noted in STATE.md Blockers) inflates the total `doctors` row count reported by `printSummary()`, but `seedAvailabilitySlots` scopes its doctor lookup by `full_name IN (the 12 literal demo names)`, so the residue never affects which doctors receive seeded slots.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plans 03-03 through 03-06 (search filters/sort/pagination, doctor profile) now have real seeded `availability_slots` data to query, filter, and display against — 10 doctors with 9 future slots each, 2 doctors with none
- `lib/timezone.ts`'s `jerusalemDayKey`/`formatJerusalemDayHeading`/`formatJerusalemTime` are ready for the profile page's day-grouped upcoming-slots list (Plan 03-04, PROFILE-03)
- `tests/e2e/helpers/availability.ts` is ready for deterministic slot fixtures in later specs that need precise, non-seed-dependent scenarios
- No blockers

---
*Phase: 03-doctor-discovery-search-public-profiles*
*Completed: 2026-08-06*

## Self-Check: PASSED

All created files verified present on disk (`lib/timezone.ts`, `tests/e2e/helpers/availability.ts`, `tests/e2e/seed-availability.spec.ts`, this SUMMARY). All three task commits (`4ac6b7f`, `2e33f5d`, `4782955`) verified present in git log.
