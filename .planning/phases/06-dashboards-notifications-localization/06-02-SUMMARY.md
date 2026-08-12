---
phase: 06-dashboards-notifications-localization
plan: 02
subsystem: api
tags: [favorites, rest, rls, playwright, rtl, shadcn]

# Dependency graph
requires:
  - phase: 06-dashboards-notifications-localization
    provides: "06-01's favorites/notifications fixture helpers and the test.fixme( placeholder specs this plan converts to test("
provides:
  - "lib/validation/favorites.ts — validateFavoriteInput(body: unknown): string | null"
  - "app/api/patient/favorites/route.ts — GET (own favorites, doctor embed via .in()), POST (idempotent add, 23505 -> 409)"
  - "app/api/patient/favorites/[id]/route.ts — DELETE by doctors.id, shared 404 across missing/foreign/malformed"
  - "components/favorite-toggle.tsx — shared FavoriteToggle client component, 3 call sites, optimistic UI, auth-on-click redirect"
  - "app/patient/favorites/page.tsx — /patient/favorites list page (loading/error/empty/populated)"
  - "D-01 second entry point wired into components/search/doctor-card.tsx via app/search/page.tsx and components/search/search-results.tsx"
affects: [06-03, 06-04, 06-05, 06-06, 06-07, 06-08, 06-09, 06-10]

# Actuals (#2632)
actuals:
  tokens: 8212
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-step read (favorites row ids -> .in() query against doctor_search_view) instead of a PostgREST embed across the view boundary, mirroring Phase 3 precedent"
    - "Route Handlers branch strictly on Postgres error.code (23505 for unique violation), never error.message"
    - "Shared 404 body across missing/already-deleted/foreign-patient/malformed-UUID DELETE cases so no response is an existence oracle for another patient's row"
    - "Each page independently re-fetches its own favorited-id set on mount (200/401/403 discriminator) instead of a shared client-side store or context, per D-01's per-page-load contract"
    - "FavoriteToggle syncs isFavorited from a late-resolving initialFavorited prop via a hasInteractedRef guard, so an async parent fetch resolving after first render doesn't clobber an in-flight optimistic click"

key-files:
  created:
    - lib/validation/favorites.ts
    - app/api/patient/favorites/route.ts
    - app/api/patient/favorites/[id]/route.ts
    - components/favorite-toggle.tsx
    - app/patient/favorites/page.tsx
  modified:
    - app/doctors/[id]/page.tsx
    - app/search/page.tsx
    - components/search/search-results.tsx
    - components/search/doctor-card.tsx
    - tests/e2e/patient-favorites.spec.ts

key-decisions:
  - "[id] in the DELETE route means doctors.id, not favorites.id — matches the toggle's by-doctor-id UX and avoids a lookup round trip; both ownership conditions (.eq(\"patient_id\"), .eq(\"doctor_id\")) live in the same delete WHERE clause"
  - "patient_id on POST is always taken from guard.userId, never from the request body — closes T-06-04 even though favorites_all_own RLS would also reject a foreign write"
  - "A deactivated doctor's favorites row is returned with doctor: null (not filtered server-side) and filtered client-side in the list page and implicitly ignored in the toggle's id-set consumers, leaving the underlying favorites row untouched"
  - "D-01's cross-entry-point consistency is satisfied by each page independently re-fetching GET /api/patient/favorites once on mount — no shared client store, no favorites context"
  - "FavoriteToggle accepts an optional className (merged via cn) so both call sites can position it (h1 row inline, card absolute overlay) from one component with no variant prop"

patterns-established:
  - "Favorites REST surface (validation module + GET/POST + DELETE[id]) is the reference shape for any future per-patient owned-resource endpoint in this phase"

requirements-completed: [PATIENT-01, PATIENT-02, PATIENT-03]

coverage:
  - id: D1
    description: "Signed-in patient can favorite a doctor from the doctor profile page; row created under RLS, heart renders filled on reload"
    requirement: "PATIENT-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/patient-favorites.spec.ts#patient adds a favorite from the doctor profile page"
        status: pass
    human_judgment: false
  - id: D2
    description: "Signed-in patient can favorite a doctor from a search result card (second D-01 entry point) and it is idempotent/IDOR-safe"
    requirement: "PATIENT-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/patient-favorites.spec.ts#patient adds a favorite from a search result card"
        status: pass
      - kind: e2e
        ref: "tests/e2e/patient-favorites.spec.ts#favorite state added on the profile page is reflected on the search results page"
        status: pass
      - kind: e2e
        ref: "tests/e2e/patient-favorites.spec.ts#another patient's favorites are never returned"
        status: pass
    human_judgment: false
  - id: D3
    description: "Signed-in patient can remove a favorite doctor and the row is deleted from public.favorites"
    requirement: "PATIENT-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/patient-favorites.spec.ts#patient removes a favorite from the favorites list"
        status: pass
    human_judgment: false
  - id: D4
    description: "/patient/favorites lists the patient's favorite doctors with loading/error/empty/populated states and renders the empty state with zero favorites"
    requirement: "PATIENT-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/patient-favorites.spec.ts#favorites list shows the empty state when the patient has no favorites"
        status: pass
    human_judgment: false
  - id: D5
    description: "tsc and lint pass with zero errors across all plan changes"
    verification:
      - kind: other
        ref: "npx tsc --noEmit"
        status: pass
      - kind: other
        ref: "npm run lint"
        status: pass
    human_judgment: false
  - id: D6
    description: "Full Playwright suite stays green apart from 3 pre-existing, already-tracked shared-dev-DB residue failures unrelated to favorites"
    verification:
      - kind: e2e
        ref: "npx playwright test (full suite): 293 passed, 18 skipped, 3 failed — all 3 failures pre-existing and unrelated to this plan (see Issues Encountered)"
        status: unknown
    human_judgment: true
    rationale: "The 3 failures match the exact class of pre-existing shared-dev-DB residue already documented in 06-01-SUMMARY.md/WINDOWS.md (2 of the 3 test names/lines are byte-identical repeats, the third is the same 'Admin cross-cutting denial matrix' flaky-timeout class); a human should confirm before /gsd-ship that no favorites-touching file caused a regression (none of the 3 failing files import anything this plan modified)."

# Metrics
duration: 55min
completed: 2026-08-12
status: complete
---

# Phase 06 Plan 02: Favorites Summary

**Favorites REST surface (`GET`/`POST`/`DELETE` under `/api/patient/favorites`), a single shared `FavoriteToggle` client component reused at all three call sites (doctor profile, search result card, favorites list), and the `/patient/favorites` list page — all 3 tasks (tracer, list page, second entry point) completed and verified.**

## Performance

- **Duration:** 55 min (resumed from a prior interrupted run that had already completed Tasks 1-2 and left Task 3 uncommitted-but-complete)
- **Tasks:** 3
- **Files modified:** 10 (5 created, 5 modified)

## Accomplishments
- `lib/validation/favorites.ts` + `app/api/patient/favorites/route.ts` (`GET`/`POST`) + `app/api/patient/favorites/[id]/route.ts` (`DELETE`): the full favorites REST surface, `patient_id` always from `guard.userId`, branching strictly on `error.code === "23505"` (never `error.message`), a single shared 404 body across missing/already-deleted/foreign-patient/malformed-UUID delete cases
- `components/favorite-toggle.tsx`: one shared `"use client"` toggle rendered at three call sites — the doctor profile `<h1>` row, every search-result `DoctorCard`, and every `/patient/favorites` row — with optimistic flip, auth-on-click redirect to `/login?from=...` for anonymous visitors, and role-gated omission (never a disabled control) for doctor/admin viewers
- `app/patient/favorites/page.tsx`: loading (3 skeleton cards) / error (retry) / empty (`No favorites yet` + `Find a doctor` CTA) / populated states, reusing `DoctorCard`'s avatar/name/specialty/next-available treatment; a favorited doctor that has since gone inactive (`doctor: null`) is filtered from the rendered list without touching its underlying `favorites` row
- Second D-01 entry point: `app/search/page.tsx` fetches the patient's favorited-id set once per page load (never per-card), threading `favoriteViewerRole`/`favoritedDoctorIds` through `components/search/search-results.tsx` into each `components/search/doctor-card.tsx`, positioned `absolute top-2 end-2` (logical, RTL-safe)
- `tests/e2e/patient-favorites.spec.ts`: all 6 placeholder tests activated (`test.fixme(` → `test(`) and passing — add-from-profile, add-from-search-card, cross-entry-point reflection, remove-from-list, empty-state, cross-patient IDOR isolation

## Task Commits

Each task was committed atomically:

1. **Task 1 (TRACER): End-to-end favorite a doctor from the profile page** - `781cc8f` (feat)
2. **Task 2: /patient/favorites list page with inline remove** - `5d31a88` (feat)
3. **Task 3: Second favorite entry point on search result cards (D-01)** - `9e32acc` (feat)

**Plan metadata:** commit pending (docs: complete plan)

## Files Created/Modified
- `lib/validation/favorites.ts` - `validateFavoriteInput`, manual UUID/presence check, single-string-message idiom
- `app/api/patient/favorites/route.ts` - `GET` (two-step read + `.in()` merge), `POST` (idempotent insert, 409 on duplicate)
- `app/api/patient/favorites/[id]/route.ts` - `DELETE` by `doctors.id`, ownership restated in one WHERE clause
- `components/favorite-toggle.tsx` - shared client toggle; `className` prop for per-call-site positioning; `hasInteractedRef`-guarded sync from a late-resolving `initialFavorited`
- `app/patient/favorites/page.tsx` - the favorites list page
- `app/doctors/[id]/page.tsx` - resolves favorites state (200/401/403 discriminator), renders the toggle in the `<h1>` row
- `app/search/page.tsx` - one favorites fetch per page load, threads state down to `SearchResults`
- `components/search/search-results.tsx` - forwards `favoriteViewerRole`/`favoritedDoctorIds` to each `DoctorCard`
- `components/search/doctor-card.tsx` - renders `FavoriteToggle` as an absolute overlay when the viewer role isn't hidden
- `tests/e2e/patient-favorites.spec.ts` - all 6 tests activated

## Decisions Made
- `[id]` in the DELETE route is `doctors.id`, not `favorites.id` — matches the toggle's by-doctor-id UX, avoids a lookup round trip
- `patient_id` on `POST` is always taken from `guard.userId`, never the request body — closes T-06-04 as defense-in-depth alongside `favorites_all_own` RLS
- A deactivated doctor's favorites row is returned with `doctor: null` rather than filtered server-side, keeping the toggle's favorited-id set complete; filtering happens client-side in the list page only
- D-01's cross-entry-point consistency is satisfied by each page independently re-fetching `GET /api/patient/favorites` once on mount — deliberately no shared client-side favorites store/context
- `FavoriteToggle` accepts an optional `className` (merged via `cn`) so one component serves both the inline `h1`-row placement and the card's absolute overlay placement with no variant prop

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `FavoriteToggle` didn't resync `isFavorited` when its parent's async favorites fetch resolved after first render**
- **Found during:** Task 3 (search-results integration — the parent fetches `/api/patient/favorites` in a `useEffect`, so `DoctorCard`/`FavoriteToggle` render once before that resolves)
- **Issue:** `useState(initialFavorited)`'s initializer only applies on the very first render. Without a resync effect, a toggle for an already-favorited doctor rendered on `/search` would show "Add to favorites" forever, since the component never re-read the corrected `initialFavorited` prop after its parent's fetch completed.
- **Fix:** Added a `hasInteractedRef`-guarded `useEffect` that syncs `isFavorited` from `initialFavorited` on every prop change, but skips the sync once the user has clicked — so a later parent re-render (e.g. from an unrelated state change) never clobbers an in-flight or just-completed optimistic click with stale server data.
- **Files modified:** `components/favorite-toggle.tsx`
- **Verification:** `tests/e2e/patient-favorites.spec.ts#patient adds a favorite from a search result card` and `#favorite state added on the profile page is reflected on the search results page` both pass
- **Committed in:** `9e32acc` (Task 3 commit)

**2. [Rule 1 - Bug] Playwright race between the toggle's optimistic UI flip and the DB-read assertion**
- **Found during:** Tasks 1 and 3 (both add-a-favorite tests)
- **Issue:** `FavoriteToggle`'s optimistic UI update (icon flips before the `fetch` resolves) let the test's DB-read assertion (`readFavoriteIds`, a direct ~300ms admin-client query) run and pass or fail before the actual `POST /api/patient/favorites` request had completed against this environment's ~1s Supabase round trip.
- **Fix:** Added `page.waitForResponse(...)` awaits for the `POST`/relevant request before each DB assertion in the affected test cases.
- **Files modified:** `tests/e2e/patient-favorites.spec.ts`
- **Verification:** All 6 tests in the file pass reliably (`npx playwright test tests/e2e/patient-favorites.spec.ts` — 6 passed, 0 skipped)
- **Committed in:** `781cc8f` (Task 1) and `9e32acc` (Task 3)

---

**Total deviations:** 2 auto-fixed (2 bugs, both discovered and fixed by the prior interrupted session before this resumed run; verified still correct and complete on resumption)
**Impact on plan:** Both fixes are necessary for correctness (a real UI bug) and test reliability (a real race, not a flaky-test workaround masking a product bug). No scope creep.

## Issues Encountered
- This execution resumed a prior interrupted session that had already committed Tasks 1-2 (`781cc8f`, `5d31a88`) and left Task 3's changes complete but uncommitted in the working tree. Verified the uncommitted diff against Task 3's full `<action>`/`<acceptance_criteria>` spec before proceeding — found it correct and complete (all props threaded correctly, `end-2` used with zero `right-2` occurrences, `FavoriteToggle`'s `className` prop already wired for the card overlay) — then ran the task's verify command, `npx tsc --noEmit`, `npm run lint`, and the full Playwright suite before committing.
- `npx playwright test` (full suite, 314 tests, single worker, ~30 min) reported `293 passed, 18 skipped, 3 failed`. All 6 favorites tests passed. The 3 failures are pre-existing and unrelated to this plan:
  - `admin-route-protection.spec.ts:230` — "Admin cross-cutting denial matrix" — `apiRequestContext.get: Request context disposed` (30s timeout)
  - `appointment-reschedule.spec.ts:764` — case 11, `afterAll` hook timeout (30000ms exceeded) — byte-identical to the failure logged in `06-01-SUMMARY.md`/`WINDOWS.md`
  - `seed-availability.spec.ts:170` — case 4, doctor slot count 3 < 6 expected — same assertion and file/line already logged in `06-01-SUMMARY.md`/`WINDOWS.md` (there it was 4 < 6; the exact count drifts run-to-run, consistent with accumulating shared-dev-DB test residue, not a fixed regression)
  - None of these three files import or exercise anything this plan created or modified (`lib/validation/favorites.ts`, the `favorites` route handlers, `favorite-toggle.tsx`, the favorites list page, or the search/doctor-card changes). This matches the already-tracked STATE.md blocker ("Shared remote dev database holds accumulated Playwright test residue") and the open `WINDOWS.md` ledger entry (id 1) recorded by `06-01`. Not fixed, per the executor's Scope Boundary rule — logged here for visibility, no new ledger entry added since the existing open entry already covers this failure class.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- PATIENT-01, PATIENT-02, and PATIENT-03 are complete: a signed-in patient can favorite a doctor from either entry point, unfavorite from any of the three surfaces, and view/manage their full favorites list, all backed by one REST surface and one shared toggle component with ownership restated in every query.
- `components/favorite-toggle.tsx`'s `className`-accepting, `hasInteractedRef`-guarded pattern is now the reference implementation for any later Phase 6 component that needs to reconcile an async parent fetch with local optimistic state (e.g. notification read-state toggles in later plans).
- Before `/gsd-ship`, a human should independently confirm the 3 pre-existing full-suite failures (now `admin-route-protection.spec.ts`, `appointment-reschedule.spec.ts`, `seed-availability.spec.ts`) are shared-dev-DB residue and not a real regression — this is the same open item `06-01-SUMMARY.md` already flagged, still unresolved.

---
*Phase: 06-dashboards-notifications-localization*
*Completed: 2026-08-12*

## Self-Check: PASSED

All 11 files (10 created/modified source files + this SUMMARY.md) verified present on disk; all 3 task commit hashes (`781cc8f`, `5d31a88`, `9e32acc`) verified present in git log.
