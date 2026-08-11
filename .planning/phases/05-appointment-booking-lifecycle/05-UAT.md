---
status: complete
phase: 05-appointment-booking-lifecycle
source: [05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md, 05-05-SUMMARY.md]
started: 2026-08-11T15:40:14Z
updated: 2026-08-11T15:48:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server/service. Clear ephemeral state (temp DBs, caches, lock files). Start the application from scratch. Server boots without errors, any seed/migration completes, and a primary query (health check, homepage load, or basic API call) returns live data.
result: pass

### 2. [D1] book_appointment/reschedule_appointment/cancel_appointment deployed as SECURITY DEFINER functions, execute revoked from public
expected: book_appointment()/reschedule_appointment()/cancel_appointment() deployed as SECURITY DEFINER functions with execute revoked from public and granted to authenticated; Task 1's insert-privilege decision (option-b) applied
result: pass
source: automated
coverage_id: D1

### 3. [D2] Patient books an available slot end to end
expected: A patient books an available future slot from a doctor's public profile through a confirmation dialog and lands on /patient/appointments seeing it under Upcoming with a Confirmed badge
result: pass
source: automated
coverage_id: D2

### 4. [D3] Concurrent double-booking guarantee
expected: Two concurrent bookings of the same slot resolve to exactly one 201 and one 409, with exactly one non-cancelled appointment row
result: pass
source: automated
coverage_id: D3

### 5. [D4] Booking a past slot is rejected
expected: A slot whose start_at has already passed is rejected with the generic slot message and no appointment row is created
result: pass
source: automated
coverage_id: D4

### 6. [D5] Booking flips slot to booked immediately
expected: A successful booking flips the slot to booked in the same statement that verified availability, and the slot disappears from the doctor's public availability immediately
result: pass
source: automated
coverage_id: D5

### 7. [D6] Patient appointments page renders Upcoming/Past
expected: /patient/appointments renders Upcoming/Past sections scoped to the session patient, with Confirmed/Past/Cancelled badges derived at render time
result: pass
source: automated
coverage_id: D6

### 8. [D7] Patient Past section covers elapsed and cancelled appointments
expected: A patient's Past section correctly shows both elapsed non-cancelled appointments (Past badge) and cancelled appointments (real cancellation status), including a cancelled appointment whose slot is still in the future
result: pass
source: automated
coverage_id: D7

### 9. Booking confirmation & appointment list visual quality
expected: |
  Visual/UX quality of the booking confirmation dialog and appointment list — clean in both LTR/RTL, all controls keyboard-reachable, long location text wraps rather than clipping, no fixed-height clipping of list rows.
result: pass

### 10. [D1] Cancel route delegates entirely to cancel_appointment()
expected: PATCH /api/appointments/[id]/cancel delegates entirely to cancel_appointment(), performs no direct appointments/availability_slots write, and maps MR002->409/MR004->404/MR005->401 using the UI-SPEC copy
result: pass
source: automated
coverage_id: D1

### 11. [D2] Patient cancels own upcoming appointment
expected: A patient cancels their own upcoming appointment through the confirmation dialog (optional untrimmed reason); the row survives with status=cancelled_by_patient, a byte-identical reason, and re-renders under Past with a Cancelled by patient badge and no action buttons
result: pass
source: automated
coverage_id: D2

### 12. [D3] Cancelling releases the slot and it is re-bookable
expected: Cancelling an appointment releases its slot back to available in the same transaction, and the freed slot is genuinely re-bookable by a different patient
result: pass
source: automated
coverage_id: D3

### 13. [D4] Elapsed/already-cancelled appointment rejected
expected: An elapsed or already-cancelled appointment is rejected with 409 "This appointment can no longer be cancelled." and the stored reason from a prior cancellation is never overwritten
result: pass
source: automated
coverage_id: D4

### 14. [D5] Non-oracle 404 and clean guard rejection
expected: A foreign appointment id and a nonexistent appointment id return byte-identical 404 bodies; anonymous/malformed/oversized/non-JSON requests are rejected cleanly before any RPC call
result: pass
source: automated
coverage_id: D5

### 15. [D6] Cancel control only on eligible rows
expected: Only an upcoming, non-cancelled appointment row exposes a Cancel appointment control; past and cancelled rows render no action button at all
result: pass
source: automated
coverage_id: D6

### 16. Cancellation dialog visual quality
expected: |
  Visual/UX quality of the cancellation dialog — destructive emphasis on Cancel appointment, "Keep appointment" reads as the visually subordinate dismiss action, dismissible by keyboard, and the reason field never suggests medical content.
result: pass

### 17. [D1] Doctor appointments endpoint scoped to own patients, minimized fields
expected: GET /api/doctor/appointments returns only the session doctor's own appointments, scoped by requireDoctor()'s resolved doctorId, with the joined slot and the patient's name only (no email, no slot reason)
result: pass
source: automated
coverage_id: D1

### 18. [D2] Doctor page mirrors patient page's Upcoming/Past split
expected: A doctor loading /doctor/appointments sees Upcoming/Past sections computed by the same splitAppointments() helper as the patient page, with matching badge wording, including a cancelled-but-future appointment correctly placed under Past
result: pass
source: automated
coverage_id: D2

### 19. [D3] Doctor appointments page guards, nav, empty state
expected: A logged-in doctor reaches /doctor/appointments from a nav control on /doctor; an unauthenticated visit redirects to /login; a patient calling the doctor endpoint gets 403 and vice versa; loading/error/empty states render per UI-SPEC; no reschedule or attendance control exists on the doctor page
result: pass
source: automated
coverage_id: D3

### 20. Doctor appointments page visual quality
expected: |
  Visual/UX quality of /doctor/appointments — clean in both LTR/RTL, all controls keyboard-reachable, no fixed-height clipping, and Israel-local day/time formatting reads correctly.
result: pass

### 21. [D1] Patient reschedules through the day-grouped picker
expected: A patient moves an upcoming appointment to another of the same doctor's available future slots through the day-grouped picker; the dialog closes, the status region announces success, and the row re-renders at its new Jerusalem time
result: pass
source: automated
coverage_id: D1

### 22. [D2] Reschedule updates the row in place, never duplicates it
expected: The appointment row keeps its identity (id unchanged) and its slot_id is updated in place; no second appointment row is ever created for the same booking
result: pass
source: automated
coverage_id: D2

### 23. [D3] Reschedule is atomic under concurrency, no orphaned slot
expected: After a successful reschedule the old slot is available and the new slot is booked, with no observable instant in which neither is held, and no orphaned booked slot left behind under real concurrency against a competing booking of the freed slot
result: pass
source: automated
coverage_id: D3

### 24. [D4] Rejected reschedule releases nothing
expected: A rejected reschedule (target slot just taken by a second patient) leaves nothing released — the original slot stays booked and the appointment untouched, proving the reserve-before-release ordering
result: pass
source: automated
coverage_id: D4

### 25. [D5] Full D-10 rejection matrix produces locked messages
expected: All six rejection conditions (past slot, blocked slot, already-booked slot, wrong-doctor slot, cancelled appointment, elapsed appointment) produce exactly one of two locked messages, with no side effect on either row
result: pass
source: automated
coverage_id: D5

### 26. [D6] Deactivated-doctor slot, non-oracle 404, non-patient refused
expected: A slot belonging to a deactivated doctor is refused; a foreign appointment id is indistinguishable from a missing one; a non-patient (doctor, anonymous) is refused at the API, and the doctor page carries no reschedule control anywhere
result: pass
source: automated
coverage_id: D6

### 27. [D7] Reschedule control only on eligible rows
expected: Only an upcoming, non-cancelled row exposes the Reschedule control; an elapsed row and a cancelled row expose neither it nor Cancel
result: pass
source: automated
coverage_id: D7

### 28. 40P01 deadlock-abort branch reachability (source inspection)
expected: |
  In app/api/appointments/[id]/reschedule/route.ts, confirm the 40P01 branch (deadlock-abort -> clean retryable 409) appears in the error-mapping chain BEFORE the generic 500 fallback, so a genuine circular-slot-swap deadlock is translated to a retryable 409 rather than an unhandled 500. (Not exercised at runtime — reproducing a real Postgres deadlock needs two transactions to interleave inside a sub-second window, which would be inherently flaky; verify by reading the source.)
result: pass
reason: "Verified by source inspection: 40P01 branch at line 88 precedes the generic 500 fallback at line 103."

### 29. Reschedule picker visual quality
expected: |
  Visual/UX quality of the reschedule picker — clean in both LTR/RTL, all controls keyboard-reachable, long day/slot lists scroll cleanly, and the Reschedule control reads as clearly subordinate to the destructive Cancel control.
result: pass

### 30. [D1] Doctor cancel control only on eligible rows
expected: An upcoming, non-cancelled row on /doctor/appointments renders a destructive Cancel appointment button (min-h-11); a past or cancelled row renders no action button at all
result: pass
source: automated
coverage_id: D1

### 31. [D2] Doctor cancel dialog mirrors patient's, shared route
expected: The doctor's cancellation dialog mirrors the patient's contract exactly (title, warning copy, optional untrimmed Reason textarea, Keep appointment / Cancel appointment footer with Cancelling… in-flight label) and submits to the same shared PATCH /api/appointments/[id]/cancel route — no doctor-specific endpoint
result: pass
source: automated
coverage_id: D2

### 32. [D3] Doctor cancel sets cancelled_by_doctor, survives, badge matches
expected: A doctor cancelling an appointment they own sets status to cancelled_by_doctor (decided from auth.uid(), never client input) with a byte-identical reason round-trip, and the row survives — never deleted — in both parties' history showing the identical Cancelled by doctor badge
result: pass
source: automated
coverage_id: D3

### 33. [D4] Doctor cancellation releases the slot and it is re-bookable
expected: A doctor's cancellation releases the linked slot back to available in the same transaction, and the freed slot is genuinely re-bookable by a different patient
result: pass
source: automated
coverage_id: D4

### 34. [D5] Acting party decided by session, never by client body field
expected: The acting party recorded on a cancellation is decided by the session, never by a contradicting field the client includes in the request body — proven in both directions (patient body naming the doctor, doctor body naming the patient)
result: pass
source: automated
coverage_id: D5

### 35. [D6] Cross-doctor cancel gets the same 404 as a missing id
expected: A doctor cancelling another doctor's appointment receives the same 404 body as a nonexistent id, with the other doctor's row unmodified
result: pass
source: automated
coverage_id: D6

### 36. [D7] Elapsed/already-cancelled rejected on the doctor path too
expected: A doctor's cancel request for an elapsed appointment, or a second cancel of an already-cancelled one, returns 409 with the locked copy and never overwrites the first stored reason
result: pass
source: automated
coverage_id: D7

### 37. Doctor's cancellation dialog visual quality
expected: |
  Visual/UX quality of the doctor's cancellation dialog — identical wording/shape to the patient's, "Keep appointment" as the visually subordinate dismiss, dismissible by keyboard, and nothing on the page invites recording attendance or a message the patient will read.
result: pass

## Summary

total: 37
passed: 37
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

<!-- none yet -->
