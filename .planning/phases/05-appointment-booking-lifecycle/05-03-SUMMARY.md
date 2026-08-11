---
phase: 05-appointment-booking-lifecycle
plan: 03
subsystem: api
tags: [nextjs, supabase, postgres, rls, playwright, typescript]

# Dependency graph
requires:
  - phase: 05-appointment-booking-lifecycle
    provides: "plan 05-01's book_appointment() RPC, requireDoctor() guard pattern, lib/appointments.ts (splitAppointments/appointmentBadge), the patient-side /patient/appointments contract this plan mirrors"
provides:
  - "GET /api/doctor/appointments — doctor-scoped appointment read, narrower select than the admin route (T-05-08)"
  - "app/doctor/(gated)/appointments/page.tsx — Upcoming/Past history view for the doctor actor, exported DoctorAppointment type"
  - "Migration 20260811090000 — profiles_select_via_own_appointment_doctor RLS policy letting a doctor read the profiles row of a patient they have an appointment with"
  - "tests/e2e/appointment-history.spec.ts — shared five-appointment fixture proving both actors' history views agree"
affects: [05-05-doctor-cancel]

actuals:
  tokens: 6700
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Doctor-facing selects are deliberately narrower than the admin route's — verified by an explicit key-set equality assertion in the e2e spec (T-05-08 data-minimisation pattern), not by inspection"
    - "A second RLS select policy is added (never a modification to the existing one) when a legitimate cross-role read is missing — Postgres OR's same-command policies together, so the fix is additive by construction"

key-files:
  created:
    - app/api/doctor/appointments/route.ts
    - "app/doctor/(gated)/appointments/page.tsx"
    - supabase/migrations/20260811090000_add_profiles_select_via_own_appointment_patient.sql
    - tests/e2e/appointment-history.spec.ts
  modified:
    - "app/doctor/(gated)/page.tsx"

key-decisions:
  - "DOCTOR_APPOINTMENT_SELECT = \"id, status, cancelled_reason, created_at, slot:availability_slots!inner(id,start_at,end_at,status), patient:profiles(id,full_name)\" — deliberately omits patient email and slot reason, unlike the admin route's select"
  - "Rule 1 fix: added migration 20260811090000 granting a doctor SELECT on a patient's profiles row via `exists (select 1 from appointments where patient_id = profiles.id and is_doctor_owner(doctor_id))` — the doctor-scoped patient embed silently returned patient: null on every row without it"

patterns-established:
  - "Pattern: the doctor and patient appointment-history pages both consume the same splitAppointments()/appointmentBadge() helpers from lib/appointments.ts — a shared five-appointment fixture in one spec file proves the two pages cannot drift on section placement or badge wording"

requirements-completed: [APPT-12, APPT-13]

coverage:
  - id: D1
    description: "GET /api/doctor/appointments returns only the session doctor's own appointments, scoped by requireDoctor()'s resolved doctorId, with the joined slot and the patient's name only (no email, no slot reason)"
    requirement: APPT-12
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-history.spec.ts#5. T-05-08 data minimisation: the doctor's response carries exactly id/full_name on patient and no slot reason"
        status: pass
      - kind: e2e
        ref: "tests/e2e/appointment-history.spec.ts#6. APPT-12 scoping: F never appears in the first doctor's response, which returns exactly the five fixture ids"
        status: pass
    human_judgment: false
  - id: D2
    description: "A doctor loading /doctor/appointments sees Upcoming/Past sections computed by the same splitAppointments() helper as the patient page, with matching badge wording, including a cancelled-but-future appointment correctly placed under Past"
    requirement: APPT-13
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-history.spec.ts#4. APPT-12/APPT-13 doctor view: identical sections and badges as the patient view, showing the patient's name"
        status: pass
      - kind: e2e
        ref: "tests/e2e/appointment-history.spec.ts#2. D-14/D-17 cancelled-but-future placement: E renders under Past, never Upcoming, with its real cancellation status"
        status: pass
      - kind: e2e
        ref: "tests/e2e/appointment-history.spec.ts#3. D-16 no write-back: C's stored status is still scheduled after both pages have rendered its derived Past label"
        status: pass
    human_judgment: false
  - id: D3
    description: "A logged-in doctor reaches /doctor/appointments from a nav control on /doctor; an unauthenticated visit redirects to /login; a patient calling the doctor endpoint gets 403 and vice versa; loading/error/empty states render per UI-SPEC; no reschedule or attendance control exists on the doctor page"
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-history.spec.ts#8. Guards: anonymous 401, cross-role 403, and an unauthenticated browser visit redirects to /login"
        status: pass
      - kind: e2e
        ref: "tests/e2e/appointment-history.spec.ts#9. Empty state, both pages: a freshly created patient and a freshly linked doctor each see their own empty state"
        status: pass
      - kind: e2e
        ref: "tests/e2e/appointment-history.spec.ts#10. Navigation: /doctor reaches /doctor/appointments and /patient reaches /patient/appointments"
        status: pass
      - kind: e2e
        ref: "tests/e2e/appointment-history.spec.ts#11. No reschedule surface on the doctor page: with A and B rendered as upcoming rows, no rescheduling control exists anywhere"
        status: pass
    human_judgment: false
  - id: D4
    description: "Visual/UX quality of /doctor/appointments (RTL-cleanliness, keyboard reachability, no fixed-height clipping, Israel-local day/time formatting read correctly) — deferred to end-of-phase human verification per the plan's <verification> section"
    verification: []
    human_judgment: true
    rationale: "The plan explicitly defers this human check to end-of-phase verification rather than this plan's own gate; automation cannot judge visual/interaction quality."

duration: 45min
completed: 2026-08-11
status: complete
---

# Phase 5 Plan 3: Doctor Appointment History Summary

**`GET /api/doctor/appointments` and `/doctor/appointments` giving a doctor the same Upcoming/Past history view as the patient page, built strictly on `lib/appointments.ts`'s shared `splitAppointments()`/`appointmentBadge()` helpers, with a deliberately narrower patient-data select than the admin oversight route**

## Performance

- **Duration:** ~45 min (resumed session continuing from a prior interrupted run; all 3 tasks and commits were already complete on entry — this session's work was verification, full-suite confirmation, and SUMMARY authoring)
- **Completed:** 2026-08-11
- **Tasks:** 3
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments

- Built `GET /api/doctor/appointments` behind `requireDoctor()`, restating `appointments_select_own_or_admin` RLS at the app layer via `.eq("doctor_id", guard.doctorId)`, with a `DOCTOR_APPOINTMENT_SELECT` that deliberately carries only `id`/`full_name` from the patient's profile and no `reason` from the joined slot — proven by a key-set-equality assertion, not inspection.
- Built `/doctor/appointments` inside the existing `app/doctor/(gated)/` route group (no new guard code), reusing `splitAppointments()` and `appointmentBadge()` from `lib/appointments.ts` unchanged so the doctor and patient pages cannot drift on section placement or badge wording.
- Added a navigation link from `/doctor` to the new page.
- Wrote `tests/e2e/appointment-history.spec.ts`: one shared five-appointment fixture (plus a sixth cross-pair appointment for scoping) proving both actors' views agree, the D-14/D-17 cancelled-but-future placement rule, the D-16 no-write-back guarantee, cross-actor scoping in both directions, all guard combinations, both empty states, both navigation paths, and the absence of any reschedule control on the doctor page.
- Found and fixed a genuine RLS gap during Task 3 (see Deviations): the doctor-scoped patient embed was silently returning `patient: null` on every row.

## Task Commits

Each task was committed atomically (all three committed in a prior session before this resumption):

1. **Task 1: Build `GET /api/doctor/appointments` as a deliberately narrower doctor-scoped read** - `576cf06` (feat)
2. **Task 2: Build the `/doctor/appointments` page on the shared split-and-badge helpers** - `9a2e046` (feat)
3. **Task 3: Prove both actors' appointment history views and their mutual scoping** - `7a3f419` (test) — includes the Rule 1 RLS-fix migration

**Plan metadata:** (pending — final docs commit follows this SUMMARY)

## Files Created/Modified

- `app/api/doctor/appointments/route.ts` - `GET` handler with `DOCTOR_APPOINTMENT_SELECT`, `requireDoctor()` guard, `.eq("doctor_id", ...)` scoping
- `app/doctor/(gated)/appointments/page.tsx` - Upcoming/Past history page, exports `DoctorAppointment` type, `statusMessage` state reserved for plan 05-05
- `app/doctor/(gated)/page.tsx` - added a `My appointments` nav link to `/doctor/appointments`
- `supabase/migrations/20260811090000_add_profiles_select_via_own_appointment_patient.sql` - Rule 1 fix: additive `profiles` select policy for a doctor reading a patient's row via a shared appointment
- `tests/e2e/appointment-history.spec.ts` - 11 cases covering APPT-10 through APPT-13, D-14, D-16, D-17, T-05-08, and guard/empty-state/navigation backstops

## Decisions Made

- **`DOCTOR_APPOINTMENT_SELECT`** (module-level constant in `app/api/doctor/appointments/route.ts`, consumed only by this route):
  `"id, status, cancelled_reason, created_at, slot:availability_slots!inner(id,start_at,end_at,status), patient:profiles(id,full_name)"` — deliberately drops `email` from the patient embed (present on the admin route) and adds no `reason` from the slot embed.
- **`DoctorAppointment` type** (exported from `app/doctor/(gated)/appointments/page.tsx`, to be extended not redefined by plan 05-05):
  `{ id: string; status: AppointmentStatus; cancelled_reason: string | null; created_at: string; slot: { id: string; start_at: string; end_at: string; status: string } | null; patient: { id: string; full_name: string } | null }`
- **Doctor page state contract** (for plan 05-05 to extend): `listStatus: "loading" | "error" | "ready"`, `appointments: DoctorAppointment[]`, `statusMessage: string | null` with its setter `setStatusMessage` — the `role="status" aria-live="polite"` region beneath `<h1>My appointments</h1>` renders `statusMessage` directly and nothing sets it in this plan.
- **Rule 1 fix:** added `profiles_select_via_own_appointment_doctor`, an additive RLS select policy (`exists (select 1 from appointments where patient_id = profiles.id and is_doctor_owner(doctor_id))`), mirroring the shape of plan 05-01's `availability_slots` fix and reusing the existing `is_doctor_owner()` security-definer helper to avoid RLS recursion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Doctor-scoped patient embed silently returned `null` on every row**
- **Found during:** Task 3, first run of the T-05-08 data-minimisation assertion (case 5)
- **Issue:** `profiles_select_own_or_admin` (Phase 1) only lets a caller read their own `profiles` row, or an admin read any row. `GET /api/doctor/appointments`'s `patient:profiles(id,full_name)` embed is a plain left embed (not `!inner`, since a doctor must always see their own appointment rows even when the patient embed is unreadable) — without an additional policy, RLS silently excluded the patient row from the embed on every request, so `row.patient` was `null` instead of `{ id, full_name }` on every row, defeating the entire purpose of the route.
- **Fix:** Added `supabase/migrations/20260811090000_add_profiles_select_via_own_appointment_patient.sql` — one additive `select` policy granting a doctor read access to a patient's `profiles` row when they share any appointment (any status). Applied and pushed to the remote database (confirmed via `npx supabase migration list` — `20260811090000` present in the remote column).
- **Files modified:** `supabase/migrations/20260811090000_add_profiles_select_via_own_appointment_patient.sql`
- **Verification:** `tests/e2e/appointment-history.spec.ts` case 4 (doctor view shows patient name) and case 5 (key-set equality on the patient embed) both depend on this fix and pass; full suite green afterward.
- **Committed in:** `7a3f419` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug fix)
**Impact on plan:** The fix was necessary for the plan's core deliverable to function at all — without it, the doctor-facing appointment list could never display who the appointment was with. No scope creep — no new tables, no new API surface beyond what the plan specified.

## Issues Encountered

- The prior session was interrupted by an API connection error immediately before the mandatory full-suite verification run. This session re-verified all three tasks' acceptance criteria against the files on disk (all satisfied, nothing needed correction), then ran `npm run build`, `npx eslint` on all four changed files (clean), the targeted spec (11/11 passing), and the full Playwright suite (270 passed, 1 failed on first pass).
- The one full-suite failure — `appointment-cancel.spec.ts` case 5, `net::ERR_CONNECTION_REFUSED` on a `page.waitForURL` — is in a file this plan did not touch (created by plan 05-02). Re-running `appointment-cancel.spec.ts` in isolation immediately afterward produced 10/10 passing, including case 5, confirming a transient dev-server connection hiccup under full-suite load rather than a regression. Not treated as a defect of this plan's work.

## User Setup Required

None — no external service configuration required beyond the `SUPABASE_ACCESS_TOKEN` already established in prior phases (used only for the `npx supabase db push` call for migration `20260811090000`, which succeeded and is confirmed applied remotely).

## Next Phase Readiness

- `/doctor/appointments` is a real, production-quality read view — no stub or mock data path.
- Plan 05-05 (doctor cancellation) extends this exact page: the `DoctorAppointment` type, the `listStatus`/`appointments`/`statusMessage` state variables, and the `role="status" aria-live="polite"` region are all in place and unused-but-ready for a cancellation dialog and its confirmation announcement.
- Plan 05-04 (reschedule) is unaffected by this plan — reschedule remains scoped to the patient page only, and this plan's spec (case 11) proves the doctor page carries no reschedule surface.
- No known stubs.

---
*Phase: 05-appointment-booking-lifecycle*
*Completed: 2026-08-11*

## Self-Check: PASSED

All 5 claimed files found on disk. All 3 claimed commit hashes (`576cf06`, `9a2e046`, `7a3f419`) found in git history. Migration `20260811090000` confirmed applied to the remote database via `npx supabase migration list`.
