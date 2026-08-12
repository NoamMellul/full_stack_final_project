# Roadmap: MedRDV

## Overview

MedRDV is built as a sequence of complete technical/domain layers, each assembled fully (database + API + UI) before the next depends on it. The journey starts with the data model and authentication foundation — since the schema is the most critical, highest-risk part of this project and must be validated before any feature work — then adds the admin tooling that seeds the platform with real doctor data, then the patient-facing discovery experience (search + public profiles), then doctor-side schedule management, then the core value proposition of the whole app (booking with a guaranteed no-double-booking constraint), and finally the layer that ties everything together for daily use: dashboards, favorites, in-app notifications, and Hebrew/English RTL-aware localization. Each phase is independently demonstrable, which matches the project's need to be presented end-to-end in a 10-15 minute university defense.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation — Database Schema & Authentication** - Full data model deployed with RLS, and patients/doctors can securely authenticate with role-based route protection (completed 2026-08-04)
- [x] **Phase 2: Admin — Doctor & Reference Data Management** - Admin can populate and govern the entire platform catalog (doctors, specialties, neighborhoods, users, appointments oversight) (completed 2026-08-05)
- [x] **Phase 3: Doctor Discovery — Search & Public Profiles** - Patients can find and evaluate doctors matching their criteria (completed 2026-08-08)
- [x] **Phase 4: Doctor Availability Management** - Doctors control their own schedule with conflict-safe slot and block-period management (completed 2026-08-09)
- [x] **Phase 5: Appointment Booking & Lifecycle** - Patients can book, cancel, and reschedule appointments with a guaranteed anti-double-booking constraint (completed 2026-08-11)
- [ ] **Phase 6: Dashboards, Notifications & Localization** - Patients and doctors get a personalized home base with real-time updates, in a fully bilingual (Hebrew/English, RTL) interface

## Phase Details

### Phase 1: Foundation — Database Schema & Authentication

**Goal**: The complete database schema (all tables, constraints, and RLS policies for the entire application) is deployed and validated, and patients/doctors can securely sign up, log in, and stay authenticated, with role-based access enforced at the route level.
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07
**Success Criteria** (what must be TRUE):

  1. Patient can sign up with email/password, log in, log out, and their session persists across a browser refresh.
  2. Doctor can log in with credentials created by the admin.
  3. An unauthenticated user is redirected away from any protected patient, doctor, or admin page.
  4. A logged-in user attempting to open a page for a role they don't have (e.g. a patient opening an admin page) is denied access.

**Plans**: 6/6 plans executed

- [x] 01-01-PLAN.md
- [x] 01-02-PLAN.md
- [x] 01-03-PLAN.md
- [x] 01-04-PLAN.md
- [x] 01-05-PLAN.md
- [x] 01-06-PLAN.md

### Phase 2: Admin — Doctor & Reference Data Management

**Goal**: The admin has a complete management interface to populate and govern the platform — creating and maintaining doctor profiles, reference data, and oversight views — so downstream phases have real data to search, book, and display.
**Depends on**: Phase 1
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06, ADMIN-07, ADMIN-08
**Success Criteria** (what must be TRUE):

  1. Admin can create, edit, and activate/deactivate a doctor profile with all public details from an admin interface.
  2. Admin can link a doctor profile to a login account via a temporary password, and that doctor can then log in.
  3. Admin can manage (add/edit/remove) the lists of specialties and neighborhoods used platform-wide.
  4. Admin can view all registered users and all appointments across the platform from admin views.

**Plans**: 7/7 plans executed

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Tracer: admin creates a doctor end-to-end, plus the doctors list states

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — Doctor edit and activate/deactivate, proven at the RLS boundary
- [x] 02-03-PLAN.md — Specialties and locations CRUD with the server-enforced delete guard
- [x] 02-04-PLAN.md — Read-only users and appointments oversight views

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-05-PLAN.md — Link doctor login account, one-time temporary password, forced password change
- [x] 02-06-PLAN.md — Idempotent demo-data seed script

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02-07-PLAN.md — Admin dashboard, section navigation, cross-cutting route protection

**UI hint**: yes

### Phase 3: Doctor Discovery — Search & Public Profiles

**Goal**: Patients can find a doctor matching their criteria and review enough public information to decide whether to book, entirely from patient-facing pages.
**Depends on**: Phase 2
**Requirements**: SEARCH-01, SEARCH-02, SEARCH-03, SEARCH-04, SEARCH-05, SEARCH-06, SEARCH-07, SEARCH-08, SEARCH-09, PROFILE-01, PROFILE-02, PROFILE-03
**Success Criteria** (what must be TRUE):

  1. Patient can search doctors by name and filter by specialty, spoken language, neighborhood, and availability, combining multiple filters in a single search.
  2. Search results page shows each doctor's next available slot and is sorted by soonest availability.
  3. An empty search shows a clear "no doctor found" message instead of a blank page.
  4. Patient can open a doctor's public profile page showing specialty, description, address, neighborhood, languages, photo, and a clear "demo profile" indicator.
  5. Patient can view a doctor's upcoming available slots directly from their profile page.

**Plans**: 7/7 plans executed

Plans:
**Wave 1**

- [x] 03-01-PLAN.md — `doctor_search_view` migration, blocking push, and anon-client RLS/grant proof
- [x] 03-02-PLAN.md — Demo availability slots (idempotent seed) plus the shared `lib/timezone.ts` extraction

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-03-PLAN.md — Tracer: end-to-end name search at `/search` with result card, states and sort contract
- [x] 03-04-PLAN.md — Public doctor profile page and endpoint, demo badge, grouped slots, inert booking CTA

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-05-PLAN.md — Specialty, language, neighborhood and availability-range filters combined with AND

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 03-06-PLAN.md — Numbered pagination, total count, and cross-page sort stability

**Wave 5** *(gap closure — blocked on Wave 4 completion)*

- [x] 03-07-PLAN.md — Gap closure: a wildcard-only `q` must return no doctors instead of the unfiltered directory (SEARCH-01/T-03-01)

**UI hint**: yes

### Phase 4: Doctor Availability Management

**Goal**: Doctors can fully control their own bookable schedule from a dedicated interface, with conflict rules enforced so the schedule they present to patients is always valid.
**Depends on**: Phase 2
**Requirements**: AVAIL-01, AVAIL-02, AVAIL-03, AVAIL-04, AVAIL-05, AVAIL-06, AVAIL-07
**Success Criteria** (what must be TRUE):

  1. Doctor can add an available time slot from their schedule view, and cannot add a slot in the past or one that overlaps an existing slot.
  2. Doctor can delete a slot that has not been booked, but cannot delete a slot that has already been booked.
  3. Doctor can block a period of unavailability, and a blocked period cannot overlap an existing available slot.

**Plans**: 4/4 plans executed

Plans:
**Wave 1**

- [x] 04-01-PLAN.md — `availability_slots.reason` migration (blocking push) plus the tracer: a doctor adds one available slot end to end

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-02-PLAN.md — Delete an unbooked slot or un-block a period, with the booked-slot guard enforced server-side

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04-03-PLAN.md — Block a period of unavailability as one continuous row, with its optional reason

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 04-04-PLAN.md — Overlap enforcement proven at the database under concurrency, plus the cross-doctor visibility sweep

**UI hint**: yes

### Phase 5: Appointment Booking & Lifecycle

**Goal**: Patients can book, cancel, and reschedule appointments through a complete booking flow, with an absolute, database-enforced guarantee that two patients can never book the same slot — the core value proposition of the platform.
**Depends on**: Phase 3, Phase 4
**Requirements**: APPT-01, APPT-02, APPT-03, APPT-04, APPT-05, APPT-06, APPT-07, APPT-08, APPT-09, APPT-10, APPT-11, APPT-12, APPT-13
**Success Criteria** (what must be TRUE):

  1. Patient can book an available future slot with a doctor, and concurrent booking attempts on the same slot never both succeed (enforced at the database level, not just in application code).
  2. Booking a slot marks it unavailable immediately, and cancelling an appointment (by patient or doctor) frees the slot for rebooking.
  3. Patient can reschedule an appointment to another available slot, with the old slot released and the new slot reserved atomically in a single transaction.
  4. Patient can view their own upcoming and past appointments, and doctor can view their own upcoming and past appointments.

**Plans**: 5/5 plans executed

Plans:
**Wave 1**

- [x] 05-01-PLAN.md — Appointment RPC migration + booking tracer (patient books end to end, sees their own appointment list)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-02-PLAN.md — Patient cancellation: cancel route, confirmation dialog, slot release and re-booking proof
- [x] 05-03-PLAN.md — Doctor appointment history: doctor-scoped read endpoint and `/doctor/appointments` page

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 05-04-PLAN.md — Patient reschedule: reschedule route, day-grouped slot picker, atomicity under concurrency
- [x] 05-05-PLAN.md — Doctor cancellation on `/doctor/appointments` and the phase's full-suite gate

**Cross-cutting constraints:**

- Every layout and spacing class added by this plan uses logical properties (`ps-`, `pe-`, `ms-`, `me-`, `text-start`, `text-end`) and no physical direction class (UI-SPEC RTL note)

### Phase 6: Dashboards, Notifications & Localization

**Goal**: Patients and doctors have a personalized home base summarizing their activity with real-time in-app updates, favorites, and the entire interface is fully usable in either Hebrew or English with correct RTL mirroring.
**Depends on**: Phase 5
**Requirements**: PATIENT-01, PATIENT-02, PATIENT-03, PATIENT-04, DOCTOR-01, DOCTOR-02, NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, I18N-01, I18N-02
**Success Criteria** (what must be TRUE):

  1. Patient can add a doctor to favorites, remove one, and view their full list of favorite doctors.
  2. Patient dashboard shows a summary of upcoming appointments; doctor dashboard shows a count of upcoming appointments and a count of remaining available slots.
  3. Patient receives an in-app notification when a booking is confirmed, cancelled, or rescheduled, and a doctor receives an in-app notification when a new appointment is booked.
  4. User can switch the entire interface between Hebrew and English from any page, and the layout correctly mirrors to RTL when Hebrew is selected.

**Plans**: 5/10 plans executed
**Wave 1**

- [x] 06-01-PLAN.md

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 06-02-PLAN.md
- [x] 06-03-PLAN.md
- [x] 06-04-PLAN.md
- [x] 06-05-PLAN.md

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 06-06-PLAN.md

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 06-07-PLAN.md

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 06-08-PLAN.md
- [ ] 06-09-PLAN.md

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 06-10-PLAN.md

**Cross-cutting constraints:**

- No key is added to either dictionary file by this plan: every t() call resolves against the inventory authored in 06-07, enforced by the TranslationKey type.

**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation — Database Schema & Authentication | 6/6 | Complete    | 2026-08-04 |
| 2. Admin — Doctor & Reference Data Management | 7/7 | Complete    | 2026-08-05 |
| 3. Doctor Discovery — Search & Public Profiles | 7/7 | Complete    | 2026-08-08 |
| 4. Doctor Availability Management | 4/4 | In Progress|  |
| 5. Appointment Booking & Lifecycle | 5/5 | Complete    | 2026-08-11 |
| 6. Dashboards, Notifications & Localization | 5/10 | In Progress|  |
