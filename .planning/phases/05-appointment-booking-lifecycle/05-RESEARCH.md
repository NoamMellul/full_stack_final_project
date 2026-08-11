# Phase 5: Appointment Booking & Lifecycle - Research

**Researched:** 2026-08-10
**Domain:** Postgres transactional concurrency (conditional `UPDATE` locking vs `SELECT ... FOR UPDATE`), `SECURITY DEFINER` RPC functions callable from Next.js Route Handlers via supabase-js, Postgres error-code → REST error translation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** The existing disabled "Select this slot" button on `/doctors/[id]` (`app/doctors/[id]/page.tsx:212-214`) becomes the real booking entry point — enabled, wired to open a confirmation modal instead of a new dedicated page.
- **D-02:** Confirmation modal shows doctor name, specialty, appointment date, appointment time, and location (address/neighborhood), all in `Asia/Jerusalem`, before the booking is created. Patient must explicitly confirm.
- **D-03:** On successful booking: create the `appointments` row and atomically flip the slot to `booked` (single transaction/RPC — see D-11), then redirect the patient to `/patient/appointments` and show a success message there ("Your appointment has been booked successfully."). No separate dedicated booking-confirmation page/route.
- **D-04:** If an unauthenticated visitor clicks "Select this slot," redirect to login; return them to the doctor/slot they were booking afterward if reasonably simple with the existing `proxy.ts`/`?from=` redirect pattern. Reversible: a plain post-login redirect to the doctor's profile (losing the pre-selected slot) is an acceptable degradation.
- **D-05:** The booking endpoint must re-verify slot availability against the database at request time — never trust that a slot is available just because the client-rendered profile page showed it as such.
- **D-06:** Rescheduling is constrained to the same doctor as the original appointment. Moving to a different doctor is NOT a reschedule — cancel + book new as two separate actions. The reschedule endpoint must reject a `newSlotId` belonging to any doctor other than `appointments.doctor_id`.
- **D-07:** Reschedule starts from `/patient/appointments`: an upcoming appointment gets a "Reschedule" action that opens a modal/drawer listing that same doctor's currently available future slots (reusing the existing availability-fetch pattern, scoped to `doctor_id` + `status = 'available'` + future `start_at`).
- **D-08:** Reschedule keeps the same `appointments` row identity — update `slot_id` in place, never create a second appointment row for the same booking. No reschedule-history/audit table this phase.
- **D-09:** The reschedule operation is one atomic business operation: verify the new slot is still available, then release the old slot and reserve the new slot and update the appointment in the same transaction — the old slot must never be visibly released before the new slot is confirmed secured (no window where neither slot is held).
- **D-10:** Reschedule must reject: a new slot in the past, a `blocked` new slot, an already-`booked` new slot, a new slot belonging to another doctor (D-06), an already-cancelled appointment, or an appointment whose `start_at` has already passed.
- **D-11:** Both booking and reschedule are implemented as single-transaction Postgres functions (per TASKS.md's `book_appointment(slot_id, patient_id)`), called via RPC from the route handler — matching Phase 4's "the DB constraint is the real guarantee, the app layer translates the error" philosophy. Exact locking mechanism (`SELECT ... FOR UPDATE` vs unique index + status update) is the researcher's discretion — resolved below.
- **D-12:** Both the patient who booked it and the owning doctor can cancel an upcoming appointment. Cancellation is allowed at any time before `start_at`; once `start_at` has passed, the normal cancellation flow no longer applies.
- **D-13:** Cancellation reason is optional free text, stored in `appointments.cancelled_reason`, entered via a confirmation modal.
- **D-14:** Status is set to `cancelled_by_patient` or `cancelled_by_doctor` depending on who cancelled. The `appointments` row is never deleted.
- **D-15:** Cancelling releases the linked `availability_slots` row back to `available`, but only if it's still in the future (Claude's discretion on the exact edge-case handling).
- **D-16:** No automatic DB status transition to `completed`/`no_show` this phase. `appointments.status` stays `scheduled`/`confirmed` unless an explicit cancellation action changes it.
- **D-17:** The UI derives a "Past" label whenever `start_at < now` AND status is still `scheduled`/`confirmed` — presentation-only, never written to the DB. Cancelled appointments always display their real cancellation status.
- **D-18:** Upcoming/past split on both `/patient/appointments` and `/doctor/appointments` is computed purely from `start_at` vs current time, not from a status field.
- **D-19:** Only authenticated patients can book; doctors and admins do not book through the patient booking flow. A patient cannot book a slot belonging to an inactive (`is_active = false`) doctor.
- **D-20:** A patient can only view/manage their own appointments; a doctor can only view/manage appointments where they are the owning doctor (existing RLS already enforces this — app-level checks are defense-in-depth).
- **D-21:** All date/time logic uses `Asia/Jerusalem` for display/input, converted to/from UTC via the existing `lib/timezone.ts` helpers.

### Claude's Discretion

- Exact Postgres function signature/locking strategy for `book_appointment`/reschedule (D-11) — resolved in this document (see "Locking Strategy" below).
- Exact styling/wording of the "Past" label (D-17), the booking success message (D-03), and the cancellation confirmation modal copy (D-13).
- Exact shape of the new-slot picker for reschedule (D-07) — modal vs drawer.
- Whether the login-redirect-and-return flow (D-04) preserves the specific pre-selected slot or just returns to the doctor's profile.
- Exact content/copy of the `notifications` rows created on booking/cancel/reschedule.

### Deferred Ideas (OUT OF SCOPE)

- Reschedule audit/history trail — update `slot_id` in place, no new table (D-08).
- Doctor-initiated completed/no-show marking — deferred to a future explicit action (D-16).
- Cross-doctor rescheduling — not "a reschedule" at all (D-06); if wanted later, it's cancel + new booking, already fully supported.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| APPT-01 | Patient can book an available slot with a doctor | `book_appointment()` function design, `POST /api/appointments` skeleton, `requirePatient()` guard pattern |
| APPT-02 | The system prevents two patients from ever booking the same slot | Locking Strategy section — conditional `UPDATE ... WHERE status = 'available'` + `appointments_active_slot_unique_idx` as the layered guarantee; Validation Architecture concurrency test |
| APPT-03 | Patient cannot book a slot in the past | `book_appointment()`'s `start_at > now()` predicate inside the same atomic `UPDATE` |
| APPT-04 | Booking a slot marks it unavailable immediately | Same atomic `UPDATE` — `availability_slots.status` flips within the same statement that validates availability, no separate step |
| APPT-05 | Patient can cancel their own upcoming appointment | `cancel_appointment()` function design, ownership resolution via `auth.uid()` |
| APPT-06 | Doctor can cancel a patient's appointment | Same function, `is_doctor_owner`-equivalent resolution of the doctor actor |
| APPT-07 | Cancelling an appointment frees the slot for rebooking | `cancel_appointment()`'s slot-release `UPDATE`, D-15 future-only guard |
| APPT-08 | Patient can reschedule an appointment to another available slot | `reschedule_appointment()` function design |
| APPT-09 | Rescheduling releases the old slot and reserves the new one atomically | Reschedule statement ordering (reserve-new-before-release-old), Common Pitfalls (deadlock scenario, momentary double-booked window is safe-by-design) |
| APPT-10 | Patient can view their upcoming appointments | `GET /api/patient/appointments`, upcoming/past split pattern (D-18) |
| APPT-11 | Patient can view their past appointments | Same endpoint, `start_at < now()` split |
| APPT-12 | Doctor can view their upcoming appointments | `GET /api/doctor/appointments`, reuse of `APPOINTMENT_SELECT` join shape from `app/api/admin/appointments/route.ts` |
| APPT-13 | Doctor can view their past appointments | Same endpoint, same split |

</phase_requirements>

## Summary

This phase's business rules are fully locked in `05-CONTEXT.md`; the one genuinely open technical question — explicitly flagged by the user as the researcher's discretion (D-11) — is the exact locking/atomicity design for `book_appointment()` and the reschedule operation, and how their Postgres errors surface cleanly through the REST layer. This document resolves that question with a concrete, verified design.

**The recommended mechanism is a single atomic conditional `UPDATE ... WHERE status = 'available' ... RETURNING`,** not an explicit `SELECT ... FOR UPDATE` followed by a separate `UPDATE`. A conditional `UPDATE` takes its row lock and re-checks its `WHERE` predicate in one indivisible statement: under Postgres's default `READ COMMITTED` isolation, if a second concurrent transaction targets the same row, it blocks on the first transaction's row lock, then — critically — re-evaluates the `WHERE status = 'available'` clause against the row's *post-commit* value once unblocked. If the first transaction already flipped the status, the second transaction's `UPDATE` matches zero rows and returns cleanly; no explicit lock/unlock choreography, no window for a second statement to race in between. This is the officially-documented single-statement alternative to two-statement `SELECT ... FOR UPDATE` + `UPDATE` locking (curated in this project's own `supabase-postgres-best-practices` skill, `lock-deadlock-prevention.md` and `lock-short-transactions.md`), and it is strictly better here: fewer round trips, a shorter lock hold time, and no separate lock-acquisition step to get wrong. The `appointments_active_slot_unique_idx` partial unique index (already deployed in Phase 1) remains as a second, independent layer of the same guarantee — belt-and-braces against any code path that bypasses the function (see Common Pitfalls: RLS still permits a raw `appointments` insert).

Both `book_appointment()` and the reschedule operation must run as `SECURITY DEFINER` — not the Postgres default `SECURITY INVOKER` — because a patient legitimately needs to flip a *doctor-owned* `availability_slots` row's status, and the existing RLS policy `availability_slots_write_owner_or_admin` (Phase 1) only lets the owning doctor or an admin write to that table. A `SECURITY INVOKER` function called by a patient would fail that RLS check on its very first statement. Running as `SECURITY DEFINER` bypasses RLS entirely for the function body, which means the function itself becomes the sole authorization boundary — it must never trust a client-supplied patient/doctor identity, only `auth.uid()`, exactly like the project's existing `is_admin()`/`is_doctor_owner()` helper functions already do.

**Primary recommendation:** One migration adds three `SECURITY DEFINER` PL/pgSQL functions — `book_appointment(p_slot_id uuid)`, `reschedule_appointment(p_appointment_id uuid, p_new_slot_id uuid)`, and `cancel_appointment(p_appointment_id uuid, p_reason text)` — each built on the conditional-`UPDATE` pattern, each raising a small, fixed set of custom `SQLSTATE` codes (`MR001`–`MR005`, verified as a legal custom-code format) so the Route Handlers can branch on `error.code` exactly as Phase 4 already does for `23P01`/`23514`, never on `error.message`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Confirmation modal, slot re-fetch guard, success/cancel copy | Browser / Client | API / Backend | Client Component collects confirmation and calls the API; all authority lives server-side (D-05) |
| Booking/cancel/reschedule authorization (patient/doctor identity resolution) | API / Backend | Database / Storage | `requirePatient()`/`requireDoctor()` guards give clean 401/403; the `SECURITY DEFINER` functions re-derive identity from `auth.uid()` independently as the real boundary, since RLS is bypassed inside them |
| Double-booking prevention (APPT-02) | Database / Storage | — | The conditional `UPDATE` + partial unique index are the actual guarantee (matches PROJECT.md's core-value framing); the API only translates failure into a message |
| Reschedule atomicity (no window with neither slot held, APPT-09) | Database / Storage | — | Statement ordering inside one PL/pgSQL function body, which is itself one implicit transaction — Postgres's own rollback-on-exception semantics deliver "all or nothing" for free |
| Notification row creation | Database / Storage | API / Backend | Cheapest and most atomic when inserted inside the same `SECURITY DEFINER` function (bypasses the `notifications` table's no-insert-policy-for-users RLS for free); acceptable fallback is a separate app-layer insert via the service-role client if the planner prefers to keep the SQL function narrowly scoped |
| Upcoming/past split, "Past" label derivation (D-17/D-18) | Browser / Client | API / Backend | Presentation-only computation from `start_at` vs `now()`; API returns raw rows, UI derives the label — never written back |
| Appointment list read access (patient/doctor scoping) | API / Backend | Database / Storage | `appointments_select_own_or_admin` RLS (Phase 1) is the real authority; API-level `.eq("patient_id", ...)`/`.eq("doctor_id", ...)` restates it for a predictable query shape, matching D-20 |

## Standard Stack

This phase introduces **no new external packages or libraries**. It is built entirely on infrastructure already installed and verified in this project: `@supabase/supabase-js@^2.112.0`, `@supabase/ssr@^0.12.4`, Next.js 16.2.12 Route Handlers, `components/ui/dialog.tsx` (shadcn, already present), and native PL/pgSQL/Postgres (no extension beyond `btree_gist`, already enabled in Phase 1).

### Core (already installed, reused)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.112.0 [VERIFIED: package.json:16] | `.rpc()` calls to the new Postgres functions from Route Handlers | Already the project's sole DB access layer; `.rpc()` is the same mechanism `schema-connectivity.spec.ts` already exercises against `is_admin`/`is_doctor_owner` |
| `components/ui/dialog.tsx` | n/a (local shadcn component) [VERIFIED: `Glob` confirmed file exists this session] | Booking confirmation modal (D-02), cancellation confirmation modal (D-13), reschedule slot-picker modal (D-07) | Already generated by `shadcn init`; every prior phase's confirmation UI reuses local `components/ui/*` rather than adding a dialog library |
| `lib/timezone.ts` | n/a (local module) | Asia/Jerusalem display/conversion for every date/time shown or submitted this phase | Single project-wide conversion module (D-21); already used by Phases 3/4 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| — | — | — | No supporting libraries needed; this phase is pure Postgres functions + existing REST/UI conventions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Conditional `UPDATE ... WHERE status = 'available' RETURNING` (recommended) | Explicit `SELECT ... FOR UPDATE` then separate `UPDATE` | Two round trips instead of one, longer lock hold, and a real (if small) window between the `SELECT` and the `UPDATE` where a bug could reintroduce a race if anyone ever "forgets" the second statement is conditional on the read. The single-statement form is strictly safer and is what the project's own curated Postgres skill recommends for exactly this "seat/slot reservation" shape. |
| Relying purely on `appointments_active_slot_unique_idx` + a non-conditional `availability_slots.status` update (i.e., mirroring Phase 4's "let the DB constraint alone catch it" pattern literally) | — | Phase 4's overlap constraint is a genuine DB-level exclusion constraint that catches *any* insert path automatically, with no separate status write to get right. Appointments' anti-double-booking mechanism is structurally different: it is a unique index on `appointments`, not on `availability_slots`, so relying on it *alone* would still require a **separate, unconditional** `availability_slots.status = 'booked'` write — and an unconditional write can't detect "was this slot actually available," so a stale/already-booked slot could be silently re-marked `booked` by a second, ultimately-rejected request, corrupting `availability_slots.status` even though the `appointments` insert itself correctly fails on `23505`. The conditional `UPDATE` closes exactly this gap by making the status flip itself the availability check. |
| `SECURITY DEFINER` functions (recommended) | Plain `.insert()`/`.update()` calls from the Route Handler under RLS (`SECURITY INVOKER`-equivalent) | Would require RLS to grant patients write access to doctor-owned `availability_slots` rows, which is a much larger and more dangerous surface (any patient could then write to any doctor's schedule via a direct REST call, not just through the function's narrow, validated path) |

**Installation:** None — no `npm install` needed this phase.

## Package Legitimacy Audit

**Not applicable.** This phase adds zero new npm/pip/crates dependencies — see Standard Stack above. No package-legitimacy check was run because there is nothing to check.

## Architecture Patterns

### System Architecture Diagram

```
Patient browser (Client Component)
   │  1. clicks "Select this slot" on /doctors/[id] (D-01)
   ▼
Confirmation modal (Dialog) — shows doctor/specialty/date/time/location (D-02)
   │  2. patient confirms
   ▼
POST /api/appointments  { slotId }
   │  3. requirePatient() guard: 401 if unauthenticated, resolves auth.uid()
   │  4. manual validation: slotId is a well-formed UUID
   ▼
supabase.rpc("book_appointment", { p_slot_id })  ── runs as SECURITY DEFINER, one transaction
   │
   ├─ UPDATE availability_slots                          ◄── the atomic guarantee (APPT-02/03/04)
   │    SET status = 'booked'
   │  WHERE id = p_slot_id
   │    AND status = 'available'
   │    AND start_at > now()
   │    AND doctor is_active
   │  RETURNING doctor_id
   │      │
   │      ├─ 0 rows ──► RAISE EXCEPTION 'Slot no longer available' USING ERRCODE = 'MR001'
   │      │                    │
   │      │                    ▼
   │      │             entire transaction rolls back — nothing else in this
   │      │             function ever executes (Postgres auto-rollback on
   │      │             unhandled exception inside a function body)
   │      │
   │      └─ 1 row ──► continue
   │
   ├─ INSERT INTO appointments (slot_id, patient_id, doctor_id, status='scheduled')
   │      backstop: ON unique_violation (23505) → RAISE 'MR001' too (defense-in-depth,
   │      should be unreachable given the conditional UPDATE above)
   │
   └─ INSERT INTO notifications (patient: booking confirmed, doctor: new booking)
        (bypasses notifications' no-user-insert RLS for free, since this function
         is SECURITY DEFINER)
   ▼
Route Handler catches error.code:
   MR001 → 409 "This slot is no longer available."
   other → 500 generic
   success → 201, then a follow-up SELECT (session-bound client, RLS-scoped)
             to build the response body (reuses APPOINTMENT_SELECT-style join)
   ▼
Client redirects to /patient/appointments, shows success banner (D-03)


Reschedule (same shape, PATCH /api/appointments/[id]/reschedule):

   SELECT * FROM appointments WHERE id = :id AND patient_id = auth.uid() FOR UPDATE
        │  locks THIS appointment row first — serializes any concurrent
        │  reschedule/cancel attempt on the SAME appointment (see Pitfall 2)
        ▼
   validate: not cancelled, current slot's start_at still future (D-10)
        ▼
   UPDATE availability_slots SET status='booked'                  ◄─ reserve NEW slot FIRST
     WHERE id = new_slot_id AND doctor_id = <this appt's doctor_id>
       AND status='available' AND start_at > now()
     RETURNING id
        │  0 rows → RAISE 'MR001' → whole transaction rolls back,
        │           OLD slot is untouched, nothing was ever released (D-09)
        ▼
   UPDATE availability_slots SET status='available'                ◄─ THEN release OLD slot
     WHERE id = <old slot id>
        ▼
   UPDATE appointments SET slot_id = new_slot_id WHERE id = :id
        ▼
   INSERT notifications for the other party
```

### Recommended Project Structure
```
supabase/migrations/
└── 20260810120000_add_appointment_booking_functions.sql   # book_appointment, reschedule_appointment, cancel_appointment

lib/
├── auth/
│   └── require-patient.ts        # new — mirrors require-doctor.ts, resolves auth.uid() directly (profiles.role = 'patient')
└── validation/
    └── appointments.ts           # new — validateBookingInput, validateRescheduleInput, validateCancelInput (UUID shape, optional reason length cap)

app/api/
├── appointments/
│   └── route.ts                  # POST — book
├── appointments/[id]/
│   ├── cancel/route.ts           # PATCH
│   └── reschedule/route.ts       # PATCH
├── patient/appointments/
│   └── route.ts                  # GET — upcoming/past split
└── doctor/appointments/
    └── route.ts                  # GET — upcoming/past split

app/patient/appointments/
└── page.tsx                      # new — tabs/sections, cancel + reschedule actions

app/doctor/(gated)/appointments/
└── page.tsx                      # new — tabs/sections, cancel action

app/doctors/[id]/page.tsx         # modified — enable "Select this slot", add confirmation modal
```

### Pattern 1: Conditional `UPDATE` as the atomic availability check

**What:** Combine "is this row still valid to claim" and "claim it" into one `UPDATE ... WHERE <condition> RETURNING`. Never split into a `SELECT` (to check) and a separate `UPDATE` (to claim).

**When to use:** Any time a shared resource's availability must be checked and flipped atomically — the exact "slot reservation" / "seat booking" shape this whole phase is built on.

**Example (booking):**
```sql
-- Source: this project's supabase-postgres-best-practices skill,
-- lock-deadlock-prevention.md ("Alternative: use a single statement to
-- update atomically") and lock-short-transactions.md ("Correct: minimal
-- transaction scope" — UPDATE ... WHERE status = 'pending' RETURNING *).
UPDATE public.availability_slots AS s
   SET status = 'booked'
 WHERE s.id = p_slot_id
   AND s.status = 'available'
   AND s.start_at > now()
   AND EXISTS (
     SELECT 1 FROM public.doctors d WHERE d.id = s.doctor_id AND d.is_active
   )
 RETURNING s.doctor_id INTO v_doctor_id;

IF NOT FOUND THEN
  RAISE EXCEPTION 'This slot is no longer available.' USING ERRCODE = 'MR001';
END IF;
```
This single statement satisfies APPT-02 (double-booking), APPT-03 (past slot), APPT-04 (immediate unavailability), and D-19 (inactive-doctor guard) all at once — there is no separate step where any of these could be individually forgotten or raced.

### Pattern 2: `SECURITY DEFINER` function with identity resolved from `auth.uid()`, never a parameter

**What:** The function's only parameters are the *targets* of the operation (`slot_id`, `appointment_id`, `new_slot_id`). The *actor* (which patient, which doctor) is always resolved inside the function body from `auth.uid()` — never accepted as a caller-supplied argument.

**When to use:** Every `SECURITY DEFINER` function in this phase. This mirrors the existing `is_doctor_owner(target_doctor_id)` pattern, which likewise never trusts a caller-supplied identity for authorization — only the target.

**Example:**
```sql
-- Source: supabase/migrations/20260803230000_initial_schema.sql:166-177
-- (existing is_doctor_owner pattern this phase's functions mirror)
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
```
TASKS.md's literal signature `book_appointment(slot_id, patient_id)` should be narrowed to `book_appointment(p_slot_id uuid)` — a `patient_id` parameter would let a compromised or buggy caller book on behalf of an arbitrary patient, since the function bypasses RLS. Resolve `patient_id` as `auth.uid()` on the `INSERT` instead (matches the project's established "never trust a client-supplied identity" convention — see `lib/auth/require-doctor.ts`'s comment on `doctors.profile_id = auth.uid()`, and Phase 4's `04-02-SUMMARY.md` note that `doctorId` in a request body is "inert").

### Pattern 3: Reserve-then-release statement ordering for reschedule (D-09)

**What:** Inside `reschedule_appointment`, always reserve the *new* slot before releasing the *old* slot. At every point in the transaction, at least one of the two slots is `booked` — there is a brief window where **both** are `booked` simultaneously, never a window where **neither** is.

**When to use:** `reschedule_appointment()` exclusively.

```sql
-- 1. Lock and validate the appointment itself first (see Pitfall 2 — this
--    also closes a cross-request race on the SAME appointment).
SELECT * INTO v_appt FROM public.appointments
 WHERE id = p_appointment_id AND patient_id = auth.uid()
 FOR UPDATE;
IF NOT FOUND THEN
  RAISE EXCEPTION 'Appointment not found.' USING ERRCODE = 'MR004';
END IF;
IF v_appt.status IN ('cancelled_by_patient', 'cancelled_by_doctor') THEN
  RAISE EXCEPTION 'This appointment can no longer be rescheduled.' USING ERRCODE = 'MR002';
END IF;

SELECT start_at INTO v_old_start
  FROM public.availability_slots WHERE id = v_appt.slot_id;
IF v_old_start <= now() THEN
  RAISE EXCEPTION 'This appointment can no longer be rescheduled.' USING ERRCODE = 'MR002';
END IF;

-- 2. Reserve the NEW slot (same doctor only — D-06).
UPDATE public.availability_slots AS s
   SET status = 'booked'
 WHERE s.id = p_new_slot_id
   AND s.doctor_id = v_appt.doctor_id
   AND s.status = 'available'
   AND s.start_at > now()
 RETURNING s.id INTO v_reserved;
IF NOT FOUND THEN
  RAISE EXCEPTION 'This slot is not available for rescheduling.' USING ERRCODE = 'MR001';
END IF;

-- 3. Only now release the OLD slot.
UPDATE public.availability_slots
   SET status = 'available'
 WHERE id = v_appt.slot_id AND start_at > now();

-- 4. Update the appointment row in place (D-08).
UPDATE public.appointments
   SET slot_id = p_new_slot_id
 WHERE id = p_appointment_id;
```
If step 2 raises, Postgres rolls back the entire function invocation — the old slot was never touched, so "old slot released before new slot confirmed" (the anti-pattern D-09 explicitly forbids) cannot happen even under exception paths, not just the happy path.

### Anti-Patterns to Avoid
- **`SELECT ... FOR UPDATE` on `availability_slots` followed by a separate conditional-free `UPDATE`:** splits one atomic operation into two statements for no benefit over the single-statement form, and invites a future edit to "simplify" the second statement into an unconditional one, silently reintroducing the race.
- **Passing `patient_id`/`doctor_id` as RPC parameters into a `SECURITY DEFINER` function:** bypasses RLS, so the function itself must be the authorization boundary — accepting identity as a parameter (rather than resolving it from `auth.uid()`) makes it trivially spoofable by any authenticated caller who invokes the RPC directly.
- **Releasing the old slot before confirming the new slot in reschedule:** the exact anti-pattern D-09 forbids by name ("temporarily release old slot") — creates a window where a third party can book the just-released old slot while the reschedule is still in flight, potentially leaving the rescheduling patient with *no* slot if the new-slot reservation then fails.
- **Branching on `error.message` instead of `error.code`:** already an established project anti-pattern (Phase 4 comments explicitly call this out); this phase's custom `SQLSTATE` codes exist specifically so the Route Handler never needs to inspect message text.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slot availability check-and-claim | An application-level "check availability via SELECT, then trust it in a later UPDATE" flow, or a hand-rolled advisory-lock scheme (`pg_advisory_lock`) | The conditional `UPDATE ... WHERE status = 'available' ... RETURNING` pattern | Postgres's own MVCC + row-level locking already gives exactly the right semantics for "claim if still available" in one statement; advisory locks add complexity (must remember to release, don't compose with RLS) for a problem row-level locking already solves natively |
| Multi-step atomicity across `appointments` + `availability_slots` | Two sequential `supabase-js` `.update()` calls from the Route Handler with manual "if the second fails, try to undo the first" compensation logic | A single `SECURITY DEFINER` Postgres function (one implicit transaction) | supabase-js/PostgREST has no client-side multi-table transaction primitive — each `.from(...).update()` is its own independent request/transaction. Compensating-transaction logic in application code is exactly the kind of hand-rolled distributed-transaction bug source Postgres functions exist to avoid |
| Distinguishing rejection reasons in the API layer | Regex/substring matching on the Postgres error message | Distinct custom `SQLSTATE` codes (`MR001`..`MR005`) raised explicitly by the function, branched on `error.code` | Error message text is not a stable API contract (can change with a Postgres version, a locale setting, or a future refactor of the function body); `SQLSTATE` codes are explicit and stable, matching the project's own `23P01`/`23514` precedent |

**Key insight:** every genuinely hard part of this phase (the double-booking guarantee, the reschedule atomicity) is a solved problem at the Postgres row-locking level — the phase's job is to use that machinery correctly (one statement, one transaction, explicit identity resolution), not to reimplement any part of it in TypeScript.

## Common Pitfalls

### Pitfall 1: RLS still allows a patient to `INSERT` into `appointments` directly, bypassing `book_appointment()` entirely
**What goes wrong:** The existing Phase 1 RLS policy `appointments_insert_patient` (`for insert with check (patient_id = auth.uid())`) permits *any* authenticated patient to `POST` an `appointments` row straight through PostgREST (e.g., `supabase.from("appointments").insert(...)`), with no requirement that they went through `book_appointment()`.
**Why it happens:** `book_appointment()` is additive — it does not, by itself, close off the plain insert path RLS already grants.
**How to avoid:** The `appointments_active_slot_unique_idx` partial unique index still prevents a genuine double-booking even via this path (APPT-02 holds regardless of entry point — this is precisely why the unique index is kept as a second layer, not removed once the function exists). What it does **not** prevent: a direct insert leaves `availability_slots.status` untouched (still `'available'`), silently breaking APPT-04 (immediate unavailability) and letting the slot keep showing as bookable in search even though it now has an active appointment. Two options for the planner: (a) accept this as a residual gap the app code simply never triggers (all first-party code paths always go through the RPC — the same trust model already used everywhere else in this codebase, e.g. RLS-permitted `doctors_admin_write` is likewise never invoked directly by non-admin code), or (b) tighten `appointments_insert_patient`'s `WITH CHECK` clause (or drop client `INSERT` privilege on `appointments` entirely) in the same migration that adds the functions, forcing all inserts through `book_appointment()`. Recommendation: (b) is a small, low-risk addition to the migration already required this phase and closes the gap completely; flagged as a discretionary hardening step for the planner to decide, not a blocking requirement.
**Warning signs:** A search result or profile page showing a slot as available that actually has an active appointment.

### Pitfall 2: Two concurrent reschedule attempts (or a reschedule racing a cancel) on the *same* appointment can produce a leaked "orphaned booked slot"
**What goes wrong:** If two reschedule requests for the same appointment (to two different new slots, A and B) run without first locking the appointment row, both could independently succeed in reserving their respective new slot (no lock conflict between two different `availability_slots` rows), and then both attempt `UPDATE appointments SET slot_id = ...` — the second write wins, and the first request's reserved slot is left `status = 'booked'` with no appointment row pointing at it: booked forever, unbookable, unreleasable through any normal flow.
**Why it happens:** Locking only the slot rows (not the appointment row) doesn't serialize two requests that each target a *different* slot but the *same* appointment.
**How to avoid:** `SELECT * FROM appointments WHERE id = p_appointment_id ... FOR UPDATE` as the very first statement in both `reschedule_appointment()` and `cancel_appointment()`. This serializes any concurrent reschedule/cancel pair on the same appointment; the second request blocks until the first commits, then re-reads the appointment's *now-current* `slot_id` and status, so it correctly sees the appointment as already changed and can reject cleanly instead of racing.
**Warning signs:** A `booked` slot with no matching active `appointments.slot_id` reference — detectable with `SELECT s.* FROM availability_slots s WHERE s.status = 'booked' AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.slot_id = s.id AND a.status NOT IN ('cancelled_by_patient','cancelled_by_doctor'))`.

### Pitfall 3: A genuine two-appointment "slot swap" can deadlock — and that's expected, not a bug to eliminate
**What goes wrong:** If patient X reschedules appointment X from slot A to slot B, and — in the same instant — patient Y reschedules appointment Y from slot B to slot A (each targeting the slot the *other* transaction is about to release), the two transactions can form a genuine circular wait: transaction X blocks reserving slot B (still held by Y), while transaction Y blocks reserving slot A (still held by X). Postgres's deadlock detector (default `deadlock_timeout` 1s) will detect this and abort **one** of the two transactions with SQLSTATE `40P01` (`deadlock_detected`), rolling it back cleanly — the other proceeds normally. This is Postgres protecting the system, not a hang.
**Why it happens:** Genuine circular resource dependency between two independent transactions; this is a known, documented Postgres behavior (see the project's `lock-deadlock-prevention.md` skill reference), not specific to this schema.
**How to avoid:** Do not try to eliminate the possibility (over-engineering for this project's scope — it requires two patients to submit reschedule requests targeting each other's about-to-be-vacated slot in the same instant, an extremely narrow window in practice). Instead, catch `40P01` in the Route Handler alongside `MR001`/`MR002` and translate it to the same class of clean, retryable rejection (e.g., 409 "Could not complete this reschedule right now — please try again."). Never let it surface as an unhandled 500.
**Warning signs:** An intermittent 500 from the reschedule endpoint under load/concurrency testing that disappears on retry — check `error.code === "40P01"` before assuming a bug.

### Pitfall 4: Writing to `appointments.status` = `'completed'`/`'no_show'` anywhere in this phase
**What goes wrong:** TASKS.md's own `book_appointment` sketch and the `appointments` check constraint both list `completed`/`no_show` as valid statuses, which can tempt an implementer into "helpfully" transitioning elapsed appointments automatically.
**Why it happens:** The status column visually invites a full lifecycle implementation; D-16 explicitly forbids it this phase (the system cannot know attendance).
**How to avoid:** The only statuses this phase's functions ever write are `scheduled` (on booking), `cancelled_by_patient`/`cancelled_by_doctor` (on cancel). "Past" is a UI-computed label (D-17), never a status value. Grep for `'completed'` or `'no_show'` as a write target in this phase's diff — it should never appear.
**Warning signs:** Any `UPDATE appointments SET status = 'completed'` (or `'no_show'`) anywhere in new code.

### Pitfall 5: Forgetting the `is_active` doctor guard on reschedule, only adding it to booking
**What goes wrong:** D-19 explicitly names "cannot book a slot belonging to an inactive doctor" for the booking flow; nothing in D-06–D-10 explicitly re-states this for reschedule's new-slot check, and it is easy to copy the booking predicate for the initial `book_appointment()` write and forget the same `EXISTS (SELECT 1 FROM doctors WHERE is_active)` clause when writing `reschedule_appointment()`'s new-slot reservation `UPDATE`.
**Why it happens:** The two functions share almost identical reservation logic, but only one of them was explicitly spelled out.
**How to avoid:** Apply the same `is_active` guard to both. Flagged also in Open Questions below as worth an explicit confirmation, since it's a genuine ambiguity in the locked decisions rather than a clearly restated rule.
**Warning signs:** A patient successfully rescheduling into a slot belonging to a doctor an admin just deactivated.

## Code Examples

### `lib/auth/require-patient.ts` (new — mirrors `require-doctor.ts`)
```typescript
// Source: pattern mirrors lib/auth/require-doctor.ts and lib/auth/require-admin.ts
// (both read this session). No `doctors`-style join is needed: per Phase 1 D-07
// ("no separate patients table — patients are just profiles rows with
// role = 'patient'"), the patient's id IS auth.uid() directly.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type PatientGuardResult =
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
  | { ok: false; response: NextResponse };

export async function requirePatient(): Promise<PatientGuardResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error || profile?.role !== "patient") {
    return { ok: false, response: NextResponse.json({ error: "Not authorized." }, { status: 403 }) };
  }

  return { ok: true, supabase, userId: user.id };
}
```

### `POST /api/appointments` — RPC call and error translation
```typescript
// Source: error-branching style verified against
// app/api/doctor/slots/route.ts (23P01/23514 pattern, read this session).
const { data: appointmentId, error } = await guard.supabase.rpc("book_appointment", {
  p_slot_id: slotId,
});

if (error || !appointmentId) {
  if (error?.code === "MR001") {
    return NextResponse.json({ error: "This slot is no longer available." }, { status: 409 });
  }
  return NextResponse.json({ error: "Could not book this appointment. Please try again." }, { status: 500 });
}

// Follow-up read on the session-bound client — RLS (appointments_select_own_or_admin)
// naturally scopes this to the caller's own row; reuses the join shape already
// established in app/api/admin/appointments/route.ts's APPOINTMENT_SELECT.
const { data: appointment } = await guard.supabase
  .from("appointments")
  .select(APPOINTMENT_SELECT)
  .eq("id", appointmentId)
  .single();

return NextResponse.json({ appointment }, { status: 201 });
```

### Calling convention for `.rpc()` — parameter names must match the SQL function's argument names exactly
```typescript
// Source: [VERIFIED: supabase/migrations/20260803230000_initial_schema.sql:166-167
// `is_doctor_owner(target_doctor_id uuid)`, cross-checked against
// tests/e2e/schema-connectivity.spec.ts:34-36
// `admin.rpc("is_doctor_owner", { target_doctor_id: "00000000-..." })`]
// — this project already has a working, tested example of this exact
// calling convention; book_appointment(p_slot_id uuid) must be invoked as
// `.rpc("book_appointment", { p_slot_id: slotId })`, not `{ slotId }`.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `SELECT ... FOR UPDATE` then a separate `UPDATE` for "claim if available" flows | Single conditional `UPDATE ... WHERE <condition> RETURNING` | Long-standing Postgres pattern, not a recent change — but frequently still taught as the two-statement form in older tutorials | Fewer round trips, shorter lock duration, one less place to introduce a race by "simplifying" the second statement later |
| Supabase functions historically often written `SECURITY DEFINER` by default in older tutorials/templates | Current official Supabase guidance: prefer `SECURITY INVOKER` (the Postgres default) unless the function genuinely needs to bypass RLS; when `SECURITY DEFINER` is required, set `search_path` explicitly (official current recommendation: empty string `''` + fully-qualified `public.` references) | Reflected in current Supabase docs (`supabase.com/docs/guides/database/functions`) | This phase's functions are a legitimate, narrow case that *does* need `SECURITY DEFINER` (see Summary); this project's own existing `is_admin()`/`is_doctor_owner()` functions use `set search_path = public` (not the empty-string form) with fully-qualified `public.` references throughout — recommend Phase 5 match this **established in-repo convention** for consistency (both forms are secure as long as every reference is fully qualified, which both this project's existing functions and this phase's new ones do) rather than introducing a second, differently-hardened convention in the same codebase. |

**Deprecated/outdated:** None specific to this domain beyond the two items above.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `MR001`–`MR005` as the specific custom `SQLSTATE` code strings | Code Examples, Pattern 2/3 | Low — these are this research's own proposed values, not discovered from any external source; format legality (5 uppercase alphanumeric chars, not `00000`, not ending in `000`) is `[VERIFIED: postgresql.org/docs/current/plpgsql-errors-and-messages.html, fetched this session]`, but the exact strings are an arbitrary, collision-free choice the planner is free to rename |
| A2 | Recommending `cancel_appointment()` also be implemented as a third `SECURITY DEFINER` RPC function (for the same atomicity reasons as booking/reschedule), even though D-11 only names booking and reschedule explicitly | Summary, Architectural Responsibility Map | Low — if the planner instead chooses two sequential app-layer `.update()` calls for cancellation, a partial failure (status updated, slot release fails) degrades to a UX inconsistency (slot stays falsely unavailable), not a double-booking safety violation; recoverable, not catastrophic |
| A3 | Recommending tightening `appointments_insert_patient` RLS (or revoking direct `INSERT` on `appointments`) in the same migration, to fully close Pitfall 1's residual gap | Common Pitfalls (Pitfall 1) | Low — the double-booking guarantee (APPT-02) holds either way via the unique index; only the "immediate unavailability" UX guarantee (APPT-04) is at risk if this hardening step is skipped, and only via a bypass path no first-party code takes |

## Open Questions

1. **Should the `is_active` doctor guard apply to reschedule's new-slot check, not just booking's?**
   - What we know: D-19 explicitly states it for booking. D-06–D-10's exhaustive reschedule-rejection list (D-10) does not mention doctor activation status at all.
   - What's unclear: Whether a patient should be able to reschedule an *existing* appointment into a newly-added future slot of a doctor an admin has since deactivated.
   - Recommendation: Apply the same guard for consistency (Pitfall 5) — an inactive doctor shouldn't be able to receive *any* new booking, existing-patient reschedule or not — but flag this as worth a one-line confirmation from the user if the planner wants it locked rather than inferred.

2. **Should `cancel_appointment()` be a third `SECURITY DEFINER` RPC function, or two sequential app-layer writes?**
   - What we know: D-11 names booking and reschedule explicitly as "single-transaction Postgres functions." Cancellation's atomicity isn't explicitly required in the same sentence, though the same "DB constraint is the real guarantee" philosophy this phase is built on argues for consistency.
   - What's unclear: Whether the user considers two-statement cancellation (with its narrower, recoverable failure mode — see A2 above) an acceptable simplification versus a third function.
   - Recommendation: Build it as a third function for consistency and because it costs almost nothing extra (near-identical shape to the other two) — but this is safely reversible at plan time if the planner disagrees, since the two approaches only differ in atomicity guarantees, not schema or API surface.

3. **Exact wording/status-code split for reschedule's distinct rejection reasons (D-10's list)**
   - What we know: D-10 lists six distinct rejection conditions. This research groups them into two response classes (`MR001` "slot problem" covering past/blocked/booked/wrong-doctor; `MR002` "appointment problem" covering already-cancelled/already-elapsed), mirroring Phase 4's D-11 "keep the error message generic" simplicity philosophy.
   - What's unclear: Whether the user wants each of the six D-10 conditions to produce a *distinguishable* message instead of two generic buckets.
   - Recommendation: Two generic messages is consistent with Phase 4's established precedent and this phase's own CONTEXT.md silence on requiring per-condition wording; default to two buckets unless the planner's discretion prefers finer-grained copy.

## Environment Availability

No new external dependencies this phase (see Standard Stack). Supabase CLI, the linked remote Postgres project, Node/npm, and Playwright were all already verified working in Phases 1–4 and are unchanged here.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase remote Postgres project (migrations target) | New `book_appointment`/`reschedule_appointment`/`cancel_appointment` functions | ✓ (confirmed reachable in every prior phase's `schema-connectivity.spec.ts` run) | — | — |
| `btree_gist` extension | Not newly needed this phase (`availability_slots_no_overlap` already relies on it from Phase 1); no new exclusion constraint added here | ✓ | — | — |
| Playwright | Concurrency tests for APPT-02/APPT-09 (see Validation Architecture) | ✓ [VERIFIED: package.json:32 `"@playwright/test": "1.62.1"`] | 1.62.1 | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.62.1 [VERIFIED: package.json:32] |
| Config file | `playwright.config.ts` (existing, `fullyParallel: false`, `workers: 1` per `doctor-schedule-overlap.spec.ts` comment read this session) |
| Quick run command | `npx playwright test tests/e2e/appointment-booking.spec.ts` |
| Full suite command | `npx playwright test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| APPT-01 | Patient books an available slot | e2e | `npx playwright test tests/e2e/appointment-booking.spec.ts` | ❌ Wave 0 |
| APPT-02 | Two concurrent booking attempts on the same slot: exactly one 201, one 409 | e2e (concurrency, `Promise.all` — mirrors `doctor-schedule-overlap.spec.ts` case 1 pattern read this session) | same file | ❌ Wave 0 |
| APPT-03 | Booking a past slot rejected | e2e | same file | ❌ Wave 0 |
| APPT-04 | Booking immediately flips slot to unavailable (re-fetch profile, slot gone from list) | e2e | same file | ❌ Wave 0 |
| APPT-05 | Patient cancels own upcoming appointment | e2e | `tests/e2e/appointment-cancel.spec.ts` | ❌ Wave 0 |
| APPT-06 | Doctor cancels a patient's appointment | e2e | same file | ❌ Wave 0 |
| APPT-07 | Cancelling frees the slot for rebooking | e2e | same file | ❌ Wave 0 |
| APPT-08 | Patient reschedules to another available slot | e2e | `tests/e2e/appointment-reschedule.spec.ts` | ❌ Wave 0 |
| APPT-09 | Reschedule releases old + reserves new atomically, no window with neither held (concurrency: a concurrent booking attempt on the old slot during reschedule must never succeed until the reschedule's release step actually commits) | e2e (concurrency) | same file | ❌ Wave 0 |
| APPT-10/11 | Patient views upcoming/past appointments | e2e | `tests/e2e/appointment-history.spec.ts` | ❌ Wave 0 |
| APPT-12/13 | Doctor views upcoming/past appointments | e2e | same file | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** targeted spec file for the task's endpoint
- **Per wave merge:** `npx playwright test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/e2e/appointment-booking.spec.ts` — covers APPT-01/02/03/04
- [ ] `tests/e2e/appointment-cancel.spec.ts` — covers APPT-05/06/07
- [ ] `tests/e2e/appointment-reschedule.spec.ts` — covers APPT-08/09
- [ ] `tests/e2e/appointment-history.spec.ts` — covers APPT-10/11/12/13
- [ ] `tests/e2e/helpers/appointments.ts` already exists [VERIFIED: read this session] with `createTestAppointment`/`cleanupTestAppointments` fixtures (written in Phase 2 for admin-oversight tests, using the service-role client directly since `book_appointment()` didn't exist yet) — directly reusable for seeding pre-existing appointments in cancel/reschedule/history specs; the *booking* spec itself must exercise the real `POST /api/appointments` endpoint through `page.request`, not this fixture, to actually prove the RPC path.
- [ ] Framework install: none — Playwright already installed and configured.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (new) | Already covered by existing Supabase Auth session handling (Phase 1); this phase adds no new auth flow beyond the existing login redirect (D-04) |
| V3 Session Management | No (new) | Unchanged — reuses existing session-bound `createClient()` |
| V4 Access Control | Yes | `requirePatient()`/`requireDoctor()` guards (app-level) + `appointments_select_own_or_admin`/`appointments_update_own_or_admin` RLS (DB-level, already deployed) + identity resolved from `auth.uid()` inside every `SECURITY DEFINER` function (never a client-supplied id) |
| V5 Input Validation | Yes | Manual TypeScript validators (`lib/validation/appointments.ts`) for UUID shape on `slotId`/`appointmentId`/`newSlotId`, and an optional length cap on the cancellation `reason` free-text field (recommend reusing the existing 2000-char cap already established in `lib/validation/availability.ts` for the analogous `reason` field, `[CITED: lib/validation/availability.ts, read this session, lines 81]`) |
| V6 Cryptography | No | Not implicated by this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Race condition / double-booking (two patients, one slot) | Tampering | Conditional `UPDATE ... WHERE status = 'available'` (primary) + `appointments_active_slot_unique_idx` partial unique index (secondary, already deployed) — see Locking Strategy in Summary |
| IDOR — a patient cancelling/rescheduling another patient's appointment by guessing/incrementing an appointment id | Elevation of Privilege / Information Disclosure | `SECURITY DEFINER` functions resolve the acting patient from `auth.uid()` and filter every appointment lookup by `patient_id = auth.uid()` (or the doctor-owner equivalent) inside the function body itself — never trust an `appointment_id` alone; `appointments_update_own_or_admin`/`appointments_select_own_or_admin` RLS is the independent backstop |
| RLS bypass via direct `PostgREST` insert into `appointments`, skipping `book_appointment()`'s guarded flow | Tampering | See Common Pitfalls Pitfall 1 — unique index still prevents the double-booking outcome; recommend tightening the insert policy in the same migration as defense-in-depth |
| `SECURITY DEFINER` function callable by unauthenticated `anon` role, producing an unclean error path instead of a clean 401/403 | Elevation of Privilege (minor) | `REVOKE EXECUTE ON FUNCTION public.book_appointment/reschedule_appointment/cancel_appointment FROM PUBLIC; GRANT EXECUTE ... TO authenticated;` in the same migration, plus an explicit `profiles.role = 'patient'` (or doctor-ownership) check as the function's first statement for a clean custom-SQLSTATE rejection rather than relying solely on a `NOT NULL` constraint violation on `patient_id` |

## Sources

### Primary (HIGH confidence)
- `.claude/skills/supabase-postgres-best-practices/references/lock-deadlock-prevention.md` — curated skill, read this session; source of the "single atomic UPDATE statement" recommendation and the deadlock-via-inconsistent-lock-ordering explanation (Pitfall 3)
- `.claude/skills/supabase-postgres-best-practices/references/lock-short-transactions.md` — curated skill, read this session; source of the "UPDATE ... WHERE status = 'pending' RETURNING" minimal-lock-duration pattern this phase's functions are modeled on
- `.claude/skills/supabase-postgres-best-practices/references/lock-skip-locked.md` — curated skill, read this session; confirms `FOR UPDATE` semantics used for the appointment-row lock in Pattern 3/Pitfall 2 (not directly applicable — `SKIP LOCKED` itself is not used in this phase, since blocking-and-retrying, not skipping, is the correct behavior for a single-target reservation)
- `supabase/migrations/20260803230000_initial_schema.sql` — read this session in full; source of every schema fact cited (`appointments_active_slot_unique_idx` line 122-123, `is_doctor_owner` lines 166-177, RLS policies lines 246-261, `appointments` check constraint lines 84-85)
- `tests/e2e/schema-connectivity.spec.ts` — read this session; source of the verified `.rpc()` calling-convention example (parameter names must match SQL argument names exactly)
- `tests/e2e/doctor-schedule-overlap.spec.ts` — read this session; source of the established concurrency-test pattern (`Promise.all` of two identical requests, asserting exactly one 201 + one 409) this phase's APPT-02/APPT-09 tests should mirror
- `https://www.postgresql.org/docs/current/plpgsql-errors-and-messages.html` — fetched this session; confirms custom SQLSTATE code format rules (5 uppercase alphanumeric chars, not `00000`, avoid ending in `000`) and the `P0001` default

### Secondary (MEDIUM confidence)
- WebSearch, "Supabase database functions security definer search_path best practices revoke execute" — current official Supabase guidance on `SECURITY INVOKER`-by-default, empty-string `search_path`, and `REVOKE EXECUTE FROM PUBLIC`; cross-referenced against this project's existing (differently-hardened) `is_admin()`/`is_doctor_owner()` convention — see State of the Art
- WebSearch, "PL/pgSQL RAISE EXCEPTION USING ERRCODE custom SQLSTATE plpgsql" — general syntax confirmation, superseded in precision by the direct official-docs fetch above

### Tertiary (LOW confidence)
- None — every claim in this document is either grounded in code read this session, the curated Postgres skill, or an official-docs fetch.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; every reused piece (`components/ui/dialog.tsx`, `lib/timezone.ts`, `@supabase/supabase-js`) verified present in this session
- Architecture (locking strategy): HIGH — grounded in the project's own curated Postgres best-practices skill plus a direct official PostgreSQL docs fetch; the specific function designs are original synthesis for this schema but built entirely from verified primitives
- Pitfalls: HIGH for Pitfalls 1/2/4/5 (derived directly from reading this project's actual schema/RLS/CONTEXT.md); MEDIUM for Pitfall 3 (deadlock scenario) — the mechanism is textbook Postgres behavior, but its exact triggering conditions in this specific schema are this research's own reasoning, not verified against a live concurrent test run

**Research date:** 2026-08-10
**Valid until:** 2026-09-09 (30 days — Postgres locking semantics and this project's own schema are both stable; re-verify only if the schema or Supabase's SECURITY DEFINER guidance changes)
