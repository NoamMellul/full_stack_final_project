---
phase: 1
slug: foundation-database-schema-authentication
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-03
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (`@playwright/test` 1.62.1) — installed and configured (Plan 01) |
| **Config file** | `playwright.config.ts` — `baseURL: http://localhost:3000`, `workers: 1`, no watch-mode flags |
| **Quick run command** | `npx playwright test tests/e2e/auth-login.spec.ts` (single file, fastest feedback loop) |
| **Full suite command** | `npx playwright test` |
| **Actual runtime (whole-phase gate, Plan 06)** | 45 tests across 8 spec files, 3.0 minutes, all passing |

---

## Sampling Rate

- **After every task commit:** Run the single spec file covering the task just implemented
- **After every plan wave:** Run `npx playwright test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Task 1: End-to-end patient signup — one path only | 02 | 2 | AUTH-01 | Elevation of Privilege | signup Route Handler hardcodes `role: 'patient'` via admin client, never trusts client-supplied role | e2e | `npx playwright test tests/e2e/auth-signup.spec.ts` | ✅ confirmed | ✅ green |
| Task 1: Shared login endpoint and login page with a same-origin return guard | 03 | 3 | AUTH-02 | — | Invalid credentials rejected with the byte-identical generic error on every failure branch (closes the user-enumeration oracle, T-01-08) | e2e | `npx playwright test tests/e2e/auth-login.spec.ts` | ✅ confirmed | ✅ green |
| Task 1: Logout endpoint and the logout control | 04 | 4 | AUTH-03 | — | `signOut()` runs on the cookie-bound SSR server client so `Set-Cookie` clearing headers land on the response | e2e | `npx playwright test tests/e2e/auth-logout.spec.ts` | ✅ confirmed | ✅ green |
| Task 1: Root proxy request gate, session refresh, and browser client | 05 | 4 | AUTH-04 | — | `proxy.ts`/`updateSession()` refreshes session cookies via `getUser()` on every request; a session survives a full reload and a second tab | e2e | `npx playwright test tests/e2e/auth-session-persistence.spec.ts` | ✅ confirmed | ✅ green |
| Task 2: Doctor and admin home bases plus AUTH-05 doctor login coverage | 03 | 3 | AUTH-05 | — | A doctor account created outside any signup route (admin-created stand-in fixture) logs in at `/login` and reaches `/doctor` | e2e | `npx playwright test tests/e2e/auth-doctor-login.spec.ts` | ✅ confirmed | ✅ green |
| Task 1: Root proxy request gate, session refresh, and browser client | 05 | 4 | AUTH-06 | Spoofing | Unauthenticated user redirected from protected routes by `proxy.ts` (root request-interception file, Next.js 16 convention) | e2e | `npx playwright test tests/e2e/route-protection-unauthenticated.spec.ts` | ✅ confirmed | ✅ green |
| Task 2: Exhaustive role-versus-route denial matrix | 05 | 4 | AUTH-07 | Elevation of Privilege | Role mismatch denied access (`proxy.ts` coarse auth-presence gate + role-scoped layout fine gate act as independent defence-in-depth layers) | e2e | `npx playwright test tests/e2e/route-protection-role-mismatch.spec.ts` | ✅ confirmed | ✅ green |
| Task 3: Confirm the applied schema is live on the remote database | 01 | 1 | infrastructure (pre-AUTH-01) | Repudiation | All 10 application tables, both RLS helper functions, and the `availability_slots` anti-double-booking range CHECK are live and reachable on the remote Supabase project before any auth code is written | e2e | `npx playwright test tests/e2e/schema-connectivity.spec.ts` | ✅ confirmed | ✅ green |
| Task 2: Doctor and admin home bases plus AUTH-05 doctor login coverage | 03 | 3 | AUTH-05 (+ admin-login bonus coverage) | — | Same spec file as the AUTH-05 row above also asserts a doctor is denied `/patient` and that an admin account logs in and lands on `/admin` — listed separately because it verifies behavior beyond AUTH-05's literal doctor-login scope | e2e | `npx playwright test tests/e2e/auth-doctor-login.spec.ts` | ✅ confirmed | ✅ green |

*All Task ID/Plan/Wave values above are taken directly from `01-01-SUMMARY.md` through `01-05-SUMMARY.md`'s Task Commits sections and each plan's frontmatter `wave` field.*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `npm install -D @playwright/test` + `npx playwright install --with-deps chromium` — package-legitimacy checkpoint confirmed by direct human approval (npm view + npmjs.com), install performed and independently re-verified on disk (Plan 01)
- [x] `playwright.config.ts` — `baseURL` pointing at `http://localhost:3000`, `workers: 1`, no watch-mode flags (Plan 01)
- [x] `tests/e2e/` directory with the seven spec files listed in the verification map above, plus `schema-connectivity.spec.ts` (8 spec files, 45 tests total, all green as of Plan 06's whole-phase gate)
- [x] A fixture/helper to create a doctor login account directly via the admin client (bypassing the not-yet-built Phase 2 admin UI) — `tests/e2e/helpers/test-users.ts`'s `createTestUser({ role: "doctor" })`, consumed by AUTH-05's spec (Plan 01/03)
- [x] Test-user cleanup/uniqueness strategy for signup tests run against the real remote hosted Supabase project — unique `@example.com` addresses per run plus `cleanupTestUsers` teardown (Plan 01)

---

## Manual-Only Verifications

*None — all phase behaviors have automated (Playwright) verification per the project's Playwright-only testing decision (D-10).*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — every task across Plans 01-06 carries a Playwright `<automated>` verify block or a Wave 0 fixture dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — confirmed by walking Plans 01-06's Task Commits sections
- [x] Wave 0 covers all MISSING references — all five Wave 0 requirements above are delivered and checked off
- [x] No watch-mode flags — `playwright.config.ts` has none; confirmed by reading the file
- [x] Feedback latency < 30s — holds for the intended single-spec-file quick-run loop (`npx playwright test tests/e2e/auth-login.spec.ts`); the full 8-file/45-test suite run at this phase gate takes ~3 minutes, which is expected and does not violate the per-task sampling contract
- [x] `nyquist_compliant: true` set in frontmatter

## Consolidated Security Sweep (Plan 06, Task 1)

Re-asserts every mitigate-disposition threat from the five plan registers (T-01-20) in one pass, against the merged Phase 1 codebase:

| Check | Command | Result |
|-------|---------|--------|
| Root request-interception file is the Next.js 16 name; legacy filename absent | `test -f proxy.ts && test ! -f middleware.ts` | ✅ pass |
| Unrevalidated cookie-read session accessor (`getSession`) appears nowhere in the app surface | `! grep -rq "getSession" app lib components proxy.ts` | ✅ pass |
| Service-role key name confined to exactly the app module and the test helper | `grep -rl "SUPABASE_SERVICE_ROLE_KEY" --include=*.ts --include=*.tsx app lib components tests` | ✅ pass — exactly `lib/supabase/admin.ts`, `tests/e2e/helpers/supabase-admin.ts` |
| `lib/supabase/admin.ts` carries its server-only import | `grep -q "server-only" lib/supabase/admin.ts` | ✅ pass |
| Signup Route Handler writes its role literal inline | `grep -q 'role: "patient"' app/api/auth/signup/route.ts` | ✅ pass |
| No role folder uses Next.js route-group parentheses | `find app -type d -name "(*"` | ✅ pass — no matches |
| No physical-direction Tailwind utility under `app`/`components` | `! grep -rqE '\b(pl-\|pr-\|ml-\|mr-\|text-left\|text-right)' app components` | ✅ pass (after in-gate fix, see below) |

**In-gate fix:** `app/page.tsx` (the untouched `create-next-app` scaffold homepage, outside every plan's stated file scope) used `sm:text-left`. This is out-of-scope UI (`/` is not part of Phase 1's surface per `01-UI-SPEC.md`), but the sweep's own acceptance criterion (`! grep -rqE ... app components`) is repo-wide with no scope carve-out, so the check would otherwise fail the gate. Fixed inline (Rule 1) by changing `sm:text-left` to `sm:text-start`, matching the RTL logical-property convention already established everywhere else in the codebase. Re-ran `npx tsc --noEmit`, `npm run build`, `npm run lint` after the fix — all still exit 0.

**Whole-phase automated gate (Plan 06, Task 1):**

| Command | Exit |
|---------|------|
| `npx playwright test` (full suite, no filter) | 0 — 45/45 passed |
| `npx tsc --noEmit` | 0 |
| `npm run build` | 0 |
| `npm run lint` | 0 |

**Approval:** Automated phase gate — approved (all commands above green, security sweep clean, verification map fully populated with every plan/wave/spec value resolved). UI-SPEC backstop rows remain pending direct human visual confirmation (see `01-UI-SPEC.md` Checker Sign-Off and this plan's Task 2 checkpoint) before the phase as a whole is considered fully signed off.
