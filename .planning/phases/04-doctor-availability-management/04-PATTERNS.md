# Phase 4: Doctor Availability Management - Pattern Map

**Mapped:** 2026-08-09
**Files analyzed:** 10
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `lib/auth/require-doctor.ts` | middleware (auth guard) | request-response | `lib/auth/require-admin.ts` | exact |
| `lib/validation/availability.ts` | utility (validation) | transform | `lib/validation/doctor.ts` | exact |
| `app/api/doctor/slots/route.ts` (GET list, POST add) | controller (route) | CRUD | `app/api/admin/locations/[id]/route.ts` (PATCH) | role-match |
| `app/api/doctor/slots/[id]/route.ts` (DELETE) | controller (route) | CRUD | `app/api/admin/locations/[id]/route.ts` (DELETE) | exact |
| `app/api/doctor/blocked-periods/route.ts` (POST) | controller (route) | CRUD | `app/api/admin/locations/[id]/route.ts` (PATCH) + slots POST | role-match |
| `app/doctor/(gated)/schedule/page.tsx` | component (page) | request-response (fetch-based) | `app/doctors/[id]/page.tsx` | exact |
| `supabase/migrations/<ts>_add_availability_slots_reason.sql` | migration | batch (schema change) | `supabase/migrations/20260804120200_add_must_change_password.sql` | role-match |
| `tests/e2e/doctor-schedule-add-slot.spec.ts` | test | event-driven (browser) | existing `tests/e2e/*.spec.ts` + `tests/e2e/helpers/availability.ts` | role-match |
| `tests/e2e/doctor-schedule-overlap.spec.ts` | test | event-driven (concurrency) | same helpers, pattern from RESEARCH.md concurrency example | role-match |
| `tests/e2e/doctor-schedule-delete-slot.spec.ts` / `doctor-schedule-block-period.spec.ts` | test | event-driven (browser) | same helpers | role-match |

## Pattern Assignments

### `lib/auth/require-doctor.ts` (middleware, request-response)

**Analog:** `lib/auth/require-admin.ts` (full file, 41 lines — read in full)

**Full pattern to extend** (lines 1-40):
```typescript
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export type AdminGuardResult =
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
  | { ok: false; response: NextResponse };

export async function requireAdmin(): Promise<AdminGuardResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not authorized." }, { status: 403 }),
    };
  }

  return { ok: true, supabase, userId: user.id };
}
```

**Required adaptation (per CONTEXT.md D-06):** Replace the `profiles.role === "admin"` check with a lookup of `doctors.id where profile_id = auth.uid()` (the exact condition `is_doctor_owner()` uses server-side, from `supabase/migrations/20260803230000_initial_schema.sql:166-177`: `select exists (select 1 from public.doctors where id = target_doctor_id and profile_id = auth.uid());`). Return `{ ok: true, supabase, userId, doctorId }` on success; `403`/`404` (no doctor row linked to this profile) on failure. Never accept a client-supplied `doctorId`.

---

### `lib/validation/availability.ts` (utility, transform)

**Analog:** `lib/validation/doctor.ts` (full file, 123 lines — read in full)

**Convention to follow** — single exported functions returning `string | null`, manual type/trim checks, no schema library:
```typescript
export function validateDoctorInput(body: Record<string, unknown>): string | null {
  const fullName = body.fullName;
  if (typeof fullName !== "string" || !fullName.trim()) {
    return "Full name is required.";
  }
  // ... more field checks, each an early return of a plain string
  return null;
}
```

**Concrete new-file shape** (from RESEARCH.md's Code Examples, matches this convention exactly):
```typescript
export function validateSlotInput(body: Record<string, unknown>): string | null {
  const startAt = body.startAt;
  const endAt = body.endAt;
  if (typeof startAt !== "string" || typeof endAt !== "string") {
    return "Start and end time are required.";
  }
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Invalid date/time.";
  }
  if (start.getTime() <= Date.now()) {
    return "Cannot add a slot in the past."; // D-08
  }
  if (start.getTime() >= end.getTime()) {
    return "Start time must be before end time."; // D-09 pre-check
  }
  return null;
}
```
A sibling `validateBlockedPeriodInput` should reuse the same body but additionally accept an optional `reason: string` (D-04, D-17) with a type-only check (`typeof reason !== "string"` if present) — no content validation per D-04 ("purely informational").

---

### `app/api/doctor/slots/route.ts` (controller, CRUD) — GET list + POST add

**Analog:** `app/api/admin/locations/[id]/route.ts` PATCH handler (lines 10-74) for the guard→validate→write→error-branch shape; also `app/doctors/[id]/page.tsx`'s data shape for the GET response.

**Guard + validate + write + error-branch pattern** (lines 10-23, 58-66 of the analog):
```typescript
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  const body = await request.json();
  const validationError = validateLocationPatch(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }
  // ... lookup / write ...
  if (updateError || !updated) {
    if (updateError?.code === "23505") {
      return NextResponse.json({ error: DUPLICATE_MESSAGE }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Could not save location. Please try again." },
      { status: 500 },
    );
  }
```

**Concrete POST /api/doctor/slots skeleton** (RESEARCH.md Code Examples — direct fusion of `requireDoctor()` + this error-branch style, using `23P01` instead of `23505`):
```typescript
export async function POST(request: Request) {
  const guard = await requireDoctor();
  if (!guard.ok) return guard.response;

  const body = await request.json();
  const validationError = validateSlotInput(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { data, error } = await guard.supabase
    .from("availability_slots")
    .insert({
      doctor_id: guard.doctorId, // never body.doctorId — D-06
      start_at: body.startAt,
      end_at: body.endAt,
      status: "available",
    })
    .select("id, start_at, end_at, status")
    .single();

  if (error || !data) {
    if (error?.code === "23P01") {
      return NextResponse.json(
        { error: "This time overlaps your existing schedule." }, // D-11
        { status: 409 },
      );
    }
    if (error?.code === "23514") {
      return NextResponse.json(
        { error: "Start time must be before end time." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Could not save this time slot. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ slot: data }, { status: 201 });
}
```
`GET` should list `guard.doctorId`'s own future (`start_at >= now`, per D-15) `availability_slots` rows (`available` + `blocked`, both statuses — the page needs both per D-13/D-14), ordered by `start_at`, selecting `id, start_at, end_at, status, reason`.

---

### `app/api/doctor/slots/[id]/route.ts` (controller, CRUD) — DELETE

**Analog:** `app/api/admin/locations/[id]/route.ts` DELETE handler (lines 76-147, full — read in this session)

**Ownership lookup + status guard + error-branch pattern to adapt:**
```typescript
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  const { data: existing, error: lookupError } = await guard.supabase
    .from("locations")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json(
      { error: "Could not delete location. Please try again." },
      { status: 500 },
    );
  }
  if (!existing) {
    return NextResponse.json({ error: "Location not found." }, { status: 404 });
  }

  // The actual server-side guard — never trust the client's disabled button.
  const { count: doctorCount, error: countError } = await guard.supabase
    .from("doctors")
    .select("*", { count: "exact", head: true })
    .eq("location_id", id);
  // ... guard condition ...

  const { error: deleteError } = await guard.supabase
    .from("locations")
    .delete()
    .eq("id", id);

  if (deleteError) {
    if (deleteError.code === "23503") {
      // translate FK violation to a domain 409
    }
    return NextResponse.json(
      { error: "Could not delete location. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
```

**Adaptation for this phase (D-01, D-06, AVAIL-05):**
1. `requireDoctor()` guard (not `requireAdmin()`).
2. Lookup the slot by `id`, select `id, doctor_id, status`, `.maybeSingle()` → 404 if not found.
3. Ownership check: `existing.doctor_id !== guard.doctorId` → 403 (IDOR guard, independent of RLS per Security Domain table).
4. Status guard in place of the doctor-count guard: `if (existing.status === "booked") return 409 "This slot has already been booked and cannot be deleted."` (AVAIL-05). `available` and `blocked` both proceed to delete (D-01) — no status-conditional branching beyond this single check.
5. Plain `.delete().eq("id", id)` — no compensating insert, ever (D-02). No `23P01`/`23514` branch is needed here since a valid delete cannot itself violate those constraints (per RESEARCH.md Pattern 2 note).
6. On delete error, generic 500 fallback exactly like the analog's final `NextResponse.json({ error: "Could not delete..." }, { status: 500 })`.

---

### `app/api/doctor/blocked-periods/route.ts` (controller, CRUD) — POST

**Analog:** Same as `app/api/doctor/slots/route.ts` POST (self-referential — this is a sibling endpoint), reusing the identical guard → validate → insert → `23P01`/`23514` error-branch shape shown above, with two differences:
- `status: "blocked"` instead of `"available"` in the insert payload.
- `reason: body.reason ?? null` included in the insert payload (D-04 — nullable, no content validation).
- Overlap message stays exactly the same generic D-11 copy — never distinguish "blocks an available slot" vs "blocks a blocked period" (AVAIL-07 uses the identical `23P01` mechanism as AVAIL-03).

---

### `app/doctor/(gated)/schedule/page.tsx` (component/page, request-response)

**Analog:** `app/doctors/[id]/page.tsx` (full file, 234 lines — read in full)

**Fetch + status-state pattern to reuse** (lines 72-108):
```typescript
const [status, setStatus] = useState<"loading" | "notFound" | "error" | "ready">("loading");
const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
const [upcomingSlots, setUpcomingSlots] = useState<UpcomingSlot[]>([]);

const loadDoctor = useCallback(async () => {
  setStatus("loading");
  try {
    const response = await fetch(`/api/doctors/${id}`);
    if (response.status === 404) {
      setStatus("notFound");
      return;
    }
    const data = await response.json();
    if (!response.ok) {
      setStatus("error");
      return;
    }
    setDoctor(data.doctor as DoctorProfile);
    setUpcomingSlots(data.upcomingSlots as UpcomingSlot[]);
    setStatus("ready");
  } catch {
    setStatus("error");
  }
}, [id]);

useEffect(() => {
  async function runLoad() {
    await loadDoctor();
  }
  void runLoad();
}, [loadDoctor]);
```

**Day-grouping helper to adapt** (lines 33-50, D-13 — this is the exact template the CONTEXT.md points to):
```typescript
type UpcomingSlot = {
  id: string;
  start_at: string;
  end_at: string;
};

type SlotDayGroup = {
  dayKey: string;
  slots: UpcomingSlot[];
};

function groupSlotsByJerusalemDay(slots: UpcomingSlot[]): SlotDayGroup[] {
  const groups: SlotDayGroup[] = [];
  for (const slot of slots) {
    const dayKey = jerusalemDayKey(slot.start_at);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.dayKey === dayKey) {
      lastGroup.slots.push(slot);
    } else {
      groups.push({ dayKey, slots: [slot] });
    }
  }
  return groups;
}
```
**Required adaptation:** extend `UpcomingSlot` with `status: "available" | "blocked"` and `reason: string | null` (D-13/D-14); the grouping logic itself (`jerusalemDayKey`, contiguous-group push) is unchanged.

**List rendering pattern to adapt** (lines 194-226, `formatJerusalemDayHeading` + `formatJerusalemTime` + `Badge`):
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
            {/* new: Badge variant switch on slot.status, D-14 */}
            {/* new: slot.reason shown next to Blocked badge, D-04 */}
            {/* new: Delete button, disabled/hidden if slot.status === "booked" (D-18) */}
          </div>
        ))}
      </div>
    </div>
  ))}
</div>
```
Badge variant convention already established on this same page: `variant="secondary"` for a non-primary status label (line 168/178/198) — reuse `variant="default"` (or similar) for Available vs `variant="secondary"`/`"outline"` for Blocked, per RESEARCH.md's Standard Stack guidance.

**Page shell / gated placement:** `app/doctor/(gated)/page.tsx` (10 lines, read in full) is the sibling placeholder already inside the `(gated)` group — `schedule/page.tsx` is a new directory alongside it inside `app/doctor/(gated)/`. No new layout needed; `app/doctor/(gated)/layout.tsx` (already forces the password-change gate) and the parent `app/doctor/layout.tsx` (auth/role check + header) already wrap this route for free.

---

### `supabase/migrations/<timestamp>_add_availability_slots_reason.sql` (migration, batch)

**Analog:** `supabase/migrations/20260804120200_add_must_change_password.sql` (full file, 27 lines — read in full)

**Pattern to follow** — plain `alter table ... add column`, explanatory comment block above, no `not null`/default unless truly required (this migration's own Part 1 default-`false` note is a *counter-example* to imitate carefully — D-04 explicitly wants nullable, no default):
```sql
-- Forced first-login password change for admin-linked doctor accounts (D-03, D-04).
--
-- ...explanatory comment about why this default/shape was chosen...

alter table public.profiles
  add column must_change_password boolean not null default false;
```

**Concrete new migration** (per D-04 / RESEARCH.md Pitfall 3 — nullable, no default, no not-null):
```sql
-- Optional free-text reason for a blocked period (D-04). Nullable — not
-- applicable to `available`/`booked` rows, and existing seeded rows must not
-- be forced to a placeholder value (Pitfall 3).

alter table public.availability_slots
  add column reason text;
```
Filename convention: `supabase/migrations/<YYYYMMDDHHMMSS>_add_availability_slots_reason.sql`, matching the existing `20260804120200_add_must_change_password.sql` naming style (descriptive snake_case suffix after the timestamp).

---

### Test files (`tests/e2e/doctor-schedule-*.spec.ts`)

**Analog:** `tests/e2e/helpers/availability.ts`, `tests/e2e/helpers/reference-data.ts`, `tests/e2e/helpers/test-users.ts` (all already exist, read in full per RESEARCH.md Sources) plus the existing doctor-login spec (`tests/e2e/auth-doctor-login.spec.ts`) for the login-flow pattern.

**Reusable fixtures already exported** (no new fixture infrastructure needed):
```typescript
// tests/e2e/helpers/availability.ts
export type TestSlotStatus = "available" | "booked" | "blocked";
export async function createTestSlots(
  doctorId: string,
  specs: Array<{ startAt: Date; endAt: Date; status?: TestSlotStatus }>,
): Promise<Array<{ id: string; startAt: Date; endAt: Date }>>;
export async function cleanupTestSlots(): Promise<void>;

// tests/e2e/helpers/reference-data.ts
export async function createTestDoctor(opts: {
  fullName?: string; specialtyId: string; locationId: string;
  bio?: string; photoUrl?: string; isActive?: boolean; profileId?: string;
}): Promise<{ id: string; fullName: string }>;

// tests/e2e/helpers/test-users.ts
export async function createTestUser(
  role: "patient" | "doctor" | "admin",
  opts?: { fullName?: string },
): Promise<{ id: string; email: string; password: string }>;
export async function cleanupTestUsers(): Promise<void>;
```

**Setup flow:** `createTestUser("doctor")` → `createTestSpecialty()`/`createTestLocation()` → `createTestDoctor({ ..., profileId: doctorUser.id })` → log in via `/login` form (same flow as `tests/e2e/auth-doctor-login.spec.ts`) → drive `/doctor/schedule`. `createTestSlots` seeds known pre-existing rows (any status) to set up overlap/delete-guard scenarios directly against the DB, bypassing the UI.

**Concurrency test pattern (proves DB-level enforcement, AVAIL-03/AVAIL-07 — from RESEARCH.md):**
```typescript
const [resultA, resultB] = await Promise.all([
  page.request.post("/api/doctor/slots", { data: { startAt, endAt } }),
  page.request.post("/api/doctor/slots", { data: { startAt, endAt } }),
]);
const statuses = [resultA.status(), resultB.status()].sort();
expect(statuses).toEqual([201, 409]);
```

---

## Shared Patterns

### Auth guard (defense-in-depth, D-06/D-07)
**Source:** `lib/auth/require-admin.ts`
**Apply to:** All three new route handlers (`slots` GET/POST, `slots/[id]` DELETE, `blocked-periods` POST) via the new `requireDoctor()` — every route must call `const guard = await requireDoctor(); if (!guard.ok) return guard.response;` first, and use `guard.doctorId` (never a client-supplied id) for all `doctor_id` filters/inserts.

### Postgres error-code branching (D-10/D-11, core technical pattern this phase establishes)
**Source:** `app/api/admin/locations/[id]/route.ts` (existing `23505`/`23503` precedent)
**Apply to:** Every write (`insert`/`delete`) to `availability_slots` in the new routes:
```typescript
if (error?.code === "23P01") {
  return NextResponse.json(
    { error: "This time overlaps your existing schedule." }, // D-11, always this exact generic message
    { status: 409 },
  );
}
if (error?.code === "23514") {
  return NextResponse.json(
    { error: "Start time must be before end time." },
    { status: 400 },
  );
}
return NextResponse.json({ error: "..." }, { status: 500 });
```
Never branch on `error.message`/`error.details` — only the flat `error.code` string is stable (per the installed `PostgrestError.ts`).

### Manual validation convention (no schema library)
**Source:** `lib/validation/doctor.ts`
**Apply to:** `lib/validation/availability.ts` — single functions returning `string | null`, called immediately after the auth guard and before any DB write, in every POST route.

### Timezone conversion (D-12)
**Source:** `lib/timezone.ts`
**Apply to:** All form input/output on `/doctor/schedule` — `jerusalemWallClockToUtc(year, month, day, hour, minute)` for converting form date+time fields to the UTC instant sent to the API; `jerusalemDayKey`, `formatJerusalemDayHeading`, `formatJerusalemTime` for rendering the schedule list. No new conversion logic.

### Day-grouped list UI (D-13)
**Source:** `app/doctors/[id]/page.tsx` (`groupSlotsByJerusalemDay`, lines 38-50)
**Apply to:** `/doctor/schedule` page — same grouping algorithm, extended slot type carries `status`/`reason`.

## No Analog Found

None — every file in this phase's scope has a strong (exact or role-match) analog already shipped in the codebase from Phase 1–3. This phase is close to pure plumbing on established patterns (per RESEARCH.md's own "Key insight").

## Metadata

**Analog search scope:** `lib/auth/`, `lib/validation/`, `app/api/admin/`, `app/api/doctors/`, `app/doctors/[id]/`, `app/doctor/`, `supabase/migrations/`, `tests/e2e/helpers/`
**Files scanned:** `lib/auth/require-admin.ts`, `lib/validation/doctor.ts`, `app/api/admin/locations/[id]/route.ts`, `app/api/doctors/route.ts` (referenced via RESEARCH.md), `app/doctors/[id]/page.tsx`, `lib/timezone.ts`, `app/doctor/(gated)/layout.tsx`, `app/doctor/(gated)/page.tsx`, `supabase/migrations/20260804120200_add_must_change_password.sql`, `tests/e2e/helpers/{availability,reference-data,test-users}.ts` (referenced via RESEARCH.md, already verified there)
**Pattern extraction date:** 2026-08-09
