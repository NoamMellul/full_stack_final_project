---
phase: 1
slug: foundation-database-schema-authentication
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (`@playwright/test` 1.62.1) — not yet installed, Wave 0 gap |
| **Config file** | none yet — `playwright.config.ts` is a Wave 0 gap |
| **Quick run command** | `npx playwright test tests/e2e/auth-login.spec.ts` (single file, fastest feedback loop) |
| **Full suite command** | `npx playwright test` |
| **Estimated runtime** | ~30 seconds (7 short auth specs) |

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
| TBD | TBD | TBD | AUTH-01 | Elevation of Privilege | signup Route Handler hardcodes `role: 'patient'` via admin client, never trusts client-supplied role | e2e | `npx playwright test tests/e2e/auth-signup.spec.ts` | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | AUTH-02 | — | Invalid credentials rejected with generic error | e2e | `npx playwright test tests/e2e/auth-login.spec.ts` | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | AUTH-03 | — | Session cookie cleared on logout | e2e | `npx playwright test tests/e2e/auth-logout.spec.ts` | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | AUTH-04 | — | Session persists across browser refresh | e2e | `npx playwright test tests/e2e/auth-session-persistence.spec.ts` | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | AUTH-05 | — | Doctor logs in with admin-created credentials (needs seed/fixture doctor account) | e2e | `npx playwright test tests/e2e/auth-doctor-login.spec.ts` | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | AUTH-06 | Spoofing | Unauthenticated user redirected from protected routes by `proxy.ts` | e2e | `npx playwright test tests/e2e/route-protection-unauthenticated.spec.ts` | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | AUTH-07 | Elevation of Privilege | Role mismatch denied access (`proxy.ts` coarse gate + role-scoped layout fine gate) | e2e | `npx playwright test tests/e2e/route-protection-role-mismatch.spec.ts` | ❌ Wave 0 | ⬜ pending |

*Task IDs/Plan/Wave columns are filled in by the planner once PLAN.md exists.*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npm install -D @playwright/test` + `npx playwright install --with-deps chromium` — gate behind `checkpoint:human-verify` (package flagged `[SUS]` by legitimacy heuristic for being a very recent point-release; underlying signals — Microsoft org, 51.7M weekly downloads — are strong, false positive expected but must be human-confirmed per policy)
- [ ] `playwright.config.ts` — `baseURL` pointing at `http://localhost:3000`, reasonable timeouts
- [ ] `tests/e2e/` directory with the seven spec files listed in the verification map above
- [ ] A fixture/helper to create a doctor login account directly via the admin client (bypassing the not-yet-built Phase 2 admin UI), so AUTH-05's test has a doctor account to log in with
- [ ] Test-user cleanup/uniqueness strategy for signup tests run against the real remote hosted Supabase project (no local Supabase test instance configured) — planner must resolve: unique emails per run (`test-${Date.now()}@example.com`) vs. an admin-client teardown step after each run

---

## Manual-Only Verifications

*None — all phase behaviors have automated (Playwright) verification per the project's Playwright-only testing decision (D-10).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
