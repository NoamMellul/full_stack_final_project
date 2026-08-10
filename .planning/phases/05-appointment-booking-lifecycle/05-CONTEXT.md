# Phase 5: Appointment Booking & Lifecycle - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Patients book, cancel, and reschedule appointments with doctors through a complete flow, with an absolute, database-enforced guarantee that two patients can never book the same slot. This phase activates the previously-disabled "Select this slot" CTA on the public doctor profile (Phase 3), builds the booking/cancel/reschedule API surface on top of the existing `appointments` table and its anti-double-booking unique index (Phase 1), and ships `/patient/appointments` and `/doctor/appointments` history pages. It covers APPT-01 through APPT-13 exclusively. Payments, real email/SMS, medical notes/records, waiting lists, recurring appointments, cross-doctor rescheduling, cancellation fees, and automatic no-show detection are explicitly out of scope. Notification *rows* are created here (ties into Phase 6's display/read UI) but their UI is not built in this phase.

</domain>

<decisions>
## Implementation Decisions

### Booking entry point & confirmation
- **D-01:** The existing disabled "Select this slot" button on `/doctors/[id]` (`app/doctors/[id]/page.tsx:212-214`, from Phase 3) becomes the real booking entry point — enabled, wired to open a confirmation modal instead of a new dedicated page.
- **D-02:** Confirmation modal shows doctor name, specialty, appointment date, appointment time, and location (address/neighborhood), all in `Asia/Jerusalem`, before the booking is created. Patient must explicitly confirm.
- **D-03:** On successful booking: create the `appointments` row and atomically flip the slot to `booked` (single transaction/RPC — see D-11), then redirect the patient to `/patient/appointments` and show a success message there ("Your appointment has been booked successfully."). No separate dedicated booking-confirmation page/route.
- **D-04:** If an unauthenticated visitor clicks "Select this slot," redirect to login; return them to the doctor/slot they were booking afterward if this is reasonably simple with the existing `proxy.ts`/`?from=` redirect pattern (established in Phase 1, `01-CONTEXT.md`) — **Reversibility:** reversible — if the return-to-slot handoff turns out non-trivial, falling back to a plain post-login redirect to the doctor's profile (losing only the pre-selected slot) is an acceptable, easily-shipped degradation; no data model or contract is at stake either way.
- **D-05:** The booking endpoint must re-verify slot availability against the database at request time — never trust that a slot is available just because the client-rendered profile page showed it as such (the profile page's slot list can be stale by the time the request lands).

### Reschedule flow & scope
- **D-06:** Rescheduling is constrained to the **same doctor** as the original appointment. Moving to a different doctor is explicitly NOT a reschedule — the user cancels the existing appointment and books a new one with the other doctor as two separate actions. The reschedule endpoint must reject a `newSlotId` belonging to any doctor other than `appointments.doctor_id`.
- **D-07:** Reschedule starts from `/patient/appointments`: an upcoming appointment gets a "Reschedule" action that opens a modal/drawer listing that same doctor's currently available future slots (reusing the existing availability-fetch pattern from Phase 3/4, scoped to `doctor_id` + `status = 'available'` + future `start_at`).
- **D-08:** Reschedule keeps the same `appointments` row identity — update `slot_id` in place (matching TASKS.md's own wording), never create a second appointment row for the same booking. No new reschedule-history/audit table is added this phase; if a later phase wants a reschedule audit trail, that's an additive table, not a redesign.
- **D-09:** The reschedule operation is one atomic business operation: verify the new slot is still available, then release the old slot and reserve the new slot and update the appointment in the same transaction — the old slot must never be visibly released before the new slot is confirmed secured (no window where neither slot is held).
- **D-10:** Reschedule must reject: a new slot in the past, a `blocked` new slot, an already-`booked` new slot, a new slot belonging to another doctor (D-06), an already-cancelled appointment, or an appointment whose `start_at` has already passed.

### Booking/reschedule atomicity mechanism
- **D-11:** Both booking and reschedule are implemented as single-transaction Postgres functions (per TASKS.md's `book_appointment(slot_id, patient_id)`), called via RPC from the route handler — matching Phase 4's established "the DB constraint is the real guarantee, the app layer translates the error" philosophy (`04-CONTEXT.md`). Exact locking mechanism (`SELECT ... FOR UPDATE` vs relying purely on `appointments_active_slot_unique_idx` + `availability_slots.status` update racing safely) is Claude's/the researcher's discretion at planning time — this is a technical implementation choice, not a product decision.

### Cancellation
- **D-12:** Both the patient who booked it and the owning doctor can cancel an upcoming appointment (matches existing RLS `appointments_update_own_or_admin`). Cancellation is allowed at any time before `start_at`; once `start_at` has passed, the normal cancellation flow no longer applies (no minimum-notice/grace-period policy — deliberately as simple as Phase 4's unrestricted slot deletion).
- **D-13:** Cancellation reason is optional free text, stored in the existing `appointments.cancelled_reason` column, entered via a confirmation modal (warning text + optional reason field + confirm button) shown to whichever party is cancelling.
- **D-14:** Status is set to `cancelled_by_patient` or `cancelled_by_doctor` depending on who cancelled. The `appointments` row is never deleted — cancelled appointments remain in history for both parties.
- **D-15:** Cancelling releases the linked `availability_slots` row back to `available`, but only if it's still in the future (a slot behind a cancelled past appointment doesn't need to reappear as bookable — Claude's discretion on the exact edge-case handling if this ever comes up, since a cancellable appointment by definition has a future `start_at` per D-12).

### Past-appointment status display
- **D-16:** No automatic DB status transition to `completed`/`no_show` in this phase — the system cannot know whether the patient actually attended. `appointments.status` stays `scheduled`/`confirmed` unless an explicit cancellation action changes it.
- **D-17:** The UI derives a "Past" (or "Past appointment") label whenever `start_at < now` AND status is still `scheduled`/`confirmed` — this is presentation-only, never written back to the DB. Cancelled appointments always display their real cancellation status (`cancelled_by_patient`/`cancelled_by_doctor`), never overridden by the "Past" label. Example from the discussion: upcoming shows "Aug 20, 10:00 — Confirmed"; an elapsed-but-never-cancelled one shows "Aug 5, 14:00 — Past"; a cancelled one shows "Aug 3, 09:00 — Cancelled by patient."
- **D-18:** Upcoming/past split on both `/patient/appointments` and `/doctor/appointments` is computed purely from `start_at` vs current time (per TASKS.md items 5/6), not from a status field — consistent with D-16/D-17.

### Access & scope guardrails (reaffirmed, not new — already implied by RLS/roadmap, restated explicitly by the user)
- **D-19:** Only authenticated patients can book; doctors and admins do not book through the patient booking flow. A patient cannot book a slot belonging to an inactive (`is_active = false`) doctor.
- **D-20:** A patient can only view/manage their own appointments; a doctor can only view/manage appointments where they are the owning doctor (existing `appointments_select_own_or_admin` / `appointments_update_own_or_admin` RLS already enforces this — app-level checks are defense-in-depth, matching the Phase 4 pattern). Admin read access (`app/api/admin/appointments`) already exists from Phase 2 and is unaffected; admin is not expected to use the patient/doctor lifecycle actions (book/cancel/reschedule) built in this phase unless a later requirement explicitly asks for it.
- **D-21:** All date/time logic in this phase's new code uses `Asia/Jerusalem` for display/input, converted to/from UTC via the existing `lib/timezone.ts` helpers — no new timezone logic invented (matches D-12 from `04-CONTEXT.md`).

### Claude's Discretion
- Exact Postgres function signature/locking strategy for `book_appointment`/reschedule (D-11) — `SELECT ... FOR UPDATE` vs relying on the unique index + status check; whichever the researcher determines is more robust under Phase 4's already-proven concurrency-testing pattern (`doctor-schedule-overlap.spec.ts` precedent).
- Exact styling/wording of the "Past" label (D-17), the booking success message (D-03), and the cancellation confirmation modal copy (D-13).
- Exact shape of the new-slot picker for reschedule (D-07) — modal vs drawer, any shadcn primitive consistent with the project's established component usage.
- Whether the login-redirect-and-return flow (D-04) preserves the specific pre-selected slot or just returns to the doctor's profile — implementer's call based on what `proxy.ts`'s existing `?from=` mechanism supports without new infrastructure.
- Exact content/copy of the `notifications` rows created on booking/cancel/reschedule (the insert happens this phase per TASKS.md item 2; the notification UI itself is Phase 6).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level context
- `.planning/PROJECT.md` — full product context, Key Decisions, Constraints (REST/no-Zod/Playwright-only/i18n/UI/timezone), and the standing invariant "DB-level guaranteed anti-double-booking" as the project's core value proposition
- `.planning/REQUIREMENTS.md` — APPT-01 through APPT-13 requirement text
- `.planning/ROADMAP.md` — Phase 5 goal, success criteria, dependency chain (depends on Phase 3, Phase 4)
- `.planning/phases/05-appointment-booking-lifecycle/TASKS.md` — the user's own hand-written route/function/page/test breakdown for this phase; treat as a detailed reference outline, not a substitute for planning — this CONTEXT.md's decisions (especially D-06 through D-10 on reschedule scope, and D-16/D-17 on status display) refine and take precedence where TASKS.md is silent or ambiguous

### Database (ALREADY APPLIED — see code_context below; no new migration anticipated, but verify at planning time)
- `supabase/migrations/20260803230000_initial_schema.sql` — `appointments` table (status check: `scheduled`/`confirmed`/`cancelled_by_patient`/`cancelled_by_doctor`/`completed`/`no_show`; `cancelled_reason` nullable text; `slot_id`/`patient_id`/`doctor_id` FKs), `appointments_active_slot_unique_idx` (the partial unique index — "at most one active (non-cancelled) appointment per slot" — this IS the DB-level anti-double-booking guarantee TASKS.md references), `notifications` table (server-side-only inserts, no user insert policy), RLS policies `appointments_select_own_or_admin` / `appointments_insert_patient` / `appointments_update_own_or_admin`, and an explicit code comment at line 244-245 noting booking goes through a `book_appointment()` function "added in Phase 5."

### Prior phase context
- `.planning/phases/04-doctor-availability-management/04-CONTEXT.md` — D-10/D-11 (the `availability_slots_no_overlap` exclusion constraint and generic-error-translation pattern this phase's booking/reschedule logic must respect when touching `availability_slots.status`), D-12 (timezone conversion pattern), the "DB constraint is the real guarantee, app layer translates the error" philosophy this phase continues
- `.planning/phases/03-doctor-discovery-search-public-profiles/03-CONTEXT.md` — D-18 (the disabled "Select this slot" CTA this phase activates, per D-01 above), D-08 (availability-slot semantics `status = 'available'` that booking must consume correctly so search stays accurate after a booking)
- `.planning/phases/01-foundation-database-schema-authentication/01-CONTEXT.md` — REST routes / manual validation conventions this phase continues; `proxy.ts` `?from=` redirect mechanism relevant to D-04

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/timezone.ts` — `jerusalemWallClockToUtc`/`formatJerusalemTime`/day-grouping helpers, direct fit for the confirmation modal (D-02) and appointment list displays (D-17/D-18).
- `app/doctors/[id]/page.tsx:212-214` — the exact disabled `<Button disabled>Select this slot</Button>` this phase enables and wires to the new booking flow (D-01); the surrounding slot-list rendering is the template for the reschedule new-slot picker (D-07).
- `lib/auth/require-doctor.ts` — the `requireDoctor()` pattern (resolves `doctors.profile_id = auth.uid()`) to mirror for a new `lib/auth/require-patient.ts` (or equivalent), since no patient-role guard helper exists yet — only `require-admin.ts` and `require-doctor.ts` exist in `lib/auth/`.
- `app/api/admin/appointments/route.ts` — existing `APPOINTMENT_SELECT` join shape (`slot:availability_slots!inner(...)`, `doctor:doctors(...)`, `patient:profiles(...)`) and `VALID_STATUSES` array are directly reusable/adaptable for the new patient- and doctor-scoped appointment list endpoints (D-18's upcoming/past split can reuse the same join).
- `app/patient/layout.tsx`, `app/patient/page.tsx` — existing patient role-guard layout and placeholder dashboard; `/patient/appointments` lands as a sibling page under this existing structure.
- `app/doctor/(gated)/` — existing gated-group convention (schedule page already lives here from Phase 4); `/doctor/appointments` should follow the same `(gated)` pattern.

### Established Patterns
- REST route handlers at `app/api/.../route.ts` with manual validation functions — this phase adds the first `app/api/appointments/*` and `app/api/patient/*` routes; `app/api/doctor/appointments` joins the existing `app/api/doctor/slots`, `app/api/doctor/blocked-periods` sibling routes.
- Postgres error-code translation established in Phase 4 (`23P01` → generic overlap message) is the direct precedent for translating `book_appointment()`'s "slot no longer available" failure into a clean API error (TASKS.md item 2's "Maps DB errors ... to clear API error responses").
- RLS already enforces ownership on `appointments` (`appointments_select_own_or_admin`, `appointments_update_own_or_admin`) — API routes on the session-bound client inherit this; app-level ownership checks are still expected as defense-in-depth per the Phase 4 precedent (D-20 above).

### Integration Points
- New pages: `/patient/appointments` (under existing `app/patient/`), `/doctor/appointments` (under existing `app/doctor/(gated)/`).
- New routes (per TASKS.md, refined by this CONTEXT.md): `POST /api/appointments` (book), `PATCH /api/appointments/[id]/cancel`, `PATCH /api/appointments/[id]/reschedule`, `GET /api/patient/appointments`, `GET /api/doctor/appointments`.
- New DB function: `book_appointment(slot_id, patient_id)` (or equivalent transactional RPC also covering reschedule per D-11).
- Touches `availability_slots.status` (available ↔ booked) on every booking/cancel/reschedule — must not violate the `availability_slots_no_overlap` exclusion constraint or Phase 4's established status semantics.
- Does NOT touch: `app/api/admin/*` (existing admin read-only appointments view is unaffected), Phase 3 search/profile read paths beyond what naturally follows from `availability_slots.status` changing, notification *display* UI (Phase 6 — only the row insert happens here).

</code_context>

<specifics>
## Specific Ideas

The user provided complete, explicit business rules for this phase in one detailed answer — captured verbatim as decisions D-01 through D-21 above. Notably:
- Explicit worked example for the confirmation modal contents (D-02): doctor name, specialty, date, time, location.
- Explicit worked example for past-appointment display (D-17): "Aug 20, 10:00 — Confirmed" (upcoming) / "Aug 5, 14:00 — Past" (elapsed, DB status unchanged) / "Aug 3, 09:00 — Cancelled by patient" (cancelled).
- Explicit instruction that reschedule must never have a window where neither the old nor the new slot is held (D-09) — the "temporarily release old slot" anti-pattern was called out and explicitly forbidden.
- Explicit exhaustive reschedule-rejection list (D-10): past slot, blocked slot, already-booked slot, other-doctor slot, already-cancelled appointment, already-elapsed appointment.
- Explicit confirmation that Phase 5's out-of-scope list matches the roadmap: no payments, no real email/SMS, no medical notes/records, no waiting lists, no recurring appointments, no cross-doctor reschedule, no cancellation fees, no automatic no-show detection.

</specifics>

<deferred>
## Deferred Ideas

- **Reschedule audit/history trail** (a record of what an appointment's slot used to be before each reschedule) — user explicitly asked to keep this simple: update the existing appointment's `slot_id` in place, no new table this phase (D-08). Worth reconsidering only if a future requirement explicitly needs "show me this appointment's reschedule history."
- **Doctor-initiated completed/no-show marking** — user explicitly deferred any real completed/no-show lifecycle to a future explicit doctor action or separate business rule (D-16); not attempted this phase.
- **Cross-doctor rescheduling** — explicitly ruled out as not being "a reschedule" at all (D-06); if ever wanted, it's cancel + new booking, already fully supported by this phase's booking flow with no new capability needed.

### Reviewed Todos (not folded)
None — `todo.match-phase` returned zero matches for Phase 5.

</deferred>

---

*Phase: 5-appointment-booking-lifecycle*
*Context gathered: 2026-08-10*
