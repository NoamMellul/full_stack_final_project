# Phase 5: Appointment Booking & Lifecycle

**Goal**: Patients can book, cancel, and reschedule appointments through a complete booking flow, with an absolute, database-enforced guarantee that two patients can never book the same slot — the core value proposition of the platform.

**Depends on**: Phase 3, Phase 4

**Requirements covered**: APPT-01, APPT-02, APPT-03, APPT-04, APPT-05, APPT-06, APPT-07, APPT-08, APPT-09, APPT-10, APPT-11, APPT-12, APPT-13

## Tasks

### 1. `book_appointment(slot_id, patient_id)` Postgres function
- [ ] Runs in a single transaction
- [ ] Locks/checks the slot row (`SELECT ... FOR UPDATE` or relies on the partial unique index from Phase 1)
- [ ] Verifies the slot is `status = 'available'` and `start_at` is in the future
- [ ] Updates `availability_slots.status = 'booked'`
- [ ] Inserts the `appointments` row (`status = 'scheduled'`)
- [ ] Returns an error/exception if the slot is no longer available (caught by the API route)

### 2. `POST /api/appointments` — book
- [ ] Manual validation of `slot_id`
- [ ] Calls `book_appointment` via RPC
- [ ] Maps DB errors (slot taken, slot in the past) to clear API error responses
- [ ] Creates a `notifications` row for the patient (confirmation) and the doctor (new booking) — ties into Phase 6 but the insert happens here

### 3. `PATCH /api/appointments/[id]/cancel`
- [ ] Ownership check: only the patient who booked it, the owning doctor, or admin can cancel
- [ ] Sets `appointments.status` to `cancelled_by_patient` or `cancelled_by_doctor`
- [ ] Sets the linked `availability_slots.status` back to `available`
- [ ] Creates a `notifications` row for the other party

### 4. `PATCH /api/appointments/[id]/reschedule`
- [ ] Single transaction: release old slot (`available`), reserve new slot (reuse the `book_appointment` logic against the new `slot_id`), update the `appointments` row's `slot_id`
- [ ] Reject if the new slot is not available or is in the past
- [ ] Creates a `notifications` row for the other party

### 5. `GET /api/patient/appointments`
- [ ] Returns the authenticated patient's appointments, split into upcoming/past (based on `start_at` vs now)

### 6. `GET /api/doctor/appointments`
- [ ] Returns the authenticated doctor's appointments, split into upcoming/past

### 7. Booking confirmation UI
- [ ] Confirmation modal/page shown right after a successful booking, with date/time in `Asia/Jerusalem`

### 8. `/patient/appointments` page
- [ ] Tabs or sections: upcoming / past
- [ ] Cancel and reschedule actions on upcoming appointments

### 9. `/doctor/appointments` page
- [ ] Tabs or sections: upcoming / past
- [ ] Cancel action on upcoming appointments

## Playwright Tests

- [ ] Successful booking of an available slot
- [ ] Two simultaneous booking attempts on the same slot: only one succeeds (DB-level guarantee)
- [ ] Booking a past slot is rejected
- [ ] Cancelling by the patient frees the slot
- [ ] Cancelling by the doctor frees the slot
- [ ] Rescheduling: old slot released, new slot reserved, operation is atomic
- [ ] Appointment history visible for both patient and doctor
