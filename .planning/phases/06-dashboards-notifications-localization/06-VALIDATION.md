---
phase: 6
slug: dashboards-notifications-localization
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-11
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.62.1 [VERIFIED: package.json] |
| **Config file** | `playwright.config.ts` (testDir `./tests/e2e`, single chromium project, `webServer` auto-starts `npm run dev`) [VERIFIED] |
| **Quick run command** | `npx playwright test tests/e2e/<file>.spec.ts` |
| **Full suite command** | `npx playwright test` |
| **Estimated runtime** | ~existing suite runtime (28 spec files across Phases 1-5) + 5 new spec files; the D-04 retrofit re-exercises all 28 existing specs after string extraction, so full-suite runtime is the primary regression signal this phase |

---

## Sampling Rate

- **After every task commit:** Run the targeted spec file for the task's endpoint/page (e.g. `npx playwright test tests/e2e/patient-favorites.spec.ts`)
- **After every plan wave:** Run `npx playwright test` (full suite) — critical for this phase since D-04's retrofit touches ~28 existing files and can silently break existing Phase 1-5 specs if a `t()` extraction drops or mistranslates a string an existing spec asserts on
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** target keeping targeted-spec runs under ~60s; full suite as per existing project baseline

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-xx | TBD | TBD | PATIENT-01/02/03 | IDOR | Add/remove/list favorites; toggle reflected at both entry points (D-01), scoped to signed-in patient | e2e | `npx playwright test tests/e2e/patient-favorites.spec.ts` | ❌ W0 | ⬜ pending |
| 06-xx | TBD | TBD | PATIENT-04 | — | Patient dashboard shows correct upcoming-appointment summary | e2e | `npx playwright test tests/e2e/patient-dashboard.spec.ts` | ❌ W0 | ⬜ pending |
| 06-xx | TBD | TBD | DOCTOR-01/02 | — | Doctor dashboard shows correct upcoming-appointment count and remaining-available-slot count | e2e | `npx playwright test tests/e2e/doctor-dashboard.spec.ts` | ❌ W0 | ⬜ pending |
| 06-xx | TBD | TBD | NOTIF-01/02/03/04 | IDOR / RLS scoping | Live in-app notification on booking/cancel/reschedule for the correct recipient only, no reload required | e2e (concurrency — asserts a live UI update via Playwright's auto-retrying `expect()` polling, no manual `sleep`) | `npx playwright test tests/e2e/notifications-realtime.spec.ts` | ❌ W0 | ⬜ pending |
| 06-xx | TBD | TBD | I18N-01/02 | — | Switch locale from any page; RTL mirroring correct on `<html dir>`, no wrong-direction flash on fresh navigation | e2e | `npx playwright test tests/e2e/locale-switching.spec.ts` | ❌ W0 | ⬜ pending |

*Task IDs / plan / wave columns are TBD pending gsd-planner output — the planner and plan-checker reconcile these against the actual PLAN.md task IDs.*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/e2e/patient-favorites.spec.ts` — stubs for PATIENT-01/02/03, both entry points (D-01)
- [ ] `tests/e2e/patient-dashboard.spec.ts` — stub for PATIENT-04
- [ ] `tests/e2e/doctor-dashboard.spec.ts` — stub for DOCTOR-01/02
- [ ] `tests/e2e/notifications-realtime.spec.ts` — stubs for NOTIF-01-04; must assert a live update (no reload) via a second browser context or a service-role fixture insert while the first context's bell is mounted
- [ ] `tests/e2e/locale-switching.spec.ts` — stub for I18N-01/02; assert `dir="rtl"` and `lang="he"` on `<html>` after switching, and no wrong-direction flash on a fresh navigation (cookie already set)
- [ ] `tests/e2e/helpers/favorites.ts` — new fixture helper (service-role insert/cleanup), mirroring `tests/e2e/helpers/appointments.ts`'s existing pattern [VERIFIED: tests/e2e/helpers/appointments.ts]
- [ ] `tests/e2e/helpers/notifications.ts` — new fixture helper for asserting/seeding notification rows via `testAdminClient()`, same pattern
- [ ] Framework install: none needed — Playwright already installed and configured

---

## Manual-Only Verifications

*None — all phase behaviors have automated (Playwright e2e) verification per the Phase Requirements → Test Map above.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency acceptable (targeted spec runs fast; full suite before phase gate, especially given the D-04 retrofit's regression risk on existing Phase 1-5 specs)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
