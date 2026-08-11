---
phase: 05-appointment-booking-lifecycle
plan: 01
subsystem: api
tags: [supabase, postgres, security-definer, rls, nextjs, playwright, rpc]

# Dependency graph
requires:
  - phase: 04-doctor-availability-management
    provides: availability_slots table, doctor schedule routes, lib/timezone.ts, lib/auth/require-doctor.ts pattern
provides:
  - Three SECURITY DEFINER Postgres functions (book_appointment, reschedule_appointment, cancel_appointment) with five custom SQLSTATE codes
  - requirePatient() auth guard
  - lib/validation/appointments.ts (shared UUID_PATTERN + three input validators)
  - lib/appointments.ts (AppointmentStatus/appointmentBadge/splitAppointments — the single source for the D-17/D-18 derived label and history split)
  - POST /api/appointments, GET /api/patient/appointments
  - /patient/appointments page with Upcoming/Past sections
  - Enabled booking CTA + confirmation dialog on /doctors/[id]
  - availability_slots RLS carve-out so a patient can read the slot behind their own appointment regardless of status
affects: [05-02-cancel, 05-03-doctor-history, 05-04-reschedule, 05-05-doctor-cancel]

actuals:
  tokens: 16700
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "SECURITY DEFINER Postgres functions resolve the acting identity from auth.uid() internally, never from a parameter — one conditional UPDATE is simultaneously the availability check and the claim (never split into SELECT-then-UPDATE)"
    - "Custom SQLSTATE codes (MR001-MR005) translated to HTTP status client-side by branching on the flat error.code string, never on error.message"
    - "Derived display state (badge label, upcoming/past bucket) lives in one shared lib module and is computed at render time, never written back to the database"

key-files:
  created:
    - supabase/migrations/20260810120000_add_appointment_booking_functions.sql
    - supabase/migrations/20260811070000_add_availability_slots_select_via_own_appointment.sql
    - lib/auth/require-patient.ts
    - lib/validation/appointments.ts
    - lib/appointments.ts
    - app/api/appointments/route.ts
    - app/api/patient/appointments/route.ts
    - app/patient/appointments/page.tsx
    - tests/e2e/appointment-booking.spec.ts
  modified:
    - app/doctors/[id]/page.tsx
    - app/patient/page.tsx
    - tests/e2e/doctor-profile.spec.ts

key-decisions:
  - "Task 1 checkpoint: option-b selected (auto-selected under workflow.auto_advance) — revoke insert on public.appointments from anon, authenticated, forcing every appointment row through book_appointment()"
  - "Rule 1 fix: added a new migration granting a patient SELECT on the availability_slots row backing their own appointment, regardless of status — the original policy only allowed reading a slot while status='available', which silently broke both the post-booking follow-up read and the entire /patient/appointments list once a slot flipped to booked"
  - "Rule 1 fix: updated the pre-existing Phase 3 doctor-profile.spec.ts test that asserted the booking button stayed disabled — Phase 5's D-01 explicitly supersedes that stub contract"

patterns-established:
  - "Pattern: booking-functions.sql header comment records the SECURITY DEFINER rationale, the five custom SQLSTATE codes, and why identity is always auth.uid()-derived — reused verbatim by 05-02/05-04/05-05's consumption of reschedule_appointment/cancel_appointment"
  - "Pattern: lib/appointments.ts is the single shared source for the derived Confirmed/Past/Cancelled badge and the Upcoming/Past split — both the patient page (this plan) and the doctor page (05-03) must import from it, never reimplement"

requirements-completed: [APPT-01, APPT-02, APPT-03, APPT-04, APPT-10, APPT-11]

coverage:
  - id: D1
    description: "book_appointment()/reschedule_appointment()/cancel_appointment() deployed as SECURITY DEFINER functions with execute revoked from public and granted to authenticated; Task 1's insert-privilege decision (option-b) applied"
    requirement: APPT-01
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-booking.spec.ts (full suite run, 250/250 passing)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A patient books an available future slot from a doctor's public profile through a confirmation dialog and lands on /patient/appointments seeing it under Upcoming with a Confirmed badge"
    requirement: APPT-01
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-booking.spec.ts#1. APPT-01: a patient books one slot end to end through the confirmation dialog"
        status: pass
    human_judgment: false
  - id: D3
    description: "Two concurrent bookings of the same slot resolve to exactly one 201 and one 409, with exactly one non-cancelled appointment row"
    requirement: APPT-02
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-booking.spec.ts#2. APPT-02 concurrency: two concurrent bookings of the same slot resolve to exactly one 201 and one 409"
        status: pass
    human_judgment: false
  - id: D4
    description: "A slot whose start_at has already passed is rejected with the generic slot message and no appointment row is created"
    requirement: APPT-03
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-booking.spec.ts#4. APPT-03: booking a slot whose start_at is in the past is rejected with the generic slot message"
        status: pass
    human_judgment: false
  - id: D5
    description: "A successful booking flips the slot to booked in the same statement that verified availability, and the slot disappears from the doctor's public availability immediately"
    requirement: APPT-04
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-booking.spec.ts#5. APPT-04: a successful booking immediately removes the slot from the doctor's public availability"
        status: pass
    human_judgment: false
  - id: D6
    description: "/patient/appointments renders Upcoming/Past sections scoped to the session patient, with Confirmed/Past/Cancelled badges derived at render time"
    requirement: APPT-10
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-booking.spec.ts#11. APPT-10/APPT-11 rendering: upcoming, elapsed and cancelled appointments land in the right section with the right badge"
        status: pass
      - kind: e2e
        ref: "tests/e2e/appointment-booking.spec.ts#12. APPT-10 scoping: a second patient's appointment never appears in the first patient's own list"
        status: pass
    human_judgment: false
  - id: D7
    description: "A patient's Past section correctly shows both elapsed non-cancelled appointments (Past badge) and cancelled appointments (real cancellation status), including a cancelled appointment whose slot is still in the future"
    requirement: APPT-11
    verification:
      - kind: e2e
        ref: "tests/e2e/appointment-booking.spec.ts#11. APPT-10/APPT-11 rendering: upcoming, elapsed and cancelled appointments land in the right section with the right badge"
        status: pass
    human_judgment: false
  - id: D8
    description: "Visual/UX quality of the confirmation dialog and appointment list (RTL-cleanliness, keyboard reachability, wrap behavior on long location lines, no fixed-height clipping) — deferred to end-of-phase human verification per the plan's <verification> section"
    verification: []
    human_judgment: true
    rationale: "The plan explicitly defers this human check to end-of-phase verification rather than this plan's own gate; automation cannot judge visual/interaction quality."

duration: 90min
completed: 2026-08-11
status: complete
---

# Phase 5 Plan 1: Appointment Booking Tracer Summary

**Transactional `book_appointment()` SECURITY DEFINER RPC with a single conditional UPDATE as the anti-double-booking guarantee, wired end to end from the doctor profile's confirmation dialog to the patient's own appointment history**

## Performance

- **Duration:** ~90 min (across a prior interrupted session plus this resumed session)
- **Completed:** 2026-08-11
- **Tasks:** 3 (checkpoint decision, migration + push, tracer)
- **Files modified:** 12 (9 created, 3 modified) plus 1 additional Rule-1-fix migration

## Accomplishments

- Deployed `book_appointment()`, `reschedule_appointment()`, `cancel_appointment()` as `SECURITY DEFINER` Postgres functions with five custom SQLSTATE codes (`MR001`-`MR005`), execute revoked from `public` and granted to `authenticated`, and Task 1's insert-privilege decision (option-b: `revoke insert on public.appointments from anon, authenticated`) applied — confirmed applied remotely via `npx supabase migration list`.
- Built the full patient booking path: `requirePatient()` guard, manual validators, `POST /api/appointments` (RPC call, `error.code` → HTTP status translation, never branching on `error.message`), `GET /api/patient/appointments`, and `/patient/appointments` with Upcoming/Past sections and derived status badges.
- Enabled the `Select this slot` CTA on `/doctors/[id]` with a client-side session gate (unauthenticated → `/login?from=`) and a `Confirm your appointment` dialog showing doctor, specialty, Jerusalem date/time, and location.
- Proved the whole path under real concurrency: two simultaneous bookings of the same slot resolve to exactly one `201` and one `409`, verified via `Promise.all` against two independent logged-in patient contexts.
- Found and fixed a genuine RLS gap that silently broke the feature (see Deviations below) — the booking route was returning `500` to every caller despite the booking itself succeeding server-side, because the patient could no longer read the slot they had just booked.

## Task Commits

Each task was committed atomically:

1. **Task 1 (checkpoint:decision) + Task 2: Author the appointment-functions migration and push it to the remote database** - `7441829` (feat) — committed in a prior session; verified still applied remotely (`20260810120000` in the remote column) before resuming.
2. **Task 3: TRACER — a patient books one slot end to end** - `05e7c58` (feat) — application code, the Rule 1 RLS-fix migration, and the 13-case Playwright spec.
3. **Rule 1 test fix** - `fbd0f03` (test) — updated a pre-existing Phase 3 test whose asserted contract Phase 5 deliberately supersedes.

**Plan metadata:** (pending — final docs commit follows this SUMMARY)

## Files Created/Modified

- `supabase/migrations/20260810120000_add_appointment_booking_functions.sql` - the three SECURITY DEFINER functions and grants (Task 2, prior session)
- `supabase/migrations/20260811070000_add_availability_slots_select_via_own_appointment.sql` - Rule 1 fix: additive RLS select policy so a patient can read the slot behind their own appointment
- `lib/auth/require-patient.ts` - `requirePatient()` guard mirroring `requireDoctor()`
- `lib/validation/appointments.ts` - `UUID_PATTERN`, `validateBookingInput`, `validateRescheduleInput`, `validateCancelInput`
- `lib/appointments.ts` - `AppointmentStatus`, `AppointmentLike`, `isCancelledStatus()`, `appointmentBadge()`, `splitAppointments()`
- `app/api/appointments/route.ts` - `POST` handler calling `book_appointment()`; exports the shared `PATIENT_APPOINTMENT_SELECT`
- `app/api/patient/appointments/route.ts` - `GET` handler, `.eq("patient_id", guard.userId)` restating RLS at the app layer
- `app/patient/appointments/page.tsx` - Upcoming/Past history page, exports `PatientAppointment`
- `app/doctors/[id]/page.tsx` - enabled booking CTA + confirmation dialog + client-side session gate
- `app/patient/page.tsx` - added a navigation link to `/patient/appointments`
- `tests/e2e/appointment-booking.spec.ts` - 13 cases covering APPT-01 through APPT-04, APPT-10/APPT-11, D-04, D-19, D-20, T-05-02, and the validation backstop
- `tests/e2e/doctor-profile.spec.ts` - updated the obsolete disabled-button test to assert the new enabled+redirect contract

## Decisions Made

- **Task 1 checkpoint (option-b, auto-selected under `workflow.auto_advance`):** revoke direct `INSERT` on `public.appointments` from `anon`/`authenticated`, forcing every appointment row through `book_appointment()`. This is what makes APPT-04's "booking marks the slot unavailable immediately" a real guarantee rather than one that only holds for callers who go through the route.
- **RPC signatures locked for downstream plans:**
  - `public.book_appointment(p_slot_id uuid) returns uuid` — raises `MR001` (slot unavailable), `MR003` (not a patient), `MR005` (no `auth.uid()`)
  - `public.reschedule_appointment(p_appointment_id uuid, p_new_slot_id uuid) returns uuid` — raises `MR001`, `MR002` (appointment no longer modifiable), `MR004` (not found/not owned), `MR005` — consumed by plan 05-04
  - `public.cancel_appointment(p_appointment_id uuid, p_reason text) returns text` — raises `MR002`, `MR004`, `MR005` — consumed by plans 05-02 and 05-05
- **SQLSTATE → HTTP mapping used by `POST /api/appointments`:** `MR001` → `409 { error: "This slot is no longer available. Please choose another." }`; `MR003`/`MR005` → `403 { error: "Not authorized." }`; anything else (including a null returned id) → `500 { error: "Could not book this appointment. Please try again." }`. The branch is strictly on the flat `error.code` string, never on `error.message`.
- **Shared patient select string** (exported as `PATIENT_APPOINTMENT_SELECT` from `app/api/appointments/route.ts`, imported by `app/api/patient/appointments/route.ts`):
  `"id, status, cancelled_reason, created_at, slot:availability_slots!inner(id,start_at,end_at,status), doctor:doctors(id,full_name)"` — deliberately no `patient:profiles` embed.
- **`PatientAppointment` type** (exported from `app/patient/appointments/page.tsx`, extended by plans 05-02/05-04):
  `{ id: string; status: AppointmentStatus; cancelled_reason: string | null; created_at: string; slot: { id: string; start_at: string; end_at: string; status: string } | null; doctor: { id: string; full_name: string } | null }`
- **`lib/appointments.ts` helper signatures** (single source for plans 05-01 and 05-03):
  - `type AppointmentStatus = "scheduled" | "confirmed" | "cancelled_by_patient" | "cancelled_by_doctor" | "completed" | "no_show"`
  - `isCancelledStatus(status: AppointmentStatus): boolean`
  - `appointmentBadge(status: AppointmentStatus, startAt: string, now?: number): { label: string; variant: "default" | "secondary" | "outline" }`
  - `splitAppointments<T extends AppointmentLike>(rows: T[], now?: number): { upcoming: T[]; past: T[] }`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `availability_slots` RLS silently broke the post-booking read and the entire patient appointment list**
- **Found during:** Task 3, first end-to-end verification pass (before any spec was run — a manual booking attempt returned `500`)
- **Issue:** `availability_slots_select_available_or_owner_or_admin` (Phase 1) only lets a non-owner, non-admin caller read a slot while `status = 'available'`. `POST /api/appointments`'s follow-up read and `GET /api/patient/appointments` both embed `availability_slots` via `slot:availability_slots!inner(...)`. Once `book_appointment()` flipped a slot to `booked`, the patient — who is neither the doctor-owner nor an admin — could no longer read that slot row through RLS. PostgREST's inner join then found zero rows the patient was allowed to see and silently excluded the whole appointment row, which `.single()` turned into an error. The booking RPC and the `INSERT` had already succeeded; only the follow-up read failed, so the route reported `500` to the client despite a real, correctly-flipped appointment existing in the database. The same gap meant `/patient/appointments` would have shown **zero** upcoming or past bookings for any appointment past `available`, silently breaking this plan's other primary deliverable.
- **Fix:** Added `supabase/migrations/20260811070000_add_availability_slots_select_via_own_appointment.sql` — one additive `select` policy: a patient may also read a slot referenced by any of their own `appointments` rows (any status), independent of the existing `status = 'available'` rule. Applied and pushed to the remote database (confirmed via `npx supabase migration list`).
- **Files modified:** `supabase/migrations/20260811070000_add_availability_slots_select_via_own_appointment.sql`
- **Verification:** `tests/e2e/appointment-booking.spec.ts` cases 1, 3, 5, 8, 11 all depend on this fix and pass; full suite (250/250) green afterward.
- **Committed in:** `05e7c58` (Task 3 commit)

**2. [Rule 1 - Bug] Phase 3's `doctor-profile.spec.ts` asserted a now-obsolete stub contract**
- **Found during:** Full-suite verification run required by this plan's `<verification>` section
- **Issue:** `tests/e2e/doctor-profile.spec.ts` had a test asserting every `Select this slot` control stayed `disabled` and that force-clicking it issued no request — the Phase 3 stub contract. This plan's D-01 explicitly supersedes that: the button is now enabled and the "not available yet" paragraph is removed.
- **Fix:** Rewrote the test to assert the new D-01/D-04 contract: the control is enabled, and an anonymous click redirects to `/login?from=<path>` with no `/api/appointments` request and no dialog opened (the same behavior independently covered end to end in `tests/e2e/appointment-booking.spec.ts` case 10).
- **Files modified:** `tests/e2e/doctor-profile.spec.ts`
- **Verification:** Full suite re-run, 250/250 passing.
- **Committed in:** `fbd0f03`

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bug fixes)
**Impact on plan:** Both fixes were necessary for the plan's stated deliverables to function at all (booking success and the patient's own appointment history). No scope creep — no new tables, no new API surface beyond what the plan specified.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-rls-surface | `supabase/migrations/20260811070000_add_availability_slots_select_via_own_appointment.sql` | Adds a new `availability_slots` select policy not present in the plan's original `<threat_model>` register. Scope: a patient may read the full `availability_slots` row (including a nullable `reason` column) for any slot referenced by one of their own `appointments` rows, regardless of current status or who currently holds the slot. In practice this is a narrow surface: (1) the policy predicate is `patient_id = auth.uid()`, so it never grants access to another patient's slots; (2) `reason` is only ever populated by a doctor on a `blocked`-status row, never on a slot that ever became `booked`, so a patient's own appointment's slot has `reason = null` in every reachable case; (3) neither application-level select (`PATIENT_APPOINTMENT_SELECT`) requests `reason`, so no disclosure occurs through the API surface even if the column were populated. Residual consideration: a patient retains read access to a slot's current `start_at`/`end_at`/`status` indefinitely after their own appointment is cancelled, even if the slot is later rebooked by a different patient — this exposes only the doctor's own public-schedule-shaped data (already visible to any anonymous visitor while the slot is `available`), not any other patient's identity or data. |

## Issues Encountered

- The full Playwright suite (250 tests, `workers: 1`) takes roughly 20-25 minutes to run serially — required twice in this session (once to discover the `doctor-profile.spec.ts` regression, once to confirm the fix), consuming most of the wall-clock time in this resumed session.
- A stray `npm run dev` process started during manual debugging (outside Playwright's own `webServer` lifecycle) was left running and reused by `reuseExistingServer: true` for all subsequent `npx playwright test` invocations — harmless, but worth noting for anyone inspecting process lists during a similar debugging session.

## User Setup Required

None - no external service configuration required beyond the `SUPABASE_ACCESS_TOKEN` already established in prior phases (used only for the `npx supabase db push` calls, both of which succeeded).

## Next Phase Readiness

- `book_appointment()` is proven correct under real concurrency, past-slot rejection, inactive-doctor rejection, and role/ownership guards — the phase's core anti-double-booking guarantee holds.
- `reschedule_appointment()` and `cancel_appointment()` are deployed and unit-provable via direct RPC calls but have no route or UI yet — plans 05-02 (cancel), 05-04 (reschedule) build directly against the locked signatures and SQLSTATE codes recorded above.
- `lib/appointments.ts` and the `PatientAppointment` type are the explicit shared contract plan 05-03 (doctor-side history) must extend, not redefine.
- No known stubs. Every route, page, and RPC call built in this plan is production-quality with real data — no placeholder or mock data path exists anywhere in the new code.

---
*Phase: 05-appointment-booking-lifecycle*
*Completed: 2026-08-11*

## Self-Check: PASSED

All 13 claimed files found on disk. All 3 claimed commit hashes (`7441829`, `05e7c58`, `fbd0f03`) found in git history.
