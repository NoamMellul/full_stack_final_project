---
phase: 03-doctor-discovery-search-public-profiles
plan: 03
subsystem: api
tags: [nextjs, supabase, postgrest, playwright, rtl, public-route]

# Dependency graph
requires:
  - phase: 03-doctor-discovery-search-public-profiles (plan 01)
    provides: "doctor_search_view (option-a locked column shape) — the single read surface this route queries"
  - phase: 03-doctor-discovery-search-public-profiles (plan 02)
    provides: "lib/timezone.ts (formatJerusalemDayHeading/formatJerusalemTime) and seeded demo availability_slots for next_available_at to be non-null on real doctors"
provides:
  - "GET /api/doctors — the first intentionally public/unauthenticated REST route in the codebase, no requireAdmin() guard"
  - "lib/validation/search.ts — PAGE_SIZE, MAX_PAGE, ParsedSearchParams, validateSearchParams, parseSearchParams (extended by 03-05/03-06, never redefined)"
  - "/search page — URL-persisted q param, debounced name input, loading/error/empty/populated state machine"
  - "components/search/doctor-card.tsx (DoctorCard, DoctorSearchResult type) and components/search/search-results.tsx (SearchResults) — shared by later plans in this phase"
  - "tests/e2e/search-filters.spec.ts — 7 anonymous-context tests covering SEARCH-01/07/08/09 including case-insensitivity, Hebrew-script matching, whitespace-trim, empty state, sort order and id tie-break determinism"
affects: [03-04, 03-05, 03-06]

# Actuals (#2632)
actuals:
  tokens: 5590
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "First public (unauthenticated) Route Handler in the codebase — anon-key session-bound Supabase client, no requireAdmin() guard, RLS + doctor_search_view's own is_active predicate are the sole authorization authority"
    - "URL-persisted filter/page state via useSearchParams + router.replace, wrapped in <Suspense> at the exported page component so the route still statically prerenders (mirrors app/login/page.tsx)"
    - "Base UI Button polymorphism via the render prop (<Button render={<Link href=... />}>) to compose a styled link, following the existing components/ui/dialog.tsx DialogPrimitive.Close pattern"

key-files:
  created:
    - lib/validation/search.ts
    - app/api/doctors/route.ts
    - app/search/page.tsx
    - components/search/doctor-card.tsx
    - components/search/search-results.tsx
    - tests/e2e/search-filters.spec.ts
  modified: []

key-decisions:
  - "parseSearchParams strips percent/underscore/asterisk/backslash from q (LIKE/PostgREST metacharacters) before building the ilike predicate — a lone % cannot match every row (T-03-01); confirmed via curl that q=%25 returns the same total as an unfiltered request"
  - "listStatus resets to \"loading\" on every searchParams change (not just the first mount), diverging from doctors-page-client.tsx's admin pattern, to satisfy this plan's backstop truth that every query change re-shows the 6-skeleton grid"
  - "DoctorSearchResult type is exported from components/search/doctor-card.tsx (not duplicated in app/search/page.tsx) so search-results.tsx and the page share one shape — 03-05/03-06 extend the fetch/filter logic against this same type"
  - "\"View profile\" action uses Button's render prop wrapping a next/link Link, not a plain styled <a>, keeping the accent-reserved primary Button styling consistent with the rest of the UI kit"

patterns-established:
  - "Public Route Handler convention: createClient() (anon/session-bound), no admin guard, defense-in-depth already lives in the view/table, never interpolate the raw Supabase error message into the client-facing error body"

requirements-completed: [SEARCH-01, SEARCH-07, SEARCH-08, SEARCH-09]

coverage:
  - id: D1
    description: "An anonymous visitor with no session opens /search and finds a matching doctor by typing a name fragment; case-insensitive Latin and Hebrew-script fragments both match; a lone LIKE wildcard is stripped rather than honored"
    requirement: "SEARCH-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/search-filters.spec.ts#anonymous visitor searches by name and sees matching doctors, not the control"
        status: pass
      - kind: e2e
        ref: "tests/e2e/search-filters.spec.ts#name: case-insensitive search matches a mixed-case stored name"
        status: pass
      - kind: e2e
        ref: "tests/e2e/search-filters.spec.ts#name: a Hebrew-script fragment matches the Hebrew-named doctor"
        status: pass
      - kind: e2e
        ref: "tests/e2e/search-filters.spec.ts#name: an absent or whitespace-only query applies no filter"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each result card shows the doctor's next available slot in Asia/Jerusalem time, or the 'No upcoming availability' badge when none exists; a doctor with no future slot still appears in results"
    requirement: "SEARCH-07"
    verification:
      - kind: e2e
        ref: "tests/e2e/search-filters.spec.ts#sort: soonest availability first, no-availability doctors last"
        status: pass
    human_judgment: false
  - id: D3
    description: "Results are ordered by soonest next-available-slot ascending, no-availability doctors last, with a deterministic id tie-break proven stable across repeated requests"
    requirement: "SEARCH-08"
    verification:
      - kind: e2e
        ref: "tests/e2e/search-filters.spec.ts#sort: soonest availability first, no-availability doctors last"
        status: pass
      - kind: e2e
        ref: "tests/e2e/search-filters.spec.ts#sort: tie-break by id is deterministic across repeated requests"
        status: pass
    human_judgment: false
  - id: D4
    description: "A zero-result search renders the locked 'No doctors found' / adjust-filters empty state, never a blank page"
    requirement: "SEARCH-09"
    verification:
      - kind: e2e
        ref: "tests/e2e/search-filters.spec.ts#no results: an unmatched search term shows the empty state"
        status: pass
    human_judgment: false
  - id: D5
    description: "GET /api/doctors is reachable and returns 200 with no session/cookie, page is bounded to PAGE_SIZE=6 via .range(), and an out-of-range/non-numeric page returns 400 before any query runs"
    requirement: "SEARCH-01"
    verification:
      - kind: manual_procedural
        ref: "curl http://localhost:3000/api/doctors (no cookie) -> 200; curl ...?page=0 -> 400; curl ...?page=abc -> 400; curl ...?page=1 total<=6 entries"
        status: pass
    human_judgment: false
  - id: D6
    description: "The loading, error, empty and populated states of the result grid are all reachable and visually distinct, matching the UI-SPEC Copywriting Contract verbatim"
    verification:
      - kind: unit
        ref: "grep -c for literal strings 'No doctors found', 'Could not load doctors. Please try again.', 'Retry' in search-results.tsx; 'No upcoming availability', 'Demo profile', 'View profile' in doctor-card.tsx — all present"
        status: pass
    human_judgment: true
    rationale: "The 6-skeleton loading state and the error+Retry state are not exercised by an automated Playwright assertion in this plan (no network-throttling harness was wired into the spec) — visual/manual confirmation recommended before UAT sign-off, though the literal strings and component structure are grep-proven present."

# Metrics
duration: 32min
completed: 2026-08-06
status: complete
---

# Phase 3 Plan 03: Tracer Slice — Public Doctor Search by Name Summary

**Public, unauthenticated `GET /api/doctors` querying `doctor_search_view` with validated pagination and LIKE-metacharacter-stripped name search, backing a `/search` page with debounced URL-persisted state and a four-state (loading/error/empty/populated) result grid — proven end to end by 7 anonymous-context Playwright tests including Hebrew-script matching and sort/tie-break determinism**

## Performance

- **Duration:** ~32 min
- **Started:** 2026-08-06T15:53:00+03:00 (session start, file reads)
- **Completed:** 2026-08-06T16:18:02+03:00
- **Tasks:** 3 (1 tracer, 2 auto)
- **Files modified:** 6 (all newly created)

## Accomplishments
- Built `lib/validation/search.ts`: `PAGE_SIZE`/`MAX_PAGE` server-side constants, `validateSearchParams` (rejects a malformed `page` with the exact locked message), `parseSearchParams` (trims `q`, strips LIKE/PostgREST metacharacters `% _ * \`, empty-after-strip collapses to `null` so whitespace never becomes a literal search term).
- Built `app/api/doctors/route.ts`, the first intentionally public Route Handler in the codebase — no `requireAdmin()` guard, `createClient()` (anon/session-bound), queries `doctor_search_view` with `.ilike/.order(next_available_at, nullsFirst:false)/.order(id)/.range()`, returns the UI-SPEC-locked 500 error string without interpolating the raw Supabase error.
- Built `app/search/page.tsx`: `Suspense`-wrapped Client Component (statically prerendered per `npm run build`'s `○` marker), `useDebouncedValue` (300ms) local hook, `updateQuery` helper implementing D-14's reset-page-to-1-on-filter-change rule, and a `listStatus` state machine that re-shows the loading skeleton on every query change (not just first mount) to satisfy this plan's backstop truth.
- Built `components/search/doctor-card.tsx` (`DoctorCard`, exported `DoctorSearchResult` type) and `components/search/search-results.tsx` (`SearchResults`) — photo/`InitialsAvatar` fallback with `onError` flip, truncated name, specialty/neighborhood/city, language badges, next-availability text or the locked "No upcoming availability" badge, "Demo profile" badge, a `Button render={<Link .../>}` "View profile" action with a 44px+ hit area; the grid renders exactly one of loading (6 `Skeleton`s)/error (+Retry)/empty (SEARCH-09 copy)/populated branches.
- Wrote and progressively extended `tests/e2e/search-filters.spec.ts` to 7 tests, all driving the default anonymous (no-login) Playwright context: end-to-end name search, case-insensitive matching, a Hebrew-script fragment match, whitespace/absent-query no-filter behavior, the empty-state copy, card-order sort assertion (2-day < 5-day < no-availability, badges asserted per card), and API-level tie-break determinism across two repeated requests.
- Ran the full Playwright suite (150/150 passed) confirming no regression across Phases 1-2 and the earlier Phase 3 plans.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end "search doctors by name" (tracer)** — `f6fd0d3` (feat)
2. **Task 2: Result card and result grid with all four render states** — `3d863cd` (feat)
3. **Task 3: Prove name-search edges, the empty state, and the sort contract** — `16dbaad` (test)

**Plan metadata:** commit pending (this SUMMARY + STATE.md + ROADMAP.md)

## Files Created/Modified
- `lib/validation/search.ts` - `PAGE_SIZE`, `MAX_PAGE`, `ParsedSearchParams`, `validateSearchParams`, `parseSearchParams`
- `app/api/doctors/route.ts` - public `GET /api/doctors` search/list endpoint over `doctor_search_view`
- `app/search/page.tsx` - `/search` page: `SearchPage`/`SearchPageInner`, `useDebouncedValue`, URL-persisted `q`, four-state result rendering
- `components/search/doctor-card.tsx` - `DoctorCard`, exported `DoctorSearchResult` type
- `components/search/search-results.tsx` - `SearchResults` (loading/error/empty/populated branches)
- `tests/e2e/search-filters.spec.ts` - 7-test anonymous-context spec (SEARCH-01/07/08/09 + encoding/sort/tie-break edges)

## Exported Shapes for Downstream Plans (03-05, 03-06)

**`ParsedSearchParams`** (`lib/validation/search.ts`) — extend, never redefine:
```typescript
export type ParsedSearchParams = { q: string | null; page: number };
```

**`DoctorSearchResult`** (`components/search/doctor-card.tsx`) — the shape both `search-results.tsx` and `app/search/page.tsx` import from this one file:
```typescript
export type DoctorSearchResult = {
  id: string;
  full_name: string;
  bio: string | null;
  photo_url: string | null;
  is_demo: boolean;
  specialty_id: string;
  specialty_name_en: string;
  specialty_name_he: string;
  location_id: string;
  city: string;
  neighborhood: string;
  language_codes: string[];
  next_available_at: string | null;
};
```

## Decisions Made
- `parseSearchParams` strips LIKE/PostgREST metacharacters (`%`, `_`, `*`, `\`) from `q` rather than escaping them — a doctor-name search has no legitimate use for any of them, and this keeps the predicate a plain substring match (T-03-01). Verified live: `curl "http://localhost:3000/api/doctors?q=%25"` returns the identical `total` as the unfiltered request.
- `listStatus` is reset to `"loading"` on every `searchParams` change (the fetch-effect sets it before calling `loadDoctors`), not only on first mount — diverges from `doctors-page-client.tsx`'s admin pattern (which only shows the skeleton once) to satisfy this plan's explicit backstop truth that every query change re-shows the 6-skeleton grid.
- `DoctorCard`'s "View profile" action uses Base UI's `Button` `render` prop wrapping a `next/link` `<Link>` (`<Button render={<Link href=... />}>`), following the same polymorphism pattern already used by `components/ui/dialog.tsx`'s `DialogPrimitive.Close render={<Button variant="outline" />}` — keeps the accent-reserved primary button styling rather than hand-rolling link classes.
- Both `useEffect`s that call `loadDoctors`/`updateQuery` wrap the call in a locally-defined async function (`runLoad`) rather than calling the async callback directly in the effect body — required to satisfy the `react-hooks/set-state-in-effect` lint rule, which flagged the more direct `void loadDoctors()` form.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] useEffect dependency array used `searchParams.toString()`, rejected by the strict react-hooks lint rule**
- **Found during:** Task 1 (`npm run lint`)
- **Issue:** `Expected the dependency list to be an array of simple expressions` — `searchParams.toString()` is a method call, not a simple member-access expression, and the project's stricter React Compiler ESLint rule rejects it. A second, related error (`react-hooks/set-state-in-effect`) flagged calling the async `loadDoctors()` directly in the effect body.
- **Fix:** Changed the `loadDoctors` `useCallback` dependency to the `searchParams` object itself (a simple expression, and a stable-enough identity check since Next.js only produces a new `ReadonlyURLSearchParams` instance when the query actually changes), and wrapped the effect's call to `loadDoctors()` in a locally-defined `async function runLoad() { await loadDoctors(); } void runLoad();`, mirroring the existing `initialLoad` pattern in `components/admin/doctors-page-client.tsx`.
- **Files modified:** `app/search/page.tsx`
- **Verification:** `npm run lint` reports zero errors; `npx tsc --noEmit` clean; the affected fetch-on-query-change behavior re-verified via the Playwright spec (all tests read the correctly filtered result set).
- **Committed in:** `f6fd0d3` (fixed before the Task 1 commit, not a follow-up)

---

**Total deviations:** 1 auto-fixed (1 bug, lint-only — no behavioral change)
**Impact on plan:** Cosmetic/lint-compliance fix only. No scope creep.

## Issues Encountered
- The first `npx playwright test tests/e2e/search-filters.spec.ts` run failed with the search page showing the pre-filter (unfiltered, 15-result) list instead of the searched result — traced to Turbopack's cold dev-server compile of `/search` and `/api/doctors` taking longer than the test's 5s assertion retry window on the very first request against a freshly started `webServer`. Re-ran against an already-warm dev server (confirmed correct behavior via a standalone Playwright script capturing the actual `/api/doctors?q=...` request/response) and the test passed consistently on every subsequent run, including the full 150-test suite. Not a code defect — a cold-start timing characteristic of this dev environment; no plan or code change made.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `GET /api/doctors`, `/search`, `DoctorCard`/`SearchResults`, and `lib/validation/search.ts`'s `ParsedSearchParams` are all live and proven end to end — plan 03-05 (specialty/language/neighborhood/availability filters) and 03-06 (pagination controls, sort finalization) extend this exact query path and these exact exported types rather than rebuilding them.
- The four-state result grid (loading/error/empty/populated) and its exact UI-SPEC copy are in place; later plans only need to add new filter inputs and pagination controls beneath the existing grid — the marked placeholder for pagination controls is already in `search-results.tsx`.
- No blockers. One open item (D6, loading/error visual states) is `human_judgment: true` — no automated network-throttling assertion exists in this plan's spec for those two branches, though every literal string is grep-proven present in the component source.

---
*Phase: 03-doctor-discovery-search-public-profiles*
*Completed: 2026-08-06*

## Self-Check: PASSED

- FOUND: `lib/validation/search.ts`
- FOUND: `app/api/doctors/route.ts`
- FOUND: `app/search/page.tsx`
- FOUND: `components/search/doctor-card.tsx`
- FOUND: `components/search/search-results.tsx`
- FOUND: `tests/e2e/search-filters.spec.ts`
- FOUND: `.planning/phases/03-doctor-discovery-search-public-profiles/03-03-SUMMARY.md`
- FOUND commit: `f6fd0d3`
- FOUND commit: `3d863cd`
- FOUND commit: `16dbaad`
