-- Phase 5, 05-03 Rule 1 fix: a doctor could not read the profiles row of a
-- patient who booked with them.
--
-- profiles_select_own_or_admin (initial schema) only lets a caller read
-- their own profile row, or an admin read any row. `GET
-- /api/doctor/appointments` embeds `patient:profiles(id,full_name)` (a plain
-- left embed, not `!inner`, since a doctor must always see their own
-- appointment rows even if the patient embed is unreadable) — without this
-- policy the embed silently returns `patient: null` on every row instead of
-- the name the whole point of this route is to surface. Found by Task 3
-- case 5 (T-05-08 data-minimisation assertion): `row.patient` was `null`
-- rather than `{ id, full_name }`.
--
-- This is an ADDITIONAL select policy (Postgres RLS policies for the same
-- command are OR'd together), so the existing "own row OR admin" rule is
-- untouched — it only adds one more true case: a doctor who has any
-- appointment (any status) with this patient. Mirrors the shape of
-- 20260811070000's availability_slots fix and reuses the existing
-- is_doctor_owner() helper (security definer, avoids RLS recursion).
create policy "profiles_select_via_own_appointment_doctor" on public.profiles
  for select using (
    exists (
      select 1 from public.appointments a
      where a.patient_id = profiles.id
        and public.is_doctor_owner(a.doctor_id)
    )
  );
