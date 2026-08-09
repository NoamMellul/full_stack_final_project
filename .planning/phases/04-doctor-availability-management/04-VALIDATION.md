---
phase: 4
slug: doctor-availability-management
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-08
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (`@playwright/test`) — the project's only test framework (CLAUDE.md: Playwright end-to-end only, no Vitest, no React Testing Library) |
| **Config file** | `playwright.config.ts` — `testDir: ./tests/e2e`, `fullyParallel: false`, `workers: 1` |
| **Quick run command** | `npx playwright test tests/e2e/<spec>.spec.ts` |
| **Full suite command** | `npx playwright test` (matches `.planning/config.json` `workflow.test_command`) |
| **Estimated runtime** | ~30-60s per new spec; full suite grows to ~24 spec files by the end of this phase |

**Framework install:** none required. Playwright and every fixture helper this phase needs (`createTestUser`, `createTestSpecialty`, `createTestLocation`, `createTestDoctor`, `createTestSlots`, `testAdminClient`, the anon client, and the three cleanup functions) already exist in `tests/e2e/helpers/`.

---

## Sampling Rate

- **After every task commit:** Run the specific spec file that task authors or asserts against, e.g. `npx playwright test tests/e2e/doctor-schedule-add-slot.spec.ts`
- **After every plan wave:** Run `npx playwright test` (full suite) — the shared remote development database means every new spec must clean up after itself via `cleanupTestSlots()` / `cleanupTestReferenceData()` / `cleanupTestUsers()`, as every prior phase's specs do
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~60 seconds for a single spec

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-T1 | 01 | 1 | AVAIL-06 (D-04 column shape) | — | N/A — human decision checkpoint on a one-way migration | checkpoint | n/a (blocking decision) | n/a | ⬜ pending |
| 04-01-T2 | 01 | 1 | AVAIL-06 | — | Nullable column, no default, no existing row given a placeholder value | cli | `npx supabase migration list \| grep 20260809120000` | ❌ authored in 04-01 T2 | ⬜ pending |
| 04-01-T3 | 01 | 1 | AVAIL-01, AVAIL-02, AVAIL-03 | T-04-01, T-04-02, T-04-05 | `doctor_id` resolved from `auth.uid()` and never from the body; insert always attempted so `23P01` is the authoritative overlap rejection; one generic overlap message | e2e | `npx playwright test tests/e2e/doctor-schedule-add-slot.spec.ts` | ❌ authored in 04-01 T3 | ⬜ pending |
| 04-02-T1 | 02 | 2 | AVAIL-04, AVAIL-05 | T-04-03, T-04-04, T-04-08, T-04-09 | Lookup and delete both scoped by `id` + `doctor_id`; foreign id returns the same 404 as a missing one; `booked` status read live per request and rejected with 409; exactly one statement, no compensating write | e2e | `npx playwright test tests/e2e/doctor-schedule-delete-slot.spec.ts` | ❌ authored in 04-02 T3 | ⬜ pending |
| 04-02-T2 | 02 | 2 | AVAIL-04, AVAIL-05 | T-04-04 | No delete control rendered for a `booked` row (omitted, not disabled); a rejected delete announces in an `aria-live` region and refreshes the list | e2e | `npx playwright test tests/e2e/doctor-schedule-delete-slot.spec.ts` | ❌ authored in 04-02 T3 | ⬜ pending |
| 04-02-T3 | 02 | 2 | AVAIL-04, AVAIL-05 | T-04-03, T-04-04 | Double delete → 404 not 500; concurrent delete → exactly one success; foreign slot id → 404 with no side effect | e2e | `npx playwright test tests/e2e/doctor-schedule-delete-slot.spec.ts` | ❌ authored in this task | ⬜ pending |
| 04-03-T1 | 03 | 3 | AVAIL-06, AVAIL-07 | T-04-01, T-04-02, T-04-05, T-04-06 | Session-resolved `doctor_id`; one row per block; `23P01` → the identical generic 409 string as the add-slot path; reason stored verbatim or null with no content validation | e2e | `npx playwright test tests/e2e/doctor-schedule-block-period.spec.ts` | ❌ authored in 04-03 T3 | ⬜ pending |
| 04-03-T2 | 03 | 3 | AVAIL-06 | T-04-06, T-04-10 | Reason rendered as an escaped JSX text child, never `dangerouslySetInnerHTML`; label/placeholder framed as a doctor-side operational note only | e2e | `npx playwright test tests/e2e/doctor-schedule-block-period.spec.ts` | ❌ authored in 04-03 T3 | ⬜ pending |
| 04-03-T3 | 03 | 3 | AVAIL-06, AVAIL-07 | T-04-01, T-04-05 | All three D-03 worked examples produce exactly one row; adjacency accepted in both directions; overlap rejected with the generic message | e2e | `npx playwright test tests/e2e/doctor-schedule-block-period.spec.ts` | ❌ authored in this task | ⬜ pending |
| 04-04-T1 | 04 | 4 | AVAIL-03, AVAIL-07 | T-04-02, T-04-05 | Two concurrent overlapping writes resolve to exactly `[201, 409]` on the same path and across both paths; six-way status matrix all 409; one identical message; rejection leaves row count unchanged | e2e | `npx playwright test tests/e2e/doctor-schedule-overlap.spec.ts` | ❌ authored in this task | ⬜ pending |
| 04-04-T2 | 04 | 4 | AVAIL-03, AVAIL-07 | T-04-01, T-04-03, T-04-04, T-04-06 | Cross-doctor write/delete/read all rejected with no side effect; anonymous and patient clients see no `blocked`/`booked` row and no `reason`; a `booked` row is unchanged after every write path | e2e | `npx playwright test tests/e2e/doctor-schedule-visibility.spec.ts` | ❌ authored in this task | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity:** no three consecutive tasks lack an `<automated>` verify. The only task without an e2e command is `04-01-T1`, a blocking human decision checkpoint, and it is immediately followed by `04-01-T2`'s CLI verify and `04-01-T3`'s e2e verify.

---

## Wave 0 Requirements

Every spec file this phase needs is authored inside the task whose behaviour it proves, which is the pattern every prior phase of this project used (Phase 3's specs were authored task-by-task, not front-loaded). No separate Wave 0 pass is required.

- [x] Framework install — none needed; Playwright and all fixture helpers already exist
- [x] `tests/e2e/helpers/availability.ts` — `createTestSlots` / `cleanupTestSlots` already support seeding `available`, `booked` and `blocked` rows
- [x] `tests/e2e/helpers/reference-data.ts` — `createTestDoctor({ profileId })` already links a doctor row to a login account
- [x] `tests/e2e/helpers/test-users.ts` — `createTestUser("doctor" | "patient")` already exists
- [ ] `tests/e2e/doctor-schedule-add-slot.spec.ts` — AVAIL-01, AVAIL-02 (authored in 04-01 T3)
- [ ] `tests/e2e/doctor-schedule-delete-slot.spec.ts` — AVAIL-04, AVAIL-05 (authored in 04-02 T3)
- [ ] `tests/e2e/doctor-schedule-block-period.spec.ts` — AVAIL-06 (authored in 04-03 T3)
- [ ] `tests/e2e/doctor-schedule-overlap.spec.ts` — AVAIL-03, AVAIL-07 including the concurrency proof (authored in 04-04 T1)
- [ ] `tests/e2e/doctor-schedule-visibility.spec.ts` — D-07 cross-doctor sweep, `reason` privacy, booked-row survival (authored in 04-04 T2)

---

## Manual-Only Verifications

`workflow.human_verify_mode` is `end-of-phase`, so these are collected at `/gsd-verify-work` rather than as blocking in-plan checkpoints.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Day headings read as Israel-local dates and times | AVAIL-01, D-12 | Correctness of a locale-formatted string is asserted programmatically, but "reads right to a human in Israel" is a judgment | Log in as a linked doctor, open `/doctor/schedule`, compare a row's `HH:MM` range against the same instant shown by an Israel-time clock |
| Long `reason` wraps cleanly rather than pushing the row wide | AVAIL-06, UI-SPEC long-text | Layout aesthetics under real text; the spec asserts no clipping but not that it looks right | Block a period with a 400-character reason and view the row at both mobile and desktop widths |
| Schedule list is not clipped at a large row count | UI-SPEC overflow (backstop) | Explicitly recorded as a backstop in UI-SPEC, not tested at volume | Seed ~40 future rows for one doctor and confirm the page scrolls to the last one |
| Block period reads as visually secondary to Add slot | UI-SPEC colour budget | Visual weight judgment | Open `/doctor/schedule` and confirm Add slot carries the accent and Block period the outline treatment |
| Delete confirmation is announced without stealing focus | AVAIL-04, UI-SPEC | Assistive-technology behaviour | Delete a slot with a screen reader active and confirm the `aria-live` region announces without moving focus |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a documented checkpoint exception
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (each spec is authored by the task that needs it)
- [x] No watch-mode flags
- [x] Feedback latency < 60s per spec
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
