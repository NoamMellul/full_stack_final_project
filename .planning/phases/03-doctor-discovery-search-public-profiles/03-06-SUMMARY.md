---
phase: 03-doctor-discovery-search-public-profiles
plan: 06
subsystem: ui
tags: [nextjs, playwright, pagination, postgrest, base-ui-button, lucide-react]

# Dependency graph
requires:
  - phase: 03-doctor-discovery-search-public-profiles (plan 03)
    provides: "app/search/page.tsx's updateQuery/D-14 reset-on-filter-change rule, listStatus machine, lib/validation/search.ts PAGE_SIZE/MAX_PAGE"
  - phase: 03-doctor-discovery-search-public-profiles (plan 05)
    provides: "components/search/search-results.tsx's four-branch render switch with the pagination-controls placeholder left below the grid; app/api/doctors/route.ts's AND-combined filter chain and next_available_at/id sort"
provides:
  - "components/search/search-results.tsx: page/onPageChange props, numbered pagination nav with ellipsis condensation beyond 7 pages, total-count caption"
  - "app/search/page.tsx: page read from the URL, onPageChange wired to updateQuery({ page }) (bypasses D-14 reset), scroll-to-top on page-change resolution"
  - "app/api/doctors/route.ts: PGRST103 (416 range-not-satisfiable) now short-circuits to an explicit empty page instead of a 500"
  - "tests/e2e/search-sort-pagination.spec.ts — 10 tests proving pagination correctness and cross-page sort stability"
affects: []

# Actuals (#2632)
actuals:
  tokens: 5100
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "44px hit-area on icon-only Prev/Next controls via the existing Phase 2 precedent (`className=\"relative after:absolute after:-inset-2\"` on an icon-sm Button), not a new spacing utility"
    - "Condensed numbered pagination built as a pure buildPageItems(page, pageCount) helper returning (number | \"ellipsis\")[] — first page, last page, current page +/-1 neighbour, single ellipsis per gap spanning more than one number"
    - "A page-change scroll-to-top is gated by a scrollOnNextReadyRef flag set only inside handlePageChange, so the same listStatus-driven skeleton/ready cycle that already re-renders on every searchParams change does not also scroll on filter changes or the initial mount"

key-files:
  created:
    - tests/e2e/search-sort-pagination.spec.ts
  modified:
    - components/search/search-results.tsx
    - app/search/page.tsx
    - app/api/doctors/route.ts

key-decisions:
  - "pageCount computed client-side from total via the imported PAGE_SIZE constant (Math.max(1, Math.ceil(total / PAGE_SIZE))) — never accepted as a prop, so a client-supplied page size can never reach the query (T-03-04)"
  - "Active page number uses a separate JSX branch (variant=\"default\" with a literal aria-current=\"page\") rather than a ternary-computed prop, so the attribute is unconditionally present in source for grep-based verification and unambiguous for screen readers"
  - "Prev/Next scroll-to-top implemented via a ref flag (scrollOnNextReadyRef) set only in handlePageChange and consumed in a listStatus effect — filter changes and the initial mount reuse the identical loading/ready cycle without triggering a scroll"
  - "PGRST103 (PostgREST's 416 Range Not Satisfiable, raised when the requested offset exceeds the filtered result set) is now caught as a distinct case and mapped to { doctors: [], total: 0 } — every other query error still falls through to the existing generic 500"

patterns-established:
  - "buildPageItems(page, pageCount) — reusable condensed-pagination-item builder, colocated with the component that renders it (no shared pagination utility module needed yet since this is the only paginated UI in the app)"

requirements-completed: [SEARCH-08, SEARCH-09]

coverage:
  - id: D1
    description: "Search results paginate at exactly 6 per page with numbered Prev/Next controls, a visible total count, and condensation beyond 7 pages that always keeps the first page, last page, Prev and Next reachable"
    requirement: "SEARCH-08"
    verification:
      - kind: e2e
        ref: "tests/e2e/search-sort-pagination.spec.ts#pagination: searching the shared token shows exactly 6 cards on page 1 and a total count of 44"
        status: pass
      - kind: e2e
        ref: "tests/e2e/search-sort-pagination.spec.ts#pagination: with 8 pages and the current page in the middle, the control condenses with an ellipsis on each side and marks the current page"
        status: pass
    human_judgment: false
  - id: D2
    description: "Prev is disabled on the first page, Next is disabled on the last page, and clicking Next/a page number navigates and updates the URL's page parameter"
    requirement: "SEARCH-08"
    verification:
      - kind: e2e
        ref: "tests/e2e/search-sort-pagination.spec.ts#pagination: the pagination nav renders with Prev disabled and Next enabled on page 1"
        status: pass
      - kind: e2e
        ref: "tests/e2e/search-sort-pagination.spec.ts#pagination: clicking Next moves to page 2 and enables Prev; the last page disables Next"
        status: pass
    human_judgment: false
  - id: D3
    description: "The current page lives in the URL and survives a reload; a result set of 6 or fewer doctors renders the count caption but no pagination nav"
    requirement: "SEARCH-08"
    verification:
      - kind: e2e
        ref: "tests/e2e/search-sort-pagination.spec.ts#pagination: reloading a deep-page URL renders the same six names it rendered before the reload"
        status: pass
      - kind: e2e
        ref: "tests/e2e/search-sort-pagination.spec.ts#pagination: a filter matching 6 or fewer doctors renders the count caption but no pagination nav"
        status: pass
    human_judgment: false
  - id: D4
    description: "Changing a filter while on a page other than 1 resets the URL's page parameter to 1 (D-14)"
    requirement: "SEARCH-08"
    verification:
      - kind: e2e
        ref: "tests/e2e/search-sort-pagination.spec.ts#pagination: changing the specialty filter while on page 4 resets the URL's page to 1 (D-14)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A full sweep of every page for one filter yields every matching doctor exactly once (no duplicate, no omission) — RESEARCH.md Common Pitfall 4"
    requirement: "SEARCH-08"
    verification:
      - kind: e2e
        ref: "tests/e2e/search-sort-pagination.spec.ts#pagination: sweeping every page from 1 to 8 with the same filter covers every fixture doctor exactly once, with no duplicate and no omission"
        status: pass
    human_judgment: false
  - id: D6
    description: "Cross-page order is soonest-availability-first with all null next_available_at values in a contiguous, id-ascending tail, and the same order is reproduced by a second independent page sweep"
    requirement: "SEARCH-08"
    verification:
      - kind: e2e
        ref: "tests/e2e/search-sort-pagination.spec.ts#sort: cross-page order is soonest-availability-first with a stable, ascending-by-id null tail across repeated sweeps"
        status: pass
    human_judgment: false
  - id: D7
    description: "Requesting a page beyond the last page of the current result set renders the 'No doctors found' empty state rather than a blank grid or a crash"
    requirement: "SEARCH-09"
    verification:
      - kind: e2e
        ref: "tests/e2e/search-sort-pagination.spec.ts#pagination: requesting page 99 for this filter renders the empty state, not a blank grid"
        status: pass
    human_judgment: false

# Metrics
duration: 50min
completed: 2026-08-06
status: complete
---

# Phase 3 Plan 06: Numbered Pagination and Cross-Page Sort Stability Summary

**Numbered pagination with ellipsis condensation added to `SearchResults`/`app/search/page.tsx`, plus a 10-test Playwright spec that bulk-inserts 44 doctors and proves an 8-page sweep loses nothing, duplicates nothing, and preserves the soonest-availability sort order across two independent request sweeps**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-08-06 (session start, file reads)
- **Completed:** 2026-08-06
- **Tasks:** 3 (all auto)
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- Extended `components/search/search-results.tsx` with `page`/`onPageChange` props, a `buildPageItems(page, pageCount)` helper implementing the standard condensed-pagination form (first, last, current ±1, one ellipsis per gap beyond 7 pages), and a `nav` with Prev/Next icon buttons (44px hit area via the existing Phase 2 `after:-inset-2` pattern) and numbered page buttons, the active one carrying a literal `aria-current="page"`.
- Wired pagination into `app/search/page.tsx`: `page` read straight from the URL, `handlePageChange` calling `updateQuery({ page: String(nextPage) })` (the one call site that intentionally bypasses 03-03's D-14 reset-to-1 behavior because the object it passes already carries a `page` key), and a `scrollOnNextReadyRef`-gated effect that scrolls the results region to the top only when a page navigation's fetch resolves — never on the initial mount or a filter change.
- Built `tests/e2e/search-sort-pagination.spec.ts`: a single bulk `insert` of 44 active doctors sharing one name token (so a name-filtered search yields exactly 8 pages at 6/page), with the first 20 given one future slot each at strictly increasing start times and the remaining 24 left with none — a known sort order plus a known no-availability tail. 10 tests cover page-1 count/caption, Prev/Next disabled states, ellipsis condensation with `aria-current`, click-through navigation and last-page Next-disable, reload/URL-share parity, a full 8-page sweep (44 unique ids, zero duplicates, full fixture coverage), cross-page sort-order stability across two independent sweeps (non-decreasing `next_available_at`, contiguous ascending-by-id null tail, identical concatenated order between sweeps), the page-beyond-range empty state, the ≤6-results no-nav case, and D-14's page-reset-on-filter-change.
- Ran the full Playwright suite (179/179 passed, ~10.2 min) confirming no regression across Phases 1-3, and reran the new spec a second consecutive time to confirm `test.afterAll` cleanup leaves no residue.

## Task Commits

Each task was committed atomically:

1. **Task 1: Numbered pagination controls and the total-count caption** — `1c516ca` (feat)
2. **Task 2: Wire pagination into the search page's URL state** — `96ea7a6` (feat)
3. **Task 3: Prove pagination correctness and cross-page sort stability** — `bd57485` (test, includes the Rule 1 route.ts fix below)

**Plan metadata:** commit pending (this SUMMARY + STATE.md + ROADMAP.md)

## Files Created/Modified
- `components/search/search-results.tsx` - `page`/`onPageChange` props, `buildPageItems` helper, pagination `nav` with Prev/Next and numbered page buttons
- `app/search/page.tsx` - `page` read from the URL, `handlePageChange` wired to `updateQuery`, scroll-to-top on page-change resolution
- `app/api/doctors/route.ts` - PGRST103 (416 range-not-satisfiable) now short-circuits to an explicit empty page instead of a 500
- `tests/e2e/search-sort-pagination.spec.ts` - new spec, 10 tests, 44-doctor bulk fixture with a known sort/no-availability shape

## Decisions Made
- `pageCount` is computed client-side from `total` via the imported `PAGE_SIZE` constant, never accepted as a prop — a client-supplied page size is exactly the parameter T-03-04 forbids.
- The active page number renders through a dedicated JSX branch (not a ternary-computed `aria-current` prop) so the literal `aria-current="page"` attribute is always present in source, unambiguous for both grep-based verification and screen readers.
- Page-change scroll-to-top uses a `scrollOnNextReadyRef` flag set only inside `handlePageChange` and consumed by a `listStatus`-watching effect — reusing the existing loading/ready cycle (every `searchParams` change already resets `listStatus` to `"loading"`, per 03-03) without also scrolling on filter changes or the initial mount.
- PGRST103 is caught as a distinct branch mapped to `{ doctors: [], total: 0 }`; every other query error still falls through to the pre-existing generic 500 response.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `GET /api/doctors` 500'd instead of returning an empty page for an out-of-range `page`**
- **Found during:** Task 3 (`npx playwright test tests/e2e/search-sort-pagination.spec.ts` — "requesting page 99 for this filter renders the empty state" failed)
- **Issue:** `app/api/doctors/route.ts`'s `.range(offset, offset + PAGE_SIZE - 1)` call, when `offset` exceeds the filtered result set's row count, causes PostgREST to return `416 Range Not Satisfiable` (error code `PGRST103`) instead of an empty array. The route's single generic `if (error)` branch mapped this to a 500 response, so a well-formed but out-of-range `page` (within `validateSearchParams`'s 1..`MAX_PAGE` bound, but beyond what the current filter now matches) crashed the search page's fetch instead of showing the "No doctors found" empty state SEARCH-09 requires.
- **Fix:** Added a dedicated `error.code === "PGRST103"` branch that returns `{ doctors: [], total: 0, page, pageSize: PAGE_SIZE }` before falling through to the generic 500 — mirroring the empty-page short-circuit pattern 03-05 already established for the availability-filter's no-match case.
- **Files modified:** `app/api/doctors/route.ts`
- **Verification:** Re-ran the full spec file (10/10 pass) and the full Playwright suite (179/179 pass); confirmed via a direct probe script that PostgREST's error shape for this case is stably `{ code: "PGRST103", status: 416 }`.
- **Committed in:** `bd57485` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug, pre-existing since plan 03-03/03-05 but only exercised by this plan's page-beyond-range test)
**Impact on plan:** No scope creep — the fix closes exactly the SEARCH-09 gap this plan's own must_haves and Task 3 test require; every other error path in the route is unchanged.

## Issues Encountered
None beyond the deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 3's full surface (multi-criteria search, filters, pagination, public doctor profiles) is now complete: `/search` supports name/specialty/language/neighborhood/availability filtering plus numbered, URL-persisted pagination with a proven sort/coverage contract, and `/doctors/[id]` (03-04) renders the public profile.
- Phase moves to goal-backward verification next, per this plan's note. No known blockers.
- `components/admin/oversight-table.tsx`'s count-caption convention was referenced but not reused verbatim — the search results caption keeps 03-03's original "{N} results" wording (already covered by existing filter-spec assertions) rather than adopting the admin table's noun-parameterized convention, since no plan step required changing that established text.

---
*Phase: 03-doctor-discovery-search-public-profiles*
*Completed: 2026-08-06*

## Self-Check: PASSED

- FOUND: `components/search/search-results.tsx`
- FOUND: `app/search/page.tsx`
- FOUND: `app/api/doctors/route.ts`
- FOUND: `tests/e2e/search-sort-pagination.spec.ts`
- FOUND: `.planning/phases/03-doctor-discovery-search-public-profiles/03-06-SUMMARY.md`
- FOUND commit: `1c516ca`
- FOUND commit: `96ea7a6`
- FOUND commit: `bd57485`
- FOUND commit: `72b6942`
