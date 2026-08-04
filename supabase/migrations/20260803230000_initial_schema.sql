-- MedRDV — Initial schema (Phase 1: Foundation)
-- Tables, constraints, indexes, and RLS policies for the entire application.

-- ============================================================================
-- Extensions
-- ============================================================================

create extension if not exists btree_gist;
create extension if not exists pg_trgm;

-- ============================================================================
-- Tables
-- ============================================================================

-- One row per authenticated user (patient, doctor, or admin).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('patient', 'doctor', 'admin')),
  full_name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table public.specialties (
  id uuid primary key default gen_random_uuid(),
  name_he text not null,
  name_en text not null
);

create table public.languages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('he', 'en'))
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  neighborhood text not null,
  address text
);

-- Doctor's own name is stored here (not only on profiles), because the admin
-- may create a doctor before a login account exists (profile_id is nullable).
create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  full_name text not null,
  specialty_id uuid not null references public.specialties (id) on delete restrict,
  location_id uuid not null references public.locations (id) on delete restrict,
  bio text,
  photo_url text,
  is_demo boolean not null default true,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.doctor_languages (
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  language_id uuid not null references public.languages (id) on delete cascade,
  primary key (doctor_id, language_id)
);

-- Merged with "blocked_periods": status distinguishes available / booked / blocked.
create table public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'available' check (status in ('available', 'booked', 'blocked')),
  created_at timestamptz not null default now(),
  constraint availability_slots_valid_range check (end_at > start_at),
  -- No two slots for the same doctor may overlap in time, regardless of status.
  constraint availability_slots_no_overlap exclude using gist (
    doctor_id with =,
    tstzrange(start_at, end_at) with &&
  )
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.availability_slots (id) on delete restrict,
  patient_id uuid not null references public.profiles (id) on delete restrict,
  doctor_id uuid not null references public.doctors (id) on delete restrict,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'confirmed', 'cancelled_by_patient', 'cancelled_by_doctor', 'completed', 'no_show')),
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (patient_id, doctor_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  message text not null,
  related_appointment_id uuid references public.appointments (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

create index doctors_specialty_id_idx on public.doctors (specialty_id);
create index doctors_location_id_idx on public.doctors (location_id);
create index doctors_is_active_idx on public.doctors (is_active);
create index doctors_full_name_trgm_idx on public.doctors using gin (full_name gin_trgm_ops);

create index availability_slots_doctor_start_status_idx on public.availability_slots (doctor_id, start_at, status);
create index availability_slots_available_idx on public.availability_slots (start_at) where status = 'available';

-- Anti-double-booking guarantee: at most one active (non-cancelled) appointment per slot.
create unique index appointments_active_slot_unique_idx on public.appointments (slot_id)
  where status not in ('cancelled_by_patient', 'cancelled_by_doctor');

create index appointments_patient_id_idx on public.appointments (patient_id);
create index appointments_doctor_id_idx on public.appointments (doctor_id);

create index notifications_user_id_created_idx on public.notifications (user_id, created_at desc);

-- ============================================================================
-- Triggers
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- Role-check helper functions (security definer to avoid RLS recursion)
-- ============================================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_doctor_owner(target_doctor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.doctors
    where id = target_doctor_id and profile_id = auth.uid()
  );
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.specialties enable row level security;
alter table public.languages enable row level security;
alter table public.locations enable row level security;
alter table public.doctors enable row level security;
alter table public.doctor_languages enable row level security;
alter table public.availability_slots enable row level security;
alter table public.appointments enable row level security;
alter table public.favorites enable row level security;
alter table public.notifications enable row level security;

-- profiles: read/update own row, or admin. Insert is self-signup only —
-- admin-created doctor accounts are inserted server-side via the service_role
-- client, which bypasses RLS entirely.
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

create policy "profiles_update_own_or_admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin());

-- specialties / languages / locations / doctor_languages: public read, admin write.
create policy "specialties_select_all" on public.specialties for select using (true);
create policy "specialties_admin_write" on public.specialties for all
  using (public.is_admin()) with check (public.is_admin());

create policy "languages_select_all" on public.languages for select using (true);
create policy "languages_admin_write" on public.languages for all
  using (public.is_admin()) with check (public.is_admin());

create policy "locations_select_all" on public.locations for select using (true);
create policy "locations_admin_write" on public.locations for all
  using (public.is_admin()) with check (public.is_admin());

create policy "doctor_languages_select_all" on public.doctor_languages for select using (true);
create policy "doctor_languages_admin_write" on public.doctor_languages for all
  using (public.is_admin()) with check (public.is_admin());

-- doctors: public read if active, otherwise the doctor themself or admin. Admin-only write.
create policy "doctors_select_active_or_owner_or_admin" on public.doctors
  for select using (is_active = true or profile_id = auth.uid() or public.is_admin());

create policy "doctors_admin_write" on public.doctors
  for all using (public.is_admin()) with check (public.is_admin());

-- availability_slots: public read if available, otherwise the owning doctor or admin.
-- Write restricted to the owning doctor or admin.
create policy "availability_slots_select_available_or_owner_or_admin" on public.availability_slots
  for select using (
    status = 'available'
    or public.is_doctor_owner(doctor_id)
    or public.is_admin()
  );

create policy "availability_slots_write_owner_or_admin" on public.availability_slots
  for all using (public.is_doctor_owner(doctor_id) or public.is_admin())
  with check (public.is_doctor_owner(doctor_id) or public.is_admin());

-- appointments: read/write restricted to the patient, the owning doctor, or admin.
-- Note: booking itself goes through the book_appointment() function added in
-- Phase 5, which enforces the transactional anti-double-booking logic.
create policy "appointments_select_own_or_admin" on public.appointments
  for select using (
    patient_id = auth.uid()
    or public.is_doctor_owner(doctor_id)
    or public.is_admin()
  );

create policy "appointments_insert_patient" on public.appointments
  for insert with check (patient_id = auth.uid());

create policy "appointments_update_own_or_admin" on public.appointments
  for update using (
    patient_id = auth.uid()
    or public.is_doctor_owner(doctor_id)
    or public.is_admin()
  );

-- favorites: fully owned by the patient.
create policy "favorites_all_own" on public.favorites
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());

-- notifications: readable/markable-as-read by the recipient only.
-- No insert policy: notifications are always created server-side via the
-- service_role client (a user should never be able to write into another
-- user's notification feed).
create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());

create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid());
