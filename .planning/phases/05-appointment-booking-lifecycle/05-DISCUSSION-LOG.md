# Phase 5: Appointment Booking & Lifecycle - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-10
**Phase:** 5-appointment-booking-lifecycle
**Areas discussed:** Booking entry point & confirmation, Reschedule flow & scope, Cancellation reason & notice policy, Past-appointment status display, Additional lifecycle rules, Phase scope confirmation

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Booking entry point & confirmation | Activating the Phase 3 disabled "Select this slot" CTA; modal vs redirect after booking | ✓ |
| Reschedule flow & scope | Same-doctor-only vs cross-doctor; where the new-slot picker lives | ✓ |
| Cancellation reason & notice policy | Optional reason capture; minimum-notice restriction | ✓ |
| Past-appointment status display | Raw DB status vs derived UI label for elapsed appointments | ✓ |

**User's choice:** Selected all four areas, then answered all of them (plus additional lifecycle rules and an explicit phase-scope confirmation) in a single comprehensive free-text response rather than working through them one at a time via further AskUserQuestion turns.

---

## Booking entry point & confirmation

**User's answer:** The existing disabled "Select this slot" CTA on the public doctor profile becomes the real booking entry point. Flow: patient opens profile → selects slot → confirmation modal (doctor name, specialty, date, time, location) → confirm → atomic booking + slot flips unavailable → redirect to `/patient/appointments` with a success message. No separate dedicated confirmation page. If unauthenticated, redirect to login and return to the doctor/slot flow if reasonably simple with the existing architecture. Server-side availability must always be re-verified at booking time — never trust the client-rendered slot list.

**Captured as:** D-01 through D-05 in `05-CONTEXT.md`.

---

## Reschedule flow & scope

**User's answer:** Reschedule must stay with the same doctor — changing doctor is cancel + new booking, not a reschedule. Starts from `/patient/appointments`; "Reschedule" action opens a modal/drawer of that doctor's currently available future slots. Operation is atomic: verify new slot still available, release old, reserve new, update the existing appointment (never create a duplicate row), never leave a window where neither slot is held. Explicit rejection list: past slot, blocked slot, already-booked slot, another doctor's slot, already-cancelled appointment, already-elapsed appointment.

**Captured as:** D-06 through D-10 in `05-CONTEXT.md`.

---

## Cancellation reason & notice policy

**User's answer:** Both patient and doctor can cancel any time before the appointment's start; no minimum-notice policy (deliberately kept simple, matching Phase 4's unrestricted slot deletion). Cancellation reason is optional free text, captured via a confirmation modal (warning + optional reason + confirm), stored in the existing `appointments.cancelled_reason` column. Status set to `cancelled_by_patient`/`cancelled_by_doctor`. Appointment rows are never deleted — history is preserved. The slot becomes available again if it's still in the future.

**Captured as:** D-12 through D-15 in `05-CONTEXT.md`.

---

## Past-appointment status display

**User's answer:** No automatic transition to `completed`/`no_show` this phase — the system can't know actual attendance, so the DB status stays `scheduled`/`confirmed` unless an explicit cancellation changes it. The UI derives a "Past"/"Past appointment" label whenever `start_at < now` and status is still active — presentation-only, never written to the DB. Cancelled appointments always show their real cancellation status, never overridden by "Past."

**Captured as:** D-16 through D-18 in `05-CONTEXT.md`.

---

## Additional lifecycle rules (volunteered, not a separate selected area)

**User's answer:** Reaffirmed a set of cross-cutting rules already implied by the roadmap/RLS but stated explicitly: only authenticated patients book (not doctors/admins via this flow); one active appointment per slot enforced at DB/server level; booking is atomic; can't book an inactive doctor; all dates in Asia/Jerusalem; strict per-role appointment access scoping (patient/doctor/admin); cancellation never hard-deletes; reschedule keeps the same appointment identity, no new audit table unless trivial — explain the simplest approach if one is warranted.

**Captured as:** D-11, D-19 through D-21, and a note in Claude's Discretion re: notification-row content, in `05-CONTEXT.md`.

---

## Phase scope confirmation

**User's answer:** Confirmed Phase 5 covers booking, confirmation, patient/doctor upcoming appointments, appointment detail, patient/doctor cancellation, same-doctor patient rescheduling, appointment history, lifecycle status presentation, double-booking protection, and authorization — and explicitly reaffirmed the roadmap's out-of-scope list (payments, real email/SMS, medical notes, prescriptions, medical records, waiting lists, recurring appointments, cross-doctor reschedule, cancellation fees, automatic no-show detection).

**Notes:** This matches `ROADMAP.md`'s Phase 5 goal and success criteria and `PROJECT.md`'s Out of Scope section exactly — no scope creep, nothing needed to be redirected to a deferred idea.

---

## Claude's Discretion

- Exact Postgres function signature/locking strategy for `book_appointment`/reschedule (D-11).
- Exact styling/wording of the "Past" label, booking success message, and cancellation confirmation modal copy.
- Exact shape of the reschedule new-slot picker (modal vs drawer).
- Whether the login-redirect-and-return flow preserves the specific pre-selected slot or just returns to the doctor's profile.
- Exact content/copy of the `notifications` rows created on booking/cancel/reschedule (row insert only — UI is Phase 6).

## Deferred Ideas

- Reschedule audit/history trail — explicitly deferred; simplest approach (update `slot_id` in place, no new table) adopted instead (D-08).
- Doctor-initiated completed/no-show marking — explicitly deferred to a future explicit action or business rule (D-16).
- Cross-doctor rescheduling — explicitly ruled out as a "reschedule" concept entirely (D-06); already achievable today as cancel + new booking, no new capability needed.
