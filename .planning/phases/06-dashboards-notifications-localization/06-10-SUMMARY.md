---
phase: 06-dashboards-notifications-localization
plan: 10
subsystem: testing
tags: [i18n, rtl, playwright, e2e]

requires:
  - phase: 06-dashboards-notifications-localization
    provides: full dictionary-driven translation coverage across every non-admin page and shared component (06-05 through 06-09), logical-property Tailwind convention established since 06-05
provides:
  - Mechanical, repo-wide proof (grep audit) that the logical-property Tailwind invariant holds across app/ and components/ (excluding components/ui/) — zero pl-/pr-/ml-/mr-/text-left/text-right/left-*/right-*/flex-row-reverse matches
  - Standing RTL geometry regression tests proving the favorite heart and the notification unread badge/popover mirror correctly under dir="rtl" — the first runtime exercise of dir="rtl" in the project
  - Recorded, evidence-based resolution of all three UI-SPEC backstop considerations (favorites overflow at scale, favorites long-text containment, dashboard error states) and both flagged RESEARCH assumptions (A1 Realtime auth hydration, A2 router.refresh() sufficiency)
affects: []

actuals:
  tokens: 3575
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "RTL geometry assertions compare a locale-independent DOM attribute (button[aria-pressed], a data-slot=\"card\"/\"popover-content\" structural hook) across two navigations — one with no locale cookie (English default), one with the locale cookie set to he — rather than asserting on translated text, so the same selector logic works in both directions"
    - "A dashboard-level error backstop that is server-side and not reachable through page.route() browser interception (a Supabase count query null branch inside a Server Component) is resolved via code inspection and recorded as such in the SUMMARY, rather than forcing an artificial live-failure test — the plan's own language explicitly permits this ('leave the rest recorded as observations')"

key-files:
  created: []
  modified:
    - tests/e2e/locale-switching.spec.ts
    - .planning/phases/06-dashboards-notifications-localization/deferred-items.md

key-decisions:
  - "The repo-wide grep audit for physical-direction Tailwind utilities found zero matches — favorite-toggle.tsx, notification-bell.tsx, doctor-card.tsx and favorites/page.tsx needed no code changes; only tests/e2e/locale-switching.spec.ts was modified"
  - "The doctor-dashboard null-count backstop (count ?? 0 fallback) is resolved via code inspection, not a live Playwright test — a Server Component's direct Supabase query cannot be intercepted by page.route(), and the plan explicitly allows recording an observation rather than forcing every backstop into an executable test"
  - "Two atomic commits (one per task) both touch tests/e2e/locale-switching.spec.ts; Task 1's commit was independently verified to report exactly 7 passed / 0 skipped before Task 2's additions were reapplied, matching Task 1's own acceptance criterion"

patterns-established:
  - "RTL regression coverage lives in tests/e2e/locale-switching.spec.ts permanently — any future phase that adds an absolutely-positioned overlay is expected to extend this file with the same before/after-locale-cookie bounding-box comparison pattern"

requirements-completed: [I18N-02]

coverage:
  - id: D1
    description: "Repo-wide grep audit over app/ and components/ (excluding components/ui/) for pl-/pr-/ml-/mr-, text-left/text-right, left-*/right-*, and flex-row-reverse returns zero matches"
    requirement: "I18N-02"
    verification:
      - kind: other
        ref: "grep -rnE '(^|[^a-z-])(pl|pr|ml|mr)-[0-9]' app components --include=*.tsx | grep -v components/ui/ ; grep -rnE 'text-(left|right)|flex-row-reverse' ... ; grep -rnE '(^|[^a-z-])(left|right)-[0-9]' ... — all three return empty"
        status: pass
    human_judgment: false
  - id: D2
    description: "The favorite heart's bounding-box position is proven to move from the card's right half (English) to the card's left half (Hebrew) — a mechanical, executable proof that the inline-end overlay mirrors under dir=\"rtl\""
    requirement: "I18N-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/locale-switching.spec.ts#the favorite heart sits at the inline-end edge in both directions"
        status: pass
    human_judgment: false
  - id: D3
    description: "The notification popover's bounding box is proven to stay entirely within the viewport width when the locale is Hebrew, resolving the UI-SPEC's flagged Base UI Popover align=\"end\" RTL-mirroring assumption"
    requirement: "I18N-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/locale-switching.spec.ts#the notification badge and popover stay inside the viewport in Hebrew"
        status: pass
    human_judgment: false
  - id: D4
    description: "Favorites-list overflow-at-scale backstop resolved: 25 seeded favorites render as exactly 25 rows with no horizontal scrollbar and no fixed-height clipping, confirmed in both directions"
    verification:
      - kind: e2e
        ref: "tests/e2e/locale-switching.spec.ts#the /patient/favorites list scrolls naturally at a large favorited-doctor count in both directions"
        status: pass
    human_judgment: false
  - id: D5
    description: "Favorites-list long-text backstop resolved: an 80+ character doctor full_name is contained by DoctorCard's existing truncate/max-width treatment, with the row width unchanged from a short-name row, confirmed in both directions"
    verification:
      - kind: e2e
        ref: "tests/e2e/locale-switching.spec.ts#an unusually long doctor name is contained by the truncate treatment on /patient/favorites in both directions"
        status: pass
    human_judgment: false
  - id: D6
    description: "Patient-dashboard error backstop resolved: intercepting GET /api/patient/appointments to fail causes /patient to render its existing error treatment and Retry control, not a blank section or a fabricated appointment"
    verification:
      - kind: e2e
        ref: "tests/e2e/locale-switching.spec.ts#a failed patient-dashboard appointments fetch degrades to a readable error state, not a blank page or a fabricated appointment"
        status: pass
    human_judgment: false
  - id: D7
    description: "Doctor-dashboard error backstop: the doctor dashboard's count ?? 0 fallback guarantees a numeric, non-blank, non-fabricated render on a null Supabase count — resolved via code inspection, not a live-induced test (a Server Component's direct Supabase query is not interceptable via Playwright's page.route())"
    verification: []
    human_judgment: true
    rationale: "Forcing a null count from app/doctor/(gated)/page.tsx's server-side Promise.all query requires either mocking the Supabase network layer at the Node process level or temporarily breaking RLS/schema — neither is a browser-level page.route() interception, and neither was attempted given the risk/benefit tradeoff for a defensive fallback that already reads unambiguously as correct (0 is a normal integer value, not a missing-data placeholder, matching the admin dashboard's identical pattern)"
  - id: D8
    description: "RESEARCH Assumption A2 (router.refresh() sufficiency for the direction change) and RESEARCH Assumption A1 (Realtime auth hydration) both have a recorded disposition, read from 06-05-SUMMARY.md and 06-06-SUMMARY.md respectively rather than re-derived"
    verification:
      - kind: other
        ref: "06-05-SUMMARY.md key-decisions (A2), 06-06-SUMMARY.md key-decisions (A1)"
        status: pass
    human_judgment: false
  - id: D9
    description: "Full Playwright suite green modulo the pre-existing, already-tracked shared-dev-DB residue class (WINDOWS.md); tsc/lint/build all exit clean"
    verification:
      - kind: e2e
        ref: "npx playwright test (full suite): 325 passed / 1 failed, 25.8min; the 1 failure is seed-availability.spec.ts:170, logged as WINDOWS.md id 12"
        status: pass
    human_judgment: false
  - id: D10
    description: "Human RTL walkthrough across /, /search, a doctor profile, /patient, /patient/favorites, /patient/appointments, /doctor and /doctor/schedule, confirming layout mirrors correctly and no English copy leaks outside MedRDV/EN"
    verification: []
    human_judgment: true
    rationale: "Requires a live, visually-inspected browser walkthrough across 8 pages in both directions — no automated assertion covers holistic layout appearance beyond the specific geometry/overflow/error assertions already codified in D2-D6 above; the plan's own <verification> section explicitly allows recording this as an open item rather than blocking on it"

duration: 55min
completed: 2026-08-13
status: complete
---

# Phase 6 Plan 10: RTL Contract Closure Summary

**Repo-wide grep audit found zero physical-direction Tailwind utilities to fix; added two standing RTL geometry regression tests (favorite heart, notification popover) and three backstop-resolution tests (favorites overflow, favorites long-text, dashboard error state) to `tests/e2e/locale-switching.spec.ts`, closing I18N-02 with mechanical evidence instead of five phases of untested convention.**

## Performance

- **Duration:** ~55 min (execution) + ~30 min (full-suite closure run)
- **Tasks:** 2
- **Files modified:** 2 (`tests/e2e/locale-switching.spec.ts`, `deferred-items.md`)

## Accomplishments

- Repo-wide grep audit for physical-direction Tailwind utilities (`pl-`/`pr-`/`ml-`/`mr-`, `text-left`/`text-right`, `left-`/`right-`, `flex-row-reverse`) across `app/` and `components/` (excluding `components/ui/`) returned **zero matches** — the logical-property convention established in 06-05 has held mechanically for five phases; no production code needed changing
- Added `"the favorite heart sits at the inline-end edge in both directions"` — a bounding-box comparison proving `components/search/doctor-card.tsx`'s absolutely-positioned `FavoriteToggle` sits in the card's right half in English and the card's left half in Hebrew
- Added `"the notification badge and popover stay inside the viewport in Hebrew"` — a bounding-box assertion proving the notification popover stays entirely within the viewport width when Hebrew is active, resolving the UI-SPEC's flagged Base UI `Popover align="end"` RTL-mirroring assumption
- Added three backstop-resolution tests: 25 seeded favorites render as 25 rows with no horizontal scrollbar in either direction (overflow backstop); an 80+ character doctor name is contained by the existing truncate/max-width treatment without changing row width (long-text backstop); intercepting `GET /api/patient/appointments` to fail renders `/patient`'s existing error treatment and Retry control, never a blank section or a fabricated appointment (dashboard error backstop, patient side)
- The doctor-dashboard error backstop (a null Supabase count) is resolved via code inspection — `count ?? 0` in `app/doctor/(gated)/page.tsx` guarantees a numeric, non-blank render — recorded as `human_judgment: true` since forcing a null count from a Server Component's direct query is not reachable through Playwright's browser-level `page.route()` interception
- Both flagged RESEARCH assumptions have a recorded disposition, read from the owning plans' own SUMMARYs: A2 (`router.refresh()` alone sufficed, no reload fallback shipped, per 06-05) and A1 (the Realtime connection did need an explicit auth-hydration wait — `await supabase.auth.getSession()` before `.subscribe()` — per 06-06)
- `npx tsc --noEmit`, `npm run lint`, and `npm run build` all exit clean
- Full Playwright suite: 325 passed / 1 failed, 25.8 min — the 1 failure is the well-established shared-dev-DB residue class (`seed-availability.spec.ts:170`), logged as `WINDOWS.md` id 12, unrelated to this plan's test-only changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Mechanical logical-property audit and RTL geometry regression tests** - `f50313f` (test) — `tests/e2e/locale-switching.spec.ts` (grep audit found nothing to fix; 2 new tests added, independently verified 7/7 passed before Task 2's additions were reapplied)
2. **Task 2: Resolve the three UI-SPEC backstop considerations and the two flagged RTL assumptions with recorded evidence** - `3896ea1` (test) — `tests/e2e/locale-switching.spec.ts`, `deferred-items.md` (3 new tests added; full file re-verified 10/10 passed)

**Plan metadata:** (this commit)

## Files Created/Modified

- `tests/e2e/locale-switching.spec.ts` - extended with 5 new active `test(` declarations across two new `describe` blocks: RTL geometry regression (favorite heart, notification popover) and UI-SPEC backstop resolution (favorites overflow, favorites long-text, patient-dashboard error state); added a `loginAsPatient` helper and imports for `heDict` plus the favorites/notifications/reference-data/test-users fixture helpers
- `.planning/phases/06-dashboards-notifications-localization/deferred-items.md` - logged a pre-existing, out-of-scope Base UI `nativeButton` console warning (`Button render={<Link/>}`) discovered during this plan's spec runs, not caused by or in scope for this plan

## Decisions Made

- The repo-wide grep audit found zero physical-direction utilities in `favorite-toggle.tsx`, `notification-bell.tsx`, `doctor-card.tsx`, or `favorites/page.tsx` — these four files, though named in the plan's `files_modified`, needed no code change; only the test file was modified
- RTL geometry assertions use locale-independent DOM hooks (`button[aria-pressed]` for the heart, `[data-slot="card"]`/`[data-slot="popover-content"]` for structural containers) compared across a no-cookie navigation (English default) and a `locale=he` cookie navigation, rather than asserting on translated text — the same selector logic works in both directions without needing a second set of Hebrew-string-matching locators
- The doctor-dashboard null-count backstop is resolved via code inspection and recorded with `human_judgment: true` rather than forced into an artificial live test — the plan's own action text explicitly permits leaving a backstop as "recorded observations" when it is not cheaply automatable, and a Server Component's direct `supabase-js` query executes on the Node process, outside Playwright's browser-level `page.route()` interception surface
- Task 1 and Task 2 both modify the same file (`tests/e2e/locale-switching.spec.ts`); to keep the two commits atomic and independently verifiable, Task 1's commit was staged and its own 7-test run confirmed (matching that task's acceptance criterion) *before* Task 2's three additional tests were reapplied and the full 10-test file re-verified for the second commit

## Deviations from Plan

None — plan executed exactly as written for both tasks. The grep audit finding zero matches is the expected, hoped-for outcome the plan describes ("If it finds none, record that and change nothing"), not a deviation.

## Known Stubs

None.

## Issues Encountered

### Stale `.next/dev` build artifacts interrupted two Playwright runs

Twice during this session, `npx playwright test` failed immediately with `Error: UNKNOWN: unknown error, open '...\.next\dev\types\validator.ts'` because an intervening `npm run build` (production build, writes directly to `.next/`) had overwritten the dev-server's expected `.next/dev/` layout. `rm -rf .next` before each affected run resolved it cleanly; this is a Windows/Turbopack dev-vs-build artifact collision, not a code defect, and is unrelated to this plan's changes (`next-env.d.ts`'s auto-regenerated import path was left untouched — reverted with `git checkout -- next-env.d.ts` after each dev-server run to keep the working tree clean of unrelated churn).

### Full-suite closure run: 1 pre-existing failure, logged and unrelated

`npx playwright test` (full suite, 326 tests, 25.8 min): 325 passed / 1 failed. The 1 failure, `seed-availability.spec.ts:170` ("every doctor holding any slot holds between 6 and 10 of them", received 3), is the same recurring shared-dev-DB test-residue class already logged as `WINDOWS.md` ids 1, 3, 5, 7, 8, 10, and 11 across every prior 06-0X plan's full-suite closure run. Not caused by this plan — zero application code was touched, and all 10 of this plan's own new `locale-switching.spec.ts` tests, plus every other task-scoped spec, passed cleanly in the same run. Logged as `WINDOWS.md` id 12.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- I18N-02 is now satisfied with mechanical evidence: the logical-property invariant is repo-wide grep-asserted, both overlays this phase introduced have standing RTL geometry regression tests, and every UI-SPEC backstop and flagged RESEARCH assumption carried since 06-05/06-06 has a recorded disposition
- This is the final plan in Phase 6 (Dashboards, Notifications & Localization) — all 10 plans across 6 waves are now complete
- The human RTL walkthrough (D10) and the doctor-dashboard null-count backstop (D7) remain `human_judgment: true` items per the plan's own explicit allowance for recording rather than forcing every consideration into a live test; worth a final visual pass before the project defense if time allows, but nothing here blocks phase closure
- No blockers introduced by this plan

---
*Phase: 06-dashboards-notifications-localization*
*Completed: 2026-08-13*

## Self-Check: PASSED

Both modified files (`tests/e2e/locale-switching.spec.ts`, `deferred-items.md`) and this SUMMARY.md
exist on disk; both task commits (`f50313f`, `3896ea1`) verified present in `git log --oneline --all`.
