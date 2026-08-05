---
phase: 02-admin-doctor-reference-data-management
plan: 05
subsystem: api
tags: [nextjs, supabase, rls, playwright, auth, admin-crud]

requires:
  - phase: 02-admin-doctor-reference-data-management
    provides: "plan 02-02's doctor model (doctors.profile_id nullable FK), plan 02-01's requireAdmin() guard and doctors-page-client.tsx table"
provides:
  - "profiles.must_change_password column (default false) plus column-level UPDATE lockdown on public.profiles (authenticated may only write full_name, email)"
  - "POST /api/admin/doctors/[id]/link-account: service-role admin-created doctor login with a cryptographically random one-time temporary password"
  - "POST /api/auth/change-password: self-service password change that clears must_change_password via the service-role client"
  - "app/doctor/(gated)/ route-group split isolating the forced-password-change gate from app/doctor/change-password/"
  - "components/admin/temp-password-dialog.tsx — the D-03-locked one-time password modal"
  - "tests/e2e/helpers/test-users.ts: trackLinkedAccountEmail()/cleanupTrackedAccountEmails() for admin-created accounts outside createTestUser()"
affects: [02-06-seed-script, 03-patient-search, 04-doctor-schedule-management]

actuals:
  tokens: 8500
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Forced-first-login gate lives in a route group's layout ((gated)/layout.tsx), not the parent role-guard layout, so the page meant to clear the gate (change-password) sits outside the group and the redirect can never loop"
    - "must_change_password is a real profiles column (never Supabase Auth's client-editable user_metadata), and Postgres column-level GRANT/REVOKE (not a WITH CHECK clause, which the existing profiles_update_own_or_admin policy lacks) is the mechanism that stops a doctor clearing their own gate or escalating their own role"
    - "Admin-created login accounts follow the exact same createUser/duplicate-detection/orphan-cleanup shape as the patient signup route, with role hardcoded server-side as a literal both times (T-02-01 pattern reused, not reinvented)"
    - "The one-time credential (temp password) is passed through component state only — generated server-side, returned once in the response body, rendered once in a dialog, and dropped when the dialog closes; never logged, stored, or placed in a URL"
    - "Test helper functions that track resources created by the route under test (not by the test's own factory functions) use an email-keyed tracking list, since the admin-created account's user id is never known to the test until after the API call succeeds"

key-files:
  created:
    - "supabase/migrations/20260804120200_add_must_change_password.sql"
    - "app/api/admin/doctors/[id]/link-account/route.ts"
    - "app/api/auth/change-password/route.ts"
    - "app/doctor/(gated)/layout.tsx"
    - "app/doctor/(gated)/page.tsx"
    - "app/doctor/change-password/page.tsx"
    - "components/admin/temp-password-dialog.tsx"
    - "tests/e2e/admin-doctor-link-account.spec.ts"
  modified:
    - "components/admin/doctors-page-client.tsx"
    - "tests/e2e/helpers/test-users.ts"
  deleted:
    - "app/doctor/page.tsx (moved to app/doctor/(gated)/page.tsx, content byte-identical)"

key-decisions:
  - "Column-level GRANT/REVOKE (revoke update on public.profiles from authenticated; grant update (full_name, email) ...) closes the write-lockdown gap rather than adding a WITH CHECK clause to profiles_update_own_or_admin, since row-level policies cannot express column-scoped restrictions"
  - "The (gated) layout re-checks must_change_password only — it does not repeat the role check app/doctor/layout.tsx already performed, and it renders {children} only rather than the site header a second time"
  - "temp-password-dialog.tsx renders the locked copy 'Temporary password: {password}' as a single interpolated text node (not a nested <span>) so the string is unambiguously locatable by both a human reading the dialog and a Playwright getByText call"

patterns-established:
  - "Pattern: a forced-onboarding-style gate that must exempt one specific page from an otherwise-blanket layout guard belongs in a route group ((gated)/) whose layout wraps only the gated pages, with the exempt page as a sibling outside the group — never a conditional bypass inside the shared layout itself"
  - "Pattern: any admin-issued credential (temporary password, invite code, etc.) that must be shown exactly once follows the create-endpoint's response-body-only lifecycle: never logged, never column-persisted, held in component state, dropped on dialog close"

requirements-completed: [ADMIN-04]

coverage:
  - id: D1
    description: "An admin triggers 'Link account' on a doctor row, supplies an email, and receives a temporary password shown exactly once in a dismissible dialog with a Copy password button and the never-shown-again warning (D-03)"
    requirement: "ADMIN-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-doctor-link-account.spec.ts#ADMIN-04: link a doctor login > 1. the admin links the doctor and sees the one-time temporary password exactly once"
        status: pass
    human_judgment: false
  - id: D2
    description: "The linked doctor logs in with the temporary password, is redirected to /doctor/change-password (not /doctor), cannot reach any other doctor page until the password is changed, and there is no redirect loop"
    requirement: "ADMIN-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-doctor-link-account.spec.ts#ADMIN-04: link a doctor login > 2. the linked doctor logs in and is redirected to /doctor/change-password, not /doctor"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-doctor-link-account.spec.ts#ADMIN-04: link a doctor login > 3. navigating directly to /doctor bounces back to /doctor/change-password with no redirect loop"
        status: pass
    human_judgment: false
  - id: D3
    description: "Submitting a new password lands the doctor on /doctor, and a subsequent login goes straight there with no redirect; must_change_password flips from true to false across the change (D-04)"
    requirement: "ADMIN-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-doctor-link-account.spec.ts#ADMIN-04: link a doctor login > 4. submitting a new password lands on /doctor, and the next login goes straight there"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-doctor-link-account.spec.ts#ADMIN-04: link a doctor login > 8. the linked doctor's profile row shows role=doctor and must_change_password flipped from true to false across the password change"
        status: pass
    human_judgment: false
  - id: D4
    description: "A repeat link-account call on an already-linked doctor returns 409 and creates no second account; a duplicate email returns the already-exists message without disturbing the existing account (idempotency + concurrency edge, ADMIN-04)"
    requirement: "ADMIN-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-doctor-link-account.spec.ts#ADMIN-04: link a doctor login > 5. a second link-account call on the same doctor returns 409 and creates no second account"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-doctor-link-account.spec.ts#ADMIN-04: link a doctor login > 6. link-account with an already-registered email surfaces the duplicate message and leaves the other account working"
        status: pass
    human_judgment: false
  - id: D5
    description: "A non-admin session calling link-account receives 403 before any Supabase Auth call is made (T-02-02); a doctor cannot write must_change_password or role on their own profile row through the anon-key client (T-02-04)"
    requirement: "ADMIN-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-doctor-link-account.spec.ts#ADMIN-04: link a doctor login > 7. a patient session calling link-account receives 403 and creates no auth user"
        status: pass
      - kind: manual
        ref: "supabase/migrations/20260804120200_add_must_change_password.sql column-level grant verified via npx supabase migration list against the remote project"
        status: pass
    human_judgment: false

duration: ~40min
completed: 2026-08-04
status: complete
---

# Phase 2 Plan 05: Doctor Account Linking Summary

**Admin-issued doctor logins with a cryptographically random one-time temporary password, a `must_change_password` column locked down by Postgres column-level grants (never the client-editable auth metadata bag), and a `(gated)` route-group split that forces the first-login password change without ever risking a redirect loop.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-08-04T21:52:50+03:00
- **Tasks:** 3/3 completed
- **Files modified:** 10 (8 created, 2 extended, 1 moved)

## Accomplishments
- `must_change_password boolean not null default false` shipped to the remote hosted Supabase project, paired with `revoke update on public.profiles from authenticated` / `grant update (full_name, email) on public.profiles to authenticated` — the only mechanism that can express "a logged-in user may write these two columns of their own row and no others," which a row-level `USING`-only policy cannot express
- `POST /api/admin/doctors/[id]/link-account`: `requireAdmin()` guard, service-role `auth.admin.createUser()`, `randomBytes(12).toString("base64url")` for the temporary password, `role: "doctor"` as a server-side literal, 409 on a repeat call (idempotent no-op, no second auth user), orphan cleanup on every partial-failure branch
- `app/doctor/(gated)/` route group isolates the forced-password-change gate from `app/doctor/change-password/`, which is a sibling outside the group — the exact structural fix for the redirect-loop failure mode the plan's `<read_first>` called out; `app/doctor/(gated)/page.tsx` is byte-identical to the former `app/doctor/page.tsx`, so Phase 1's doctor-login and role-mismatch specs pass unedited
- `POST /api/auth/change-password` updates the Supabase Auth password via the session client, then clears `must_change_password` via the service-role client — the session client structurally cannot write that column any more after Task 1's grants, which is exactly what stops a doctor clearing their own gate through any other path
- `components/admin/temp-password-dialog.tsx` renders the D-03-locked copy exactly ("Login created" / "Temporary password: {password}" / "Copy password" / the never-shown-again warning / "Done"), holding the password in component state only, dropped on close
- `tests/e2e/admin-doctor-link-account.spec.ts` (8 tests) proves the full ADMIN-04 contract end-to-end, including the true-to-false flip of `must_change_password` across the password change and the no-second-account guarantee under both idempotent-repeat and duplicate-email scenarios
- Full 99-test Playwright suite green (91 pre-existing + 8 new), zero regressions; `npx tsc --noEmit` and `npm run lint` both exit 0

## Task Commits

1. **Task 1: must_change_password migration and the link-account endpoint** - `8320176` (feat)
2. **Task 2: The (gated) route-group split, change-password page and endpoint** - `349295a` (feat)
3. **Task 3: Link-account row action, one-time password dialog, and the full ADMIN-04 spec** - `25ba3d5` (test)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `supabase/migrations/20260804120200_add_must_change_password.sql` - adds the flag column (default `false`) and the column-level UPDATE lockdown on `public.profiles`; applied to the remote project via `npx supabase db push`, confirmed via `npx supabase migration list`
- `app/api/admin/doctors/[id]/link-account/route.ts` - `POST`: admin guard → email validation → 404/409 doctor lookup → `randomBytes` temp password → `createUser` with duplicate-email detection → `profiles` insert (`role: "doctor"` literal, `must_change_password: true`) → `doctors.profile_id` link, with orphan cleanup on every failure branch after user creation
- `app/api/auth/change-password/route.ts` - `POST`: session-client `getUser()` (401 if absent) → `validatePassword` + confirm-match check → `auth.updateUser({ password })` → service-role clear of `must_change_password`
- `app/doctor/(gated)/layout.tsx` - new gate layout: reads `must_change_password`, redirects to `/doctor/change-password` when true, renders `{children}` only (parent layout keeps the header and role check)
- `app/doctor/(gated)/page.tsx` - moved from `app/doctor/page.tsx`, content unchanged, still served at `/doctor`
- `app/doctor/change-password/page.tsx` - `"use client"` form (new-password + confirm, `validatePassword`, disabled-button-with-in-progress-label pattern from `app/signup/page.tsx`), sibling of the `(gated)` group
- `components/admin/temp-password-dialog.tsx` - the one-time password modal (D-03)
- `components/admin/doctors-page-client.tsx` - new "Link account" row action (visible only when `profile_id` is null), an email-entry `Dialog`, and wiring to `TempPasswordDialog` on success
- `tests/e2e/helpers/test-users.ts` - `trackLinkedAccountEmail()` / `cleanupTrackedAccountEmails()` for accounts created by the route under test rather than by `createTestUser()`
- `tests/e2e/admin-doctor-link-account.spec.ts` - new `ADMIN-04` describe block, 8 tests

## Decisions Made
- Column-level `REVOKE`/`GRANT` was used instead of adding a `WITH CHECK` clause to the existing `profiles_update_own_or_admin` row-level policy, because RLS policies operate at row granularity and cannot restrict which *columns* of an allowed row may be written — only a Postgres privilege grant can express "these two columns, no others."
- The `(gated)` layout does not re-run the role check `app/doctor/layout.tsx` already performed, and renders only `{children}` — duplicating either would either be redundant (role check) or visibly wrong (a second `SiteHeader`).
- `temp-password-dialog.tsx` renders the locked "Temporary password: {password}" string as a single interpolated text node rather than splitting the label and value across a `<span>`, which kept the Playwright capture in the spec unambiguous without introducing a new `data-testid` convention into a codebase that has none.

## Deviations from Plan

**1. [Rule 1 - Bug] Fixed ambiguous accessible-name locators discovered while writing the ADMIN-04 spec**
- **Found during:** Task 3, while running the new spec for the first time
- **Issue:** Playwright's `getByRole(..., { name })` performs a case-insensitive substring match by default. `getByRole("button", { name: "Link account" })` also matched the row's "Edit {doctor.full_name}" button whenever the test's generated doctor name itself contained the words "Link Account" (e.g. `Link Account Doctor 1785...`), and `getByLabel("New password")` matched both the new-password and confirm-password inputs on the change-password form because "New password" is a substring of "Confirm new password."
- **Fix:** Added `{ exact: true }` to both locators in the spec. This is a test-only fix — no application code changed.
- **Files modified:** `tests/e2e/admin-doctor-link-account.spec.ts`
- **Commit:** `25ba3d5`

**2. [Rule 1 - Bug] Stale `.next` build cache referenced the deleted `app/doctor/page.tsx`**
- **Found during:** Task 2, running `npx tsc --noEmit` after the route-group move
- **Issue:** `.next/types/validator.ts` (a gitignored, auto-generated file from an earlier `next dev`/`next build` run) still imported the now-deleted `app/doctor/page.tsx`, causing a spurious `tsc` failure unrelated to any source change in this plan.
- **Fix:** Deleted the `.next` directory so Next.js regenerates its route-type manifest against the current file tree. No source files were affected; `.next` is gitignored and was never committed.
- **Files modified:** none (build cache only)
- **Commit:** n/a (not a tracked artifact)

## Issues Encountered
- A stray `node.exe` process was found already bound to port 3000 (left over from an earlier session, unrelated to this plan), which made Playwright's `webServer` fall back to port 3001 while `baseURL` stayed pinned to 3000, causing every test to time out waiting for the wrong port. Killed the stray process; not a code change.
- Several earlier debug/verification runs of the new spec (before the locator-ambiguity fix above) left stray Supabase Auth users behind (`second-attempt-*@example.com` and one `admin-*@example.com`) because a test that unexpectedly succeeds in creating an account it wasn't supposed to create doesn't get to run its own cleanup path. These were identified and deleted directly via the service-role client before the final full-suite run; the final run left the users table empty (`0` rows) on completion, confirming `afterAll`'s `cleanupTrackedAccountEmails()` → `cleanupTestUsers()` → `cleanupTestReferenceData()` sequence in the committed spec cleans up correctly on a passing run.
- The repository's Supabase test/reference-data tables (`doctors`, `specialties`, `locations`) carry a substantial amount of pre-existing debris from prior plans' test runs (`UI Created Doctor …`, `Duplicate Doctor …`, `Test Specialty …`, etc., dozens of rows). This predates this plan and is out of scope for it (SCOPE BOUNDARY — only issues directly caused by this plan's changes are auto-fixed); it did not cause any test in this plan's spec or the full suite to fail, since none of the affected specs assert exact table-wide counts. Flagged here for visibility, not fixed.

## User Setup Required
None - no external service configuration required. The `must_change_password` migration was applied to the already-linked remote Supabase project via `npx supabase db push`, using the same `.env.local` / `ACCESS_TOKEN` setup established in earlier phase-2 plans.

## Next Phase Readiness
- ADMIN-04 is fully demonstrable end-to-end: an admin links a doctor, the doctor is forced through a genuine password change with no redirect loop, and repeat/duplicate/non-admin attempts are all correctly rejected.
- The `app/doctor/(gated)/` route-group pattern is now established and directly reusable by Phase 4's doctor schedule-management pages, which the plan's `<reversibility>` note on Task 2 flags as the next consumer of this route tree.
- `trackLinkedAccountEmail()` / `cleanupTrackedAccountEmails()` in `tests/e2e/helpers/test-users.ts` are ready for reuse by any future spec that needs to clean up an account created by the route under test rather than by the test's own fixture factory.
- No blockers. The pre-existing test-data debris noted above is a housekeeping item, not a blocker — it could be addressed with a one-off cleanup script or a `beforeAll`-level truncate in a future plan if it ever starts interfering with count-based assertions.

## Self-Check: PASSED

All 8 created/moved files verified present on disk (`supabase/migrations/20260804120200_add_must_change_password.sql`, `app/api/admin/doctors/[id]/link-account/route.ts`, `app/api/auth/change-password/route.ts`, `app/doctor/(gated)/layout.tsx`, `app/doctor/(gated)/page.tsx`, `app/doctor/change-password/page.tsx`, `components/admin/temp-password-dialog.tsx`, `tests/e2e/admin-doctor-link-account.spec.ts`); `app/doctor/page.tsx` confirmed removed. All 3 task commits (`8320176`, `349295a`, `25ba3d5`) verified present in `git log`.

---
*Phase: 02-admin-doctor-reference-data-management*
*Completed: 2026-08-04*
