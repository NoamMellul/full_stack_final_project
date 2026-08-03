# Phase 4: Doctor Availability Management

**Goal**: Doctors fully control their own bookable schedule, with conflict rules enforced so the schedule shown to patients is always valid.

**Depends on**: Phase 2

**Requirements covered**: AVAIL-01, AVAIL-02, AVAIL-03, AVAIL-04, AVAIL-05, AVAIL-06, AVAIL-07

## Tasks

### 1. `POST /api/doctor/slots` — add an available slot
- [ ] Manual validation: `start_at` in the future, `end_at > start_at`
- [ ] Reject if it overlaps an existing slot for this doctor (catch the DB exclusion-constraint violation and return a clear error message)
- [ ] Insert with `status = 'available'`
- [ ] Role check: only the owning doctor (or admin) can add slots for a given `doctor_id`

### 2. `DELETE /api/doctor/slots/[id]` — remove a slot
- [ ] Reject if `status != 'available'` (i.e. already booked)
- [ ] Ownership check: only the owning doctor can delete their own slot

### 3. `POST /api/doctor/blocked-periods` — block a period
- [ ] Implemented as inserting one or more `availability_slots` rows with `status = 'blocked'` covering the period (single table, per the merged schema)
- [ ] Reject if it overlaps an existing `available` slot (must be explicitly freed/deleted first)
- [ ] Reject if in the past

### 4. Overlap & past-date validation layer
- [ ] Shared manual-validation helper functions (`isInPast(date)`, `overlapsExisting(doctorId, start, end)`) reused across add-slot and block-period endpoints
- [ ] Map the DB exclusion-constraint error code to a user-friendly message (defense in depth: DB constraint is the real guarantee, app-level check is for UX)

### 5. `/doctor/schedule` page
- [ ] Calendar/list view of the doctor's own slots (available, booked, blocked shown with distinct styling)
- [ ] "Add slot" form (date + start time + end time)
- [ ] "Delete slot" action (disabled/hidden for booked slots)
- [ ] "Block period" form (date range)
- [ ] All times displayed and entered in `Asia/Jerusalem`, converted to UTC on submit

## Playwright Tests

- [ ] Adding a valid slot succeeds
- [ ] Adding a slot in the past is rejected
- [ ] Adding an overlapping slot is rejected
- [ ] Deleting a free slot succeeds
- [ ] Deleting a booked slot is rejected
- [ ] Blocking a period that overlaps an existing available slot is rejected
