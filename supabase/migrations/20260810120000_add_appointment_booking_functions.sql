-- Phase 5: appointment booking, reschedule and cancellation functions.
--
-- This is the book_appointment() function the initial schema's line-244
-- comment anticipates ("booking itself goes through the book_appointment()
-- function added in Phase 5, which enforces the transactional
-- anti-double-booking logic"). Two sibling functions, reschedule_appointment()
-- and cancel_appointment(), are added in the same migration so the whole
-- lifecycle shares one deployment and one set of custom error codes; only
-- book_appointment() is wired to a route/UI by this plan (05-01) — the other
-- two are consumed by plans 05-02/05-04/05-05.
--
-- All three functions are SECURITY DEFINER because a patient must flip a
-- doctor-owned availability_slots row and insert into notifications, both of
-- which RLS forbids to a patient (availability_slots_write_owner_or_admin
-- requires is_doctor_owner()/is_admin(); notifications has no insert policy
-- at all — see initial schema comment at the notifications policies).
-- Being SECURITY DEFINER makes each function its own authorization boundary:
-- RLS is bypassed entirely inside the function body, so every function here
-- resolves the acting identity from auth.uid() internally and never accepts
-- it as a parameter (mirrors the existing is_doctor_owner() convention —
-- see initial schema migration lines 166-177).
--
-- Custom SQLSTATE codes (five uppercase alphanumeric characters, a legal
-- custom class per the Postgres docs):
--   MR001 — slot is not available to claim (booking target or reschedule target)
--   MR002 — appointment can no longer be modified (already cancelled, or its slot has elapsed)
--   MR003 — caller is authenticated but is not a patient
--   MR004 — no appointment with this id is visible to this caller (non-oracle)
--   MR005 — caller has no auth.uid()

-- ============================================================================
-- public.book_appointment(p_slot_id uuid) returns uuid
-- ============================================================================
-- Note the signature deliberately drops a `patient_id` parameter: a
-- caller-supplied patient id in a function that bypasses RLS would be
-- trivially spoofable, so the patient is always auth.uid() (T-05-02).
create or replace function public.book_appointment(p_slot_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_id uuid;
  v_doctor_id uuid;
  v_appointment_id uuid;
begin
  v_patient_id := auth.uid();
  if v_patient_id is null then
    raise exception 'Not authenticated.' using errcode = 'MR005';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_patient_id and role = 'patient'
  ) then
    raise exception 'Not authorized.' using errcode = 'MR003';
  end if;

  -- One conditional UPDATE is simultaneously the double-booking guard
  -- (APPT-02), the past-slot guard (APPT-03), the immediate-unavailability
  -- write (APPT-04) and the inactive-doctor guard (D-19). Never split this
  -- into a SELECT to check and a separate UPDATE to claim — that reopens
  -- exactly the race this single statement closes.
  update public.availability_slots
     set status = 'booked'
   where id = p_slot_id
     and status = 'available'
     and start_at > now()
     and exists (
       select 1 from public.doctors d
       where d.id = availability_slots.doctor_id and d.is_active
     )
   returning doctor_id into v_doctor_id;

  if not found then
    raise exception 'This slot is no longer available. Please choose another.' using errcode = 'MR001';
  end if;

  -- Wrapped so a race that somehow reaches the partial unique index
  -- (appointments_active_slot_unique_idx) still surfaces as the same clean
  -- rejection rather than an unhandled 500.
  begin
    insert into public.appointments (slot_id, patient_id, doctor_id, status)
    values (p_slot_id, v_patient_id, v_doctor_id, 'scheduled')
    returning id into v_appointment_id;
  exception
    when unique_violation then
      raise exception 'This slot is no longer available. Please choose another.' using errcode = 'MR001';
  end;

  -- Notification text is generic and carries no clinical content and no
  -- counterparty personal data. It must never claim an email, SMS or
  -- reminder was sent, because this phase ships none.
  insert into public.notifications (user_id, type, message, related_appointment_id)
  values (v_patient_id, 'appointment_booked', 'Your appointment has been booked.', v_appointment_id);

  insert into public.notifications (user_id, type, message, related_appointment_id)
  select d.profile_id, 'appointment_booked', 'A patient booked an appointment with you.', v_appointment_id
  from public.doctors d
  where d.id = v_doctor_id and d.profile_id is not null;

  return v_appointment_id;
end;
$$;

-- ============================================================================
-- public.reschedule_appointment(p_appointment_id uuid, p_new_slot_id uuid) returns uuid
-- ============================================================================
-- Consumed by plan 05-04.
create or replace function public.reschedule_appointment(p_appointment_id uuid, p_new_slot_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_appt public.appointments%rowtype;
  v_old_start timestamptz;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'Not authenticated.' using errcode = 'MR005';
  end if;

  -- Locking the appointment row first (not just the slot rows) is what
  -- serializes two concurrent reschedules of the SAME appointment — without
  -- it, both could reserve a different new slot and one would be left
  -- booked forever with no appointment pointing at it (RESEARCH.md
  -- Pitfall 2). MR004 covers both "does not exist" and "belongs to someone
  -- else" with the same code, so the response can never confirm another
  -- patient's appointment id is real.
  select * into v_appt
  from public.appointments
  where id = p_appointment_id and patient_id = v_actor_id
  for update;

  if not found then
    raise exception 'This appointment could not be found.' using errcode = 'MR004';
  end if;

  if v_appt.status in ('cancelled_by_patient', 'cancelled_by_doctor') then
    raise exception 'This appointment can no longer be modified.' using errcode = 'MR002';
  end if;

  select start_at into v_old_start
  from public.availability_slots
  where id = v_appt.slot_id;

  if v_old_start is null or v_old_start <= now() then
    raise exception 'This appointment can no longer be modified.' using errcode = 'MR002';
  end if;

  -- Reserve the NEW slot before touching the old one (D-09). Because an
  -- unhandled exception rolls back the whole function invocation, the old
  -- slot is still held at this point on every failure path below — there is
  -- no instant at which neither slot is held. Same-doctor-only rescheduling
  -- (D-06) is enforced by the doctor_id predicate; the is_active guard is
  -- deliberately identical to book_appointment()'s (RESEARCH.md Pitfall 5).
  update public.availability_slots
     set status = 'booked'
   where id = p_new_slot_id
     and doctor_id = v_appt.doctor_id
     and status = 'available'
     and start_at > now()
     and exists (
       select 1 from public.doctors d
       where d.id = availability_slots.doctor_id and d.is_active
     );

  if not found then
    raise exception 'This slot is no longer available. Please choose another.' using errcode = 'MR001';
  end if;

  -- Only now release the old slot.
  update public.availability_slots
     set status = 'available'
   where id = v_appt.slot_id and start_at > now();

  -- The same appointment row, updated in place — never insert a second row (D-08).
  update public.appointments
     set slot_id = p_new_slot_id
   where id = p_appointment_id;

  insert into public.notifications (user_id, type, message, related_appointment_id)
  values (v_actor_id, 'appointment_rescheduled', 'Your appointment has been rescheduled.', p_appointment_id);

  insert into public.notifications (user_id, type, message, related_appointment_id)
  select d.profile_id, 'appointment_rescheduled', 'A patient rescheduled their appointment.', p_appointment_id
  from public.doctors d
  where d.id = v_appt.doctor_id and d.profile_id is not null;

  return p_appointment_id;
end;
$$;

-- ============================================================================
-- public.cancel_appointment(p_appointment_id uuid, p_reason text) returns text
-- ============================================================================
-- Consumed by plans 05-02 and 05-05.
create or replace function public.cancel_appointment(p_appointment_id uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_patient_id uuid;
  v_doctor_id uuid;
  v_doctor_profile_id uuid;
  v_slot_id uuid;
  v_status text;
  v_slot_start timestamptz;
  v_new_status text;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'Not authenticated.' using errcode = 'MR005';
  end if;

  -- Lock the appointment first, resolving both possible actors (the patient
  -- or the owning doctor) in one statement. MR004 covers both "missing" and
  -- "not owned" (D-12, D-20) so the response can never confirm another
  -- party's appointment id is real.
  select a.patient_id, a.doctor_id, a.slot_id, a.status, d.profile_id
    into v_patient_id, v_doctor_id, v_slot_id, v_status, v_doctor_profile_id
  from public.appointments a
  join public.doctors d on d.id = a.doctor_id
  where a.id = p_appointment_id
    and (a.patient_id = v_actor_id or d.profile_id = v_actor_id)
  for update of a;

  if not found then
    raise exception 'This appointment could not be found.' using errcode = 'MR004';
  end if;

  if v_status in ('cancelled_by_patient', 'cancelled_by_doctor') then
    raise exception 'This appointment can no longer be modified.' using errcode = 'MR002';
  end if;

  select start_at into v_slot_start
  from public.availability_slots
  where id = v_slot_id;

  if v_slot_start is null or v_slot_start <= now() then
    raise exception 'This appointment can no longer be modified.' using errcode = 'MR002';
  end if;

  -- The patient branch is evaluated first; an account being both the
  -- appointment's patient and its doctor is not reachable in this data
  -- model, so the order here has no ambiguous case in practice (D-14).
  if v_actor_id = v_patient_id then
    v_new_status := 'cancelled_by_patient';
  else
    v_new_status := 'cancelled_by_doctor';
  end if;

  -- p_reason is stored exactly as received — never trimmed, never coerced
  -- from empty string to null here (that decision belongs to the route
  -- layer) — matching Phase 4's byte-identical reason round-trip rule
  -- (04-CONTEXT D-04). The row is updated, never deleted (D-14).
  update public.appointments
     set status = v_new_status, cancelled_reason = p_reason
   where id = p_appointment_id;

  update public.availability_slots
     set status = 'available'
   where id = v_slot_id and start_at > now();

  -- Notify only the other party. p_reason is never copied into the
  -- notification message: it is free text authored by one party about the
  -- other and has no validated content.
  if v_new_status = 'cancelled_by_patient' then
    insert into public.notifications (user_id, type, message, related_appointment_id)
    select v_doctor_profile_id, 'appointment_cancelled', 'A patient cancelled their appointment.', p_appointment_id
    where v_doctor_profile_id is not null;
  else
    insert into public.notifications (user_id, type, message, related_appointment_id)
    values (v_patient_id, 'appointment_cancelled', 'Your appointment was cancelled by the doctor.', p_appointment_id);
  end if;

  return v_new_status;
end;
$$;

-- ============================================================================
-- Grants
-- ============================================================================
-- An anonymous caller must not be able to invoke a function that bypasses
-- RLS; the MR005 auth.uid() guard inside each body is the second layer
-- behind this grant (T-05-03).
revoke execute on function public.book_appointment(uuid) from public;
revoke execute on function public.reschedule_appointment(uuid, uuid) from public;
revoke execute on function public.cancel_appointment(uuid, text) from public;

grant execute on function public.book_appointment(uuid) to authenticated;
grant execute on function public.reschedule_appointment(uuid, uuid) to authenticated;
grant execute on function public.cancel_appointment(uuid, text) to authenticated;

-- ============================================================================
-- Insert-privilege hardening (05-01 Task 1 checkpoint, option-b selected)
-- ============================================================================
-- appointments_insert_patient (initial schema) is deliberately left in place
-- as documentation of intent but is no longer reachable by anon/authenticated
-- callers: revoking direct INSERT forces every appointment row through
-- book_appointment(), which is what makes APPT-04 ("booking marks the slot
-- unavailable immediately") a real guarantee rather than one that only holds
-- for callers who go through the route. book_appointment() runs as its
-- definer and is unaffected by this revoke; the e2e test suite's
-- service-role fixtures (tests/e2e/helpers/appointments.ts,
-- tests/e2e/admin-oversight-views.spec.ts) bypass grants entirely and are
-- also unaffected (T-05-04).
revoke insert on public.appointments from anon, authenticated;
