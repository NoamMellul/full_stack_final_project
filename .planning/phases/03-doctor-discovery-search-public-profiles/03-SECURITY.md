---
phase: 3
slug: doctor-discovery-search-public-profiles
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-08
---

# Phase 3 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Anonymous browser → `GET /api/doctors` | Untrusted query-string input (name, filters, page) crosses into the application; no session exists to authorize against | Search/filter parameters |
| Anonymous browser → `GET /api/doctors/[id]` | Untrusted path segment crosses into the application; no session exists to authorize against | Doctor id |
| Route Handler (anon-key Supabase client) → Postgres | RLS plus each view/route's own `is_active`/`status` predicates are the only authorization authority for public reads | Doctor/profile/availability rows |
| `parseSearchParams` → Supabase query builder | Where a normalized parameter becomes (or fails to become) a predicate — the boundary the phase's one verification gap (T-03-16) sat on | Sanitized search term |
| Browser Supabase client → Postgres | Filter option lists (specialties, locations, languages) read directly under the pre-existing public-read RLS policies from Phase 1 | Public reference data |
| Seed script / Playwright fixture (service-role key) → Postgres | RLS-bypassing writes, confined to the developer CLI and `tests/` — never reachable from the Next.js runtime | Demo availability rows (dev/test only) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-01 | Tampering | `q`/`page`/`specialty`/`language`/`neighborhood`/date params on `GET /api/doctors`; `[id]` path segment | high | mitigate | `validateSearchParams` rejects malformed input with 400 before any query runs; every value reaches the database only through a typed builder (`ilike`/`eq`/`in`/`gte`/`lte`), never a concatenated raw predicate; `UUID_PATTERN` gates `[id]`. Confirmed present in `lib/validation/search.ts`. | closed |
| T-03-02 | Elevation of Privilege | `doctor_search_view` | critical | mitigate | View created `with (security_invoker = true)`, so it executes under the caller's RLS instead of the owner's. Confirmed present in `supabase/migrations/20260806120000_add_doctor_search_view.sql`. | closed |
| T-03-03 | Information Disclosure | Inactive doctors / non-available slots reachable via the view or either route | high | mitigate | `is_active = true` predicate in the view body, restated in both route handlers as defense-in-depth. Confirmed present in the migration and in `app/api/doctors/[id]/route.ts`. | closed |
| T-03-04 | Denial of Service | Pagination parameters (`page`, page size) | medium | mitigate | `PAGE_SIZE` is a hardcoded server constant (6), never read from the request; `page` is clamped to `1..MAX_PAGE` with a 400 outside that range. Confirmed present in `lib/validation/search.ts` and `app/api/doctors/route.ts`. | closed |
| T-03-05 | Information Disclosure | Public profile DTO | medium | mitigate | `PUBLIC_DOCTOR_SELECT` omits `profile_id`, `is_active`, and `created_at`. Confirmed present in `app/api/doctors/[id]/route.ts`. | closed |
| T-03-06 | Tampering | `scripts/seed.ts` service-role writes | low | accept | Developer-only CLI script, insert-only — grep confirms no `.delete(`/`TRUNCATE` call — and never imported by the Next.js runtime. | closed |
| T-03-07 | Spoofing | "Select this slot" control | low | mitigate | Native `disabled` attribute, no click handler, no booking endpoint exists in this phase. Confirmed present in `app/doctors/[id]/page.tsx`. | closed |
| T-03-08 | Information Disclosure | Grant on `doctor_search_view` | high | mitigate | Explicit `grant select ... to anon, authenticated` only — no `service_role` widening. Confirmed present in the migration. | closed |
| T-03-09 | Denial of Service | `availability_slots` growth from repeated seeding | low | mitigate | Future-row idempotency guard makes a re-run a no-op; `tests/e2e/seed-availability.spec.ts` asserts identical row counts across two consecutive `npm run seed` runs. | closed |
| T-03-10 | Information Disclosure | `lib/timezone.ts` shipped to the client bundle | low | accept | Pure `Intl`-based date arithmetic, no secrets, no `process.env` reads — grep confirms no such references. | closed |
| T-03-11 | Information Disclosure | 500 error bodies on database failures | low | mitigate | Both route handlers return a fixed generic string and never interpolate the Supabase `error.message`. Confirmed present in `app/api/doctors/route.ts` and `app/api/doctors/[id]/route.ts`. | closed |
| T-03-12 | Information Disclosure | Filter option lists (specialties, locations, languages) | low | accept | Pre-existing public-read RLS policies (`select using (true)`) set deliberately in the Phase 1 schema; nothing doctor-specific is exposed. | closed |
| T-03-13 | Tampering | Empty availability pre-query result | medium | mitigate | Explicit empty-page short circuit (`{ doctors: [], total: 0 }`) instead of an unfiltered fallthrough. Confirmed present in `app/api/doctors/route.ts`. | closed |
| T-03-14 | Tampering | Double-submitted page navigation | low | mitigate | Every pagination control carries `disabled` while a fetch is in flight; the server is idempotent for reads regardless. | closed |
| T-03-15 | Information Disclosure | Deep-page enumeration of the doctor catalog | low | accept | Paging through the catalog exposes exactly what a single unfiltered search already exposes — deliberately public reference data restricted by RLS to active doctors. | closed |
| T-03-16 | Tampering | `q` parameter metacharacter-stripping collapsing to "no filter" — **the phase's one `03-VERIFICATION.md` gap** | medium | mitigate | `parseSearchParams` returns `qMatchesNothing: true` when a supplied non-whitespace term strips to empty; the route returns the empty page before building the view query, closing the fail-open behavior. Confirmed present in `lib/validation/search.ts` and `app/api/doctors/route.ts`; independently reproduced live (unfiltered `total: 12` vs. `q=%25` → `total: 0`) in the `03-VERIFICATION.md` re-verification pass. | closed |
| T-03-17 | Information Disclosure | Any filter in this route whose normalization can produce an empty value | medium | mitigate | Both filters (availability since 03-05, name since 03-07) now share one fail-closed invariant — an unmatchable filter returns the empty page rather than falling through unfiltered. Confirmed present in `app/api/doctors/route.ts`. | closed |
| T-03-18 | Denial of Service | Unbounded `q` length | low | accept | No length bound on `q` (`03-REVIEW.md` IN-01..06, info severity). Deliberately not fixed: outside the `03-VERIFICATION.md` gaps block, changes the shipped 400-response surface, and the practical ceiling is the platform's own request-size limit. Recorded in `03-07-PLAN.md` as a decision, not an oversight. | closed |
| T-03-SC | Tampering | Supply chain (npm/pip/cargo installs) | high | accept | Zero packages installed across all 7 plans in this phase (confirmed by each plan's own research/scope statement); re-arm if a later plan adds a dependency. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (high) count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-06 | Seed script is a developer-only CLI, insert-only, never reachable from the Next.js runtime. | Phase 3 planning (03-01/03-02-PLAN.md) | 2026-08-06 |
| AR-03-02 | T-03-10 | `lib/timezone.ts` holds pure date arithmetic only — safe to ship to the client bundle. | Phase 3 planning (03-02-PLAN.md) | 2026-08-06 |
| AR-03-03 | T-03-12 | Filter option lists are pre-existing public reference data under Phase 1's own RLS policies. | Phase 3 planning (03-05-PLAN.md) | 2026-08-06 |
| AR-03-04 | T-03-15 | Deep-page enumeration exposes nothing beyond what an unfiltered search already returns. | Phase 3 planning (03-06-PLAN.md) | 2026-08-06 |
| AR-03-05 | T-03-18 | Unbounded `q` length is a deliberate, recorded scope decision — practical ceiling is the platform's own request-size limit. | Gap-closure planning (03-07-PLAN.md) | 2026-08-08 |
| AR-03-06 | T-03-SC | This phase (all 7 plans) installs zero new packages — nothing for the supply-chain gate to audit. | Phase 3 planning (all plans) | 2026-08-06 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-08 | 19 | 19 | 0 | Claude (gsd-secure-phase, orchestrator grep-depth classification, ASVS L1) |

Threat register built from all 7 plans' `<threat_model>` blocks (`register_authored_at_plan_time: true` for every plan — no retroactive-STRIDE construction needed). No `## Threat Flags` entries in any `*-SUMMARY.md`. Every `mitigate`-disposition threat's stated control was grep-confirmed present in the current implementation (migration, `lib/validation/search.ts`, both route handlers, `app/doctors/[id]/page.tsx`, `scripts/seed.ts`); every `accept`-disposition threat's rationale was independently spot-checked against the source. `threats_open: 0` at ASVS L1 with a plan-time-authored register meets the short-circuit rule (L1 grep-depth is sufficient) — no deeper auditor pass was required this run.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-08
