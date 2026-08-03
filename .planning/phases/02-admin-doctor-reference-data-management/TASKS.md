# Phase 2: Admin — Doctor & Reference Data Management

**Goal**: The admin has a complete interface to create and manage doctors and reference data, so later phases have real data to search, book, and display.

**Depends on**: Phase 1

**Requirements covered**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06, ADMIN-07, ADMIN-08

## Tasks

### 1. `POST /api/admin/doctors` — create a doctor profile
- [ ] Manual validation of the request body (name, specialty, location, bio, languages)
- [ ] Insert into `doctors` (with `is_demo = true`, `is_active = false` by default)
- [ ] Insert rows into `doctor_languages`
- [ ] Role check: admin only (middleware + RLS)

### 2. `PATCH /api/admin/doctors/[id]` — edit a doctor profile
- [ ] Manual validation of editable fields
- [ ] Update `doctors` row and `doctor_languages` associations

### 3. `PATCH /api/admin/doctors/[id]/status` — activate/deactivate
- [ ] Toggle `is_active`
- [ ] Deactivated doctor immediately disappears from public search (relies on Phase 1 RLS policy)

### 4. `POST /api/admin/doctors/[id]/link-account` — create doctor login
- [ ] Use the `service_role` admin client to create a Supabase Auth user with a generated temporary password
- [ ] Create/link the `profiles` row (`role = 'doctor'`) and set `doctors.profile_id`
- [ ] Return the temporary password once in the API response (never stored in plaintext elsewhere)

### 5. `/api/admin/specialties` — CRUD
- [ ] `GET`, `POST`, `PATCH`, `DELETE` with manual validation
- [ ] Prevent deleting a specialty still referenced by a doctor (FK constraint / explicit check)

### 6. `/api/admin/locations` — CRUD
- [ ] `GET`, `POST`, `PATCH`, `DELETE` with manual validation
- [ ] Prevent deleting a location still referenced by a doctor

### 7. `GET /api/admin/users`
- [ ] List all `profiles` rows with role and basic info, admin-only

### 8. `GET /api/admin/appointments`
- [ ] List all appointments platform-wide (for oversight), admin-only

### 9. `/admin` dashboard page
- [ ] Summary counts (doctors, active doctors, users, appointments)

### 10. `/admin/doctors` page
- [ ] List of doctors with status
- [ ] Create/edit form (specialty select, location select, languages multi-select, bio, photo upload)
- [ ] Activate/deactivate action
- [ ] "Link account" action showing the generated temporary password

### 11. `/admin/specialties` page
- [ ] List + create/edit/delete form

### 12. `/admin/locations` page
- [ ] List + create/edit/delete form

### 13. `/admin/users` page
- [ ] Read-only list of all users and their roles

### 14. `/admin/appointments` page
- [ ] Read-only list of all appointments with filters (status, doctor, date)

### 15. Demo data seed script
- [ ] Script populating specialties, Tel-Aviv neighborhoods, several demo doctors with photos/bios, and a spread of availability slots
- [ ] Idempotent (safe to re-run without duplicating data)

## Playwright Tests

- [ ] Full doctor creation from the admin interface
- [ ] Non-admin user is denied access to these routes/pages
- [ ] Deactivating a doctor removes them from public search results
- [ ] Specialty and location management (add/edit/delete)
