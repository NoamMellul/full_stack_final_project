---
phase: quick-260816-etv
plan: 01
subsystem: auth
tags: [nextjs, server-component, redirect, playwright, i18n]

requires:
  - phase: 06
    provides: role-scoped layouts (app/patient|doctor|admin/layout.tsx), the /login Client Component, site-header.tsx
provides:
  - "app/page.tsx: an async Server Component that routes every visitor away from the create-next-app scaffold — anonymous to /login, authenticated to their role home"
  - "lib/auth/role-home.ts: the single shared ROLE_HOME map, consumed by both the root router and /login"
  - "tests/e2e/root-route-router.spec.ts: 5 new tests pinning all four routing outcomes plus the unknown-role/missing-profile loop-safety branch"
  - "six realigned Playwright spec files whose assertions previously expected a terminus at the bare root URL"
affects: [auth, i18n, playwright-suite]

actuals:
  tokens: 4916
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Root route (/) as an auth decision point: reads session + profiles.role, emits only a redirect, renders nothing itself"
    - "Single shared ROLE_HOME: Record<string, string> constant (no server-only import) importable from both a Server Component and a Client Component"

key-files:
  created:
    - lib/auth/role-home.ts
    - tests/e2e/root-route-router.spec.ts
  modified:
    - app/page.tsx
    - app/login/page.tsx
    - tests/e2e/route-protection-unauthenticated.spec.ts
    - tests/e2e/route-protection-role-mismatch.spec.ts
    - tests/e2e/auth-logout.spec.ts
    - tests/e2e/auth-doctor-login.spec.ts
    - tests/e2e/admin-route-protection.spec.ts
    - tests/e2e/admin-doctor-link-account.spec.ts
    - dictionaries/en.json
    - dictionaries/he.json

key-decisions:
  - "profiles.role carries a NOT NULL + CHECK(role in ('patient','doctor','admin')) constraint (supabase/migrations/20260803230000_initial_schema.sql:18) — an 'unrecognized role' string cannot actually be written to the row (live-confirmed SQLSTATE 23514 on an UPDATE attempt). Root-route-router.spec.ts's loop-safety test was adapted from 'update role to an out-of-set value' to 'delete the profiles row', which is the other half of the same must-have truth ('profiles row is missing or carries an unrecognized role') and exercises the identical `profile?.role ?? \"\"` fallback branch in app/page.tsx."
  - "app/login/page.tsx's ROLE_HOME usage keeps its existing `?? \"/\"` fallback verbatim (per the plan's approved design) — that fallback target is itself now auth-aware since / redirects, so the login page's behavior only improves, with zero logic change there."

patterns-established:
  - "A route acting purely as a redirect dispatcher (no rendered output on any path) belongs in its own Server Component with every branch terminating in redirect() — mirrors the shape already used by the three role-scoped layouts."

requirements-completed: [QUICK-260816-etv]

coverage:
  - id: D1
    description: "Anonymous visitor to / redirects to /login with no from param"
    requirement: QUICK-260816-etv
    verification:
      - kind: e2e
        ref: "tests/e2e/root-route-router.spec.ts#an anonymous visitor to / is redirected to /login with no from param"
        status: pass
    human_judgment: false
  - id: D2
    description: "Signed-in patient/doctor/admin visiting / lands on their own role home and the destination actually renders"
    requirement: QUICK-260816-etv
    verification:
      - kind: e2e
        ref: "tests/e2e/root-route-router.spec.ts#a signed-in {role} visiting / lands on /{role} (x3)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A signed-in user with no profile row (the reachable half of 'missing or unrecognized role', per the DB check constraint) lands on /login, provably not a loop"
    requirement: QUICK-260816-etv
    verification:
      - kind: e2e
        ref: "tests/e2e/root-route-router.spec.ts#an authenticated visitor with no profile row lands on /login, not a loop"
        status: pass
    human_judgment: false
  - id: D4
    description: "Single ROLE_HOME definition shared by app/page.tsx and app/login/page.tsx; components/site-header.tsx unmodified"
    requirement: QUICK-260816-etv
    verification:
      - kind: other
        ref: "grep -rn 'const ROLE_HOME' app lib components — returns exactly one line (lib/auth/role-home.ts)"
        status: pass
      - kind: other
        ref: "git diff f48b8cf HEAD -- components/site-header.tsx public/next.svg public/vercel.svg — empty"
        status: pass
    human_judgment: false
  - id: D5
    description: "Six pre-existing Playwright spec files whose root-URL-terminus assertions this change invalidates are realigned; both root-URL gates over tests/e2e/ return zero"
    requirement: QUICK-260816-etv
    verification:
      - kind: e2e
        ref: "tests/e2e/{route-protection-unauthenticated,route-protection-role-mismatch,auth-logout,auth-doctor-login,admin-route-protection,admin-doctor-link-account}.spec.ts — 58/58 pass"
        status: pass
      - kind: other
        ref: "grep -rn 'waitForURL(\"/\")' and 'toHaveURL(\"/\")' over tests/e2e/ — both zero"
        status: pass
    human_judgment: false
  - id: D6
    description: "Ten now-dead create-next-app scaffold dictionary keys removed from both dictionaries, key sets remain identical and symmetric"
    requirement: QUICK-260816-etv
    verification:
      - kind: other
        ref: "node key-set comparison script — ok, 203 keys, identical set, no home.* keys remain"
        status: pass
    human_judgment: false
  - id: D7
    description: "Full Playwright suite shows no failure attributable to this change"
    requirement: QUICK-260816-etv
    verification:
      - kind: e2e
        ref: "npx playwright test — 332 passed / 1 failed"
        status: pass
      - kind: other
        ref: "tests/e2e/seed-availability.spec.ts:170 isolated re-run — same failure, confirmed tracked shared-dev-DB residue class (WINDOWS.md id 14)"
        status: pass
    human_judgment: false

duration: 75min
completed: 2026-08-16
status: complete
---

# Quick Task 260816-etv: Auth-aware root route router Summary

**`app/page.tsx` replaces the untouched create-next-app scaffold with a pure async Server Component that routes anonymous visitors to `/login` and authenticated visitors to their own role home, backed by a single shared `lib/auth/role-home.ts` map and six mechanically realigned Playwright specs.**

## Performance

- **Duration:** ~75 min
- **Tasks:** 3
- **Files modified:** 12 (2 created, 10 modified)

## Accomplishments
- `/` is now an auth decision point: anonymous → `/login` (no `from` param), patient/doctor → `/patient`/`/doctor`, admin → `/admin`, and a signed-in user with no profile row falls back to `/login` with a proven-loop-free redirect
- The role-mismatch bounce each of the three role layouts already performed (`redirect("/")`) now completes on the visitor's own home instead of dead-ending on Next.js boilerplate — free UX improvement, zero layout edits
- Single `ROLE_HOME` definition (`lib/auth/role-home.ts`) shared by the root router and `/login`, replacing a duplicated local literal
- The header logo (`href="/"`, `components/site-header.tsx`, unmodified) now works as a real "home" control
- Six pre-existing spec files (37 individually-verified sites across 58 tests) whose assertions expected a terminus at the bare root URL were mechanically realigned to their new destinations
- Ten dead `home.*` scaffold dictionary keys removed from both `dictionaries/en.json` and `dictionaries/he.json`, keeping the key sets symmetric (203 keys each)

## Task Commits

Task 1 followed the RED → GREEN TDD cycle (tracer, `tdd="true"`):

1. **Task 1 (RED): add failing e2e spec** - `0ff9801` (test) — 5 tests, all observed failing against the untouched scaffold
2. **Task 1 (GREEN): implement the router** - `53cb64c` (feat) — `lib/auth/role-home.ts`, `app/page.tsx`, `app/login/page.tsx`; re-run confirmed 5/5 passing
3. **Task 2: realign six invalidated specs** - `8f50426` (test) — 58/58 tests pass, both root-URL gates return zero
4. **Task 3: remove dead dictionary keys** - `f028c44` (chore) — key-set gate ok, full-suite closure 332/333

**Plan metadata:** handled by the orchestrator's separate docs commit (per this task's execution constraints)

## Files Created/Modified
- `lib/auth/role-home.ts` - single shared `ROLE_HOME: Record<string, string>` map (patient→/patient, doctor→/doctor, admin→/admin)
- `app/page.tsx` - replaced the create-next-app scaffold with the auth-aware router
- `app/login/page.tsx` - imports the shared `ROLE_HOME` instead of a local duplicate; line 74's `?? "/"` fallback expression left unchanged
- `tests/e2e/root-route-router.spec.ts` - new spec, 5 tests
- `tests/e2e/route-protection-unauthenticated.spec.ts` - the `/` test now asserts the `/login` redirect
- `tests/e2e/route-protection-role-mismatch.spec.ts` - mismatch branch now asserts the visitor's own `/${role}`, both in the loop and the standalone defence-in-depth test
- `tests/e2e/auth-logout.spec.ts` - four post-logout waits retargeted from `/` to `/login`
- `tests/e2e/auth-doctor-login.spec.ts` - doctor-at-`/patient` bounce now terminates on `/doctor`
- `tests/e2e/admin-route-protection.spec.ts` - patient/doctor visiting an admin page now terminate on their own home
- `tests/e2e/admin-doctor-link-account.spec.ts` - one post-logout wait retargeted to `/login`
- `dictionaries/en.json`, `dictionaries/he.json` - ten dead `home.*` keys removed from each

## Decisions Made
- Adapted Task 1's unknown-role loop-safety test to delete the profiles row rather than set an out-of-set role string: the DB's `CHECK(role in ('patient','doctor','admin'))` constraint rejects the literal design outright (live-confirmed SQLSTATE 23514). Deleting the row is the other half of the same must-have truth ("profiles row is missing or carries an unrecognized role") and exercises the identical fallback code path.
- Left `app/login/page.tsx` line 74's `?? "/"` fallback expression untouched, exactly as the plan's approved design specified — its behavior strictly improves for free since `/` is now itself auth-aware.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1's unrecognized-role test design was blocked by a DB check constraint**
- **Found during:** Task 1, RED phase (writing `root-route-router.spec.ts`)
- **Issue:** The plan's Test 5 design called for `testAdminClient().from("profiles").update({ role: "nurse" })` to exercise the unknown-role fallback branch. Live run against the real Supabase instance returned `SQLSTATE 23514` (check constraint violation) — `profiles.role` only accepts `'patient' | 'doctor' | 'admin'`, so an "unrecognized role" value can never actually reach the row.
- **Fix:** Rewrote the test to delete the profiles row instead of mutating its role to an out-of-set value. This exercises the exact same `profile?.role ?? ""` fallback in `app/page.tsx` that an unrecognized-role value would have, and is explicitly named as the other half of the must-haves truth ("profiles row is missing **or** carries an unrecognized role"). No production code was affected by this change — it applies to the test file only.
- **Files modified:** `tests/e2e/root-route-router.spec.ts`
- **Verification:** Test passes; the loop-safety proof (settles at `/login` within a generous 15s timeout rather than hanging) is unweakened.
- **Committed in:** `0ff9801` (RED commit, test file only)

---

**Total deviations:** 1 auto-fixed (1 blocking — DB constraint discovered during RED)
**Impact on plan:** Necessary correction; the must-have truth itself already named both branches, so no coverage was lost — only the mechanism used to reach the unreachable one.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `/` and the header logo now behave correctly for every visitor state; no known follow-up work from this task.
- Full-suite closure run: 332 passed / 1 failed. The 1 failure is `tests/e2e/seed-availability.spec.ts:170` (doctor slot count 3<6), the long-tracked shared-dev-DB test-residue class (now `WINDOWS.md` id 14, consistent with ids 1/3/5/7/8/10/11/12/13). Confirmed by an isolated re-run of the spec alone (identical failure). Not caused by this task — a project reset or manual cleanup pass before the final demo/grading would present a cleaner doctor-slot distribution, per the same open item tracked since Phase 06 plan 06-01.

## Self-Check: PASSED

All created/modified files confirmed present on disk (`lib/auth/role-home.ts`, `tests/e2e/root-route-router.spec.ts`, `app/page.tsx`, `app/login/page.tsx`, this SUMMARY). All 4 task commit hashes (`0ff9801`, `53cb64c`, `8f50426`, `f028c44`) confirmed present in git log.

---
*Quick task: 260816-etv*
*Completed: 2026-08-16*
