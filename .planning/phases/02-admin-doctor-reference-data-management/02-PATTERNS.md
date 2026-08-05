# Phase 2: Admin — Doctor & Reference Data Management - Pattern Map

**Mapped:** 2026-08-04
**Files analyzed:** 19
**Analogs found:** 19 / 19

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/api/admin/doctors/route.ts` (POST list/create) | controller (route) | CRUD | `app/api/auth/signup/route.ts` | role-match |
| `app/api/admin/doctors/[id]/route.ts` (PATCH edit) | controller (route) | CRUD | `app/api/auth/login/route.ts` (session client + `.from()` query shape) | role-match |
| `app/api/admin/doctors/[id]/status/route.ts` (PATCH activate/deactivate) | controller (route) | CRUD | `app/api/auth/login/route.ts` | role-match |
| `app/api/admin/doctors/[id]/link-account/route.ts` (POST) | controller (route) | request-response + external service | `app/api/auth/signup/route.ts` | exact |
| `app/api/admin/specialties/route.ts` (GET, POST) | controller (route) | CRUD | `app/api/auth/signup/route.ts` (validation+insert shape) | role-match |
| `app/api/admin/specialties/[id]/route.ts` (PATCH, DELETE) | controller (route) | CRUD | `app/api/auth/signup/route.ts` | role-match |
| `app/api/admin/locations/route.ts` (GET, POST) | controller (route) | CRUD | same as specialties | role-match |
| `app/api/admin/locations/[id]/route.ts` (PATCH, DELETE) | controller (route) | CRUD | same as specialties | role-match |
| `app/api/admin/users/route.ts` (GET) | controller (route) | request-response (read-only) | `app/api/auth/login/route.ts` (profile select shape) | role-match |
| `app/api/admin/appointments/route.ts` (GET) | controller (route) | request-response (read-only) | `app/api/auth/login/route.ts` | role-match |
| `app/api/auth/change-password/route.ts` (POST) | controller (route) | request-response | `app/api/auth/login/route.ts` | role-match |
| `lib/validation/doctor.ts` | utility (validation) | transform | `lib/validation/auth.ts` | exact |
| `lib/validation/reference-data.ts` | utility (validation) | transform | `lib/validation/auth.ts` | exact |
| `app/doctor/(gated)/layout.tsx` (new nested gate, or modified `app/doctor/layout.tsx`) | provider (role-guard layout) | request-response | `app/doctor/layout.tsx` (existing) | exact |
| `app/doctor/change-password/page.tsx` | component (form page) | request-response | `app/signup/page.tsx` | exact |
| `app/admin/doctors/page.tsx` | component (list+form page) | CRUD | `app/signup/page.tsx` (form/fetch pattern) + `app/admin/page.tsx` (server shell) | role-match |
| `app/admin/specialties/page.tsx` | component (list+form page) | CRUD | `app/signup/page.tsx` | role-match |
| `app/admin/locations/page.tsx` | component (list+form page) | CRUD | `app/signup/page.tsx` | role-match |
| `app/admin/users/page.tsx` | component (read-only list) | request-response | `app/admin/page.tsx` (server component shell) | role-match |
| `app/admin/appointments/page.tsx` | component (read-only list) | request-response | `app/admin/page.tsx` | role-match |
| `scripts/seed.ts` | utility (CLI script) | batch | `tests/e2e/helpers/test-users.ts` (admin-client usage pattern) | role-match |
| `supabase/migrations/<new>_add_must_change_password_and_unique_constraints.sql` | migration | schema | `supabase/migrations/20260803230000_initial_schema.sql` | exact |
| `tests/e2e/admin-*.spec.ts` (6 new spec files) | test | e2e | `tests/e2e/helpers/test-users.ts` + `tests/e2e/route-protection-role-mismatch.spec.ts` (not read, referenced in RESEARCH.md) | role-match |

## Pattern Assignments

### `app/api/admin/doctors/route.ts` (controller, CRUD)

**Analog:** `app/api/auth/signup/route.ts` (structure) + RESEARCH.md Pattern 1 (already-adapted example, use verbatim as starting point)

**Imports pattern** (from `app/api/auth/signup/route.ts:1-5`):
```typescript
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { validateEmail, validateFullName, validatePassword } from "@/lib/validation/auth";
```
For doctors CRUD, swap `createAdminClient` out — use only `createClient` (session-bound) per RESEARCH.md Pattern 1/Anti-Patterns (RLS `doctors_admin_write` already authorizes admin writes; service-role is reserved for `link-account` only).

**Core CRUD pattern** — copy directly from RESEARCH.md Pattern 1 (`app/api/admin/doctors/route.ts` POST example, RESEARCH.md lines 216-245): validate body → `createClient()` → `.from("doctors").insert({...}).select().single()` → never pass `is_active`/`is_demo`/`profile_id` from client input.

**Error handling pattern** (from `app/api/auth/signup/route.ts:42-45` and `login/route.ts:25-28`):
```typescript
if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 });
```
Note: for specialty/location DELETE, do NOT forward raw Postgres FK error text (Pitfall 3) — translate to a friendly message or do an explicit `count` pre-check.

---

### `app/api/admin/doctors/[id]/link-account/route.ts` (controller, request-response + external service)

**Analog:** `app/api/auth/signup/route.ts` (exact structural match: admin client, `auth.admin.createUser`, `profiles` insert, orphan cleanup on failure)

**Imports pattern:**
```typescript
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
```

**Core pattern** — copy directly from RESEARCH.md Pattern 2 (lines 252-297), which is itself adapted from `app/api/auth/signup/route.ts:21-61`. Key elements to replicate exactly from the signup route:
- Service-role client via `createAdminClient()` (`lib/supabase/admin.ts:5-11`)
- `admin.auth.admin.createUser({ email, password, email_confirm: true })` (signup/route.ts:25-29)
- Hardcode `role` server-side, never from client input (signup/route.ts:48-50 comment — directly cited in RESEARCH.md as the reason `link-account` must use the admin client)
- Orphan cleanup: `await admin.auth.admin.deleteUser(created.user.id)` if the `profiles` insert fails (signup/route.ts:57-60)
- New: `must_change_password: true` set explicitly only here, never as a column-level default (Pitfall 1)
- New: use `node:crypto.randomBytes(12).toString("base64url")` for the temp password, never `Math.random()`

**Duplicate-email error handling** (from `app/api/auth/signup/route.ts:30-46`):
```typescript
const isDuplicate =
  createError?.message?.toLowerCase().includes("already been registered") ||
  createError?.message?.toLowerCase().includes("already registered") ||
  createError?.message?.toLowerCase().includes("already exists") ||
  createError?.code === "email_exists";
```
Reuse this exact duplicate-detection block for link-account's email field.

---

### `app/api/admin/specialties/route.ts` / `app/api/admin/locations/route.ts` (controller, CRUD)

**Analog:** `app/api/auth/signup/route.ts` (validation-then-insert shape), `app/api/auth/login/route.ts` (session client `.from()` select shape)

**Core pattern:** Same as doctors route — `createClient()` (session-bound), manual validation function, `.insert()/.update()/.delete()`, return `NextResponse.json`. GET routes use plain `.select("*")` — same client, no admin bypass (RLS already public-read on these tables per RESEARCH.md L227-228 area, admin-write policy already permits admin all-verb).

**Delete guard pattern** (D-05/D-06, RESEARCH.md Anti-Patterns + Pitfall 3): implement an explicit `count` pre-check (`select count(*) from doctors where specialty_id = :id`) before delete, returning a 409 with friendly text — do not forward raw Postgres `23503` error text.

---

### `app/doctor/layout.tsx` modification / `app/doctor/(gated)/layout.tsx` (provider, role-guard)

**Analog:** `app/doctor/layout.tsx` itself (exact — extend in place)

**Full existing pattern to extend** (`app/doctor/layout.tsx:1-31`):
```typescript
import { redirect } from "next/navigation";
import SiteHeader from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "doctor") redirect("/");

  return (<><SiteHeader />{children}</>);
}
```
**Extension:** add `must_change_password` to the `.select()` string, add `if (profile?.must_change_password) redirect("/doctor/change-password")` after the role check — see RESEARCH.md Pattern 3 for the exact code and Open Question #1 for the route-group-split structural recommendation (`app/doctor/(gated)/...` sibling to `app/doctor/change-password/...`, moving existing `app/doctor/page.tsx` into the group). This same file pattern (`app/admin/layout.tsx`, `app/patient/layout.tsx`) is otherwise identical — all three read `profiles.role` via the session client and redirect; no other layout needs modification this phase.

---

### `app/doctor/change-password/page.tsx` (component, form page)

**Analog:** `app/signup/page.tsx` (exact — full client-form pattern to copy)

**Imports pattern** (`app/signup/page.tsx:1-12`):
```typescript
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
```

**Form state + submit pattern** (`app/signup/page.tsx:20-67`): local `useState` per field + `fieldErrors` object, client-side validation call before submit, `fetch(..., { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(...) })`, check `!response.ok` → `setApiError(data.error)`, else `router.push(...)` + `router.refresh()`, `isSubmitting` disables the submit button during the request. Copy this whole shape for the change-password form (fields: new password, confirm password) and for every admin create/edit form (doctors, specialties, locations).

**JSX field pattern** (`app/signup/page.tsx:77-120`): `<Label htmlFor>` + `<Input aria-invalid={...}>` + conditional `<p className="text-sm font-normal text-destructive">` error line, `<Alert variant="destructive">` for the top-level API error.

---

### `app/admin/doctors/page.tsx`, `app/admin/specialties/page.tsx`, `app/admin/locations/page.tsx` (component, CRUD list+form pages)

**Analog:** `app/signup/page.tsx` (form/fetch/error pattern) + `app/admin/page.tsx` (server-component page shell for the surrounding `<main>`)

**Page shell pattern** (`app/admin/page.tsx:1-10`):
```typescript
export default function AdminHomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center ps-6 pe-6 text-center">
      ...
    </main>
  );
}
```
New admin CRUD pages will need a data-fetching server component wrapper (or client component fetching from `/api/admin/...` on mount) since `app/admin/page.tsx` currently has no data fetching — no existing analog for a data-table page exists in the codebase yet, so this is a genuinely new UI pattern (list/table + create/edit form + modal). Use shadcn `table`/`dialog`/`select`/`switch`/`badge` primitives per RESEARCH.md Standard Stack; base the `<main>` wrapper and overall page structure on `app/admin/page.tsx`, and every embedded form on `app/signup/page.tsx`.

---

### `lib/validation/doctor.ts`, `lib/validation/reference-data.ts` (utility, transform)

**Analog:** `lib/validation/auth.ts` (exact — same function-per-field style)

**Full pattern to copy** (`lib/validation/auth.ts:1-22`):
```typescript
export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Invalid email format.";
  return null;
}
```
Each validator: takes the raw field, returns `string | null` (error message or null), no exceptions thrown, no schema library. RESEARCH.md already provides the exact `validateDoctorInput` example (lines 391-405) styled after this file — use it verbatim as the starting point for `lib/validation/doctor.ts`. Build `lib/validation/reference-data.ts` the same way for specialty/location name fields.

---

### `scripts/seed.ts` (utility, batch/CLI)

**Analog:** `tests/e2e/helpers/test-users.ts` (admin-client usage + user/profile insert pattern) and `lib/supabase/admin.ts` (client construction)

**Admin client usage pattern** (`tests/e2e/helpers/test-users.ts:1-44`):
```typescript
import { testAdminClient } from "./supabase-admin"; // seed.ts: import { createAdminClient } from "../lib/supabase/admin";

const admin = testAdminClient(); // seed.ts: const admin = createAdminClient();
const { data, error } = await admin.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true });
// ... admin.from("profiles").insert({ id: data.user.id, role, full_name, email })
```
For demo doctors (no login accounts, per D-07/scope), skip the `auth.admin.createUser` call entirely and only `admin.from("doctors").insert(...)`.

**Idempotent upsert pattern** — copy directly from RESEARCH.md Code Examples (lines 407-422):
```typescript
await admin.from("specialties").upsert(specialties, { onConflict: "name_en", ignoreDuplicates: true });
```
For doctors (no natural unique key), guard at script level: check `is_demo = true` count before inserting, per Pitfall 4.

---

### `supabase/migrations/<new>.sql` (migration, schema)

**Analog:** `supabase/migrations/20260803230000_initial_schema.sql` (exact — same file/dir, same conventions: `create policy ... using (public.is_admin())`, `on delete restrict` FKs already established, `is_admin()`/`is_doctor_owner()` security-definer helpers reusable if a new RLS policy is needed for `must_change_password`).

New migration must add: `profiles.must_change_password boolean not null default false` (Pitfall 1 — default `false`, never `true`), plus unique constraints `specialties.name_en` and `locations (neighborhood, city)` (Pitfall 4) for `ON CONFLICT`/`upsert` idempotency in the seed script.

---

## Shared Patterns

### Session-bound vs. service-role client selection
**Source:** `lib/supabase/server.ts:1-29` (session-bound, RLS-governed) vs. `lib/supabase/admin.ts:1-11` (service-role, RLS-bypassing)
**Apply to:** All new route handlers under `app/api/admin/**`
**Rule:** Use `createClient()` (server.ts) for every route RLS already permits via `is_admin()` (doctors/specialties/locations CRUD, users/appointments read). Use `createAdminClient()` (admin.ts) exclusively for `link-account`, which needs `auth.admin.createUser()` and a cross-user `profiles` insert. See RESEARCH.md Anti-Patterns and Pitfall 5.

### Role-guard layout
**Source:** `app/admin/layout.tsx:1-31`, `app/doctor/layout.tsx:1-31`, `app/patient/layout.tsx:1-31` (all three byte-identical apart from the role string)
**Apply to:** No new layouts needed for admin routes (already exists); `app/doctor/layout.tsx` gets the `must_change_password` extension (see Pattern Assignments above).
```typescript
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect("/login");
const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
if (profile?.role !== "<role>") redirect("/");
```

### Manual validation function style
**Source:** `lib/validation/auth.ts:1-22`
**Apply to:** `lib/validation/doctor.ts`, `lib/validation/reference-data.ts`
One function per field/object, returns `string | null`, trims strings, no thrown exceptions, no schema library (locked project convention).

### Client-form + fetch + error display
**Source:** `app/signup/page.tsx:1-140` (full file is the canonical example)
**Apply to:** Every new admin form page (`app/admin/doctors/page.tsx`, `.../specialties/page.tsx`, `.../locations/page.tsx`, `app/doctor/change-password/page.tsx`)
`useState` per field + `fieldErrors`, client-side validation reusing the same `lib/validation/*.ts` functions as the server route, `fetch()` with JSON body, `isSubmitting` flag, `Alert variant="destructive"` for API-level errors, per-field `<p className="text-sm font-normal text-destructive">` for field errors.

### Hardcode privileged fields server-side
**Source:** `app/api/auth/signup/route.ts:48-50` (comment, directly cited in RESEARCH.md Pattern 2)
**Apply to:** `link-account` (`role: "doctor"`, `must_change_password: true`), doctors create/update route (`is_active`, `is_demo` must never come from client input)
Never trust `role`, `is_active`, `is_demo`, or `profile_id` from request bodies — set explicitly server-side, matching the existing `role: "patient"` hardcoding pattern.

### Test-user creation/cleanup for Playwright specs
**Source:** `tests/e2e/helpers/test-users.ts:1-73` (full file)
**Apply to:** All 6 new `tests/e2e/admin-*.spec.ts` files, and specifically the `link-account` test needs a cleanup helper extending this file per RESEARCH.md Wave 0 Gaps
`createTestUser(role, opts)` / `cleanupTestUsers()` / `deleteTestUserByEmail(email)` — reuse directly for admin, doctor, and patient fixtures across all new specs; extend with an admin-created-doctor cleanup variant for the `link-account` spec.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| Admin data-table/list UI (doctors/specialties/locations/users/appointments list views) | component | CRUD (read + paginated/filterable list) | No existing page in the codebase renders a data table or fetches a list from an API route — `app/admin/page.tsx` is a static placeholder with no data fetching. Planner should use shadcn `table`/`select`/`badge` primitives (RESEARCH.md Standard Stack) with the `app/signup/page.tsx` fetch/error-handling shape as the closest available fetch pattern, adapted from POST-on-submit to GET-on-mount. |
| One-time temp-password modal (D-03) | component (dialog) | request-response | No existing modal/dialog component in the codebase (`components/ui/` has no `dialog.tsx` yet — needs `npx shadcn add dialog`). Use RESEARCH.md's `link-account` route response shape (`{ tempPassword }`) as the data source; build the modal from the shadcn `dialog` primitive once installed. |

## Metadata

**Analog search scope:** `app/`, `lib/`, `tests/e2e/helpers/`, `supabase/migrations/`
**Files scanned:** `app/api/auth/signup/route.ts`, `app/api/auth/login/route.ts`, `lib/supabase/admin.ts`, `lib/supabase/server.ts`, `app/admin/layout.tsx`, `app/doctor/layout.tsx`, `app/patient/layout.tsx`, `lib/validation/auth.ts`, `app/signup/page.tsx`, `app/admin/page.tsx`, `tests/e2e/helpers/test-users.ts`
**Pattern extraction date:** 2026-08-04
