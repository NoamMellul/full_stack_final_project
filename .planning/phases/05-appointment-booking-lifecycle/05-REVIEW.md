---
phase: 05-appointment-booking-lifecycle
reviewed: 2026-08-11T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - app/api/appointments/[id]/cancel/route.ts
  - app/api/appointments/[id]/reschedule/route.ts
  - app/api/appointments/route.ts
  - app/api/doctor/appointments/route.ts
  - app/api/patient/appointments/route.ts
  - app/doctor/(gated)/appointments/page.tsx
  - app/doctor/(gated)/page.tsx
  - app/doctors/[id]/page.tsx
  - app/patient/appointments/page.tsx
  - app/patient/page.tsx
  - lib/appointments.ts
  - lib/auth/require-patient.ts
  - lib/validation/appointments.ts
  - supabase/migrations/20260810120000_add_appointment_booking_functions.sql
  - supabase/migrations/20260811070000_add_availability_slots_select_via_own_appointment.sql
  - supabase/migrations/20260811090000_add_profiles_select_via_own_appointment_patient.sql
  - tests/e2e/appointment-booking.spec.ts
  - tests/e2e/appointment-cancel.spec.ts
  - tests/e2e/appointment-history.spec.ts
  - tests/e2e/appointment-reschedule.spec.ts
findings:
  critical: 2
  warning: 2
  info: 1
  total: 5
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-08-11T00:00:00Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

The three SECURITY DEFINER functions (`book_appointment`, `reschedule_appointment`, `cancel_appointment`) are well built: each resolves the acting identity exclusively from `auth.uid()`, never a client parameter; the double-booking guarantee rests on a single atomic conditional `UPDATE` rather than a select-then-check pattern; row locking (`FOR UPDATE`) correctly serializes concurrent reschedule/cancel attempts on the same appointment; and the reserve-new-before-release-old ordering in `reschedule_appointment` means there is never an instant with neither slot held. The route handlers translate custom SQLSTATEs (`MR001`–`MR005`) without ever leaking `error.message`, and the two additive RLS migrations are narrowly scoped fixes for genuine read-visibility gaps with clear before/after reasoning in their own comments.

However, two Critical findings undercut the phase's core guarantee and its data-minimization intent, both stemming from the same root cause: **Postgres RLS policies (row-level) cannot restrict which columns a client selects, and this phase's privilege hardening was incomplete.**

1. `book_appointment()`/`reschedule_appointment()`/`cancel_appointment()` are the only *intended* write path onto `appointments`, and this phase explicitly revoked direct `INSERT` to force booking through `book_appointment()`. It did **not** revoke direct `UPDATE`, and the pre-existing `appointments_update_own_or_admin` RLS policy (initial schema) still permits any patient or doctor to `UPDATE` their own appointment row's `slot_id`/`status`/`cancelled_reason` directly via the Supabase client (browser-side, anon key), completely bypassing the atomic functions and their D-08/D-09/D-10/D-12 invariants.
2. The new `profiles_select_via_own_appointment_doctor` policy grants a doctor full-row `SELECT` on any patient's `profiles` row (including `email`) if they have *ever* had an appointment together, of *any* status, forever — contradicting the explicit data-minimization intent documented in `app/api/doctor/appointments/route.ts`'s own comment ("no `email`... a doctor reading their own schedule does not [need it]"). The app-layer `select` string only asks for `id, full_name`, but RLS is the real authorization boundary and a doctor's authenticated browser session can query the `profiles` table directly for any column.

## Critical Issues

### CR-01: `appointments` UPDATE is not locked down, letting a patient or doctor bypass `reschedule_appointment()`/`cancel_appointment()` via a direct table write

**File:** `supabase/migrations/20260810120000_add_appointment_booking_functions.sql:302-316`
**Issue:**
This migration's "Insert-privilege hardening" section (lines 302-316) revokes `INSERT` on `public.appointments` from `anon, authenticated` so that every new row must go through `book_appointment()`. It does not do the equivalent for `UPDATE`. The pre-existing policy from the initial schema is still active and has no `WITH CHECK` clause of its own:

```sql
-- supabase/migrations/20260803230000_initial_schema.sql:256-261
create policy "appointments_update_own_or_admin" on public.appointments
  for update using (
    patient_id = auth.uid()
    or public.is_doctor_owner(doctor_id)
    or public.is_admin()
  );
```

Per Postgres RLS semantics, an `UPDATE` policy with no explicit `WITH CHECK` reuses the `USING` expression against the *new* row. That only constrains `patient_id`/`doctor_id` ownership — it says nothing about `slot_id`, `status`, or `cancelled_reason`. Combined with Supabase's default table-level grants (never revoked for `UPDATE` on this table, unlike the column-restricted revoke done for `profiles` in `20260804120200_add_must_change_password.sql:26-27`), any authenticated patient can, from the browser (`lib/supabase/client.ts` uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` + the user's session JWT), run:

```js
await supabase.from("appointments").update({ slot_id: someOtherAvailableSlotId }).eq("id", myAppointmentId);
```

This reassigns the appointment to a different slot without ever flipping that slot's `availability_slots.status` to `'booked'` (patients cannot write `availability_slots` — that RLS is correctly locked to `is_doctor_owner`/`is_admin`). The slot keeps showing as `'available'` in search/profile pages while silently being claimed, so a legitimate second patient's subsequent `book_appointment()` call fails with the generic "slot no longer available" message even though the UI showed it as free — and the original appointment's *old* slot is left permanently `'booked'` in `availability_slots` with no active appointment pointing at it (an orphaned slot, invisible to the doctor's calendar forever, since nothing releases it). The same path also lets a patient silently revert a `cancelled_by_patient`/`cancelled_by_doctor` row back to `'scheduled'` directly, undoing `cancel_appointment()`'s "can no longer be modified" (D-12) guarantee — the row-level unique index (`appointments_active_slot_unique_idx`) only prevents two *simultaneously non-cancelled* rows sharing a slot; it does not stop a stale row from silently reactivating when the slot happens not to have been reclaimed yet, and does not keep `availability_slots.status` in sync either way.

This is exactly the "database-enforced guarantee that two patients never book the same slot" this phase exists to deliver — and it can be undermined without ever calling the RPC functions at all.

**Fix:**
Revoke direct `UPDATE` on `appointments` from `anon, authenticated` in a follow-up migration, mirroring the existing `INSERT` hardening, and route every legitimate status/slot change exclusively through the SECURITY DEFINER functions (which already exist for this purpose):

```sql
-- appended to 20260810120000_add_appointment_booking_functions.sql (or a new migration)
revoke update on public.appointments from anon, authenticated;
```

If any future feature needs a narrower, safe direct-update surface (e.g. a doctor marking `no_show`), grant column-level `UPDATE` explicitly for just that column, the same pattern already used for `profiles (full_name, email)` in `20260804120200_add_must_change_password.sql`, rather than leaving the whole row writable.

### CR-02: `profiles_select_via_own_appointment_doctor` exposes a patient's email (and full row) to any doctor with a past appointment, contradicting this phase's own data-minimization intent

**File:** `supabase/migrations/20260811090000_add_profiles_select_via_own_appointment_patient.sql:20-27`
**Issue:**
```sql
create policy "profiles_select_via_own_appointment_doctor" on public.profiles
  for select using (
    exists (
      select 1 from public.appointments a
      where a.patient_id = profiles.id
        and public.is_doctor_owner(a.doctor_id)
    )
  );
```
This is a row-level policy: once it evaluates true, the doctor's session can `SELECT` **every column** of that `profiles` row (`id, role, full_name, email, created_at`), not just `id, full_name`. `GET /api/doctor/appointments` (`app/api/doctor/appointments/route.ts:13-16`) only asks for `patient:profiles(id,full_name)`, and its own comment explicitly says the `email` column is deliberately excluded because "a doctor reading their own schedule does not [need it]." But that restriction lives in the application's `select` string, not in RLS — a doctor's authenticated browser client (`lib/supabase/client.ts`, anon key + session JWT, already used client-side in `app/doctors/[id]/page.tsx`) can call:

```js
await supabase.from("profiles").select("*").eq("id", somePatientId);
```

and receive the patient's email address directly, for any patient with whom they've ever had an appointment of *any* status — including a `cancelled_by_patient`/`cancelled_by_doctor` appointment from the past, with no time bound. This is a genuine PII exposure beyond the intended and documented scope, reachable without going through the minimized route at all.

**Fix:**
RLS alone cannot express column-level restriction on a `for select using(...)` policy. Either:
1. Revoke table-level `SELECT` on `profiles` from `authenticated` and grant column-level `SELECT` only for the columns every role legitimately needs broadly (`id, full_name, role`), keeping `email` reachable only through `id = auth.uid()` (self) or `is_admin()` — mirroring the existing column-grant pattern already used for `profiles`'s `UPDATE` privilege in `20260804120200_add_must_change_password.sql:26-27`; or
2. Replace the direct table policy with a narrower `security definer` view/function (e.g. `public.doctor_visible_patient(patient_id uuid) returns table(id uuid, full_name text)`) that the app calls instead of embedding `profiles` directly, so the doctor's session can never reach the full row regardless of how it queries.

## Warnings

### WR-01: `validateBookingInput`/`validateRescheduleInput`/`validateCancelInput` throw on a literal JSON `null` body, producing an unhandled 500 instead of the documented clean 400

**File:** `lib/validation/appointments.ts:19-48`
**Issue:** Each validator accesses a property directly off its `body` parameter (`body.slotId`, `body.newSlotId`, `body.reason`) without first checking that `body` is a non-null object. A request with `Content-Type: application/json` and a body of the literal 4 bytes `null` parses successfully via `JSON.parse`/`request.json()` (no exception — `null` is valid JSON), so none of the three call sites' `try { … } catch { return 400 "Invalid request body." }` blocks trigger:

- `app/api/appointments/route.ts:19-29` (`body = await request.json()`, followed by `validateBookingInput(body as Record<string, unknown>)` outside the try/catch)
- `app/api/appointments/[id]/reschedule/route.ts:34-44` (same shape)
- `app/api/appointments/[id]/cancel/route.ts:38-49` (`text.length > 0 ? JSON.parse(text) : {}` — `"null"` has length 4, so `JSON.parse` runs and returns `null`, past the catch, into `validateCancelInput(null)`)

`null.slotId` (and `null.reason`, `null.newSlotId`) throws `TypeError: Cannot read properties of null`, which is not caught anywhere in these handlers, so the route returns an unhandled 500 instead of the clean, tested 400 these routes otherwise guarantee (`tests/e2e/appointment-booking.spec.ts` test 9, `appointment-cancel.spec.ts` test 9, and `appointment-reschedule.spec.ts` test 9 all cover a non-JSON buffer body and a missing/invalid field, but none send literal `null`).

**Fix:**
```ts
export function validateBookingInput(body: Record<string, unknown>): string | null {
  if (typeof body !== "object" || body === null) {
    return "Slot is required.";
  }
  const slotId = body.slotId;
  ...
}
```
Apply the same guard at the top of `validateRescheduleInput` and `validateCancelInput`, or — more centrally — normalize `body` to `{}` at each call site whenever `typeof body !== "object" || body === null` before passing it to the validator.

### WR-02: `reschedule` route has no `MR005` branch, so a session that expires between the guard check and the RPC call surfaces as a misleading 500 instead of 401

**File:** `app/api/appointments/[id]/reschedule/route.ts:56-87`
**Issue:** The sibling cancel route explicitly maps `MR005` (no `auth.uid()`) to a 401 (`app/api/appointments/[id]/cancel/route.ts:73-75`). The reschedule route's error-branching (lines 60-86) only checks `MR001`, `MR002`, `MR004`, and `40P01` — there is no `MR005` case, so if `reschedule_appointment()` ever raises it (e.g. a token that expires in the narrow window between `requirePatient()`'s check and the `.rpc()` call), the response falls through to the generic `GENERIC_FAILURE_MESSAGE` 500 branch rather than reporting the more accurate and already-established 401. Low practical likelihood, but it is an easy, cheap, and already-precedented fix, and the current asymmetry between the two sibling routes is itself worth closing.
**Fix:**
```ts
if (error?.code === "MR005") {
  return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
}
```
Add this branch alongside the existing `MR001`/`MR002`/`MR004`/`40P01` checks in `app/api/appointments/[id]/reschedule/route.ts`.

## Info

### IN-01: Migration filename says "_patient", the policy it creates is doctor-facing

**File:** `supabase/migrations/20260811090000_add_profiles_select_via_own_appointment_patient.sql:1-27`
**Issue:** The filename suffix `_via_own_appointment_patient` reads as "a patient's own appointment," but the policy created (`profiles_select_via_own_appointment_doctor`) grants visibility in the opposite direction — a **doctor** reading a **patient's** profile row. The file's own header comment correctly describes the doctor-facing intent, so this is a naming inconsistency between the filename and its content only, not a functional defect, but it will mislead anyone scanning migration filenames for what touches "patient" vs "doctor" visibility.
**Fix:** None required functionally; if a follow-up migration touches this area, consider renaming forward (e.g. a future `...patient_profile_visible_to_doctor...` migration) rather than renaming this already-applied file.

---

_Reviewed: 2026-08-11T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
