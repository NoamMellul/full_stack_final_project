---
phase: 03-doctor-discovery-search-public-profiles
plan: 07
subsystem: api
tags: [nextjs, route-handlers, playwright, search, validation, gap-closure]

requires:
  - phase: 03-doctor-discovery-search-public-profiles
    provides: "lib/validation/search.ts (ParsedSearchParams, parseSearchParams, LIKE_METACHARACTERS_RE) and app/api/doctors/route.ts's existing availability fail-closed short circuit, both shipped in 03-03/03-05"
provides:
  - "qMatchesNothing: boolean on ParsedSearchParams, set when a non-whitespace q strips to empty after LIKE-metacharacter removal"
  - "GET /api/doctors fail-closed short circuit on qMatchesNothing, returning the empty page before any database query"
  - "Two regression tests in tests/e2e/search-filters.spec.ts (API-level and browser-level) proven RED against the pre-fix code, GREEN after"
affects: [03-doctor-discovery-search-public-profiles, gsd-secure-phase]

actuals:
  tokens: 1572
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Fail-closed filter short circuit: an active filter that cannot match anything returns { doctors: [], total: 0 } before building the view query, rather than falling through unfiltered — now shared by both the availability filter (T-03-13, 03-05) and the name filter (T-03-16, this plan)"

key-files:
  created: []
  modified:
    - lib/validation/search.ts
    - app/api/doctors/route.ts
    - tests/e2e/search-filters.spec.ts

key-decisions:
  - "Took the short-circuit remedy over a sentinel non-matching ilike value (03-VERIFICATION.md's second offered option) — exact, free, and already the established pattern for the availability filter (T-03-13)"
  - "Authored both regression tests (API-level for Task 1's behavior, browser-level for Task 2's behavior) in a single edit and proved both RED together before applying the fix, then committed both tests plus the two-file fix in one atomic commit — see Deviations"

patterns-established:
  - "Fail-closed filter invariant recorded as a must_haves.prohibitions item so any filter added in a later phase is checked against it before shipping"

requirements-completed: [SEARCH-01, SEARCH-09]

coverage:
  - id: D1
    description: "GET /api/doctors?q=%25 (and _, *, \\, and any combination of only those characters) returns { doctors: [], total: 0 } instead of the unfiltered directory"
    requirement: "SEARCH-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/search-filters.spec.ts#name: a q consisting only of LIKE/PostgREST metacharacters matches nothing, never the unfiltered directory"
        status: pass
      - kind: other
        ref: "curl -s \"http://localhost:3000/api/doctors?q=%25\" -> {\"doctors\":[],\"total\":0,...}"
        status: pass
    human_judgment: false
  - id: D2
    description: "A patient navigating to /search?q=%25 sees the locked 'No doctors found' empty state with zero cards, not the full directory"
    requirement: "SEARCH-09"
    verification:
      - kind: e2e
        ref: "tests/e2e/search-filters.spec.ts#name: navigating to /search?q=%25 shows the locked empty state, not the unfiltered directory"
        status: pass
    human_judgment: false
  - id: D3
    description: "The whitespace/absent/partial-strip q cases and every previously-green test across the phase are unchanged"
    verification:
      - kind: e2e
        ref: "npx playwright test (full suite) -> 181 passed, 0 failed"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-08-08
status: complete
---

# Phase 3 Plan 07: Fail-closed wildcard-only name search Summary

**Widened `ParsedSearchParams` with a `qMatchesNothing` discriminator and a matching fail-closed short circuit in `GET /api/doctors`, so a name query that strips down to nothing (a lone `%`, `_`, `*`, `\`, or a combination of only those characters) returns the empty page instead of the full doctor directory — closing the single gap `03-VERIFICATION.md` recorded for Phase 3.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-08-08T18:35:00Z (approx.)
- **Completed:** 2026-08-08T18:59:25Z (commit `f77e940`)
- **Tasks:** 2 (Task 1 tracer+TDD, Task 2 verification-only)
- **Files modified:** 3

## Accomplishments
- `lib/validation/search.ts`: `ParsedSearchParams` gained one additive field, `qMatchesNothing: boolean`, set only when `rawQ` is non-null, its trimmed value is non-empty, and stripping `LIKE_METACHARACTERS_RE` leaves an empty string. `q` still stays `null` on that path, matching the type's existing seven fields byte-for-byte otherwise.
- `app/api/doctors/route.ts`: one early-return branch, placed after `parseSearchParams` and before `createClient()`, mirroring the existing availability-filter short circuit's shape (`{ doctors: [], total: 0, page, pageSize: PAGE_SIZE }`) and its inline comment convention. Zero new database round trips added.
- `tests/e2e/search-filters.spec.ts`: two new tests inside the existing `test.describe`, both titled to contain `name` (preserving the `03-VALIDATION.md` `-g "name"` grep mapping) — one API-level test iterating all four metacharacters plus the combined-metacharacter and mixed-term cases, one browser-level test asserting the locked SEARCH-09 empty state on `/search?q=%25`.
- Full 181-test Playwright suite (all Phase 1/2/3 specs) confirmed green after the fix — zero regressions.

## Task Commits

Both tasks landed in a single commit because the two regression tests share one RED-before-fix proof cycle (see Deviations below for why).

1. **Task 1 + Task 2 (combined): Fail-closed short circuit + both regression tests** - `f77e940` (fix)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP/REQUIREMENTS update)

## Files Created/Modified
- `lib/validation/search.ts` - `qMatchesNothing: boolean` added to `ParsedSearchParams`; `parseSearchParams` sets it on the one empty-after-strip path
- `app/api/doctors/route.ts` - fail-closed short circuit on `qMatchesNothing`, returning the empty page before the view query is built
- `tests/e2e/search-filters.spec.ts` - two new `test(...)` cases: the API-level metacharacter sweep and the browser-level `/search?q=%25` empty-state check

## Red Test Run (captured before the fix)

```
npx playwright test tests/e2e/search-filters.spec.ts -g "name"
...
✘ name: a q consisting only of LIKE/PostgREST metacharacters matches nothing, never the unfiltered directory
  Error: expect(received).toBe(expected)
  Expected: 0
  Received: 29
    at .../search-filters.spec.ts:361:26  (expect(body.total).toBe(0))

✘ name: navigating to /search?q=%25 shows the locked empty state, not the unfiltered directory
  Error: expect(locator).toBeVisible() failed
  Locator: getByRole('heading', { name: 'No doctors found' })
  Timeout: 5000ms — element(s) not found

  16 passed, 2 failed
```

After the two-file fix landed, the same command reported all 18 tests passing.

## `ParsedSearchParams` final shape

```ts
export type ParsedSearchParams = {
  q: string | null;
  specialtyId: string | null;
  language: string | null;
  neighborhood: string | null;
  availableFrom: string | null;
  availableTo: string | null;
  page: number;
  qMatchesNothing: boolean; // new field, this plan
};
```

## Before/after `GET /api/doctors?q=%25`

| | `total` | `doctors.length` |
|---|---|---|
| Before (unmodified code) | 29 (full unfiltered directory in the shared remote dataset at test time) | 6 (page 1 of the unfiltered set) |
| After (this plan) | 0 | 0 |

Non-vacuity baseline preserved: `GET /api/doctors` (no query string) returns `total: 12` against the seeded demo dataset; `GET /api/doctors?q=%20%20` (whitespace-only) also returns `total: 12` — both unchanged by this fix.

## Decisions Made
- Took the short-circuit remedy (matching the existing availability-filter pattern, T-03-13) over a sentinel non-matching `ilike` value — exact, zero extra DB round trips, and already established in the same route. Recorded in `03-07-PLAN.md`'s Planner Assumptions as the resolved choice between the two remedies `03-VERIFICATION.md` offered.
- Wrote and RED-proved both the API-level test (Task 1's behavior) and the browser-level test (Task 2's behavior) in one edit, since they exercise the same underlying defect and the fix that turns both green is a single two-file change. See Deviations for why this collapsed the two-task commit boundary into one.

## Deviations from Plan

### Auto-fixed Issues

**1. [Process deviation — not a Rule 1-4 case] Task 1 and Task 2 tests were authored and committed together**
- **Found during:** Task 1 (tracer slice)
- **Issue:** The plan splits the regression coverage across two tasks — Task 1's `<behavior>` block lists only API-level (`curl`/`request.get`) assertions, and Task 2 separately calls for the browser-level `/search?q=%25` empty-state test plus the full-suite non-regression run. Both tests assert the identical underlying defect (the wildcard-only `q` short circuit) and both had to be observed RED against the same unmodified source before the same two-file fix would turn them GREEN.
- **Resolution:** Wrote both tests in a single edit to `tests/e2e/search-filters.spec.ts`, ran `-g "name"` once to capture both RED failures in the same run (see Red Test Run above), then applied the `lib/validation/search.ts` / `app/api/doctors/route.ts` fix and committed the test additions plus the fix together in one commit (`f77e940`). This does not violate the plan's TDD requirement — both tests were genuinely observed red before the fix landed — but it does mean Task 2 had no separate task-scoped commit; Task 2's remaining work (full 181-test suite run, `-g` grep-map check across all six filters, `npm run build`, `npx tsc --noEmit`, `npm run lint`) was pure verification against already-committed code, so no second commit was made.
- **Files modified:** `tests/e2e/search-filters.spec.ts` (both tests), `lib/validation/search.ts`, `app/api/doctors/route.ts`
- **Verification:** Full 181-test suite green (`181 passed (12.9m)`), all six `-g` filters (`name`, `no results`, `sort`, `filter`, `availability`, `combination`) each selected and passed at least one test, `npm run build` succeeded with `/search` prerendered (`○`), `npx tsc --noEmit` and `npm run lint` both clean.
- **Committed in:** `f77e940`

---

**Total deviations:** 1 process deviation (task-boundary merge, not a Rule 1-4 auto-fix). No scope creep — the merge affected only which commit the tests landed in, not what was built or tested.

## Issues Encountered
None — the fix worked as designed on the first pass; no debugging iterations were needed beyond the initial RED confirmation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The single gap `03-VERIFICATION.md` recorded for Phase 3 is closed: `GET /api/doctors?q=%25` now returns `{ doctors: [], total: 0 }`, matching the locked SEARCH-01/T-03-01 must-have. Both filters in `GET /api/doctors` (availability and name) now share the same fail-closed invariant. `03-VERIFICATION.md`'s behavioral spot-check row "Wildcard-only search does not fall back to 'match everyone'" can be re-run and passes. No blockers for Phase 3 sign-off or Phase 4 start.

---
*Phase: 03-doctor-discovery-search-public-profiles*
*Completed: 2026-08-08*

## Self-Check: PASSED

- FOUND: lib/validation/search.ts
- FOUND: app/api/doctors/route.ts
- FOUND: tests/e2e/search-filters.spec.ts
- FOUND: .planning/phases/03-doctor-discovery-search-public-profiles/03-07-SUMMARY.md
- FOUND commit: f77e940
- FOUND commit: 19e9af9
