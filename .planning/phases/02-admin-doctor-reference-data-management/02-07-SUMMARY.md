---
phase: 02-admin-doctor-reference-data-management
plan: 07
subsystem: admin
tags: [nextjs, playwright, supabase, rls, admin-dashboard, route-protection]

# Dependency graph
requires:
  - phase: 02-admin-doctor-reference-data-management
    provides: "Doctor CRUD (02-01/02-02), specialties/locations CRUD (02-03), oversight views (02-04), account linking (02-05), demo seed (02-06) — the six admin sections this plan ties together"
provides:
  - "Admin dashboard at /admin with four live counts (doctors, active doctors, profiles, appointments)"
  - "Persistent admin section navigation (components/admin/admin-nav.tsx) rendered across the whole /admin subtree"
  - "Cross-cutting denial matrix (tests/e2e/admin-route-protection.spec.ts) proving every admin page and every /api/admin/* endpoint added in this phase rejects unauthenticated, patient and doctor callers"
affects: [phase-03, phase-04, phase-05, ship]

# Actuals (#2632)
actuals:
  tokens: 4113
  tasks: 3
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Component dashboard reads counts through the session-bound Supabase client (never the admin client) so RLS is a real second layer, not just the layout guard"
    - "Table-driven Playwright matrix (single descriptor array of {method, path, body}) covering pages x session-states and endpoints x session-states, extended by adding one row"

key-files:
  created:
    - "components/admin/admin-nav.tsx"
    - "tests/e2e/admin-route-protection.spec.ts"
  modified:
    - "app/admin/page.tsx"
    - "app/admin/layout.tsx"
    - "tests/e2e/auth-doctor-login.spec.ts"
    - "tests/e2e/route-protection-role-mismatch.spec.ts"

key-decisions:
  - "Dashboard counts use four head-only count queries (select(*, {count:'exact', head:true})) rather than fetching rows, keeping the page cheap regardless of catalog size"
  - "admin-route-protection.spec.ts reuses four persistent browser contexts (one per session state: anonymous, patient, doctor, admin) instead of re-logging in per assertion, keeping a 21-assertion matrix fast"
  - "Post-sweep re-read of the fixture doctor/specialty/location rows via the service-role client proves a rejected request left no side effect, not just that it returned the right status code"

patterns-established:
  - "Admin nav renders between the site header and {children} in app/admin/layout.tsx, with the layout's own getUser()+role-check guard left untouched — new cross-cutting UI never touches the auth boundary it sits behind"

requirements-completed: [ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ADMIN-06, ADMIN-07, ADMIN-08]

coverage:
  - id: D1
    description: "Admin dashboard at /admin shows four live summary counts (Doctors, Active doctors, Registered users, Appointments) read from the database, not hardcoded"
    requirement: "ADMIN-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/auth-doctor-login.spec.ts#admin lands on /admin dashboard"
        status: pass
      - kind: automated_ui
        ref: "orchestrator Playwright screenshot spot-check, pre-checkpoint"
        status: pass
    human_judgment: false
  - id: D2
    description: "Persistent admin nav reaches all six admin sections (dashboard, doctors, specialties, locations, users, appointments) from every admin page"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-route-protection.spec.ts#page matrix"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every /admin/* page and every /api/admin/* endpoint added across plans 02-01 through 02-05 rejects unauthenticated (401/redirect), patient (403/redirect) and doctor (403/redirect) callers, with no side effect from a rejected write"
    requirement: "ADMIN-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-route-protection.spec.ts (15-entry endpoint descriptor array + six-page matrix, full suite green)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Form partial-invalid retention: submitting a form with only some fields invalid shows inline errors on the offending field only and preserves already-valid typed values, across doctors/specialties/locations forms"
    verification:
      - kind: automated_ui
        ref: "orchestrator Playwright screenshot spot-check, pre-checkpoint"
        status: pass
      - kind: manual_procedural
        ref: "Checkpoint item 1, human-verified in browser"
        status: pass
    human_judgment: true
    rationale: "UI-SPEC backstop item — visual field-level error/retention behavior cannot be asserted structurally, requires eyes on the rendered form"
  - id: D5
    description: "Table overflow and long-text truncation: long doctor/specialty names and long email addresses stay one row high with ellipsis truncation, no layout break, across doctors/specialties/users tables"
    verification:
      - kind: automated_ui
        ref: "orchestrator Playwright screenshot spot-check with an 80-character test doctor name, pre-checkpoint"
        status: pass
      - kind: manual_procedural
        ref: "Checkpoint items 2 and 3, human-verified in browser"
        status: pass
    human_judgment: true
    rationale: "UI-SPEC backstop item — ellipsis-vs-wrap rendering is a visual layout fact, not something a DOM assertion proves reliably across browsers"
  - id: D6
    description: "Dashboard summary cards reflow to a 2x2 grid below the md breakpoint with no horizontal scroll or viewport overflow"
    verification:
      - kind: automated_ui
        ref: "orchestrator Playwright screenshot at 600px width, pre-checkpoint"
        status: pass
      - kind: manual_procedural
        ref: "Checkpoint item 4, human-verified in browser"
        status: pass
    human_judgment: true
    rationale: "UI-SPEC backstop item — responsive reflow at a specific breakpoint is a visual layout fact"
  - id: D7
    description: "Appointments empty state shows 'No appointments yet' with its body copy, the expected state until Phase 5 ships booking"
    verification:
      - kind: automated_ui
        ref: "orchestrator Playwright screenshot of /admin/appointments, pre-checkpoint"
        status: pass
      - kind: manual_procedural
        ref: "Checkpoint item 5, human-verified in browser"
        status: pass
    human_judgment: true
    rationale: "UI-SPEC backstop item — exact empty-state copy match is listed as a visual backstop confirmation in the plan"

duration: 45min
completed: 2026-08-05
status: complete
---

# Phase 02 Plan 07: Admin Dashboard, Navigation, and Cross-Cutting Route Protection Summary

**Live-count admin dashboard, persistent six-section nav, and a 21-assertion Playwright denial matrix proving every admin page and API endpoint added in Phase 2 is closed to non-admins with zero side effects.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-04T23:10:00Z
- **Completed:** 2026-08-05T00:00:00Z
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 6

## Accomplishments
- Replaced the Phase 1 `/admin` placeholder with a real Server Component dashboard: four head-only count queries (doctors, active doctors, profiles, appointments) through the session-bound Supabase client, rendered as four `Card`s (Display-scale numbers, Label-scale captions) in a grid that wraps to 2x2 below `md`
- Added `components/admin/admin-nav.tsx`, a persistent nav to all six admin sections rendered from `app/admin/layout.tsx` between the site header and `{children}`, with an accessible current-page indication and 44px tap targets, leaving the layout's `getUser()`+role-check guard untouched
- Updated the two Phase 1 specs that depended on the old placeholder copy (`auth-doctor-login.spec.ts`, `route-protection-role-mismatch.spec.ts`) to assert against the new dashboard's genuine rendered content
- Added `tests/e2e/admin-route-protection.spec.ts`: a single table-driven spec covering all six admin pages across four session states (logged out, patient, doctor, admin) and a 15-entry endpoint descriptor array covering every `/api/admin/*` endpoint added in plans 02-01 through 02-05, asserting 401 unauthenticated / 403 patient / 403 doctor on every one, plus a post-sweep re-read proving no rejected write left a trace
- Full 125-test Playwright suite (Phase 1 + Phase 2) green with zero regressions
- End-of-phase visual checkpoint on the five UI-SPEC backstop items completed: independently spot-checked via Playwright screenshots by the orchestrator, then explicitly approved by the human after their own browser verification ("ok nice jai vue sa marche tu peux marque cela comme valider")

## Task Commits

Each task was committed atomically:

1. **Task 1: Admin dashboard, section navigation, and the Phase 1 spec updates it forces** - `03cc59c` (feat)
2. **Task 2: Cross-cutting admin denial matrix** - `53d6e8e` (test)
3. **Task 3: End-of-phase visual verification checkpoint** - human-verified, no code changes (see Deviations)

**Plan metadata:** (this commit) `docs(02-07): complete admin dashboard, navigation, and cross-cutting route protection plan`

## Files Created/Modified
- `app/admin/page.tsx` - Real dashboard: four live count queries rendered as Display/Label-scale summary cards
- `app/admin/layout.tsx` - Renders `AdminNav` between the site header and `{children}`; guard logic unchanged
- `components/admin/admin-nav.tsx` - Persistent nav to all six admin sections with accessible current-page indication
- `tests/e2e/auth-doctor-login.spec.ts` - Admin-lands-on-/admin assertion updated to the dashboard heading/caption
- `tests/e2e/route-protection-role-mismatch.spec.ts` - `HOME_BODY_COPY` admin entry updated to real dashboard copy
- `tests/e2e/admin-route-protection.spec.ts` - New cross-cutting denial matrix (pages x session-states, endpoints x session-states, no-side-effect re-read)

## Decisions Made
- Dashboard counts use four head-only count queries rather than fetching and counting rows client-side, keeping the page's cost independent of catalog size
- The denial matrix reuses four persistent browser contexts (one per session state) instead of logging in per assertion, keeping a 21-assertion spec fast to run
- The matrix independently re-reads the fixture doctor/specialty/location rows through the service-role client after the sweep to prove absence of side effects, not just correct status codes

## Deviations from Plan

None - plan executed exactly as written. Task 3 (the `checkpoint:human-verify` gate) required no code changes: the orchestrator independently spot-checked all five UI-SPEC backstop items via Playwright screenshots before the human's own manual browser check, and both confirmed all five render correctly. The human explicitly approved: "ok nice jai vue sa marche tu peux marque cela comme valider."

## Issues Encountered
None.

**Pre-existing note (not a defect in this plan):** the shared remote dev database has accumulated residual test rows across Phase 02's plans (visible in `/admin/doctors` as leftover "Duplicate Doctor...", "Privilege Test Doctor..." rows, plus one additional test row the orchestrator created during its own visual spot-check). This is already tracked as a STATE.md blocker for a pre-demo cleanup pass; no new blocker added.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 2 (admin, doctor and reference-data management) is now fully complete: all 8 ADMIN requirements shipped and traced, the whole admin surface is proven closed to non-admins at both the page and API layer, and the five UI-SPEC visual backstop items are human-confirmed. The full Playwright suite (Phase 1 + Phase 2, 125 tests) is green. Ready to advance to the next phase in the roadmap.

No blockers for the next phase. The residual test-data cleanup noted above is cosmetic (visible only in the admin doctors list) and does not block further development — recommended before the final demo/defense, not before Phase 3.

---
*Phase: 02-admin-doctor-reference-data-management*
*Completed: 2026-08-05*
