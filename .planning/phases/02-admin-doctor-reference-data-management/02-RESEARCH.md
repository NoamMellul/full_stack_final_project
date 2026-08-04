# Phase 2: Admin — Doctor & Reference Data Management - Research

**Researched:** 2026-08-04
**Domain:** Next.js App Router admin CRUD interface over Supabase Postgres/Auth (REST route handlers, manual validation, RLS already deployed)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Doctor photo handling
- **D-01:** No Supabase Storage bucket in this phase. `doctors.photo_url` stays a plain optional text field where the admin pastes an external image URL — no file upload, no bucket, no Storage permissions to manage. — **Reversibility:** reversible — a real Storage-backed upload can be added later without breaking anything that reads `photo_url` as a URL.
- **D-02:** Whenever `photo_url` is empty, render an initials-based avatar (derived from the doctor's `full_name`) everywhere a doctor photo would otherwise show (admin doctors list now; public profile/search cards in later phases).

#### Temporary password & account linking
- **D-03:** After `POST /api/admin/doctors/[id]/link-account` succeeds, the temporary password is shown to the admin exactly once, in a dismissible modal with a "Copy password" button and an explicit warning that it will not be shown again anywhere.
- **D-04:** The linked doctor is forced to change their password on first login. Requires a new flag (e.g. `profiles.must_change_password`, default `true` when a profile is created via admin link-account) checked at login/middleware, redirecting to a change-password page before any other route is reachable. — **Reversibility:** reversible — the flag and redirect are additive and localized to the login flow.

#### Reference data deletion guard
- **D-05:** The delete action for a specialty or location stays visible but is **disabled** (not hidden) when the item is referenced by at least one doctor, with inline explanatory text, e.g. "This specialty is used by 3 doctors and cannot be deleted." Same pattern for both specialties and locations.
- **D-06:** Disabling the button client-side is a UX convenience only, never the actual guard — the `DELETE` route must independently re-check for referencing doctors server-side and reject with an error regardless of client state.

#### Demo data seed script
- **D-07:** Seed script creates a moderate, realistic dataset: all specialties populated, all Tel-Aviv neighborhoods represented, and roughly 10-15 demo doctors spread across them.
- **D-08:** No photo URLs are seeded — demo doctors intentionally rely on the initials-avatar fallback (D-02), keeping the seed script free of external asset/network dependencies.
- **D-09:** Seed script does NOT create `availability_slots`. Slot seeding is deferred to whichever phase actually builds and validates availability logic (Phase 4/Phase 5) — Phase 2's seed script is scoped to doctors/specialties/locations/users only.

### Claude's Discretion
- Exact styling/implementation of the initials-avatar component (colors, sizing).
- Exact modal component implementation for the one-time password display (D-03) — any shadcn dialog primitive is fine.
- Exact demo doctor names/bios/specialty distribution within the "10-15 doctors, all specialties, all neighborhoods" envelope (D-07) — `is_demo = true` is already the schema default, so no extra labeling logic is needed beyond what Phase 1 already enforces.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| ADMIN-01 | Admin can create a doctor profile with all public details | Pattern 1 (admin route over RLS); Code Examples (`validateDoctorInput`); Standard Stack (shadcn form primitives) |
| ADMIN-02 | Admin can edit a doctor profile | Pattern 1, same route/RLS shape as create |
| ADMIN-03 | Admin can activate or deactivate a doctor profile | Architectural Responsibility Map; `doctors_admin_write` RLS policy already covers `UPDATE`; `doctors_is_active_idx` already exists for the public-search side effect |
| ADMIN-04 | Admin can link a doctor profile to a login account (temporary password) | Pattern 2 (service-role client); Pattern 3 (forced password-change gate); Common Pitfalls 1-2; Security Domain (CSPRNG, `must_change_password` never in `user_metadata`) |
| ADMIN-05 | Admin can manage the list of specialties | Pattern 1; Anti-Patterns (delete guard); Common Pitfalls 3-4 (idempotency, FK error translation) |
| ADMIN-06 | Admin can manage the list of neighborhoods/locations | Same as ADMIN-05, `locations` table |
| ADMIN-07 | Admin can view all registered users | Architectural Responsibility Map; `profiles_select_own_or_admin` RLS already covers this read |
| ADMIN-08 | Admin can view all appointments across the platform | Architectural Responsibility Map; `appointments_select_own_or_admin` RLS already covers this read |
</phase_requirements>

## Summary

This phase adds no new architectural surface to the project — it is CRUD (doctors, specialties, locations) plus two integration points with Supabase Auth's admin API (account linking with a temporary password, forced password change) plus two read-only oversight views (users, appointments). Every table this phase touches (`doctors`, `specialties`, `locations`, `doctor_languages`, `profiles`) already exists with RLS policies deployed in `supabase/migrations/20260803230000_initial_schema.sql` [VERIFIED: supabase/migrations/20260803230000_initial_schema.sql:1-276] — Phase 2 is pure API/UI work plus exactly one small migration (`profiles.must_change_password`).

The codebase already established every pattern this phase needs in Phase 1: a service-role admin client (`lib/supabase/admin.ts`) for operations that must bypass RLS or call Supabase Auth admin methods, a session-bound SSR server client (`lib/supabase/server.ts`) for everything RLS already permits, manual validation functions co-located in `lib/validation/*.ts`, and role-guard layouts that call `supabase.auth.getUser()` then check `profiles.role` before rendering [VERIFIED: app/admin/layout.tsx:1-31, app/doctor/layout.tsx:1-31]. Phase 2 should copy these patterns exactly rather than introduce new ones (e.g. no new auth library, no new validation library, no new state-management library).

The two genuinely new pieces of engineering in this phase are (1) the forced-password-change gate, which needs a new `profiles.must_change_password` column plus a check inside `app/doctor/layout.tsx` (Supabase Auth has no built-in "must change password" flag), and (2) an idempotent demo-data seed script, which needs either a natural-key unique constraint + `ON CONFLICT` upsert, or an explicit re-run guard, since `specialties` and `locations` currently have no unique constraint on their natural-language columns.

**Primary recommendation:** Build every admin route as a thin REST handler under `app/api/admin/` using the existing `lib/supabase/server.ts` client (RLS already allows admin all-table access via `is_admin()`); reserve `lib/supabase/admin.ts` (service-role) exclusively for the one route that must call `supabase.auth.admin.createUser()` and insert a `profiles` row on behalf of another user id (`link-account`). Add `must_change_password` via a new migration file, default `false` at the column level, set explicitly to `true` only by the link-account route. Seed script: add unique constraints on `specialties.name_en` and `locations.neighborhood` in the same migration, then use `INSERT ... ON CONFLICT DO NOTHING` for idempotency; run via `tsx` against the remote Supabase project using the same env vars the Playwright tests already use.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Doctor profile CRUD (create/edit/activate) | API / Backend | Database (RLS) | `doctors_admin_write` RLS policy already permits admin all-verb access [VERIFIED: supabase/migrations/20260803230000_initial_schema.sql:227-228: `create policy "doctors_admin_write" on public.doctors for all using (public.is_admin()) with check (public.is_admin());`] — route handler is a thin pass-through, DB is the actual authority |
| Doctor account linking (temp password) | API / Backend | External Service (Supabase Auth) | Requires `service_role` — Supabase Auth user creation cannot happen through the anon/session client at all |
| Forced password change gate | Frontend Server (SSR layout) | Database (flag) | Enforced in `app/doctor/layout.tsx` (Server Component, already the role-gate location) reading a DB column — no middleware/proxy change needed since proxy.ts deliberately defers role logic to layouts [VERIFIED: lib/supabase/proxy.ts:52-53: "Role mismatch is deliberately NOT checked here ... it's enforced in the role-scoped layouts instead"] |
| Specialty/location reference data CRUD | API / Backend | Database (RLS + FK) | Same admin-write RLS pattern; FK `on delete restrict` is the DB-level delete guard, pre-check is a UX/error-message layer only |
| Users oversight view (read-only) | API / Backend | Frontend Server (SSR page) | `profiles_select_own_or_admin` RLS already grants admin full read [VERIFIED: supabase/migrations/20260803230000_initial_schema.sql:197-198] |
| Appointments oversight view (read-only) | API / Backend | Frontend Server (SSR page) | `appointments_select_own_or_admin` RLS already grants admin full read [VERIFIED: supabase/migrations/20260803230000_initial_schema.sql:246-251] |
| Demo data seeding | Build tooling / CLI script | Database | Not part of any runtime request path; a one-off/re-runnable script executed by the developer, not by end users |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.112.0 (already installed) [VERIFIED: npm registry] | Service-role admin client for Auth user creation and RLS-bypassing profile inserts | Already used identically in `lib/supabase/admin.ts` and the Phase 1 signup route |
| `@supabase/ssr` | 0.12.4 (already installed) [VERIFIED: npm registry] | Session-bound server client for RLS-governed admin CRUD | Already used identically in `lib/supabase/server.ts` |
| Next.js Route Handlers | 16.2.12 (already installed) | REST endpoints under `app/api/admin/**` | Locked project convention (CLAUDE.md, Phase 1 D-01) |
| shadcn/ui primitives | via `shadcn` CLI 4.16.1 (already installed) | Forms, tables, dialogs for admin pages | Locked project convention; `npx shadcn add dialog table select textarea switch badge` for the components this phase needs beyond the four already generated (`button`, `card`, `input`, `label`, `alert`) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tsx` | 4.23.5 [ASSUMED — package-legitimacy verdict SUS, see audit below] | Run the TypeScript demo-data seed script (`scripts/seed.ts`) without a build step | Project has no test-runner/script-runner for `.ts` files outside Next.js/Playwright; needed only as a `devDependency` to execute a standalone script |
| Node `crypto.randomBytes` / `crypto.randomUUID` (built-in, no install) | — | Generate the one-time temporary password for `link-account` | Never hand-roll password generation with `Math.random()` — it is not cryptographically secure |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `tsx` for the seed script | A `.mjs` script using only stable Node syntax (no TS types), run directly with `node scripts/seed.mjs` | Zero new dependency, but loses type-checking on the seed script and diverges stylistically from the rest of the TypeScript codebase |
| `tsx` for the seed script | `node --experimental-strip-types scripts/seed.ts` (Node's built-in TS type-stripping) | Zero new dependency; however this flag's stability/default-on status varies across Node 22.x point releases and was not verified against the exact Node 22.18.0 installed in this environment — a version drift risk `tsx` doesn't have |
| `ON CONFLICT` upsert for seed idempotency | Check-then-insert (`SELECT` then conditional `INSERT`) | Avoids a schema migration for new unique constraints, but is a documented race-condition-prone anti-pattern in general — acceptable here only because the seed script is a single-admin, non-concurrent, one-off CLI invocation |
| DB column `must_change_password` | Supabase Auth `user_metadata.must_change_password` | `user_metadata` (`raw_user_meta_data`) is user-editable and must never be used for authorization decisions — a doctor could clear the flag themselves via `updateUser()` from the client |

**Installation:**
```bash
npm install --save-dev tsx
npx shadcn add dialog table select textarea switch badge
```

**Version verification:** `npm view tsx version` → `4.23.5`, `npm view @supabase/supabase-js version` → `2.112.0`, `npm view lucide-react version` → `1.28.0`, `npm view shadcn@4.16.1` confirms that exact pinned version exists on the registry [VERIFIED: npm registry — commands run directly against the live registry this session].

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `tsx` | npm | Package created 2015-08-20; **latest version published 2026-08-02** (2 days before this research) [VERIFIED via `gsd_run query package-legitimacy check`] | 82,293,140/week | `github.com/privatenumber/tsx` | **SUS** (`"too-new"` — tripped by the latest point-release date, not package age) | Flagged — planner must add `checkpoint:human-verify` before `npm install --save-dev tsx` |
| `@supabase/supabase-js`, `@supabase/ssr`, `shadcn`, `lucide-react` | npm | Already installed, in-use since Phase 1 | — | — | — | Not new installs this phase — no re-audit needed |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `tsx` — the automated signal is a false-positive-shaped flag (a 10-year-old package with 82M weekly downloads and a legitimate GitHub repo, whose latest *release* happens to be very recent), but per protocol it must still be gated behind a `checkpoint:human-verify` task rather than silently approved. `npm view tsx scripts.postinstall` returned empty (no postinstall script) [VERIFIED: npm registry].

## Architecture Patterns

### System Architecture Diagram

```
Admin browser
   │
   │  fetch() to /api/admin/*  (same-origin, session cookie attached)
   ▼
┌─────────────────────────────────────────────────────────────┐
│ Next.js Route Handler  app/api/admin/.../route.ts            │
│                                                                │
│  1. manual validation (lib/validation/*.ts)                   │
│  2. pick client:                                               │
│       - doctors/specialties/locations/users/appointments CRUD │
│         → lib/supabase/server.ts (session-bound, RLS enforces │
│           admin-only via is_admin())                           │
│       - link-account ONLY                                     │
│         → lib/supabase/admin.ts (service_role, bypasses RLS,  │
│           required for auth.admin.createUser())                │
│  3. return NextResponse.json(...)                              │
└───────────────┬───────────────────────────┬───────────────────┘
                │                           │
                ▼                           ▼
   Supabase Postgres (RLS-gated)   Supabase Auth Admin API
   doctors / specialties /          (creates auth.users row,
   locations / doctor_languages /   sets temp password)
   profiles / appointments
                │
                ▼
   FK `on delete restrict` (doctors→specialties, doctors→locations)
   is the durable delete guard; the route's pre-check is only
   for a friendly error message, never the actual authority.

Doctor first login
   │
   ▼
app/doctor/layout.tsx (Server Component)
   │  getUser() → profiles.role check (existing) →
   │  NEW: profiles.must_change_password check →
   │  if true, redirect to /doctor/change-password
   │  (that page itself must be excluded from the check,
   │   or the redirect loops)
   ▼
/api/auth/change-password → supabase.auth.updateUser({password})
   (session-bound client, no service_role needed — a user
   changing their OWN password is not a service-role operation)
   → also clears must_change_password = false
```

### Recommended Project Structure
```
app/
├── admin/
│   ├── layout.tsx              # already exists — role guard, no change needed
│   ├── page.tsx                # dashboard: summary counts (doctors/active/users/appts)
│   ├── doctors/
│   │   └── page.tsx            # list + create/edit form + link-account modal
│   ├── specialties/
│   │   └── page.tsx            # list + create/edit/delete form
│   ├── locations/
│   │   └── page.tsx            # list + create/edit/delete form
│   ├── users/
│   │   └── page.tsx            # read-only list
│   └── appointments/
│       └── page.tsx            # read-only list with filters
├── doctor/
│   ├── layout.tsx               # ADD must_change_password check here
│   └── change-password/
│       └── page.tsx             # new — forced first-login password change form
└── api/
    └── admin/
        ├── doctors/
        │   ├── route.ts                    # POST (create)
        │   └── [id]/
        │       ├── route.ts                # PATCH (edit)
        │       ├── status/route.ts         # PATCH (activate/deactivate)
        │       └── link-account/route.ts   # POST (service_role)
        ├── specialties/
        │   ├── route.ts                    # GET, POST
        │   └── [id]/route.ts               # PATCH, DELETE
        ├── locations/
        │   ├── route.ts                    # GET, POST
        │   └── [id]/route.ts               # PATCH, DELETE
        ├── users/route.ts                  # GET
        └── appointments/route.ts           # GET
lib/
└── validation/
    ├── doctor.ts               # new — name/specialty/location/bio/languages validators
    └── reference-data.ts       # new — specialty/location name validators
scripts/
└── seed.ts                    # new — idempotent demo data seed (run via tsx)
```

### Pattern 1: Admin route handler over RLS, not service-role
**What:** Every admin CRUD route (doctors, specialties, locations, users-read, appointments-read) uses the ordinary session-bound `createClient()` from `lib/supabase/server.ts`, never the admin client. RLS's `is_admin()` helper already grants the acting admin full read/write.
**When to use:** All admin routes except `link-account`.
**Example:**
```typescript
// Source: existing pattern in app/api/auth/login/route.ts, extended for admin CRUD
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateDoctorInput } from "@/lib/validation/doctor";

export async function POST(request: Request) {
  const body = await request.json();
  const error = validateDoctorInput(body);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const supabase = await createClient();
  // RLS's doctors_admin_write policy rejects this insert server-side if the
  // caller's profiles.role isn't 'admin' — no separate role check needed here,
  // but the layout guard already prevents non-admins from reaching this route.
  const { data, error: dbError } = await supabase
    .from("doctors")
    .insert({
      full_name: body.fullName,
      specialty_id: body.specialtyId,
      location_id: body.locationId,
      bio: body.bio ?? null,
      photo_url: body.photoUrl ?? null,
      // is_demo defaults to true, is_active defaults to false — do not pass them from client input.
    })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 });
  return NextResponse.json({ doctor: data });
}
```

### Pattern 2: Service-role client only for link-account
**What:** `link-account` must use `lib/supabase/admin.ts` for two reasons: (1) `supabase.auth.admin.createUser()` is a service-role-only API — there is no session-client equivalent; (2) inserting a `profiles` row with `id` equal to the *new* auth user's id (not the caller's own id) violates `profiles_insert_own`'s `with check (id = auth.uid())` [VERIFIED: supabase/migrations/20260803230000_initial_schema.sql:200-201], so it must go through the client that bypasses RLS — exactly the same reasoning already documented for the Phase 1 signup route [VERIFIED: app/api/auth/signup/route.ts:48-50 comment: "the profiles RLS INSERT policy only checks id = auth.uid(), never role, so the role value must never be taken from client input"].
**When to use:** `POST /api/admin/doctors/[id]/link-account` only.
**Example:**
```typescript
// Source: adapted from official Supabase JS docs (auth-admin-createuser) + existing
// app/api/auth/signup/route.ts orphan-cleanup pattern
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function generateTempPassword(): string {
  // Cryptographically secure, not Math.random(). 16 hex chars ~ 64 bits of entropy.
  return randomBytes(12).toString("base64url");
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const admin = createAdminClient();
  const { data: doctor } = await admin.from("doctors").select("full_name").eq("id", params.id).single();
  if (!doctor) return NextResponse.json({ error: "Doctor not found." }, { status: 404 });

  const body = await request.json();
  const tempPassword = generateTempPassword();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: body.email,
    password: tempPassword,
    email_confirm: true,
  });
  if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message ?? "Could not create account." }, { status: 400 });
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    role: "doctor", // hardcoded server-side, never from client input
    full_name: doctor.full_name,
    email: body.email,
    must_change_password: true,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id); // no orphaned auth account
    return NextResponse.json({ error: "Could not create profile." }, { status: 500 });
  }

  await admin.from("doctors").update({ profile_id: created.user.id }).eq("id", params.id);

  // Returned once; the caller (admin UI) must never persist this beyond the modal.
  return NextResponse.json({ tempPassword });
}
```

### Pattern 3: Forced password change gate
**What:** `profiles.must_change_password` (new column, default `false`) checked inside the role layout, mirroring the existing role-check pattern exactly.
**When to use:** `app/doctor/layout.tsx`, excluding the change-password page itself from the check.
**Example:**
```typescript
// Source: extends app/doctor/layout.tsx's existing pattern (app/doctor/layout.tsx:1-31)
import { redirect } from "next/navigation";
import SiteHeader from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, must_change_password")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "doctor") redirect("/");

  // Exclude the change-password route itself to avoid a redirect loop.
  // (Server Components don't see the pathname directly; pass it via a
  // segment-level check or move this gate into a route-specific layout
  // wrapping only the pages that require a completed password change.)
  if (profile?.must_change_password) redirect("/doctor/change-password");

  return (<><SiteHeader />{children}</>);
}
```
**Note:** because Server Component layouts don't receive the current pathname as a prop, the cleanest way to exclude `/doctor/change-password` from its own gate is to nest it as a *sibling* outside `app/doctor/(gated)/layout.tsx` (route group) rather than inside `app/doctor/layout.tsx` directly — the planner should choose one of: (a) a route group split (`app/doctor/(gated)/...` vs `app/doctor/change-password/...`), or (b) reading `headers().get("x-invoke-path")`/using `next/navigation`'s `redirect` only from pages other than change-password and duplicating the role-check there. Flagged as an **Open Question** below since this is a structural decision the planner should make explicitly, not something to leave implicit in a task description.

### Anti-Patterns to Avoid
- **Trusting `profiles.role` from client input on any insert/update:** always hardcode `role` server-side (already the enforced Phase 1 pattern; T-01-01 in STATE.md exists specifically because this was the first vulnerability class found).
- **Using `service_role` for routes RLS already permits:** defeats the purpose of the RLS policies already deployed and re-introduces an "am I checking the right thing" audit burden across every route — reserve `service_role` for the one route that structurally requires it.
- **Client-side-only delete guard:** the disabled button (D-05) is non-negotiable UX, but the `DELETE` route must independently reject (D-06) — the FK constraint already does this at the DB layer [VERIFIED: supabase/migrations/20260803230000_initial_schema.sql:48-49: `specialty_id uuid not null references public.specialties (id) on delete restrict` / `location_id uuid not null references public.locations (id) on delete restrict`], so "independently re-check" can mean either catching the Postgres `23503` foreign-key-violation error and translating it to a friendly message, or an explicit `COUNT(*)` pre-check — either satisfies D-06 as long as it isn't purely client-side.
- **`Math.random()` for the temporary password:** not cryptographically secure; use `node:crypto`.
- **Storing the temporary password anywhere after the response:** D-03 requires it shown exactly once — do not log it, do not write it to a DB column, do not include it in any audit trail beyond the ephemeral API response body.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth user creation with a set password | Custom Auth API wrapper | `supabase.auth.admin.createUser({ email, password, email_confirm: true })` [CITED: supabase.com/docs/reference/javascript/auth-admin-createuser] | Official admin API, already the exact pattern used in `app/api/auth/signup/route.ts` |
| Cryptographically secure random password | `Math.random()`-based generator | `node:crypto`'s `randomBytes` / `randomUUID` (built into Node, zero install) | `Math.random()` is not a CSPRNG; a temp password generated from it is guessable |
| Idempotent bulk insert | Manual duplicate-checking loops in application code | Postgres `INSERT ... ON CONFLICT DO NOTHING` (after adding a unique constraint) | Atomic, race-condition-free, one round trip per batch [CITED: postgresql.org/docs/current/sql-insert.html#SQL-ON-CONFLICT via supabase-postgres-best-practices skill reference `data-upsert.md`] |
| Avatar initials fallback | Nothing to avoid hand-rolling here — this is intentionally a small first-party component (D-02, Claude's Discretion) | — | Genuinely trivial; no library needed |

**Key insight:** Every non-trivial problem in this phase (secure credential generation, RLS authorization, atomic upsert) already has a database-level or standard-library answer. The only phase-specific code this phase should write is validation functions, thin route handlers, and page-level composition of shadcn primitives.

## Runtime State Inventory

> Not applicable — Phase 2 is greenfield admin functionality, not a rename/refactor/migration of existing state. Skipping per trigger condition.

## Common Pitfalls

### Pitfall 1: Column-level default on `must_change_password` forces the wrong users
**What goes wrong:** If the migration sets `must_change_password boolean not null default true`, every *existing* row (and any future patient self-signup, which goes through the unrelated `/api/auth/signup` route) inherits `true`, forcing patients into a change-password flow they never needed.
**Why it happens:** Migration authors often default new "gate" columns to the "safe" value without checking which code paths actually populate the table.
**How to avoid:** Column default must be `false`; only the `link-account` route's explicit `insert` sets it to `true`.
**Warning signs:** A patient is redirected to `/doctor/change-password`-equivalent (or any unexpected gate) right after normal signup.

### Pitfall 2: Redirect loop on the change-password page
**What goes wrong:** If the `must_change_password` check lives directly in `app/doctor/layout.tsx` and that layout wraps *every* route under `/doctor`, including `/doctor/change-password` itself, the redirect fires on the very page meant to clear the flag — infinite redirect.
**Why it happens:** Next.js layouts wrap all nested routes by default; there's no built-in "except this path" primitive at the layout level.
**How to avoid:** Split into a route group (e.g. `app/doctor/(gated)/...`) so `change-password` sits outside the gated layout, or perform the check in each gated page rather than the shared layout. See Open Questions.
**Warning signs:** Playwright test for "doctor with must_change_password=true can reach and submit change-password" hangs or redirects repeatedly.

### Pitfall 3: Reference-data delete guard relying only on the FK error message
**What goes wrong:** Postgres's raw `foreign_key_violation` (`23503`) error text is not user-friendly and may leak table/constraint names to the client if returned unmodified.
**Why it happens:** It's tempting to just forward `dbError.message` from Supabase's response.
**How to avoid:** Either do an explicit `count` pre-check (`select count(*) from doctors where specialty_id = :id`) and return a friendly 409 before attempting the delete, or catch the specific Postgres error code and translate it — never forward the raw Postgres error string to the client.
**Warning signs:** A Playwright test asserting the friendly message "cannot be deleted" fails because the response body instead contains a raw Postgres constraint name.

### Pitfall 4: Seeding non-idempotently against tables with no unique constraint
**What goes wrong:** Re-running the seed script inserts duplicate specialties/locations/doctors every time, since `specialties.name_en` and `locations.neighborhood` have no unique constraint today [VERIFIED: supabase/migrations/20260803230000_initial_schema.sql:24-40 — no `unique` keyword present on either table's definition].
**Why it happens:** `INSERT` with no `ON CONFLICT` clause and no application-level duplicate check always succeeds, regardless of whether a semantically identical row already exists.
**How to avoid:** Add unique constraints (in the same migration as `must_change_password`) on `specialties.name_en` and `locations (neighborhood, city)`, then use `ON CONFLICT DO NOTHING`. For doctors (no natural unique key at all — two doctors could legitimately share a name), guard at the script level instead: check total demo-doctor count before seeding, or check for exact `full_name` + `is_demo = true` matches.
**Warning signs:** Row counts in `specialties`/`locations`/`doctors` grow every time the seed script is re-run in a demo/CI reset.

### Pitfall 5: Using the service-role client where RLS already does the job
**What goes wrong:** If every admin route reflexively uses `lib/supabase/admin.ts` "to be safe," the app loses the RLS audit trail — a bug in a route handler's own role-check becomes the *only* defense, instead of RLS being a second independent layer.
**Why it happens:** The admin client "just works" for everything since it bypasses all RLS, which can look like the path of least resistance.
**How to avoid:** Use `lib/supabase/server.ts` (session-bound) for all CRUD RLS already permits (`doctors_admin_write`, `specialties_admin_write`, `locations_admin_write`, `profiles_select_own_or_admin`, `appointments_select_own_or_admin`); reserve the admin client strictly for `link-account`'s two service-role-only operations.
**Warning signs:** Code review finds `createAdminClient()` imported in a route that has no Supabase Auth admin API call and no cross-user insert.

## Code Examples

### Manual validation function for doctor creation (matching existing style)
```typescript
// Source: styled after lib/validation/auth.ts (existing pattern)
export function validateDoctorInput(body: Record<string, unknown>): string | null {
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  if (!fullName) return "Full name is required.";
  if (typeof body.specialtyId !== "string" || !body.specialtyId) return "Specialty is required.";
  if (typeof body.locationId !== "string" || !body.locationId) return "Location is required.";
  if (body.photoUrl !== undefined && body.photoUrl !== null && body.photoUrl !== "") {
    if (typeof body.photoUrl !== "string" || !/^https?:\/\//.test(body.photoUrl)) {
      return "Photo URL must be a valid http(s) URL.";
    }
  }
  return null;
}
```

### Idempotent reference-data seeding (after adding unique constraints)
```typescript
// Source: pattern from supabase-postgres-best-practices skill reference (data-upsert.md),
// adapted to supabase-js .upsert()
import { createAdminClient } from "../lib/supabase/admin";

const admin = createAdminClient();

const specialties = [
  { name_he: "רפואת משפחה", name_en: "Family Medicine" },
  { name_he: "קרדיולוגיה", name_en: "Cardiology" },
  // ...
];

await admin.from("specialties").upsert(specialties, { onConflict: "name_en", ignoreDuplicates: true });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| N/A — no prior implementation of this phase exists | N/A | — | — |

**Deprecated/outdated:**
- `auth.role() = 'authenticated'` in RLS policies is deprecated in favor of the `TO authenticated` clause [CITED: supabase security checklist, via `supabase` skill] — not directly relevant here since this phase adds no new RLS policies, but worth knowing if the planner adds any policy for `must_change_password` reads/writes.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `tsx` is the right tool to run the seed script (vs. Node's native `--experimental-strip-types` or a plain `.mjs` file) | Standard Stack / Alternatives Considered | Low — if the planner prefers zero new dependencies, the `.mjs` alternative works with no functional loss, only style divergence |
| A2 | Recommended unique constraints (`specialties.name_en`, `locations (neighborhood, city)`) won't collide with real seed data content the user intends (e.g. two neighborhoods with the same name in different areas of Tel-Aviv) | Common Pitfalls / Pitfall 4 | Medium — if two intended locations legitimately share a neighborhood name (e.g. same neighborhood, different address), the unique constraint would incorrectly reject a legitimate row; verify against the actual ~10-15 doctor / all-neighborhoods dataset before locking the constraint shape |
| A3 | The cleanest structural fix for the change-password redirect loop is a route group split (`app/doctor/(gated)/...`) rather than a per-page duplicated check | Architecture Patterns / Pattern 3, Open Questions | Low-Medium — both approaches work; the route-group split is more idiomatic Next.js App Router but requires moving existing `app/doctor/page.tsx` into the group, a small refactor the planner must account for as an explicit task |
| A4 | Admin accounts themselves are never created via `link-account` (only doctors are) — `must_change_password` therefore only needs to gate the doctor layout, not a hypothetical admin equivalent | Architectural Responsibility Map | Low — confirmed by ADMIN-04 requirement text ("Admin can link a doctor profile to a login account") and TASKS.md item 4, both scoped to doctors only |

**If this table is empty:** N/A — see entries above.

## Open Questions

1. **Where exactly does the `must_change_password` gate live to avoid a redirect loop on its own page?**
   - What we know: The check must run somewhere in the `/doctor/*` request path, mirroring the existing `app/doctor/layout.tsx` role-check pattern, and must not fire on the change-password page itself.
   - What's unclear: Whether the planner should split `app/doctor/` into a route group (`(gated)` vs. the change-password page as a sibling) or duplicate the profile fetch+redirect logic inside each gated page.
   - Recommendation: Route group split — it keeps the single-source-of-truth gate pattern Phase 1 established (one check, one place) rather than duplicating profile-fetch logic per page. Planner should include the `app/doctor/page.tsx` move as an explicit task since it's a file relocation, not just a new file.

2. **Should the same forced-password-change mechanism eventually generalize to admin-created patient/admin accounts, or is it doctor-only by design?**
   - What we know: CONTEXT.md D-04 and TASKS.md both scope this to doctor accounts created via `link-account`.
   - What's unclear: Whether a future phase (or a hidden requirement) expects the same column/mechanism reused for other admin-created accounts.
   - Recommendation: Build the column and check generically enough (`profiles.must_change_password`, checked wherever a role layout runs) that reuse is trivial later, but don't build UI/routes for non-doctor cases now — YAGNI, matches phase scope exactly as written.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Running the seed script, Next.js dev/build | ✓ | v22.18.0 [VERIFIED: `node --version` this session] | — |
| npm | Installing `tsx`, running scripts | ✓ | 11.11.0 [VERIFIED: `npm --version` this session] | — |
| Supabase CLI | Applying the new migration | ✗ not on global `PATH` | — | ✓ available via `npx supabase` (confirmed `2.111.0` responds) [VERIFIED: `npx supabase --version` this session] — use `npx supabase db push` instead of a bare `supabase` command |
| Remote Supabase project (hosted, not local) | Everything — this project has no local Postgres; Phase 1 confirmed schema was pushed to and lives on a real remote project | ✓ (assumed reachable — same env vars Playwright's `tests/e2e/helpers/supabase-admin.ts` already depends on) | — | — |
| `tsx` (for the seed script) | `scripts/seed.ts` execution | ✗ not yet installed | 4.23.5 latest on registry | `.mjs` script run directly with plain `node` (see Alternatives Considered) |

**Missing dependencies with no fallback:** none — every gap above has a working fallback already identified.
**Missing dependencies with fallback:** Supabase CLI (use `npx supabase`), `tsx` (use a `.mjs` script if the `checkpoint:human-verify` for the SUS-flagged package is not resolved).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.62.1 [VERIFIED: package.json devDependencies] |
| Config file | `playwright.config.ts` (testDir `./tests/e2e`, `baseURL: http://localhost:3000`, `webServer` auto-starts `npm run dev`) [VERIFIED: playwright.config.ts:1-30] |
| Quick run command | `npx playwright test tests/e2e/<file>.spec.ts` |
| Full suite command | `npx playwright test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMIN-01 | Admin creates a doctor profile with all public fields | e2e | `npx playwright test tests/e2e/admin-doctor-crud.spec.ts` | ❌ Wave 0 |
| ADMIN-02 | Admin edits a doctor profile | e2e | `npx playwright test tests/e2e/admin-doctor-crud.spec.ts` | ❌ Wave 0 |
| ADMIN-03 | Admin activates/deactivates a doctor; deactivated doctor disappears from public-facing RLS-gated read | e2e | `npx playwright test tests/e2e/admin-doctor-status.spec.ts` | ❌ Wave 0 |
| ADMIN-04 | Admin links a doctor to a login account; temp password shown once; doctor can log in and is forced to change password | e2e | `npx playwright test tests/e2e/admin-doctor-link-account.spec.ts` | ❌ Wave 0 |
| ADMIN-05 | Admin manages (add/edit/delete-with-guard) specialties | e2e | `npx playwright test tests/e2e/admin-reference-data.spec.ts` | ❌ Wave 0 |
| ADMIN-06 | Admin manages (add/edit/delete-with-guard) locations | e2e | `npx playwright test tests/e2e/admin-reference-data.spec.ts` | ❌ Wave 0 |
| ADMIN-07 | Admin views all registered users | e2e | `npx playwright test tests/e2e/admin-oversight-views.spec.ts` | ❌ Wave 0 |
| ADMIN-08 | Admin views all appointments platform-wide | e2e | `npx playwright test tests/e2e/admin-oversight-views.spec.ts` | ❌ Wave 0 |
| (cross-cutting) | Non-admin denied access to `/admin/*` and `/api/admin/*` | e2e | `npx playwright test tests/e2e/admin-route-protection.spec.ts` | ❌ Wave 0 |
| (seed script) | Seed script is idempotent (re-run produces no duplicate rows) | manual-only | run `tsx scripts/seed.ts` twice, diff row counts via `npx supabase db query` or the Supabase dashboard | ❌ Wave 0 — no automated harness for this; Playwright doesn't cover CLI scripts and the project has no Vitest/Node test runner (CLAUDE.md constraint) |

### Sampling Rate
- **Per task commit:** run the single new/changed spec file (`npx playwright test tests/e2e/<file>.spec.ts`).
- **Per wave merge:** `npx playwright test` (full suite, including Phase 1's existing auth/route-protection specs — this phase must not regress them).
- **Phase gate:** Full suite green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/e2e/admin-doctor-crud.spec.ts` — covers ADMIN-01, ADMIN-02
- [ ] `tests/e2e/admin-doctor-status.spec.ts` — covers ADMIN-03
- [ ] `tests/e2e/admin-doctor-link-account.spec.ts` — covers ADMIN-04 (needs a helper extending `tests/e2e/helpers/test-users.ts`/`supabase-admin.ts` to clean up admin-created doctor accounts after the test, same pattern as `cleanupTestUsers()`)
- [ ] `tests/e2e/admin-reference-data.spec.ts` — covers ADMIN-05, ADMIN-06, including the delete-guard UX (disabled button + server-side rejection)
- [ ] `tests/e2e/admin-oversight-views.spec.ts` — covers ADMIN-07, ADMIN-08
- [ ] `tests/e2e/admin-route-protection.spec.ts` — non-admin denial, extending the existing pattern in `tests/e2e/route-protection-role-mismatch.spec.ts`
- [ ] Framework install: none needed — Playwright is already configured project-wide.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | Yes | Supabase Auth (`@supabase/ssr`/`@supabase/supabase-js`), no custom auth logic; temp password generated via `node:crypto`, never `Math.random()` |
| V3 Session Management | Yes (reused, not new) | Existing SSR cookie-based session from Phase 1 — this phase adds no new session logic |
| V4 Access Control | Yes | RLS `is_admin()` / `is_doctor_owner()` security-definer helpers already deployed [VERIFIED: supabase/migrations/20260803230000_initial_schema.sql:153-177]; role-guard layouts (`app/admin/layout.tsx`, `app/doctor/layout.tsx`) as the UI-layer mirror of the same check |
| V5 Input Validation | Yes | Manual TypeScript validation functions in `lib/validation/*.ts` (locked project convention, no Zod) |
| V6 Cryptography | Yes | Temporary password must use a CSPRNG (`node:crypto.randomBytes`), never a non-cryptographic RNG |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Client sends `role` or `is_active`/`is_demo` in the request body, expecting the server to trust it | Elevation of Privilege | Never read these fields from client input on insert/update; hardcode server-side exactly as `app/api/auth/signup/route.ts` already does for `role` |
| Non-admin calls `/api/admin/*` directly (bypassing the UI) | Elevation of Privilege | RLS is the actual authority (`*_admin_write` policies) — even if a route handler's own role check were buggy or missing, the DB independently rejects the write; route handlers should still check role explicitly as defense-in-depth, matching the layout pattern |
| Client-side-only delete-guard bypass (calling `DELETE` directly with dev tools after the button is "disabled") | Tampering | Server-side FK `on delete restrict` + explicit pre-check/error translation (D-06) |
| Temporary password logged, cached, or persisted anywhere beyond the one-time API response | Information Disclosure | Never `console.log` or store the temp password; return-once pattern only (D-03) |
| Doctor edits their own `user_metadata` to clear a client-controlled "must change password" flag | Elevation of Privilege | Store the flag in `profiles.must_change_password` (a normal Postgres column governed by RLS), never in Supabase Auth's `user_metadata`, which is user-editable and unsafe for authorization decisions [CITED: supabase skill security checklist — "Never use user_metadata claims in JWT-based authorization decisions"] |

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/20260803230000_initial_schema.sql` — read in full this session; all table/column/RLS/FK claims verified directly against this file
- `app/admin/layout.tsx`, `app/doctor/layout.tsx`, `app/patient/layout.tsx`, `lib/supabase/{admin,server,client,proxy}.ts`, `app/api/auth/{signup,login}/route.ts`, `lib/validation/{auth,redirect}.ts`, `tests/e2e/helpers/{test-users,supabase-admin}.ts`, `playwright.config.ts`, `components.json`, `package.json` — read in full this session
- `npm view tsx / @supabase/supabase-js / lucide-react / shadcn@4.16.1` — run directly against the live npm registry this session
- `gsd_run query package-legitimacy check --ecosystem npm tsx` — run this session

### Secondary (MEDIUM confidence)
- [supabase.com/docs/reference/javascript/auth-admin-createuser](https://supabase.com/docs/reference/javascript/auth-admin-createuser) — `createUser()` signature and parameters
- [supabase.com/docs/reference/javascript/auth-admin-updateuserbyid](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid) — `updateUserById()` signature, used for the password-change route
- `.claude/skills/supabase` and `.claude/skills/supabase-postgres-best-practices` reference files (`data-upsert.md`, `schema-constraints.md`) — Supabase-maintained best-practice guidance on RLS security traps, `user_metadata` vs `app_metadata`, and idempotent upsert patterns

### Tertiary (LOW confidence)
- None — all findings this session were either verified directly against project files/tooling or cited from official Supabase documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library is already installed and in use in this exact codebase except `tsx`, which is a well-established, high-download package flagged only by a date-based heuristic
- Architecture: HIGH — directly derived from reading the existing, working Phase 1 code (layouts, clients, routes) that this phase must extend, not from general framework conventions
- Pitfalls: HIGH — each pitfall is grounded in a specific, quoted line of the deployed schema or an existing code comment, not speculative

**Research date:** 2026-08-04
**Valid until:** 2026-09-03 (30 days — stable stack, no fast-moving dependencies beyond `tsx` which is dev-tooling only)
