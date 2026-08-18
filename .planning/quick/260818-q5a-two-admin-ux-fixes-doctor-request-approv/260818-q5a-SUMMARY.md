---
phase: quick-260818-q5a
plan: 01
subsystem: ui
tags: [nextjs, react, playwright, admin, i18n, base-ui-select]

requires:
  - phase: quick-260817-nlg
    provides: scripts/cleanup-test-residue.ts whitelist-based dev-DB cleanup, used here to restore the clean baseline after this session's test runs
provides:
  - "Approve" action on /admin/doctor-requests that prefills the /admin/doctors create form (name, specialty, empty location) via a server-read query string
  - Auto-opened Link account dialog (email pre-filled) on doctor save when entered via Approve, followed by an auto-PATCH marking the originating request reviewed
  - Single admin navigation bar — SiteNav no longer duplicates AdminNav's seven /admin section links
affects: [admin-doctor-requests, admin-doctors, site-nav, dictionaries]

actuals:
  tokens: 7900
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Server-component query-string prefill handed down as a plain prop (no useSearchParams/Suspense) — app/admin/doctors/page.tsx reads searchParams once, server-side, mirroring the app/login/page.tsx precedent this plan explicitly avoided repeating"
    - "Base UI Select items= value->label map required whenever a Select's value can be set programmatically before the popup opens (prefill, URL-derived state) — third confirmed occurrence after search-filters.tsx and the 260816-hb3 near-miss"

key-files:
  created:
    - tests/e2e/admin-doctor-request-approve.spec.ts
  modified:
    - components/admin/doctor-requests-page-client.tsx
    - app/admin/doctors/page.tsx
    - components/admin/doctors-page-client.tsx
    - components/site-nav.tsx
    - dictionaries/en.json
    - dictionaries/he.json
    - tests/e2e/helpers/reference-data.ts
    - tests/e2e/site-nav.spec.ts
    - tests/e2e/doctor-request.spec.ts

key-decisions:
  - "Approve button uses router.push() with URLSearchParams (never a Link), keeping role=button consistent with the rest of the Actions cell and avoiding the button/link accessible-role churn quick 260813-w0r had to fix"
  - "prefillSpecialtyId is omitted from the query string entirely when the request has no specialty (never emitted as an empty string) — Task 2's test 2 is the proof this matters"
  - "setTempPasswordInfo() always runs before the auto-PATCH fires — the one-time password can never be taken off screen by a failing PATCH"
  - "approveContext is nulled out immediately before the auto-PATCH fetch, guaranteeing at most one PATCH per approve even under a re-render"
  - "SiteNav renders null entirely for an admin (empty links array) rather than an empty <nav> landmark or an empty hamburger popover"

patterns-established:
  - "Query-string prefill pattern: read once server-side in the page component, hand down as a plain prop, seed client state via a useState initializer (never an effect) so nothing can clobber a later in-page edit"

requirements-completed: [QUICK-260818-q5a]

coverage:
  - id: D1
    description: "Approve action on a pending doctor request prefills name+specialty (with a resolved label, not a raw uuid) into /admin/doctors, leaves location empty, auto-opens Link account with the email, and auto-marks the request reviewed once the account link succeeds"
    requirement: "QUICK-260818-q5a"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-doctor-request-approve.spec.ts#1. an admin approves a pending request end-to-end"
        status: pass
    human_judgment: false
  - id: D2
    description: "Edge cases: a no-specialty request approves cleanly (placeholder, not a broken Select); a plain /admin/doctors visit has zero privileged side effects; pending vs reviewed rows expose the correct action set"
    requirement: "QUICK-260818-q5a"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-doctor-request-approve.spec.ts#2/3/4"
        status: pass
    human_judgment: false
  - id: D3
    description: "Admin header no longer duplicates the seven /admin section links; patient/doctor/anonymous nav unchanged; no stale exact-list assertion remains"
    requirement: "QUICK-260818-q5a"
    verification:
      - kind: e2e
        ref: "tests/e2e/site-nav.spec.ts (52 tests, including the new admin no-header-nav test) + tests/e2e/doctor-request.spec.ts test g + tests/e2e/admin-route-protection.spec.ts (unmodified, still passing)"
        status: pass
    human_judgment: false

duration: 75min
completed: 2026-08-18
status: complete
---

# Quick Task 260818-q5a: Approve Shortcut + Admin Nav De-duplication Summary

**Approve button on /admin/doctor-requests prefills the /admin/doctors create form and auto-links the account; SiteNav no longer duplicates AdminNav's seven admin links**

## Performance

- **Duration:** ~75 min (including a full 387-test suite run and a dev-DB residue cleanup)
- **Started:** 2026-08-18T15:58:33+03:00
- **Completed:** 2026-08-18T19:20:29+03:00
- **Tasks:** 3
- **Files modified:** 9 (+1 created)

## Accomplishments

- An admin approves a pending doctor request in two clicks plus a location pick: Approve carries name/specialty/email into the existing create form, saving auto-opens Link account with the email pre-filled, and the originating request flips to `reviewed` automatically once the link succeeds — no retyping, no second call site, and the two existing endpoints (`POST /api/admin/doctors`, `POST /api/admin/doctors/[id]/link-account`) plus the existing `PATCH /api/admin/doctor-requests/[id]` remain unchanged.
- A prefilled specialty resolves to its readable English label in the trigger (not a raw uuid) via a `items=` value→label map on the Select — the same fix pattern search-filters.tsx already established for URL-derived Select values.
- `components/site-nav.tsx` no longer renders the admin link set at all; `components/admin/admin-nav.tsx`'s Admin sections bar is now the single admin navigation surface at every viewport width, with zero change to any authorization boundary (`admin-route-protection.spec.ts` passes unmodified).

## Task Commits

1. **Task 1: End-to-end approve — tracer** - `713df46` (feat)
2. **Task 2: Approve edge cases** - `678fb4a` (test)
3. **Task 3: One admin navigation** - `55e1ab5` (fix)

_No separate plan-metadata commit — SUMMARY.md/STATE.md/ROADMAP.md commit is the orchestrator's docs commit, per this executor's constraints._

## Files Created/Modified

- `components/admin/doctor-requests-page-client.tsx` - Approve button beside Mark reviewed; builds the prefill query string via URLSearchParams
- `app/admin/doctors/page.tsx` - now an async Server Component reading `searchParams` once and handing a `prefill` prop down (no `useSearchParams`, no Suspense boundary needed)
- `components/admin/doctors-page-client.tsx` - seeds create form from `prefill`, `approveContext` state gates the auto-open-link-dialog and auto-PATCH-reviewed behavior, `openLinkDialog` takes an optional preset email, `DoctorFormFields` gained `items=` maps for both Selects
- `tests/e2e/helpers/reference-data.ts` - new `trackDoctorId()` export for doctors born inside a UI flow under test
- `tests/e2e/admin-doctor-request-approve.spec.ts` - new file, 4 tests (tracer + 3 edge cases)
- `components/site-nav.tsx` - `NAV_LINKS` narrowed to patient/doctor; admin resolves to an empty list; component returns `null` when there's nothing to render
- `dictionaries/en.json`, `dictionaries/he.json` - removed 5 orphaned `nav.*` keys (doctors, doctor_requests, locations, specialties, users); key sets verified identical (226 keys each)
- `tests/e2e/site-nav.spec.ts` - `ROLE_LINKS` narrowed to patient/doctor, new admin test proves no header nav + Admin sections bar lists all 7 destinations in order
- `tests/e2e/doctor-request.spec.ts` - test 'g' rewritten to navigate via the Admin sections bar instead of the deleted header link

## Decisions Made

See `key-decisions` in frontmatter. In short: URLSearchParams (never manual concatenation) for the prefill hop since names/emails carry special characters; the specialty query key is omitted rather than emitted empty for a no-specialty request; the temp-password dialog always renders before the auto-PATCH can possibly fail; SiteNav renders nothing (not an empty shell) for admins.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Unused `ROLES` const after narrowing the per-role test loops**
- **Found during:** Task 3 lint verification
- **Issue:** After introducing `ROLES_WITH_HEADER_LINKS` to drive the two per-role loops (excluding admin), the original `ROLES` array became unreferenced, triggering an eslint `no-unused-vars` warning.
- **Fix:** Removed the unused `ROLES` const and reworded the adjacent comment that referenced it.
- **Files modified:** tests/e2e/site-nav.spec.ts
- **Verification:** `npm run lint` clean afterward.
- **Committed in:** `55e1ab5` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking/lint)
**Impact on plan:** Cosmetic lint fix only. No scope creep.

## Issues Encountered

- **Transient Supabase Auth failures during manual debugging (not a plan defect).** The tracer test's `Generate temporary password` step failed twice against a long-running dev server with "Could not create a login for this doctor" — reproduced identically on the pre-existing, unmodified `admin-doctor-link-account.spec.ts` test, and a direct `auth.admin.createUser()` probe outside the app succeeded immediately. Restarting the Next.js dev server (which had been serving requests continuously across many hours of this session's testing) resolved it permanently; all subsequent runs, including the full 387-test suite, passed cleanly on this surface. Root cause is stale dev-server state accumulated over a very long session, not application code.
- **Two orphaned "Approve Flow Doctor" rows from the failed debug attempts above.** Both failures occurred after the doctor row was created (via the untouched `POST /api/admin/doctors`) but before the test reached its own `trackDoctorId()` call, so `afterAll` never saw them. Neither attempt succeeded in creating an account (the link-account POST itself failed both times), so no auth user/profile was orphaned — only the two doctor rows. Found and removed via `scripts/cleanup-test-residue.ts --apply` alongside other pre-existing, unrelated residue that had accumulated in the shared dev DB from this session's several full-suite runs (fixture doctors from `admin-doctor-crud.spec.ts`, generic `Test Doctor`/`Test patient` fixtures from unrelated specs). Database re-verified at exactly the 12/12/12/6 seed baseline afterward (dry-run reports 0 to remove), satisfying this plan's verification step 6 and success criterion "the shared dev database is left exactly as found."
- **Full-suite run: 386/387 passed.** The 1 failure (`seed-availability.spec.ts:170`, doctor slot count below the expected range) is the long-tracked, already-documented shared-dev-DB/availability-distribution flakiness class recorded repeatedly across Phase 6 plans and WINDOWS.md (most recently id 12, from quick 260817-nlg's post-cleanup smoke test). It concerns `availability_slots` distribution on the kept seed doctors, is unrelated to this plan's files (doctor_requests/doctors/site-nav), and was not touched by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both admin-UX fixes are complete, tested end-to-end, and merged into the current branch's history.
- The shared dev database is back at its clean seed baseline (12 doctors / 12 specialties / 12 locations / 6 real profiles), independently re-verified via `scripts/cleanup-test-residue.ts` dry-run.
- The recurring `seed-availability.spec.ts:170` flakiness remains open (tracked since Phase 6, WINDOWS.md id 12) and is unrelated to this task — worth a dedicated look before the final demo/grading, as previously noted in STATE.md.

## Self-Check: PASSED

All 10 created/modified files verified present on disk; all 3 task commits (`713df46`, `678fb4a`, `55e1ab5`) verified present in git history.

---
*Phase: quick-260818-q5a*
*Completed: 2026-08-18*
