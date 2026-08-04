---
phase: 01-foundation-database-schema-authentication
plan: 02
subsystem: auth
tags: [supabase-auth, nextjs-route-handlers, shadcn, playwright, rls, service-role]

requires:
  - phase: 01-foundation-database-schema-authentication (Plan 01)
    provides: "Playwright runner, testAdminClient, createTestUser/deleteTestUserByEmail/cleanupTestUsers fixtures, live-confirmed profiles schema"
provides:
  - "AUTH-01 delivered end to end: /signup form -> POST /api/auth/signup -> Supabase Auth (admin.createUser, pre-confirmed) -> profiles insert (role hardcoded server-side) -> signInWithPassword -> session cookie -> guarded /patient"
  - "lib/supabase/server.ts (createClient, async, cookie-bound SSR client) and lib/supabase/admin.ts (createAdminClient, service-role, server-only-guarded) — the two Supabase client factories every later plan in this phase imports"
  - "lib/validation/auth.ts (validateEmail/validatePassword/validateFullName) — the manual D-02 validators reused client- and server-side"
  - "app/patient/layout.tsx role-guard pattern (getUser + profiles.role check + redirect) — the template Plans 03/04 copy for doctor/admin layouts"
  - "shadcn primitives input/label/card/alert, no Form wrapper (D-02)"
  - "Entire pre-existing Next.js + shadcn scaffold and the initial schema migration, tracked in git for the first time"
affects: [01-03, 01-04, 01-05, 01-06]

actuals:
  tokens: 7014
  tasks: 2
  commits: 5

tech-stack:
  added: ["server-only@0.0.1"]
  patterns:
    - "Signup Route Handler uses the service-role admin client for both auth.admin.createUser and the profiles insert, with role hardcoded inline in the insert object — never destructured or forwarded from the request body (T-01-01)"
    - "lib/supabase/admin.ts guarded with `import \"server-only\"` so an accidental Client Component import is a build error, not a silent bundle leak"
    - "Role-scoped layouts use auth.getUser() (network-verified), never auth.getSession()"
    - "Client-side form validation reuses the exact same lib/validation/auth.ts functions the Route Handler runs server-side — one source of truth for copy and rules, UX-only on the client"

key-files:
  created:
    - lib/supabase/server.ts
    - lib/supabase/admin.ts
    - lib/validation/auth.ts
    - app/api/auth/signup/route.ts
    - app/signup/page.tsx
    - app/patient/layout.tsx
    - app/patient/page.tsx
    - components/ui/input.tsx
    - components/ui/label.tsx
    - components/ui/card.tsx
    - components/ui/alert.tsx
    - tests/e2e/auth-signup.spec.ts
  modified:
    - app/layout.tsx
    - eslint.config.mjs
    - package.json
    - package-lock.json

key-decisions:
  - "server-only package required a package-legitimacy checkpoint (not anticipated by RESEARCH.md's audit, which only vetted @supabase/ssr, @supabase/supabase-js, @playwright/test); the executor halted and the orchestrator performed the install directly, independently re-verified on disk (node_modules/server-only present, require.resolve succeeds, package.json/package-lock.json both list it) before Task 1 resumed"
  - "The entire pre-existing create-next-app + shadcn scaffold and the already-applied initial schema migration had never been committed to git (Plan 01-01 only tracked test infrastructure) — committed as a separate chore commit before Task 1's new files, so every subsequent commit in this plan's history is independently buildable"
  - "eslint.config.mjs was missing a .claude/** ignore, so npm run lint was failing on Claude Code's own tooling scripts (803 pre-existing errors unrelated to any application code) before this plan even touched anything — fixed as a Rule 3 blocking-issue auto-fix because Task 2's own verification step requires lint to exit 0"
  - "Added an e2e test for the unauthenticated /patient -> /login redirect: it's a plain (non-backstop) must_haves.truths line for this plan, already implemented by Task 1's layout guard, but no task's acceptance criteria exercised it automatically until this addition"

patterns-established:
  - "Pattern: service-role writes to privilege-bearing columns (profiles.role) always hardcode the value inline in the insert/update object, never destructure it from parsed request JSON — closes the profiles RLS gap where INSERT/UPDATE policies check only id = auth.uid()"
  - "Pattern: signup-style Route Handlers use admin.createUser({ email_confirm: true }) then signInWithPassword(), sidestepping the remote project's unverified email-confirmation setting entirely"

requirements-completed: [AUTH-01]

coverage:
  - id: D1
    description: "A visitor can open /signup, submit full name/email/password, and land on an authenticated /patient page in one submit"
    requirement: "AUTH-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/auth-signup.spec.ts#a visitor can sign up and land on /patient already authenticated"
        status: pass
    human_judgment: false
  - id: D2
    description: "The account created by signup is always profiles.role = 'patient', proven executable even when the request body claims role=admin (T-01-01)"
    requirement: "AUTH-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/auth-signup.spec.ts#a request body claiming role=admin is ignored — the account is always a patient"
        status: pass
      - kind: other
        ref: "grep -q 'role: \"patient\"' app/api/auth/signup/route.ts && ! grep -Eq 'body\\.role|\\brole:\\s*(body|role)\\b' app/api/auth/signup/route.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Opening /patient without a session redirects to /login instead of rendering the patient home base"
    verification:
      - kind: e2e
        ref: "tests/e2e/auth-signup.spec.ts#opening /patient without a session redirects to /login"
        status: pass
    human_judgment: false
  - id: D4
    description: "Signing up twice with the same email shows the exact duplicate-account copy and creates no second account"
    requirement: "AUTH-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/auth-signup.spec.ts#signing up with an email that already has an account shows the duplicate-account error"
        status: pass
    human_judgment: false
  - id: D5
    description: "Empty/invalid signup fields show per-field inline errors before any network call; the submit button disables and reads 'Creating account…' while in flight; valid field values are preserved on partial errors"
    requirement: "AUTH-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/auth-signup.spec.ts#submitting a completely empty form shows inline required errors and makes no network call"
        status: pass
      - kind: e2e
        ref: "tests/e2e/auth-signup.spec.ts#a syntactically bad email shows only the email error, makes no network call, and keeps other field values"
        status: pass
      - kind: e2e
        ref: "tests/e2e/auth-signup.spec.ts#a five-character password shows only the password-length error and makes no network call"
        status: pass
      - kind: e2e
        ref: "tests/e2e/auth-signup.spec.ts#the submit button disables and reads 'Creating account…' while the request is in flight"
        status: pass
    human_judgment: false
  - id: D6
    description: "On submit with only some fields invalid, only the offending fields show inline errors and long full-name values scroll inside the fixed-width input rather than expanding the card (UI-SPEC backstop rows)"
    verification: []
    human_judgment: true
    rationale: "Visual/layout backstop rows (partial-fill field preservation is proven by D5's bad-email test at the DOM-value level, but the visual 14px/400 destructive-vs-semibold-label contrast and the long-text scroll behavior require human visual confirmation per the UI-SPEC's own backstop classification)"

duration: 70min
completed: 2026-08-04
status: complete
---

# Phase 01-foundation-database-schema-authentication: Plan 01-02 Summary

**AUTH-01 patient signup delivered end to end — REST Route Handler using Supabase's service-role admin client to create a pre-confirmed user and hardcode `profiles.role = 'patient'`, closing the RLS privilege-escalation gap, with full client-side validation states and a role-guarded `/patient` page.**

## Performance

- **Duration:** ~70 min (including a package-legitimacy checkpoint round trip for `server-only`)
- **Started:** 2026-08-04T09:50:00Z
- **Completed:** 2026-08-04T11:00:00Z
- **Tasks:** 2 (1 tracer, 1 TDD auto)
- **Files modified:** 30 (16 new application files + 23 previously-untracked scaffold files committed for the first time, with some overlap)

## Accomplishments
- `lib/supabase/server.ts` / `lib/supabase/admin.ts` — the two Supabase client factories (cookie-bound SSR client, service-role admin client) every later plan in this phase depends on
- `lib/validation/auth.ts` — manual D-02 validators, shared verbatim between the Route Handler and the client form
- `POST /api/auth/signup` — `admin.createUser({ email_confirm: true })` -> `profiles` insert with `role: "patient"` hardcoded inline -> `signInWithPassword()` so `Set-Cookie` lands on the response; proven immune to a `role: "admin"` field in the request body (T-01-01)
- `app/patient/layout.tsx` — `getUser()`-based role guard (never `getSession()`), redirects unauthenticated visitors to `/login` and role-mismatched users to `/`
- `app/signup/page.tsx` — full client form: per-field validation before any network call, in-flight "Creating account…" disabled state, destructive-styled API error banner, `/login` cross-link
- `app/layout.tsx` — fixed the Geist Sans font-variable/`@theme inline` mismatch and replaced the `create-next-app` boilerplate metadata with MedRDV's
- 8/8 new `auth-signup.spec.ts` tests pass; full suite (12 tests across both spec files) green
- The entire pre-existing Next.js + shadcn scaffold and the already-applied initial schema migration are now tracked in git for the first time

## Task Commits

1. **Task 0 (deviation, pre-Task-1): track pre-existing scaffold** — `aa1f7b7` (chore)
2. **Task 1: End-to-end patient signup — one path only** — `f614e4a` (feat)
3. **Task 2 RED: failing tests for signup client-side validation states** — `d48756f` (test)
4. **Task 2 GREEN: signup client-side validation, error states, app shell fixes** — `e43d014` (feat)
5. **Task 2 follow-up: missing route-guard test coverage** — `7237efe` (test)

_Note: Task 2 carried `tdd="true"` — RED (`d48756f`) then GREEN (`e43d014`) is present in the log; no REFACTOR commit was needed._

## Files Created/Modified
- `lib/supabase/server.ts` - `createClient()`, async, cookie-bound SSR client
- `lib/supabase/admin.ts` - `createAdminClient()`, service-role, `server-only`-guarded
- `lib/validation/auth.ts` - `validateEmail`/`validatePassword`/`validateFullName`
- `app/api/auth/signup/route.ts` - `POST` handler: validate -> `admin.createUser` -> `profiles` insert (role hardcoded) -> `signInWithPassword`
- `app/signup/page.tsx` - signup form, per-field inline validation, in-flight state, API error banner
- `app/patient/layout.tsx` - role guard (`getUser` + `profiles.role` check)
- `app/patient/page.tsx` - patient home-base shell ("Nothing here yet")
- `components/ui/input.tsx`, `label.tsx`, `card.tsx`, `alert.tsx` - shadcn primitives (no `Form`)
- `tests/e2e/auth-signup.spec.ts` - 8 tests: happy path, privilege-escalation guard, empty form, bad email, short password, in-flight state, duplicate email, unauthenticated redirect
- `app/layout.tsx` - Geist Sans variable renamed `--font-geist-sans` -> `--font-sans`; MedRDV metadata
- `eslint.config.mjs` - added `.claude/**` to ignores
- `package.json`, `package-lock.json` - added `server-only@0.0.1`
- 23 previously-untracked scaffold files (`app/page.tsx`, `app/globals.css`, `components/ui/button.tsx`, `lib/utils.ts`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs` baseline, `components.json`, `postcss.config.mjs`, `public/*`, `README.md`, `.env.example`, `skills-lock.json`, `supabase/config.toml`, `supabase/migrations/20260803230000_initial_schema.sql`, `supabase/.gitignore`) - committed as-is, no content changes

## Decisions Made
- `server-only` required a live package-legitimacy checkpoint mid-task-1 (not flagged by RESEARCH.md's audit); halted per policy rather than installing unilaterally, resumed only after the orchestrator performed the install and I independently verified it on disk (`node_modules/server-only`, `require.resolve`, `package.json`/`package-lock.json` entries) rather than trusting the relayed claim.
- Committed the pre-existing, never-tracked application scaffold as its own `chore` commit before any Task 1 file, so every commit in this plan's history is independently checkoutable and buildable (a repo where `git log` shows a signup page importing from an untracked `lib/utils.ts` would be broken at that commit).
- Fixed a pre-existing `eslint.config.mjs` gap (missing `.claude/**` ignore) as a Rule 3 blocking-issue auto-fix, since Task 2's own `<verify>` step requires `npm run lint` to exit 0 and it could not without this.
- Added one more e2e test (unauthenticated `/patient` redirect) beyond either task's literal acceptance criteria, because it's a plain must-have truth for this plan already implemented by Task 1's layout guard but left unverified by automation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Committed the never-tracked application scaffold**
- **Found during:** Pre-Task-1 (staging for the first commit)
- **Issue:** `app/`, `components/`, `lib/`, `supabase/migrations/`, and most root config files were on disk but had never been `git add`ed since project scaffolding — Plan 01-01 only committed test infrastructure. Committing only Task 1's new files on top of this would leave every commit in the plan's history unbuildable from git alone (missing `lib/utils.ts`, `app/globals.css`, `components/ui/button.tsx`, etc.).
- **Fix:** Staged and committed the 23 pre-existing untracked files verbatim, with no content changes, before any Task 1 file.
- **Files modified:** `.env.example`, `README.md`, `app/favicon.ico`, `app/globals.css`, `app/layout.tsx` (pre-Task-2 state), `app/page.tsx`, `components.json`, `components/ui/button.tsx`, `eslint.config.mjs` (baseline), `lib/utils.ts`, `next-env.d.ts`, `next.config.ts`, `postcss.config.mjs`, `public/*.svg`, `skills-lock.json`, `supabase/.gitignore`, `supabase/config.toml`, `supabase/migrations/20260803230000_initial_schema.sql`, `tsconfig.json`
- **Verification:** `git ls-files` after the commit shows all 23 files tracked; `npm run build` still exits 0 at every later commit
- **Committed in:** `aa1f7b7`

**2. [Rule 3 - Blocking] Fixed `npm run lint` failing on Claude Code's own tooling**
- **Found during:** Task 2 (`npm run lint` verification step)
- **Issue:** `eslint.config.mjs` had no ignore for `.claude/**`, so ESLint was linting Claude Code's hooks/scripts (803 pre-existing errors, all `@typescript-eslint/no-require-imports` in `.cjs`/`.js` tooling files, zero errors in any application source) — `npm run lint` could never exit 0, which is a hard acceptance criterion of Task 2.
- **Fix:** Added `.claude/**` to `globalIgnores` in `eslint.config.mjs`.
- **Files modified:** `eslint.config.mjs`
- **Verification:** `npm run lint` exits 0 with zero output after the fix
- **Committed in:** `e43d014` (Task 2 GREEN commit)

**3. [Rule 2 - Missing Coverage] Added the unauthenticated `/patient` redirect e2e test**
- **Found during:** Post-Task-2 review of plan-level `must_haves.truths`
- **Issue:** "Opening `/patient` without a session redirects to `/login`" is a plain (non-backstop) truth in this plan's frontmatter, but neither task's acceptance criteria exercised it via an automated test — only manually confirmed via `curl` during authoring.
- **Fix:** Added `tests/e2e/auth-signup.spec.ts`'s `"opening /patient without a session redirects to /login"` test.
- **Files modified:** `tests/e2e/auth-signup.spec.ts`
- **Verification:** test passes against `app/patient/layout.tsx`'s existing (unmodified) guard logic
- **Committed in:** `7237efe`

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing coverage)
**Impact on plan:** All three necessary for a working, lint-clean, fully-tested, git-consistent deliverable. No scope creep beyond what Task 1/Task 2 already required or what the plan's own `must_haves` demanded.

## Issues Encountered
- A package-legitimacy checkpoint fired mid-Task-1 for `server-only` (not anticipated by RESEARCH.md's Package Legitimacy Audit, which only covered `@supabase/ssr`, `@supabase/supabase-js`, `@playwright/test`). Per policy, the executor halted rather than installing unilaterally. Resolved when the orchestrator performed the install directly and the executor independently re-verified it on disk before resuming — same checkpoint-approval pattern documented in Plan 01-01's Summary.
- The dev server hit one transient Turbopack error (`open '.next/dev/types/validator.ts'`) during a Playwright run; retrying the same command succeeded with no code change required — not a real defect, not investigated further per the fix-attempt-limit guidance (would have needed 1 attempt, resolved immediately).

## User Setup Required
None beyond what Plan 01-01 already flagged (Supabase Auth rate limits, email-confirm dashboard toggle) — this plan's signup flow uses `admin.createUser({ email_confirm: true })`, which sidesteps the remote project's email-confirmation setting entirely (RESEARCH.md Pitfall 4), so no additional dashboard configuration is required for AUTH-01 specifically.

## Next Phase Readiness
Plan 01-03 (login/logout) and Plan 01-04 (route protection via `proxy.ts`, doctor/admin layouts) can proceed — `lib/supabase/server.ts`, `lib/supabase/admin.ts`, and `lib/validation/auth.ts` all exist with the exact exported signatures those plans depend on, and `app/patient/layout.tsx` is the proven template for the doctor/admin role-guard layouts. No blockers.

---
*Phase: 01-foundation-database-schema-authentication*
*Completed: 2026-08-04*

## Self-Check: PASSED

All 12 files/paths listed under "Files Created/Modified" and the SUMMARY itself were confirmed present on disk (`FOUND`), and all 5 commit hashes (`aa1f7b7`, `f614e4a`, `d48756f`, `e43d014`, `7237efe`) were confirmed present in `git log --oneline --all`.
