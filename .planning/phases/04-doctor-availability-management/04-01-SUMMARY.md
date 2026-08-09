---
phase: 04-doctor-availability-management
plan: 01
subsystem: api
tags: [nextjs, supabase, postgres, playwright, rls, timezone]

requires:
  - phase: 03-search-and-discovery
    provides: lib/timezone.ts (jerusalemWallClockToUtc, jerusalemDayKey, formatJerusalemDayHeading, formatJerusalemTime), app/doctors/[id]/page.tsx's groupSlotsByJerusalemDay pattern
  - phase: 02-admin-management
    provides: lib/auth/require-admin.ts guard shape, lib/validation/doctor.ts manual-validation convention, components/admin/reference-data-page-client.tsx create-dialog pattern
provides:
  - "availability_slots.reason nullable text column, applied to the remote database"
  - "requireDoctor() auth guard resolving doctorId from doctors.profile_id = auth.uid()"
  - "validateSlotInput() manual validator for the add-slot form/route"
  - "GET/POST /api/doctor/slots with 23P01/23514 Postgres error translation"
  - "/doctor/schedule page: day-grouped list + Add slot dialog"
  - "ScheduleEntry exported type for plans 04-02/04-03 to extend"
affects: [04-02-delete-slot, 04-03-block-period, 04-04-overlap-and-visibility]

actuals:
  tokens: 6869
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "requireDoctor() auth guard mirrors requireAdmin(): session client, auth.getUser(), 401/403 discriminated union, defence-in-depth over RLS"
    - "Postgres error.code branching (never error.message/details) for constraint translation: 23P01 -> 409 generic overlap string, 23514 -> 400 range message"
    - "Insert-always, never select-then-check for overlap: the GiST exclusion constraint is the sole race-safe overlap guarantee"

key-files:
  created:
    - supabase/migrations/20260809120000_add_availability_slots_reason.sql
    - lib/auth/require-doctor.ts
    - lib/validation/availability.ts
    - app/api/doctor/slots/route.ts
    - app/doctor/(gated)/schedule/page.tsx
    - tests/e2e/doctor-schedule-add-slot.spec.ts
  modified:
    - app/doctor/(gated)/page.tsx

key-decisions:
  - "Task 1 (checkpoint:decision, gate=blocking): option-a selected — plain nullable availability_slots.reason column, no CHECK constraint, no length cap. Auto-selected by the orchestrator under workflow.auto_advance (config.json workflow.auto_advance=true); plans 04-01 through 04-04 are already written against option-a, so no downstream plan text needed adjustment."
  - "Task 2 auth gate: npx supabase db push initially failed mid-session because SUPABASE_ACCESS_TOKEN was not exported in the executor's shell (the Supabase CLI requires a personal access token for a linked-project push). Resolved when the user supplied a valid token this session; re-run of npx supabase db push succeeded (Docker-connection cache warning observed and is expected/non-fatal per RESEARCH.md and this plan's own read_first note), and npx supabase migration list confirmed 20260809120000 applied to the remote column."
  - "ScheduleEntry final shape: { id: string; start_at: string; end_at: string; status: \"available\" | \"booked\" | \"blocked\"; reason: string | null } — exported from app/doctor/(gated)/schedule/page.tsx."
  - "GET /api/doctor/slots response: 200 { slots: ScheduleEntry[] }, filtered on doctor_id = guard.doctorId and end_at > now (not start_at, so an in-progress multi-day blocked row stays listed per D-15), ordered start_at ascending."
  - "POST /api/doctor/slots response: 201 { slot: ScheduleEntry } on success; 400 { error } for validation failures and the 23514 fallback; 401 { error: \"Not authenticated.\" }; 403 { error: \"Not authorized.\" }; 409 { error: \"This time overlaps your existing schedule.\" } on 23P01; 500 { error: \"Could not save this time slot. Please try again.\" } on any other database error."

patterns-established:
  - "Doctor-owned resource routes: requireDoctor() -> guard.doctorId is the only source of doctor_id on every insert and every list filter; a client-supplied doctorId in the body is silently inert."

requirements-completed: [AVAIL-01, AVAIL-02, AVAIL-03]

coverage:
  - id: D1
    description: "availability_slots.reason nullable text column applied to the remote database (option-a: no constraint, no length cap)"
    requirement: "AVAIL-03"
    verification:
      - kind: other
        ref: "npx supabase migration list (20260809120000 shown in the remote column)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A doctor adds one available slot through the UI (date + start + end time), sees it appear in the day-grouped list without a page reload"
    requirement: "AVAIL-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-add-slot.spec.ts#1. AVAIL-01 through the UI"
        status: pass
    human_judgment: false
  - id: D3
    description: "Past-date, boundary (now-exactly), inverted-range and missing-field submissions are each rejected server-side with their own message, never a 500"
    requirement: "AVAIL-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-add-slot.spec.ts#2-5"
        status: pass
    human_judgment: false
  - id: D4
    description: "A doctorId forged in the request body cannot redirect a write to another doctor's schedule (D-06/T-04-01)"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-add-slot.spec.ts#6. D-06/T-04-01"
        status: pass
    human_judgment: false
  - id: D5
    description: "Stored start_at matches jerusalemWallClockToUtc for the entered Jerusalem wall-clock time (D-12)"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-add-slot.spec.ts#7. D-12"
        status: pass
    human_judgment: false
  - id: D6
    description: "GET /api/doctor/slots omits fully elapsed rows and includes an in-progress multi-day blocked row (D-15)"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-add-slot.spec.ts#8. D-15"
        status: pass
    human_judgment: false
  - id: D7
    description: "An overlapping insert is rejected with 409 and the exact generic overlap string (D-11 smoke; full suite is plan 04-04's)"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-add-slot.spec.ts#9. D-11 smoke"
        status: pass
    human_judgment: false
  - id: D8
    description: "Empty-state heading/body renders for a freshly linked doctor with zero rows; anonymous request 401s and a patient session 403s"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-add-slot.spec.ts#10-11"
        status: pass
    human_judgment: false
  - id: D9
    description: "Human check (deferred to end-of-phase verification per this plan's own <verification>): day headings read as Israel-local dates, the Add slot dialog's three inputs are labelled and keyboard-reachable, and the list is not clipped at a large row count"
    verification: []
    human_judgment: true
    rationale: "Plan explicitly defers this visual/keyboard-reachability check to end-of-phase human verification; not covered by an automated assertion in this plan's spec."

duration: 55min
completed: 2026-08-09
status: complete
---

# Phase 04 Plan 01: Doctor Availability Management — Tracer Slice Summary

**Doctor-owned `/doctor/schedule` page and `GET`/`POST /api/doctor/slots` route, with `requireDoctor()` ownership resolution, manual `lib/validation/availability.ts` checks, and `23P01`→409 GiST-overlap translation — the full add-a-slot path proven end to end by an 11-case Playwright spec.**

## Performance

- **Duration:** ~55 min (this session; resumed after a Task 2 auth-gate checkpoint from a prior session)
- **Started:** 2026-08-09 (Task 2 resumed)
- **Completed:** 2026-08-09
- **Tasks:** 3 (1 checkpoint:decision, 2 execution)
- **Files modified:** 7 (6 created, 1 modified)

## Accomplishments

- `availability_slots.reason` nullable text column deployed to the remote Supabase database (option-a: no constraint, no length cap)
- `requireDoctor()` auth guard resolving `doctorId` from `doctors.profile_id = auth.uid()`, mirroring `requireAdmin()`'s 401/403 discriminated-union shape
- `lib/validation/availability.ts`'s `validateSlotInput()`: past-date, invalid-range, and missing-field checks, matching the manual-validation convention already used for doctors
- `GET`/`POST /api/doctor/slots`: session-bound RLS-backed queries, `end_at`-based future/in-progress filtering (D-15), and strict `error.code` branching (`23P01` → 409 generic overlap string, `23514` → 400 range message)
- `/doctor/schedule` page: day-grouped schedule list (loading/error/empty/populated states), an Add slot dialog converting Jerusalem wall-clock input via `jerusalemWallClockToUtc`, and a `/doctor` nav link reaching it
- `tests/e2e/doctor-schedule-add-slot.spec.ts`: 11 cases covering the UI add-slot flow, past/boundary/inverted/missing-field rejections, the forged-`doctorId` ownership guard, the Jerusalem-conversion round trip, the D-15 elapsed/in-progress filter, an overlap smoke test, the empty state, and the anonymous/patient 401/403 guard

## Task Commits

Each task was committed atomically:

1. **Task 1: Decide the final shape of the `availability_slots.reason` column** — checkpoint:decision, no commit (decision recorded below; resolved by the orchestrator under `workflow.auto_advance`)
2. **Task 2: Author the `availability_slots.reason` migration and push it to the remote database** - `fdde837` (chore)
3. **Task 3: TRACER — a doctor adds one available slot end to end** - `bcc0c03` (feat)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP/REQUIREMENTS update)

## Files Created/Modified

- `supabase/migrations/20260809120000_add_availability_slots_reason.sql` - nullable `reason text` column on `availability_slots`, no constraint
- `lib/auth/require-doctor.ts` - `requireDoctor()` guard, `DoctorGuardResult` discriminated union
- `lib/validation/availability.ts` - `validateSlotInput()` manual validator
- `app/api/doctor/slots/route.ts` - `GET`/`POST` handlers, doctor-owned, RLS-backed, `23P01`/`23514` translation
- `app/doctor/(gated)/schedule/page.tsx` - day-grouped schedule list + Add slot dialog; exports `ScheduleEntry` and `groupEntriesByJerusalemDay`
- `app/doctor/(gated)/page.tsx` - added a `Manage my schedule` link to `/doctor/schedule`
- `tests/e2e/doctor-schedule-add-slot.spec.ts` - 11-case Playwright spec

## Decisions Made

- **Task 1 (option-a):** plain nullable `reason` column, no CHECK constraint, no length cap. This was a `gate="blocking"` checkpoint:decision; the orchestrator auto-selected option-a (the plan's own first-listed, pre-written-against option) under `config.json`'s `workflow.auto_advance: true`. No downstream plan text required adjustment since plans 04-01 through 04-04 are already written against option-a.
- **Task 2 auth gate resolution:** the initial `npx supabase db push` attempt failed for lack of `SUPABASE_ACCESS_TOKEN` in the executor's shell (the linked-project CLI push requires a personal access token, distinct from the anon/service-role keys already in `.env.local`). This produced a `checkpoint:human-action` in a prior session. The user supplied a valid token this session; exporting it and re-running `npx supabase db push` succeeded (a Docker-connection cache warning appeared and is expected/non-fatal, per this plan's own `read_first` note and RESEARCH.md). `npx supabase migration list` then confirmed `20260809120000` applied to the remote column, unblocking Task 3 per its `<precondition>`.
- **Insert-always overlap strategy:** no select-then-insert overlap pre-check exists anywhere in the validator or the route — the insert is always attempted and the atomic `23P01` from `availability_slots_no_overlap` is the sole authoritative rejection (RESEARCH.md Pitfall 2, T-04-02).

## Deviations from Plan

None — plan executed exactly as written. The Task 1 checkpoint and Task 2 auth gate were both expected, plan-anticipated pause points (not deviations from the plan's own design), and both resolved per the plan's own resume-signal / precondition guidance.

## Issues Encountered

- The test fixture for D-15 (case 8) initially placed the "fully elapsed" row's time range inside the "in-progress multi-day blocked" row's range, tripping `availability_slots_no_overlap` on insert (both rows belong to the same test doctor). Fixed by moving the elapsed row to 49-50 hours in the past, clear of the -24h..+24h blocked range — a test-fixture-only fix, no application code affected.

## User Setup Required

None - no external service configuration required beyond the Supabase personal access token already supplied by the user this session (not a new ongoing setup requirement; the CLI push is a one-time deployment action for this migration).

## Next Phase Readiness

- `ScheduleEntry`, `GET`/`POST /api/doctor/slots`'s response shapes, and `requireDoctor()` are all stable contracts plan 04-02 (delete), 04-03 (block period) and 04-04 (overlap/visibility sweep) build directly against, per this plan's `<output>` instruction.
- `groupEntriesByJerusalemDay` is exported alongside `ScheduleEntry` so 04-02/04-03 extend rather than redefine either.
- No blockers for 04-02: `DELETE /api/doctor/slots/[id]` is unaffected by anything built here beyond consuming the same `ScheduleEntry` shape.
- Full Playwright suite (192 tests, including this plan's 11) passes with no regressions to Phase 3's search/profile specs.

---
*Phase: 04-doctor-availability-management*
*Completed: 2026-08-09*
