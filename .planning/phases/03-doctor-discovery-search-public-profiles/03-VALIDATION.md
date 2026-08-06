---
phase: 3
slug: doctor-discovery-search-public-profiles
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-06
finalized: 2026-08-06 (task IDs, plans and waves assigned by gsd-planner)
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright `@playwright/test` 1.62.1 |
| **Config file** | `playwright.config.ts` (testDir `./tests/e2e`, `workers: 1`, `webServer` auto-starts `npm run dev`) |
| **Quick run command** | `npx playwright test tests/e2e/<file>.spec.ts` |
| **Full suite command** | `npx playwright test` |
| **Estimated runtime** | ~75 seconds (full suite, including Phase 1/2 specs) |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test tests/e2e/<file>.spec.ts` (the single new/changed spec)
- **After every plan wave:** Run `npx playwright test` (full suite — must not regress Phase 1/2's auth/route-protection/admin specs)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 75 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-T2 | 03-01 | 1 | SEARCH-07, SEARCH-08 | T-03-02, T-03-08 | View created `WITH (security_invoker = true)` and granted explicitly to `anon`/`authenticated`; no `SECURITY DEFINER` object introduced | cli | `npx supabase migration list \| grep 20260806120000` | ✅ authored in 03-01 T2 | ⬜ pending |
| 03-01-T3 | 03-01 | 1 | SEARCH-02, SEARCH-03, SEARCH-04, SEARCH-07, SEARCH-08 | T-03-02, T-03-03 | Anon client provably sees only `is_active = true` doctors; `next_available_at` null for booked/blocked/past-only doctors; nulls-last sort confirmed live (Assumption A1) | e2e | `npx playwright test tests/e2e/search-view-visibility.spec.ts` | ✅ authored in 03-01 T3 | ⬜ pending |
| 03-02-T1 | 03-02 | 1 | (shared helper, no REQ-ID) | T-03-10 | `lib/timezone.ts` holds pure `Intl` arithmetic only — no secrets, no env reads, safe in the client bundle | e2e | `npx playwright test tests/e2e/admin-oversight-views.spec.ts` | ✅ exists (Phase 2) | ⬜ pending |
| 03-02-T2, 03-02-T3 | 03-02 | 1 | SEARCH-05, SEARCH-07, PROFILE-03 | T-03-06, T-03-09 | Seed is insert-only with a future-row idempotency guard, so a re-run adds nothing and cannot trip the `23P01` exclusion constraint | e2e | `npx playwright test tests/e2e/seed-availability.spec.ts` | ✅ authored in 03-02 T3 | ⬜ pending |
| 03-03-T1 | 03-03 | 2 | SEARCH-01 | T-03-01, T-03-04 | `q` trimmed and stripped of LIKE/PostgREST metacharacters, then passed only through the parameterized `.ilike()` builder; `page` validated to 1..1000 and `PAGE_SIZE` hardcoded server-side | e2e | `npx playwright test tests/e2e/search-filters.spec.ts -g "name"` | ✅ authored in 03-03 T1 | ⬜ pending |
| 03-03-T2 | 03-03 | 2 | SEARCH-07, SEARCH-09 | T-03-11 | Zero-result search renders the locked "No doctors found" copy, never a blank page; 500 body is a fixed string that never interpolates the database error | e2e | `npx playwright test tests/e2e/search-filters.spec.ts -g "no results"` | ✅ authored in 03-03 T1 | ⬜ pending |
| 03-03-T3 | 03-03 | 2 | SEARCH-08 | T-03-03 | Sort is `ASC NULLS LAST` with an `id` tie-break, so no-availability doctors sort last (D-05) and equal keys order deterministically | e2e | `npx playwright test tests/e2e/search-filters.spec.ts -g "sort"` | ✅ authored in 03-03 T1 | ⬜ pending |
| 03-04-T1, 03-04-T2 | 03-04 | 2 | PROFILE-01, PROFILE-02, PROFILE-03 | T-03-01, T-03-03, T-03-05 | UUID-shaped id guard before any query; route restates `is_active = true` and `status = 'available'` as defense-in-depth; DTO omits `profile_id`/`is_active`/`created_at`; demo badge rendered in the header with no interaction required | e2e | `npx playwright test tests/e2e/doctor-profile.spec.ts` | ✅ authored in 03-04 T3 | ⬜ pending |
| 03-04-T3 | 03-04 | 2 | (D-06, D-18, cross-cutting) | T-03-07 | "No upcoming availability" shown when there are no future slots and no slot-selection control renders at all; "Select this slot" carries the native `disabled` attribute, has no click handler, and issues no request when force-clicked | e2e | `npx playwright test tests/e2e/doctor-profile.spec.ts -g "disabled"` | ✅ authored in 03-04 T3 | ⬜ pending |
| 03-05-T1 | 03-05 | 3 | SEARCH-02, SEARCH-03, SEARCH-04 | T-03-01 | `specialty` validated as a UUID, `language` against the `["he","en"]` literal list mirroring the DB check constraint, `neighborhood` length-bounded — all before querying, all applied through typed builders | e2e | `npx playwright test tests/e2e/search-filters.spec.ts -g "filter"` | ✅ authored in 03-03 T1 | ⬜ pending |
| 03-05-T2 | 03-05 | 3 | SEARCH-05 | T-03-01, T-03-04, T-03-13 | Availability range uses the dedicated `availability_slots` pre-query (Pattern 2), never a range filter on the view's earliest-slot column; an empty id list short-circuits to an empty page rather than falling through unfiltered | e2e | `npx playwright test tests/e2e/search-filters.spec.ts -g "availability"` | ✅ authored in 03-03 T1 | ⬜ pending |
| 03-05-T3 | 03-05 | 3 | SEARCH-06 | T-03-12 | All active filters combine with AND via Supabase-JS implicit chaining; no filter is ever derived from an implicit visitor signal | e2e | `npx playwright test tests/e2e/search-filters.spec.ts -g "combination"` | ✅ authored in 03-03 T1 | ⬜ pending |
| 03-06-T1, 03-06-T2 | 03-06 | 4 | (D-11–D-15, cross-cutting) | T-03-04, T-03-14 | Server-side `.range()` pagination only, never a client-side slice; `PAGE_SIZE=6` is a server constant and is never accepted from the request; filter change resets to page 1; filters and page persist in the URL; controls disable during an in-flight fetch | e2e | `npx playwright test tests/e2e/search-sort-pagination.spec.ts -g "pagination"` | ✅ authored in 03-06 T3 | ⬜ pending |
| 03-06-T3 | 03-06 | 4 | SEARCH-08, SEARCH-09 | T-03-04, T-03-15 | A full page sweep yields every match exactly once with no duplicate and no omission, in a stable order across repeated requests (RESEARCH.md Pitfall 4); a page beyond the result set renders the empty state | e2e | `npx playwright test tests/e2e/search-sort-pagination.spec.ts -g "sort"` | ✅ authored in 03-06 T3 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs are `{plan}-T{n}`. The "File Exists" column names the plan task that authors each spec — every task's automated command resolves inside its own plan or an earlier wave, so no task carries a `MISSING` verify reference.*

---

## Wave 0 Requirements

Resolved during planning: there is **no separate Wave 0**. Every spec file is authored by the plan whose behaviour it covers, in the same wave as the code it verifies, so no task's `<automated>` command points at a file that does not yet exist at the moment that task runs.

- [x] `tests/e2e/search-view-visibility.spec.ts` — authored by plan 03-01 Task 3 (wave 1); covers the view's grant, active-only filtering and `next_available_at` semantics
- [x] `tests/e2e/seed-availability.spec.ts` — authored by plan 03-02 Task 3 (wave 1); covers D-01 through D-03, replacing the previously manual-only idempotency check
- [x] `tests/e2e/search-filters.spec.ts` — authored by plan 03-03 Task 1 (wave 2), extended by 03-03 Task 3 and 03-05 Task 3; covers SEARCH-01 through SEARCH-06, SEARCH-08 and SEARCH-09
- [x] `tests/e2e/doctor-profile.spec.ts` — authored by plan 03-04 Task 3 (wave 2); covers PROFILE-01 through PROFILE-03, D-06 and D-18
- [x] `tests/e2e/search-sort-pagination.spec.ts` — authored by plan 03-06 Task 3 (wave 4); covers D-11 through D-15 and cross-page sort stability
- [x] `tests/e2e/helpers/availability.ts` — authored by plan 03-02 Task 3 (wave 1); `createTestSlots` / `cleanupTestSlots`. Existing `helpers/supabase-anon.ts`, `helpers/supabase-admin.ts`, `helpers/reference-data.ts` and `helpers/test-users.ts` are reused as-is.
- [x] Framework install: none needed — Playwright is already configured project-wide.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `security_invoker` view grant/RLS advisor sanity (Common Pitfall #1/#2) | (schema, no REQ-ID) | One-time migration-authoring check against the hosted project, not a repeatable browser assertion | Run `npx supabase db advisors` (or MCP `get_advisors`) after creating `doctor_search_view`; confirm no missing-grant or RLS-bypass finding referencing the new view. Recorded as an acceptance criterion of plan 03-01 Task 2. |
| Migration fail-first spot check | (schema, no REQ-ID) | Requires temporarily reverting a migration clause, which no automated suite should do to a shared database | Once, before committing plan 03-01: remove the `security_invoker` option and the `is_active` predicate from the migration, confirm `tests/e2e/search-view-visibility.spec.ts` goes red on the inactive-doctor assertion, then restore. Recorded as an acceptance criterion of plan 03-01 Task 3. |
| DST correctness of `jerusalemWallClockToUtc` | (shared helper, no REQ-ID) | A one-off arithmetic confirmation across a DST boundary, cheaper as a throwaway `npx tsx -e` invocation than as a browser test | Evaluate the helper for a summer date and a winter date and confirm the resulting UTC instants are three and two hours behind the wall clock respectively. Recorded as an acceptance criterion of plan 03-02 Task 1. |

*Slot-seeding idempotency (D-03) was previously listed here as manual-only. It is now automated by `tests/e2e/seed-availability.spec.ts`, which shells out to `npm run seed` twice and asserts row-count equality — Playwright runs non-browser specs, so the "Playwright only" constraint does not force this to stay manual.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — 14 mapped task groups, every one carrying a runnable command
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — every task in all six plans has an `<automated>` block
- [x] Wave 0 covers all MISSING references — no MISSING references remain; each spec is authored in the plan and wave that needs it
- [x] No watch-mode flags — every command is a single-shot `npx playwright test`, `npm run`, `npx tsc --noEmit` or `npx supabase` invocation
- [x] Feedback latency < 75s — per-task commands run one spec file; the two heaviest (`seed-availability`, `search-sort-pagination`) raise their own test timeouts and remain single-file runs
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-06 (finalized by gsd-planner during phase planning)
