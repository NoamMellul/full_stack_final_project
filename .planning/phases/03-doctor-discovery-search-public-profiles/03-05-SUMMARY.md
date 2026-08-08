---
phase: 03-doctor-discovery-search-public-profiles
plan: 05
subsystem: api
tags: [nextjs, supabase, postgrest, playwright, rtl, public-route, base-ui-select]

# Dependency graph
requires:
  - phase: 03-doctor-discovery-search-public-profiles (plan 01)
    provides: "doctor_search_view flat specialty_id/neighborhood/language_codes columns — the filter targets this plan predicates against"
  - phase: 03-doctor-discovery-search-public-profiles (plan 03)
    provides: "lib/validation/search.ts (PAGE_SIZE/MAX_PAGE/ParsedSearchParams/validateSearchParams/parseSearchParams), app/api/doctors/route.ts, app/search/page.tsx's updateQuery/useDebouncedValue, tests/e2e/search-filters.spec.ts fixtures/cleanup lifecycle — all extended, not replaced"
provides:
  - "lib/validation/search.ts extended: UUID_PATTERN, LANGUAGE_CODES, CALENDAR_DAY_PATTERN, ParsedSearchParams.{specialtyId,language,neighborhood,availableFrom,availableTo}"
  - "GET /api/doctors: AND-combined specialty/language/neighborhood predicates plus a dedicated availability_slots pre-query for the date-range filter"
  - "components/search/search-filters.tsx (SearchFilters) — the filter panel wired into /search"
  - "tests/e2e/search-filters.spec.ts extended to 16 tests total"
affects: [03-06]

# Actuals (#2632)
actuals:
  tokens: 8400
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Availability-range filter implemented as a dedicated availability_slots pre-query (status=available, start_at>now, optional gte/lte via jerusalemBoundaryToUtcIso) reduced to a de-duplicated doctor_id list and applied via .in(\"id\", ...) — never a range filter on the view's next_available_at column (RESEARCH.md Pattern 2 / Pitfall 3)"
    - "Base UI Select requires an `items` value→label map passed to <Select items={...}> for <Select.Value> to resolve a label from a URL-derived initial value on first render — without it, a page loaded directly on a filtered URL shows the raw id/code in the trigger until the popup has been opened once"

key-files:
  created:
    - components/search/search-filters.tsx
  modified:
    - lib/validation/search.ts
    - app/api/doctors/route.ts
    - app/search/page.tsx
    - tests/e2e/search-filters.spec.ts

key-decisions:
  - "Confirmed .contains(\"language_codes\", [code]) filters correctly against the view's text[] column when queried live against seeded multi-language doctors — RESEARCH.md Assumption A2 resolved with no fallback needed"
  - "Empty availability pre-query match list short-circuits to an explicit { doctors: [], total: 0 } response before the view query ever runs (T-03-13) — the acceptance criterion this closes: a past date range returns an explicit empty page, never an unfiltered fallback"
  - "next_available_at appears only as the .order() sort key in app/api/doctors/route.ts; every predicate (.eq/.gte/.lte/.gt/.lt) targets a different column, closing RESEARCH.md Pitfall 3 by construction, not just by test"
  - "Select `items` maps (specialtyItems/neighborhoodItems/LANGUAGE_ITEMS) added to each filter Select after a live reload test caught the trigger displaying the raw id instead of its label (Rule 1 bug, found during Task 3's own verification, not a pre-existing defect)"
  - "The filter panel has no per-field \"clear to unset\" control inside each Select (mirrors the existing app/admin/appointments/page.tsx precedent, which also has no per-field reset) — only the single bulk \"Clear filters\" button and direct URL/query-param changes remove one filter at a time; the combination test proves the latter path"
  - "Quick-select date range uses UTC-part day arithmetic (Date.UTC on parsed YYYY-MM-DD components) rather than a naive Date-object add, so adding days never drifts across a DST boundary"

patterns-established:
  - "Structured list-page filters: option lists loaded once via the browser client into a dedicated filter-panel component, values read from the URL and written back through a single onFilterChange(next) callback the page already owns (updateQuery) — no new state-management pattern introduced beyond what 03-03 established"

requirements-completed: [SEARCH-02, SEARCH-03, SEARCH-04, SEARCH-05, SEARCH-06]

coverage:
  - id: D1
    description: "Selecting a specialty narrows results to doctors whose specialty_id equals the selected id; absent/empty applies no filter; a well-formed but unmatched id yields an empty result set, not an error (SEARCH-02)"
    requirement: "SEARCH-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/search-filters.spec.ts#filter: selecting the fixture specialty shows only the two doctors carrying it, and the URL gains a specialty parameter"
        status: pass
      - kind: manual_procedural
        ref: "curl .../api/doctors?specialty=00000000-0000-0000-0000-000000000000 -> 200, total:0; curl .../api/doctors?specialty=abc -> 400"
        status: pass
    human_judgment: false
  - id: D2
    description: "Selecting a spoken language narrows to doctors whose language_codes array contains that code; only he/en accepted, anything else rejected with 400"
    requirement: "SEARCH-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/search-filters.spec.ts#filter: selecting Hebrew shows the Hebrew-only doctor and hides the English-only one, and selecting English does the inverse"
        status: pass
      - kind: manual_procedural
        ref: "curl .../api/doctors?language=fr -> 400; curl .../api/doctors?language=he -> 200"
        status: pass
    human_judgment: false
  - id: D3
    description: "Selecting a neighborhood narrows by exact string equality; absent/empty applies no filter"
    requirement: "SEARCH-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/search-filters.spec.ts#filter: selecting the fixture neighborhood narrows to the doctors in it"
        status: pass
    human_judgment: false
  - id: D4
    description: "A doctor matches the availability filter when they hold at least one slot inside the range, in the future, status=available — not computed from next_available_at; a doctor whose earliest slot is outside the range but who has a later slot inside it is still returned"
    requirement: "SEARCH-05"
    verification:
      - kind: e2e
        ref: "tests/e2e/search-filters.spec.ts#availability: with a range covering only day 17 through day 19, the two-slot doctor is still returned even though the doctor's earliest slot is 2 days out and therefore outside the range"
        status: pass
      - kind: unit
        ref: "grep confirms next_available_at appears only as the .order() column argument in app/api/doctors/route.ts — no .gte/.lte/.gt/.lt/.eq call targets it"
        status: pass
    human_judgment: false
  - id: D5
    description: "With no availability range selected, every active doctor is eligible regardless of slots — opt-in filter, no default range on load"
    requirement: "SEARCH-05"
    verification:
      - kind: e2e
        ref: "tests/e2e/search-filters.spec.ts#filter: opening /search with no query string shows every filter control in its unset state"
        status: pass
    human_judgment: false
  - id: D6
    description: "Today/Next 7 days/Next 30 days quick-selects resolve to [now, end-of-day N] in Asia/Jerusalem; clicking Today sets both date inputs to the same day, marks the chip selected, and reflects both values in the URL"
    requirement: "SEARCH-05"
    verification:
      - kind: e2e
        ref: "tests/e2e/search-filters.spec.ts#availability: clicking Today sets both date inputs to the same Israeli calendar day, marks the chip selected, and puts both values in the URL"
        status: pass
    human_judgment: false
  - id: D7
    description: "A malformed availableFrom/availableTo (not YYYY-MM-DD or not a real calendar date) is rejected with 'Dates must be in YYYY-MM-DD format.'; an end date before the start date is rejected with 'The end date must be on or after the start date.'"
    requirement: "SEARCH-05"
    verification:
      - kind: manual_procedural
        ref: "curl .../api/doctors?availableFrom=2026-13-01 -> 400; curl .../api/doctors?availableFrom=2026-09-10&availableTo=2026-09-01 -> 400"
        status: pass
    human_judgment: false
  - id: D8
    description: "An availability range matching no doctor short-circuits to an explicit empty page (total 0, doctors []) rather than an unfiltered fallback (T-03-13)"
    requirement: "SEARCH-05"
    verification:
      - kind: manual_procedural
        ref: "curl .../api/doctors?availableFrom=2000-01-01&availableTo=2000-01-02 -> 200, {doctors:[],total:0}"
        status: pass
    human_judgment: false
  - id: D9
    description: "All active filters (specialty, language, neighborhood, name, availability) combine with AND; removing any single filter can only widen the result set"
    requirement: "SEARCH-06"
    verification:
      - kind: e2e
        ref: "tests/e2e/search-filters.spec.ts#combination: applying specialty plus language plus name together returns only the doctor satisfying all three, and clearing the language filter widens the set"
        status: pass
    human_judgment: false
  - id: D10
    description: "Changing any filter resets the page parameter to 1"
    requirement: "SEARCH-06"
    verification:
      - kind: e2e
        ref: "tests/e2e/search-filters.spec.ts#filter: landing on a URL that already carries page=3, then changing the specialty filter, results in a URL whose page value is 1"
        status: pass
    human_judgment: false
  - id: D11
    description: "Every applied filter is reflected in the URL; reloading or sharing that URL reproduces the identical result set and filter-control state"
    requirement: "SEARCH-06"
    verification:
      - kind: e2e
        ref: "tests/e2e/search-filters.spec.ts#combination: reloading the page on a fully-filtered URL reproduces the same visible result set and the same populated filter controls"
        status: pass
    human_judgment: false

# Metrics
duration: 45min
completed: 2026-08-06
status: complete
---

# Phase 3 Plan 05: Structured Filters — Specialty, Language, Neighborhood, Availability Summary

**Four AND-combined structured filters added on top of the proven name-search path — specialty/language/neighborhood as direct predicates on `doctor_search_view`'s flattened columns, and availability as a dedicated `availability_slots` pre-query that answers "has any slot in range" rather than reusing the sort key — backed by a new `SearchFilters` panel and 9 additional Playwright tests (16 total, full 169-test suite green)**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-08-06 (session start, file reads)
- **Completed:** 2026-08-06T19:15:00+03:00
- **Tasks:** 3 (all auto)
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- Extended `lib/validation/search.ts`: `UUID_PATTERN`, `LANGUAGE_CODES = ["he","en"]`, a 120-char neighborhood bound, `CALENDAR_DAY_PATTERN` plus an `isValidCalendarDate` round-trip check (rejects `2026-13-01`/`2026-02-30`-shaped strings that match the regex but aren't real dates), and widened `ParsedSearchParams`/`validateSearchParams`/`parseSearchParams` to cover `specialtyId`, `language`, `neighborhood`, `availableFrom`, `availableTo`.
- Extended `app/api/doctors/route.ts`: inserted `.eq("specialty_id", ...)`, `.eq("neighborhood", ...)`, `.contains("language_codes", [...])` into the existing predicate chain (AND via Supabase-JS implicit chaining), and added a dedicated `availability_slots` pre-query (`status=available`, `start_at>now`, optional `gte`/`lte` via `jerusalemBoundaryToUtcIso`) reduced to a de-duplicated `doctor_id` list applied via `.in("id", ...)`; an empty match list short-circuits to an explicit empty page before the view query ever runs.
- Confirmed live against seeded data that `.contains()` on the view's `language_codes` `text[]` column filters correctly (RESEARCH.md Assumption A2) — no two-step fallback was needed.
- Built `components/search/search-filters.tsx` (`SearchFilters`): name input (state stays on the page, untouched), specialty/language/neighborhood `Select`s, `availableFrom`/`availableTo` date inputs, three quick-select chips (Today/Next 7 days/Next 30 days) computed via Asia/Jerusalem-anchored UTC-part day arithmetic, and a bulk "Clear filters" button — every field starts unset, matching D-07.
- Wired `SearchFilters` into `app/search/page.tsx` above `SearchResults`, removing the tracer's inline name input; `updateQuery`'s existing page-reset-to-1 behavior is reused unchanged.
- Extended `tests/e2e/search-filters.spec.ts` from 7 to 16 tests: specialty/language/neighborhood filters, the RESEARCH.md Pitfall 3 proof (a doctor whose earliest slot is outside the requested range but whose later slot is inside it is still returned), the Today quick-select, AND-combination with a partial-clear via direct URL navigation, reload/URL-share parity, page-reset-on-filter-change, and the fully-unset initial state.
- Ran the full Playwright suite (169/169 passed) confirming no regression across Phases 1-3.

## Task Commits

Each task was committed atomically:

1. **Task 1: Validate and apply the specialty, language and neighborhood filters** — `99f534a` (feat)
2. **Task 2: Availability date-range filter as a dedicated slot pre-query** — `84316e6` (feat)
3. **Task 3: Filter panel UI, URL persistence, and filter coverage in the spec** — `3b362f0` (feat)

**Plan metadata:** commit pending (this SUMMARY + STATE.md + ROADMAP.md)

## Files Created/Modified
- `lib/validation/search.ts` - `UUID_PATTERN`, `LANGUAGE_CODES`, `CALENDAR_DAY_PATTERN`, `isValidCalendarDate`, `ParsedSearchParams` widened to all five new filter fields
- `app/api/doctors/route.ts` - specialty/language/neighborhood predicates, availability pre-query with empty-match short circuit
- `app/search/page.tsx` - `SearchFilters` wired above `SearchResults`, inline name input removed
- `components/search/search-filters.tsx` - new filter panel component (`SearchFilters`)
- `tests/e2e/search-filters.spec.ts` - extended to 16 tests total (9 new)

## `.contains()` Live-Verification Result (RESEARCH.md Assumption A2)

`.contains("language_codes", [language])` filters correctly against `doctor_search_view`'s `text[]` column when queried live: `curl "http://localhost:3000/api/doctors?language=he"` against 12 seeded demo doctors returned exactly the 8 doctors whose `language_codes` array actually contains `"he"`, with zero false positives. **No fallback to the documented two-step `.in("id", ids)` alternative was needed.**

## Decisions Made
- Empty availability pre-query match list short-circuits to `{ doctors: [], total: 0 }` before the view query runs (T-03-13) — proven live via `curl .../api/doctors?availableFrom=2000-01-01&availableTo=2000-01-02` returning an explicit empty page rather than falling through to an unfiltered result.
- `next_available_at` is used only as the `.order()` sort key in `app/api/doctors/route.ts`; grepped every predicate line in the file to confirm no `.gte/.lte/.gt/.lt/.eq` call targets it, closing RESEARCH.md Pitfall 3 by construction.
- The filter panel has no per-field "clear to unset" affordance inside each `Select` (mirrors the existing `app/admin/appointments/page.tsx` precedent) — a user clears one filter at a time either through the bulk "Clear filters" button or by changing the URL; the combination test proves the latter path is a first-class, supported way to narrow/widen the result set (consistent with D-13).
- Quick-select date math uses `Date.UTC` on parsed `YYYY-MM-DD` components (never a naive `Date` object add), so day arithmetic can't drift across a DST boundary.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Base UI `Select` showed the raw filter value instead of its label after a page reload**
- **Found during:** Task 3 (`npx playwright test` — "combination: reloading the page on a fully-filtered URL..." failed)
- **Issue:** `<Select.Value>` (Base UI) only resolves a display label from a currently-mounted `<Select.Item>` or from an `items` map passed to `<Select.Root>`. On a fresh page load driven directly by a `?specialty=<uuid>` URL, the dropdown popup has never been opened, so no `Item` for that value has registered its label — the trigger rendered the raw UUID text (`"b4266ebc-c079-4d62-bef5-cef36fa61237"`) instead of the specialty name.
- **Fix:** Added `items` maps (`specialtyItems`, `neighborhoodItems`, and a static `LANGUAGE_ITEMS`) derived from the already-loaded option lists, passed to each `<Select items={...}>`. `Select.Value` now resolves the correct label on first render regardless of whether the popup has ever been opened.
- **Files modified:** `components/search/search-filters.tsx`
- **Verification:** Re-ran the reload test and the full spec file; all 16 tests pass, including the reload/URL-share parity assertion that caught the bug.
- **Committed in:** `3b362f0` (fixed before the Task 3 commit, not a follow-up)

---

**Total deviations:** 1 auto-fixed (1 bug, UI-only — no server/query-logic change)
**Impact on plan:** No scope creep; the fix is a correct usage of an existing dependency's documented API (`Select.Root`'s `items` prop), not a new pattern.

## Issues Encountered

None beyond the deviation above. The full Playwright suite (169 tests) took ~8.7 minutes running with `workers: 1` (project config) — no failures, no flakes on the pitfall/quick-select/reload assertions across the run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `GET /api/doctors` now supports the complete filter surface (name, specialty, language, neighborhood, availability range) with AND semantics, all URL-persisted; `SearchFilters` and the extended `ParsedSearchParams`/`validateSearchParams`/`parseSearchParams` are ready for plan 03-06 (pagination controls, sort finalization) to build on without modification to this plan's exports.
- No blockers. `components/search/search-results.tsx`'s pagination-controls placeholder (left by 03-03) is still the only remaining gap before 03-06.

---
*Phase: 03-doctor-discovery-search-public-profiles*
*Completed: 2026-08-06*

## Self-Check: PASSED

- FOUND: `lib/validation/search.ts`
- FOUND: `app/api/doctors/route.ts`
- FOUND: `app/search/page.tsx`
- FOUND: `components/search/search-filters.tsx`
- FOUND: `tests/e2e/search-filters.spec.ts`
- FOUND: `.planning/phases/03-doctor-discovery-search-public-profiles/03-05-SUMMARY.md`
- FOUND commit: `99f534a`
- FOUND commit: `84316e6`
- FOUND commit: `3b362f0`
