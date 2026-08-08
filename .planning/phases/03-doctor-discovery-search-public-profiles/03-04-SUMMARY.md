---
phase: 03-doctor-discovery-search-public-profiles
plan: 04
subsystem: api
tags: [nextjs, supabase, playwright, timezone, rtl]

# Dependency graph
requires:
  - phase: 03-doctor-discovery-search-public-profiles (plan 01)
    provides: doctors/specialties/locations/doctor_languages schema and RLS policies (doctors_select_active_or_owner_or_admin, availability_slots_select_available_or_owner_or_admin)
  - phase: 03-doctor-discovery-search-public-profiles (plan 02)
    provides: lib/timezone.ts (jerusalemDayKey, formatJerusalemDayHeading, formatJerusalemTime) and seeded availability_slots data
provides:
  - GET /api/doctors/[id] — public, unauthenticated doctor profile endpoint returning a narrowed doctor DTO plus upcoming available slots
  - app/doctors/[id]/page.tsx — public doctor profile page (loading/notFound/error/ready states, demo badge, day-grouped slots, inert booking control)
  - tests/e2e/doctor-profile.spec.ts — 10-test end-to-end contract for PROFILE-01/02/03, D-06, D-18, T-03-03, T-03-05
affects: [phase-5 (booking) will replace the disabled "Select this slot" control with a real booking entry point]

# Actuals (#2632)
actuals:
  tokens: 5500
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Public Route Handler mirrors the admin DTO-narrowing pattern (PUBLIC_DOCTOR_SELECT explicitly omits profile_id/is_active/created_at) but with no requireAdmin() guard — RLS is the authorization authority, .eq() predicates are defense-in-depth"
    - "UUID_PATTERN regex guard on a dynamic route [id] segment before any query, converting a would-be Postgres 22P02 cast error into a clean 404"
    - "Client Component + fetch state machine (loading/notFound/error/ready) via useParams(), consistent with app/search/page.tsx's convention — no Server Component data-fetching variant introduced"

key-files:
  created:
    - app/api/doctors/[id]/route.ts
    - app/doctors/[id]/page.tsx
    - tests/e2e/doctor-profile.spec.ts
  modified:
    - lib/supabase/proxy.ts

key-decisions:
  - "PUBLIC_DOCTOR_SELECT deliberately narrower than the admin DOCTOR_LIST_SELECT: omits profile_id, is_active, created_at; adds location.address (PROFILE-01 needs it, admin list doesn't render it)"
  - "Slot query selects exactly id, start_at, end_at — status/doctor_id/created_at never reach the public response"
  - "D-06 requirement implemented as true absence of the slot-selection control (not a disabled one) when upcomingSlots is empty — the disabled Button only renders inside a non-empty day group"
  - "Fixed lib/supabase/proxy.ts's ROLE_PREFIXES matching bug (Rule 1): a raw pathname.startsWith(prefix) check made the new public /doctors/[id] route match against the /doctor (singular, doctor-role-gated) prefix and redirect anonymous visitors to /login. Changed to a path-segment boundary match (pathname === prefix || pathname.startsWith(prefix + \"/\")) so /doctors stays public while /doctor/* role-gating is unaffected."

patterns-established:
  - "Public Route Handler DTO narrowing: select() lists exactly the public columns, never the full admin embed with fields stripped after the fact"

requirements-completed: [PROFILE-01, PROFILE-02, PROFILE-03]

coverage:
  - id: D1
    description: "GET /api/doctors/[id] returns the public doctor DTO (name, specialty, bio, photo, is_demo, location with address, languages) plus upcoming available slots for an active doctor, and omits profile_id/is_active/created_at at every nesting level"
    requirement: "PROFILE-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-profile.spec.ts#T-03-05: the serialized response body never contains profile_id, is_active or created_at"
        status: pass
      - kind: unit
        ref: "npx tsc --noEmit && npm run lint && npm run build"
        status: pass
    human_judgment: false
  - id: D2
    description: "A non-UUID or nonexistent [id], or an id belonging to an inactive doctor, returns 404 from the API and renders the 'Doctor not found' page state with a working 'Back to search' link — an inactive doctor is never reachable on the public profile surface (T-03-01, T-03-03)"
    requirement: "PROFILE-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-profile.spec.ts#not-found: a nonexistent id renders the not-found state with a working link back to search"
        status: pass
      - kind: e2e
        ref: "tests/e2e/doctor-profile.spec.ts#T-03-03: an inactive doctor's profile renders the same not-found state"
        status: pass
    human_judgment: false
  - id: D3
    description: "The public profile page renders name, specialty, address/neighborhood/city, both language chips and the full untruncated bio for a populated doctor; a null bio renders 'No description provided.' and a null photo_url renders the InitialsAvatar fallback instead of a broken image"
    requirement: "PROFILE-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-profile.spec.ts#PROFILE-01: name, specialty, address, neighborhood, city, languages and full bio are all visible"
        status: pass
      - kind: e2e
        ref: "tests/e2e/doctor-profile.spec.ts#PROFILE-01 empty: a null bio and null photo render the locked fallbacks"
        status: pass
      - kind: e2e
        ref: "tests/e2e/doctor-profile.spec.ts#PROFILE-01 encoding: a Hebrew-script name and bio survive end to end"
        status: pass
    human_judgment: false
  - id: D4
    description: "The 'Demo profile' badge renders in the header beside the doctor's name for every doctor whose is_demo is true, visible with no interaction required"
    requirement: "PROFILE-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-profile.spec.ts#PROFILE-02: the Demo profile badge is visible in the header with no interaction"
        status: pass
    human_judgment: false
  - id: D5
    description: "Upcoming available slots render grouped by Asia/Jerusalem calendar day in ascending order as two-digit 24-hour times; a doctor with zero future slots shows the exact 'No upcoming availability' text and renders no slot-selection control at all (D-06)"
    requirement: "PROFILE-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-profile.spec.ts#PROFILE-03: slots render grouped by day, ascending, as two-digit 24-hour times"
        status: pass
      - kind: e2e
        ref: "tests/e2e/doctor-profile.spec.ts#D-06: a doctor with zero future slots shows the no-availability indicator and no slot control"
        status: pass
    human_judgment: false
  - id: D6
    description: "Every rendered 'Select this slot' control carries the native disabled attribute with no click handler, is accompanied by the locked not-yet-bookable caption, and issues no /api/ request when force-clicked (D-18, T-03-07)"
    requirement: "PROFILE-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-profile.spec.ts#disabled: every Select this slot control is disabled and force-clicking issues no request"
        status: pass
    human_judgment: false

# Metrics
duration: 55min
completed: 2026-08-06
status: complete
---

# Phase 3 Plan 4: Public Doctor Profile Summary

**Public `/doctors/[id]` profile page — narrowed DTO API, demo badge, Asia/Jerusalem day-grouped upcoming slots, and a natively-disabled booking control — proven by a 10-test Playwright spec.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-08-06T16:20:00+03:00
- **Completed:** 2026-08-06T17:15:00+03:00
- **Tasks:** 3
- **Files modified:** 4 (3 created, 1 fixed as a deviation)

## Accomplishments
- `GET /api/doctors/[id]`: a public, unauthenticated endpoint returning a public-narrowed doctor DTO (`PUBLIC_DOCTOR_SELECT` omits `profile_id`, `is_active`, `created_at`; adds `location.address`) plus that doctor's future `status='available'` slots (`id`, `start_at`, `end_at` only). `UUID_PATTERN` rejects any non-UUID id with a 404 before it reaches Postgres (T-03-01); `.eq("is_active", true)` and the slot-side `.eq("status","available").gt("start_at", now)` predicates restate RLS as defense-in-depth (T-03-03).
- `/doctors/[id]` page: a Client Component + fetch state machine (`loading`/`notFound`/`error`/`ready`) rendering the full PROFILE-01 field set (photo/InitialsAvatar fallback, name, specialty, address/neighborhood/city, language chips, full bio with `No description provided.` fallback), the unmissable "Demo profile" badge beside the name (PROFILE-02), upcoming slots grouped by `jerusalemDayKey` with `formatJerusalemDayHeading`/`formatJerusalemTime` (PROFILE-03), a natively `disabled` "Select this slot" control paired with the locked not-yet-bookable caption (D-18), and the exact D-06 "No upcoming availability" indicator with zero slot controls when there are none.
- `tests/e2e/doctor-profile.spec.ts`: 10 anonymous-context tests proving PROFILE-01 (rich, Hebrew-script, and empty/null-bio/null-photo fixtures), PROFILE-02, PROFILE-03 (two-day grouping, ascending order, 24-hour format), D-06, D-18 (force-click issues no `/api/` request), the not-found state for a nonexistent id and for an inactive doctor (T-03-03), and response hygiene on the raw JSON body (T-03-05).

## Task Commits

Each task was committed atomically:

1. **Task 1: GET /api/doctors/[id] — public profile endpoint with upcoming slots** - `56fd83c` (feat)
2. **Task 2: /doctors/[id] page — details, demo badge, grouped slots, inert booking control** - `032965c` (feat)
3. **Task 3: Prove the profile contract end to end** - `83522bd` (test)

**Plan metadata:** (this commit, immediately following)

## Files Created/Modified
- `app/api/doctors/[id]/route.ts` - Public, unauthenticated GET endpoint; UUID guard, narrowed DTO select, scoped future-slots select
- `app/doctors/[id]/page.tsx` - Public profile page: loading skeleton, not-found/error/ready branches, demo badge, day-grouped slots, inert booking control
- `tests/e2e/doctor-profile.spec.ts` - 10-test end-to-end spec covering PROFILE-01/02/03, D-06, D-18, T-03-03, T-03-05
- `lib/supabase/proxy.ts` - Path-segment boundary fix for `ROLE_PREFIXES` matching (deviation, see below)

## Decisions Made
- `PUBLIC_DOCTOR_SELECT` is a standalone select string (not a filtered copy of the admin `DOCTOR_LIST_SELECT`) so the omitted-fields contract (`profile_id`, `is_active`, `created_at`) is enforced at the query itself, not by post-processing.
- The empty-slots state renders literally no "Select this slot" control anywhere on the page — the plan's D-06 requirement is implemented as absence, not a disabled/greyed-out placeholder, keeping the empty and populated code paths structurally distinct (`slotGroups.length === 0` branches to a `Badge`, never to the slot-row markup).
- Day-group headings use `<h3>` (not `<h2>` as originally drafted in the plan's action text) to sit correctly under the page's `<h1>` name and the "Upcoming availability" `<h2>` section heading, preserving a single coherent heading hierarchy; Playwright's `getByRole("heading", ...)` is level-agnostic so this has no effect on any acceptance criterion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `/doctors` incorrectly matching the `/doctor` role-gated prefix**
- **Found during:** Task 2 (building `/doctors/[id]` page and manually verifying an anonymous visit)
- **Issue:** `lib/supabase/proxy.ts`'s `ROLE_PREFIXES` matcher used a raw `pathname.startsWith(prefix)` check. Because `/doctors/...` textually starts with `/doctor`, the new public route was matched against the doctor-role-gated prefix and anonymous visitors were redirected to `/login` instead of seeing the public profile.
- **Fix:** Changed the match to a path-segment boundary check: `pathname === prefix || pathname.startsWith(prefix + "/")`. `/doctors` and `/doctors/[id]` now correctly fail every `ROLE_PREFIXES` entry (no exact segment match) and stay public; `/doctor` and `/doctor/*` role-gating is unchanged.
- **Files modified:** `lib/supabase/proxy.ts`
- **Verification:** Manual anonymous visit to `/doctors/<seeded id>` renders the profile without redirecting; full auth/route-protection regression suite (52 tests across `auth-signup`, `auth-doctor-login`, `route-protection-role-mismatch`, `route-protection-unauthenticated`, `admin-route-protection`) re-run green, plus this plan's own 10-test spec and the full 160-test suite are green.
- **Committed in:** `032965c` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary correctness fix — without it the entire public profile surface this plan builds would be unreachable by anonymous visitors. No scope creep.

## Issues Encountered

The prior execution attempt on this plan stalled mid-Task-3 during test verification (killed by the stream watchdog after 600s with no progress). On resumption, `tests/e2e/doctor-profile.spec.ts` was found already fully written on disk (untracked, uncommitted). It was read in full and verified against Task 3's action and acceptance criteria — it matched exactly and needed no edits. Ran it standalone (10/10 passed), ran the `-g "disabled"` filter (1/1 passed), then ran `npx tsc --noEmit`, `npm run lint`, `npm run build` (all clean), and the full Playwright suite (160/160 passed, ~8.7 min) before committing Task 3. No code changes were needed to complete the plan — the stall was purely an execution-environment issue (long-running test suite watchdog), not a defect in the test file itself.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 3's discovery-to-profile flow is now complete end to end: search (`/search`) → profile (`/doctors/[id]`) → an explicitly inert booking control that names Phase 5 as where it will activate.
- The "Select this slot" `disabled` `Button` in `app/doctors/[id]/page.tsx` is the exact integration point Phase 5 (booking) will wire a real click handler and API call into.
- No blockers.

---
*Phase: 03-doctor-discovery-search-public-profiles*
*Completed: 2026-08-06*

## Self-Check: PASSED

All created/modified files verified present on disk: `app/api/doctors/[id]/route.ts`, `app/doctors/[id]/page.tsx`, `tests/e2e/doctor-profile.spec.ts`, `lib/supabase/proxy.ts`, this SUMMARY. All three task commits (`56fd83c`, `032965c`, `83522bd`) verified present in `git log --oneline`.
