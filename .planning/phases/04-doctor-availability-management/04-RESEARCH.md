# Phase 4: Doctor Availability Management - Research

**Researched:** 2026-08-08
**Domain:** Postgres constraint-violation error handling in Next.js Route Handlers via supabase-js v2; server-enforced scheduling conflict rules
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `DELETE /api/doctor/slots/[id]` is NOT restricted to `status = 'available'` as TASKS.md's literal wording suggested. The real rule (confirmed by the user, matches AVAIL-04's "has not been booked" wording) is: `available` → can be deleted. `blocked` → can be deleted (this is how a doctor un-blocks a period — there is no separate "unblock" endpoint, deleting the blocked row IS the unblock action). `booked` (or otherwise tied to an appointment) → cannot be deleted directly; rejected (AVAIL-05).
- **D-02:** Deleting a blocked period only removes the restriction — it must NOT automatically recreate any availability slots that existed in that range before the block was created. The doctor re-adds availability manually afterward if they want it.
- **D-03:** A blocked period is represented as a single `availability_slots` row with `status = 'blocked'`, spanning one continuous `start_at`→`end_at` range — never decomposed into per-day or business-hour rows. Reuses the existing schema/exclusion-constraint mechanism as-is; no data-model redesign. Examples: same-day partial block (Mon 14:00→18:00), multi-day block spanning night hours (Mon 09:00→Wed 18:00), full-day vacation range (Aug 20 00:00→Aug 27 23:59).
- **D-04:** Add a nullable `reason text` column to `availability_slots` (new migration required). Optional free-text set by the doctor when blocking (e.g. "Vacation", "Conference"); purely informational, no validation on content. Shown next to blocked entries in the schedule list. Not applicable to `available`/`booked` rows.
- **D-05:** Availability management is doctor-only in this phase. No `app/api/admin/.../slots` routes and no admin schedule-management page are built. Reversible: `availability_slots_write_owner_or_admin` RLS already permits `is_admin()` writes, so an admin UI can be added later without migration/policy change.
- **D-06:** Every add/delete/block endpoint resolves the acting doctor's `doctor_id` from the authenticated session (`doctors.profile_id = auth.uid()`) — never accept a client-supplied `doctor_id`.
- **D-07:** A doctor can only ever modify their own schedule (enforced by D-06 + existing RLS `availability_slots_write_owner_or_admin`).
- **D-08:** No availability slot or blocked period can be created in the past (AVAIL-02), evaluated in `Asia/Jerusalem` input terms but compared as the resolved UTC instant.
- **D-09:** For any new slot or blocked period, `start_at` must be before `end_at` (already a DB check constraint `availability_slots_valid_range`; app-level validation duplicates it for a clean error message before hitting the DB).
- **D-10:** Available slots cannot overlap each other; an available slot cannot overlap a blocked period; a blocked period cannot overlap a booked appointment or another blocked period. Already covered in one shot by the existing `availability_slots_no_overlap` GiST exclusion constraint (`doctor_id` + `tstzrange(start_at, end_at)`, applies across every status uniformly) — no new constraint needed, just correctly catching and translating its violation (Postgres error code `23P01`).
- **D-11:** Overlap-rejection error message is generic regardless of what it collided with — one message such as "This time overlaps your existing schedule," never distinguishing available/booked/blocked in the copy.
- **D-12:** All scheduling input/output on this phase's pages and forms is displayed and entered in `Asia/Jerusalem`, converted to/from UTC using `lib/timezone.ts` helpers (`jerusalemWallClockToUtc` for date+time form fields) — no new timezone-conversion logic invented.
- **D-13:** Day-grouped list view — NOT a calendar grid. Reuse the existing `groupSlotsByJerusalemDay` + `formatJerusalemDayHeading` + `formatJerusalemTime` pattern from `app/doctors/[id]/page.tsx` (adapted to a doctor's own multi-status slots).
- **D-14:** The list must visually distinguish `available` vs `blocked` status per entry (badge/color), format: `HH:MM – HH:MM   [Available|Blocked]`, with optional `reason` (D-04) shown next to blocked entries.
- **D-15:** The page shows future (today-and-forward) entries only — no past/elapsed slots or blocks.
- **D-16:** "Add slot" is a single-slot-per-submission form (date + start time + end time) — no recurring-availability or bulk-generation feature in this phase, unless trivial (Claude's discretion at planning time, not a requirement).
- **D-17:** "Block a period" is a separate form/action from "Add slot," taking start date/time + end date/time + optional reason (D-04).
- **D-18:** "Delete slot" action applies to both available slots and blocked periods per D-01, and is disabled/hidden for `booked` slots per AVAIL-05.

### Claude's Discretion

- Exact styling/wording of the available-vs-blocked distinction on the schedule list (badge variant, color) — reuse `components/ui/badge.tsx` per the project's established pattern (Phase 2/3 precedent).
- Exact copy of the generic overlap-rejection error message (D-11) and the past-date rejection message (D-08).
- Whether a "quick recurring slots" convenience is added on top of the single-slot form (D-16) — only if trivial; not required.
- Exact shape/placement of the "Add slot" vs "Block period" forms on `/doctor/schedule` (e.g. two inline forms, a tab switch, or a dialog per action) — any approach consistent with existing shadcn primitives is fine.

### Deferred Ideas (OUT OF SCOPE)

- **Admin schedule management** ("admin manages a doctor's schedule") — explicitly deferred by the user (D-05) to a future phase/need, not this milestone's roadmap. The RLS policy already supports it without a migration when/if it's added.
- **Recurring / bulk slot generation** — explicitly deferred unless trivial at planning time (D-16); not a requirement for this phase.
- **Past-slot history on the schedule page** — explicitly out of scope for this phase (D-15); no AVAIL-* requirement asks for it.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| AVAIL-01 | Doctor can add an available time slot | Pattern 1 (`requireDoctor()`), Pattern 2 (error-branch skeleton for POST `/api/doctor/slots`), Code Examples section |
| AVAIL-02 | Doctor cannot add a slot in the past | `lib/validation/availability.ts` skeleton (`isInPast`/D-08 check) in Code Examples; app-level pre-check per Architectural Responsibility Map |
| AVAIL-03 | Doctor cannot create overlapping slots | Pattern 2 (`23P01` branching, verified against installed `PostgrestError.ts` and existing `23505`/`23503` precedent); Validation Architecture concurrency test |
| AVAIL-04 | Doctor can delete a slot that has not been booked | Recommended Project Structure (`app/api/doctor/slots/[id]/route.ts`); D-01 clarifies available+blocked are both deletable |
| AVAIL-05 | Doctor cannot delete a slot that has been booked | Pitfall/Threat table: app-level status check independent of RLS, since RLS only proves ownership not status-conditional deletability |
| AVAIL-06 | Doctor can block a period of unavailability | Recommended Project Structure (`app/api/doctor/blocked-periods/route.ts`); D-03/D-04/D-17 shape rules; migration for `reason` column (Pitfall 3) |
| AVAIL-07 | A blocked period cannot overlap an existing available slot | Same `23P01` mechanism as AVAIL-03 — the exclusion constraint applies uniformly across all statuses (D-10); Validation Architecture test map |
</phase_requirements>

## Summary

This phase's business rules are already fully locked in `04-CONTEXT.md` (D-01 through D-18) — this research does not re-derive them. It answers the two concrete technical unknowns the context flagged: (1) exactly how a Postgres exclusion-constraint violation (`23P01`) surfaces through `supabase-js` v2 inside this project's Route Handlers, and how to distinguish it from the sibling `23514` check-constraint violation on the same table, and (2) the Nyquist validation architecture for this phase's DB-enforced-vs-app-enforced conflict rules.

Finding 1 is now settled with the highest confidence available in this codebase: the installed `@supabase/postgrest-js` (pulled in by `@supabase/supabase-js@^2.112.0`) defines `PostgrestError` as `{ message, details, hint, code }` — all **top-level string fields**, no nesting, no `cause`. `code` carries the raw Postgres SQLSTATE unchanged when the error originates in Postgres (as opposed to PostgREST itself, which uses its own `PGRSTxxx` codes, as already seen in this codebase's `PGRST103` handling in `app/api/doctors/route.ts`). This project already has two working, shipped examples of exactly this pattern — `app/api/admin/locations/[id]/route.ts` branches on `error.code === "23505"` (unique_violation) and `error.code === "23503"` (foreign_key_violation) directly off the destructured `error` from a `supabase.from(...).insert()/.update()/.delete()` call. Phase 4's overlap handler is a straight extension of that exact pattern, branching on `error.code === "23P01"` instead.

Finding 2: this phase's conflict rules split cleanly into an app-level pre-check layer (for a fast, specific error message, e.g. "cannot be in the past") and a DB-level enforcement layer (the actual guarantee, via the existing `availability_slots_no_overlap` GiST exclusion constraint and `availability_slots_valid_range` check constraint) — this mirrors the "DB constraint is the real guarantee, app-level check is for UX" philosophy already established in this codebase for the Phase 2 reference-data delete-guard (409 pre-check + `23503` fallback translation). The Validation Architecture section below documents which rule lives at which layer and specifies a concurrent-write Playwright test that proves the DB constraint — not just the app check — is what actually blocks an overlap.

**Primary recommendation:** Branch on `error.code` (a flat string) immediately after every `availability_slots` write in this phase's three new routes, in this priority order: `23P01` → generic overlap message (D-11, 409); `23514` → "start time must be before end time" (defensive fallback behind the app-level `D-09` pre-check, 400); anything else → generic 500. Never inspect `error.message` or `error.details` for branching — those are for logs only. Reuse `lib/timezone.ts` as-is (D-12) and extend `app/doctors/[id]/page.tsx`'s `groupSlotsByJerusalemDay` pattern to carry `status`/`reason` for the new `/doctor/schedule` page.

## Project Constraints (from CLAUDE.md)

Extracted from `./.claude/CLAUDE.md`, treated with the same authority as locked CONTEXT.md decisions:

- **Tech stack:** Next.js (App Router) + TypeScript + Supabase (Postgres, Auth, Storage), deployed to Vercel — this phase adds no new stack element, only new routes/pages/migration on the existing stack.
- **API architecture:** Classic REST Route Handlers (`app/api/.../route.ts`) — **no Server Actions**. This phase's three new endpoints (`slots`, `slots/[id]`, `blocked-periods`) must all be `route.ts` files, matching every prior phase.
- **Validation:** Manual hand-written TypeScript validation functions — **no Zod or any schema library**. `lib/validation/availability.ts` must follow the existing `string | null` return convention seen in `lib/validation/doctor.ts`.
- **Tests:** Playwright end-to-end only — **no Vitest, no React Testing Library**. All verification for AVAIL-01..07 must be `tests/e2e/*.spec.ts` files (see Validation Architecture).
- **Medical data:** No sensitive medical data stored — not implicated by this phase (`availability_slots` carries only time ranges, status, and an optional free-text `reason`).
- **i18n:** Custom lightweight i18n (React context + JSON dictionaries, conditional `dir="rtl"`) — **no next-intl**. [VERIFIED: repo-wide search this session found no `i18n` file anywhere in the codebase] No i18n infrastructure exists yet anywhere in the repo — I18N-01/02 are tracked to Phase 6, not built yet. This phase should write plain hardcoded English UI copy, matching every prior phase's doctor/admin/patient pages to date; do not build i18n scaffolding as part of this phase.
- **UI:** Tailwind CSS + shadcn/ui — this phase's forms/list must use `components/ui/*` primitives already in the repo (see Standard Stack); no Material UI/Ant Design, no new component library.
- **Timezone:** Everything stored as `timestamptz` UTC; conversion to `Asia/Jerusalem` only at the UI boundary via `lib/timezone.ts` (D-12) — this phase must not invent a second conversion path.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Add available slot / block period (form submit) | Browser / Client | API / Backend | Client Component collects Asia/Jerusalem date+time input and calls the API; all authority lives server-side |
| Slot/period ownership resolution (`doctor_id` from session) | API / Backend | Database / Storage | `doctors.profile_id = auth.uid()` resolved server-side per D-06; RLS (`is_doctor_owner`) is the backstop, not the primary gate |
| Past-date rejection (D-08) | API / Backend | — | Pure input validation against `now()`; no DB round trip needed to reject |
| Range-order validation (`start_at < end_at`, D-09) | API / Backend | Database / Storage | App pre-check for fast/clean message; `availability_slots_valid_range` check constraint is the DB-level backstop |
| Overlap prevention (D-10) | Database / Storage | API / Backend | The GiST exclusion constraint is the actual guarantee (matches the project's anti-double-booking philosophy in PROJECT.md); the API only translates its failure into a message |
| Delete/unblock authorization (booked vs. available/blocked, D-01/AVAIL-05) | API / Backend | Database / Storage | Status branch is app logic (`if status === 'booked' reject`); RLS only proves ownership, not status-conditional deletability |
| Schedule list display, day-grouping, RTL/i18n formatting | Browser / Client | — | Pure presentation; reuses `lib/timezone.ts` formatters client-side, same as the existing public profile page |

## Standard Stack

This phase introduces **no new external packages**. It is built entirely on dependencies already present and verified in this project (`@supabase/supabase-js@^2.112.0`, `@supabase/ssr@^0.12.4`, `next@16.2.12`, existing `components/ui/*` shadcn primitives). See Package Legitimacy Audit below.

### Core (already installed, reused)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.112.0 [VERIFIED: package.json] | Postgres client used for all `availability_slots` reads/writes in this phase | Already the project's sole DB access layer; no alternative considered |
| `@supabase/ssr` | ^0.12.4 [VERIFIED: package.json] | Session-bound server client (`lib/supabase/server.ts`) used in every Route Handler | Established pattern from Phase 1–3 |

### Supporting (existing components reused)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `components/ui/dialog.tsx` | in-repo, shadcn | Modal for "Add slot" / "Block period" forms | If the planner chooses a dialog-per-action layout (Claude's discretion per D-18); already used for doctor/reference-data edit forms in Phase 2 |
| `components/ui/badge.tsx` | in-repo, shadcn | Available/Blocked status badge on schedule list (D-14) | `variant="default"` for Available, `variant="secondary"` or `"outline"` for Blocked — matches Phase 2/3 precedent of reusing `badgeVariants` rather than inventing new colors |
| `components/ui/select.tsx`, `input.tsx`, `label.tsx`, `textarea.tsx`, `button.tsx`, `card.tsx` | in-repo, shadcn | Add-slot / block-period form fields (date, start/end time, optional reason) | Standard form primitives already used across Phase 2 admin forms |

**No shadcn Tabs component exists in this repo** (`components/ui/` inventory: alert, badge, button, card, dialog, input, label, select, skeleton, switch, table, textarea — no `tabs.tsx`). If the planner wants a tab-switch layout for "Add slot" vs. "Block period" (one option under D-18's discretion), a Tabs primitive would need to be added; the simpler, zero-new-component options are two always-visible inline forms or two `Dialog` triggers, both of which are directly supported today.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Branching on `error.code` (SQLSTATE) | Parsing `error.message` text for "exclusion constraint" | Message text is not a stable API guarantee across Postgres versions/locales; `code` is the documented stable identifier (`PostgrestError.ts` docstring explicitly instructs "Branch on this rather than on `message` text") |
| Client Component fetch-based page (like `app/doctors/[id]/page.tsx`) | Server Component with server-side data fetch | Client Component is consistent with the existing public profile page pattern this phase explicitly reuses (D-13); also needed for interactive add/delete/block actions without full-page reloads |

**Installation:** None — no new packages.

**Version verification:** `@supabase/supabase-js` confirmed installed at `^2.112.0` and `@supabase/ssr` at `^0.12.4` via direct read of `package.json` [VERIFIED: package.json]. `npx supabase --version` (CLI, dev-only) resolves to `2.113.0` in this environment [VERIFIED: `npx supabase --version` output this session].

## Package Legitimacy Audit

**Not applicable — this phase installs zero new external packages.** All work uses already-audited, already-installed dependencies (`@supabase/supabase-js`, `@supabase/ssr`, `next`, existing shadcn `components/ui/*` files already committed to the repo). No `npm install` step belongs in this phase's plan.

**Packages removed due to [SLOP] verdict:** none (nothing was ever proposed).
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────┐
│ /doctor/schedule (page)  │  Client Component (fetch-based, mirrors
│  - day-grouped list       │  app/doctors/[id]/page.tsx pattern)
│  - Add-slot form          │
│  - Block-period form      │
│  - Delete button per row   │
└─────────┬─────────────────┘
          │ fetch() JSON
          ▼
┌─────────────────────────────────────────────────────────────┐
│  Route Handlers (app/api/doctor/...)                          │
│                                                                 │
│  GET  /api/doctor/slots            (list own future slots)     │
│  POST /api/doctor/slots            (add available slot)        │
│  DELETE /api/doctor/slots/[id]     (delete unbooked slot/block)│
│  POST /api/doctor/blocked-periods  (block a period)            │
│                                                                 │
│  1. requireDoctor() → 401/403 or {supabase, userId, doctorId}  │
│     (resolves doctor_id from doctors.profile_id = auth.uid())  │
│  2. Manual validation (lib/validation/availability.ts):        │
│     - isInPast() → D-08                                        │
│     - start_at < end_at → D-09 (fast-fail before DB round trip)│
│  3. supabase.from("availability_slots").insert/delete(...)     │
│  4. On error: branch on error.code                             │
│     23P01 → 409 generic overlap message (D-11)                 │
│     23514 → 400 range message (defensive fallback)             │
│     other → 500 generic message                                │
└─────────┬───────────────────────────────────────────────────┘
          │ session-bound client (RLS applies)
          ▼
┌─────────────────────────────────────────────────────────────┐
│ Postgres: availability_slots                                  │
│  - availability_slots_valid_range CHECK (end_at > start_at)    │
│  - availability_slots_no_overlap EXCLUDE USING gist (          │
│      doctor_id WITH =, tstzrange(start_at,end_at) WITH &&)     │
│  - RLS: availability_slots_write_owner_or_admin                │
│    (is_doctor_owner(doctor_id) OR is_admin())                  │
│  [This phase adds: reason text column, nullable]               │
└─────────────────────────────────────────────────────────────┘
```

A reader can trace "doctor submits Add-slot form" → client fetch → `requireDoctor` ownership resolution → app-level past/range pre-checks → insert attempt → DB exclusion constraint is the last line of defense → error code branch → user-facing message, entirely by following the arrows above.

### Recommended Project Structure
```
app/
├── doctor/
│   └── (gated)/
│       └── schedule/
│           └── page.tsx           # new: day-grouped list + add/block/delete UI
├── api/
│   └── doctor/
│       └── slots/
│           ├── route.ts           # new: GET (list), POST (add available slot)
│           └── [id]/
│               └── route.ts       # new: DELETE (unbooked slot or blocked period)
│       └── blocked-periods/
│           └── route.ts           # new: POST (block a period)
lib/
├── auth/
│   └── require-doctor.ts          # new: mirrors lib/auth/require-admin.ts, adds doctorId resolution
├── validation/
│   └── availability.ts            # new: isInPast, start<end pre-check, reason length/type check
supabase/
└── migrations/
    └── <timestamp>_add_availability_slots_reason.sql   # new: reason text nullable column (D-04)
```

### Pattern 1: `requireDoctor()` guard mirroring `requireAdmin()`
**What:** A new `lib/auth/require-doctor.ts` that follows the exact shape of the existing `lib/auth/require-admin.ts` [VERIFIED: `lib/auth/require-admin.ts:1-40`, read this session — quoted below], but additionally resolves and returns the acting doctor's `doctor_id` so route handlers never trust a client-supplied id (D-06).
**When to use:** Every one of this phase's three new Route Handlers (`slots` GET/POST, `slots/[id]` DELETE, `blocked-periods` POST).
**Existing code this pattern extends (verbatim, current file):**
```typescript
// Source: lib/auth/require-admin.ts (read in full this session)
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
`requireDoctor()` should follow this shape but query `doctors` for `id` where `profile_id = auth.uid()` (mirroring the `is_doctor_owner()` SQL helper's own condition — [VERIFIED: `supabase/migrations/20260803230000_initial_schema.sql:166-177`], quoted: `select exists (select 1 from public.doctors where id = target_doctor_id and profile_id = auth.uid());`) instead of checking `profiles.role`, and return `{ ok: true, supabase, userId, doctorId }` on success, `404`/`403` if no doctor row is linked to this profile.

### Pattern 2: Postgres error-code branching (this phase's core technical answer)
**What:** Branch on the flat `error.code` string returned from `supabase.from("availability_slots").insert(...)` (or `.delete()`), exactly as the codebase already does for `23505`/`23503`/`PGRST103`.
**When to use:** Every write to `availability_slots` in this phase (POST slots, POST blocked-periods; DELETE only needs ownership/status checks, not constraint-violation handling, since a valid delete cannot itself violate the exclusion or check constraints).
**Verified error shape (from the installed dependency itself, not training memory):**
```typescript
// Source: node_modules/@supabase/postgrest-js/src/PostgrestError.ts (read in full this session)
export default class PostgrestError extends Error {
  details: string
  hint: string
  code: string
  constructor(context: { message: string; details: string; hint: string; code: string }) {
    super(context.message)
    this.name = 'PostgrestError'
    this.details = context.details
    this.hint = context.hint
    this.code = context.code
  }
}
```
All four fields (`message`, `details`, `hint`, `code`) are **top-level** on the `error` object destructured from `const { data, error } = await supabase.from(...).insert(...)` — there is no nested `cause` or `originalError` to unwrap. `code` is the raw Postgres SQLSTATE when the failure originates in Postgres itself (as opposed to a PostgREST-level rejection like `PGRST103`).

**Existing in-repo precedent for this exact branching style** [VERIFIED: `app/api/admin/locations/[id]/route.ts:58-66,127-144`, read in full this session — quoted]:
```typescript
// PATCH handler — unique violation
if (updateError || !updated) {
  if (updateError?.code === "23505") {
    return NextResponse.json({ error: DUPLICATE_MESSAGE }, { status: 409 });
  }
  return NextResponse.json(
    { error: "Could not save location. Please try again." },
    { status: 500 },
  );
}
// ...
// DELETE handler — foreign key violation
if (deleteError) {
  if (deleteError.code === "23503") {
    // ... translate to a 409 with a domain-specific message
  }
  return NextResponse.json(
    { error: "Could not delete location. Please try again." },
    { status: 500 },
  );
}
```
This phase's new code is the same pattern with `error.code === "23P01"` in place of `"23505"`/`"23503"`, per D-10/D-11:
```typescript
const { data, error } = await supabase
  .from("availability_slots")
  .insert({ doctor_id: doctorId, start_at, end_at, status: "available" })
  .select("id, start_at, end_at, status")
  .single();

if (error || !data) {
  if (error?.code === "23P01") {
    return NextResponse.json(
      { error: "This time overlaps your existing schedule." }, // D-11, generic wording
      { status: 409 },
    );
  }
  if (error?.code === "23514") {
    // Defensive fallback only — the D-09 app-level pre-check (start_at < end_at)
    // should already have rejected this before reaching the DB.
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
```

**Postgres-side confirmation of the SQLSTATE values** [CITED: postgresql.org/docs/current/errcodes-appendix.html — fetched this session]: `23P01` = `exclusion_violation`, `23514` = `check_violation`, `23505` = `unique_violation`, `23503` = `foreign_key_violation`; all four are Class 23 ("Integrity Constraint Violation").

**Message/DETAIL format if ever logged for debugging** [CITED: WebSearch cross-checked against multiple sources this session]: Postgres raises exclusion violations as `ERROR: conflicting key value violates exclusion constraint "<constraint_name>"` with a `DETAIL` of the form `Key (doctor_id, tstzrange(start_at, end_at))=(<id>, ["<start>","<end>")) conflicts with existing key (...)=(...)`. The constraint name will be `availability_slots_no_overlap` per the migration. This DETAIL text should never be shown to the user (D-11 mandates one generic message) but is useful in server-side logs.

### Anti-Patterns to Avoid
- **Parsing `error.message` for the word "exclusion" or "overlap":** fragile across Postgres locales/versions; `error.code` is the documented stable field (see `PostgrestError.ts` docstring's own explicit instruction to "Branch on this rather than on `message` text").
- **Trusting a client-supplied `doctorId` in the POST body:** D-06 explicitly forbids this — always resolve from `auth.uid()` server-side via `requireDoctor()`.
- **Skipping the app-level `start_at < end_at` pre-check and relying solely on the `23514` DB error:** D-09 explicitly wants the app-level check as the primary path for a clean message; the DB check constraint is the defensive backstop, not the primary UX path.
- **Building a second "unblock" endpoint:** D-01/D-02 are explicit that deleting a `blocked` row IS the unblock action — do not add a `PATCH .../unblock` route or a `status` toggle endpoint.
- **Recreating slots that existed before a block was created, on delete of that block:** D-02 explicitly forbids this; deleting a blocked period only removes the restriction, nothing is regenerated.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Overlap detection between slots/blocks | A manual `WHERE` query checking for time-range intersections before insert, as the sole guard | The existing `availability_slots_no_overlap` GiST exclusion constraint (already deployed, D-10) | A manual pre-check alone is race-prone under concurrent requests (TOCTOU); the DB constraint is atomic and already exists — this phase only needs to *catch and translate* its failure, never re-implement the check |
| Timezone conversion for form input | New date-math using the browser's local `Date` object or a new library | `lib/timezone.ts`'s `jerusalemWallClockToUtc()` (D-12) | Already handles DST-boundary offset resolution correctly; a hand-rolled conversion risks silently wrong UTC instants across the March/October DST transitions in Israel |
| Doctor-ownership authorization | A bespoke `doctor_id === session doctor` check duplicated per-route | A single `requireDoctor()` helper (new, mirrors `requireAdmin()`) | Keeps the ownership-resolution logic (and its 401/403 responses) in one place, consistent with the existing `requireAdmin()` precedent, rather than re-deriving `doctors.profile_id = auth.uid()` in three separate route bodies |

**Key insight:** Every hand-roll risk in this phase has already been solved by infrastructure shipped in Phase 1 (the exclusion constraint, `is_doctor_owner()`, `lib/timezone.ts`) or by an existing Phase 2 code pattern (`requireAdmin()`, the `23503`/`23505` translation style). This phase is close to pure plumbing: wire the same patterns to a new table's write paths.

## Runtime State Inventory

Not applicable — this is a greenfield feature phase (new routes/page/migration), not a rename/refactor/migration of existing identifiers or data. Skipped per the trigger condition in the research protocol.

## Common Pitfalls

### Pitfall 1: Branching on the wrong error field or wrong code
**What goes wrong:** Catching `error` generically and returning 500 for everything, so a legitimate overlap attempt looks like a server crash to the doctor instead of a clear "overlap" message (violates D-11 and degrades AVAIL-03/AVAIL-07's user-facing behavior even though the DB correctly rejected the write).
**Why it happens:** Copy-pasting a generic `if (error) return 500` without the specific `error.code` branch, especially since this is the first time this codebase handles `23P01`.
**How to avoid:** Follow the exact `error?.code === "23P01"` / `error?.code === "23514"` / fallback-500 pattern documented in Pattern 2 above, in every route that writes to `availability_slots`.
**Warning signs:** A Playwright test that submits an overlapping slot and expects a 409 with the D-11 message instead gets a 500 — this is the acceptance signal that the branch is missing.

### Pitfall 2: App-level overlap pre-check as the *only* guard (race condition)
**What goes wrong:** Implementing a "check no existing slot overlaps, then insert" two-step in application code without also relying on/handling the DB exclusion constraint — two concurrent requests (e.g. two browser tabs, or a retried request) can both pass the app-level check before either insert commits, producing two overlapping rows.
**Why it happens:** It feels natural to validate before writing, and the DB constraint's failure mode (an exception, not a boolean) is less familiar than an app-level `SELECT ... WHERE overlaps`.
**How to avoid:** Always attempt the `insert()` regardless of any app-level pre-check outcome, and treat the DB's `23P01` as the authoritative rejection — the app-level check (if implemented at all) is purely a UX nicety for the common case, never the correctness guarantee. See Validation Architecture below for a concurrency test that proves this.
**Warning signs:** A test that fires two overlapping inserts concurrently (via `Promise.all` or two parallel Playwright API requests) and asserts exactly one succeeds — if this fails when the app-level pre-check is temporarily disabled/mocked-to-pass, the DB constraint isn't doing the real work.

### Pitfall 3: `reason` column blocking existing rows on migration
**What goes wrong:** Adding `reason text not null` (forgetting D-04 says nullable) would fail the migration against any already-seeded `blocked`-status rows, or force a meaningless default value onto `available`/`booked` rows where `reason` is inapplicable.
**Why it happens:** Copy-pasting a `not null default ''` pattern from another column without re-checking D-04's explicit "nullable" requirement.
**How to avoid:** `alter table public.availability_slots add column reason text;` — no `not null`, no default. D-04 confirms this is "purely informational, no validation on content" and "Not applicable to `available`/`booked` rows," i.e. it should be `null` for those.
**Warning signs:** The migration fails to apply, or every existing row silently gets a non-null placeholder reason string.

### Pitfall 4: Deleting a blocked period accidentally cascades or regenerates availability
**What goes wrong:** Interpreting "unblocking" as "restore what was blocked" and writing logic that re-inserts availability rows for the freed range.
**Why it happens:** Intuitive UX expectation ("unblock" sounds like "undo"), but D-02 explicitly overrides that intuition for this project.
**How to avoid:** The DELETE handler for a `blocked` row does exactly one thing: delete that row. No compensating insert.
**Warning signs:** After deleting a block, new `available` rows appear that the doctor never explicitly added.

## Code Examples

### Manual validation module shape (matches existing `lib/validation/doctor.ts` convention)
```typescript
// Source: pattern from lib/validation/doctor.ts (read in full this session, quoted structure)
// New file: lib/validation/availability.ts
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
    return "Cannot add a slot in the past."; // D-08 — exact copy at Claude's discretion
  }
  if (start.getTime() >= end.getTime()) {
    return "Start time must be before end time."; // D-09 pre-check, mirrors DB's availability_slots_valid_range
  }
  return null;
}
```
Follows the existing `lib/validation/doctor.ts` convention exactly: a single `string | null` return, no schema library (project constraint), reusable by both the create-slot and block-period endpoints (the block-period variant additionally accepts an optional `reason: string`).

### Route error-branch skeleton (POST /api/doctor/slots)
```typescript
// New file: app/api/doctor/slots/route.ts — pattern combines requireDoctor() (new)
// with the existing app/api/admin/locations/[id]/route.ts error-branch style.
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
        { error: "This time overlaps your existing schedule." },
        { status: 409 },
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

### Existing test helpers this phase's Playwright specs should reuse
[VERIFIED: `tests/e2e/helpers/availability.ts` and `tests/e2e/helpers/reference-data.ts` and `tests/e2e/helpers/test-users.ts`, all read in full this session]

```typescript
// tests/e2e/helpers/availability.ts already exports:
export type TestSlotStatus = "available" | "booked" | "blocked";
export async function createTestSlots(
  doctorId: string,
  specs: Array<{ startAt: Date; endAt: Date; status?: TestSlotStatus }>,
): Promise<Array<{ id: string; startAt: Date; endAt: Date }>>;
export async function cleanupTestSlots(): Promise<void>;

// tests/e2e/helpers/reference-data.ts already exports:
export async function createTestDoctor(opts: {
  fullName?: string; specialtyId: string; locationId: string;
  bio?: string; photoUrl?: string; isActive?: boolean; profileId?: string;
}): Promise<{ id: string; fullName: string }>;
export async function createTestSpecialty(...): Promise<{ id: string; ... }>;
export async function createTestLocation(...): Promise<{ id: string; ... }>;
export async function cleanupTestReferenceData(): Promise<void>;

// tests/e2e/helpers/test-users.ts already exports:
export async function createTestUser(
  role: "patient" | "doctor" | "admin",
  opts?: { fullName?: string },
): Promise<{ id: string; email: string; password: string }>;
export async function cleanupTestUsers(): Promise<void>;
```
`createTestDoctor` already accepts `profileId`, so a spec can: `createTestUser("doctor")` → `createTestSpecialty()`/`createTestLocation()` → `createTestDoctor({ ..., profileId: doctorUser.id })` → log in as that doctor via the `/login` form (same flow as `tests/e2e/auth-doctor-login.spec.ts`) → drive `/doctor/schedule`. No new fixture infrastructure is needed for this phase's specs; `createTestSlots` already supports seeding pre-existing `available`/`booked`/`blocked` rows to set up overlap and delete-guard scenarios directly, bypassing the UI where a test wants to assert against a known DB state.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| N/A | N/A | — | This phase does not touch legacy code or deprecated APIs; it is new functionality on an already-current stack (Next.js 16.2.12, supabase-js 2.112.x, both already in use in this repo). |

**Deprecated/outdated:** None identified for this phase's scope.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Exact copy/wording of "Add slot" vs. "Block period" as two inline forms vs. dialogs vs. tabs — Claude's discretion per D-18, no Tabs primitive exists in this repo | Architecture Patterns / Standard Stack | Low — purely a UI layout choice explicitly left to planner/executor discretion in CONTEXT.md; no functional risk |
| A2 | The Postgres `DETAIL` message format for `23P01` on this project's specific `availability_slots_no_overlap` constraint (column list, exact bracket notation) — inferred from general Postgres exclusion-constraint DETAIL format seen via WebSearch, not captured from a live error against this project's own schema this session | Architecture Patterns (Pattern 2) | Low — the DETAIL text is never shown to users (D-11 dictates a generic message) and is not branched on in code; only `error.code` is load-bearing, and that field's format (`23P01`) is independently confirmed against official Postgres docs |

**If this table is empty:** N/A — two low-risk items noted above; neither affects the load-bearing `error.code` branching logic, which is HIGH confidence throughout.

## Open Questions

1. **Exact wording for D-11's generic overlap message and D-08's past-date message**
   - What we know: D-11 mandates one generic message regardless of collision type; D-08 mandates rejecting past dates. Both explicitly left as "Claude's Discretion" in CONTEXT.md.
   - What's unclear: Final copy (e.g. "This time overlaps your existing schedule." vs. alternate phrasing).
   - Recommendation: Planner/executor picks final copy; no user confirmation needed per CONTEXT.md's explicit discretion grant. This RESEARCH.md's Code Examples use plausible copy as a starting point, not a locked string.

2. **Whether a "quick recurring slots" convenience is trivial enough to add (D-16)**
   - What we know: Not required; only add if trivial given the single-slot form architecture.
   - What's unclear: What "trivial" means in practice until the single-slot POST endpoint and form exist.
   - Recommendation: Build the single-slot path first; only after it exists should the planner assess whether a thin "repeat N times" client-side loop calling the same POST endpoint N times is low-risk enough to add. Do not build server-side recurrence logic (RRULE-style) — out of scope regardless.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js dev server, Playwright, seed scripts | ✓ | v22.18.0 [VERIFIED: `node --version` this session] | — |
| npm | package management | ✓ | 11.11.0 [VERIFIED: `npm --version` this session] | — |
| Supabase CLI (`npx supabase`) | migrations (`reason` column), local/linked DB ops | ✓ | 2.113.0 [VERIFIED: `npx supabase --version` this session] | — |
| `.env.local` | Supabase URL/keys for dev server and Playwright's admin client | ✓ | present, 608 bytes [VERIFIED: file listing this session] | — |
| Playwright | this phase's e2e specs (`npx playwright test` per config.json `test_command`) | ✓ (already used by 20 prior plans) | per `package.json` | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (`@playwright/test`), per `playwright.config.ts` [VERIFIED: `playwright.config.ts`, read this session] |
| Config file | `playwright.config.ts` (testDir `./tests/e2e`, `fullyParallel: false`, `workers: 1`) |
| Quick run command | `npx playwright test tests/e2e/<new-spec-file>.spec.ts` |
| Full suite command | `npx playwright test` (matches `config.json`'s `workflow.test_command`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AVAIL-01 | Doctor adds an available slot via `/doctor/schedule` form | e2e (browser) | `npx playwright test tests/e2e/doctor-schedule-add-slot.spec.ts` | ❌ Wave 0 |
| AVAIL-02 | Doctor cannot add a slot in the past | e2e (browser + API-level assertion) | same spec file, dedicated test case | ❌ Wave 0 |
| AVAIL-03 | Doctor cannot create overlapping slots | e2e, **including a concurrency case** (see below) | `tests/e2e/doctor-schedule-overlap.spec.ts` | ❌ Wave 0 |
| AVAIL-04 | Doctor deletes an unbooked (available or blocked) slot | e2e | `tests/e2e/doctor-schedule-delete-slot.spec.ts` | ❌ Wave 0 |
| AVAIL-05 | Doctor cannot delete a booked slot | e2e (seed a `booked` row via `createTestSlots`, then attempt delete) | same spec file, dedicated test case | ❌ Wave 0 |
| AVAIL-06 | Doctor blocks a period of unavailability | e2e | `tests/e2e/doctor-schedule-block-period.spec.ts` | ❌ Wave 0 |
| AVAIL-07 | A blocked period cannot overlap an existing available slot | e2e, reuses the same overlap-proving pattern as AVAIL-03 | `tests/e2e/doctor-schedule-overlap.spec.ts` | ❌ Wave 0 |

### The concurrency test that proves DB-level enforcement (not just app-level)
AVAIL-03/AVAIL-07's most important test is **not** "submit an overlapping slot through the UI and see an error" alone (that only proves the app-level pre-check works, which is not the actual guarantee per D-10). The test that proves the *database* is doing the real work fires two concurrent write attempts at the same overlapping range and asserts exactly one succeeds:

```typescript
// Pattern: bypass the UI, hit the API route (or the DB directly via the
// session-bound client) twice in parallel for the same doctor/time range.
const [resultA, resultB] = await Promise.all([
  page.request.post("/api/doctor/slots", { data: { startAt, endAt } }),
  page.request.post("/api/doctor/slots", { data: { startAt, endAt } }),
]);
const statuses = [resultA.status(), resultB.status()].sort();
expect(statuses).toEqual([201, 409]); // exactly one wins, one gets the D-11 overlap message
```
This is the direct executable analogue of the project's own stated philosophy (STATE.md: "Anti-double-booking enforced at the DB level... must be explicitly tested, not just asserted") applied to `availability_slots` instead of `appointments`.

### Sampling Rate
- **Per task commit:** run the specific new spec file(s) touched by that task (`npx playwright test tests/e2e/doctor-schedule-<x>.spec.ts`)
- **Per wave merge:** `npx playwright test` (full suite) — the shared dev DB means new availability specs must clean up after themselves via `cleanupTestSlots()`/`cleanupTestReferenceData()`/`cleanupTestUsers()`, same as every prior phase's specs
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/e2e/doctor-schedule-add-slot.spec.ts` — covers AVAIL-01, AVAIL-02
- [ ] `tests/e2e/doctor-schedule-overlap.spec.ts` — covers AVAIL-03, AVAIL-07, including the concurrency case above
- [ ] `tests/e2e/doctor-schedule-delete-slot.spec.ts` — covers AVAIL-04, AVAIL-05
- [ ] `tests/e2e/doctor-schedule-block-period.spec.ts` — covers AVAIL-06
- [ ] Framework install: none — Playwright and all fixture helpers (`createTestSlots`, `createTestDoctor`, `createTestUser`) already exist in the repo and require no new setup.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | yes | Existing Supabase Auth session (`createClient()` server client); no new auth mechanism this phase |
| V3 Session Management | yes | Existing cookie-bound SSR session (`@supabase/ssr`); unchanged this phase |
| V4 Access Control | yes | New `requireDoctor()` guard (app-level, defense-in-depth) + existing `availability_slots_write_owner_or_admin` RLS policy (`is_doctor_owner(doctor_id) OR is_admin()`) as the actual authority — D-06/D-07 |
| V5 Input Validation | yes | `lib/validation/availability.ts` (new, manual TS functions per project constraint — no Zod) validates date/time shape, past-date rejection (D-08), range order (D-09) before any DB write |
| V6 Cryptography | no | No new secrets, tokens, or crypto operations in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Doctor A modifies Doctor B's schedule by guessing/forging a slot id or supplying another doctor's `doctorId` in the request body | Tampering / Elevation of Privilege | `requireDoctor()` resolves `doctorId` server-side from `auth.uid()` (never trusts body input, D-06); RLS `availability_slots_write_owner_or_admin` independently blocks any write where `is_doctor_owner(doctor_id)` is false, so even a bypassed app-level check cannot succeed against the DB |
| TOCTOU race on overlap check (two concurrent requests both pass an app-level "no overlap" check before either commits) | Tampering (data integrity) | DB-level GiST exclusion constraint (`23P01`) is atomic and is the real guarantee, not the app-level pre-check — see Validation Architecture concurrency test above |
| Deleting another doctor's slot by id (IDOR) | Tampering / Elevation of Privilege | DELETE handler must independently verify `doctor_id` ownership (via `requireDoctor()` + a lookup confirming the slot's `doctor_id` matches, mirroring `app/api/admin/locations/[id]/route.ts`'s existing-row lookup pattern) before deleting, in addition to RLS |
| Deleting a `booked` slot to silently orphan a patient's appointment | Tampering | App-level status check (`if status === 'booked' → 403/409`) per D-01/AVAIL-05, independent of RLS (RLS only proves ownership, not status-conditional deletability — this must be app logic) |
| Overlap-rejection message leaking whether a colliding slot is `available`/`booked`/`blocked` (minor information disclosure about another entity's schedule internals — low severity here since it's the doctor's own schedule, but still worth the discipline) | Information Disclosure | D-11's single generic message by design avoids ever branching copy on what was collided with |

## Sources

### Primary (HIGH confidence)
- `node_modules/@supabase/postgrest-js/src/PostgrestError.ts` — installed dependency source, read in full this session — authoritative shape of the error object (`{message, details, hint, code}`, all top-level)
- `app/api/admin/locations/[id]/route.ts` — existing shipped code in this repo, read in full this session — proves the `error.code === "23505"`/`"23503"` branching pattern already works end-to-end in this project
- `app/api/doctors/route.ts` — existing shipped code, read in full this session — proves the `error.code === "PGRST103"` branching pattern (a different, PostgREST-level code, for contrast)
- `lib/auth/require-admin.ts` — existing shipped code, read in full this session — template for the new `requireDoctor()` helper
- `lib/timezone.ts` — read in full this session — confirms `jerusalemWallClockToUtc`, `jerusalemDayKey`, `formatJerusalemDayHeading`, `formatJerusalemTime` all exist with the exact signatures CONTEXT.md describes
- `app/doctors/[id]/page.tsx` — read in full this session — confirms `groupSlotsByJerusalemDay` (lines 38-50) exact shape
- `supabase/migrations/20260803230000_initial_schema.sql` — read in full this session — confirms `availability_slots` table, constraints, RLS policies, and `is_doctor_owner()`/`is_admin()` functions verbatim
- `tests/e2e/helpers/availability.ts`, `tests/e2e/helpers/reference-data.ts`, `tests/e2e/helpers/test-users.ts` — read in full this session — confirm existing fixture helpers this phase's specs should reuse
- `package.json` — read this session — confirms `@supabase/supabase-js@^2.112.0`, `@supabase/ssr@^0.12.4`, `next@16.2.12`

### Secondary (MEDIUM confidence)
- postgresql.org/docs/current/errcodes-appendix.html (fetched this session via WebFetch) — confirms `23P01`=exclusion_violation, `23514`=check_violation, `23505`=unique_violation, `23503`=foreign_key_violation, all Class 23
- WebSearch results (multiple independent sources: pganalyze.com, drdroid.io, blog.danielclayton.co.uk) — cross-checked exclusion-violation `DETAIL` message format (`Key (...)=(...) conflicts with existing key (...)=(...)`)

### Tertiary (LOW confidence)
- None used as load-bearing claims in this document.

## Metadata

**Confidence breakdown:**
- Error-handling architecture (the phase's primary technical unknown): HIGH — verified directly against the installed dependency's source and two already-shipped in-repo examples of the identical pattern
- Business rules / conflict rules: HIGH — fully specified in 04-CONTEXT.md D-01 through D-18, not re-derived here
- Validation architecture / test strategy: HIGH — built directly on existing, already-working Playwright fixture helpers in this repo, not hypothetical
- UI layout specifics (dialog vs. inline forms vs. tabs): MEDIUM — Claude's discretion per CONTEXT.md, only constrained by the confirmed absence of a Tabs primitive in this repo

**Research date:** 2026-08-08
**Valid until:** 30 days (stable domain — Postgres SQLSTATE codes and this repo's own architecture do not change on a fast cadence)
