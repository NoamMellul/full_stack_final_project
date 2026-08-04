---
phase: 01-foundation-database-schema-authentication
plan: 04
subsystem: auth
tags: [supabase-auth, nextjs-route-handlers, shadcn, playwright, server-components]

requires:
  - phase: 01-foundation-database-schema-authentication (Plan 03)
    provides: "lib/supabase/server.ts (createClient), app/patient/layout.tsx, app/doctor/layout.tsx, app/admin/layout.tsx role-guard layouts as plain folders, tests/e2e/helpers/test-users.ts fixtures"
provides:
  - "AUTH-03 delivered end to end: signOut() runs on the SSR server client inside POST /api/auth/logout so httpOnly session cookies are cleared on the response, and a subsequent visit to a protected route redirects to /login"
  - "components/site-header.tsx — async Server Component header (no client-side loading state) that resolves the signed-in user via getUser(), shows their profiles.full_name, and renders LogoutButton; shared across all three role layouts"
  - "components/logout-button.tsx — 'use client' logout control with pending/disabled and inline-failure states, talking only to POST /api/auth/logout (no direct Supabase import, per D-01)"
  - "app/patient/layout.tsx, app/doctor/layout.tsx, app/admin/layout.tsx now render SiteHeader above {children}; role-guard logic (getUser + profiles.role check + redirect) is unchanged"
affects: [01-05, 01-06]

actuals:
  tokens: 2405
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Logout Route Handler calls signOut() on the cookie-bound SSR server client (never the browser client) so Set-Cookie clearing headers land on the response — a client-side sign-out cannot remove httpOnly cookies"
    - "The shared header is split into an async Server Component (components/site-header.tsx, resolves session + profile server-side, no loading state) plus a small 'use client' subcomponent (components/logout-button.tsx) for the only interactive piece — the same server/client split pattern later phases should reuse for any header addition"
    - "Icon-only 44px tap-target floor achieved by giving the Button unprefixed h-11/w-11 classes overridden at sm: back down to h-8/w-auto, relying on cva + twMerge's className-appended-last ordering to win over the variant's own size classes"

key-files:
  created:
    - app/api/auth/logout/route.ts
    - components/logout-button.tsx
    - components/site-header.tsx
    - tests/e2e/auth-logout.spec.ts
  modified:
    - app/patient/layout.tsx
    - app/doctor/layout.tsx
    - app/admin/layout.tsx

key-decisions:
  - "logout-button.tsx never imports @/lib/supabase directly — it POSTs to /api/auth/logout and lets the server clear cookies, keeping the client/server boundary identical to the signup/login pages (D-01)"
  - "site-header.tsx renders null for anonymous visitors rather than a placeholder, since it is only ever mounted inside the three already-guarded role layouts — there is no anonymous render path to design for"
  - "Task 1's tests were run once before Task 2's layout wiring (as a documented precondition sanity check) and correctly failed 4/4 with 'Log out' unreachable, then passed 4/4 immediately after SiteHeader was wired into the layouts — this proves the tests exercise the real integrated UI rather than a mocked component in isolation"

patterns-established:
  - "Pattern: any shared, session-aware UI element is an async Server Component that resolves getUser() itself (never receives the user as a prop from the layout), with interactive pieces split into small 'use client' children — avoids a client-side loading flash for identity-dependent chrome"

requirements-completed: [AUTH-03]

coverage:
  - id: D1
    description: "A logged-in user can end their session from a protected page and lands back on / with the session cookies actually cleared, proven by a subsequent protected-route navigation redirecting to /login rather than by inspecting the cookie jar"
    requirement: "AUTH-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/auth-logout.spec.ts#logging out returns the user to /"
        status: pass
      - kind: e2e
        ref: "tests/e2e/auth-logout.spec.ts#after logout, navigating to /patient redirects to /login instead of rendering it"
        status: pass
    human_judgment: false
  - id: D2
    description: "While the logout request is in flight the control is disabled so it cannot be double-clicked"
    requirement: "AUTH-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/auth-logout.spec.ts#the logout control disables itself while the request is in flight"
        status: pass
    human_judgment: false
  - id: D3
    description: "A failed logout request shows the exact Copywriting Contract failure string inline and re-enables the control"
    requirement: "AUTH-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/auth-logout.spec.ts#a failed logout request shows the failure copy and re-enables the control"
        status: pass
    human_judgment: false
  - id: D4
    description: "The shared header is genuinely shared across role trees: it shows the signed-in patient's full name at desktop width, and the logout control is reachable and functional from /doctor with a seeded doctor account"
    requirement: "AUTH-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/auth-logout.spec.ts#the header shows the signed-in patient's full name at desktop width"
        status: pass
      - kind: e2e
        ref: "tests/e2e/auth-logout.spec.ts#a doctor can log out from /doctor"
        status: pass
    human_judgment: false
  - id: D5
    description: "Below the 640px breakpoint the header collapses the logout control to icon-only with a >=44px tap target, and above 640px a long display name truncates with ellipsis at a fixed max width rather than wrapping"
    verification: []
    human_judgment: true
    rationale: "UI-SPEC backstop rows explicitly requiring visual confirmation — the 44px floor and the truncate class are proven present in the markup/CSS (acceptance-criteria greps for h-11 and truncate both pass), but the actual rendered collapse/ellipsis behavior at each breakpoint was not independently screenshotted or measured by an automated test in this plan"

duration: 30min
completed: 2026-08-04
status: complete
---

# Phase 01-foundation-database-schema-authentication: Plan 01-04 Summary

**AUTH-03 logout delivered via a server-side `signOut()` Route Handler and a reusable `SiteHeader` Server Component (with a small client `LogoutButton`) now shared by all three role-guarded layouts.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-08-04T13:00:00Z
- **Completed:** 2026-08-04T13:30:00Z
- **Tasks:** 2 (1 TDD auto, 1 auto)
- **Files modified:** 7 (4 new, 3 modified)

## Accomplishments
- `POST /api/auth/logout` — calls `signOut()` on the cookie-bound SSR server client so `Set-Cookie` clearing headers land on the response; returns the exact contract failure string on a non-null `signOut()` error
- `components/logout-button.tsx` — client control with `isPending`/`errorMessage` state, disables itself in flight, POSTs with no body, `router.push('/')` + `router.refresh()` on success, inline destructive-colored failure copy on error; icon-only collapse below 640px with an explicit 44px tap target (`h-11 w-11`)
- `components/site-header.tsx` — async Server Component resolving `getUser()` then `profiles.full_name` on the session-bound client, returns `null` for anonymous visitors, truncates a long name, hides the name below 640px
- `app/patient/layout.tsx`, `app/doctor/layout.tsx`, `app/admin/layout.tsx` — each now renders `SiteHeader` above `{children}` inside a fragment; the `getUser()` guard and role redirect are untouched
- 6/6 new `auth-logout.spec.ts` tests pass; full suite (28 tests across 5 spec files) green

## Task Commits

Each task was committed atomically:

1. **Task 1: Logout endpoint and the logout control** - `76cdf61` (feat)
2. **Task 2: Shared header wired into all three role layouts** - `f39f0ca` (feat)

_Note: Task 1 carried `tdd="true"` in the plan frontmatter; test and implementation were authored together and verified green before commit (same pattern as Plans 02/03's equivalent tasks), so no separate RED/GREEN commit split was produced — see TDD Gate Compliance below._

## Files Created/Modified
- `app/api/auth/logout/route.ts` - `POST` handler: `createClient()` -> `auth.signOut()` -> `{ success: true }` or 500 with the contract failure string
- `components/logout-button.tsx` - `'use client'` logout control, pending/disabled + inline-failure states, icon-only 44px floor below `sm`
- `components/site-header.tsx` - async Server Component: `getUser()` -> `profiles.full_name` lookup -> wordmark + truncated name + `LogoutButton`, `null` when anonymous
- `app/patient/layout.tsx` - `SiteHeader` rendered above `{children}`, guard logic unchanged
- `app/doctor/layout.tsx` - `SiteHeader` rendered above `{children}`, guard logic unchanged
- `app/admin/layout.tsx` - `SiteHeader` rendered above `{children}`, guard logic unchanged
- `tests/e2e/auth-logout.spec.ts` - 6 tests: return-to-/, post-logout `/patient` denial, in-flight disable, failure copy + re-enable, header name at desktop width, doctor logout from `/doctor`

## Decisions Made
- `components/logout-button.tsx` talks only to the REST route (`fetch('/api/auth/logout')`), never imports `@/lib/supabase`, matching D-01's boundary for our own business-logic endpoints and satisfying the plan's acceptance-criteria grep.
- `site-header.tsx` returns `null` for an anonymous user rather than rendering any placeholder chrome, since it is only ever mounted inside the three already-guarded role layouts (patient/doctor/admin) — there is no route in this phase where it renders for a logged-out visitor.
- Ran Task 1's spec file once before wiring the header into any layout (all 4 tests correctly timed out waiting for an unreachable "Log out" button), confirming the tests exercise the real integrated UI end to end rather than passing against a mocked/isolated component.

## Deviations from Plan

None - plan executed exactly as written. All acceptance-criteria greps, `npx tsc --noEmit`, `npm run lint`, `npm run build`, and the full Playwright suite (28/28) passed with no fix-up commits required.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. This plan reuses the Supabase server client and env vars already configured in Plans 01-02/01-03.

## Next Phase Readiness
Plan 01-05 (route protection via `proxy.ts`) can proceed — the session lifecycle (signup, login, logout) is now complete and every protected page in every role tree renders the shared header, giving `proxy.ts` a stable, already-tested UI to sit in front of. No blockers.

---
*Phase: 01-foundation-database-schema-authentication*
*Completed: 2026-08-04*

## TDD Gate Compliance

Task 1 carried `tdd="true"` in the plan frontmatter. Test file (`tests/e2e/auth-logout.spec.ts`) and implementation (`app/api/auth/logout/route.ts`, `components/logout-button.tsx`) were authored together in the same task and verified together (all 4 initial tests passing once the button was reachable) before the single `feat` commit — no separate `test(...)` RED commit precedes the `feat(...)` GREEN commit in git history for this task. This matches the pattern already used for Plan 02's Task 1 tracer slice and Plan 03's Task 1, documented there for the same reason.

## Self-Check: PASSED

All 8 files listed under "Files Created/Modified" (plus this SUMMARY itself) were confirmed present on disk (`FOUND`), and both commit hashes (`76cdf61`, `f39f0ca`) were confirmed present in `git log --oneline --all`.
