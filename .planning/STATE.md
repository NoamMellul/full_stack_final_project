---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 03
current_phase_name: Doctor Discovery — Search & Public Profiles
status: executing
stopped_at: Completed 03-05-PLAN.md
last_updated: "2026-08-06T16:19:50.968Z"
last_activity: 2026-08-05
last_activity_desc: Phase 02 complete, transitioned to Phase 03
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 19
  completed_plans: 18
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-03)

**Core value:** A patient must be able to find a doctor matching their criteria and book an available slot in a few clicks, with an absolute guarantee that two patients never book the same slot.
**Current focus:** Phase 02 — admin-doctor-reference-data-management

## Current Position

Phase: 03 (doctor-discovery-search-public-profiles) — EXECUTING
Plan: 6 of 6
Status: Ready to execute
Last activity: 2026-08-05 — Phase 02 complete, transitioned to Phase 03

Progress: [██████████] 95%

## Performance Metrics

**Velocity:**

- Total plans completed: 13
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 6 | - | - |
| 02 | 7 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P02 | 70min | 2 tasks | 30 files |
| Phase 01 P03 | 35min | 2 tasks | 9 files |
| Phase 01 P04 | 30min | 2 tasks | 7 files |
| Phase 01 P05 | 35min | 2 tasks | 7 files |
| Phase 02 P01 | 50min | 2 tasks | 16 files |
| Phase 02 P02 | 35min | 3 tasks | 7 files |
| Phase 02 P03 | 55min | 3 tasks | 10 files |
| Phase 02 P04 | 55min | 3 tasks | 7 files |
| Phase 02 P05 | 40min | 3 tasks | 10 files |
| Phase 02 P06 | 35min | 2 tasks | 3 files |
| Phase 02 P07 | 45min | 3 tasks | 6 files |
| Phase 03 P01 | 55min | 3 tasks | 2 files |
| Phase 03 P02 | 26min | 3 tasks | 5 files |
| Phase 03 P03 | 32min | 3 tasks | 6 files |
| Phase 03 P04 | 55min | 3 tasks | 4 files |
| Phase 03 P05 | 45min | 3 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Project init: REST API Routes (not Server Actions), manual TS validation (not Zod), Playwright only (no Vitest/RTL) — see PROJECT.md Key Decisions.
- Project init: `blocked_periods` merged into `availability_slots` via a `status` column — one table, not two.
- Project init: Anti-double-booking enforced at the DB level (unique partial index / exclusion constraint + transactional booking) — this is the primary success criterion of Phase 5 and must be explicitly tested, not just asserted.
- Roadmap: Full DB schema (all tables for the whole app) is deployed in Phase 1 alongside Auth, so later phases build pure API/UI against an already-complete, validated schema.
- [Phase ?]: Plan 01-02: server-only package required a live legitimacy checkpoint (not pre-flagged by RESEARCH.md); resumed only after independent on-disk verification, not a relayed claim
- [Phase ?]: Plan 01-02: committed the entire pre-existing, never-tracked Next.js/shadcn scaffold and initial schema migration as a chore commit, so every commit in the plan's history is independently buildable
- [Phase ?]: Plan 01-02: signup Route Handler uses the service-role admin client with role hardcoded inline on the profiles insert, never taken from request input, closing the profiles RLS role-escalation gap (T-01-01)
- [Phase ?]: [Phase 01] Plan 01-03: login Route Handler returns the identical generic error string as a literal in both the 400 and 401 branches (not a shared constant), so the endpoint is provably not a user-enumeration oracle at each call site
- [Phase ?]: [Phase 01] Plan 01-03: app/login/page.tsx wraps its useSearchParams()-consuming form in a Suspense boundary so /login still statically prerenders at build time
- [Phase ?]: [Phase 01] Plan 01-03: doctor/admin role-guard layouts are structural copies of app/patient/layout.tsx, kept as plain folders (not route groups) so Plan 05's proxy.ts matcher has real URL prefixes to key off
- [Phase ?]: [Phase 01] Plan 01-04: logout Route Handler calls signOut() on the cookie-bound SSR server client (never the browser client) so Set-Cookie clearing headers land on the response — closes T-01-13
- [Phase ?]: [Phase 01] Plan 01-04: components/site-header.tsx is an async Server Component that resolves getUser()+profiles.full_name itself and renders null for anonymous visitors, with the only interactive piece split into a small 'use client' components/logout-button.tsx
- [Phase ?]: [Phase 01] Plan 01-05: proxy.ts (root) delegates to lib/supabase/proxy.ts's updateSession() which checks auth-presence only by path prefix (/patient, /doctor, /admin) and redirects to /login?from=<pathname>; role comparison is deliberately deferred to the role-scoped layouts to avoid a profiles DB round trip on every request
- [Phase ?]: [Phase 01] Plan 01-05: tests/e2e/auth-signup.spec.ts's pre-existing unauthenticated-/patient redirect assertion was updated to tolerate the new ?from= query param appended by proxy.ts, since that test predates this plan's request gate
- [Phase ?]: [Phase 02] Plan 02-01: session-bound createClient() used for every admin/doctors route RLS already authorizes; createAdminClient() reserved for routes that structurally need it (e.g. future link-account)
- [Phase ?]: [Phase 02] Plan 02-01: validateDoctorInput() returns a single string | null message (mirrors lib/validation/auth.ts); client maps that message to a specific form field via a literal FIELD_BY_MESSAGE lookup
- [Phase ?]: [Phase 02] Plan 02-01: doctors list loading-skeleton state only shows on the very first mount fetch; post-submit refresh and Retry reuse loadDoctors() without resetting to loading
- [Phase ?]: [Phase 02] Plan 02-02: validateDoctorPatch/validateStatusInput only inspect keys present on the body (partial-update contract), reusing validateDoctorInput's exact message strings
- [Phase ?]: [Phase 02] Plan 02-02: doctor_languages association updates are delete-then-insert (never append), and the status endpoint assigns the caller's explicit boolean rather than negating the stored value, so a repeated identical PATCH is a true no-op
- [Phase ?]: [Phase 02] Plan 02-02: DoctorFormFields shared component (idPrefix-parameterized) drives both the always-mounted create form and the conditionally-open edit dialog; aria-live=polite role=status region used for activate/deactivate confirmation instead of a toast library
- [Phase ?]: [Phase 02] Plan 02-03: reference-data uniqueness checkpoint resolved as option-a — unique (neighborhood, city) on locations, unique (name_en) on specialties
- [Phase ?]: [Phase 02] Plan 02-03: specialties/locations create+edit use a Dialog form (not an always-mounted inline form) with a single resource-parameterised client component shared by both admin pages
- [Phase ?]: [Phase 02] Plan 02-03: DELETE independently re-checks referencing doctors server-side (409 pre-check + 23503 fallback translation), proven against a direct page.request.delete bypassing the disabled button (D-06, T-02-05)
- [Phase ?]: [Phase 02] Plan 02-04: OversightTable takes columns as plain-value config objects (dot-path key + format enum), not render-prop functions, so app/admin/users/page.tsx stays a genuine Server Component while still customizing per-page columns
- [Phase ?]: [Phase 02] Plan 02-04: app/admin/appointments/page.tsx is a Client Component (not a Server Component) because its status/doctor Select filters and date-range inputs need client-side state
- [Phase ?]: [Phase 02] Plan 02-04: from/to date-range filter inputs convert calendar-day input to UTC via an Intl.DateTimeFormat Asia/Jerusalem offset helper (start-of-day/end-of-day), not naive Date parsing
- [Phase ?]: [Phase 02] Plan 02-05: profiles.must_change_password locked down via column-level GRANT/REVOKE (not a WITH CHECK clause, which the existing profiles_update_own_or_admin policy lacks); the (gated) route-group holds the forced-password-change gate with app/doctor/change-password/ as a sibling outside the group to prevent a redirect loop
- [Phase ?]: [Phase 02] Plan 02-06: package-legitimacy checkpoint for tsx (SUS/too-new verdict) approved by human; scripts/seed.ts is an idempotent seeder building its own service-role client (never importing server-only lib/supabase/admin.ts), guarding doctors idempotency via a full_name existence check since doctors has no natural unique key
- [Phase ?]: [Phase 02] Plan 02-07: Admin dashboard reads counts via four head-only count queries through the session-bound client (not the admin client), keeping RLS a real second layer behind the layout guard; admin-route-protection.spec.ts drives a 15-entry endpoint descriptor array plus a six-page matrix from persistent per-role browser contexts, re-reading fixture rows after the sweep to prove rejected requests leave no side effect
- [Phase ?]: [Phase 03] Plan 03-01: doctor_search_view column shape locked at option-a (RESEARCH.md minimal 13-column list) — no next_available_end_at, no address/created_at
- [Phase ?]: [Phase 03] Plan 03-01: doctor_search_view uses two LEFT JOIN LATERAL ... ON TRUE subqueries (never inner) so a doctor with no languages or no future slot still produces exactly one row (D-04); language_codes coalesces to '{}' rather than null
- [Phase ?]: [Phase 03] Plan 03-02: lib/timezone.ts is the project's single Asia/Jerusalem conversion module (moved verbatim from app/admin/appointments/page.tsx plus 5 new exports); imported by both Client Components and the Node seed script with no server-only guard
- [Phase ?]: [Phase 03] Plan 03-02: seedAvailabilitySlots() reads the demo doctor set back from the database (never seedDoctors()'s return value, which is empty on re-run) and idempotency-checks strictly on FUTURE availability_slots rows (D-03); Dr. Liora Segal and Dr. Amit Friedman are the DOCTORS_WITHOUT_SLOTS exclusions (D-02)
- [Phase ?]: [Phase 03] Plan 03-03: parseSearchParams strips LIKE/PostgREST metacharacters (%,_,*,\) from q rather than escaping them; confirmed q=%25 returns identical total to unfiltered request (T-03-01)
- [Phase ?]: [Phase 03] Plan 03-03: listStatus resets to loading on every searchParams change (not just first mount), diverging from doctors-page-client.tsx's admin pattern, to satisfy the every-query-change skeleton backstop truth
- [Phase ?]: [Phase 03] Plan 03-03: DoctorSearchResult type exported from components/search/doctor-card.tsx (single source), and ParsedSearchParams from lib/validation/search.ts, both extended (never redefined) by plans 03-05/03-06
- [Phase ?]: [Phase 03] Plan 03-04: PUBLIC_DOCTOR_SELECT is a standalone select string that omits profile_id/is_active/created_at at the query itself (not post-processed); D-06 empty-slots state renders no Select this slot control at all, not a disabled one
- [Phase ?]: [Phase 03] Plan 03-04: fixed lib/supabase/proxy.ts ROLE_PREFIXES to a path-segment boundary match so /doctors stays public while /doctor/* role-gating is unaffected (Rule 1 bug fix)
- [Phase ?]: [Phase 03] Plan 03-05: .contains("language_codes", [code]) confirmed to filter correctly against doctor_search_view's text[] column live against seeded data — no two-step fallback needed (RESEARCH.md Assumption A2 resolved)
- [Phase ?]: [Phase 03] Plan 03-05: availability-range filter is a dedicated availability_slots pre-query reduced to a doctor_id list via .in(); next_available_at is used only as the .order() sort key, never as a range-filter predicate (RESEARCH.md Pitfall 3)
- [Phase ?]: [Phase 03] Plan 03-05: Base UI Select requires an items value->label map on <Select items={...}> for Select.Value to resolve a label from a URL-derived initial value without the popup ever having opened — fixed after a reload test caught the trigger showing a raw id

### Pending Todos

None yet.

### Blockers/Concerns

- REQUIREMENTS.md's original Traceability section stated "45 total" v1 requirements, but the actual requirement list in the file contains 59 REQ-IDs across 10 categories. The roadmap maps all 59 as found in the file; the stale "45" count has been corrected in REQUIREMENTS.md.
- RESOLVED (2026-08-04): Phase 02 Plan 01's Supabase CLI link blocker was fixed by the orchestrator (linked project-ref hyxipqnrkpjkiojrxqtl with an access token); Plan 01 re-executed from Task 1 and completed successfully. Note for later plans in this phase: `npx supabase db push` intermittently timed out on the direct-DB-connection step (IPv6-only DNS for `db.<ref>.supabase.co`) before succeeding on retry — treat a single timeout as transient, confirm via `npx supabase migration list` before assuming failure.
- Shared remote dev database holds accumulated Playwright test residue in specialties/locations/doctors (test-created rows never cleaned up across Phase 02 plans 01-05) — not a defect in 02-06's seed script, which correctly seeded and idempotently re-ran its own 12/12/12 demo rows; a project reset or manual cleanup before final demo/grading would present a cleaner catalog
- Task 3 acceptance-criterion 'temporarily remove security_invoker/is_active and confirm assertion 2 fails' could not be executed: sandbox classifier blocked all npx supabase db query --linked calls (even read-only). Substituted with grep of the applied migration + a clean npx supabase db advisors --linked report. Recorded as coverage D7 (human_judgment: true) in 03-01-SUMMARY.md for optional human follow-up.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none — greenfield project)* | | | |

## Session Continuity

Last session: 2026-08-06T16:19:50.929Z
Stopped at: Completed 03-05-PLAN.md
Resume file: None
