---
phase: 5
slug: appointment-booking-lifecycle
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-10
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.62.1 [VERIFIED: package.json:32] |
| **Config file** | `playwright.config.ts` (existing, `fullyParallel: false`, `workers: 1` per `doctor-schedule-overlap.spec.ts` comment) |
| **Quick run command** | `npx playwright test tests/e2e/appointment-booking.spec.ts` |
| **Full suite command** | `npx playwright test` |
| **Estimated runtime** | ~existing suite runtime + 4 new spec files (concurrency specs run serially per `workers: 1`) |

---

## Sampling Rate

- **After every task commit:** Run the targeted spec file for the task's endpoint (e.g. `npx playwright test tests/e2e/appointment-booking.spec.ts`)
- **After every plan wave:** Run `npx playwright test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** target keeping targeted-spec runs under ~60s; full suite as per existing project baseline

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-xx | TBD | TBD | APPT-01 | — | Patient books an available slot | e2e | `npx playwright test tests/e2e/appointment-booking.spec.ts` | ❌ W0 | ⬜ pending |
| 05-xx | TBD | TBD | APPT-02 | Race condition / double-booking | Two concurrent booking attempts on the same slot: exactly one 201, one 409 | e2e (concurrency, `Promise.all`) | `npx playwright test tests/e2e/appointment-booking.spec.ts` | ❌ W0 | ⬜ pending |
| 05-xx | TBD | TBD | APPT-03 | — | Booking a past slot rejected | e2e | `npx playwright test tests/e2e/appointment-booking.spec.ts` | ❌ W0 | ⬜ pending |
| 05-xx | TBD | TBD | APPT-04 | — | Booking immediately flips slot to unavailable | e2e | `npx playwright test tests/e2e/appointment-booking.spec.ts` | ❌ W0 | ⬜ pending |
| 05-xx | TBD | TBD | APPT-05 | IDOR | Patient cancels own upcoming appointment | e2e | `npx playwright test tests/e2e/appointment-cancel.spec.ts` | ❌ W0 | ⬜ pending |
| 05-xx | TBD | TBD | APPT-06 | IDOR | Doctor cancels a patient's appointment | e2e | `npx playwright test tests/e2e/appointment-cancel.spec.ts` | ❌ W0 | ⬜ pending |
| 05-xx | TBD | TBD | APPT-07 | — | Cancelling frees the slot for rebooking | e2e | `npx playwright test tests/e2e/appointment-cancel.spec.ts` | ❌ W0 | ⬜ pending |
| 05-xx | TBD | TBD | APPT-08 | — | Patient reschedules to another available slot | e2e | `npx playwright test tests/e2e/appointment-reschedule.spec.ts` | ❌ W0 | ⬜ pending |
| 05-xx | TBD | TBD | APPT-09 | Race condition | Reschedule releases old + reserves new atomically, no window with neither held | e2e (concurrency) | `npx playwright test tests/e2e/appointment-reschedule.spec.ts` | ❌ W0 | ⬜ pending |
| 05-xx | TBD | TBD | APPT-10/11 | IDOR | Patient views upcoming/past appointments | e2e | `npx playwright test tests/e2e/appointment-history.spec.ts` | ❌ W0 | ⬜ pending |
| 05-xx | TBD | TBD | APPT-12/13 | IDOR | Doctor views upcoming/past appointments | e2e | `npx playwright test tests/e2e/appointment-history.spec.ts` | ❌ W0 | ⬜ pending |

*Task IDs / plan / wave columns are TBD pending gsd-planner output — the planner and plan-checker reconcile these against the actual PLAN.md task IDs.*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/e2e/appointment-booking.spec.ts` — stubs for APPT-01/02/03/04
- [ ] `tests/e2e/appointment-cancel.spec.ts` — stubs for APPT-05/06/07
- [ ] `tests/e2e/appointment-reschedule.spec.ts` — stubs for APPT-08/09
- [ ] `tests/e2e/appointment-history.spec.ts` — stubs for APPT-10/11/12/13
- [ ] Framework install: none needed — Playwright already installed and configured
- [ ] `tests/e2e/helpers/appointments.ts` already exists (Phase 2, service-role seeding fixtures) — reusable for seeding pre-existing appointments in cancel/reschedule/history specs; the booking spec itself must exercise the real `POST /api/appointments` endpoint, not this fixture, to prove the RPC path

---

## Manual-Only Verifications

*None — all phase behaviors have automated (Playwright e2e) verification per the Phase Requirements → Test Map above.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency acceptable (targeted spec runs fast; full suite before phase gate)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
