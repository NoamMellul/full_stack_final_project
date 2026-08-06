---
phase: 3
slug: doctor-discovery-search-public-profiles
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-06
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
| 03-01 | TBD | 1 | SEARCH-01 | T-03-01 | Name query never string-concatenated into raw SQL; passed through parameterized `.ilike()` | e2e | `npx playwright test tests/e2e/search-filters.spec.ts -g "name"` | ❌ Wave 0 | ⬜ pending |
| 03-02 | TBD | 1 | SEARCH-02, SEARCH-03, SEARCH-04 | T-03-01 | Specialty/language/neighborhood values validated against known reference-data ids before querying | e2e | `npx playwright test tests/e2e/search-filters.spec.ts -g "filter"` | ❌ Wave 0 | ⬜ pending |
| 03-03 | TBD | 1 | SEARCH-05 | T-03-01 | Availability range filter uses the dedicated `availability_slots` pre-query (Pattern 2), never a range filter on `next_available_at` | e2e | `npx playwright test tests/e2e/search-filters.spec.ts -g "availability"` | ❌ Wave 0 | ⬜ pending |
| 03-04 | TBD | 1 | SEARCH-06 | — | All active filters combine with AND (Supabase-JS implicit chaining) | e2e | `npx playwright test tests/e2e/search-filters.spec.ts -g "combination"` | ❌ Wave 0 | ⬜ pending |
| 03-05 | TBD | 1 | SEARCH-09 | — | Zero-result search renders a clear "no doctor found" message, never a blank page | e2e | `npx playwright test tests/e2e/search-filters.spec.ts -g "no results"` | ❌ Wave 0 | ⬜ pending |
| 03-06 | TBD | 1 | SEARCH-07, SEARCH-08 | T-03-02, T-03-03 | `next_available_at` sourced from `security_invoker` view; sort is `ASC NULLS LAST` so no-availability doctors sort last (D-05), never first | e2e | `npx playwright test tests/e2e/search-sort-pagination.spec.ts -g "sort"` | ❌ Wave 0 | ⬜ pending |
| 03-07 | TBD | 1 | (D-11–D-15, cross-cutting) | T-03-04 | Server-side `.range()` pagination only (never full-list-then-slice); hardcoded `PAGE_SIZE=6`; filter change resets to page 1; filters/page persisted in URL query string | e2e | `npx playwright test tests/e2e/search-sort-pagination.spec.ts -g "pagination"` | ❌ Wave 0 | ⬜ pending |
| 03-08 | TBD | 1 | PROFILE-01, PROFILE-02, PROFILE-03 | T-03-02, T-03-03 | Profile route re-states `is_active=true`/`status='available'` as defense-in-depth alongside RLS; `is_demo` badge always visible | e2e | `npx playwright test tests/e2e/doctor-profile.spec.ts` | ❌ Wave 0 | ⬜ pending |
| 03-09 | TBD | 1 | (D-06, D-18, cross-cutting) | — | "No upcoming availability" indicator shown when no future slots; "Select this slot" CTA renders disabled/non-interactive, never silently functionless-but-clickable | e2e | `npx playwright test tests/e2e/doctor-profile.spec.ts -g "disabled"` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs/plan/wave columns are placeholders — finalized once `gsd-planner` assigns actual task IDs and wave numbers.*

---

## Wave 0 Requirements

- [ ] `tests/e2e/search-filters.spec.ts` — stubs for SEARCH-01 through SEARCH-06, SEARCH-09
- [ ] `tests/e2e/search-sort-pagination.spec.ts` — stubs for SEARCH-07, SEARCH-08, D-11 through D-15
- [ ] `tests/e2e/doctor-profile.spec.ts` — stubs for PROFILE-01 through PROFILE-03, D-06, D-18
- [ ] `tests/e2e/helpers/` — likely needs a small addition to seed/read known demo-doctor fixtures for deterministic assertions; the existing `tests/e2e/helpers/supabase-anon.ts` and `helpers/test-users.ts` can be reused as-is
- [ ] Framework install: none needed — Playwright is already configured project-wide.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Slot-seeding idempotency (D-03) | (seed script, no REQ-ID) | Playwright covers browser flows, not CLI scripts; project has no Vitest/Node test runner (CLAUDE.md constraint: Playwright only) | Run `npm run seed` twice; diff `availability_slots` row counts via the Supabase dashboard or `npx supabase db query` — second run must add zero new slot rows and must not throw a `23P01` exclusion-violation error |
| `security_invoker` view grant/RLS sanity (Common Pitfall #1/#2) | (schema, no REQ-ID) | One-time migration-authoring check, not a repeatable browser assertion | Run `supabase db advisors` (or MCP `get_advisors`) after creating `doctor_search_view`; confirm no missing-grant or RLS-bypass warnings before considering the migration task done |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 75s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
