---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 05
current_phase_name: Appointment Booking & Lifecycle
status: executing
stopped_at: Completed 05-02-PLAN.md
last_updated: "2026-08-11T08:40:03.595Z"
last_activity: 2026-08-10
last_activity_desc: Phase 05 execution started
progress:
  total_phases: 6
  completed_phases: 4
  total_plans: 29
  completed_plans: 26
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-08)

**Core value:** A patient must be able to find a doctor matching their criteria and book an available slot in a few clicks, with an absolute guarantee that two patients never book the same slot.
**Current focus:** Phase 05 — Appointment Booking & Lifecycle

## Current Position

Phase: 05 (Appointment Booking & Lifecycle) — EXECUTING
Plan: 3 of 5
Status: Ready to execute
Last activity: 2026-08-10 — Phase 05 execution started

Progress: [█████████░] 90%

## Performance Metrics

**Velocity:**

- Total plans completed: 20
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 6 | - | - |
| 02 | 7 | - | - |
| 3 | 7 | - | - |

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
| Phase 03 P06 | 50min | 3 tasks | 4 files |
| Phase 03 P07 | 40min | 2 tasks | 3 files |
| Phase 04 P01 | 55min | 3 tasks | 8 files |
| Phase 04 P02 | 65min | 3 tasks | 3 files |
| Phase 04 P03 | 120min | 3 tasks | 4 files |
| Phase 04 P04 | 20min | 2 tasks | 2 files |
| Phase 05 P01 | 90min | 3 tasks | 12 files |
| Phase 05 P02 | 64min | 3 tasks | 3 files |

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
- [Phase ?]: [Phase 03] Plan 03-06: pageCount computed client-side from total via imported PAGE_SIZE (never a prop) so a client-supplied page size can never reach the query (T-03-04); active pagination page number rendered through a dedicated JSX branch carrying a literal aria-current="page"
- [Phase ?]: [Phase 03] Plan 03-06: page-change scroll-to-top gated by a scrollOnNextReadyRef flag set only in handlePageChange, reusing the existing searchParams-driven loading/ready cycle without also scrolling on filter changes or initial mount
- [Phase ?]: [Phase 03] Plan 03-06: fixed app/api/doctors/route.ts to catch PostgREST PGRST103 (416 range-not-satisfiable, raised when a page's offset exceeds the filtered result set) and return an explicit empty page instead of a 500 (Rule 1 bug, SEARCH-09)
- [Phase ?]: [Phase 03] Plan 03-07: parseSearchParams gained qMatchesNothing: boolean discriminator; GET /api/doctors short-circuits to the empty page when a non-whitespace q strips to nothing, mirroring the existing availability fail-closed pattern (T-03-13/T-03-16), closing the 03-VERIFICATION.md wildcard-only-search gap
- [Phase ?]: [Phase 04] Plan 04-01: availability_slots.reason locked at option-a (plain nullable text, no constraint, no length cap) — Task 1 checkpoint auto-selected under workflow.auto_advance
- [Phase ?]: [Phase 04] Plan 04-01: requireDoctor() resolves doctorId from doctors.profile_id = auth.uid(), mirroring requireAdmin(); GET/POST /api/doctor/slots use guard.doctorId only (client-supplied doctorId inert), filter GET on end_at (not start_at) so in-progress multi-day blocked rows stay listed (D-15), and branch strictly on Postgres error.code (23P01 -> 409 generic overlap string, 23514 -> 400 range message)
- [Phase ?]: [Phase 04] Plan 04-02: DELETE /api/doctor/slots/[id] chains .select("id") on the delete and treats zero affected rows as 404 — a plain PostgREST delete against zero matching rows does not error, so without this two concurrent deletes of the same id both silently reported 200 (Rule 1 fix found by the concurrency test case)
- [Phase ?]: [Phase 04] Plan 04-02: DELETE /api/doctor/slots/[id] shares one 404 message across missing/already-deleted/foreign-doctor ids (never 403 for a foreign id) so the response can never confirm another doctor's slot id is real (T-04-03); booked-row rejection reads status from the same-request lookup, never client-supplied or list-cached (T-04-04)
- [Phase 04]: [Phase 04] Plan 04-03: reason is sent/stored exactly as submitted, never trimmed — trim() is used only to test blankness (Rule 1 fix, found by Task 3 case 6, so a reason's meaningful leading/trailing whitespace round-trips byte-identical per D-04) — The original implementation trimmed the reason before both the client fetch body and the route's insert, which would have silently altered a reason with meaningful whitespace and broken D-04's byte-identical round-trip requirement.
- [Phase 04]: [Phase 04] Plan 04-04: doctor-schedule-overlap.spec.ts and doctor-schedule-visibility.spec.ts required zero production code changes — both passed against the routes exactly as plans 04-01 through 04-03 left them — This is the plan's central finding: the database-level guarantee (one exclusion constraint, one generic message, one RLS policy) held under real Promise.all concurrency and across the full status/ownership/visibility matrix with no application-layer patching needed, closing AVAIL-03 and AVAIL-07 and completing Phase 04.
- [Phase ?]: [Phase 05] Plan 05-01: Task 1 checkpoint auto-selected option-b under workflow.auto_advance — revoke insert on public.appointments from anon/authenticated, forcing every appointment row through book_appointment()
- [Phase ?]: [Phase 05] Plan 05-01: book_appointment()/reschedule_appointment()/cancel_appointment() SECURITY DEFINER functions locked with five custom SQLSTATE codes (MR001-MR005); route layer branches strictly on error.code, never error.message
- [Phase ?]: [Phase 05] Plan 05-01: lib/appointments.ts is the single shared source for the derived Confirmed/Past/Cancelled badge and the Upcoming/Past split, consumed by both the patient page (this plan) and the doctor page (05-03)
- [Phase ?]: [Phase 05] Plan 05-01: Rule 1 fix — added migration 20260811070000 granting a patient SELECT on the availability_slots row backing their own appointment regardless of status; the original policy only allowed reading a slot while status='available', silently breaking the post-booking read and the entire /patient/appointments list once a slot flipped to booked
- [Phase ?]: [Phase 5] Plan 05-02: cancel route uses session-only guard (no requirePatient()/requireDoctor()) since D-12 lets both the patient and the owning doctor cancel; cancel_appointment()'s own auth.uid()-scoped filter is the real authorization boundary
- [Phase ?]: [Phase 5] Plan 05-02: cancel eligibility on /patient/appointments read from appointmentBadge().label === "Confirmed" plus isCancelledStatus(), not a direct Date.now() comparison in the row render body, to satisfy eslint react-hooks/purity

### Pending Todos

None yet.

### Blockers/Concerns

- Shared remote dev database holds accumulated Playwright test residue in specialties/locations/doctors (test-created rows never cleaned up across Phase 02 plans 01-05) — not a defect in 02-06's seed script, which correctly seeded and idempotently re-ran its own 12/12/12 demo rows; a project reset or manual cleanup before final demo/grading would present a cleaner catalog
- ⚠️ [Phase 3] Task 3 acceptance-criterion 'temporarily remove security_invoker/is_active and confirm assertion 2 fails' could not be executed: sandbox classifier blocked all npx supabase db query --linked calls (even read-only). Substituted with grep of the applied migration + a clean npx supabase db advisors --linked report. Recorded as coverage D7 (human_judgment: true) in 03-01-SUMMARY.md for optional human follow-up.
- ⚠️ [Phase 3] Two non-blocking code-review warnings left unfixed by design (03-REVIEW.md WR-02, WR-03; confirmed still open in 03-VERIFICATION.md's re-verification): out-of-range search pages report a fabricated `total: 0` instead of the real count, and the doctor-profile upcoming-slots query has no `.limit()`. Neither violates a locked must-have; worth a look if a later phase touches either endpoint.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none — greenfield project)* | | | |

## Session Continuity

Last session: 2026-08-11T08:40:03.552Z
Stopped at: Completed 05-02-PLAN.md
Resume file: None
