-- Phase 5 code review CR-02 fix: `profiles_select_via_own_appointment_doctor`
-- (20260811090000) granted a doctor full-row SELECT (including `email`) on
-- any patient's profiles row, for any appointment of any status, forever —
-- contradicting this phase's own data-minimization intent (the doctor
-- appointments route's select string deliberately asks for only
-- `id, full_name`, see app/api/doctor/appointments/route.ts). RLS is
-- row-level only: once that policy evaluates true, the doctor's session can
-- select every column of that row, not just the two the app needs.
--
-- Plain column-level GRANTs cannot fix this, because every app role
-- (patient/doctor/admin) maps to the SAME Postgres role `authenticated` —
-- there is no way to grant a column to "admin only" or "self only" at the
-- privilege level; GRANT is role-wide, not row-conditional. The self ("own
-- row") and admin cases already work correctly through the pre-existing
-- profiles_select_own_or_admin policy (initial schema) plus the table's
-- default column grants, and are left untouched here. The doctor-facing gap
-- is closed instead with a narrow SECURITY DEFINER function, mirroring the
-- existing is_admin()/is_doctor_owner() convention (language sql, stable,
-- security definer, set search_path = public) — it resolves the caller's
-- identity exclusively from auth.uid() via is_doctor_owner() and returns
-- only (id, full_name) for patients the caller has an appointment with,
-- never the full row.

-- Drop the over-broad row policy — this is what removes the full-row leak.
drop policy if exists "profiles_select_via_own_appointment_doctor" on public.profiles;

create or replace function public.doctor_visible_patients()
returns table(id uuid, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.id, p.full_name
  from public.profiles p
  join public.appointments a on a.patient_id = p.id
  where public.is_doctor_owner(a.doctor_id);
$$;

revoke execute on function public.doctor_visible_patients() from public;
grant execute on function public.doctor_visible_patients() to authenticated;
