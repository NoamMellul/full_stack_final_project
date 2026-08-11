---
phase: 05-appointment-booking-lifecycle
plan: 05
subsystem: api
tags: [nextjs, supabase, postgres, rls, playwright, typescript]

# Dependency graph
requires:
  - phase: 05-appointment-booking-lifecycle
    provides: "plan 05-02's PATCH /api/appointments/[id]/cancel route and its D-13 dialog contract, plan 05-03's app/doctor/(gated)/appointments/page.tsx (DoctorAppointment type, listStatus/statusMessage state, empty role=\"status\" region), lib/appointments.ts's isCancelledStatus/appointmentBadge/splitAppointments, lib/validation/appointments.ts's validateCancelInput"
provides:
  - "Cancellation confirmation Dialog + destructive 'Cancel appointment' row action on /doctor/appointments, byte-identical in copy and shape to the patient page's dialog, submitting to the same shared route"
  - "tests/e2e/appointment-cancel.spec.ts extended to 18 cases — the patient-side 10 from plan 05-02 plus 8 new doctor-side cases proving APPT-06 end to end"
  - "Phase 5's closing full-suite verification: all 290 tests across 28 spec files green"
affects: []

actuals:
  tokens: 6400
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "A second actor consumes an existing shared route with zero new endpoint code — the doctor page's dialog state, submit handler and error handling are a line-for-line mirror of the patient page's (same variable names, same submit shape), proving D-12's 'one operation, two actors' contract by construction rather than by convention alone"
    - "Row-level action eligibility read from the already-computed appointmentBadge().label === \"Confirmed\" plus isCancelledStatus(), never a fresh Date.now() call in the row's render body — same eslint react-hooks/purity accommodation plan 05-02 established, reused verbatim on the doctor page"

key-files:
  created: []
  modified:
    - "app/doctor/(gated)/appointments/page.tsx"
    - "tests/e2e/appointment-cancel.spec.ts"

key-decisions:
  - "No doctor-specific cancel endpoint was created — the doctor page's Cancel appointment button submits to the identical PATCH /api/appointments/[id]/cancel route the patient page already calls; cancel_appointment() derives cancelled_by_doctor purely from auth.uid() compared against the appointment's patient_id, with no actor field ever sent by the client (D-12, D-14, T-05-02)"
  - "Doctor dialog state variable names (cancellingAppointment/cancelReason/cancelError/isCancelling) and function names (openCancelDialog/closeCancelDialog/handleConfirmCancel) mirror the patient page's plan-05-02 naming exactly, per that plan's Next Phase Readiness note, so the two implementations read as one pattern rather than a second vocabulary"

patterns-established:
  - "Pattern: when a plan's job is 'wire actor B into a route actor A already proved,' the acceptance bar is that the two client implementations are provably identical (same copy, same request shape, same state names) rather than merely behaviorally equivalent — verified here by a spec that asserts both parties see the same badge wording for the same stored event (case 13)"

requirements-completed: [APPT-06]

coverage:
  - id: D1
    description: "An upcoming, non-cancelled row on /doctor/appointments renders a destructive Cancel appointment button (min-h-11); a past or cancelled row renders no action button at all"
    requirement: APPT-06
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-cancel.spec.ts#18. UI eligibility on the doctor page: exactly one Cancel appointment control exists, belonging to the upcoming row, and no reschedule control exists anywhere"
        status: pass
    human_judgment: false
  - id: D2
    description: "The doctor's cancellation dialog mirrors the patient's contract exactly (title, warning copy, optional untrimmed Reason textarea, Keep appointment / Cancel appointment footer with Cancelling… in-flight label) and submits to the same shared PATCH /api/appointments/[id]/cancel route — no doctor-specific endpoint"
    requirement: APPT-06
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-cancel.spec.ts#11. APPT-06 through the UI: a doctor cancels an upcoming appointment through the shared confirmation dialog"
        status: pass
    human_judgment: false
  - id: D3
    description: "A doctor cancelling an appointment they own sets status to cancelled_by_doctor (decided inside cancel_appointment() from auth.uid(), never from client input) with a byte-identical reason round-trip, and the row survives — never deleted — in both parties' history showing the identical Cancelled by doctor badge"
    requirement: APPT-06
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-cancel.spec.ts#12. D-14 status and survival: the row survives with cancelled_by_doctor and a byte-identical reason"
        status: pass
      - kind: e2e
        ref: "tests/e2e/appointment-cancel.spec.ts#13. Both parties see one account: the patient's page shows the same Cancelled by doctor badge"
        status: pass
    human_judgment: false
  - id: D4
    description: "A doctor's cancellation releases the linked slot back to available in the same transaction, and the freed slot is genuinely re-bookable by a different patient"
    requirement: APPT-07
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-cancel.spec.ts#14. APPT-07 for the doctor path: the freed slot returns to available and is genuinely re-bookable by another patient"
        status: pass
    human_judgment: false
  - id: D5
    description: "The acting party recorded on a cancellation is decided by the session, never by a contradicting field the client includes in the request body — proven in both directions (patient body naming the doctor, doctor body naming the patient)"
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-cancel.spec.ts#15. T-05-02 actor is not client-supplied: the session decides the acting party in both directions, not a contradicting body field"
        status: pass
    human_judgment: false
  - id: D6
    description: "A doctor cancelling another doctor's appointment receives the same 404 body as a nonexistent id, with the other doctor's row unmodified"
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-cancel.spec.ts#16. T-05-05 cross-doctor 404: a doctor cancelling another doctor's appointment gets the same 404 as a missing id"
        status: pass
    human_judgment: false
  - id: D7
    description: "A doctor's cancel request for an elapsed appointment, or a second cancel of an already-cancelled one, returns 409 with the locked copy and never overwrites the first stored reason"
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-cancel.spec.ts#17. D-12 timing, doctor side: an elapsed appointment and a second cancellation of an already-cancelled one both reject with 409"
        status: pass
    human_judgment: false
  - id: D8
    description: "Visual/UX quality of the doctor's cancellation dialog (identical wording/shape to the patient's, Keep appointment as the visually subordinate dismiss, keyboard dismissibility, and that nothing on the page invites recording attendance or a message the patient will read) — deferred to end-of-phase human verification per the plan's <verification> section"
    verification: []
    human_judgment: true
    rationale: "The plan explicitly defers this human check to end-of-phase verification rather than this plan's own gate; automation cannot judge visual/interaction quality or the absence of an implicit invitation to add an attendance/message control."

duration: 35min
completed: 2026-08-11
status: complete
---

# Phase 5 Plan 5: Doctor-Initiated Cancellation & Phase Closing Gate Summary

**The doctor's `Cancel appointment` action wired onto `/doctor/appointments` as a line-for-line mirror of the patient's D-13 dialog, submitting to the identical shared `PATCH /api/appointments/[id]/cancel` route — closing APPT-06, the last requirement of Phase 5, with all 290 tests across the whole Playwright suite green**

## Performance

- **Duration:** ~35 min in this resumed session (Task 1 — the row action and dialog on `/doctor/appointments` — was already committed on entry from a prior session; Task 2's 8 doctor-side spec cases were already written to disk but uncommitted, ending cleanly with properly closed braces). This session's work was: reading both artifacts back against every one of the plan's acceptance criteria rather than trusting their apparent completeness, running the 8 new APPT-06 cases in isolation, running the full 18-case spec file, running `npm run build` and `npx eslint` on both changed files, committing Task 2, then running the entire Playwright suite as the phase's closing gate.
- **Completed:** 2026-08-11
- **Tasks:** 2
- **Files modified:** 2 (0 created, 2 modified)

## Accomplishments

- Verified Task 1 (`app/doctor/(gated)/appointments/page.tsx`, committed `90b3132` in a prior session) against every one of the plan's acceptance criteria: the row action renders only on eligible rows (`badge?.label === "Confirmed" && !isCancelledStatus(...)`, the same eslint-purity-safe derivation plan 05-02 established), the dialog's title/warning/labels/button copy are byte-identical to the patient page's, the request body carries exactly one key (`reason`), the shared cancel route is used (no doctor-specific endpoint), and no reschedule or attendance control exists anywhere on the page.
- Verified Task 2's 411-line APPT-06 test block against the same acceptance criteria before trusting it: correct helper reuse (`loginAsDoctor`, `createTestDoctor({ profileId })`, `futureJerusalemDay` on non-colliding day offsets), correct `afterAll` cleanup reuse, and all 8 new cases (11-18) actually exercising what their names claim.
- Ran the 8 new cases in isolation first (8/8 passing, ~56s), then the full 18-case `appointment-cancel.spec.ts` (18/18 passing, ~1.9min), then `npm run build` (clean) and `npx eslint` on both changed files (zero warnings/errors) — only then committed Task 2.
- Ran the entire Playwright suite as the phase's closing gate: **290/290 tests passing across 28 spec files**, zero failures — including every Phase 1-4 spec that reads `availability_slots.status`, which this phase's booking/cancellation/reschedule functions all write to. No flake, known or otherwise, appeared on this run.

## Task Commits

1. **Task 1: Wire the cancellation dialog and destructive row action into `/doctor/appointments`** - `90b3132` (feat) — committed in a prior session; re-verified against every acceptance criterion this session, no changes needed.
2. **Task 2: Extend the cancellation spec with the doctor-initiated cases and close the phase's full-suite gate** - `e7bfa7c` (test) — written in a prior session, verified and committed this session.

**Plan metadata:** (pending — final docs commit follows this SUMMARY)

## Files Created/Modified

- `app/doctor/(gated)/appointments/page.tsx` - added the `cancellingAppointment`/`cancelReason`/`cancelError`/`isCancelling` dialog state (naming mirrors the patient page exactly), the D-13 confirmation `Dialog`, and a destructive `Cancel appointment` row action rendered only on eligible rows
- `tests/e2e/appointment-cancel.spec.ts` - added `loginAsDoctor` and an `APPT-06: doctor-initiated cancellation` describe block with 8 cases (11-18) covering the UI flow, D-14 status/reason survival, cross-page badge parity, APPT-07 slot release/re-booking on the doctor path, T-05-02 session-derived actor (both directions), T-05-05 cross-doctor 404 parity, D-12 elapsed/already-cancelled 409s, and doctor-page row eligibility — bringing the file to 18 total cases (10 patient-side from plan 05-02 + 8 doctor-side here)

## Decisions Made

- **No second endpoint:** the doctor page's `handleConfirmCancel` calls `fetch(`/api/appointments/${cancellingAppointment.id}/cancel`, { method: "PATCH", ... })` — the identical route and identical body shape (`{ reason }`) the patient page already uses. `cancel_appointment()`'s own `auth.uid()`-vs-`patient_id` comparison is the sole determinant of `cancelled_by_patient` vs `cancelled_by_doctor`; the client never sends an actor field, and Task 2 case 15 proves a contradicting field in the body has no effect in either direction.
- **State/naming parity, not code reuse:** because the doctor and patient pages are separate files (`app/doctor/(gated)/appointments/page.tsx` vs `app/patient/appointments/page.tsx`), the dialog state and handler function names were deliberately kept identical (`cancellingAppointment`, `cancelReason`, `cancelError`, `isCancelling`, `openCancelDialog`, `closeCancelDialog`, `handleConfirmCancel`) rather than introducing a parallel vocabulary — this is the naming contract plan 05-02's SUMMARY explicitly asked plan 05-05 to follow.

## Deviations from Plan

None — plan executed exactly as written. Both tasks, found already complete on disk from a prior interrupted session, held up under full re-verification against every stated acceptance criterion with no correction needed. No auto-fixes, no architectural questions, no scope changes.

## Issues Encountered

None. The full 290-test suite ran clean end to end on the first attempt this session — no known-flake files (`search-filters.spec.ts`, `seed-availability.spec.ts`, `admin-doctor-status.spec.ts`) failed this run, so no isolated re-run was needed to distinguish a regression from transient load.

## User Setup Required

None — no external service configuration required. This plan added no migration (it consumes `cancel_appointment()`, deployed by plan 05-01, and the route built by plan 05-02).

## Phase 5 Closing Report

This is the last plan of Phase 5. Per this plan's `<output>` instruction, recorded here for `/gsd-verify-work`:

**Full-suite result:** `npx playwright test` — **290/290 passing, 0 failures, 28 spec files.** This is the highest test count and cleanest run of any plan in this phase (up from 282/282 at the close of plan 05-04); the 8 new APPT-06 cases account for the growth.

**Phase 1-4 specs adjusted because of this phase's `availability_slots.status` writes:** exactly one, and it happened in plan 05-01, not here. `tests/e2e/doctor-profile.spec.ts` (Phase 3) had asserted the pre-Phase-5 stub contract — every `Select this slot` button stays permanently `disabled`. Plan 05-01's D-01 supersedes that by design (booking is now live), so that test was rewritten to assert the new enabled+redirect contract instead of the old disabled one (commit `fbd0f03`). No other Phase 1-4 spec needed any change across the whole phase, and this plan's closing full-suite run confirms that fix still holds — every Phase 3 search spec and every Phase 4 schedule spec that reads `availability_slots.status` passed clean alongside this plan's own new cases.

**Disposition of every flagged assumption carried by plans 05-01 through 05-04:**

1. **05-01 — badge/status divergence** ("Confirmed" label vs. stored `scheduled` status): asserted as a deliberate truth, not a bug. Confirmed still holding — `lib/appointments.ts`'s `appointmentBadge()` is unchanged since 05-01 and is imported unmodified by both this plan's doctor page and the patient page; the full-suite run's Phase 5 cases on both pages all show `Confirmed` for a `scheduled` row.
2. **05-02 — D-15's unreachable-in-practice future-slot guard on release:** `cancel_appointment()`'s slot-release `update` conditions on the slot still being in the future, even though D-12 already makes a cancellable appointment one whose `start_at` hasn't passed (so the guard is normally a no-op). Kept as defensive code, not exercised as a distinguishing test case, by design. This plan's doctor-side timing cases (17) reconfirm the D-12 boundary itself holds for the second actor; no new information changes this disposition.
3. **05-03 — cancelled-but-future appointment renders under Past, not Upcoming:** resolved via the UI-SPEC and asserted as a truth in plan 05-03, proven there by `appointment-history.spec.ts` case 2. This plan consumes `splitAppointments()` unchanged and adds no new interpretation; the doctor page's own `Past` section correctly places a doctor-cancelled appointment there (case 11), confirming the rule holds identically for both cancellation directions.
4. **05-04 — RESEARCH Open Question 1 (`is_active` guard applies to reschedule, for consistency with D-19), explicitly flagged for confirmation at end-of-phase verification:** **confirmed, not overturned.** This plan touched no reschedule code and found nothing in `05-CONTEXT.md`/`05-UI-SPEC.md` that contradicts the consistency reading `reschedule_appointment()` already applies. The closing full-suite run re-passed `appointment-reschedule.spec.ts` case 7 (the assertion that pins this reading) alongside every other Phase 5 spec, with zero regressions. Phase 5 closes with this assumption standing as designed.
5. **05-05's own flagged assumption** (APPT-06 returned `unclassified` from the deterministic edge probe): resolved as the plan itself anticipated — every edge was already closed by D-12/D-13/D-14/D-15 and the UI-SPEC's "trigger appears on any appointment row, patient or doctor view" statement, with copy discretion the only open dimension, and that discretion was resolved by mirroring the patient dialog verbatim. Nothing was left to inference during execution.

**Deferred human-judgment items across the whole phase** (all explicitly deferred to end-of-phase verification by each plan's own `<verification>` section, none performed by any executor session, all still pending a human pass): visual/UX quality of the booking confirmation dialog and appointment list (05-01), the patient cancellation dialog (05-02), `/doctor/appointments`'s RTL-cleanliness and formatting (05-03), the reschedule picker's RTL/keyboard/scroll behavior and its Reschedule-vs-Cancel visual subordination (05-04), and this plan's doctor cancellation dialog — specifically that it reads as identical in wording/shape to the patient's, that `Keep appointment` reads as the subordinate dismiss, that it is keyboard-dismissible, and that nothing on the page invites recording attendance or writing a message the patient will read. None of these are automatable judgment calls; all are collected here as the single list `/gsd-verify-work` should walk.

## Next Phase Readiness

- Phase 5 is functionally complete: all 13 requirements (APPT-01 through APPT-13) have a passing e2e case, and the entire 290-test suite is green.
- No known stubs anywhere in Phase 5's code. Every route, RPC, and UI surface built across all five plans is production-quality with real data — no placeholder or mock data path exists.
- Phase 6 (Dashboards, Notifications & Localization) depends on Phase 5 and can now proceed — `lib/appointments.ts`'s `AppointmentStatus`/`appointmentBadge()`/`splitAppointments()` and both appointment-list pages' state contracts are the stable surface Phase 6's dashboard summaries will read from.
- The five deferred human-judgment visual/UX checks listed above are the one remaining item before Phase 5 can be marked verified end to end.

---
*Phase: 05-appointment-booking-lifecycle*
*Completed: 2026-08-11*

## Self-Check: PASSED

Both claimed files found on disk (`app/doctor/(gated)/appointments/page.tsx`, `tests/e2e/appointment-cancel.spec.ts`). Both claimed commit hashes (`90b3132`, `e7bfa7c`) found in git history.
