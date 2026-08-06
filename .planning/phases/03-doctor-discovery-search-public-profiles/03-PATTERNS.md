# Phase 3: Doctor Discovery — Search & Public Profiles - Pattern Map

**Mapped:** 2026-08-06
**Files analyzed:** 11
**Analogs found:** 11 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `supabase/migrations/<ts>_add_doctor_search_view.sql` | migration | transform | `supabase/migrations/20260803230000_initial_schema.sql` (RLS policies + indexes) | role-match (no prior view migration exists; DDL conventions carry over) |
| `app/api/doctors/route.ts` | route (public, list) | CRUD (read, paginated) | `app/api/admin/doctors/route.ts` (`GET`) | role-match (same join-select shape, no auth guard, adds pagination/sort) |
| `app/api/doctors/[id]/route.ts` | route (public, detail) | CRUD (read) | `app/api/admin/doctors/[id]/route.ts` (`PATCH`, but its `DOCTOR_LIST_SELECT`/reload-after-write pattern) + `app/api/admin/appointments/route.ts` (filter-building) | role-match |
| `lib/validation/search.ts` | utility (validation) | transform | `lib/validation/doctor.ts` | exact (manual TS validation-function shape) |
| `app/search/page.tsx` | route/page (client) | request-response | `app/login/page.tsx` (`useSearchParams` + `Suspense` shape) and `components/admin/doctors-page-client.tsx` (fetch/loading/error/empty pattern) | role-match |
| `app/doctors/[id]/page.tsx` | page (client) | request-response | `components/admin/doctors-page-client.tsx` (fetch + status states) | role-match |
| `components/search/search-filters.tsx` | component (form) | request-response | `app/admin/appointments/page.tsx` (filter fields incl. date inputs + `jerusalemBoundaryToUtcIso` helper) | exact for date-boundary logic; role-match for filter form shape |
| `components/search/search-results.tsx` | component (list + pagination) | request-response | `components/admin/doctors-page-client.tsx` (loading/error/empty table states) — no pagination precedent exists, must be authored net-new | partial (no pagination analog in codebase) |
| `components/search/doctor-card.tsx` | component | request-response | `components/admin/doctors-page-client.tsx` (table row rendering: `InitialsAvatar`/photo fallback, truncate, `Badge`) | role-match |
| `scripts/seed.ts` (extend) | utility (seed script) | batch | `scripts/seed.ts` `seedDoctors()`/`seedDoctorLanguages()` (existing idempotent insert pattern) | exact (same file, same idempotency convention to mirror) |
| `tests/e2e/search-filters.spec.ts`, `search-sort-pagination.spec.ts`, `doctor-profile.spec.ts` | test | request-response | `tests/e2e/admin-route-protection.spec.ts` (style) + `tests/e2e/helpers/supabase-anon.ts` | role-match |

## Pattern Assignments

### `app/api/doctors/route.ts` (route, CRUD/paginated read)

**Analog:** `app/api/admin/doctors/route.ts`

**Imports pattern** (lines 1-4 of analog):
```typescript
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server"; // NOT requireAdmin — public route
import { validateSearchParams } from "@/lib/validation/search"; // new validation module
```
No `requireAdmin()` call — this route is intentionally unauthenticated (per RESEARCH.md Security Domain V4/V5). Use the plain `createClient()` from `lib/supabase/server.ts` (anon/session-bound client), which RLS already restricts to `is_active=true`/`status='available'`.

**Select/shape pattern** (`app/api/admin/doctors/route.ts` lines 6-40) — copy the `DOCTOR_LIST_SELECT` + `RawDoctorRow` + `toListRow()` shape, but querying `doctor_search_view` instead of `doctors`, and dropping `profile_id`:
```typescript
const DOCTOR_SEARCH_SELECT =
  "id, full_name, bio, photo_url, is_demo, specialty_id, specialty_name_en, " +
  "specialty_name_he, location_id, city, neighborhood, language_codes, next_available_at";
```

**Filter-building pattern** (`app/api/admin/appointments/route.ts` lines 41-58 — AND-combined conditional `.eq()`/`.ilike()` chaining):
```typescript
let query = guard.supabase.from("appointments").select(APPOINTMENT_SELECT);
if (status) query = query.eq("status", status);
if (doctorId) query = query.eq("doctor_id", doctorId);
if (from) query = query.gte("availability_slots.start_at", from);
if (to) query = query.lte("availability_slots.start_at", to);
```
Apply the same conditional-chain idiom against `doctor_search_view` for `q` (`.ilike`), `specialtyId` (`.eq`), `neighborhood` (`.eq`), `language` (`.contains`), and the availability pre-query result (`.in('id', matchingDoctorIds)`) — see RESEARCH.md Pattern 1/2 for the exact view-query code (already vetted, copy directly from RESEARCH.md's Code Examples section rather than re-deriving).

**Pagination pattern:** No existing analog in the codebase (RESEARCH.md confirms — this phase is the first). Follow RESEARCH.md Pattern 1 exactly: `offset = (page - 1) * PAGE_SIZE`, `.range(offset, offset + PAGE_SIZE - 1)`, secondary `.order('id', {ascending:true})` tie-breaker, `{count: 'exact'}` on `.select()`.

**Error handling pattern** (`app/api/admin/doctors/route.ts` lines 52-57):
```typescript
if (error) {
  return NextResponse.json(
    { error: "Could not load doctors. Please refresh the page." },
    { status: 500 },
  );
}
```
Reuse verbatim shape; adjust copy per UI-SPEC's "Could not load doctors. Please try again." (search page copy differs slightly from admin's "refresh the page" — use the UI-SPEC string for this route).

---

### `app/api/doctors/[id]/route.ts` (route, CRUD read, single + child list)

**Analog:** `app/api/admin/doctors/[id]/route.ts` (structure) + RESEARCH.md's own worked example (Code Examples section, verified against this exact analog)

**Core pattern** (mirrors `app/api/admin/doctors/[id]/route.ts` lines 42-71's lookup-then-404 shape, adapted to `GET`):
```typescript
const PUBLIC_DOCTOR_SELECT =
  "id, full_name, bio, photo_url, is_demo, " +
  "specialty:specialties(id,name_en,name_he), " +
  "location:locations(id,city,neighborhood,address), " +
  "languages:doctor_languages(languages(id,code))";

const { data: doctor, error } = await supabase
  .from("doctors")
  .select(PUBLIC_DOCTOR_SELECT)
  .eq("id", id)
  .eq("is_active", true) // defense-in-depth; RLS also enforces this for anon
  .maybeSingle();

if (!doctor) return NextResponse.json({ error: "Doctor not found." }, { status: 404 });

const { data: slots } = await supabase
  .from("availability_slots")
  .select("id, start_at, end_at")
  .eq("doctor_id", id)
  .eq("status", "available") // defense-in-depth; RLS also enforces this for anon
  .gt("start_at", new Date().toISOString())
  .order("start_at", { ascending: true });
```
**404 pattern to copy:** `app/api/admin/doctors/[id]/route.ts` line 69-71 (`if (!existing) return NextResponse.json({ error: "Doctor not found." }, { status: 404 })`) — same shape, same 404 message text already used elsewhere (UI-SPEC also locks "Doctor not found." as the profile page's error heading, so route and UI copy should stay in sync verbatim).

---

### `lib/validation/search.ts` (utility, manual validation)

**Analog:** `lib/validation/doctor.ts` (whole file — exact structural match)

**Pattern to copy** (function shape, lines 1-44 and 116-122 of analog):
```typescript
// Manual TypeScript validation (no schema library) — one function per
// concern, returns `string | null` (null = valid), messages match UI copy verbatim.
export function validateSearchParams(params: URLSearchParams): string | null {
  // validate page is a positive integer, clamp/reject; validate specialtyId/
  // neighborhood/language against known reference-data id/enum shape (no DB
  // round-trip needed — just type/format checks, same rigor as
  // validateStatusInput's strict-boolean check, lines 117-122)
  return null;
}
```
Follow the same "one exported function per concern, plain `if` chain returning early with a message string" idiom — no Zod, no class-based validators.

---

### `app/search/page.tsx` (page, client, URL-persisted filter state)

**Analog:** `app/login/page.tsx` (Suspense/useSearchParams shape) + `components/admin/doctors-page-client.tsx` (fetch/loading/error/empty precedent)

**Suspense boundary pattern** (`app/login/page.tsx` lines 1-5, 134-140):
```typescript
"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Suspense, useState } from "react";

function SearchPageInner() { /* ... */ }

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageInner />
    </Suspense>
  );
}
```

**URL-write pattern** (from RESEARCH.md Pattern 4, itself derived from this same analog):
```typescript
function updateQuery(next: Record<string, string | null>) {
  const params = new URLSearchParams(searchParams.toString());
  for (const [key, value] of Object.entries(next)) {
    if (value) params.set(key, value); else params.delete(key);
  }
  if (!("page" in next)) params.set("page", "1"); // D-14
  router.replace(`${pathname}?${params.toString()}`, { scroll: false });
}
```

**Fetch/loading/error/empty-state pattern** (`components/admin/doctors-page-client.tsx` lines 264-292, 703-741 — `listStatus: "loading" | "error" | "ready"` + `handleRetry`):
```typescript
const [listStatus, setListStatus] = useState<"loading" | "error" | "ready">("loading");

const loadDoctors = useCallback(async () => {
  try {
    const response = await fetch(`/api/doctors?${qs}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not load doctors. Please try again.");
    setDoctors(data.doctors);
    setTotal(data.total);
    setListStatus("ready");
  } catch {
    setListStatus("error");
  }
}, [qs]);
```
Copy the three-branch `listStatus` render switch (`loading` → `Skeleton` placeholders, `error` → message + Retry `Button`, `ready` + empty → SEARCH-09 empty-state copy) directly from the analog's `TableBody` conditional structure (lines 703-741), adapted from a `Table` to a card grid per UI-SPEC.

---

### `app/doctors/[id]/page.tsx` (page, client, detail fetch)

**Analog:** `components/admin/doctors-page-client.tsx` (fetch/status-state shape, single-entity variant)

**Core pattern:** Same `"use client"` + `useEffect` + `fetch()` + tri-state (`loading`/`error`/`ready`) shape as above, but single-entity (`useParams()` for `id`, no `Suspense`/query-string needed — no filters on this page per RESEARCH.md). 404/inactive-doctor state renders the UI-SPEC's "Doctor not found" + "Back to search" link — same `error`-branch idiom as the admin page's Retry button, substituting a `Link` for a retry action since a 404 isn't retryable.

---

### `components/search/search-filters.tsv` — `components/search/search-filters.tsx` (component, filter form)

**Analog:** `app/admin/appointments/page.tsx` (date-range filter fields + timezone-safe boundary conversion, lines 88-100 and the helper functions above them)

**Date-boundary helper — copy directly** (`app/admin/appointments/page.tsx` lines 47-86, exact functions to reuse or extract to `lib/`):
```typescript
function getTimeZoneOffsetMs(timeZone: string, date: Date): number { /* ... */ }
function jerusalemBoundaryToUtcIso(dateStr: string, boundary: "start" | "end"): string { /* ... */ }
```
Per RESEARCH.md's "Don't Hand-Roll" table, extract these into a shared `lib/` helper rather than re-deriving — this phase is the second consumer (after `app/admin/appointments/page.tsx`), which is exactly when de-duplication into `lib/` pays off.

**Native date input pattern** (`app/admin/appointments/page.tsx` lines 88-100 — `<Input type="date">` state wiring): reuse verbatim shape for `availableFrom`/`availableTo` fields, adding the three quick-select shortcut buttons (Today/Next 7 days/Next 30 days) as `Button variant="outline"` toggles per UI-SPEC's accent-color spec (selected chip = accent/primary).

**Select field pattern** (`components/admin/doctors-page-client.tsx` lines 123-165 — `Select`/`SelectTrigger`/`SelectContent`/`SelectItem`): reuse verbatim for specialty/neighborhood/language filter dropdowns.

---

### `components/search/doctor-card.tsx` (component, result card)

**Analog:** `components/admin/doctors-page-client.tsx` (row rendering, lines 746-760 — photo/InitialsAvatar fallback + truncate)

**Avatar-fallback pattern** (lines 748-758 of analog):
```tsx
{doctor.photo_url ? (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={doctor.photo_url} alt="" className="size-8 shrink-0 rounded-full object-cover" />
) : (
  <InitialsAvatar name={doctor.full_name} />
)}
<span className="truncate">{doctor.full_name}</span>
```
Scale up avatar `size-*` class for a card layout (vs. table row); `InitialsAvatar` already supports a `size="default"` prop (see `components/initials-avatar.tsx` lines 3-7).

**Badge pattern for "Demo profile" / "No upcoming availability"** (`components/ui/badge.tsx` lines 30-52 — `variant` prop: `default`/`secondary`/`destructive`/`outline`/`ghost`/`link`): use `variant="secondary"` for both (per UI-SPEC's explicit direction), e.g. `<Badge variant="secondary">Demo profile</Badge>` and `<Badge variant="secondary">No upcoming availability</Badge>`.

---

### `scripts/seed.ts` extension (utility, idempotent batch insert)

**Analog:** `seedDoctors()` / `seedDoctorLanguages()` in the same file (lines 252-352, verified this session)

**Idempotency pattern to mirror** (lines 256-269 — "check existing, filter toInsert, insert only the delta"):
```typescript
const { data: existing, error: existingError } = await supabase
  .from("availability_slots")
  .select("doctor_id")
  .in("doctor_id", doctorIds)
  .gt("start_at", new Date().toISOString());
if (existingError) throw new Error(`Failed to read existing slots: ${existingError.message}`);

const doctorIdsWithFutureSlots = new Set((existing ?? []).map((r) => r.doctor_id));
const doctorsNeedingSlots = insertedDoctors.filter((d) => !doctorIdsWithFutureSlots.has(d.id));
```
This exactly matches D-03/Pitfall 5's required check ("future rows only," not "any row ever"). Reuse the file's existing `main()` orchestration order (`seedSpecialties` → `seedLocations` → `seedDoctors` → `seedDoctorLanguages` → new `seedAvailabilitySlots` → `seedDemoPatients` → `printSummary`, lines 425+) — insert the new step after `seedDoctorLanguages()` and before `seedDemoPatients()`.

**Non-overlap generation:** No existing analog (first slot-generation code in the project) — generate slots as fixed-length non-overlapping intervals within a business-hour window per day (Claude's Discretion in CONTEXT.md), and rely on the DB's `availability_slots_no_overlap` GiST exclusion constraint as the backstop, not the sole correctness mechanism (a naive loop that increments by slot-duration within a fixed window cannot produce overlaps by construction).

---

## Shared Patterns

### Public (unauthenticated) Supabase client
**Source:** `lib/supabase/server.ts` (whole file, lines 1-29)
**Apply to:** `app/api/doctors/route.ts`, `app/api/doctors/[id]/route.ts`
```typescript
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();
```
No `requireAdmin()`/`requireDoctor()` guard — these two routes are the first genuinely public REST routes in the codebase. RLS (`doctors_select_active_or_owner_or_admin`, `availability_slots_select_available_or_owner_or_admin`) is the actual access-control authority; routes add defense-in-depth `is_active=true`/`status='available'` filters per the existing convention seen in `app/api/admin/doctors/[id]/route.ts`'s comments.

### Error response shape
**Source:** `app/api/admin/doctors/route.ts` (lines 52-57, 98-103, etc. — consistent `{ error: string }` + status code across every route in the codebase)
**Apply to:** All new route handlers
```typescript
return NextResponse.json({ error: "..." }, { status: 500 | 404 | 400 });
```

### Manual TypeScript validation (no schema library)
**Source:** `lib/validation/doctor.ts` (whole file)
**Apply to:** `lib/validation/search.ts`
One exported function per concern, `string | null` return, early-return `if` chains, messages matching UI copy verbatim (per file's own header comment convention).

### Client Component + fetch() list/detail pages
**Source:** `components/admin/doctors-page-client.tsx` (list, tri-state loading/error/ready) and `app/login/page.tsx` (Suspense boundary for `useSearchParams`)
**Apply to:** `app/search/page.tsx`, `app/doctors/[id]/page.tsx`
No Server-Component-driven data fetching anywhere in this codebase for user-facing pages — stay consistent (RESEARCH.md Anti-Patterns explicitly warns against introducing a Server Component variant for `/doctors/[id]` while `/search` stays client).

### Badge component for status/demo indicators
**Source:** `components/ui/badge.tsx` (whole file)
**Apply to:** `doctor-card.tsx` ("Demo profile", "No upcoming availability"), profile page ("Demo profile")
`variant="secondary"` per UI-SPEC Color section; component itself needs no modification (already installed, Base UI-backed).

### Timezone-safe date boundary conversion
**Source:** `app/admin/appointments/page.tsx` lines 47-86 (`getTimeZoneOffsetMs`, `jerusalemBoundaryToUtcIso`)
**Apply to:** `components/search/search-filters.tsx` (availability date-range filter), `scripts/seed.ts` extension (slot generation authored in `Asia/Jerusalem`)
Extract to a shared `lib/` module (e.g. `lib/timezone.ts`) since this phase becomes the second consumer — do not copy-paste a second inline copy into the filter component.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `components/search/search-results.tsx` (pagination controls specifically) | component | request-response | No numbered-pagination UI exists anywhere in the codebase (RESEARCH.md D-15 note: "admin lists load everything unpaginated"). Build from `components/ui/button.tsx` primitives following the UI-SPEC's Prev/Next + numbered-page-button + ellipsis-beyond-7-pages spec; no in-repo precedent to copy beyond the general `Button`/`Skeleton` primitives already covered above. |
| `supabase/migrations/<ts>_add_doctor_search_view.sql` (the `LEFT JOIN LATERAL` + `security_invoker` view body itself) | migration | transform | No existing view in the schema (only tables + RLS policies in `20260803230000_initial_schema.sql`). Use RESEARCH.md's fully worked-out SQL (Pattern 1 Example) as the direct template — it was authored this session by researching official Supabase/Postgres docs, not by copying an in-repo file. |

## Metadata

**Analog search scope:** `app/api/admin/**`, `app/login/page.tsx`, `components/admin/**`, `components/ui/**`, `components/initials-avatar.tsx`, `lib/validation/**`, `lib/auth/**`, `lib/supabase/**`, `scripts/seed.ts`, `supabase/migrations/**`, `app/admin/appointments/page.tsx`
**Files scanned:** ~15 read directly this session (plus RESEARCH.md's own already-verified line citations reused for additional analogs not re-read here)
**Pattern extraction date:** 2026-08-06
