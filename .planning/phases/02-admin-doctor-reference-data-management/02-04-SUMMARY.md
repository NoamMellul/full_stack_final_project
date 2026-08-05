---
phase: 02-admin-doctor-reference-data-management
plan: 04
subsystem: api
tags: [nextjs, supabase, rls, playwright, shadcn, admin-oversight]

requires:
  - phase: 02-admin-doctor-reference-data-management
    provides: "requireAdmin() shared route-handler admin guard; tests/e2e/helpers/reference-data.ts and test-users.ts fixture patterns; shadcn table/select/badge/skeleton primitives"
provides:
  - "GET /api/admin/users — every registered profile, ordered created_at desc then id desc (ADMIN-07)"
  - "GET /api/admin/appointments — every platform appointment with status/doctorId/from/to filters via an inner slot embed (ADMIN-08)"
  - "components/admin/oversight-table.tsx — generic read-only table (loading/empty/error/populated states, singular-plural count caption, truncating cells, dot-path + format-enum column config) reusable by any future admin read-only list"
  - "tests/e2e/helpers/appointments.ts — createTestAppointment()/cleanupTestAppointments() service-role fixture for seeding real availability_slots + appointments rows ahead of Phase 5's booking function"
affects: [02-05-doctor-account-linking, 02-06-seed-script, 05-booking-and-availability]

actuals:
  tokens: 8157
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Declarative column config (dot-path key + format enum: text/badge/date/datetime-tz) passed as plain serializable props from a Server Component page into a Client Component table — avoids the Next.js function-across-the-RSC-boundary restriction entirely"
    - "Asia/Jerusalem conversion computed via an Intl.DateTimeFormat offset trick at the point a UTC instant is displayed or a browser 'YYYY-MM-DD' date input is converted to a UTC boundary — never the browser's ambient timezone"
    - "Interactive filter toolbars that need client state (Select onChange, date inputs, Clear) live in a 'use client' page component, matching the pre-existing signup/login form convention rather than the doctors-page-client split-file convention"

key-files:
  created:
    - app/api/admin/users/route.ts
    - app/api/admin/appointments/route.ts
    - components/admin/oversight-table.tsx
    - app/admin/users/page.tsx
    - app/admin/appointments/page.tsx
    - tests/e2e/helpers/appointments.ts
    - tests/e2e/admin-oversight-views.spec.ts
  modified: []

key-decisions:
  - "OversightTable takes columns as plain-value config objects ({ key, header, format?, timeZone?, className? }) rather than render-prop functions, so app/admin/users/page.tsx can stay a genuine Server Component while still customizing per-page columns — functions cannot cross the Server->Client Component boundary, but string/enum config can"
  - "app/admin/appointments/page.tsx is a Client Component (not the plan's literal 'server component' wording) because its status/doctor Select filters and date-range inputs need client-side state; the shared table component itself remains agnostic to that choice"
  - "From/to date-range inputs (browser <input type=date>, calendar-day granularity) are converted to UTC instants via a local Asia/Jerusalem-boundary helper (start-of-day / end-of-day) rather than naive Date parsing, honoring the project's UTC-storage/Asia-Jerusalem-display timezone constraint even for filter inputs, not just displayed values"

patterns-established:
  - "Pattern: any future read-only admin list (e.g. an audit/log view) can reuse components/admin/oversight-table.tsx directly by supplying an endpoint, a resourceKey, and a columns array — no new table-shell code needed"

requirements-completed: [ADMIN-07, ADMIN-08]

coverage:
  - id: D1
    description: "An admin opens /admin/users and sees every registered profile with role, full name, email and signup date, with two identically-named profiles rendering as two separate rows"
    requirement: "ADMIN-07"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-oversight-views.spec.ts#two profiles sharing an identical full name render as two separate rows"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-oversight-views.spec.ts#GET /api/admin/users returns rows ordered by created_at desc then id desc"
        status: pass
    human_judgment: false
  - id: D2
    description: "A non-admin session receives 403 from GET /api/admin/users before any query (T-02-02)"
    requirement: "ADMIN-07"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-oversight-views.spec.ts#a patient session receives 403 from GET /api/admin/users"
        status: pass
    human_judgment: false
  - id: D3
    description: "An admin opens /admin/appointments and sees every appointment platform-wide, with independently-working status, doctor and date-range filters (including combined) and admin-only access"
    requirement: "ADMIN-08"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-oversight-views.spec.ts#admin sees both seeded appointments with the doctor's and patients' names"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-oversight-views.spec.ts#filtering by status narrows to the matching appointment"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-oversight-views.spec.ts#filtering by doctorId returns only that doctor's appointments"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-oversight-views.spec.ts#a from/to window covering only the later slot returns only that appointment"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-oversight-views.spec.ts#combining status and doctorId filters narrows to the intersection"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-oversight-views.spec.ts#GET /api/admin/appointments returns rows ordered by created_at desc then id desc"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-oversight-views.spec.ts#a patient session receives 403, and a patient's own RLS-governed read never returns the other patient's appointment"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both oversight tables render 3 skeleton rows during the initial GET, the documented empty-state copy on zero rows, and 'Could not load…' plus Retry on fetch failure — visual correctness of skeleton/empty/error layout"
    verification: []
    human_judgment: true
    rationale: "The state-selection logic (listStatus loading/error/ready branching in oversight-table.tsx) is structurally identical to the already-shipped doctors-list pattern and is exercised by the empty-state assertions above, but the skeleton/error layout's visual polish was not screenshot-verified — left for the phase's end-of-phase UAT pass, matching Plan 02-01's D7 precedent."
  - id: D5
    description: "Neither oversight route exports a mutating HTTP verb and neither page renders a create/edit/delete affordance"
    requirement: "ADMIN-07, ADMIN-08"
    verification:
      - kind: automated_ui
        ref: "grep -qE 'export async function (POST|PATCH|PUT|DELETE)' app/api/admin/users/route.ts app/api/admin/appointments/route.ts — no match"
        status: pass
    human_judgment: false

duration: ~55min
completed: 2026-08-04
status: complete
---

# Phase 2 Plan 04: Admin Platform Oversight — Users and Appointments Summary

**Read-only /admin/users and /admin/appointments views backed by two guard-protected REST endpoints and one shared, format-driven oversight table component — proven by 10 new Playwright tests (91/91 suite green) including a direct RLS-level check of appointments_select_own_or_admin.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-08-04
- **Tasks:** 3/3 completed
- **Files modified:** 7 (all created, 0 modified)

## Accomplishments
- `GET /api/admin/users` and `GET /api/admin/appointments` ship as guard-first, read-only-by-construction routes — `requireAdmin()` returns 401/403 before any query, and the appointments route validates `status` against the exact check-constraint set before it ever reaches the query builder (T-02-13)
- `components/admin/oversight-table.tsx` generalizes the doctors-list state machine (skeleton/empty/error/populated, singular-plural count caption, truncating cells) into a single reusable component driven entirely by serializable column config — no render-prop functions needed, so `/admin/users` stays a genuine Server Component
- `/admin/appointments` ships a working status + doctor + date-range filter toolbar with a Clear control, converting the admin's calendar-day inputs into correct Asia/Jerusalem UTC boundaries rather than assuming the browser's ambient timezone
- 10 new Playwright tests prove: identical-full-name rows never merge, both endpoints' deterministic ordering, every filter dimension individually and combined, the 403 guard, and — going one layer deeper than the route guard — that `appointments_select_own_or_admin` RLS itself, queried directly via a signed-in anon client, restricts each patient to their own appointment row

## Task Commits

1. **Task 1: Read-only users and appointments endpoints** - `f373445` (feat)
2. **Task 2: Users and appointments oversight pages** - `2b0a35d` (feat)
3. **Task 3: Oversight end-to-end spec with a real seeded appointment** - `ec55236` (test)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `app/api/admin/users/route.ts` - `GET` only; guard-first, selects `id, role, full_name, email, created_at`, ordered `created_at desc, id desc`
- `app/api/admin/appointments/route.ts` - `GET` only; guard-first, validates `status` against the schema's check-constraint set, applies `status`/`doctorId` as equality filters and `from`/`to` as `.gte`/`.lte` on an `availability_slots!inner` embed, maps any DB failure to the documented friendly string (T-02-06)
- `components/admin/oversight-table.tsx` - Generic read-only table: fetch-on-mount (re-fetches when `endpoint` changes without re-showing the skeleton), 3-row skeleton on first load, documented empty/error states with Retry, singular/plural count caption, dot-path column resolution with `text`/`badge`/`date`/`datetime-tz` formatting
- `app/admin/users/page.tsx` - Server Component shell + `OversightTable` configured for `/api/admin/users`, columns full name/email/role(badge)/signup date
- `app/admin/appointments/page.tsx` - Client Component shell owning status/doctor/date-range filter state, converting date-input boundaries to Asia/Jerusalem-correct UTC instants, rendering `OversightTable` configured for `/api/admin/appointments`
- `tests/e2e/helpers/appointments.ts` - `createTestAppointment()`/`cleanupTestAppointments()` writing `availability_slots` + `appointments` directly via the service-role client (Phase 5's transactional booking function doesn't exist yet), respecting the no-overlap exclusion and active-slot-unique constraints
- `tests/e2e/admin-oversight-views.spec.ts` - 10 tests across "ADMIN-07: registered users" and "ADMIN-08: platform appointments" describe blocks

## Decisions Made
- Column definitions passed into `OversightTable` are plain-value config objects (`{ key, header, format?, timeZone?, className? }`), not functions — this keeps `app/admin/users/page.tsx` a real Server Component (functions can't cross the Server→Client Component prop boundary; strings and enums can) while still letting each page customize its own columns
- `app/admin/appointments/page.tsx` is a Client Component rather than the plan's literal "server component" wording, because its filter toolbar (two `Select`s, two date inputs, a Clear button) needs client-side state that a Server Component structurally cannot own; `oversight-table.tsx` itself stays agnostic to which kind of component renders it
- Date-range filter inputs are calendar-day granularity (`<input type="date">`); converting a day like "2026-08-10" to a UTC instant uses an `Intl.DateTimeFormat`-based Asia/Jerusalem offset calculation for both the start-of-day and end-of-day boundary, rather than naive `Date` parsing (which would silently assume UTC or the browser's local zone) — honoring the project's UTC-storage/Asia-Jerusalem-display constraint even for filter inputs
- The RLS boundary test (`T-02-02`) signs in directly with `@supabase/supabase-js` using each patient's real credentials and reads the `appointments` table with no admin bypass, proving `appointments_select_own_or_admin` restricts rows independently of the route guard — not just that the route guard exists

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `app/admin/appointments/page.tsx` implemented as a Client Component, not a Server Component**
- **Found during:** Task 2
- **Issue:** The plan's action text calls for "a server component" rendering the filter toolbar, but Next.js Server Components cannot own `useState`/`onChange` client interactivity, and functions cannot be passed as props from a Server Component to a Client Component — the status/doctor `Select`s, date inputs and Clear control structurally require client-side state.
- **Fix:** Marked the whole file `"use client"`, matching the pre-existing signup/login form convention already established in the codebase. `app/admin/users/page.tsx` (no interactivity needed) stays a genuine Server Component exactly as planned. `oversight-table.tsx` itself only ever receives plain-value props, so it works unchanged either way.
- **Files modified:** `app/admin/appointments/page.tsx`
- **Verification:** `npx tsc --noEmit`, `npm run lint`, and all 4 appointments-filter Playwright tests pass; the acceptance criteria (status select, doctor select, date-range control, Clear control, no mutation affordance) hold regardless of Server/Client Component classification.
- **Committed in:** `2b0a35d` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary given Next.js's Server/Client Component serialization rules; no scope creep, no behavior change from what the plan specified.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `components/admin/oversight-table.tsx` is ready for reuse by any future read-only admin list without new table-shell code.
- `tests/e2e/helpers/appointments.ts` is ready for reuse by Phase 5's booking specs once the real `book_appointment()` transactional function exists — this fixture's direct service-role writes were always meant as a Phase-2-only stand-in.
- No blockers.

## Self-Check: PASSED

All 7 created files verified present on disk; all 3 task commits (`f373445`, `2b0a35d`, `ec55236`) verified present in git log; full 91-test Playwright suite green.

---
*Phase: 02-admin-doctor-reference-data-management*
*Completed: 2026-08-04*
