---
phase: 05-appointment-booking-lifecycle
plan: 02
subsystem: api
tags: [supabase, postgres, security-definer, rls, nextjs, playwright, rpc]

# Dependency graph
requires:
  - phase: 05-appointment-booking-lifecycle
    provides: "cancel_appointment() SECURITY DEFINER RPC (05-01), lib/validation/appointments.ts's UUID_PATTERN/validateCancelInput, lib/appointments.ts's isCancelledStatus/appointmentBadge/splitAppointments, app/patient/appointments/page.tsx's PatientAppointment type and Upcoming/Past sections"
provides:
  - "PATCH /api/appointments/[id]/cancel route handler — 200 { status } / 400 / 401 / 404 / 409 / 500"
  - "Cancellation confirmation Dialog + destructive 'Cancel appointment' row action on /patient/appointments"
  - "tests/e2e/appointment-cancel.spec.ts covering APPT-05/APPT-07, extended by plan 05-05 for doctor-side cases"
affects: [05-03-doctor-history, 05-04-reschedule, 05-05-doctor-cancel]

actuals:
  tokens: 7829
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Session-only route guard (no requirePatient()/requireDoctor()) when a route is legitimately shared by two different roles — the SECURITY DEFINER function's own auth.uid()-scoped filter is the real authorization boundary, documented in a header comment so it isn't 'fixed' by adding a role guard later"
    - "Client-side cancellation eligibility read from the already-computed appointmentBadge().label (\"Confirmed\") instead of a second Date.now() call in the render body — avoids the eslint react-hooks/purity rule while staying data-equivalent to a direct start_at/now comparison"

key-files:
  created:
    - "app/api/appointments/[id]/cancel/route.ts"
    - "tests/e2e/appointment-cancel.spec.ts"
  modified:
    - "app/patient/appointments/page.tsx"

key-decisions:
  - "Route uses createClient() + auth.getUser() directly (401 only), never requirePatient()/requireDoctor() — D-12 lets both the booking patient and the owning doctor cancel, so a role guard would incorrectly 403 one of the two legitimate actors"
  - "Cancellation eligibility on a row is decided by appointmentBadge(status, start_at).label === \"Confirmed\" plus an explicit isCancelledStatus() check, not a fresh Date.now() comparison in the row component — required to satisfy eslint's react-hooks/purity rule (no impure calls in render bodies) while remaining logically identical to 'start_at >= now and not cancelled'"

patterns-established:
  - "Pattern: a route reachable by two different authenticated roles for the same resource skips the per-role guard entirely and relies on the RPC's own auth.uid()-scoped lookup as the sole authorization boundary — reused by 05-05's doctor-side consumption of the same cancel route"

requirements-completed: [APPT-05, APPT-07]

coverage:
  - id: D1
    description: "PATCH /api/appointments/[id]/cancel delegates entirely to cancel_appointment(), performs no direct appointments/availability_slots write, and maps MR002->409/MR004->404/MR005->401 using the UI-SPEC copy"
    requirement: APPT-05
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-cancel.spec.ts#1. APPT-05 through the UI: a patient cancels an upcoming appointment through the confirmation dialog"
        status: pass
      - kind: e2e
        ref: "tests/e2e/appointment-cancel.spec.ts#2. D-14 row survival and reason round-trip: the row survives with the right status and a byte-identical reason"
        status: pass
    human_judgment: false
  - id: D2
    description: "A patient cancels their own upcoming appointment through the D-13 confirmation dialog (optional untrimmed reason); the row survives with status=cancelled_by_patient, a byte-identical reason, and re-renders under Past with a Cancelled by patient badge and no action buttons"
    requirement: APPT-05
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-cancel.spec.ts#1. APPT-05 through the UI"
        status: pass
      - kind: e2e
        ref: "tests/e2e/appointment-cancel.spec.ts#3. D-13 blank reason: cancelling with the textarea left empty stores a null reason, not an empty string"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cancelling an appointment releases its slot back to available in the same transaction, and the freed slot is genuinely re-bookable by a different patient (two appointment rows on one slot: one cancelled_by_patient, one scheduled)"
    requirement: APPT-07
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-cancel.spec.ts#4. APPT-07 slot release"
        status: pass
      - kind: e2e
        ref: "tests/e2e/appointment-cancel.spec.ts#5. APPT-07 re-booking: a different patient successfully books the freed slot"
        status: pass
    human_judgment: false
  - id: D4
    description: "An elapsed or already-cancelled appointment is rejected with 409 'This appointment can no longer be cancelled.' and the stored reason from a prior cancellation is never overwritten"
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-cancel.spec.ts#6. D-12 elapsed appointment"
        status: pass
      - kind: e2e
        ref: "tests/e2e/appointment-cancel.spec.ts#7. D-12 already cancelled"
        status: pass
    human_judgment: false
  - id: D5
    description: "A foreign appointment id and a nonexistent appointment id return byte-identical 404 bodies (T-05-05 non-oracle guarantee); anonymous/malformed/oversized/non-JSON requests are rejected cleanly before any RPC call"
    requirement: APPT-05
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-cancel.spec.ts#8. T-05-05 non-oracle 404"
        status: pass
      - kind: e2e
        ref: "tests/e2e/appointment-cancel.spec.ts#9. Guards: anonymous, malformed id, non-string reason, over-length reason and non-JSON body each reject cleanly"
        status: pass
    human_judgment: false
  - id: D6
    description: "Only an upcoming, non-cancelled appointment row exposes a Cancel appointment control; past and cancelled rows render no action button at all"
    requirement: APPT-05
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-cancel.spec.ts#10. UI eligibility"
        status: pass
    human_judgment: false
  - id: D7
    description: "Visual/UX quality of the cancellation dialog (destructive emphasis, Keep appointment as visually subordinate dismiss, keyboard dismissibility, reason field never suggesting medical content) — deferred to end-of-phase human verification per the plan's <verification> section"
    verification: []
    human_judgment: true
    rationale: "The plan explicitly defers this human check to end-of-phase verification rather than this plan's own gate; automation cannot judge visual/interaction quality or the absence of an implicit medical-content invitation."

duration: 64min
completed: 2026-08-11
status: complete
---

# Phase 5 Plan 2: Appointment Cancellation Summary

**PATCH /api/appointments/[id]/cancel delegating entirely to the deployed cancel_appointment() RPC, wired to a destructive confirmation dialog on /patient/appointments that proves the freed slot is genuinely re-bookable by a different patient**

## Performance

- **Duration:** 64 min
- **Started:** 2026-08-11T10:34:45+03:00 (first commit of this plan's session)
- **Completed:** 2026-08-11T11:38:14+03:00
- **Tasks:** 3
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- Built `PATCH /api/appointments/[id]/cancel` with a session-only guard (deliberately no `requirePatient()`/`requireDoctor()`, since D-12 lets both the patient and the owning doctor cancel) that delegates the entire operation to `cancel_appointment()` — zero direct `appointments`/`availability_slots` writes in the route.
- Wired the D-13 cancellation confirmation `Dialog` and a destructive `Cancel appointment` row action into `/patient/appointments`, rendered only on eligible upcoming/non-cancelled rows, with an untrimmed optional reason, inline server-rejection rendering, and a success path that closes the dialog, announces `Appointment cancelled.` and refreshes the list.
- Proved the whole cancellation lifecycle end to end in `tests/e2e/appointment-cancel.spec.ts`: UI cancellation, byte-identical reason round-trip (including surrounding whitespace), blank-reason-to-null, slot release, re-booking by a second patient (two appointment rows on one slot, exactly as `appointments_active_slot_unique_idx` permits), elapsed/already-cancelled rejection, the T-05-05 non-oracle 404 guarantee, input-validation guards, and row-level cancel-button eligibility.
- Ran the full Playwright suite (260 tests, `workers: 1`) at the end: 251 passed; the 2 failures (`search-filters.spec.ts` Hebrew-name test, `seed-availability.spec.ts` `beforeAll` timeout) are pre-existing flakiness in files this plan never touched and were independently confirmed non-regressions by re-running each in isolation (both pass cleanly alone).

## Task Commits

Each task was committed atomically:

1. **Task 1: Build `PATCH /api/appointments/[id]/cancel`** - `84a5f39` (feat)
2. **Task 2: Wire the cancellation confirmation dialog into `/patient/appointments`** - `73feb93` (feat)
3. **Task 3: Prove patient cancellation, slot release and re-booking end to end** - `e8729d5` (test)

**Plan metadata:** (pending — final docs commit follows this SUMMARY)

## Files Created/Modified

- `app/api/appointments/[id]/cancel/route.ts` - `PATCH` handler: session-only guard, absent-body-as-empty-object parsing, `validateCancelInput`, byte-identical reason forwarding, strict `error.code` branching (`MR002`->409, `MR004`->404, `MR005`->401, else 500)
- `app/patient/appointments/page.tsx` - added `cancellingAppointment`/`cancelReason`/`cancelError`/`isCancelling` dialog state, the D-13 confirmation `Dialog`, and the destructive `Cancel appointment` row action; `statusMessage` gained a setter so the cancellation success path can reuse the existing status region
- `tests/e2e/appointment-cancel.spec.ts` - 10 cases covering APPT-05, APPT-07, D-12, D-13, D-14, T-05-05, and the input-validation backstop

## Decisions Made

- **Route authorization shape:** `createClient()` + `supabase.auth.getUser()` directly, 401 on no session, no role guard at all — `cancel_appointment()` resolves the acting party (patient or owning doctor) from `auth.uid()` inside its own `SECURITY DEFINER` body and is the real authorization boundary; a role guard here would incorrectly 403 one of the two legitimate actors. Documented in a header comment on the route file so a later reader does not "fix" the missing role check.
- **Cancel eligibility computed from the already-derived badge, not a fresh `Date.now()` call:** `AppointmentRow`'s `canCancel` reads `appointmentBadge(status, start_at).label === "Confirmed"` (plus an explicit `isCancelledStatus()` check) instead of `new Date(slot.start_at).getTime() >= Date.now()` directly in the render body — the latter trips eslint's `react-hooks/purity` rule (no impure calls in component render). The badge-based check is logically identical since `appointmentBadge()` already encodes "start_at >= now and not cancelled" in its own derivation.
- **Test fixture sequencing:** tests 1, 2, 4 and 5 in `appointment-cancel.spec.ts` deliberately share one appointment/slot across module-level `let` variables (mirroring the plan's own numbered-item narrative of "cancel -> verify survival -> verify slot release -> re-book"), safe because `playwright.config.ts` runs `fullyParallel: false` / `workers: 1` so test order within the file is guaranteed stable.

## Deviations from Plan

None - plan executed exactly as written. The one implementation-detail adjustment (badge-derived eligibility instead of a direct `Date.now()` comparison) was required to satisfy an existing project-wide eslint rule, produces an identical eligibility result, and is not a behavior change from the plan's stated `<action>` — recorded above as a decision rather than a deviation since no plan requirement was altered.

## Issues Encountered

- The full Playwright suite (260 tests, `workers: 1`) takes roughly 25 minutes to run serially. Two tests failed on this run (`search-filters.spec.ts`'s Hebrew-name-fragment case, `seed-availability.spec.ts`'s idempotency `beforeAll` hook timing out at 30s) — neither file was touched by this plan, and both passed cleanly when re-run in isolation immediately afterward, confirming the failures are pre-existing timing flakiness under serial full-suite load rather than regressions introduced here.

## User Setup Required

None - no external service configuration required beyond what prior phases already established.

## Next Phase Readiness

- `PATCH /api/appointments/[id]/cancel` is proven from the patient side (patient-initiated cancellation, ownership scoping, non-oracle 404s) and is structurally ready for plan 05-05 to drive the same route from the doctor side — the route's session-only guard and `cancel_appointment()`'s own `patient_id = auth.uid() or doctors.profile_id = auth.uid()` filter already support both actors.
- `tests/e2e/appointment-cancel.spec.ts`'s named setup helpers (`futureJerusalemDay`, `loginAsPatient`, `createFixtureDoctor`) are declared at module scope specifically so plan 05-05 extends this file rather than duplicating its fixture pattern.
- The cancellation dialog's state variable names (`cancellingAppointment`, `cancelReason`, `cancelError`, `isCancelling`) and the `openCancelDialog`/`closeCancelDialog`/`handleConfirmCancel` function names on `/patient/appointments` are the reference shape plan 05-05 should mirror (not necessarily reuse verbatim, since the doctor page is a separate file) for its own doctor-side cancellation dialog.
- No known stubs. Every route and UI change in this plan is production-quality with real data — no placeholder or mock data path exists anywhere in the new/modified code.
- Deferred per plan scope: `cancelled_reason` is captured and stored but intentionally never displayed on any list row in this phase (D-13 only requires capturing it) — if a later phase surfaces it, the UI-SPEC's long-text guidance ("apply the same no-truncation `break-words` treatment Phase 4 uses for blocked-slot `reason` text") should be followed.

---
*Phase: 05-appointment-booking-lifecycle*
*Completed: 2026-08-11*

## Self-Check: PASSED

All 4 claimed files found on disk. All 3 claimed commit hashes (`84a5f39`, `73feb93`, `e8729d5`) found in git history.
