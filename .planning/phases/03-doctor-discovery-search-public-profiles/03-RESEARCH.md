# Phase 3: Doctor Discovery — Search & Public Profiles - Research

**Researched:** 2026-08-06
**Domain:** Supabase/PostgREST query design (sort-by-computed-value + server-side pagination), Postgres views under RLS, Next.js App Router URL-persisted filter state
**Confidence:** HIGH (schema/RLS/codebase facts verified by reading source this session) / MEDIUM (Supabase-JS/PostgREST/Next.js API surface, cross-checked web sources)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Phase 3 extends the existing `scripts/seed.ts` (Phase 2) to create demo `availability_slots` — none exist yet. Rules: only future slots; times authored in `Asia/Jerusalem` and stored as UTC `timestamptz`; spread across the next 21 days from run time; roughly 6-10 slots per doctor that receives availability; realistic consultation-hour times; no overlapping slots per doctor (DB exclusion constraint enforces this — seed must generate non-overlapping ranges); zero `appointments` rows created in this phase.
- **D-02:** Intentionally leave 1-2 active demo doctors with zero future slots, so the "no availability" UI state (D-06) is exercisable in manual testing and Playwright.
- **D-03:** The slot-seeding step must be idempotent — re-running `scripts/seed.ts` must not create duplicate slots for a doctor that already has them.
- **D-04:** An active doctor with no future available slot still appears in search results — never excluded. Only `is_active = false` doctors are excluded, which the existing RLS policy already enforces for a public/anon client.
- **D-05:** Default sort order: doctors with a future available slot first, ascending by soonest slot (SEARCH-08); doctors with none sort after all of those, at the end.
- **D-06:** A doctor with no upcoming slots shows a clear "No upcoming availability" indicator on their search-result card, and their profile page must not present a slot-selection action.
- **D-07:** Availability filter UI is a simple date-range picker (start date + end date) plus quick-select shortcuts: Today / Next 7 days / Next 30 days. Optional — no default range applied on load.
- **D-08:** A doctor matches the availability filter when they have at least one `availability_slots` row that is: within the selected date range, in the future, `status = 'available'`, and not deleted/disabled. When no range is selected, all active doctors are eligible regardless of availability (consistent with D-04).
- **D-09:** All filters (name, specialty, language, neighborhood, availability range) combine with AND logic (SEARCH-06).
- **D-10:** "Next available slot" (card display + sort per SEARCH-07/08) = the doctor's earliest future `availability_slots` row with `status = 'available'`.
- **D-11:** Classic numbered pagination (Prev/Next + page numbers) — no infinite scroll. 6 doctors per page.
- **D-12:** Total result count is displayed alongside pagination controls.
- **D-13:** Active filters and the current page are persisted in the URL query string (e.g. `/search?specialty=...&language=...&neighborhood=...&availableFrom=...&availableTo=...&page=1`).
- **D-14:** Changing any filter resets pagination to page 1.
- **D-15:** Pagination is applied at the Supabase query level (`.range()` / limit+offset) — never load the full doctor list and slice it client-side. No pagination pattern exists anywhere in the codebase yet — this phase sets the precedent.
- **D-16:** The search/list page stays at `/search` (not `/doctors`). The individual profile page stays at `/doctors/[id]`.
- **D-17:** This phase covers only public search, filtering, sorting, pagination, public profile viewing, and read-only display of upcoming available slots. It does NOT implement booking, appointment creation, doctor-side availability editing, cancellation, or rescheduling.
- **D-18:** On the profile page, each displayed slot may show a call-to-action (e.g., "Select this slot"), but it must be disabled/non-interactive and clearly indicate booking arrives in a future phase. Never let a control appear clickable/functional if it silently does nothing.

### Claude's Discretion

- Exact slot duration and business-hour window used by the seed script (e.g., 30-minute slots, 09:00-17:00 `Asia/Jerusalem`) — within the "realistic consultation hours" envelope from D-01.
- Exact styling/wording of the "No upcoming availability" indicator (D-06) and the disabled "Select this slot" CTA copy (D-18).
- Exact wording/styling of the "demo profile" indicator (PROFILE-02) — reuse the existing `components/ui/badge.tsx` pattern already used elsewhere in the admin UI.
- Exact URL query-param names (e.g. `q`, `specialty`, `language`, `neighborhood`, `availableFrom`, `availableTo`, `page`) — keep them descriptive and consistent with D-13's example.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. Booking, appointment creation, doctor-side availability editing, cancellation, and rescheduling were explicitly reaffirmed as out of scope for this phase (D-17) and already belong to Phases 4 and 5 in the roadmap.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEARCH-01 | Patient can search doctors by name | `doctors_full_name_trgm_idx` (gin trigram) already exists — `.ilike('full_name', '%q%')` on the search view uses it. See Standard Stack / Code Examples. |
| SEARCH-02 | Patient can filter doctors by specialty | `.eq('specialty_id', id)` on the search view. |
| SEARCH-03 | Patient can filter doctors by spoken language | `.contains('language_codes', [code])` against a view column pre-aggregated from `doctor_languages`/`languages` — see Architecture Patterns Pattern 1. |
| SEARCH-04 | Patient can filter doctors by neighborhood/location | `.eq('neighborhood', value)` — the view flattens `locations.neighborhood` to a plain column. |
| SEARCH-05 | Patient can filter doctors by availability (date range) | Two-query pattern: pre-query `availability_slots` for matching `doctor_id`s, then `.in('id', ids)` on the view — see Pattern 2 (this is NOT the same computation as sort). |
| SEARCH-06 | Combine multiple filters (AND) | Supabase-JS chains filters with implicit AND — see Code Examples. |
| SEARCH-07 | Results show each doctor's next available slot | `next_available_at` view column via `LEFT JOIN LATERAL`. |
| SEARCH-08 | Sorted by soonest availability | `.order('next_available_at', { ascending: true, nullsFirst: false })` — NULLS LAST natively matches D-05. |
| SEARCH-09 | Empty results → clear message | UI-only; standard empty-state pattern already used in `OversightTable`/`doctors-page-client.tsx`. |
| PROFILE-01 | Public profile (name, specialty, description, address, neighborhood, languages, photo) | Direct `doctors` + joins query in `GET /api/doctors/[id]`, mirrors `app/api/admin/doctors/[id]/route.ts`'s `DOCTOR_LIST_SELECT` shape minus admin-only fields. |
| PROFILE-02 | "Demo profile" indicator | `doctors.is_demo` column already exists (`not null default true`) — no new field needed. |
| PROFILE-03 | Upcoming available slots on profile | Direct `availability_slots` query scoped to one `doctor_id`, RLS already restricts to `status='available'`. |
</phase_requirements>

## Summary

This phase is a pure read/query-design problem layered on an already-complete, already-RLS-protected schema — no new tables, no RLS policy changes, and no new npm packages are required. The two mechanisms the codebase does not yet have precedent for are (1) sorting a list of parent rows by a computed aggregate of a child table ("next available slot per doctor") while still paginating server-side, and (2) persisting filter/page state in the URL query string for a Client Component list page.

For (1), the correct and idiomatic Supabase answer is a Postgres **view** (`doctor_search_view`) created `WITH (security_invoker = true)` — available and required on Postgres 15+, and this project runs Postgres 17 (`supabase/config.toml: major_version = 17`, verified this session). The view composes a `LEFT JOIN LATERAL` subquery that finds each doctor's earliest future `status='available'` slot, flattens the specialty/location joins into plain columns, and pre-aggregates spoken-language codes into a Postgres array column. Because the view is `security_invoker`, it transparently inherits the RLS already enforced on `doctors` and `availability_slots` for the anon role — **no `SECURITY DEFINER` function and no RLS policy edits are needed**. The whole query — filter, sort-by-computed-column with NULLS LAST, and `.range()` pagination — is then expressible as a single call through the plain Supabase-JS query builder (`supabase.from('doctor_search_view').select(..., {count:'exact'}).eq(...).ilike(...).contains(...).order('next_available_at', {ascending:true, nullsFirst:false}).range(from,to)`), with only the availability-date-range filter requiring one small extra round-trip (a distinct-`doctor_id` pre-query — this is a genuinely different computation than the sort, not a limitation of the approach).

For (2), the codebase already has a working precedent (`app/login/page.tsx`) for a `"use client"` component that reads `useSearchParams()`/writes via `useRouter()`, wrapped in `<Suspense>` at the page boundary so the route still statically prerenders. The same shape — Client Component + `fetch()` to a new `GET /api/doctors` route + `router.replace()` on filter change — should be reused for `/search`, matching every other list page in the app (`OversightTable`, `doctors-page-client.tsx`), rather than introducing a Server Component data-fetching pattern that has no precedent here.

**Primary recommendation:** Create one new Postgres view (`doctor_search_view`, `security_invoker = true`) backing `GET /api/doctors`; build `/search` and `/doctors/[id]` as `"use client"` pages fetching from two new REST routes, following the exact component/fetch/empty-state conventions already established by the admin oversight pages.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Multi-filter doctor search (name/specialty/language/neighborhood/availability) | API / Backend | Database / Storage | Filter logic is expressed as Supabase-JS query-builder calls inside `GET /api/doctors`; the actual row-level enforcement (active-only, available-only) lives in DB RLS + the new view. |
| Sort-by-next-available-slot | Database / Storage | API / Backend | The `LEFT JOIN LATERAL` aggregate must live in SQL (a view) — no ORM/query-builder layer can express "sort by MIN(child.start_at)" without one. |
| Server-side pagination | API / Backend | Database / Storage | `.range()` executed by the Route Handler against the view; the Client Component only ever receives one page of rows + a total count, never the full list. |
| URL-persisted filter/page state | Browser / Client | — | Pure client-side concern (`useSearchParams`/`router.replace`); no server involvement beyond the route accepting query params it already accepts. |
| Public doctor profile display | API / Backend | Browser / Client | Route Handler assembles the DTO (specialty/location/languages/photo/is_demo); Client Component renders it — same split as the existing admin doctor endpoints. |
| Upcoming-slots list on profile | API / Backend | Database / Storage | Simple scoped query (`doctor_id = X`), RLS does the `status='available'` filtering for free. |
| "Demo profile" / disabled booking CTA | Browser / Client | — | Presentational only — reads `is_demo` and renders a disabled control; no new backend logic. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.112.0 (installed; 2.112.1 latest on npm, verified via `npm view`) | Query builder for the new view/routes | Already the project's only DB client library; no alternative considered. |
| `@supabase/ssr` | 0.12.4 (installed; matches npm latest) | Server/browser client factories (`lib/supabase/server.ts`, `lib/supabase/client.ts`) | Already established in every existing route/page. |
| `next` | 16.2.12 (installed; 16.3.0 latest on npm) | App Router pages/route handlers | Project-mandated (CLAUDE.md). |

No new runtime dependency is required for this phase — the date-range picker is two native `<Input type="date">` fields (already used in `app/admin/appointments/page.tsx`) plus quick-select buttons, and URL-state sync uses only `next/navigation` primitives already used in `app/login/page.tsx`.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| — | — | — | No supporting libraries needed. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `security_invoker` view + plain query builder | `supabase.rpc()` calling a hand-written SQL function | RPC works too but forfeits PostgREST's declarative filter/order/range surface — every new filter would require editing the SQL function signature instead of chaining a JS method. Not needed here since the view fully solves it. |
| Array-column `.contains()` for language filter | Two-step `.in('id', doctorIdsMatchingLanguage)` | Both work. `.contains()` is a single round-trip once `language_codes text[]` is in the view; the two-step form is the fallback if array-column filtering ever proves awkward in testing. |
| OFFSET pagination via `.range()` | Cursor/keyset pagination | The project's own `supabase-postgres-best-practices` skill recommends cursor pagination for O(1) deep-page performance — but D-11/D-15 explicitly lock in classic numbered Prev/Next pagination with `.range()`, and the dataset is ~12 demo doctors, so the OFFSET tradeoff is immaterial here. Documented, not overridden. |

**Installation:** None — no new packages.

## Package Legitimacy Audit

No external packages are introduced by this phase. Skipped per protocol (audit is required only "whenever this phase installs external packages").

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────┐
│  Browser (patient)      │
│  /search?specialty=..   │
│  &language=..&page=2    │
└─────────────┬────────────┘
              │ 1. GET /search (Client Component mounts)
              │ 2. reads useSearchParams() → builds filter state
              ▼
┌─────────────────────────────────────┐
│ app/search/page.tsx ("use client",   │
│ wrapped in <Suspense>)               │
│  - on filter/page change:            │
│    router.replace(?new query string) │
│    fetch(`/api/doctors?${qs}`)       │
└─────────────┬─────────────────────────┘
              │ 3. fetch (debounced for name input)
              ▼
┌───────────────────────────────────────────┐
│ GET /api/doctors  (Route Handler)          │
│  - parse+validate searchParams             │
│  - if availableFrom/To: pre-query           │
│    availability_slots → distinct doctor_ids │
│  - build query against doctor_search_view: │
│    .eq/.ilike/.contains/.in (AND-combined)  │
│    .order('next_available_at',              │
│            {ascending:true, nullsFirst:false})│
│    .order('id')  .range(offset, offset+5)   │
│    .select(cols, {count:'exact'})           │
└─────────────┬───────────────────────────────┘
              │ 4. session-bound (anon/public) Supabase client
              ▼
┌───────────────────────────────────────────┐
│ Postgres: doctor_search_view                │
│ (security_invoker = true)                   │
│  doctors ⋈ specialties ⋈ locations           │
│  LEFT JOIN LATERAL (earliest available slot) │
│  language_codes := array_agg(...)            │
│  RLS of doctors/availability_slots applies    │
│  transparently to the anon caller             │
└───────────────────────────────────────────┘
              │ 5. JSON { doctors[], total }
              ▼
     Client Component renders result cards +
     numbered pagination + "no doctor found" state

──────────────────────────────────────────────

┌─────────────────────────┐
│ Browser → /doctors/[id] │
└─────────────┬────────────┘
              │ fetch(/api/doctors/[id])
              ▼
┌───────────────────────────────────────────┐
│ GET /api/doctors/[id] (Route Handler)       │
│  - doctors + specialty + location + langs   │
│    (direct joined select, single row)       │
│  - availability_slots WHERE doctor_id=$id   │
│    AND status='available' AND start_at>now()│
│    ORDER BY start_at  (RLS already available-│
│    only for anon — no extra WHERE needed)    │
└───────────────────────────────────────────┘
              │ JSON { doctor, upcomingSlots[] }
              ▼
     Profile page renders details, is_demo badge,
     grouped-by-day slot list, disabled "Select
     this slot" CTA (D-18)
```

### Recommended Project Structure

```
app/
├── search/
│   └── page.tsx                # "use client" wrapped in <Suspense> (mirrors app/login/page.tsx)
├── doctors/
│   └── [id]/
│       └── page.tsx            # "use client", fetches GET /api/doctors/[id]
├── api/
│   └── doctors/
│       ├── route.ts            # GET — search/list, queries doctor_search_view
│       └── [id]/
│           └── route.ts        # GET — public profile + upcoming slots
components/
├── search/
│   ├── search-filters.tsx      # filter form (name/specialty/language/neighborhood/date-range)
│   ├── search-results.tsx      # result cards + pagination controls
│   └── doctor-card.tsx         # one result card (photo/initials-avatar, next-slot badge)
supabase/
└── migrations/
    └── <timestamp>_add_doctor_search_view.sql   # CREATE VIEW doctor_search_view WITH (security_invoker=true) ...
```

### Pattern 1: `security_invoker` view for sort-by-computed-value + flattened filters

**What:** A Postgres view that joins `doctors` to `specialties`/`locations` (flattened to plain columns) and to a `LEFT JOIN LATERAL` subquery computing each doctor's earliest future available slot, plus a pre-aggregated `language_codes text[]` column.
**When to use:** Any time a list must be sorted or filtered by a value that isn't a plain column on the table being listed — this is the case for `next_available_at` (aggregate of a child table) and `language_codes` (many-to-many join).
**Example (migration SQL):**
```sql
-- Source: Supabase official guidance (security_invoker views, PG15+) — CITED,
-- cross-checked via web search against supabase.com/docs and dev.to write-ups;
-- LATERAL top-1-per-group pattern is standard Postgres (CITED).
-- Columns verified against supabase/migrations/20260803230000_initial_schema.sql
-- (this session) — see exact column list in that file, lines 24-77.
create view public.doctor_search_view
with (security_invoker = true) as
select
  d.id,
  d.full_name,
  d.bio,
  d.photo_url,
  d.is_demo,
  d.specialty_id,
  s.name_en as specialty_name_en,
  s.name_he as specialty_name_he,
  d.location_id,
  l.city,
  l.neighborhood,
  coalesce(lang.codes, '{}') as language_codes,
  next_slot.start_at as next_available_at
from public.doctors d
join public.specialties s on s.id = d.specialty_id
join public.locations l on l.id = d.location_id
left join lateral (
  select array_agg(lng.code) as codes
  from public.doctor_languages dl
  join public.languages lng on lng.id = dl.language_id
  where dl.doctor_id = d.id
) lang on true
left join lateral (
  select a.start_at
  from public.availability_slots a
  where a.doctor_id = d.id
    and a.status = 'available'
    and a.start_at > now()
  order by a.start_at asc
  limit 1
) next_slot on true
where d.is_active = true;  -- defense-in-depth; RLS also enforces this for anon

grant select on public.doctor_search_view to anon, authenticated;
```
Ordering + pagination through the plain query builder (no RPC needed):
```typescript
// Route Handler — app/api/doctors/route.ts
let query = supabase
  .from("doctor_search_view")
  .select(
    "id, full_name, bio, photo_url, is_demo, specialty_id, specialty_name_en, " +
    "specialty_name_he, location_id, city, neighborhood, language_codes, next_available_at",
    { count: "exact" },
  );

if (q) query = query.ilike("full_name", `%${q}%`);
if (specialtyId) query = query.eq("specialty_id", specialtyId);
if (neighborhood) query = query.eq("neighborhood", neighborhood);
if (language) query = query.contains("language_codes", [language]);
if (matchingDoctorIds) query = query.in("id", matchingDoctorIds); // availability-range prequery, see Pattern 2

const { data, count, error } = await query
  .order("next_available_at", { ascending: true, nullsFirst: false })
  .order("id", { ascending: true }) // stable tie-break across pages
  .range(offset, offset + PAGE_SIZE - 1);
```
`nullsFirst: false` with `ascending: true` is the documented way to push NULL `next_available_at` doctors to the end of the ascending sort — this directly implements D-05 without any CASE-based workaround. [CITED: supabase.com/docs/reference/javascript/order, cross-checked via web search]

### Pattern 2: Availability-date-range filter is a separate pre-query, not a reuse of `next_available_at`

**What:** D-08 requires "has *at least one* slot in the selected range," which is a different question from "what is the *earliest* slot overall" (`next_available_at`). A doctor's soonest slot can fall outside a requested range while a *later* slot of theirs falls inside it — `next_available_at` alone cannot answer the filter.
**When to use:** Whenever `availableFrom`/`availableTo` query params are present.
**Example:**
```typescript
// Only runs when the availability filter is active — one extra round-trip,
// still leaves the final paginated fetch as a single .range() call (D-15).
let matchingDoctorIds: string[] | null = null;
if (availableFrom || availableTo) {
  let slotQuery = supabase
    .from("availability_slots")
    .select("doctor_id")
    .eq("status", "available")
    .gt("start_at", new Date().toISOString());
  if (availableFrom) slotQuery = slotQuery.gte("start_at", availableFrom);
  if (availableTo) slotQuery = slotQuery.lte("start_at", availableTo);

  const { data: slotRows, error: slotError } = await slotQuery;
  if (slotError) { /* 500 */ }
  matchingDoctorIds = [...new Set((slotRows ?? []).map((r) => r.doctor_id))];
  if (matchingDoctorIds.length === 0) {
    // Short-circuit: no doctor matches, return empty page without hitting the view.
    return NextResponse.json({ doctors: [], total: 0 });
  }
}
```
This query is served by the existing partial index `availability_slots_available_idx (start_at) where status = 'available'` [VERIFIED: supabase/migrations/20260803230000_initial_schema.sql:119 — `create index availability_slots_available_idx on public.availability_slots (start_at) where status = 'available';`], so no new index is needed.

### Pattern 3: AND-combined multi-filter query building (already established in this codebase)

**What:** Supabase-JS chains filters with implicit AND; conditionally call `.eq()`/`.ilike()`/`.in()` only when a query param is present.
**When to use:** Every multi-filter list endpoint.
**Example (existing precedent in this repo):**
```typescript
// Source: app/api/admin/appointments/route.ts (verified this session, lines 41-58)
let query = guard.supabase.from("appointments").select(APPOINTMENT_SELECT);
if (status) query = query.eq("status", status);
if (doctorId) query = query.eq("doctor_id", doctorId);
if (from) query = query.gte("availability_slots.start_at", from);
if (to) query = query.lte("availability_slots.start_at", to);
```
Note the `!inner` embed + dotted-path filter shown in that file's `APPOINTMENT_SELECT` (`slot:availability_slots!inner(...)`) is the correct pattern *when filtering through a direct FK join on a real table*. It is **not** used for Phase 3's `doctor_search_view` filters because the view already flattens `neighborhood`/`specialty_id`/`language_codes` to plain columns — no embedding is needed there at all. Reserve `!inner` + dotted-path filtering for any future direct-table (non-view) join filter.

### Pattern 4: URL-persisted filter/pagination state in a Client Component (existing precedent: `app/login/page.tsx`)

**What:** A `"use client"` inner component uses `useSearchParams()` to read initial filter/page state and `useRouter().replace()` to write changes back to the URL, wrapped in `<Suspense>` at the exported page component so the route can still statically prerender.
**When to use:** `/search` page (new precedent for this phase; `/doctors/[id]` does not need it — no filters there).
**Example:**
```typescript
// Source: app/login/page.tsx (verified this session, lines 1-5, 134-140) — same
// useSearchParams + Suspense shape, applied here to filters instead of ?from=
"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function SearchPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // read initial state from searchParams.get("specialty") etc.

  function updateQuery(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value); else params.delete(key);
    }
    if (!("page" in next)) params.set("page", "1"); // D-14: any filter change resets to page 1
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }
  // ...
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageInner />
    </Suspense>
  );
}
```
Debounce only the free-text name field (no library — a small custom hook, ~10 lines, since the project has no existing debounce utility and this is not complex enough to warrant a dependency):
```typescript
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
```

### Anti-Patterns to Avoid

- **Fetching all doctors and sorting/paginating in JavaScript:** Explicitly forbidden by D-15. With the view in place there is no reason to do this — the DB does the work in one query.
- **Adding a `SECURITY DEFINER` function to "fix" an RLS error on the new view:** If `doctor_search_view` ever returns fewer/more rows than expected, the fix is almost always a missing `GRANT SELECT` on the view (see Common Pitfalls) or a security_invoker misunderstanding — not switching to `SECURITY DEFINER`, which would silently bypass the `is_active`/`status='available'` protections this phase depends on. [Supabase skill security checklist, this session]
- **Reusing `next_available_at` to answer the availability-range filter:** See Pattern 2 — they are different computations; conflating them will show a doctor whose *earliest* slot is outside the requested range but who has *no* slot inside it.
- **Building `/doctors/[id]` as a Server Component that queries Supabase directly while `/search` stays a Client Component:** Would introduce an inconsistent data-fetching convention with no precedent in this codebase (every existing list/detail page — `admin/doctors`, `admin/appointments`, `admin/users` — is Client Component + `fetch()` to a Route Handler). Keep both new pages Client Components for consistency, per D-16's own routing plus the existing `GET /api/doctors/[id]` task in TASKS.md.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Next available slot per doctor" aggregate | A JS loop that fetches all slots and reduces per doctor | `LEFT JOIN LATERAL ... LIMIT 1` in the view | Postgres computes this with an index-assisted scan per doctor; doing it in JS means fetching every slot row for every doctor on every search request. |
| Sorting with nulls-last semantics | A manual `.sort()` in JS after fetching | `.order(col, { ascending: true, nullsFirst: false })` | Already a first-class PostgREST/Supabase-JS option — reimplementing it in JS also breaks server-side pagination (D-15). |
| Many-to-many "doctor speaks language X" filter | A JS `.filter()` over a fully-loaded doctor+languages join | `.contains('language_codes', [code])` on the pre-aggregated view column | Single SQL predicate, index-friendly, keeps the filter server-side and paginate-able. |
| Timezone-correct date-range boundary conversion for the availability filter | New ad-hoc UTC math | The existing `getTimeZoneOffsetMs` / `jerusalemBoundaryToUtcIso` helpers in `app/admin/appointments/page.tsx` (verified this session, lines 51-86) | Already solves exactly this problem (calendar day in `Asia/Jerusalem` → correct UTC instant, DST-safe) — copy or extract to a shared `lib/` helper rather than re-deriving. |

**Key insight:** Every "hard" part of this phase (aggregate sort, M2M filter, DST-safe date boundaries) already has either a first-class Supabase-JS/PostgREST feature or an existing in-repo helper — the risk in this phase is re-deriving one of these from scratch instead of reusing what already exists.

## Common Pitfalls

### Pitfall 1: New view is invisible to `anon`/`authenticated` even though the underlying tables are readable
**What goes wrong:** `doctor_search_view` returns an empty result (or a PostgREST 401/permission error) for the public search endpoint even though `doctors`/`availability_slots` RLS allows anon reads.
**Why it happens:** Creating a new relation (table or view) does not automatically inherit the anon/authenticated `GRANT SELECT` that Supabase's initial project setup applied to *existing* tables, unless a matching `ALTER DEFAULT PRIVILEGES` rule is in place for future relations.
**How to avoid:** Always pair the `CREATE VIEW ... WITH (security_invoker = true)` statement with an explicit `grant select on public.doctor_search_view to anon, authenticated;` in the same migration, and run `supabase db advisors` (or MCP `get_advisors`) before committing the migration, per the project's `supabase` skill.
**Warning signs:** `GET /api/doctors` returns 0 rows for an anonymous Playwright test session even though a direct `doctors` query in the same test returns rows.

### Pitfall 2: Forgetting `security_invoker = true` silently reintroduces a data leak
**What goes wrong:** A view created without `WITH (security_invoker = true)` runs with the view *owner's* privileges (typically `postgres`, which bypasses RLS) — meaning inactive doctors or booked/blocked slots could leak into public search results even though the underlying table RLS looks correct.
**Why it happens:** This is Postgres's default view behavior pre-15 and remains the default even on 15+ unless the option is set explicitly; it's easy to omit.
**How to avoid:** Always specify `security_invoker = true` on every new view in this project (Postgres 17 confirmed via `supabase/config.toml`), and add a Playwright assertion (mirroring the existing `tests/e2e/admin-route-protection.spec.ts` style) that an anon-client search never returns an `is_active = false` or availability-slot-less-than-now doctor.
**Warning signs:** A deactivated demo doctor (created via `/admin/doctors` status toggle) still appears in `/search` results.

### Pitfall 3: Conflating "sort key" and "filter predicate" for availability
**What goes wrong:** Implementing the availability-range filter as `.gte('next_available_at', from).lte('next_available_at', to)` on the view — this only matches doctors whose *earliest* slot happens to fall in range, silently excluding doctors who have a real matching slot later in their schedule.
**Why it happens:** `next_available_at` and "has a slot in range" look like the same computation but are not (see Pattern 2).
**How to avoid:** Always implement the availability-range filter as the separate `availability_slots` pre-query described in Pattern 2, never as a range filter on `next_available_at`.
**Warning signs:** A Playwright test that seeds a doctor with slots on day 1 and day 15, then filters for day 15 only, fails to find that doctor.

### Pitfall 4: `.range()` off-by-one or missing `.order()` causing duplicate/skipped rows across pages
**What goes wrong:** Page 2 shows a doctor already seen on page 1, or a doctor is missing from both pages.
**Why it happens:** `.range(from, to)` is inclusive on both ends (`range(0,5)` = 6 rows) — an incorrect `offset = page * pageSize` (instead of `(page - 1) * pageSize`) shifts every page by one page size. Also, ordering by a nullable/non-unique column alone can produce ties that Postgres orders inconsistently across two separate paginated requests.
**How to avoid:** `offset = (page - 1) * PAGE_SIZE`, `range(offset, offset + PAGE_SIZE - 1)`; always add a deterministic secondary `.order('id', { ascending: true })` after `.order('next_available_at', ...)` as a tie-breaker (shown in Pattern 1's example).
**Warning signs:** A Playwright test paging through all results and collecting doctor IDs finds a duplicate or a count mismatch against the `total` returned by `count: 'exact'`.

### Pitfall 5: Seed script idempotency for slots (D-03) using the wrong "already has slots" check
**What goes wrong:** Re-running `npm run seed` inserts duplicate/overlapping slots for a doctor, tripping the `availability_slots_no_overlap` exclusion constraint (`GiST` on `(doctor_id, tstzrange(start_at,end_at))` [VERIFIED: supabase/migrations/20260803230000_initial_schema.sql:72-76 — `constraint availability_slots_no_overlap exclude using gist ( doctor_id with =, tstzrange(start_at, end_at) with && )`]) and crashing the seed run.
**Why it happens:** The existing `seedDoctors()` idempotency check in `scripts/seed.ts` is keyed on `full_name` existence (doctors have no natural unique key) — a naive copy-paste for slots might check "does this doctor have *any* row in `availability_slots`" using a query that doesn't scope to *future* rows, which would wrongly skip seeding after slots have expired, or (worse) not check at all and re-insert.
**How to avoid:** Mirror the existing pattern exactly: before inserting, `select doctor_id from availability_slots where doctor_id = any($ids) and start_at > now()` and skip slot generation only for doctors that already have at least one *future* row — exactly as D-03 specifies ("skip slot generation for a doctor if it already has future availability_slots rows").
**Warning signs:** Second `npm run seed` run throws a `23P01` exclusion-violation Postgres error.

## Code Examples

### GET /api/doctors[id] public profile shape (mirrors existing admin pattern minus admin-only fields)
```typescript
// Source: app/api/admin/doctors/route.ts DOCTOR_LIST_SELECT (verified this
// session, lines 6-10) — adapted to drop `profile_id` (admin-only) and add
// upcoming slots as a second query.
const PUBLIC_DOCTOR_SELECT =
  "id, full_name, bio, photo_url, is_demo, " +
  "specialty:specialties(id,name_en,name_he), " +
  "location:locations(id,city,neighborhood,address), " +
  "languages:doctor_languages(languages(id,code))";

// Route Handler — GET /api/doctors/[id]
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

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `SECURITY DEFINER` views/functions to expose joined public data | `security_invoker = true` views (Postgres 15+) | Postgres 15 (2022) | This project (Postgres 17) should default to `security_invoker` for every new view — `SECURITY DEFINER` is now the exception, reserved for narrow internal RLS-helper functions like the existing `is_admin()`/`is_doctor_owner()` (which are deliberately `SECURITY DEFINER` to avoid RLS recursion, not to expose broad data). |

**Deprecated/outdated:**
- Offset pagination is generally discouraged for very large/deep-paginated datasets (per this project's own `supabase-postgres-best-practices` skill) in favor of cursor/keyset pagination — not applicable as a change here because D-11/D-15 lock in numbered `.range()` pagination and the dataset (~12 demo doctors) makes the tradeoff moot.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `supabase-js` `.order(col, { ascending: true, nullsFirst: false })` produces `ORDER BY col ASC NULLS LAST` at the PostgREST/Postgres level, exactly matching D-05's "no-slot doctors last" requirement | Pattern 1 | If the option name or default differs from what web search found, the sort could silently put no-availability doctors first instead of last — must be verified with a live query against seeded data (mix of doctors with/without slots) before trusting it in the plan; add a Playwright/manual check early in execution. |
| A2 | `.contains('language_codes', [code])` on a `text[]` view column filters correctly via the PostgREST `cs` operator | Pattern 1, Don't Hand-Roll | If it doesn't behave as expected against a view (vs. a real table), fall back to the two-step `.in('id', ids)` pattern already used for the availability filter (Pattern 2) — verify against seeded multi-language doctors early. |
| A3 | Newly created views on this Supabase project do not automatically receive `anon`/`authenticated` `SELECT` grants and need an explicit `GRANT` | Common Pitfalls #1 | If the project's default privileges already cover future views, the explicit `GRANT` is harmless (idempotent) — low risk either way, but worth confirming via `supabase db advisors` before considering the migration done. |

**None of these were found to contradict each other or the locked decisions during research — but none were confirmed by executing a live query against this project's actual database this session (no DB write/query access was exercised in the research step). Treat A1/A2 as the two claims to validate first during plan execution, ideally in a throwaway `execute_sql`/psql check before the view migration is finalized.**

## Open Questions

1. **Exact quick-select shortcut semantics for the availability filter (D-07: Today / Next 7 days / Next 30 days)**
   - What we know: These are UI shortcuts that presumably just populate the start/end date inputs.
   - What's unclear: Whether "Today" means "any slot remaining today" (from `now()` to end-of-today `Asia/Jerusalem`) or "any slot on today's calendar date" — affects the exact boundary math using the existing `jerusalemBoundaryToUtcIso` helper.
   - Recommendation: Treat "Today" as `[now(), end-of-today Asia/Jerusalem]`, "Next 7 days" as `[now(), +7 days end-of-day]`, etc. — consistent with D-08's "in the future" requirement. Flag for a quick confirmation during planning if the planner wants to lock exact wording.

2. **Whether `/doctors/[id]` should be crawlable/SSR for a "real" search-engine-facing profile page**
   - What we know: This is an academic demo project; the existing codebase has zero Server-Component-driven public pages (everything user-facing besides the marketing/login shell is Client Component + fetch).
   - What's unclear: Nothing blocking — this is purely a discretionary architecture call.
   - Recommendation: Stay consistent with the existing Client Component convention (see Anti-Patterns) unless the planner has a specific reason (e.g., SEO) to deviate — no such requirement exists in REQUIREMENTS.md.

## Environment Availability

No external tools/services beyond what Phases 1-2 already established (Supabase project, Node/npm, Playwright) are introduced by this phase. Skipped detailed audit — nothing new to probe.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright `@playwright/test` 1.62.1 (installed; verified via `package.json`) |
| Config file | `playwright.config.ts` (testDir `./tests/e2e`, `workers: 1`, `webServer` auto-starts `npm run dev`) |
| Quick run command | `npx playwright test tests/e2e/search-*.spec.ts` |
| Full suite command | `npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEARCH-01 | Search by name returns matching doctors | e2e | `npx playwright test tests/e2e/search-filters.spec.ts -g "name"` | ❌ Wave 0 |
| SEARCH-02..04 | Filter by specialty/language/neighborhood | e2e | `npx playwright test tests/e2e/search-filters.spec.ts -g "filter"` | ❌ Wave 0 |
| SEARCH-05 | Filter by availability date range | e2e | `npx playwright test tests/e2e/search-filters.spec.ts -g "availability"` | ❌ Wave 0 |
| SEARCH-06 | Combined filters (AND) | e2e | `npx playwright test tests/e2e/search-filters.spec.ts -g "combination"` | ❌ Wave 0 |
| SEARCH-07/08 | Next-slot display + sort order | e2e | `npx playwright test tests/e2e/search-sort-pagination.spec.ts -g "sort"` | ❌ Wave 0 |
| SEARCH-09 | Empty results message | e2e | `npx playwright test tests/e2e/search-filters.spec.ts -g "no results"` | ❌ Wave 0 |
| D-11..15 | Numbered pagination, URL persistence, page reset on filter change | e2e | `npx playwright test tests/e2e/search-sort-pagination.spec.ts -g "pagination"` | ❌ Wave 0 |
| PROFILE-01..03 | Profile display, demo badge, upcoming slots | e2e | `npx playwright test tests/e2e/doctor-profile.spec.ts` | ❌ Wave 0 |
| D-18 | Disabled "Select this slot" CTA never functions | e2e | `npx playwright test tests/e2e/doctor-profile.spec.ts -g "disabled"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx playwright test tests/e2e/search-filters.spec.ts tests/e2e/search-sort-pagination.spec.ts tests/e2e/doctor-profile.spec.ts` (this phase's own specs, fast feedback)
- **Per wave merge:** `npx playwright test` (full suite — this project has no faster "affected tests only" tooling)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/e2e/search-filters.spec.ts` — covers SEARCH-01 through SEARCH-06, SEARCH-09
- [ ] `tests/e2e/search-sort-pagination.spec.ts` — covers SEARCH-07, SEARCH-08, D-11 through D-15
- [ ] `tests/e2e/doctor-profile.spec.ts` — covers PROFILE-01 through PROFILE-03, D-06, D-18
- [ ] `tests/e2e/helpers/` — likely needs a small addition to seed/read known demo-doctor fixtures for deterministic assertions (the shared `tests/e2e/helpers/supabase-anon.ts` and `helpers/test-users.ts` already exist and can be reused as-is)
- Framework install: none — Playwright is already configured and used by 13 existing spec files.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | This phase is entirely unauthenticated/public pages — no new auth surface. |
| V3 Session Management | No | No session state introduced. |
| V4 Access Control | Yes | RLS (`doctors_select_active_or_owner_or_admin`, `availability_slots_select_available_or_owner_or_admin`) already enforces the public/private boundary [VERIFIED: supabase/migrations/20260803230000_initial_schema.sql:224-241]; the new view must preserve this via `security_invoker = true` + explicit re-statement of `is_active=true`/`status='available'` as defense-in-depth (matches the codebase's existing convention of defense-in-depth checks alongside RLS, per `app/api/admin/doctors/[id]/route.ts` comments). |
| V5 Input Validation | Yes | Manual TypeScript validation functions for query params (mirrors `lib/validation/doctor.ts` shape) — validate `page`/`specialty`/`language`/`neighborhood` against known ids/enum values and `availableFrom`/`availableTo` as ISO date strings before use in any query, never interpolate raw strings into `.filter()`/raw SQL. |
| V6 Cryptography | No | No cryptographic operations in this phase. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via unvalidated `q`/filter query params reaching `.ilike()`/`.filter()` | Tampering | Supabase-JS parameterizes `.ilike()`/`.eq()`/`.contains()` calls — never use the raw `.filter()` escape hatch with string-concatenated user input; validate enum-like params (`specialty`, `neighborhood`, `language`) against known reference-data ids before querying. |
| RLS bypass via a mis-configured view (`security_invoker` omitted, or view created by a role with `bypassrls`) | Elevation of Privilege | `WITH (security_invoker = true)` on every new view (Common Pitfall #2); run `supabase db advisors` before shipping the migration. |
| Data leak of inactive/demo-internal doctor rows through the new view if `GRANT SELECT` is broader than intended, or if the view accidentally omits the `is_active` filter | Information Disclosure | Explicit `is_active = true` in the view WHERE clause (belt-and-suspenders with RLS) — verified via a Playwright test that toggles a doctor inactive via the existing admin status endpoint and asserts it disappears from `/search`. |
| Pagination/DoS via unbounded `page`/`limit` query params | Denial of Service | Server-side hardcode `PAGE_SIZE = 6` (D-11) and reject/clamp non-positive or absurdly large `page` values in the validation function — never accept a client-supplied page size. |

## Sources

### Primary (HIGH confidence — read directly this session)
- `supabase/migrations/20260803230000_initial_schema.sql` — full schema, indexes, RLS policies (lines 1-276, quoted verbatim where cited above)
- `supabase/migrations/20260804120100_add_reference_data_unique_constraints.sql` — specialty/location uniqueness constraints
- `supabase/config.toml` — `major_version = 17` (Postgres version, confirms `security_invoker` view support)
- `app/api/admin/doctors/route.ts`, `app/api/admin/doctors/[id]/route.ts`, `app/api/admin/appointments/route.ts` — existing REST route + PostgREST filter patterns
- `app/login/page.tsx` — existing `useSearchParams`/`Suspense` Client Component precedent
- `app/admin/appointments/page.tsx` — existing timezone-boundary-conversion helper, filter-building precedent
- `components/admin/oversight-table.tsx`, `components/admin/doctors-page-client.tsx`, `components/ui/badge.tsx`, `components/initials-avatar.tsx` — reusable UI patterns
- `scripts/seed.ts`, `lib/validation/doctor.ts`, `lib/auth/require-admin.ts`, `lib/supabase/{server,client}.ts` — existing conventions this phase must follow
- `.planning/phases/03-doctor-discovery-search-public-profiles/03-CONTEXT.md`, `TASKS.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/config.json`

### Secondary (MEDIUM confidence — web search, cross-checked against ≥2 independent sources / the project's own `supabase` skill)
- `security_invoker` view semantics on Postgres 15+/Supabase (cross-checked: `supabase.com/docs` per the `supabase` skill's own security checklist text, `dev.to` write-up, PostgreSQL mailing list thread)
- `supabase-js` `.order()` `nullsFirst`/`nullsLast` behavior (cross-checked: GitHub `postgrest-js` issue #239, `supabase.com/docs/reference/javascript/order` indexed summary)
- `supabase-js` `.contains()` / PostgREST `cs` operator on array columns (cross-checked: `supabase.com/docs/reference/javascript/v1/contains`, `supabase.com/docs/reference/javascript/v1/using-filters`)
- `supabase-js` `.range()` + `{count:'exact'}` pagination (cross-checked: `supabase.com/docs/reference/javascript/range`, multiple third-party tutorials agreeing on the same shape)
- PostgREST `!inner` embedded-resource filtering scope (cross-checked: `docs.postgrest.org` resource-embedding reference, GitHub `postgrest-js` issue #197)
- LATERAL join top-1-per-group pattern (standard, well-documented Postgres feature; cross-checked against multiple independent tutorial sources)
- Next.js App Router `useSearchParams`/`router.replace`/debounce pattern for filterable lists (cross-checked: `nextjs.org/learn/dashboard-app/adding-search-and-pagination` official tutorial, `robinwieruch.de`, `aurorascharff.no`)

### Tertiary (LOW confidence)
None used directly in recommendations — all web-sourced claims above were cross-checked against at least one official-domain result before being cited.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; versions confirmed installed + current via `npm view` this session.
- Architecture (view + security_invoker + LATERAL + pagination): MEDIUM-HIGH — mechanism is standard/well-documented Postgres/Supabase behavior cross-checked across independent sources, but not verified by executing a live query against this project's actual database this session (see Assumptions Log A1/A2 — validate early during execution).
- RLS sufficiency for public search/profile reads: HIGH — read the actual policy SQL this session; existing policies are confirmed sufficient as-is, no policy changes needed.
- Pitfalls: HIGH — each pitfall is either drawn directly from the schema/constraints read this session or from the project's own `supabase` skill security checklist.

**Research date:** 2026-08-06
**Valid until:** 2026-09-05 (30 days — stable Postgres/Supabase-JS/Next.js APIs, no fast-moving dependencies in this phase)
