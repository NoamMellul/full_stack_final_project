---
phase: 05-appointment-booking-lifecycle
plan: 05
subsystem: api
tags: [nextjs, supabase, postgres, rls, playwright, typescript]

# Dependency graph
requires:
  - phase: 05-appointment-booking-lifecycle
    provides: "plan 05-02's PATCH /api/appointments/[id]/cancel route and its D-13 dialog conventions, plan 05-03's app/doctor/(gated)/appointments/page.tsx (DoctorAppointment type, statusMessage region), lib/appointments.ts's isCancelledStatus/appointmentBadge/splitAppointments, lib/validation/appointments.ts's validateCancelInput"
provides:
  - "Cancellation confirmation Dialog + destructive 'Cancel appointment' row action on /doctor/appointments, reusing the shared PATCH /api/appointments/[id]/cancel route unchanged"
  - "8 doctor-initiated cases (11-18) appended to tests/e2e/appointment-cancel.spec.ts, closing APPT-06"
affects: []

actuals:
  tokens: 6723
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "A cancellation dialog for a second legitimate actor on a different page is a byte-for-byte copy of the first actor's dialog state names and markup (cancellingAppointment/cancelReason/cancelError/isCancelling), not a generalized shared component — proves the two implementations cannot silently diverge in copy or behavior while keeping each page self-contained"

key-files:
  created: []
  modified:
    - "app/doctor/(gated)/appointments/page.tsx"
    - "tests/e2e/appointment-cancel.spec.ts"

key-decisions:
  - "No new route, no migration, no change to cancel_appointment() — the doctor page submits to the exact same PATCH /api/appointments/[id]/cancel route the patient page already calls, exactly as D-12 requires"
  - "Row cancel-eligibility on the doctor page reads appointmentBadge(status, start_at).label === \"Confirmed\" plus isCancelledStatus(), the same derivation as the patient page's canManage, to satisfy eslint react-hooks/purity (no direct Date.now() comparison in the render body)"

patterns-established: []

requirements-completed: [APPT-06]

coverage:
  - id: D1
    description: "An upcoming, non-cancelled row on /doctor/appointments renders a destructive Cancel appointment button (min-h-11); a past row and a cancelled row render no action button at all"
    requirement: APPT-06
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-cancel.spec.ts#18. UI eligibility on the doctor page: exactly one Cancel appointment control exists, belonging to the upcoming row, and no reschedule control exists anywhere"
        status: pass
    human_judgment: false
  - id: D2
    description: "The doctor's cancellation dialog mirrors the patient's contract exactly (title, warning copy, optional untrimmed Reason textarea with no maxLength/placeholder, Keep appointment / Cancel appointment footer with Cancelling… in-flight label) and submits to the same shared PATCH /api/appointments/[id]/cancel route — no doctor-specific endpoint"
    requirement: APPT-06
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-cancel.spec.ts#11. APPT-06 through the UI: a doctor cancels an upcoming appointment through the shared confirmation dialog"
        status: pass
    human_judgment: false
  - id: D3
    description: "A doctor cancelling their own appointment sets appointments.status to cancelled_by_doctor, decided inside cancel_appointment() by comparing auth.uid() against patient_id — never by a client-supplied field, in either direction"
    requirement: APPT-06
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-cancel.spec.ts#12. D-14 status and survival: the row survives with cancelled_by_doctor and a byte-identical reason"
        status: pass
      - kind: e2e
        ref: "tests/e2e/appointment-cancel.spec.ts#15. T-05-02 actor is not client-supplied: the session decides the acting party in both directions, not a contradicting body field"
        status: pass
    human_judgment: false
  - id: D4
    description: "A doctor's cancellation releases the linked availability_slots row back to available in the same transaction, and the freed slot is genuinely bookable again by a different patient"
    requirement: APPT-06
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-cancel.spec.ts#14. APPT-07 for the doctor path: the freed slot returns to available and is genuinely re-bookable by another patient"
        status: pass
    human_judgment: false
  - id: D5
    description: "The same cancelled appointment renders Cancelled by doctor on the patient's own /patient/appointments page too, since both pages derive the badge from the same appointmentBadge() helper reading the same stored status"
    requirement: APPT-06
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-cancel.spec.ts#13. Both parties see one account: the patient's page shows the same Cancelled by doctor badge"
        status: pass
    human_judgment: false
  - id: D6
    description: "A doctor cancelling an appointment belonging to a different doctor receives the identical 404 body as a nonexistent appointment id, and the other doctor's appointment is unmodified; a doctor's cancel of an elapsed or already-cancelled appointment returns 409 with the locked copy, without overwriting a prior stored reason"
    requirement: APPT-06
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-cancel.spec.ts#16. T-05-05 cross-doctor 404: a doctor cancelling another doctor's appointment gets the same 404 as a missing id"
        status: pass
      - kind: e2e
        ref: "tests/e2e/appointment-cancel.spec.ts#17. D-12 timing, doctor side: an elapsed appointment and a second cancellation of an already-cancelled one both reject with 409"
        status: pass
    human_judgment: false
  - id: D7
    description: "No Reschedule control and no attendance-outcome control of any kind exists on /doctor/appointments; the doctor's cancellation reason is never rendered on either page or returned to the patient"
    requirement: APPT-06
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-cancel.spec.ts#18. UI eligibility on the doctor page: ... no reschedule control exists anywhere"
        status: pass
      - kind: other
        ref: "Task 1 source assertions: page contains no control offering rescheduling and no control or field referring to attendance; cancelled_reason is never rendered or requested by either page's select string"
        status: pass
    human_judgment: false
  - id: D8
    description: "Full Playwright suite (290 tests) is green after this phase's final plan — booking, cancellation and rescheduling's availability_slots.status writes do not regress the Phase 3 search or Phase 4 schedule specs"
    verification:
      - kind: e2e
        ref: "npx playwright test (full suite, workers: 1) — 290/290 passed"
        status: pass
    human_judgment: false
  - id: D9
    description: "Visual/UX quality of the doctor's cancellation dialog (identical wording/shape to the patient's, Keep appointment as visually subordinate dismiss, keyboard-dismissible, nothing inviting an attendance record or a message the patient will read) — deferred to end-of-phase human verification per the plan's <verification> section"
    verification: []
    human_judgment: true
    rationale: "The plan explicitly defers this human check to end-of-phase verification rather than this plan's own gate; automation cannot judge visual/interaction quality or the absence of an implicit invitation to record attendance or message the patient."
  - id: D10
    description: "Flagged-assumption disposition carried from plan 05-04 (RESEARCH Open Question 1): reschedule_appointment() applies the same is_active doctor guard as book_appointment() for consistency with D-19"
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-reschedule.spec.ts#7. D-19 consistency, flagged assumption: a slot belonging to a deactivated doctor is refused"
        status: pass
    human_judgment: true
    rationale: "Plan 05-04 explicitly framed this as a resolved-but-flagged assumption pending confirmation at end-of-phase verification (RESEARCH.md Open Question 1). The e2e case proves the current behavior; confirming it is the intended long-term contract (vs. an oversight to revisit) is a product judgment, not something the passing test alone can certify."

duration: 48min
completed: 2026-08-11
status: complete
---

# Phase 5 Plan 5: Doctor-Initiated Cancellation Summary

**Doctor gets the same D-13 cancellation dialog and destructive row action the patient already has on `/doctor/appointments`, submitting to the unchanged shared `PATCH /api/appointments/[id]/cancel` route — no second endpoint, no client-supplied actor field, closing Phase 5**

## Performance

- **Duration:** ~48 min
- **Started:** 2026-08-11T15:20:00+03:00 (approx., first file reads of this session)
- **Completed:** 2026-08-11T16:08:00+03:00
- **Tasks:** 2
- **Files modified:** 2 (0 created, 2 modified)

## Accomplishments

- Extended `app/doctor/(gated)/appointments/page.tsx` with the D-13 cancellation dialog, reproduced from the patient page's implementation with identical state variable names (`cancellingAppointment`/`cancelReason`/`cancelError`/`isCancelling`) and identical copy, and a destructive `Cancel appointment` row action rendered only on eligible upcoming/non-cancelled rows.
- Confirmed the doctor page submits to the exact same `PATCH /api/appointments/[id]/cancel` route the patient page calls, with the acting party (`cancelled_by_doctor`) decided entirely inside `cancel_appointment()` from `auth.uid()` — no doctor-specific endpoint, no client-supplied actor field anywhere in the request body.
- Extended `tests/e2e/appointment-cancel.spec.ts` with 8 doctor-side cases (11-18): the UI cancellation flow, D-14 status/reason survival, cross-page badge parity (the patient sees the identical `Cancelled by doctor` wording), APPT-07 slot release and genuine re-booking on the doctor path, T-05-02 session-derived actor in both directions against a contradicting body field, T-05-05 cross-doctor 404 parity, D-12 elapsed/already-cancelled 409 rejection on the doctor side, and doctor-page row eligibility (exactly one control, no reschedule control anywhere).
- Ran the phase's closing gate: the full 290-test Playwright suite green in one pass (21.7 min, `workers: 1`), with zero failures — including every prior known-flaky spot (`search-filters.spec.ts` Hebrew-name case, `seed-availability.spec.ts` `beforeAll` timeout, `admin-doctor-status.spec.ts` case 4, `appointment-cancel.spec.ts` case 5) passing cleanly this run.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire the cancellation dialog and destructive row action into `/doctor/appointments`** - `90b3132` (feat)
2. **Task 2: Extend the cancellation spec with the doctor-initiated cases and close the phase's full-suite gate** - `e7bfa7c` (test)

**Plan metadata:** (pending — final docs commit follows this SUMMARY)

## Files Created/Modified

- `app/doctor/(gated)/appointments/page.tsx` - added the cancellation `Dialog` (mirroring the patient page's markup and state names), a destructive `Cancel appointment` row action gated on the same "start_at >= now and not cancelled" eligibility test as the patient page, and wired `statusMessage` (reserved empty by plan 05-03) to announce `Appointment cancelled.` on success
- `tests/e2e/appointment-cancel.spec.ts` - added a `loginAsDoctor` helper and an 8-case `APPT-06: doctor-initiated cancellation` describe block (cases 11-18), reusing the file's existing cleanup helpers rather than adding a second cleanup path

## Decisions Made

- **No new route, no migration, no change to `cancel_appointment()`:** the doctor page's submit handler is a straight `fetch` to `/api/appointments/{id}/cancel` — the identical URL, method and body shape the patient page already uses. This is the plan's central design commitment (D-12): one operation, two legitimate actors, proven by construction rather than by a second, drift-prone implementation.
- **Row eligibility read from the derived badge, not a fresh `Date.now()` call:** `AppointmentRow`'s `canCancel` on the doctor page uses `appointmentBadge(status, start_at).label === "Confirmed"` plus `isCancelledStatus()`, matching the exact pattern plan 05-02 established on the patient page to satisfy eslint's `react-hooks/purity` rule while remaining logically identical to "start_at >= now and not cancelled".
- **Test fixture strategy:** each of the 8 new cases (or sub-case within a case, for the two-appointment T-05-02 test) uses its own day offset (110-116) and, where isolation of the button count matters (case 18), its own dedicated doctor/patient pair — never reusing a day offset from plan 05-02's patient-side cases, so no fixture can collide with `availability_slots_no_overlap`.

## Deviations from Plan

None - plan executed exactly as written. No production-code bug was found; no missing critical functionality was added beyond what the plan specified; no architectural change was needed.

## Issues Encountered

None. The full 290-test suite passed in a single run with zero failures, including every spot flagged as historically flaky in prior phase summaries — no isolated re-run was needed to confirm a non-regression this time.

## User Setup Required

None - no external service configuration required. This plan added no migration and no new package.

## Next Phase Readiness — End-of-Phase Disposition

This is the last plan of Phase 5. Flagged assumptions and deferred human checks carried by plans 05-01 through 05-04, and their disposition at this final plan:

- **Plan 05-04's RESEARCH Open Question 1** (reschedule inherits the same `is_active` doctor guard as booking, for consistency with D-19): proven by `tests/e2e/appointment-reschedule.spec.ts` case 7 and unchanged by this plan. Recorded here as coverage `D10` (`human_judgment: true`) — the passing test proves current behavior; confirming it as the intended long-term contract (rather than an oversight) is the deferred human judgment call, per plan 05-04's own framing. No plan in this phase overturned it.
- **Visual/UX quality checks deferred by plans 05-01, 05-02, 05-03, 05-04 and this plan** (RTL-cleanliness, keyboard reachability, destructive-vs-subordinate button emphasis, no fixed-height clipping, Israel-local time formatting, and — specific to this plan — nothing on the doctor page inviting an attendance record or a message the patient will read): all still open, all explicitly deferred to end-of-phase human verification by each plan's own `<verification>` section rather than any plan's own gate. This SUMMARY's `D9` records this plan's instance; the phase-level human check should walk `/patient/appointments` and `/doctor/appointments` together.
- **Plan 05-01's `new-rls-surface` threat flag** (a patient can read the `availability_slots` row behind their own appointment regardless of status, added as a Rule 1 fix): unaffected by this plan, no new RLS surface introduced here. Still worth a look at end-of-phase security review per 05-01's own note, but not reopened by anything in this plan.
- **This plan's own three `flagged-unverified` prohibitions** (doctor's cancellation reason never reaching the patient; no attendance-recording control on the doctor page; a doctor-cancelled appointment never disappearing from the patient's history) are all `judgment`-verification prohibitions per the plan's threat model, and are all satisfied by construction: `cancelled_reason` is captured and stored but never rendered by either page and never requested by either list endpoint's select string (T-05-13, mitigated); no attendance/no-show control exists anywhere in the diff (grep-verified, zero matches); D-14 keeps the row present in `Past` on both pages (proven by cases 11 and 13). No further action needed, but these remain judgment calls, not mechanically closed items — the end-of-phase human verification pass in `<verification>` is the closing check.
- No known stubs anywhere in this plan's diff. Every control added is wired to the real shared route with real data.

Phase 5 (Appointment Booking & Lifecycle) is functionally complete: booking (05-01), patient cancellation (05-02), doctor history (05-03), rescheduling (05-04) and doctor cancellation (05-05) all exist, all delegate to the three `SECURITY DEFINER` RPCs deployed in 05-01, and the full 290-test suite is green end to end. What remains is the human verification pass each plan explicitly deferred — not a re-open of any automated gate.

---
*Phase: 05-appointment-booking-lifecycle*
*Completed: 2026-08-11*

## Self-Check: PASSED

Both claimed files found on disk (`app/doctor/(gated)/appointments/page.tsx`, `tests/e2e/appointment-cancel.spec.ts`). Both claimed commit hashes (`90b3132`, `e7bfa7c`) found in git history.
</content>
