-- Phase 5, 05-01 Rule 1 fix: a patient could not read the availability_slots
-- row backing their OWN appointment once book_appointment() flipped it to
-- 'booked'.
--
-- availability_slots_select_available_or_owner_or_admin (initial schema)
-- only lets a non-owner, non-admin caller see a slot while status =
-- 'available'. That is correct for public/search browsing, but it also
-- silently applies to the patient-scoped reads this plan adds
-- (POST /api/appointments's follow-up select and GET
-- /api/patient/appointments), both of which embed availability_slots via
-- `slot:availability_slots!inner(...)`. Once a slot is booked, the inner
-- join finds zero rows the patient is allowed to see, so PostgREST excludes
-- the whole appointment row from the result — the just-booked appointment
-- vanishes from its own confirmation read and from the patient's own
-- history list. Found by Task 3's end-to-end tracer (booking always
-- returned 500 despite the appointment row and slot flip succeeding).
--
-- This is an ADDITIONAL select policy (Postgres RLS policies for the same
-- command are OR'd together), so the existing "available OR owning doctor
-- OR admin" rule is untouched — it only adds one more true case: a patient
-- who has any appointment (any status, including cancelled/past) pointing
-- at this slot.
create policy "availability_slots_select_via_own_appointment" on public.availability_slots
  for select using (
    exists (
      select 1 from public.appointments a
      where a.slot_id = availability_slots.id
        and a.patient_id = auth.uid()
    )
  );
