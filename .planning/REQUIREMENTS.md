# Requirements: MedRDV

**Defined:** 2026-08-03
**Core Value:** A patient must be able to find a doctor matching their criteria and book an available slot in a few clicks, with an absolute guarantee that two patients never book the same slot.

## v1 Requirements

### Authentication

- [x] **AUTH-01**: Patient can sign up with email and password
- [x] **AUTH-02**: Patient can log in with email and password
- [x] **AUTH-03**: Patient can log out
- [x] **AUTH-04**: Patient session persists across browser refresh
- [x] **AUTH-05**: Doctor can log in with credentials created by the admin
- [x] **AUTH-06**: Unauthenticated user is redirected away from protected patient/doctor/admin pages
- [x] **AUTH-07**: User attempting to access a page for a role they don't have is denied access

### Search

- [x] **SEARCH-01**: Patient can search doctors by name
- [x] **SEARCH-02**: Patient can filter doctors by specialty
- [x] **SEARCH-03**: Patient can filter doctors by spoken language (Hebrew/English)
- [x] **SEARCH-04**: Patient can filter doctors by neighborhood/location
- [x] **SEARCH-05**: Patient can filter doctors by availability (e.g. available this week)
- [x] **SEARCH-06**: Patient can combine multiple filters in one search
- [x] **SEARCH-07**: Search results show each doctor's next available slot
- [x] **SEARCH-08**: Search results are sorted by soonest availability
- [x] **SEARCH-09**: Empty search results show a clear "no doctor found" message

### Doctor Profiles

- [x] **PROFILE-01**: Patient can view a doctor's public profile (name, specialty, description, address, neighborhood, languages, photo)
- [x] **PROFILE-02**: Doctor public profile displays a clear "demo profile" indicator
- [x] **PROFILE-03**: Patient can view a doctor's upcoming available slots from their profile

### Availability

- [x] **AVAIL-01**: Doctor can add an available time slot
- [x] **AVAIL-02**: Doctor cannot add a slot in the past
- [x] **AVAIL-03**: Doctor cannot create overlapping slots
- [x] **AVAIL-04**: Doctor can delete a slot that has not been booked
- [x] **AVAIL-05**: Doctor cannot delete a slot that has been booked
- [x] **AVAIL-06**: Doctor can block a period of unavailability
- [ ] **AVAIL-07**: A blocked period cannot overlap an existing available slot

### Appointments

- [ ] **APPT-01**: Patient can book an available slot with a doctor
- [ ] **APPT-02**: The system prevents two patients from ever booking the same slot
- [ ] **APPT-03**: Patient cannot book a slot in the past
- [ ] **APPT-04**: Booking a slot marks it unavailable immediately
- [ ] **APPT-05**: Patient can cancel their own upcoming appointment
- [ ] **APPT-06**: Doctor can cancel a patient's appointment
- [ ] **APPT-07**: Cancelling an appointment frees the slot for rebooking
- [ ] **APPT-08**: Patient can reschedule an appointment to another available slot
- [ ] **APPT-09**: Rescheduling releases the old slot and reserves the new one atomically
- [ ] **APPT-10**: Patient can view their upcoming appointments
- [ ] **APPT-11**: Patient can view their past appointments
- [ ] **APPT-12**: Doctor can view their upcoming appointments
- [ ] **APPT-13**: Doctor can view their past appointments

### Patient Space

- [ ] **PATIENT-01**: Patient can add a doctor to favorites
- [ ] **PATIENT-02**: Patient can remove a doctor from favorites
- [ ] **PATIENT-03**: Patient can view their list of favorite doctors
- [ ] **PATIENT-04**: Patient dashboard shows a summary of upcoming appointments

### Doctor Space

- [ ] **DOCTOR-01**: Doctor dashboard shows count of upcoming appointments
- [ ] **DOCTOR-02**: Doctor dashboard shows count of remaining available slots

### Admin

- [x] **ADMIN-01**: Admin can create a doctor profile with all public details
- [x] **ADMIN-02**: Admin can edit a doctor profile
- [x] **ADMIN-03**: Admin can activate or deactivate a doctor profile
- [x] **ADMIN-04**: Admin can link a doctor profile to a login account (temporary password)
- [x] **ADMIN-05**: Admin can manage the list of specialties
- [x] **ADMIN-06**: Admin can manage the list of neighborhoods/locations
- [x] **ADMIN-07**: Admin can view all registered users
- [x] **ADMIN-08**: Admin can view all appointments across the platform

### Notifications

- [ ] **NOTIF-01**: Patient receives an in-app notification when a booking is confirmed
- [ ] **NOTIF-02**: Patient receives an in-app notification when their appointment is cancelled
- [ ] **NOTIF-03**: Doctor receives an in-app notification when a new appointment is booked
- [ ] **NOTIF-04**: Patient receives an in-app notification when their appointment is rescheduled

### Internationalization

- [ ] **I18N-01**: User can switch the interface between Hebrew and English
- [ ] **I18N-02**: Interface layout mirrors correctly (RTL) when Hebrew is selected

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Communications

- **COMM-01**: Patient receives email confirmation of booking
- **COMM-02**: Patient receives email/SMS reminder before appointment
- **COMM-03**: External calendar sync (Google Calendar / iCal export)

### Business

- **BIZ-01**: Doctor/clinic subscription payment (Stripe or similar)
- **BIZ-02**: Multi-city support beyond Tel-Aviv
- **BIZ-03**: Real doctor onboarding flow (self-registration with admin approval)

### Auth

- **AUTH-08**: OAuth login (Google)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Medical records, diagnosis, prescriptions, lab results | Regulated sensitive medical data, out of the ethical/legal scope of a demo project |
| Full teleconsultation | Video/streaming complexity disproportionate to the value for this project |
| Consultation payment, reimbursement, insurance management | Requires real financial/regulatory integration not relevant to the demo |
| Real integration with actual doctors or Israeli healthcare systems | All data is clearly labeled demo data |
| Medical AI, diagnostic recommendations | Off-topic, risks user misinterpretation |
| Detailed patient-doctor medical messaging | Beyond appointment booking |

## Traceability

Which phases cover which requirements.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| AUTH-05 | Phase 1 | Complete |
| AUTH-06 | Phase 1 | Complete |
| AUTH-07 | Phase 1 | Complete |
| ADMIN-01 | Phase 2 | Complete |
| ADMIN-02 | Phase 2 | Complete |
| ADMIN-03 | Phase 2 | Complete |
| ADMIN-04 | Phase 2 | Complete |
| ADMIN-05 | Phase 2 | Complete |
| ADMIN-06 | Phase 2 | Complete |
| ADMIN-07 | Phase 2 | Complete |
| ADMIN-08 | Phase 2 | Complete |
| SEARCH-01 | Phase 3 | Complete |
| SEARCH-02 | Phase 3 | Complete |
| SEARCH-03 | Phase 3 | Complete |
| SEARCH-04 | Phase 3 | Complete |
| SEARCH-05 | Phase 3 | Complete |
| SEARCH-06 | Phase 3 | Complete |
| SEARCH-07 | Phase 3 | Complete |
| SEARCH-08 | Phase 3 | Complete |
| SEARCH-09 | Phase 3 | Complete |
| PROFILE-01 | Phase 3 | Complete |
| PROFILE-02 | Phase 3 | Complete |
| PROFILE-03 | Phase 3 | Complete |
| AVAIL-01 | Phase 4 | Complete |
| AVAIL-02 | Phase 4 | Complete |
| AVAIL-03 | Phase 4 | Complete |
| AVAIL-04 | Phase 4 | Complete |
| AVAIL-05 | Phase 4 | Complete |
| AVAIL-06 | Phase 4 | Complete |
| AVAIL-07 | Phase 4 | Pending |
| APPT-01 | Phase 5 | Pending |
| APPT-02 | Phase 5 | Pending |
| APPT-03 | Phase 5 | Pending |
| APPT-04 | Phase 5 | Pending |
| APPT-05 | Phase 5 | Pending |
| APPT-06 | Phase 5 | Pending |
| APPT-07 | Phase 5 | Pending |
| APPT-08 | Phase 5 | Pending |
| APPT-09 | Phase 5 | Pending |
| APPT-10 | Phase 5 | Pending |
| APPT-11 | Phase 5 | Pending |
| APPT-12 | Phase 5 | Pending |
| APPT-13 | Phase 5 | Pending |
| PATIENT-01 | Phase 6 | Pending |
| PATIENT-02 | Phase 6 | Pending |
| PATIENT-03 | Phase 6 | Pending |
| PATIENT-04 | Phase 6 | Pending |
| DOCTOR-01 | Phase 6 | Pending |
| DOCTOR-02 | Phase 6 | Pending |
| NOTIF-01 | Phase 6 | Pending |
| NOTIF-02 | Phase 6 | Pending |
| NOTIF-03 | Phase 6 | Pending |
| NOTIF-04 | Phase 6 | Pending |
| I18N-01 | Phase 6 | Pending |
| I18N-02 | Phase 6 | Pending |

**Coverage:**

- v1 requirements: 59 total (10 categories: AUTH, SEARCH, PROFILE, AVAIL, APPT, PATIENT, DOCTOR, ADMIN, NOTIF, I18N)
- Mapped to phases: 59/59 ✓
- Unmapped: 0 ✓

Note: an earlier draft of this section stated "45 total" — that count was stale relative to the finalized requirement list in this file (59 REQ-IDs). Corrected during roadmap creation on 2026-08-03.

---
*Requirements defined: 2026-08-03*
*Last updated: 2026-08-03 after roadmap creation (traceability mapped, 45→59 count corrected)*
