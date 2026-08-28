---
phase: quick-260817-eqs
plan: 01
subsystem: auth
tags: [rls, postgres, supabase, playwright, security, guards]

requires:
  - phase: 01-foundation-database-schema-authentication
    provides: profiles table, is_admin()/is_doctor_owner() security-definer helpers, requireAdmin()/requireDoctor()/requirePatient() guards, safeRedirectPath, lib/validation/auth.ts
provides:
  - profiles_insert_own RLS policy narrowed to role='patient' — closes total-authorization-compromise self-escalation
  - requireDoctor() enforces must_change_password on every /api/doctor/* route, not just the page layout
  - safeRedirectPath rejects backslash-prefixed payloads (browser-normalization open-redirect bypass)
  - validateEmail/validatePassword/validateFullName typeof-guard non-string input instead of throwing
  - requireAdmin() error branch matches its two sibling guards (500 instead of masked 403)
  - doctor-requests and login routes guard request.json() with try/catch + null-body normalization
affects: [security-review, gsd-secure-phase, phase-06-verification]

actuals:
  tokens: 5317
  tasks: 6
  commits: 6

tech-stack:
  added: []
  patterns:
    - "RLS policy narrowing via a new timestamped migration, never editing an applied one — header comment states finding, attack path, why the fix doesn't break legitimate writes"
    - "Playwright malformed-JSON-body tests must send a raw Buffer, not a string data payload — Playwright's fetch client JSON.stringify()'s a non-parsable string paired with a JSON content-type, silently producing a valid body"

key-files:
  created:
    - supabase/migrations/20260817120000_harden_profiles_self_insert_role.sql
    - tests/e2e/profiles-rls-escalation.spec.ts
  modified:
    - tests/e2e/helpers/test-users.ts
    - lib/auth/require-doctor.ts
    - lib/auth/require-admin.ts
    - lib/validation/redirect.ts
    - lib/validation/auth.ts
    - app/api/doctor-requests/route.ts
    - app/api/auth/login/route.ts
    - tests/e2e/admin-doctor-link-account.spec.ts
    - tests/e2e/auth-login.spec.ts
    - tests/e2e/auth-signup.spec.ts
    - tests/e2e/doctor-request.spec.ts

key-decisions:
  - "profiles_insert_own's new WITH CHECK matches the repo's existing style exactly (no (select auth.uid()) initplan wrapping, no explicit TO authenticated clause) rather than introducing the skill's performance-optimal form, since every sibling profiles policy already carries the identical pre-existing auth_rls_initplan PERFORMANCE advisor warning and this migration's job was narrowing role, not a performance pass"
  - "validateFullName also received the typeof guard (plan left this at executor discretion) since app/api/auth/signup/route.ts passes body.fullName straight through untyped — identical crash shape to email/password, fixed in the same commit"

requirements-completed: [QUICK-260817-eqs]

coverage:
  - id: D1
    description: "profiles RLS blocks self-inserted role='admin'/'doctor', allows role='patient' (T-EQS-01, critical)"
    requirement: QUICK-260817-eqs
    verification:
      - kind: e2e
        ref: "tests/e2e/profiles-rls-escalation.spec.ts — all 3 cases"
        status: pass
    human_judgment: false
  - id: D2
    description: "requireDoctor() 403s /api/doctor/* while must_change_password is true, succeeds once cleared (T-EQS-02)"
    requirement: QUICK-260817-eqs
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-doctor-link-account.spec.ts — tests 3b, 4b"
        status: pass
    human_judgment: false
  - id: D3
    description: "safeRedirectPath rejects backslash-prefixed from param (T-EQS-03)"
    requirement: QUICK-260817-eqs
    verification:
      - kind: e2e
        ref: "tests/e2e/auth-login.spec.ts — 'a backslash-prefixed from param never sends the browser off-site'"
        status: pass
    human_judgment: false
  - id: D4
    description: "validateEmail/validatePassword return a validation error instead of throwing on non-string input (T-EQS-04)"
    requirement: QUICK-260817-eqs
    verification:
      - kind: e2e
        ref: "tests/e2e/auth-signup.spec.ts — 'a non-string email in the request body returns 400, not a 500'"
        status: pass
    human_judgment: false
  - id: D5
    description: "requireAdmin() returns 500 (not masked 403) on a profiles lookup error (T-EQS-05)"
    requirement: QUICK-260817-eqs
    verification: []
    human_judgment: true
    rationale: "The new 500 branch requires forcing a profiles SELECT error mid-run, unreachable from a Playwright test given the Playwright-only project constraint. admin-route-protection.spec.ts's 30 tests confirm the untouched 401/403 branches still pass; the 500 branch is verified by code inspection (byte-match against requirePatient()/requireDoctor()'s already-proven identical pattern) only."
  - id: D6
    description: "doctor-requests and login guard request.json() with try/catch + null-body normalization, returning 400 not 500 (T-EQS-06)"
    requirement: QUICK-260817-eqs
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-request.spec.ts — '6. a malformed JSON body returns 400, not a 500'; tests/e2e/auth-login.spec.ts — 'a malformed JSON body returns 400 with the byte-identical generic error'"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-08-17
status: complete
---

# Quick Task 260817-eqs Summary

**Closed a critical `profiles` RLS self-escalation hole (role='admin'/'doctor' via direct anon-key insert) plus five defence-in-depth findings across the doctor guard, redirect validation, and two route handlers, each as its own atomic commit and its own Playwright proof.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-08-17T07:10:00Z
- **Completed:** 2026-08-17T08:05:54Z
- **Tasks:** 6/6
- **Files modified:** 13 (2 created, 11 modified)

## Accomplishments

- **T-EQS-01 (critical):** New migration `20260817120000_harden_profiles_self_insert_role.sql` narrows `profiles_insert_own`'s `WITH CHECK` from `id = auth.uid()` to `id = auth.uid() AND role = 'patient'`. Applied live to the linked remote project via `npx supabase db push --linked` (no sandbox block this time). `npx supabase db advisors --linked` confirmed no new SECURITY-category finding on `profiles` — the policy carries the same pre-existing PERFORMANCE `auth_rls_initplan` warning its two siblings already had, unrelated to this change.
- **T-EQS-02:** `requireDoctor()` now looks up `must_change_password` after the existing doctor-ownership check and 403s every `/api/doctor/*` route with a distinct message while the flag is true — closing the gap left by the `(gated)` layout, which only ever blocked the doctor *pages*.
- **T-EQS-03:** `safeRedirectPath` rejects any backslash anywhere in the raw value, closing the `/\evil.example.com` browser-normalization bypass that slipped past the existing `//` and `:` guards.
- **T-EQS-04:** `validateEmail`, `validatePassword`, and (additionally, at executor discretion) `validateFullName` now typeof-guard non-string input and return the existing required-field message instead of throwing on `.trim()`/`.length`.
- **T-EQS-05:** `requireAdmin()` now byte-matches its two sibling guards: `.maybeSingle()` + a genuine 500 on a lookup error, instead of silently treating a DB error as `profile === null` and a masked 403.
- **T-EQS-06:** Both `app/api/doctor-requests/route.ts` and `app/api/auth/login/route.ts` now guard `request.json()` with the project's established try/catch + null-body-normalization pattern (mirrored from `app/api/appointments/route.ts`), returning a clean 400 instead of an unhandled 500 on malformed JSON. The login route restates its own byte-identical generic credential string on parse failure rather than the shared `Invalid request body.` message, preserving its non-oracle guarantee (T-01-08).

## Task Commits

1. **Task 1: constrain self-inserted profiles rows to role='patient'** - `fb30788` (fix)
2. **Task 2: enforce must_change_password inside requireDoctor()** - `4c7b252` (fix)
3. **Task 3: reject backslashes in safeRedirectPath** - `226d999` (fix)
4. **Task 4: typeof guards in validateEmail/validatePassword/validateFullName** - `0c29050` (fix)
5. **Task 5: handle the profiles lookup error in requireAdmin()** - `0bdb555` (fix)
6. **Task 6: try/catch around request.json() in doctor-requests and login** - `2ed784a` (fix)

_All six commits are single-task, single-concern — verified via `git show --stat` that each touches only its own task's declared files._

## Files Created/Modified

- `supabase/migrations/20260817120000_harden_profiles_self_insert_role.sql` - new migration narrowing `profiles_insert_own`; applied live to the linked remote project
- `tests/e2e/profiles-rls-escalation.spec.ts` - new spec proving the RLS boundary directly (3 cases: admin rejected, doctor rejected, patient succeeds)
- `tests/e2e/helpers/test-users.ts` - added `createBareAuthUser()` (auth user with no `profiles` row, avoids a false-pass PK conflict masking the RLS rejection)
- `lib/auth/require-doctor.ts` - added the `must_change_password` lookup + 403 branch after the existing doctor-ownership check
- `lib/auth/require-admin.ts` - `.maybeSingle()` + error-branch 500, matching `requirePatient()`/`requireDoctor()`
- `lib/validation/redirect.ts` - added the backslash rejection to `safeRedirectPath`
- `lib/validation/auth.ts` - typeof guards on `validateEmail`, `validatePassword`, `validateFullName`
- `app/api/doctor-requests/route.ts` - try/catch + null-body normalization around `request.json()`
- `app/api/auth/login/route.ts` - same pattern, restating the route's own generic credential string on parse failure
- `tests/e2e/admin-doctor-link-account.spec.ts` - two new cases (3b, 4b) proving the `/api/doctor/slots` 403/success lifecycle around `must_change_password`
- `tests/e2e/auth-login.spec.ts` - two new cases: backslash `from=` off-site rejection, malformed-JSON-body 400
- `tests/e2e/auth-signup.spec.ts` - one new case: non-string `email` returns 400 not 500
- `tests/e2e/doctor-request.spec.ts` - one new case: malformed-JSON-body 400

## Decisions Made

- **Migration policy style matched the repo exactly, not the skill's performance-optimal form.** The `supabase-postgres-best-practices` skill recommends wrapping `auth.uid()` in `(select auth.uid())` for initplan caching and adding an explicit `TO authenticated` clause. Every existing `profiles` policy (and every other RLS policy in the repo) uses neither. Since the plan's own instruction was to match existing file style for this specific narrowing, and `npx supabase db advisors --linked` confirmed the new policy triggers only the identical pre-existing PERFORMANCE warning its siblings already carry (not a new SECURITY finding), the migration was written in the repo's plain style. A future performance pass across all three `profiles` policies together would be the right place to adopt the skill's caching form, not this security-scoped fix.
- **`validateFullName` got the same typeof guard as `validateEmail`/`validatePassword`, in the same commit.** The plan explicitly left this at executor discretion ("if you add it there too, keep it in the same commit"). `app/api/auth/signup/route.ts` passes `body.fullName` straight through untyped, identical to `email`/`password`, so leaving it unguarded would have been an inconsistent half-fix of the same bug class.

## Deviations from Plan

None — plan executed exactly as written. All `read_first` verification steps (grep for `profiles` insert call sites, grep for `requireDoctor()` call sites, confirming `change-password` doesn't call `requireDoctor()`) confirmed the plan's stated assumptions before each edit; no assumption was found wrong.

## Issues Encountered

- The plan's suggested Playwright pattern for the malformed-JSON-body tests (`data: "{ not json"` as a raw string) would have been silently defeated: Playwright's fetch client `JSON.stringify()`s a non-parsable string paired with a `Content-Type: application/json` header, producing a *valid* JSON string body instead of malformed JSON. Found this precedent already documented and worked around in `appointment-booking.spec.ts` test 9 (`Buffer.from(...)` instead of a string) and applied the same fix to both new malformed-body tests in Task 6.
- `npx supabase db push --linked` was **not** blocked by the sandbox this session (the plan's documented fallback — applying via the dashboard SQL editor — was not needed). The migration applied cleanly on the first attempt.

## User Setup Required

None - no external service configuration required. The one infrastructure change (the RLS migration) was applied automatically to the linked remote Supabase project as part of Task 1.

## Next Phase Readiness

- All 6 fixes are live on the linked remote database and in the codebase; the two most severe findings (T-EQS-01 critical, T-EQS-02 medium) close real elevation-of-privilege paths reachable by any authenticated or admin-issued-temp-password user.
- The full targeted verification suite (73 tests across `profiles-rls-escalation.spec.ts`, `admin-doctor-link-account.spec.ts`, `auth-login.spec.ts`, `auth-signup.spec.ts`, `admin-route-protection.spec.ts`, `doctor-request.spec.ts`) passed cleanly in a single run — no shared-dev-DB residue flakiness this session.
- `npx tsc --noEmit`, `npx eslint .`, and `npm run build` all pass clean.
- T-EQS-05's 500 branch remains a permanently untestable gap under the Playwright-only constraint (documented above and in coverage D5) — consistent with the same accepted gap already present in `requirePatient()`/`requireDoctor()` since Phase 2.
- No blockers for the next phase or for `/gsd-ship`.

---
*Quick task: 260817-eqs*
*Completed: 2026-08-17*

## Self-Check: PASSED

All 13 files listed in Files Created/Modified confirmed present on disk. All 6 task commit hashes (`fb30788`, `4c7b252`, `226d999`, `0c29050`, `0bdb555`, `2ed784a`) confirmed present in `git log`.
