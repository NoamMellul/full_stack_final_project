---
phase: quick-260817-nlg
plan: 01
subsystem: database
tags: [supabase, data-cleanup, maintenance-script]

requires:
  - phase: 02-admin-doctor-reference-data-management
    provides: scripts/seed.ts's idempotent demo catalog (the whitelist source)
provides:
  - scripts/cleanup-test-residue.ts — reusable, dry-run-by-default maintenance script for future residue buildup
  - clean dev database: exactly 12 seed doctors/specialties/locations and 6 real profiles, zero test/debug residue
affects: [phase-06-verification, admin-oversight, search]

actuals:
  tokens: 0
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Whitelist-based cleanup (keep known-legitimate identifiers, delete everything else, report anything unexplained) instead of blocklist pattern-matching — safer for an irreversible cross-table delete where residue shapes vary across many different test files and manual debugging sessions"
    - "Dry-run-by-default destructive script (--apply required to execute), mirroring the caution already established by scripts/seed.ts's own idempotent-insert-only design"

key-decisions:
  - "Executed directly by the orchestrating session (read seed.ts, built the whitelist, wrote the script, dry-ran it, got explicit user sign-off on exact counts, applied, independently re-verified) rather than dispatched to a planner/executor agent pair — the irreversible, cross-table, shared-database nature of this operation warranted the orchestrator's own step-by-step verification at each stage."
  - "is_demo could not be used as the discriminator (it defaults to true for every insert, seed or test-fixture, confirmed in the schema migration) — the whitelist is built from exact names/emails in scripts/seed.ts instead."
  - "Two accounts outside the seed catalog were found during the dry-run's unexplained-row report and added to an explicit PRESERVED_EMAILS list rather than being caught by the @example.com blanket rule: admin@medrdv.demo (the project's real demo-admin login) and mellulnoam@gmail.com (the project owner's real account)."

requirements-completed: [QUICK-260817-nlg]

coverage:
  - id: D1
    description: "Cleanup deletes exactly the rows outside the whitelist and nothing else; database ends at 12/12/12 (doctors/specialties/locations) and 6 profiles"
    requirement: QUICK-260817-nlg
    verification:
      - kind: manual
        ref: "Independent read-only re-audit query run after --apply: totalDoctors=12, totalSpecialties=12, totalLocations=12, totalProfiles=6, zero unexplained rows in any category"
        status: pass
    human_judgment: true
    rationale: "This is a one-off destructive data operation with no Playwright-testable surface of its own (the whitelist logic was verified by direct re-query against the live database, not a test suite); the app's continued correctness after the operation was checked instead."
  - id: D2
    description: "App functions correctly against the cleaned dataset (search, doctor profiles, pagination, seed idempotency)"
    requirement: QUICK-260817-nlg
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-profile.spec.ts, search-filters.spec.ts, search-sort-pagination.spec.ts, seed-availability.spec.ts — 45/46 passed"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-08-17
status: complete
---

# Quick Task 260817-nlg Summary

**Removed 389 orphaned doctors, 260 test/debug auth accounts, 229 test specialties, 156 test locations, and 65 stale appointments — accumulated Playwright test residue and manual admin-UI debugging artifacts that had been polluting both the admin oversight views and real patient-facing search results — via a new, reusable, whitelist-based `scripts/cleanup-test-residue.ts` maintenance script.**

## Performance

- **Duration:** ~45 min (investigation + script authoring + dry-run review + execution + re-verification + smoke test)
- **Completed:** 2026-08-17
- **Tasks:** 1/1
- **Files created:** 1 (`scripts/cleanup-test-residue.ts`)

## Accomplishments

- Read `scripts/seed.ts` to extract the exact legitimate demo catalog: 12 doctor names, 12 specialty names, 12 neighborhood names, 4 seed patient emails.
- Confirmed `doctors.is_demo` defaults to `true` for every insert (schema-level default, `supabase/migrations/20260803230000_initial_schema.sql:52`) — ruled out as a discriminator between seed and test-fixture rows.
- Wrote `scripts/cleanup-test-residue.ts`: dry-run by default, `--apply` to execute, deletes in FK-safe order (appointments → doctors → auth users [cascades profiles] → specialties → locations), reports exact counts and flags any row it cannot explain via the whitelist.
- Dry run surfaced 2 real accounts outside the seed catalog (`admin@medrdv.demo`, `mellulnoam@gmail.com`) before any deletion — both added to an explicit preserved list.
- Got explicit user confirmation of the exact planned counts before running `--apply` (irreversible operation on shared data).
- Executed cleanup: 65 appointments, 389 doctors, 260 profiles (via `auth.admin.deleteUser`, cascading to profiles/favorites/notifications), 229 specialties, 156 locations deleted — zero failures.
- Independently re-audited via a fresh read-only query: database now holds exactly 12 doctors, 12 specialties, 12 locations, 6 profiles (4 seed patients + the 2 preserved real accounts) — matches the plan exactly.
- Smoke-tested against 4 seed-dependent spec files: 45/46 passed. The 1 failure (`seed-availability.spec.ts:170`, doctor slot count below the expected 6-10 range) is the same pre-existing, already-tracked flakiness class recorded repeatedly across prior phases (STATE.md Blockers/Concerns, WINDOWS.md ids 1/3/5/7/8/10/11/12) — unrelated to this cleanup, since this script never touched the 12 kept seed doctors' `availability_slots` rows.

## Task Commits

1. **Task 1: add scripts/cleanup-test-residue.ts and run the cleanup** - _(committed by the orchestrator alongside this docs commit — the script itself is the only code artifact; the deletion it performed is a data-only change with no corresponding file diff)_

## Files Created/Modified

- `scripts/cleanup-test-residue.ts` - new, reusable, dry-run-by-default maintenance script; safe to re-run if residue accumulates again before the final demo

## Decisions Made

- **Whitelist over blocklist.** Test/debug residue in this database took several different shapes across the test suite's history (`Test Specialty {uuid8}` from the standard helper default, `UI Created Specialty {timestamp}` from admin-reference-data.spec.ts's UI-driven creation flow, `Debug Doctor`/`Debug Spec {hex8}` from manual admin-UI debugging, `second-attempt-*`/`linked-doctor-*` emails from admin-doctor-link-account.spec.ts) — no single pattern would have caught all of it safely. A whitelist of exactly the 12+12+12+4 known-legitimate identifiers, with every non-matching row deleted and every borderline case explicitly surfaced for review, is safer for an irreversible operation than trying to enumerate every residue shape.
- **Kept the script in the repo rather than treating it as a throwaway.** Given the scale found (389 stray doctors) despite `scripts/seed.ts` already being idempotent and non-destructive by design, this class of accumulation is likely to recur from ordinary Playwright development before the final demo/defense — a committed, documented, safe-by-default script is more useful than a one-off deletion.

## Deviations from Plan

None — the plan (written by the orchestrator alongside this summary, reflecting work already completed) matches what was executed.

## Issues Encountered

None. The dry-run-first workflow caught both real accounts before they were at risk; the FK-ordered deletion completed with zero errors across all 5 steps (appointments, doctors, profiles/auth, specialties, locations).

## User Setup Required

None. `scripts/cleanup-test-residue.ts` requires no new env vars — it reuses `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, already required by `scripts/seed.ts`.

## Next Phase Readiness

- The dev/demo database is now clean: exactly the intended 12-doctor demo catalog is visible in search and admin views.
- `scripts/cleanup-test-residue.ts` is available for future re-runs if test residue accumulates again.
- The one pre-existing flake (`seed-availability.spec.ts:170`) remains open and tracked, unrelated to this task; a fresh `npm run seed` run (or re-running the availability-seeding step this spec depends on) would be the next step if a fully clean slot distribution is wanted before the defense.
- No blockers for `/gsd-ship`.

---
*Quick task: 260817-nlg*
*Completed: 2026-08-17*

## Self-Check: PASSED

`scripts/cleanup-test-residue.ts` confirmed present on disk. Post-execution re-audit confirmed the database matches the plan's expected end state exactly (12/12/12/6, zero unexplained rows).
