---
phase: quick-260817-lar
plan: 01
subsystem: admin-ui
tags: [nextjs, route-handlers, supabase, pagination, playwright]

requires:
  - phase: 03-search-discovery
    provides: PAGE_SIZE/MAX_PAGE pagination pattern in lib/validation/search.ts and the search-results.tsx condensed-pagination nav this plan extracted
provides:
  - lib/validation/pagination.ts (ADMIN_PAGE_SIZE=25, MAX_ADMIN_PAGE=1000, validateAdminPageParam, parseAdminPageParam)
  - components/pagination-nav.tsx (single shared condensed-pagination component, labels-as-props)
  - paginated GET /api/admin/doctors and GET /api/admin/users (opt-in via ?page=N, unparameterized mode unchanged)
  - OversightTable opt-in pagination mode (pageSize/paginationNavLabel props)
affects: [admin-oversight, admin-doctor-crud, search]

actuals:
  tokens: 10800
  tasks: 6
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Admin list pagination is opt-in per request (page param absent = full unpaginated list, present = 25-row page + total) — mirrors and diverges deliberately from the /search PAGE_SIZE pattern"
    - "Single condensed-pagination component (components/pagination-nav.tsx) consumed by /search (translated labels) and both admin tables (English literals), replacing the prior single copy embedded in search-results.tsx"

key-files:
  created:
    - lib/validation/pagination.ts
    - components/pagination-nav.tsx
    - tests/e2e/admin-pagination.spec.ts
  modified:
    - app/api/admin/doctors/route.ts
    - app/api/admin/users/route.ts
    - components/search/search-results.tsx
    - components/admin/doctors-page-client.tsx
    - components/admin/oversight-table.tsx
    - app/admin/users/page.tsx
    - tests/e2e/admin-doctor-crud.spec.ts

key-decisions:
  - "D-LAR-01: page number only travels client->server; ADMIN_PAGE_SIZE (25) is a server-side constant, never accepted as a request param"
  - "D-LAR-02: admin page size is 25 (denser than /search's 6, since these are data tables not cards)"
  - "D-LAR-03: pagination is opt-in per request — an unparameterized GET still returns every row, preserving /admin/appointments' doctor-filter dropdown's need for the full catalog"
  - "D-LAR-04: admin table page number lives in component state, not the URL (admin tables are not shared/bookmarked links, unlike /search)"
  - "D-LAR-05: extracted the one condensed-pagination algorithm into components/pagination-nav.tsx instead of copying it into two admin clients"
  - "GET /api/admin/{doctors,users}' PGRST103 (offset-past-last-row) branch returns the REAL total via a head-only count, improving on GET /api/doctors' equivalent branch which returns a fabricated total:0 (recorded open warning, STATE.md Phase 3 WR-02) — divergence noted in code comments"

requirements-completed: [LAR-01, LAR-02, LAR-03, LAR-04, LAR-05, LAR-06]

coverage:
  - id: D1
    description: "GET /api/admin/doctors accepts an optional page param; paginated mode returns {doctors,total,page,pageSize}, unparameterized mode returns every row plus total and no page/pageSize keys; invalid page values (0, non-numeric, >1000) return 400"
    requirement: LAR-01
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-pagination.spec.ts#endpoint contract: GET /api/admin/doctors"
        status: pass
    human_judgment: false
  - id: D2
    description: "GET /api/admin/users behaves identically to D1 for profiles"
    requirement: LAR-02
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-pagination.spec.ts#endpoint contract: GET /api/admin/users"
        status: pass
    human_judgment: false
  - id: D3
    description: "An unparameterized GET /api/admin/doctors still returns every doctor row, so the /admin/appointments doctor-filter dropdown keeps listing the full catalog — proven with a dedicated regression pin, not by inspection"
    requirement: LAR-03
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-pagination.spec.ts#regression pin: /admin/appointments doctor filter keeps listing the full catalog"
        status: pass
    human_judgment: false
  - id: D4
    description: "/admin/doctors renders at most 25 rows with a working 'Doctors pagination' nav (Prev/Next, accurate count caption); create returns to page 1, edit/link-account stay on the current page"
    requirement: LAR-04
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-pagination.spec.ts#UI: /admin/doctors"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-doctor-status.spec.ts, tests/e2e/admin-doctor-link-account.spec.ts (full suites)"
        status: pass
    human_judgment: false
  - id: D5
    description: "/admin/users renders at most 25 rows via OversightTable's opt-in paginated mode with the same nav pattern; /admin/appointments (which does not opt in) is behaviourally unchanged"
    requirement: LAR-05
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-pagination.spec.ts#UI: /admin/users"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-oversight-views.spec.ts (full suite, 11/11)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Exactly one condensed-pagination implementation exists in the repo (components/pagination-nav.tsx), consumed by /search with zero behaviour change"
    requirement: LAR-06
    verification:
      - kind: e2e
        ref: "tests/e2e/search-sort-pagination.spec.ts (full suite, 10/10)"
        status: pass
    human_judgment: false

duration: 60min
completed: 2026-08-17
status: complete
---

# Quick Task 260817-lar: Admin list pagination Summary

**Page-based pagination for /admin/doctors and /admin/users (25 rows/page) via a shared PaginationNav component extracted from /search, with an opt-in-per-request contract on both admin GET endpoints so the /admin/appointments doctor-filter dropdown keeps seeing the full catalog.**

## Performance

- **Duration:** ~60 min (context gathering + 6 tasks + full verification)
- **Completed:** 2026-08-17
- **Tasks:** 6/6
- **Files modified:** 10 (3 created, 7 modified)

## Accomplishments

- `lib/validation/pagination.ts`: `ADMIN_PAGE_SIZE=25`, `MAX_ADMIN_PAGE=1000`, `validateAdminPageParam`/`parseAdminPageParam` — server-side-only page size, page param is the sole client input
- `GET /api/admin/doctors` and `GET /api/admin/users` both accept an optional `page` param: absent = full unpaginated list + `total` (unchanged consumer contract for `/admin/appointments`' doctor dropdown), present = `{rows, total, page, pageSize}` 25-row page; invalid page values return 400
- Both routes' PGRST103 (offset-past-last-row) branch now returns the real total via a head-only count instead of a fabricated `total: 0` — a deliberate improvement over the existing `/api/doctors` pattern (STATE.md Phase 3 WR-02), noted in code comments
- `components/pagination-nav.tsx`: the single condensed-pagination implementation in the codebase, extracted verbatim from `search-results.tsx` with labels passed as props (no `useT`/dictionary import) so admin surfaces stay English-only while `/search` stays translated
- `/admin/doctors` (`doctors-page-client.tsx`) wired to the paginated endpoint: page/total/in-flight state, create returns to page 1 (new doctors sort to the top), edit/link-account stay on the current page, count caption reads the true total
- `OversightTable` gained an opt-in paginated mode (`pageSize`/`paginationNavLabel` props); `/admin/users` opts in, `/admin/appointments` does not and is untouched
- New `tests/e2e/admin-pagination.spec.ts` (13 tests): endpoint contract for both routes (paginated shape, unparameterized totality, disjoint consecutive pages, 400 on invalid page, 403 for a patient session), UI pagination on both admin tables, and a regression pin proving the doctor-filter dropdown still lists a doctor that would fall off page 1 under default pagination
- Repaired two pre-existing Playwright stubs in `admin-doctor-crud.spec.ts` broken by this change (Playwright glob `"**/api/admin/doctors"` no longer matches a URL carrying `?page=N` since `?` is a glob wildcard, not a literal) — replaced with a path-anchored regex

## Task Commits

Each task was committed atomically:

1. **Task 1: page-param validation module + paginated GET /api/admin/doctors** - `979e22c` (feat)
2. **Task 2: paginated GET /api/admin/users** - `5b3ffc7` (feat)
3. **Task 3: extract the shared PaginationNav component** - `e0a4923` (refactor)
4. **Task 4: paginate the /admin/doctors table** - `bfa83c4` (feat)
5. **Task 5: paginate /admin/users through an opt-in OversightTable mode** - `160fab8` (feat)
6. **Task 6: Playwright coverage for the new controls and the doctor-filter regression** - `c7a81a6` (test)

_Docs/state commit handled separately by the orchestrator per the execution contract._

## Files Created/Modified

- `lib/validation/pagination.ts` - `ADMIN_PAGE_SIZE`/`MAX_ADMIN_PAGE` constants + `validateAdminPageParam`/`parseAdminPageParam`
- `components/pagination-nav.tsx` - shared condensed-pagination component (`buildPageItems` + nav markup, labels as props)
- `app/api/admin/doctors/route.ts` - GET handler paginated (opt-in), PGRST103 branch returns real total
- `app/api/admin/users/route.ts` - same treatment for profiles
- `components/search/search-results.tsx` - renders `PaginationNav` instead of inline nav; `buildPageItems` and the three lucide icon imports removed
- `components/admin/doctors-page-client.tsx` - page/total/in-flight state, `loadDoctors(targetPage)`, `PaginationNav` below the table
- `components/admin/oversight-table.tsx` - opt-in `pageSize`/`paginationNavLabel` props, paginated `load(targetPage)`
- `app/admin/users/page.tsx` - passes `pageSize={ADMIN_PAGE_SIZE}` and `paginationNavLabel="Users pagination"`
- `tests/e2e/admin-pagination.spec.ts` - new spec (13 tests)
- `tests/e2e/admin-doctor-crud.spec.ts` - two stale glob stubs repaired to a path-anchored regex

## Decisions Made

See `key-decisions` in frontmatter (D-LAR-01 through D-LAR-05, plus the PGRST103 real-total divergence). All decisions were locked in the plan before execution; none were re-litigated during the session.

## Deviations from Plan

None — plan executed exactly as written. The two `admin-doctor-crud.spec.ts` stub breakages predicted by the plan's own Task 6 description occurred exactly as described (confirmed by an intermediate isolated run after Task 4, before the Task 6 repair) and were fixed by Task 6 as planned, not as an unplanned deviation.

## Issues Encountered

None. One transient dev-server startup failure during a Playwright run (`UNKNOWN: unknown error, open '.next/dev/types/validator.ts'`, a Windows file-lock flake) resolved on retry with no code involved.

## User Setup Required

None - no external service configuration required.

## Verification Summary

- `npx tsc --noEmit` — clean
- `npx eslint .` — clean (full repo)
- Full targeted Playwright run across all five affected spec files plus the new spec: `admin-oversight-views.spec.ts`, `admin-doctor-crud.spec.ts`, `admin-doctor-status.spec.ts`, `admin-doctor-link-account.spec.ts`, `search-sort-pagination.spec.ts`, `admin-pagination.spec.ts` — **65/65 passed** (single combined run, ~6.4 min)
- Confirmed zero residual fixture rows in `doctors` after the pagination spec's bulk-insert fixture (26 rows) via a direct admin-client query for the run's name token

## Next Phase Readiness

- Both admin list surfaces now scale to a realistic production catalog; no further pagination work outstanding for this milestone
- `components/pagination-nav.tsx` is available for any future paginated list surface without re-implementing the condensed algorithm
- No blockers introduced; the pre-existing shared-dev-DB test-residue flakiness class (STATE.md/WINDOWS.md, tracked since Phase 06 Plan 01) was not encountered in this session's runs

## Self-Check: PASSED

All 10 created/modified source and test files verified present on disk; all 6 task commit hashes (979e22c, 5b3ffc7, e0a4923, bfa83c4, 160fab8, c7a81a6) verified present in `git log`.

---
*Quick task: 260817-lar*
*Completed: 2026-08-17*
