# Phase 3: Doctor Discovery — Search & Public Profiles - Context

**Gathered:** 2026-08-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Patients can find a doctor matching their criteria and review enough public information to decide whether to book — entirely through public, unauthenticated pages. This covers multi-criteria search (name, specialty, language, neighborhood, availability date range) with combinable filters, sorted by soonest next available slot; numbered pagination of results; and a public doctor profile page showing full details, a "demo profile" indicator, and a read-only list of upcoming available slots. Booking, appointment creation, doctor-side availability management, cancellation, and rescheduling are explicitly out of scope (Phases 4 and 5).

</domain>

<decisions>
## Implementation Decisions

### Demo availability data (seed)
- **D-01:** Phase 3 extends the existing `scripts/seed.ts` (Phase 2) to create demo `availability_slots` — none exist yet, Phase 2's D-09 deliberately deferred this to "whichever phase needs them," which is this one. Rules: only future slots; times authored in `Asia/Jerusalem` and stored as UTC `timestamptz` (per PROJECT.md's timezone constraint); spread across the next 21 days from run time; roughly 6-10 slots per doctor that receives availability; realistic consultation-hour times; no overlapping slots per doctor (the DB exclusion constraint already enforces this — the seed must generate non-overlapping ranges); zero `appointments` rows created in this phase — slots exist purely for search/display.
- **D-02:** Intentionally leave 1-2 active demo doctors with zero future slots, so the "no availability" UI state (D-06) is exercisable in both manual testing and Playwright tests.
- **D-03:** The slot-seeding step must be idempotent — re-running `scripts/seed.ts` must not create duplicate slots for a doctor that already has them (e.g., skip slot generation for a doctor if it already has future `availability_slots` rows).

### Doctors with no upcoming availability
- **D-04:** An active doctor with no future available slot still appears in search results — never excluded. Only `is_active = false` doctors are excluded, which the existing RLS policy (`doctors_select_active_or_owner_or_admin`, from Phase 1/2) already enforces for a public/anon client.
- **D-05:** Default sort order: doctors with a future available slot first, ascending by soonest slot (SEARCH-08); doctors with none sort after all of those, at the end of the result set.
- **D-06:** A doctor with no upcoming slots shows a clear "No upcoming availability" indicator on their search-result card, and their profile page must not present a slot-selection action (there is nothing to select).

### Availability filter semantics
- **D-07:** Filter UI is a simple date-range picker (start date + end date) plus quick-select shortcuts: Today / Next 7 days / Next 30 days. The filter is optional — no default range is applied when the page loads.
- **D-08:** A doctor matches the availability filter when they have at least one `availability_slots` row that is: within the selected date range, in the future, `status = 'available'` (not `booked`/`blocked`), and not deleted/disabled. When no range is selected, all active doctors are eligible regardless of their availability (consistent with D-04).
- **D-09:** All filters (name, specialty, language, neighborhood, availability range) combine with AND logic (SEARCH-06).
- **D-10:** "Next available slot" (used for card display and sort per SEARCH-07/08) = the doctor's earliest future `availability_slots` row with `status = 'available'`.

### Pagination
- **D-11:** Classic numbered pagination (Prev/Next buttons + page numbers) — no infinite scroll. 6 doctors per page.
- **D-12:** Total result count is displayed alongside the pagination controls.
- **D-13:** Active filters and the current page are persisted in the URL query string (e.g. `/search?specialty=...&language=...&neighborhood=...&availableFrom=...&availableTo=...&page=1`) so search state survives refresh/back-navigation and is shareable.
- **D-14:** Changing any filter resets pagination to page 1.
- **D-15:** Pagination is applied at the Supabase query level (`.range()` / limit+offset) — never load the full doctor list and slice it client-side. — **Reversibility:** reversible, but called out explicitly because no pagination pattern exists anywhere in the codebase yet (admin lists load everything unpaginated at ~12 rows) — this phase sets the precedent.

### Routing
- **D-16:** The search/list page stays at `/search` per TASKS.md — not renamed to `/doctors`. The user's own URL example (`/doctors?specialty=...&page=1`) during discussion was illustrative of query-param shape only, not a routing decision. The individual profile page stays at `/doctors/[id]` as TASKS.md already specifies.

### Phase boundary / non-functional booking CTA
- **D-17:** This phase covers only: public search, filtering, sorting, pagination, public profile viewing, and read-only display of upcoming available slots. It does NOT implement booking, appointment creation, doctor-side availability editing, cancellation, or rescheduling — those are Phases 4 and 5.
- **D-18:** On the profile page, each displayed slot may show a call-to-action (e.g., "Select this slot"), but it must be disabled/non-interactive and clearly indicate that booking arrives in a future phase of the project. Never let a control appear clickable/functional if it silently does nothing — that would mislead the user.

### Claude's Discretion
- Exact slot duration and business-hour window used by the seed script (e.g., 30-minute slots, 09:00-17:00 `Asia/Jerusalem`) — within the "realistic consultation hours" envelope from D-01.
- Exact styling/wording of the "No upcoming availability" indicator (D-06) and the disabled "Select this slot" CTA copy (D-18).
- Exact wording/styling of the "demo profile" indicator (PROFILE-02) — reuse the existing `components/ui/badge.tsx` pattern already used elsewhere in the admin UI.
- Exact URL query-param names (e.g. `q`, `specialty`, `language`, `neighborhood`, `availableFrom`, `availableTo`, `page`) — TASKS.md already proposes most of these; keep them descriptive and consistent with D-13's example.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level context
- `.planning/PROJECT.md` — full product context, Key Decisions, Constraints (REST/no-Zod/Playwright-only/i18n/UI/timezone)
- `.planning/REQUIREMENTS.md` — SEARCH-01 through SEARCH-09, PROFILE-01 through PROFILE-03 requirement text
- `.planning/ROADMAP.md` — Phase 3 goal, success criteria, dependency chain (depends on Phase 2)
- `.planning/phases/03-doctor-discovery-search-public-profiles/TASKS.md` — the user's own hand-written route/page/test breakdown for this phase — treat as a detailed reference outline, not a substitute for planning

### Database (ALREADY APPLIED — see code_context below)
- `supabase/migrations/20260803230000_initial_schema.sql` — `availability_slots` (status enum `available`/`booked`/`blocked`, GiST exclusion constraint preventing overlap per doctor, RLS `availability_slots_select_available_or_owner_or_admin` restricts public/anon reads to `status = 'available'` rows only); `doctors` (`is_active`/`is_demo` columns, RLS already restricts public reads to active doctors); `locations` (`neighborhood`); `languages` / `doctor_languages`.
- `supabase/migrations/20260804120100_add_reference_data_unique_constraints.sql` — reference data uniqueness constraints relevant to specialty/location filter option lists.
- `scripts/seed.ts` — Phase 2's seed script (12 demo doctors, all specialties/neighborhoods represented, language mix by `index % 3`, zero `availability_slots` by design). Phase 3 EXTENDS this script per D-01/D-02/D-03 — it does not replace it.

### Prior phase context
- `.planning/phases/02-admin-doctor-reference-data-management/02-CONTEXT.md` — D-09 (no slots seeded in Phase 2, explicitly deferred to whichever phase needs them — that's this phase)
- `.planning/phases/02-admin-doctor-reference-data-management/02-06-SUMMARY.md` — exact seed dataset shape (12 active demo doctors, language association pattern) that Phase 3's search runs against
- `.planning/phases/01-foundation-database-schema-authentication/01-CONTEXT.md` — D-01 (REST routes, no Server Actions), D-02 (manual TypeScript validation, no Zod), D-08 (GiST exclusion constraint mechanism for slot overlap)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/api/admin/doctors/route.ts` — `DOCTOR_LIST_SELECT` join pattern (`specialty:specialties(...)`, `location:locations(...)`, `languages:doctor_languages(languages(...))`) is the direct basis for the public search select — drop admin-only fields (`profile_id`) and rely on RLS to restrict to `is_active = true` rows for a non-admin/anon client.
- `components/initials-avatar.tsx` — reuse for doctor cards/profile header when `photo_url` is empty (Phase 2 D-02).
- `components/ui/{badge,card,button,select,skeleton}.tsx` — base primitives already in the project for result cards, filter selects, the "demo profile" badge, and loading skeletons.

### Established Patterns
- REST route handlers at `app/api/.../route.ts` with manual validation functions (see `lib/validation/doctor.ts`, `lib/validation/reference-data.ts` for the established validation-function shape).
- RLS already enforces "only active doctors" and "only available slots" at the DB layer for any client using the anon/public Supabase key — API routes built on the public client inherit this filtering for free and don't need to duplicate `is_active`/`status` checks in application code (though defense-in-depth checks are still reasonable).

### Integration Points
- New page: `app/search/page.tsx` (per D-16), backed by `GET /api/doctors` (per TASKS.md's endpoint naming).
- New page: `app/doctors/[id]/page.tsx`, backed by `GET /api/doctors/[id]`.
- No pagination pattern exists anywhere in the codebase yet (admin lists load all rows unpaginated) — this phase establishes the first one (D-11/D-15).

</code_context>

<specifics>
## Specific Ideas

The user specified the seed/filter/pagination rules in unusually complete detail during discussion — captured verbatim as decisions D-01 through D-15 above. Notably:
- Seed must avoid duplicates on repeat runs (D-03) and must deliberately leave a couple of doctors availability-free (D-02) so the empty-availability state is testable.
- Example URL shape given during discussion: `/doctors?specialty=dermatology&language=en&location=tel-aviv&page=1` — this was about query-param naming/shape only; the actual route stays `/search` per D-16.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Booking, appointment creation, doctor-side availability editing, cancellation, and rescheduling were explicitly reaffirmed as out of scope for this phase (D-17) and already belong to Phases 4 and 5 in the roadmap.

</deferred>

---

*Phase: 3-doctor-discovery-search-public-profiles*
*Context gathered: 2026-08-06*
