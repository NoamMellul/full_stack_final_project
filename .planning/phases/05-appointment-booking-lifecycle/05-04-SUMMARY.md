---
phase: 05-appointment-booking-lifecycle
plan: 04
subsystem: api
tags: [nextjs, supabase, postgres, security-definer, rls, playwright, typescript, concurrency]

# Dependency graph
requires:
  - phase: 05-appointment-booking-lifecycle
    provides: "plan 05-01's reschedule_appointment() RPC and its SQLSTATE contract (MR001/MR002/MR004/MR005), requirePatient() guard, validateRescheduleInput(), the PatientAppointment type and PATIENT_APPOINTMENT_SELECT, plan 05-02's cancellation-dialog conventions on the same page"
provides:
  - "PATCH /api/appointments/[id]/reschedule — patient-only route delegating the entire operation to reschedule_appointment(), mapping all six D-10 rejection conditions into two locked messages plus a clean 40P01 deadlock retry"
  - "Day-grouped reschedule picker Dialog + outline row action on app/patient/appointments/page.tsx"
  - "tests/e2e/appointment-reschedule.spec.ts — 11 cases covering APPT-08/APPT-09, D-08/D-09/D-10/D-19, T-05-05"
affects: []

actuals:
  tokens: 13100
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Reschedule route uses requirePatient() (unlike the sibling cancel route, which is deliberately session-only because D-12 admits both actors) since D-06/D-07 scope rescheduling to the patient alone"
    - "One flat error.code branch order (MR001 -> 409 slot message, MR002 -> 409 appointment message, MR004 -> 404, 40P01 -> 409 retry message, else -> 500) covers all six D-10 rejection conditions with exactly two locked strings, never branching on error.message"
    - "Picker fetches GET /api/doctors/{appointment.doctor.id} at dialog-open time (never a cached list) so the offered slots are always currently available for that same doctor; one reschedulingSlotId piece of state drives both the in-flight button label and the sibling-disable behavior"

key-files:
  created:
    - "app/api/appointments/[id]/reschedule/route.ts"
    - "tests/e2e/appointment-reschedule.spec.ts"
  modified:
    - "app/patient/appointments/page.tsx"

key-decisions:
  - "SQLSTATE -> HTTP mapping for reschedule: MR001 -> 409 \"This slot is no longer available. Please choose another.\" (byte-identical to the booking route's MR001 copy — covers new slot in the past/blocked/booked/wrong-doctor as one bucket); MR002 -> 409 \"This appointment can no longer be rescheduled.\" (already-cancelled or elapsed appointment); MR004 -> 404 \"This appointment no longer exists.\" (missing id and foreign id are indistinguishable); 40P01 -> 409 \"Could not complete this reschedule right now — please try again.\"; anything else -> 500 generic failure message"
  - "RESEARCH Open Question 1 resolved in favour of consistency with D-19: the reschedule target inherits the same is_active doctor guard as booking (inside reschedule_appointment() itself, proven by Task 3 case 7) — flagged for confirmation at end-of-phase verification per the plan's stated open assumption"
  - "Picker state contract on app/patient/appointments/page.tsx: reschedulingAppointment (dialog open discriminator) | pickerStatus: loading/error/ready | pickerSlots: PickerSlot[] | rescheduleError | reschedulingSlotId (drives both in-flight label and sibling-disable)"

patterns-established:
  - "Pattern: a picker's slot list is always fetched fresh at open time from the same public endpoint the doctor-profile page already uses (GET /api/doctors/{id}), never reused from a cached parent-list fetch, so availability shown to the user can never silently drift stale"

requirements-completed: [APPT-08, APPT-09]

coverage:
  - id: D1
    description: "A patient moves an upcoming appointment to another of the same doctor's available future slots through the day-grouped picker; the dialog closes, the status region announces success, and the row re-renders at its new Jerusalem time"
    requirement: APPT-08
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-reschedule.spec.ts#1. APPT-08 through the UI: a patient reschedules an upcoming appointment through the day-grouped picker"
        status: pass
    human_judgment: false
  - id: D2
    description: "The appointment row keeps its identity (id unchanged) and its slot_id is updated in place; no second appointment row is ever created for the same booking"
    requirement: APPT-08
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-reschedule.spec.ts#2. D-08 in-place update: the appointment id is unchanged and no second row was created"
        status: pass
    human_judgment: false
  - id: D3
    description: "After a successful reschedule the old slot is available and the new slot is booked, with no observable instant in which neither is held, and no orphaned booked slot left behind under real Promise.all concurrency against a competing booking of the freed slot"
    requirement: APPT-09
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-reschedule.spec.ts#3. APPT-09 slot states: the old slot is available and the new slot is booked"
        status: pass
      - kind: e2e
        ref: "tests/e2e/appointment-reschedule.spec.ts#4. APPT-09 atomicity under concurrency: no instant with neither slot held, no orphaned booked slot"
        status: pass
    human_judgment: false
  - id: D4
    description: "A rejected reschedule (target slot just taken by a second patient) leaves nothing released — the original slot stays booked and the appointment untouched, proving the reserve-before-release ordering D-09 forbids violating"
    requirement: APPT-09
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-reschedule.spec.ts#5. D-09 rollback leaves the old slot held: rescheduling onto a slot a second patient just booked is rejected with no release"
        status: pass
    human_judgment: false
  - id: D5
    description: "All six D-10 rejection conditions (past slot, blocked slot, already-booked slot, wrong-doctor slot, cancelled appointment, elapsed appointment) produce exactly one of two locked messages, compared pairwise rather than against separate literals, with no side effect on either row"
    requirement: APPT-09
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-reschedule.spec.ts#6. D-10 rejection matrix: all six conditions produce the two locked messages with no side effect"
        status: pass
    human_judgment: false
  - id: D6
    description: "A slot belonging to a deactivated doctor is refused (RESEARCH Open Question 1, resolved for consistency with D-19); a foreign appointment id is indistinguishable from a missing one; a non-patient (doctor, anonymous) is refused at the API, and the doctor page carries no reschedule control anywhere"
    requirement: APPT-09
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-reschedule.spec.ts#7. D-19 consistency, flagged assumption: a slot belonging to a deactivated doctor is refused"
        status: pass
      - kind: e2e
        ref: "tests/e2e/appointment-reschedule.spec.ts#8. T-05-05 non-oracle 404: a foreign appointment id and a nonexistent id return byte-identical 404 bodies"
        status: pass
      - kind: e2e
        ref: "tests/e2e/appointment-reschedule.spec.ts#9. Guards and validation: anonymous, doctor, malformed id, missing/non-UUID newSlotId and non-JSON body each reject cleanly"
        status: pass
      - kind: e2e
        ref: "tests/e2e/appointment-reschedule.spec.ts#10. No reschedule surface for the doctor: a doctor authenticated against their own appointment still receives 403"
        status: pass
    human_judgment: false
  - id: D7
    description: "Only an upcoming, non-cancelled row exposes the Reschedule control; an elapsed row and a cancelled row expose neither it nor Cancel"
    requirement: APPT-08
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-reschedule.spec.ts#11. UI eligibility: on a page holding one upcoming, one elapsed and one cancelled appointment, exactly one Reschedule control exists and it belongs to the upcoming row"
        status: pass
    human_judgment: false
  - id: D8
    description: "The 40P01 deadlock-abort branch translates a genuine circular slot swap into a clean retryable 409, never an unhandled 500 — deliberately not exercised at runtime (provoking it needs two transactions to interleave inside a sub-second window, which would be inherently flaky), proven instead by source inspection in Task 1's acceptance criteria and recorded in the spec's header comment"
    verification:
      - kind: manual
        ref: "Task 1 acceptance criteria: 40P01 branch appears before the generic 500 fallback (source assertion)"
        status: pass
    human_judgment: true
    rationale: "A genuine Postgres deadlock is not reliably reproducible in an integration test without flakiness; the plan explicitly directs source-inspection verification instead of a forced runtime trigger."
  - id: D9
    description: "Visual/UX quality of the reschedule picker (RTL-cleanliness, keyboard reachability, long-list scroll behavior, Reschedule control reading as clearly subordinate to the destructive Cancel control) — deferred to end-of-phase human verification per the plan's <verification> section"
    verification: []
    human_judgment: true
    rationale: "The plan explicitly defers this human check to end-of-phase verification rather than this plan's own gate; automation cannot judge visual/interaction quality."

duration: 40min
completed: 2026-08-11
status: complete
---

# Phase 5 Plan 4: Appointment Rescheduling Summary

**`PATCH /api/appointments/[id]/reschedule` delegating the entire move to `reschedule_appointment()`, and a day-grouped picker on `/patient/appointments` that proves reschedule atomicity under real concurrent competition for the freed slot**

## Performance

- **Duration:** ~40 min in this resumed session (Tasks 1-2 were already complete and committed on entry from a prior session; this session's work was verifying those tasks against the files on disk, cleaning up leftover debug assertions in Task 3's spec, widening one test's timeout, and running full-suite verification)
- **Completed:** 2026-08-11
- **Tasks:** 3
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- Verified Tasks 1-2 (already committed from a prior session) against every acceptance criterion in the plan rather than trusting the commit history alone: `PATCH /api/appointments/[id]/reschedule` uses `requirePatient()`, delegates entirely to `reschedule_appointment()` with no direct `availability_slots`/`appointments` write, and branches `MR001`/`MR002`/`MR004`/`40P01` in the correct order before the generic 500 fallback; the picker on `app/patient/appointments/page.tsx` fetches fresh from the appointment row's own `doctor.id`, disables every sibling slot button (not just the clicked one) while a request is in flight, and adds no clinical/reason field.
- Finished Task 3's `tests/e2e/appointment-reschedule.spec.ts`, left mid-edit by the prior interrupted session: removed a leftover no-op debug assertion in case 1 and replaced it with real day-heading/time-range assertions (that both offered slots render with their correct `formatJerusalemDayHeading`/`formatJerusalemTime` values, and that the appointment's own current slot's day heading is absent from the picker entirely).
- Ran the full 11-case spec to green, then the entire 282-test Playwright suite to green (21.2 min), confirming reschedule's slot-status writes do not regress the Phase 3 search or Phase 4 schedule specs that read `availability_slots.status`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build `PATCH /api/appointments/[id]/reschedule`** - `e6e100c` (feat) — committed in a prior session; re-verified against every acceptance criterion this session.
2. **Task 2: Wire the day-grouped reschedule picker into `/patient/appointments`** - `035ea55` (feat) — committed in a prior session; re-verified against every acceptance criterion this session.
3. **Task 3: Prove reschedule atomicity, the full D-10 rejection matrix, and the deadlock translation** - `74ef056` (test) — finished this session: removed debug cruft, added real slot-offer assertions, widened test 6's timeout for its six sequential fixture+login sub-cases, confirmed all 11 cases green and the full suite green.

**Plan metadata:** (pending — final docs commit follows this SUMMARY)

## Files Created/Modified

- `app/api/appointments/[id]/reschedule/route.ts` - `PATCH` handler, patient-only via `requirePatient()`, delegates to `reschedule_appointment()`, maps all six D-10 rejection conditions to two locked messages plus a clean deadlock retry
- `app/patient/appointments/page.tsx` - added the reschedule picker `Dialog`, its state (`reschedulingAppointment`/`pickerStatus`/`pickerSlots`/`rescheduleError`/`reschedulingSlotId`), the outline `Reschedule` row action, and `loadPickerSlots`/`handleSelectRescheduleSlot`
- `tests/e2e/appointment-reschedule.spec.ts` - 11 cases covering APPT-08, APPT-09, D-08, D-09, D-10 (all six conditions), D-19 consistency, T-05-05 non-oracle 404, guards/validation, and UI eligibility

## Decisions Made

- **SQLSTATE -> HTTP mapping** (locked, consumed only by this route): `MR001` -> 409 `"This slot is no longer available. Please choose another."` (byte-identical to the booking route's `MR001` copy — covers a new slot that is past/blocked/booked/wrong-doctor as one bucket); `MR002` -> 409 `"This appointment can no longer be rescheduled."` (already-cancelled or elapsed appointment); `MR004` -> 404 `"This appointment no longer exists."` (identical for missing and foreign ids); `40P01` -> 409 `"Could not complete this reschedule right now — please try again."`; anything else -> 500 `"Could not reschedule this appointment. Please try again."`
- **RESEARCH Open Question 1 resolved:** the reschedule target inherits the same `is_active` doctor guard `book_appointment()` already enforces (inside `reschedule_appointment()`, applying `MR001`), for consistency with D-19. Proven by Task 3 case 7. This remains a flagged assumption per the plan's own framing — confirm at end-of-phase verification rather than treating this as an unquestionable resolution.
- **Picker state contract** on `app/patient/appointments/page.tsx`: `reschedulingAppointment: PatientAppointment | null` (doubles as the dialog's open discriminator) | `pickerStatus: "loading" | "error" | "ready"` | `pickerSlots: PickerSlot[]` | `rescheduleError: string | null` | `reschedulingSlotId: string | null` (non-null drives both the clicked slot's `Rescheduling…` label and every sibling slot button's `disabled` state).
- **Test-infrastructure fix:** widened Task 3's case 6 (D-10 rejection matrix, six sequential fixture-creation + login sub-cases) to `test.setTimeout(90000)` — the default 30s budget was consistently insufficient for six sequential logins plus fixture creation under normal dev-server latency, not a symptom of the feature under test. This mirrors the existing precedent in `search-sort-pagination.spec.ts` and `seed-availability.spec.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Leftover no-op debug assertion in Task 3's spec, left by the prior interrupted session**
- **Found during:** Resuming Task 3 — the prior session's last action was described as "cleaning up leftover debug cruft in test 1 and adding proper day-heading/time assertions" but was cut off mid-edit
- **Issue:** Case 1 contained `await expect(dialog.getByText(otherASlotTime.start.toISOString().slice(0, 0) || "")).toHaveCount(0); // no-op guard, real assertions below` — a tautological assertion (`.slice(0, 0)` always produces an empty string; matching zero elements of empty text is trivially true regardless of picker content) that verified nothing. A second assertion, `await expect(dialog.getByText(\`with Dr. ${doctor.fullName}\`)).toHaveCount(0)`, was also load-bearing-looking but wrong: the picker markup never renders "with Dr. X" text at all (that string only exists in the outer appointment row), so the assertion passed unconditionally and did not actually prove the appointment's own current slot was excluded from the offered list.
- **Fix:** Removed the no-op line. Replaced the doctor-name assertion with real assertions: both offered slots' day headings (`formatJerusalemDayHeading`) and time ranges (`formatJerusalemTime` start - end) are asserted visible in the dialog, and the appointment's own current slot's day heading is asserted absent from the dialog entirely (each fixture slot lives on a distinct day, so this is unambiguous).
- **Files modified:** `tests/e2e/appointment-reschedule.spec.ts`
- **Verification:** Case 1 passes with the new assertions actually exercising the picker's day-grouped rendering and its exclusion of the current slot.
- **Committed in:** `74ef056` (Task 3 commit)

**2. [Rule 3 - Blocking issue] Test 6 (D-10 rejection matrix) exceeded Playwright's default 30s test timeout under full-suite load**
- **Found during:** First full run of `tests/e2e/appointment-reschedule.spec.ts` after finishing Task 3
- **Issue:** Case 6 builds six independent patient/doctor/appointment fixtures and logs in fresh for each of the six D-10 sub-cases sequentially. Under normal dev-server latency this exceeded the default 30s test timeout, and the timeout's forced context teardown then cascaded into a `page.goto: Target page, context or browser has been closed` failure partway through the sixth sub-case.
- **Fix:** Added `test.setTimeout(90000)` at the top of test 6, following the existing precedent set in `search-sort-pagination.spec.ts` and `seed-availability.spec.ts` for tests whose fixture-creation cost (not the feature under test) exceeds the default budget.
- **Files modified:** `tests/e2e/appointment-reschedule.spec.ts`
- **Verification:** Full spec file re-run twice consecutively: 11/11 passing both times (case 6 completing in 30.0s-35.8s, comfortably inside the new 90s budget). Full 282-test suite subsequently green.
- **Committed in:** `74ef056` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 1 test-correctness fix, 1 Rule 3 test-infrastructure fix). Both fixes were confined to the test spec — no production code (`route.ts`, `page.tsx`) required any change; Tasks 1-2 held up under full re-verification exactly as committed by the prior session.
**Impact on plan:** No scope creep — no new tables, no new API surface, no change to the locked SQLSTATE mapping or picker state contract.

## Issues Encountered

- The first full run of `tests/e2e/appointment-reschedule.spec.ts` alone (before the dev server had been warmed by any prior request) showed cases 1-3 failing on a cold-compile timeout (the dialog's `toBeHidden()` assertion has a 5s default budget, and the very first hit to a Next.js dev-mode route can take longer to compile) — this resolved on the next run once the dev server was warm, matching the same class of transient cold-start issue already documented as a known flake for `seed-availability.spec.ts`. Not treated as a defect; no code change needed, confirmed by isolated re-run per the standard protocol.
- The full 282-test suite takes ~21 minutes serially (`workers: 1`), consistent with prior phase summaries' reported 20-25 minute range.

## User Setup Required

None — no external service configuration required beyond the `SUPABASE_ACCESS_TOKEN` already established in prior phases. This plan added no migration (it consumes `reschedule_appointment()`, deployed by plan 05-01).

## Next Phase Readiness

- Rescheduling is a complete, production-quality feature: no stub or mock data path exists anywhere in the new code.
- Plan 05-05 (doctor cancellation) is unaffected by this plan — reschedule remains scoped to the patient page only, and Task 3 case 10 proves the doctor-side reschedule route access is refused (403) independent of any UI control.
- The flagged `is_active`-on-reschedule assumption (RESEARCH Open Question 1) is proven consistent with D-19 by Task 3 case 7 and should be explicitly confirmed (or overturned) at end-of-phase verification, per the plan's own framing.
- No known stubs.

---
*Phase: 05-appointment-booking-lifecycle*
*Completed: 2026-08-11*

## Self-Check: PASSED

All 3 claimed files found on disk (`app/api/appointments/[id]/reschedule/route.ts`, `app/patient/appointments/page.tsx`, `tests/e2e/appointment-reschedule.spec.ts`). All 3 claimed commit hashes (`e6e100c`, `035ea55`, `74ef056`) found in git history.
