# Phase 5: Appointment Booking & Lifecycle - Pattern Map

**Mapped:** 2026-08-10
**Files analyzed:** 13
**Analogs found:** 12 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `supabase/migrations/20260810120000_add_appointment_booking_functions.sql` | migration | transactional-RPC | `supabase/migrations/20260803230000_initial_schema.sql` (`is_doctor_owner`, RLS block) | role-match |
| `lib/auth/require-patient.ts` | middleware/utility (auth guard) | request-response | `lib/auth/require-doctor.ts` | exact |
| `lib/validation/appointments.ts` | utility (validation) | transform | `lib/validation/availability.ts` | exact |
| `app/api/appointments/route.ts` (POST) | controller/route | request-response (RPC + CRUD) | `app/api/doctor/slots/route.ts` (POST) | exact |
| `app/api/appointments/[id]/cancel/route.ts` (PATCH) | controller/route | request-response (RPC) | `app/api/doctor/slots/[id]/route.ts` (DELETE) | role-match |
| `app/api/appointments/[id]/reschedule/route.ts` (PATCH) | controller/route | request-response (RPC) | `app/api/doctor/slots/[id]/route.ts` (DELETE) + `app/api/doctor/slots/route.ts` (POST) | role-match |
| `app/api/patient/appointments/route.ts` (GET) | controller/route | CRUD (read, filtered) | `app/api/admin/appointments/route.ts` (GET) | exact |
| `app/api/doctor/appointments/route.ts` (GET) | controller/route | CRUD (read, filtered) | `app/api/admin/appointments/route.ts` (GET) | exact |
| `app/patient/appointments/page.tsx` | component (page) | request-response (client fetch + actions) | `app/patient/page.tsx` (placeholder) + `app/doctors/[id]/page.tsx` (slot list rendering) | role-match |
| `app/doctor/(gated)/appointments/page.tsx` | component (page) | request-response (client fetch + actions) | `app/doctor/(gated)/schedule/page.tsx` | exact |
| `app/doctors/[id]/page.tsx` (modified) | component (page, modified) | request-response | itself (existing file, lines 212-214 the CTA to enable) | exact |
| `tests/e2e/appointment-*.spec.ts` (4 files) | test | e2e / concurrency | `tests/e2e/doctor-schedule-overlap.spec.ts` | exact |
| `middleware`/`proxy.ts` return-to-slot handoff (D-04) | utility (redirect) | request-response | `lib/supabase/proxy.ts` (`?from=` mechanism) | exact |

## Pattern Assignments

### `supabase/migrations/20260810120000_add_appointment_booking_functions.sql` (migration, transactional-RPC)

**Analog:** `supabase/migrations/20260803230000_initial_schema.sql`

**`SECURITY DEFINER` function pattern** (lines 166-177):
```sql
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
Use `set search_path = public` (not empty-string) with fully-qualified `public.` references — matches this repo's existing convention, not the generic Supabase docs default.

**Table/index this migration must respect** (lines 80-89, 122-127, 244-261):
```sql
create table public.appointments (
  ...
  status text not null default 'scheduled'
    check (status in ('scheduled', 'confirmed', 'cancelled_by_patient', 'cancelled_by_doctor', 'completed', 'no_show')),
  cancelled_reason text,
  ...
);

create unique index appointments_active_slot_unique_idx on public.appointments (slot_id)
  where status not in ('cancelled_by_patient', 'cancelled_by_doctor');

create policy "appointments_insert_patient" on public.appointments
  for insert with check (patient_id = auth.uid());
```
The comment at line ~243 already anticipates this migration ("booking itself goes through the `book_appointment()` function added in Phase 5"). Only statuses ever written by this phase's functions: `scheduled` (insert), `cancelled_by_patient`/`cancelled_by_doctor` (cancel) — never `completed`/`no_show` (D-16).

**Concrete function bodies to copy almost verbatim** — RESEARCH.md's Pattern 1/2/3 sections (`book_appointment`, `reschedule_appointment` reserve-then-release ordering, `cancel_appointment`'s `FOR UPDATE` appointment-row lock) are fully-formed SQL already written in `05-RESEARCH.md` lines 227-333 and should be used as-is, adapted only for exact custom SQLSTATE naming (`MR001`-`MR005`) and the `REVOKE EXECUTE ... FROM PUBLIC; GRANT ... TO authenticated;` hardening noted in RESEARCH.md's Security Domain section.

---

### `lib/auth/require-patient.ts` (middleware, request-response)

**Analog:** `lib/auth/require-doctor.ts` (full file, 55 lines)

**Full pattern to mirror** — the guard shape (union return type, `NextResponse` 401/403, `createClient()` from `@/lib/supabase/server`):
```typescript
export type DoctorGuardResult =
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string; doctorId: string }
  | { ok: false; response: NextResponse };

export async function requireDoctor(): Promise<DoctorGuardResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  }

  const { data: doctor, error: doctorError } = await supabase
    .from("doctors")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (doctorError) {
    return { ok: false, response: NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 }) };
  }
  if (!doctor) {
    return { ok: false, response: NextResponse.json({ error: "Not authorized." }, { status: 403 }) };
  }

  return { ok: true, supabase, userId: user.id, doctorId: doctor.id };
}
```

**Key difference for `require-patient.ts`:** per Phase 1 D-07 ("no separate patients table"), no `doctors`-style lookup/join is needed — `userId` IS `auth.uid()` directly. Still resolve/verify `profiles.role === 'patient'` for a clean 403 (RESEARCH.md's `05-RESEARCH.md` Code Examples section has the exact full file already written — copy it directly, it queries `profiles.role`).

---

### `lib/validation/appointments.ts` (utility, transform)

**Analog:** `lib/validation/availability.ts` (full file, ~90 lines)

**Conventions to copy:**
- One exported function per input shape, `string | null` return, early-return plain user-facing message (module header comment lines 1-11).
- Never do select-then-insert pre-checks for race-prone conditions — defer to the DB constraint/RPC (this module's philosophy applies directly to `slotId`/`newSlotId`/`appointmentId` validation: shape/format only, never availability).
- Reused length-cap convention for free text (lines 81, cancellation `reason`):
```typescript
if (typeof reason === "string" && reason.length > 2000) {
  return "Reason is too long.";
}
```
New functions needed: `validateBookingInput` (UUID-shaped `slotId`), `validateRescheduleInput` (UUID-shaped `newSlotId`), `validateCancelInput` (optional `reason`, reuse the 2000-char cap verbatim).

---

### `app/api/appointments/route.ts` — POST (controller, request-response + RPC)

**Analog:** `app/api/doctor/slots/route.ts` (POST handler, lines 34-92)

**Imports + guard + validate + error-branch pattern:**
```typescript
import { NextResponse } from "next/server";
import { requireDoctor } from "@/lib/auth/require-doctor";
import { validateSlotInput } from "@/lib/validation/availability";

export async function POST(request: Request) {
  const guard = await requireDoctor();
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const validationError = validateSlotInput(body as Record<string, unknown>);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }
  // ... insert, then branch strictly on error.code (23P01 / 23514), never error.message
}
```
Replace `requireDoctor()` with `requirePatient()`, replace the `.insert()` with `.rpc("book_appointment", { p_slot_id: slotId })`, and branch on custom SQLSTATE `MR001` (409) instead of `23P01`. The exact RPC-call + follow-up-read + error-translation code is already fully written in `05-RESEARCH.md` "Code Examples" section (`POST /api/appointments`) — copy directly.

**RPC calling convention (verified against a live test):**
```typescript
// tests/e2e/schema-connectivity.spec.ts:34-36
admin.rpc("is_doctor_owner", { target_doctor_id: "00000000-..." })
```
Parameter keys must exactly match the SQL function's argument names (e.g. `p_slot_id`), never a bare camelCase shorthand.

---

### `app/api/appointments/[id]/cancel/route.ts` and `.../reschedule/route.ts` (controller, request-response + RPC)

**Analog:** `app/api/doctor/slots/[id]/route.ts` (DELETE handler, full file)

**Patterns to copy:**
- UUID pre-validation before ever hitting Postgres (avoid "invalid input syntax for uuid" → generic 500):
```typescript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_RE.test(id)) {
  return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
}
```
- Never distinguish "not found" vs "not owned" in the response (avoid IDOR oracle) — mirrors D-20's defense-in-depth stance; apply the same non-oracle framing when the RPC's `appointment_id` doesn't resolve to the caller's own row.
- Route params: `{ params }: { params: Promise<{ id: string }> }` (Next.js App Router async params convention, exact signature to reuse).
- Replace the `.delete()...neq("status","booked")` call with `.rpc("cancel_appointment", { p_appointment_id, p_reason })` / `.rpc("reschedule_appointment", { p_appointment_id, p_new_slot_id })`, translating `MR001`/`MR002`/`40P01` (deadlock, retryable 409) per RESEARCH.md Pitfall 3.

---

### `app/api/patient/appointments/route.ts` and `app/api/doctor/appointments/route.ts` (controller, CRUD read)

**Analog:** `app/api/admin/appointments/route.ts` (full file, 71 lines)

**Directly reusable join shape and query-building pattern:**
```typescript
const APPOINTMENT_SELECT =
  "id, status, cancelled_reason, created_at, updated_at, " +
  "slot:availability_slots!inner(id,start_at,end_at,status), " +
  "doctor:doctors(id,full_name), " +
  "patient:profiles(id,full_name,email)";

export async function GET(request: Request) {
  const guard = await requireAdmin(); // -> requirePatient() / requireDoctor()
  if (!guard.ok) return guard.response;

  let query = guard.supabase.from("appointments").select(APPOINTMENT_SELECT);
  // scope: .eq("patient_id", guard.userId)  or  .eq("doctor_id", guard.doctorId)  (D-20)

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Could not load appointments. Please refresh the page." }, { status: 500 });
  }
  return NextResponse.json({ appointments: data });
}
```
Add `.eq("patient_id", guard.userId)` (patient route) or `.eq("doctor_id", guard.doctorId)` (doctor route) as a mandatory app-level restatement of RLS (D-20). Upcoming/past split (D-18) happens client-side on `start_at` vs `now()` — do not add a server-side status filter for it; return all rows and let the UI derive the split and the "Past" label (D-17).

---

### `app/patient/appointments/page.tsx` and `app/doctor/(gated)/appointments/page.tsx` (component, request-response)

**Analogs:** `app/patient/page.tsx` (placeholder page under existing layout) and `app/doctor/(gated)/schedule/page.tsx` (gated-group convention, client fetch + action pattern) — read `schedule/page.tsx` at plan time for its exact list-fetch/mutate/refresh loop, since it is the most current example of a doctor-role page performing CRUD-style actions against `app/api/doctor/*` routes.

**Slot-list rendering to reuse for the reschedule new-slot picker (D-07)** — `app/doctors/[id]/page.tsx` lines 194-226:
```tsx
<div className="flex flex-col gap-4">
  {slotGroups.map((group) => (
    <div key={group.dayKey} className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">
        {formatJerusalemDayHeading(group.slots[0].start_at)}
      </h3>
      <div className="flex flex-col gap-2">
        {group.slots.map((slot) => (
          <div key={slot.id} className="flex items-center gap-3">
            <span className="text-sm">
              {formatJerusalemTime(slot.start_at)} - {formatJerusalemTime(slot.end_at)}
            </span>
            <Button className="min-h-11 px-4" disabled>Select this slot</Button>
          </div>
        ))}
      </div>
    </div>
  ))}
</div>
```
Same day-grouping + `formatJerusalemTime`/`formatJerusalemDayHeading` helpers from `lib/timezone.ts` apply directly to both the confirmation modal (D-02) and the reschedule slot-picker.

**Dialog primitive:** `components/ui/dialog.tsx` (already present, shadcn) — use for booking confirmation modal, cancellation confirmation modal, and reschedule slot-picker modal (all three per RESEARCH.md Standard Stack).

---

### `app/doctors/[id]/page.tsx` (modified) — enable CTA (component, request-response)

**Self-analog:** the exact lines to change, lines 212-214 (current disabled state):
```tsx
<Button className="min-h-11 px-4" disabled>
  Select this slot
</Button>
```
Becomes: `onClick` opens the confirmation `Dialog` (D-01/D-02), removing `disabled` and the "Online booking isn't available yet" copy block (lines 220-223).

**Unauthenticated redirect (D-04):** reuse `lib/supabase/proxy.ts`'s existing `?from=` mechanism:
```typescript
// lib/supabase/proxy.ts lines 52-58
if (matchedPrefix && !user) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}
```
This only fires for role-gated prefixes (`/patient`, `/doctor`, `/admin`); `/doctors/[id]` is public, so an unauthenticated "Select this slot" click must be handled client-side (redirect to `/login?from=/doctors/[id]`) rather than by `proxy.ts` itself — `proxy.ts` is the pattern to copy the `?from=` param-naming convention from, not a route this click passes through.

---

### `tests/e2e/appointment-*.spec.ts` (test, e2e/concurrency)

**Analog:** `tests/e2e/doctor-schedule-overlap.spec.ts` — read at plan time for the exact `Promise.all` concurrency-assertion pattern (two identical requests, assert exactly one 201 + one 409) that APPT-02 and APPT-09 tests must mirror. `playwright.config.ts` already sets `fullyParallel: false, workers: 1` — no new config needed.

**Reusable fixture:** `tests/e2e/helpers/appointments.ts` (already exists, written in Phase 2) — `createTestAppointment`/`cleanupTestAppointments`, directly reusable for seeding pre-existing appointments in cancel/reschedule/history specs. The booking spec itself must exercise the real `POST /api/appointments` endpoint via `page.request`, not this fixture.

## Shared Patterns

### Auth guard shape (401/403 union return)
**Source:** `lib/auth/require-doctor.ts`, `lib/auth/require-admin.ts`
**Apply to:** `lib/auth/require-patient.ts`, and every new route handler in this phase
```typescript
export type XGuardResult =
  | { ok: true; supabase: ...; userId: string }
  | { ok: false; response: NextResponse };
```

### Postgres error-code translation (never `error.message`)
**Source:** `app/api/doctor/slots/route.ts` lines 74-92
**Apply to:** all three new RPC-calling routes (`book`, `cancel`, `reschedule`)
```typescript
if (error?.code === "23P01") { return NextResponse.json({ error: "..." }, { status: 409 }); }
if (error?.code === "23514") { return NextResponse.json({ error: "..." }, { status: 400 }); }
return NextResponse.json({ error: "Could not save this. Please try again." }, { status: 500 });
```
This phase substitutes custom SQLSTATE codes `MR001`-`MR005` (and `40P01` for the reschedule deadlock case) for the `23P01`/`23514` codes used above — same branching discipline, different code table.

### Ownership scoping restated at app layer, defense-in-depth over RLS
**Source:** `app/api/doctor/slots/[id]/route.ts` (`.eq("doctor_id", guard.doctorId)`), `app/api/admin/appointments/route.ts` (`doctorId` query filter)
**Apply to:** `GET /api/patient/appointments`, `GET /api/doctor/appointments`, and both cancel/reschedule routes' RPC identity resolution
```typescript
.eq("patient_id", guard.userId)   // or .eq("doctor_id", guard.doctorId)
```

### Non-oracle 404 for owned-resource-by-id lookups
**Source:** `app/api/doctor/slots/[id]/route.ts` lines 5-11, 24-35
**Apply to:** `cancel`/`reschedule` routes when `appointmentId` doesn't belong to the caller — return the same "not found" response as a genuinely nonexistent id, never a distinguishable 403.

### Asia/Jerusalem display/conversion
**Source:** `lib/timezone.ts` (`formatJerusalemTime`, `formatJerusalemDayHeading`, `jerusalemWallClockToUtc`, `jerusalemBoundaryToUtcIso`)
**Apply to:** confirmation modal (D-02), appointment list rows (D-17/D-18), reschedule slot-picker

### `SECURITY DEFINER` function convention
**Source:** `supabase/migrations/20260803230000_initial_schema.sql` lines 160-177 (`is_admin`, `is_doctor_owner`)
**Apply to:** `book_appointment`, `reschedule_appointment`, `cancel_appointment`
```sql
language sql          -- or plpgsql for the multi-statement functions
stable                -- omit for the write functions (they're volatile)
security definer
set search_path = public
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Client-side unauthenticated "Select this slot" redirect-and-return handoff (D-04) | utility (client redirect) | request-response | No prior public-page-triggered `?from=` login redirect exists yet in the codebase — `proxy.ts`'s `?from=` mechanism only fires for role-gated prefixes server-side; this phase is the first to need a *client-triggered* equivalent from a public page. Use RESEARCH.md's guidance (fallback to plain profile-page redirect is acceptable per D-04) if the slot-preserving version proves non-trivial. |

## Metadata

**Analog search scope:** `app/api/`, `app/patient/`, `app/doctor/`, `app/doctors/`, `lib/auth/`, `lib/validation/`, `lib/supabase/`, `supabase/migrations/`, `tests/e2e/`
**Files scanned:** 13 read directly, plus directory listings of `app/patient/`, `app/doctor/(gated)/`, `app/api/doctor/`
**Pattern extraction date:** 2026-08-10
