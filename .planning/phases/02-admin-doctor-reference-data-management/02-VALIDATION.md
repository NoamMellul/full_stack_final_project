---
phase: 2
slug: admin-doctor-reference-data-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-04
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.62.1 |
| **Config file** | `playwright.config.ts` (testDir `./tests/e2e`, `baseURL: http://localhost:3000`, `webServer` auto-starts `npm run dev`) |
| **Quick run command** | `npx playwright test tests/e2e/<file>.spec.ts` |
| **Full suite command** | `npx playwright test` |
| **Estimated runtime** | ~60 seconds (full suite, including Phase 1 specs) |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test tests/e2e/<file>.spec.ts` (the single new/changed spec)
- **After every plan wave:** Run `npx playwright test` (full suite — must not regress Phase 1's auth/route-protection specs)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01 | TBD | 1 | ADMIN-01, ADMIN-02 | T-02-01 | Server hardcodes `is_demo`/`is_active` defaults, never trusts client input for role/status fields | e2e | `npx playwright test tests/e2e/admin-doctor-crud.spec.ts` | ❌ Wave 0 | ⬜ pending |
| 02-02 | TBD | 1 | ADMIN-03 | T-02-02 | Deactivated doctor immediately excluded from public RLS-gated read | e2e | `npx playwright test tests/e2e/admin-doctor-status.spec.ts` | ❌ Wave 0 | ⬜ pending |
| 02-03 | TBD | 1 | ADMIN-04 | T-02-03, T-02-04 | Temp password returned once via CSPRNG, never logged/persisted; `must_change_password` gate enforced at layout/middleware, not via client-editable `user_metadata` | e2e | `npx playwright test tests/e2e/admin-doctor-link-account.spec.ts` | ❌ Wave 0 | ⬜ pending |
| 02-04 | TBD | 1 | ADMIN-05, ADMIN-06 | T-02-05 | Delete guard enforced server-side (FK `on delete restrict` + friendly error translation), not just a disabled client button | e2e | `npx playwright test tests/e2e/admin-reference-data.spec.ts` | ❌ Wave 0 | ⬜ pending |
| 02-05 | TBD | 1 | ADMIN-07, ADMIN-08 | T-02-06 | Admin-only read access enforced via RLS `is_admin()` + route-level role check (defense-in-depth) | e2e | `npx playwright test tests/e2e/admin-oversight-views.spec.ts` | ❌ Wave 0 | ⬜ pending |
| 02-06 | TBD | 1 | (cross-cutting) | T-02-06 | Non-admin denied access to `/admin/*` and `/api/admin/*` at both layout and route-handler level | e2e | `npx playwright test tests/e2e/admin-route-protection.spec.ts` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs/plan/wave columns are placeholders — finalized once `gsd-planner` assigns actual task IDs and wave numbers.*

---

## Wave 0 Requirements

- [ ] `tests/e2e/admin-doctor-crud.spec.ts` — stubs for ADMIN-01, ADMIN-02
- [ ] `tests/e2e/admin-doctor-status.spec.ts` — stub for ADMIN-03
- [ ] `tests/e2e/admin-doctor-link-account.spec.ts` — stub for ADMIN-04 (needs a cleanup helper extending `tests/e2e/helpers/test-users.ts` / `supabase-admin.ts`, same pattern as `cleanupTestUsers()`)
- [ ] `tests/e2e/admin-reference-data.spec.ts` — stubs for ADMIN-05, ADMIN-06, including the delete-guard UX
- [ ] `tests/e2e/admin-oversight-views.spec.ts` — stubs for ADMIN-07, ADMIN-08
- [ ] `tests/e2e/admin-route-protection.spec.ts` — non-admin denial, extending `tests/e2e/route-protection-role-mismatch.spec.ts`'s existing pattern
- [ ] Framework install: none needed — Playwright is already configured project-wide.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Seed script idempotency | (seed script, no REQ-ID) | Playwright covers browser flows, not CLI scripts; project has no Vitest/Node test runner (CLAUDE.md constraint: Playwright only) | Run the seed script twice; diff row counts in `doctors`/`specialties`/`locations` via the Supabase dashboard or `npx supabase db query` — second run must add zero new rows |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
