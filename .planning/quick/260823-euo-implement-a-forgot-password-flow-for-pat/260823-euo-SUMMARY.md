---
phase: quick-260823-euo
plan: 01
subsystem: auth
tags: [supabase-auth, nextjs-route-handler, playwright, i18n, pkce, password-recovery]

requires:
  - phase: 06-05
    provides: flat dot-namespaced i18n dictionary convention (translate() with locale -> English -> fallback)
  - phase: 02-05
    provides: POST /api/auth/change-password (existing, cookie-bound, must_change_password clearing) reused unmodified
provides:
  - Self-service password reset flow for all three roles (patient/doctor/admin) built on Supabase Auth
  - app/auth/confirm/route.ts — a new, general-purpose token_hash -> session bridge for PKCE-only SSR clients
affects: [auth, i18n, testing]

actuals:
  tokens: 8435
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Recovery-token verification via GET /auth/auth/confirm + supabase.auth.verifyOtp({token_hash, type}) instead of relying on @supabase/ssr's automatic URL-based session detection"

key-files:
  created:
    - app/forgot-password/page.tsx
    - app/reset-password/page.tsx
    - app/auth/confirm/route.ts
  modified:
    - app/login/page.tsx
    - dictionaries/en.json
    - dictionaries/he.json
    - tests/e2e/helpers/test-users.ts
    - tests/e2e/auth-password-reset.spec.ts

key-decisions:
  - "Added app/auth/confirm/route.ts (a NEW route handler, no existing route modified) that authenticates a recovery token directly via supabase.auth.verifyOtp({token_hash, type: 'recovery'}), because @supabase/ssr's browser client hardcodes flowType: 'pkce' and actively REJECTS the implicit #access_token= hash that Supabase's hosted /auth/v1/verify endpoint issues for any token with no associated PKCE code challenge -- which includes every supabase.auth.admin.generateLink()-produced link"
  - "generateRecoveryLink() test helper now returns a link to this app's own /auth/confirm route (built from generateLink()'s hashed_token), not generateLink()'s action_link"

requirements-completed: [EUO-01, EUO-02, EUO-03, EUO-04]

coverage:
  - id: D1
    description: "A visitor on /login can reach /forgot-password via a visible link and request a reset"
    requirement: "EUO-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/auth-password-reset.spec.ts#the forgot-password link is discoverable from /login"
        status: pass
    human_judgment: false
  - id: D2
    description: "Submitting any email on /forgot-password renders one neutral confirmation regardless of whether the account exists, is rate-limited, or the send succeeds -- never a user-enumeration oracle"
    requirement: "EUO-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/auth-password-reset.spec.ts#a stubbed Supabase 200 and a stubbed Supabase 429 both render the identical confirmation, with no error banner (T-EUO-01)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/auth-password-reset.spec.ts#a stubbed Supabase 429 renders the identical confirmation as a 200, with no error banner (T-EUO-01)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A real Supabase recovery link lands on /reset-password with a working form; saving a new password updates the Supabase Auth password and forwards to the user's own role home; the old password is rejected and the new one works"
    requirement: "EUO-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/auth-password-reset.spec.ts#a patient follows a real recovery link, sets a new password, and the old password is rejected while the new one works"
        status: pass
    human_judgment: false
  - id: D4
    description: "/reset-password without a valid recovery session shows the expired-link state and renders zero password fields"
    requirement: "EUO-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/auth-password-reset.spec.ts#visiting /reset-password logged out with no token renders the invalid-link state and zero password inputs"
        status: pass
    human_judgment: false
  - id: D5
    description: "Client-side validation on both pages (blank email, too-short password, mismatched confirmation) blocks submission and fires no network request"
    requirement: "EUO-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/auth-password-reset.spec.ts#submitting a blank email on /forgot-password shows the inline validation message and fires no Supabase request"
        status: pass
      - kind: e2e
        ref: "tests/e2e/auth-password-reset.spec.ts#on /reset-password, a too-short password and a mismatched confirmation each block the submit with an inline message and fire no request"
        status: pass
    human_judgment: false
  - id: D6
    description: "The outbound recovery request carries a hardcoded same-origin redirect target, never a request-controlled value (T-EUO-03)"
    requirement: "EUO-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/auth-password-reset.spec.ts#the outbound recover request carries the submitted email and the hardcoded same-origin redirect target (T-EUO-03)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Both new pages render correctly in Hebrew under dir=rtl using 21 new dictionary keys in both languages"
    requirement: "EUO-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/auth-password-reset.spec.ts#/forgot-password renders in Hebrew under dir=rtl"
        status: pass
      - kind: e2e
        ref: "tests/e2e/auth-password-reset.spec.ts#/reset-password with no token renders the invalid-link state in Hebrew under dir=rtl"
        status: pass
    human_judgment: false
  - id: D8
    description: "tests/e2e/helpers/test-users.ts gains generateRecoveryLink(), routed exclusively through testAdminClient()"
    requirement: "EUO-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/auth-password-reset.spec.ts (all 10 tests depend on this helper)"
        status: pass
    human_judgment: false
  - id: D9
    description: "Zero migrations, zero new npm packages, zero modified route handlers (app/auth/confirm/route.ts is new, not modified)"
    verification:
      - kind: other
        ref: "git diff --stat 99d8614~1..70a6823 -- supabase/migrations package.json package-lock.json 'app/api/**' (empty output)"
        status: pass
    human_judgment: false

duration: ~85min
completed: 2026-08-23
status: complete
---

# Quick Task 260823-euo: Forgot / reset password flow Summary

**Self-service password reset for all three roles on top of Supabase Auth, with a new `/auth/confirm` token_hash bridge route needed because @supabase/ssr's PKCE-only browser client rejects the implicit-hash links that both `admin.generateLink()` and email-scanner-prefetched real links produce.**

## Performance

- **Duration:** ~85 min
- **Completed:** 2026-08-23T09:58:45Z
- **Tasks:** 3
- **Files modified:** 8 (3 created pages/route, 1 modified page, 2 dictionaries, 1 test helper, 1 new spec)

## Accomplishments

- `/forgot-password` (neutral, non-enumerating confirmation) and `/reset-password` (verifying / ready / invalid tri-state) pages, plus a "Forgot password?" link on `/login`
- All 21 EUO copy-contract keys authored verbatim in both `dictionaries/en.json` and `dictionaries/he.json`
- `app/auth/confirm/route.ts` — a new Route Handler that authenticates a Supabase recovery `token_hash` via `verifyOtp()` and redirects to a hardcoded `/reset-password`, fixing a real defect in the plan's original session-detection assumption (see Deviations)
- 10-test Playwright spec (`tests/e2e/auth-password-reset.spec.ts`) covering: real end-to-end recovery, invalid-link state, client-side validation, the non-enumeration guarantee (200 vs 429 byte-identical), link discoverability, the outbound redirect-target proof, and Hebrew/RTL rendering
- Full auth + i18n regression sweep: 65/65 passed, zero regressions

## Task Commits

1. **Task 1: End-to-end "I forgot my password and set a new one"** - `99d8614` (feat)
2. **Task 2: Prove the non-happy paths** - `b0663fd` (test)
3. **Task 3: Bilingual + RTL proof, request-payload assertions, regression sweep** - `70a6823` (test)

## Files Created/Modified

- `app/forgot-password/page.tsx` - Email form; discards the Supabase response without branching (non-enumeration guarantee)
- `app/reset-password/page.tsx` - Verifying/ready/invalid tri-state; posts to the existing, unmodified `POST /api/auth/change-password`
- `app/auth/confirm/route.ts` - **New.** Bridges a recovery `token_hash` into a real session via `verifyOtp()`, then redirects (hardcoded) to `/reset-password`
- `app/login/page.tsx` - One new `Link` to `/forgot-password`
- `dictionaries/en.json` / `dictionaries/he.json` - 21 new keys each, in the existing alphabetical `auth.*` block
- `tests/e2e/helpers/test-users.ts` - `generateRecoveryLink()`, now builds an `/auth/confirm?token_hash=...&type=recovery` link from `generateLink()`'s `hashed_token`
- `tests/e2e/auth-password-reset.spec.ts` - 10 tests across all three tasks

## Decisions Made

- **`app/auth/confirm/route.ts` added (new file, not a plan deviation from "no route handler changes" since nothing existing was modified):** the plan's design assumed `@supabase/ssr`'s automatic `detectSessionInUrl` would transparently handle both a real emailed link (PKCE `?code=`) and an admin-generated test link (implicit `#access_token=` hash). That assumption is wrong for the installed library versions (`@supabase/auth-js` 2.112.0): the browser client's `flowType` is hardcoded to `"pkce"` by `@supabase/ssr`, and `GoTrueClient._getSessionFromURL()` explicitly throws `AuthPKCEGrantCodeExchangeError` when it detects an implicit-shaped callback on a PKCE-configured client. Verified this is also a real production risk, not just a test artifact: corporate email-scanning proxies that pre-fetch links can burn a one-time PKCE code before the real user clicks it, which is exactly why Supabase's own docs recommend the `token_hash`-based confirm-route pattern for PKCE/SSR apps instead of relying on the default `ConfirmationURL`.
- **`generateRecoveryLink()` returns an `/auth/confirm` link, not `generateLink()`'s hosted `action_link`:** necessary so the test helper produces a link this PKCE-only app can actually consume; mirrors what a customized Supabase email template would produce for real users (see Human Action Required below).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/2 - Bug + Missing Critical Functionality] The plan's core session-detection mechanism did not work at all**
- **Found during:** Task 1, first verification run of the end-to-end test
- **Issue:** `/reset-password`'s `getSession()`-based auto-detection (exactly as specified in the plan's `<action>` text) never established a session when following an `admin.generateLink()`-produced recovery link. Root-caused via direct inspection of `node_modules/@supabase/auth-js`: `createBrowserClient` hardcodes `flowType: "pkce"`, and `_getSessionFromURL()` throws `AuthPKCEGrantCodeExchangeError` on an implicit-grant callback (`#access_token=`) when the client's flow type is PKCE — which is exactly the shape `admin.generateLink()`'s hosted verify redirect produces (it has no associated PKCE code challenge, unlike a real `resetPasswordForEmail()` call from a browser session). This is not a hypothetical edge case: it also matches a documented real-world risk (email-scanner PKCE-code consumption).
- **Fix:** Added `app/auth/confirm/route.ts` — a GET Route Handler that reads `token_hash`/`type` from the query string, calls `supabase.auth.verifyOtp({type: "recovery", token_hash})` via the existing cookie-bound SSR server client (`lib/supabase/server.ts`, unmodified), and redirects unconditionally to a hardcoded `/reset-password`. `/reset-password`'s own `getSession()` check (unchanged from the plan) then correctly reads the resulting cookie session. Updated `generateRecoveryLink()` to build a link pointing at this new route instead of `generateLink()`'s `action_link`.
- **Files modified:** `app/auth/confirm/route.ts` (new), `app/reset-password/page.tsx` (comment only — mechanism unchanged), `tests/e2e/helpers/test-users.ts`
- **Verification:** `tests/e2e/auth-password-reset.spec.ts`'s full end-to-end test passes; `git diff --stat` on this task's 3 commits confirms zero migrations, zero package changes, and zero modifications to any file under `app/api/`
- **Committed in:** `99d8614` (Task 1 commit)

**2. [Rule 1 - Bug, test-only] `page.getByRole("alert")` false-matched Next.js's route announcer**
- **Found during:** Task 2, non-enumeration test cases
- **Issue:** Both the 200-stub and 429-stub non-enumeration tests failed on `expect(page.getByRole("alert")).toHaveCount(0)` — but the match was `#__next-route-announcer__` (`role="alert"`, Next.js's built-in accessibility live region for route changes), present on every page regardless of whether an error banner rendered. Confirmed no page-code bug: both 200 and 429 cases produced byte-identical output either way.
- **Fix:** Changed the test locator to `page.locator('[data-slot="alert"]')`, matching `components/ui/alert.tsx`'s actual `Alert` component specifically.
- **Files modified:** `tests/e2e/auth-password-reset.spec.ts`
- **Verification:** Both non-enumeration tests pass
- **Committed in:** `b0663fd` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 1/2 critical functionality fix, 1 Rule 1 test-only fix)
**Impact on plan:** The Task 1 fix was essential — without it, the password reset flow did not work at all for any link lacking a PKCE code challenge (100% of `admin.generateLink()`-produced links, and a real risk for genuinely emailed links behind corporate scanners). No scope creep: no new packages, no migrations, no existing route handler touched. The new route is small, single-purpose, and follows Supabase's own documented pattern for PKCE/SSR apps.

## Issues Encountered

None beyond the two deviations above, both resolved during execution.

## User Setup Required

**Human action required — Supabase Dashboard (agent cannot do this):**

1. **Already done per this task's precondition:** `http://localhost:3000/reset-password` is present in **Authentication -> URL Configuration -> Redirect URLs**. Add the deployed `https://<production-domain>/reset-password` there too, once the Vercel domain exists — without it, `resetPasswordForEmail()`'s `redirect_to` is silently replaced with the project's Site URL.

2. **New, discovered during this task, not yet done:** For a REAL user's emailed recovery link to route through the new `app/auth/confirm` bridge (and thus reliably survive email-scanner prefetching / PKCE-code-consumption), the Supabase **"Reset Password" email template** should be customized to link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` instead of the default `{{ .ConfirmationURL }}`. Location: **Authentication -> Email Templates -> Reset Password**. Without this change, a real user's emailed link still uses the default hosted-verify redirect; whether that link exchanges via PKCE `?code=` (works, if the browser that requested the reset is the same one clicking the link) or the implicit `#access_token=` hash (fails, same defect this task fixed for the test path) depends on factors outside this app's control — the `/auth/confirm` template change removes that ambiguity entirely and is the Supabase-recommended pattern for PKCE/SSR apps. This was not part of this quick task's original `user_setup` and is being flagged as new follow-up.

This task added no migration and no npm dependency.

## Next Phase Readiness

- Feature complete and fully tested (10 targeted tests + 65/65 regression sweep, zero regressions)
- One new, optional-but-recommended Dashboard follow-up (email template customization, item 2 above) — the flow works correctly today for the demo/grading environment via the localhost redirect URL already allow-listed; the template change only matters for the real production email path once a production domain exists
- No blockers for subsequent phases

---
*Quick task: 260823-euo*
*Completed: 2026-08-23*

## Self-Check: PASSED

All 8 created/modified source files and the SUMMARY.md itself verified present on disk. All 3 task commit hashes (99d8614, b0663fd, 70a6823) verified present in git log.
