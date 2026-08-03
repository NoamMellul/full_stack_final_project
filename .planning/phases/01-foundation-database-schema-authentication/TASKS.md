# Phase 1: Foundation — Database Schema & Authentication

**Goal**: The complete data schema (all tables, constraints, indexes, and RLS policies) is deployed on Supabase, and patients/doctors can sign up, log in, and log out, with role-based route protection.

**Depends on**: Nothing (first phase)

**Requirements covered**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07

## Tasks

### 1. SQL migrations — table creation
- [ ] `profiles` (`id` uuid PK = `auth.users.id`, `role` enum `patient`/`doctor`/`admin`, `full_name` text, `email` text, `created_at`)
- [ ] `specialties` (`id` uuid PK, `name_he` text, `name_en` text)
- [ ] `languages` (`id` uuid PK, `code` text unique — `he` / `en`)
- [ ] `locations` (`id` uuid PK, `city` text, `neighborhood` text, `address` text)
- [ ] `doctors` (`id` uuid PK, `profile_id` uuid **nullable** FK → `profiles` — nullable because the admin can create a doctor before linking a login account, `full_name` text **stored here** (not only on `profiles`, since the account may not exist yet), `specialty_id` FK, `location_id` FK, `bio` text, `photo_url` text, `is_demo` boolean default `true`, `is_active` boolean default `false`, `created_at`)
- [ ] `doctor_languages` (`doctor_id` FK, `language_id` FK, composite PK)
- [ ] `availability_slots` (`id` uuid PK, `doctor_id` FK, `start_at` timestamptz, `end_at` timestamptz, `status` text check `available`/`booked`/`blocked`, `created_at`) — **merged with `blocked_periods`** as previously decided
- [ ] `appointments` (`id` uuid PK, `slot_id` FK, `patient_id` FK → `profiles`, `doctor_id` FK → `doctors`, `status` text check `scheduled`/`confirmed`/`cancelled_by_patient`/`cancelled_by_doctor`/`completed`/`no_show`, `cancelled_reason` text nullable, `created_at`, `updated_at`)
- [ ] `favorites` (`id` uuid PK, `patient_id` FK, `doctor_id` FK, `created_at`, unique `(patient_id, doctor_id)`)
- [ ] `notifications` (`id` uuid PK, `user_id` FK → `profiles`, `type` text, `message` text, `related_appointment_id` FK nullable, `read_at` timestamptz nullable, `created_at`)

### 2. Constraints and indexes
- [ ] Enable the `btree_gist` extension (needed for exclusion constraints)
- [ ] `CHECK` on `availability_slots`: `end_at > start_at`
- [ ] Exclusion constraint (`EXCLUDE USING gist`) on `availability_slots`: no overlapping time ranges for the same `doctor_id`
- [ ] **Partial** unique index on `appointments(slot_id)` `WHERE status NOT IN ('cancelled_by_patient','cancelled_by_doctor')` — DB-level anti-double-booking guarantee
- [ ] B-tree index on `doctors(specialty_id)`, `doctors(location_id)`, `doctors(is_active)`
- [ ] Composite index on `availability_slots(doctor_id, start_at, status)`
- [ ] Partial index on `availability_slots` `WHERE status = 'available'`
- [ ] `pg_trgm` extension + trigram index on `doctors(full_name)` for name search
- [ ] Explicit `ON DELETE` behavior on each FK (e.g. `CASCADE` for `doctor_languages`/`favorites`, `RESTRICT` for `appointments`)

### 3. RLS policies (per table)
- [ ] `profiles`: read own row or admin; write own row (limited fields) or admin
- [ ] `doctors`: public read if `is_active = true`, otherwise the doctor themself (`profile_id = auth.uid()`) or admin; write restricted to admin
- [ ] `specialties` / `languages` / `locations` / `doctor_languages`: public read, admin-only write
- [ ] `availability_slots`: public read if `status = 'available'`, otherwise the owning doctor or admin; write restricted to the owning doctor or admin
- [ ] `appointments`: read/write restricted to the relevant `patient_id`, the relevant doctor (via `doctors.profile_id`), or admin
- [ ] `favorites`: read/write restricted to `patient_id = auth.uid()`
- [ ] `notifications`: read/write (mark as read) restricted to `user_id = auth.uid()`

### 4. Supabase Auth & client setup
- [ ] Enable email/password auth in the Supabase project
- [ ] Decide and configure email confirmation (disable for the demo, otherwise a real email-sending service is needed)
- [ ] `lib/supabase/server.ts` — SSR client with cookie-based session handling
- [ ] `lib/supabase/client.ts` — browser client
- [ ] `lib/supabase/admin.ts` — client with the `service_role` key (server-side only, never exposed), used for admin-side doctor account creation
- [ ] `.env.example` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### 5. Route protection middleware
- [ ] Read the Supabase session from cookies on every request
- [ ] Resolve the user's role via `profiles.role`
- [ ] Redirect to `/login` if unauthenticated on a protected route
- [ ] Redirect if the role doesn't match the requested route group (`/patient/*`, `/doctor/*`, `/admin/*`)

### 6. `/signup` page
- [ ] Form: email, password, full name
- [ ] Manual validation (email format, minimum password length, required fields)
- [ ] Call `supabase.auth.signUp` + create the `profiles` row (`role = 'patient'`)
- [ ] Error handling (email already in use, password too short, etc.)

### 7. `/login` page
- [ ] Form: email, password
- [ ] Call `supabase.auth.signInWithPassword`
- [ ] Redirect based on role after login (`patient` → `/patient/dashboard`, `doctor` → `/doctor/dashboard`, `admin` → `/admin`)
- [ ] "Invalid credentials" error handling

### 8. Logout
- [ ] Logout button in the header (available on every protected page)
- [ ] Call `supabase.auth.signOut` + redirect to `/`

### 9. Role-protected layouts
- [ ] `(patient)/layout.tsx` — enforces patient role
- [ ] `(doctor)/layout.tsx` — enforces doctor role
- [ ] `(admin)/layout.tsx` — enforces admin role

## Playwright Tests

- [ ] Successful patient sign-up
- [ ] Valid and invalid login
- [ ] Logout
- [ ] Session persists after browser refresh
- [ ] Unauthenticated user redirected away from protected pages
- [ ] Access denied to a page belonging to another role (e.g. patient opening `/admin`)
