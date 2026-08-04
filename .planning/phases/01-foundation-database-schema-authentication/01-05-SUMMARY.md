---
phase: 01-foundation-database-schema-authentication
plan: 05
subsystem: auth
tags: [nextjs-proxy, supabase-ssr, route-protection, rbac, playwright]

requires:
  - phase: 01-foundation-database-schema-authentication (Plan 03)
    provides: "app/login/page.tsx, lib/validation/redirect.ts (safeRedirectPath), app/doctor/layout.tsx and app/admin/layout.tsx as plain-folder role guards"
provides:
  - "AUTH-06 delivered end to end: root proxy.ts (Next.js 16 convention, not middleware.ts) intercepts every request and redirects unauthenticated visits to /patient, /doctor or /admin to /login?from=<pathname>"
  - "AUTH-04 delivered: session cookies are refreshed by proxy.ts on every request via getUser(), verified to survive a full reload and a second tab in the same browser context"
  - "AUTH-07 delivered and exhaustively covered: all nine role-versus-route-tree combinations asserted (3 allowed, 6 denied), plus a defence-in-depth case proving the request gate and the role-scoped layout guard agree independently"
  - "lib/supabase/client.ts — the third and final Supabase client wrapper (browser/anon key), with no importer yet by design (D-01 routes mutations through REST handlers; first consumer is Phase 3 search)"
affects: [01-06]

actuals:
  tokens: 2200
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Root proxy.ts (NOT middleware.ts) exports proxy(request) delegating to lib/supabase/proxy.ts's updateSession() — Next.js 16.0.0 renamed the convention and a leftover middleware.ts is silently ignored with no build error"
    - "updateSession() calls createServerClient(...) immediately followed by auth.getUser() with zero intervening statements, per both official examples' warning against random logouts"
    - "The request gate checks authentication presence only (redirect to /login on missing session for /patient|/doctor|/admin prefixes); role comparison is deliberately deferred to the role-scoped layouts to avoid a profiles round trip on every single request (RESEARCH.md assumption A4)"
    - "The from= redirect param is always request.nextUrl.pathname (never request.url), so lib/validation/redirect.ts's safeRedirectPath always accepts it — producer and consumer are both constrained against open redirects"

key-files:
  created:
    - proxy.ts
    - lib/supabase/proxy.ts
    - lib/supabase/client.ts
    - tests/e2e/route-protection-unauthenticated.spec.ts
    - tests/e2e/auth-session-persistence.spec.ts
    - tests/e2e/route-protection-role-mismatch.spec.ts
  modified:
    - tests/e2e/auth-signup.spec.ts

key-decisions:
  - "tests/e2e/auth-signup.spec.ts's pre-existing '/patient without a session redirects to /login' assertion was updated to tolerate the ?from= query param now appended by proxy.ts — this test predates this plan's request gate and asserted an exact '/login' URL with no query string, which broke the instant the redirect started carrying a return path (Rule 1 auto-fix, directly caused by this plan's own redirect behavior change, same scope)"
  - "route-protection-role-mismatch.spec.ts asserts the matching-role cases against each role's distinct home-base body copy ('This is your patient/doctor/admin home base') rather than the shared 'Nothing here yet' heading, since that heading is identical across all three role home pages and would not distinguish a correct landing from a coincidentally-similar wrong one"

patterns-established:
  - "Pattern: any future protected route prefix added to the app must be added to lib/supabase/proxy.ts's ROLE_PREFIXES map (auth-presence gate) AND given its own role-scoped layout (fine-grained role gate) — the two checks are independent and neither may assume the other ran"

requirements-completed: [AUTH-04, AUTH-06, AUTH-07]

coverage:
  - id: D1
    description: "An unauthenticated visitor opening /patient, /doctor or /admin is redirected to /login before the protected page renders, with the originally requested pathname carried as the from parameter"
    requirement: "AUTH-06"
    verification:
      - kind: e2e
        ref: "tests/e2e/route-protection-unauthenticated.spec.ts#an unauthenticated visitor to /patient is redirected to /login with a from param"
        status: pass
      - kind: e2e
        ref: "tests/e2e/route-protection-unauthenticated.spec.ts#an unauthenticated visitor to /doctor is redirected to /login with a from param"
        status: pass
      - kind: e2e
        ref: "tests/e2e/route-protection-unauthenticated.spec.ts#an unauthenticated visitor to /admin is redirected to /login with a from param"
        status: pass
    human_judgment: false
  - id: D2
    description: "The route-protection gate is scoped, not global: unauthenticated visits to / and /signup are never redirected"
    requirement: "AUTH-06"
    verification:
      - kind: e2e
        ref: "tests/e2e/route-protection-unauthenticated.spec.ts#an unauthenticated visit to / is not redirected"
        status: pass
      - kind: e2e
        ref: "tests/e2e/route-protection-unauthenticated.spec.ts#an unauthenticated visit to /signup is not redirected"
        status: pass
    human_judgment: false
  - id: D3
    description: "A logged-in patient's session survives a full browser reload and is independently usable in a second tab of the same browser context without another login"
    requirement: "AUTH-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/auth-session-persistence.spec.ts#a session survives a full browser reload"
        status: pass
      - kind: e2e
        ref: "tests/e2e/auth-session-persistence.spec.ts#a session survives a second tab in the same browser context"
        status: pass
    human_judgment: false
  - id: D4
    description: "All nine role-versus-route-tree combinations are asserted: a patient, doctor, and admin each reach their own matching route and are denied (redirected to /) on both mismatched routes"
    requirement: "AUTH-07"
    verification:
      - kind: e2e
        ref: "tests/e2e/route-protection-role-mismatch.spec.ts#AUTH-07: role-versus-route denial matrix (9 generated tests covering all patient/doctor/admin x patient/doctor/admin combinations)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The request gate and the role-scoped layout guard are independent, defence-in-depth layers: a doctor session hitting /admin directly is still denied and redirected to /"
    requirement: "AUTH-07"
    verification:
      - kind: e2e
        ref: "tests/e2e/route-protection-role-mismatch.spec.ts#defence in depth: a doctor session hitting /admin directly is denied at the layout guard behind the request gate"
        status: pass
    human_judgment: false
  - id: D6
    description: "The route-interception file is named proxy.ts (Next.js 16 convention) with an exported proxy() function and config.matcher; no middleware.ts file exists anywhere in the repo"
    verification:
      - kind: other
        ref: "test -f proxy.ts && test ! -f middleware.ts; grep -q 'export async function proxy' proxy.ts; grep -q 'export const config' proxy.ts; npm run build output shows 'ƒ Proxy (Middleware)'"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-08-04
status: complete
---

# Phase 01-foundation-database-schema-authentication: Plan 01-05 Summary

**AUTH-04, AUTH-06 and AUTH-07 delivered via a root `proxy.ts` (Next.js 16's post-`middleware.ts` convention) that refreshes session cookies and gates unauthenticated access on every request, backstopped by an exhaustive nine-combination role-versus-route Playwright matrix proving the independent layout-level role guard.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-04T11:00:00Z
- **Completed:** 2026-08-04T11:35:00Z
- **Tasks:** 2 (both auto)
- **Files modified:** 7 (6 new, 1 modified)

## Accomplishments
- `proxy.ts` (repo root) — the Next.js 16 request-interception entry point, exporting `proxy(request)` and `config.matcher`; verified present under its correct name with `test -f proxy.ts && test ! -f middleware.ts`, and confirmed picked up by the framework via `npm run build`'s `ƒ Proxy (Middleware)` route-summary line
- `lib/supabase/proxy.ts` — `updateSession(request)`: constructs `createServerClient` with a request/response cookie adapter, calls `auth.getUser()` immediately after with no intervening statements, and redirects unauthenticated requests to `/patient`, `/doctor` or `/admin` to `/login?from=<pathname>` (pathname only, never a full URL, so `safeRedirectPath` from Plan 03 always accepts it)
- `lib/supabase/client.ts` — the browser Supabase client (`createBrowserClient`, anon key only, no service-role reference), the third and final client wrapper for this project
- `tests/e2e/route-protection-unauthenticated.spec.ts` — 5 tests: all three protected trees redirect with the correct `from` param, and `/` and `/signup` are confirmed NOT redirected (the gate is scoped, not global)
- `tests/e2e/auth-session-persistence.spec.ts` — 2 tests: a patient session survives a full reload and a second tab in the same browser context
- `tests/e2e/route-protection-role-mismatch.spec.ts` — 10 tests: all nine role-versus-route combinations (3 allowed, 6 denied) generated from a data table, plus one defence-in-depth case (doctor session hitting `/admin` directly)
- Full suite: 45/45 tests passing across 8 spec files; `npx tsc --noEmit`, `npm run build`, `npm run lint` all exit 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Root proxy request gate, session refresh, and the browser client** - `b3ff5a3` (feat)
2. **Task 2: Exhaustive role-versus-route denial matrix** - `b182add` (feat, includes the auth-signup.spec.ts deviation fix)

## Files Created/Modified
- `proxy.ts` - Next.js 16 root request-interception file, delegates to `updateSession`
- `lib/supabase/proxy.ts` - `updateSession(request)`: cookie refresh + coarse auth-presence gate by path prefix
- `lib/supabase/client.ts` - browser Supabase client (`createBrowserClient`, anon key)
- `tests/e2e/route-protection-unauthenticated.spec.ts` - AUTH-06: 3 protected-tree redirects + 2 non-redirect controls
- `tests/e2e/auth-session-persistence.spec.ts` - AUTH-04: reload persistence, second-tab persistence
- `tests/e2e/route-protection-role-mismatch.spec.ts` - AUTH-07: all 9 role-versus-route combinations + 1 defence-in-depth case
- `tests/e2e/auth-signup.spec.ts` - updated the pre-existing unauthenticated-`/patient` redirect assertion to tolerate the new `?from=` query param

## Decisions Made
- Wrote the `from` search-param value as `request.nextUrl.pathname` exclusively — never `request.url` — so `lib/validation/redirect.ts`'s `safeRedirectPath` (built in Plan 03) always accepts it; verified by the acceptance-criteria grep `! grep -Eq 'set\("from", *request\.url' lib/supabase/proxy.ts`.
- Deliberately did not add a role check inside `lib/supabase/proxy.ts` — per RESEARCH.md assumption A4, role enforcement lives only in the role-scoped layouts, avoiding a `profiles` database round trip on every single request. The Task 2 matrix specifically proves this division of labor still holds for every combination.
- `route-protection-role-mismatch.spec.ts` asserts the three matching-role cases against each role's distinct home-base body copy ("This is your patient/doctor/admin home base") rather than the shared "Nothing here yet" heading, since the heading text is identical across all three role home pages and would not by itself distinguish a correct landing from a coincidentally similar wrong one.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a pre-existing test's redirect assertion broken by this plan's own change**
- **Found during:** Task 2 full-suite verification run
- **Issue:** `tests/e2e/auth-signup.spec.ts` (written in Plan 02, before `proxy.ts` existed) asserted an unauthenticated visit to `/patient` lands on the exact URL `/login` with `page.waitForURL("/login")`. Once Task 1 of this plan wired in the root request gate, that same redirect now carries a `?from=%2Fpatient` query param, so the exact string never matches and the test timed out waiting for a navigation that already happened.
- **Fix:** Changed the assertion to `page.waitForURL(/\/login/)` followed by an explicit pathname check (`new URL(page.url()).pathname === "/login"`), matching the pattern already used in this plan's own new specs.
- **Files modified:** `tests/e2e/auth-signup.spec.ts`
- **Verification:** Re-ran `tests/e2e/auth-signup.spec.ts` and the full suite (45/45 passing) after the fix.
- **Committed in:** `b182add` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug, directly caused by this plan's own redirect-behavior change to the same code path)
**Impact on plan:** Necessary correctness fix, in-scope since it modifies test assertions for the exact behavior (`/patient` unauthenticated redirect) this plan's Task 1 changed. No scope creep beyond that one test file.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required. This plan reuses the Supabase clients, env vars, and test-user fixtures already configured in Plans 01-04.

## Next Phase Readiness
Plan 01-06 can proceed. The full authentication and route-protection foundation (AUTH-01 through AUTH-07) is now complete and independently verified at two layers (request gate + role-scoped layout), with `lib/supabase/client.ts` in place as the last of the three Supabase client wrappers for later phases to import. No blockers.

---
*Phase: 01-foundation-database-schema-authentication*
*Completed: 2026-08-04*

## Self-Check: PASSED

All 7 files listed under "Files Created/Modified" were confirmed present on disk (`FOUND`), and both commit hashes (`b3ff5a3`, `b182add`) were confirmed present in `git log --oneline --all`.
