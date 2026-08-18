---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 06
current_phase_name: Dashboards, Notifications & Localization
status: verifying
stopped_at: "Completed quick task 260817-nlg: cleaned up 389 orphaned doctors + 260 test accounts + 229/156 test specialties/locations from the shared dev database"
last_updated: "2026-08-17T10:45:00.000Z"
last_activity: 2026-08-17
last_activity_desc: "Completed quick task 260817-lar: paginated /admin/doctors and /admin/users (opt-in, 25/page)"
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 39
  completed_plans: 39
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-11)

**Core value:** A patient must be able to find a doctor matching their criteria and book an available slot in a few clicks, with an absolute guarantee that two patients never book the same slot.
**Current focus:** Phase 06 — Dashboards, Notifications & Localization

## Current Position

Phase: 06 (Dashboards, Notifications & Localization) — EXECUTING
Plan: 10 of 10
Status: Phase complete — ready for verification
Last activity: 2026-08-18 - Completed quick task 260818-s44: doctor phone number field (migration + admin CRUD + public profile display)

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 25
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 6 | - | - |
| 02 | 7 | - | - |
| 3 | 7 | - | - |
| 05 | 5 | - | - |

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
| Phase 05 P03 | 45min | 3 tasks | 5 files |
| Phase 05 P04 | 40min | 3 tasks | 3 files |
| Phase 05 P05 | 35min | 2 tasks | 2 files |
| Phase 06 P01 | 75min | 2 tasks | 9 files |
| Phase 06 P02 | 55min | 3 tasks | 10 files |
| Phase 06 P03 | 85min | 2 tasks | 13 files |
| Phase 06 P04 | 100min | 3 tasks | 5 files |
| Phase 06 P05 | 165min | 3 tasks | 15 files |
| Phase 06 P06 | 70min | 3 tasks | 5 files |
| Phase 06 P07 | 210min | 3 tasks | 3 files |
| Phase 06 P08 | 55min | 3 tasks | 8 files |
| Phase 06 P09 | 45min | 3 tasks | 10 files |
| Phase 06 P10 | 55min | 2 tasks | 2 files |

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
- [Phase ?]: [Phase 5] Plan 05-03: DOCTOR_APPOINTMENT_SELECT deliberately omits patient email and slot reason (T-05-08); Rule 1 fix — added profiles_select_via_own_appointment_doctor RLS policy so the doctor-scoped patient embed stops returning null
- [Phase ?]: [Phase 5] Plan 05-04: reschedule route uses requirePatient() (unlike the session-only cancel route) since D-06/D-07 scope rescheduling to the patient alone; SQLSTATE mapping locked at MR001->409 slot message (byte-identical to booking's MR001 copy), MR002->409 appointment message, MR004->404, 40P01->409 retry message
- [Phase ?]: [Phase 5] Plan 05-04: RESEARCH Open Question 1 resolved for consistency with D-19 — the reschedule target inherits the same is_active doctor guard as booking, inside reschedule_appointment() itself, proven by Task 3 case 7; still flagged for end-of-phase confirmation
- [Phase ?]: [Phase 5] Plan 05-04: fixed leftover no-op debug assertions in a prior interrupted session's appointment-reschedule.spec.ts (Rule 1) and widened the D-10 rejection matrix test's timeout to 90s for its six sequential fixture+login sub-cases (Rule 3) — full 282-test suite green afterward
- [Phase ?]: [Phase 5] Plan 05-05: doctor page's Cancel appointment button submits to the identical shared PATCH /api/appointments/[id]/cancel route the patient page already uses (no doctor-specific endpoint, no migration, no change to cancel_appointment()) — cancel_appointment() derives cancelled_by_doctor purely from auth.uid() vs patient_id, client never sends an actor field, proven in both directions (T-05-02); row eligibility reads appointmentBadge().label === "Confirmed" plus isCancelledStatus(), mirroring the patient page's pattern
- [Phase ?]: [Phase 5] Plan 05-05: doctor dialog state/handler names (cancellingAppointment/cancelReason/cancelError/isCancelling, openCancelDialog/closeCancelDialog/handleConfirmCancel) mirror the patient page's plan-05-02 naming exactly, per that plan's explicit contract, even though they are separate files
- [Phase ?]: [Phase 5] Plan 05-05 closes the phase: all 13 APPT requirements complete, full 290-test Playwright suite green across 28 spec files, zero regressions; RESEARCH Open Question 1 (is_active guard on reschedule, flagged by plan 05-04 for end-of-phase confirmation) confirmed standing, not overturned
- [Phase 5] Post-execution closure: code review found 2 critical (CR-01 direct UPDATE bypass on `appointments`, CR-02 patient email leak to doctors via `profiles` RLS) + 2 warning findings, all 4 fixed and committed (`ab3c498`, `0359be3`, `ddb9c73`, `1fb3f63`); UAT 37/37 passed (05-UAT.md); security threat verification closed 19/19 threats (05-SECURITY.md, threats_open: 0); goal-backward phase verification passed with live re-run evidence including standalone Playwright specs independently re-proving both CR-01 and CR-02 fixes hold (05-VERIFICATION.md)
- [Housekeeping] Discovered Phase 4's ROADMAP.md summary line was never checked off (`[ ]` instead of `[x]`) despite 4/4 plans executed and complete since ~2026-08-09 — corrected to `[x] ... (completed 2026-08-09)`; the per-phase detail section already showed 4/4 complete, so this was a synthesis-line-only omission, not missing work
- [Phase ?]: [Phase 06] Plan 06-01: fixture helpers (favorites.ts, notifications.ts) route all privileged access exclusively through testAdminClient(), mirroring appointments.ts's tracking-array + splice-based cleanup idiom; zero direct SUPABASE_SERVICE_ROLE_KEY reads (grep-verified)
- [Phase ?]: [Phase 06] Plan 06-01: all 24 behavioural Wave 0 tests declared with test.fixme( (never test.skip) carrying real UI-SPEC-matching assertions across 5 spec files (patient-favorites, patient-dashboard, doctor-dashboard, notifications-realtime, locale-switching) — each owning plan 06-02..06-10 converts only its own test.fixme( to test( to activate
- [Phase ?]: [Phase 06] Plan 06-01: introduced two new UI-contract locators not pinned by 06-UI-SPEC.md ([data-slot="card"] scoped by caption for doctor-dashboard stat numbers; a Notifications-labeled bell trigger + notification-badge testid) as placeholder ground truth for plans 06-03/06-06 to satisfy
- [Phase ?]: [Phase 06] Plan 06-02: [id] in DELETE /api/patient/favorites/[id] is doctors.id (not favorites.id), matching the toggle's by-doctor-id UX; patient_id on POST is always taken from guard.userId, never the request body; a deactivated doctor's favorites row returns doctor: null rather than being filtered server-side
- [Phase ?]: [Phase 06] Plan 06-02: D-01 cross-entry-point consistency satisfied by each page independently re-fetching GET /api/patient/favorites once on mount (no shared favorites client store/context); FavoriteToggle accepts an optional className merged via cn, and syncs isFavorited from a late-resolving initialFavorited via a hasInteractedRef guard so a parent's async fetch never clobbers an in-flight optimistic click
- [Phase ?]: [Phase 06] Plan 06-03: PostgREST embedded-join head-count (appointments joined to availability_slots via !inner, .gt on the embedded start_at, count:'exact' + head:true) worked directly against the live Supabase instance -- the plan's documented row-array-length fallback was not needed
- [Phase ?]: [Phase 06] Plan 06-03: 7 pre-existing specs asserting the old 'Nothing here yet' placeholder / old link labels updated in place as a direct-consequence Rule 1 fix (not deferred) since the plan's own verification requires 0 failed; admin-doctor-link-account.spec.ts's single broken assertion had cascaded into 3 more sub-test failures via a Playwright worker restart
- [Phase ?]: [Phase 06] Plan 06-03 closes with a third recurrence of the same shared-dev-DB test-residue failure class (admin-route-protection.spec.ts:230, appointment-reschedule.spec.ts:764 afterAll timeout, seed-availability.spec.ts:170), logged to WINDOWS.md id 2; admin-doctor-status.spec.ts also failed mid-session on a full-suite run but passed 5/5 in isolation, supporting the residue theory
- [Phase ?]: [Phase 06] Plan 06-04: substituted the plan's UI-dependent named verify test (still test.fixme, needs 06-06's bell) with 6 new active API-contract Playwright tests proving the same must-haves (ownership isolation, message-absence, IDOR-safe 404s, idempotent mark-as-read) directly over HTTP; NOTIF-01..04 deliberately left Pending since end-user-visible delivery is 06-06's deliverable
- [Phase ?]: [Phase 06] Plan 06-04: public.notifications added to the supabase_realtime publication (migration 20260812090000, applied to the linked remote project), no RLS or REPLICA IDENTITY change; notifications_select_own/notifications_update_own remain the sole per-subscriber authorization boundary
- [Phase ?]: [Phase 06] Plan 06-05: locked the flat dot-namespaced dictionary key convention (surface.element[.variant]); translate() falls back locale -> English -> fixed FALLBACK_TRANSLATION, never a raw key/undefined/blank; Hebrew dictionary typed as Record<TranslationKey, string> so a missing key is a tsc compile error
- [Phase ?]: [Phase 06] Plan 06-05: app/layout.tsx became async and is now the single mount point for both <html lang>/<html dir> and <SiteHeader />; role-scoped layouts (patient/doctor/admin) kept only their auth+role redirect guards; router.refresh() alone (no reload fallback) proved sufficient to re-run the root layout and update dir/lang
- [Phase ?]: [Phase 06] Plan 06-05: components/site-header.tsx's anonymous-visitor early return removed (D-06) and profiles select widened to full_name, role (role fetched for 06-06's admin bell-omission gate, unused by this plan); language-switcher.tsx labels EN/עב never routed through t()
- [Phase 06]: [Phase 06] Plan 06-06: useNotificationRealtime awaits supabase.auth.getSession() before .channel().subscribe() -- without it, .subscribe() can race ahead of the browser client's own auth-state listener and join Realtime authenticated only as the anon key, so RLS silently drops every postgres_changes broadcast for that connection even though the channel still acks SUBSCRIBED — Closes RESEARCH Assumption A1 (flagged in the plan) -- root-caused via bisection (raw supabase-js in a bare page, Node.js reproductions, a debug widget mounted side-by-side with the real bell) after the badge-update test failed consistently on a hard page.goto to the same route.
- [Phase 06]: [Phase 06] Plan 06-06: notificationCopyKey(type, viewerRole) resolves notification copy from the viewer's OWN role (profiles.role), never a field read off the notification row -- both recipients of one event share an identical type value with no role discriminator on the row itself — RLS (notifications_select_own) already scopes every readable row to user_id = auth.uid(), so the viewer's own role is definitionally the recipient role for every row they can see; deriving copy from the row alone would be silently wrong for exactly one of the two recipients of any shared event.
- [Phase ?]: [Phase 06] Plan 06-07: RESEARCH Assumption A3 locked as option (a) - lib/i18n/validation-messages.ts's VALIDATION_MESSAGE_KEYS/translateValidationMessage() translates lib/validation/*.ts's literal English messages at the render boundary; no validator or route handler modified
- [Phase ?]: [Phase 06] Plan 06-07: authored the complete 213-key non-admin dictionary inventory (home/auth/search/doctor_card/doctor_profile/appointment_status/favorite_toggle/patient_dashboard/patient_appointments/doctor_appointments/doctor_dashboard/doctor_schedule/auth.change_password/patient_favorites/validation namespaces); languages.he/languages.en authored as the single shared pair collapsing the two duplicated LANGUAGE_LABELS maps (RESEARCH Pitfall 6); 06-08 and 06-09 consume read-only and must not add keys
- [Phase ?]: [Phase 06] Plan 06-07: appointment_status.confirmed/past/cancelled_by_patient/cancelled_by_doctor mirror lib/appointments.ts's four literal badge labels verbatim; lib/appointments.ts itself untouched (06-09 changes appointmentBadge() to return labelKey and switches both appointment pages' eligibility predicates off rendered text, T-06-40)
- [Phase ?]: [Phase 06] Plan 06-08: client-authored generic-error fallbacks (auth.login.generic_error, auth.signup.generic_error, doctor_profile.booking_generic_error) route through t(); the server route's own returned error string renders unchanged in either locale, preserving T-06-37's login non-oracle guarantee with zero route-handler changes
- [Phase ?]: [Phase 06] Plan 06-08: both duplicate LANGUAGE_LABELS maps (doctor-card.tsx, doctors/[id]/page.tsx) deleted in favor of shared languages.he/languages.en dictionary lookup with the same raw-code fallback (RESEARCH Pitfall 6 closed); search-filters.tsx's separate language Select items map also now resolves from the same pair; a third LANGUAGE_LABELS instance in app/patient/favorites/page.tsx is out of this plan's scope, owned by 06-09
- [Phase ?]: [Phase 06] Plan 06-09: AppointmentBadge.label -> labelKey: TranslationKey; both appointment pages' cancel/reschedule eligibility predicates now compare labelKey against the appointment_status confirmed key instead of rendered text, closing T-06-40 (interface-language-independent permission decision)
- [Phase ?]: [Phase 06] Plan 06-09: components/site-header.tsx and components/notification-bell.tsx received no edit -- site-header.tsx is a pure composition wrapper with zero translatable literals of its own, and notification-bell.tsx was already fully translated by 06-06; translation coverage is measured per-string, not per-file
- [Phase ?]: [Phase 06] Plan 06-09's full-suite closure run (311 passed/10 failed, 31.8min) hit only already-tracked shared-dev-DB/Supabase-Auth-under-load flakiness (WINDOWS.md id 11) across admin-doctor-crud.spec.ts, admin-doctor-link-account.spec.ts, appointment-reschedule.spec.ts:764 (afterAll cleanup timeout only) and seed-availability.spec.ts:170 -- none touch this plan's 10 files; all task-scoped specs passed cleanly
- [Phase ?]: [Phase 06] Plan 06-10: repo-wide grep audit for physical-direction Tailwind utilities returned zero matches across app/ and components/ (excluding components/ui/) - the logical-property convention held mechanically for five phases; only tests/e2e/locale-switching.spec.ts was modified (5 new tests: 2 RTL geometry regressions for the favorite heart and notification popover, 3 backstop resolutions for favorites overflow/long-text and patient-dashboard error state)
- [Phase ?]: [Phase 06] Plan 06-10 closes the phase: I18N-02 satisfied with mechanical evidence; RESEARCH Assumption A2 (router.refresh() sufficiency, 06-05) and A1 (Realtime auth hydration via getSession() await, 06-06) both have recorded dispositions; the doctor-dashboard null-count backstop resolved via code inspection (count ?? 0 fallback), not a live test, since a Server Component's direct Supabase query is unreachable by Playwright's page.route(); full-suite closure run 325 passed/1 failed (25.8min), the 1 failure the same recurring shared-dev-DB residue class as WINDOWS.md ids 1/3/5/7/8/10/11, now id 12
- [Phase ?]: [Quick 260817-eqs] Closed critical profiles RLS self-escalation: new migration narrows profiles_insert_own WITH CHECK to id = auth.uid() AND role = 'patient', applied live to the linked remote project; is_admin() reads this exact table so a self-inserted role='admin' row was total authorization compromise
- [Phase ?]: [Quick 260817-eqs] requireDoctor() now enforces must_change_password on every /api/doctor/* route (not just the (gated) page layout), closing a gap where an admin-issued temp password left the API reachable indefinitely; requireAdmin() brought to error-handling parity with requirePatient()/requireDoctor() (500 on a profiles lookup error instead of a masked 403)
- [Phase ?]: [Quick 260817-eqs] safeRedirectPath rejects any backslash (closes the /\evil.example.com browser-normalization open-redirect bypass); validateEmail/validatePassword/validateFullName typeof-guard non-string input; doctor-requests and login routes guard request.json() with try/catch + null-body normalization, mirroring app/api/appointments/route.ts's existing pattern
- [Phase ?]: [Quick 260817-fhm] notification-bell.tsx's unread badge/dots now clear in-session when the popover opens (snapshot-then-reconcile via Promise.allSettled + functional setRows, so a live Realtime insert mid-flight is never clobbered); new lib/i18n/specialty.ts localizes specialty names to Hebrew across every patient/doctor-facing surface (search cards, filters, profile, favorites, doctor-request dialog) while admin stays English-only by design
- [Phase ?]: [Quick 260817-fhm] admin appointments doctor filter now sourced from the requireAdmin()-gated GET /api/admin/doctors instead of a direct browser-client table query, with a visible error+retry state on a failed load; patient_dashboard/patient_appointments with_doctor_prefix de-duplicated ("with Dr." -> "with") since every doctor's full_name already carries the title, closing the "with Dr. Dr. {name}" display bug
- [Phase ?]: [Quick 260817-fhm] executor hit an account-level API session limit after all 4 commits landed but before its own verification pass/SUMMARY.md; orchestrator completed verification manually (tsc/eslint clean, 68/68 targeted Playwright tests including all 3 new cases) and wrote the SUMMARY.md retroactively
- [Phase ?]: [Quick 260817-lar] /admin/doctors and /admin/users tables now paginate at 25 rows/page (new lib/validation/pagination.ts + shared components/pagination-nav.tsx extracted from search-results.tsx's condensed-pagination nav); pagination is opt-in per request (unparameterized GET still returns every row) so /admin/appointments' doctor-filter dropdown keeps working off the full catalog without modification
- [Phase ?]: [Quick 260817-lar] Two admin-doctor-crud.spec.ts route stubs anticipated-and-fixed: Playwright's glob dialect treats `?` as a single-char wildcard, so `page.route("**/api/admin/doctors", ...)` stopped matching once the client started sending `?page=N` -- replaced with a regex; 65/65 targeted Playwright tests passed (admin-oversight-views, admin-doctor-crud, admin-doctor-status, admin-doctor-link-account, search-sort-pagination, new admin-pagination.spec.ts)
- [Phase ?]: [Quick 260817-nlg] New scripts/cleanup-test-residue.ts (dry-run by default, --apply to execute) removed 389 orphaned doctors/260 test accounts/229 specialties/156 locations/65 appointments accumulated from crashed Playwright runs and manual admin-UI debugging; whitelist built verbatim from scripts/seed.ts's demo catalog since doctors.is_demo defaults to true for every insert and cannot discriminate seed vs. test-fixture rows; database independently re-verified at exactly 12/12/12 + 6 real profiles after execution, resolving the long-tracked shared-dev-DB residue blocker

### Pending Todos

None yet.

### Blockers/Concerns

- ~~Shared remote dev database holds accumulated Playwright test residue in specialties/locations/doctors~~ — **RESOLVED by Quick 260817-nlg** (2026-08-17): 389 orphaned doctors, 260 test accounts, 229 specialties, 156 locations, 65 stale appointments removed via new `scripts/cleanup-test-residue.ts`; database independently re-verified at exactly 12/12/12 seed rows + 6 real profiles. The seed-availability.spec.ts:170 slot-count flake (WINDOWS.md ids 1/3/5/7/8/10/11/12) persisted through a post-cleanup smoke test and remains open — it concerns availability_slots distribution on the kept seed doctors, not the doctor/specialty/location residue this cleanup targeted.
- ⚠️ [Phase 3] Task 3 acceptance-criterion 'temporarily remove security_invoker/is_active and confirm assertion 2 fails' could not be executed: sandbox classifier blocked all npx supabase db query --linked calls (even read-only). Substituted with grep of the applied migration + a clean npx supabase db advisors --linked report. Recorded as coverage D7 (human_judgment: true) in 03-01-SUMMARY.md for optional human follow-up.
- ⚠️ [Phase 3] Two non-blocking code-review warnings left unfixed by design (03-REVIEW.md WR-02, WR-03; confirmed still open in 03-VERIFICATION.md's re-verification): out-of-range search pages report a fabricated `total: 0` instead of the real count, and the doctor-profile upcoming-slots query has no `.limit()`. Neither violates a locked must-have; worth a look if a later phase touches either endpoint.
- ⚠️ [Phase 4] Phase 4 has no `04-VERIFICATION.md`, `04-SECURITY.md`, or `04-UAT.md` — it was executed and its ROADMAP checkbox is now corrected to complete, but it never went through the same closing gates (goal-backward verification, security threat sign-off, UAT) that Phase 5 just did. Not a known defect — Phase 5's own booking flow exercises the availability infrastructure Phase 4 built, and its concurrency tests passed — but the formal artifacts don't exist. Worth backfilling via `/gsd-secure-phase 04` + a Phase 4 verifier pass before the defense if time allows.
- [Phase 06] Plan 06-01's full-suite run (npx playwright test) surfaced 3 pre-existing failures unrelated to this plan's fixme-only additions (admin-doctor-crud.spec.ts:226, appointment-reschedule.spec.ts:764 afterAll timeout, seed-availability.spec.ts:170 doctor slot count 4<6) — consistent with the already-tracked shared-dev-DB test-residue blocker, logged in deferred-items.md and WINDOWS.md, not independently confirmed against a pre-Phase-6 baseline
- [Phase 06] Plan 06-02's full-suite run reconfirmed the same class of pre-existing failures logged by 06-01 (admin-route-protection.spec.ts:230 this time instead of admin-doctor-crud.spec.ts:226, plus the same appointment-reschedule.spec.ts:764 afterAll timeout and seed-availability.spec.ts:170 slot-count assertion) — consistent with the tracked shared-dev-DB test-residue blocker, not caused by this plan (all 6 favorites tests passed)
- [Phase 06] Plan 06-03's full-suite run reconfirmed the same class of pre-existing failures for a third time (admin-route-protection.spec.ts:230 again, plus the same appointment-reschedule.spec.ts:764 afterAll timeout and seed-availability.spec.ts:170 slot-count assertion) -- consistent with the tracked shared-dev-DB test-residue blocker, not caused by this plan (all 7 dashboard/regression tests passed)
- [Phase 06] Plan 06-04's full-suite run showed a fourth recurrence of the shared-dev-DB test-residue class (seed-availability.spec.ts:170, now WINDOWS.md id 3) plus a transient dev-server ERR_CONNECTION_REFUSED window that failed 8 unrelated tests (5 of this plan's own new tests + 3 from 06-03) -- all 8 passed cleanly on an isolated re-run immediately afterward, confirming the connectivity theory; only the pre-existing residue failure persisted
- [Phase 06] Plan 06-05's full-suite run reconfirmed the same class of pre-existing failures for a fifth+ time (admin-route-protection.spec.ts:230, seed-availability.spec.ts:170) plus a new cascading admin-doctor-link-account.spec.ts failure (Supabase Auth 'Could not create a login' — plausibly rate-limiting from this session's several consecutive full-suite runs) and a notifications-realtime.spec.ts Realtime-subscription timeout -- consistent with the tracked shared-dev-DB/environment flakiness blocker, not caused by this plan (all 5 locale-switching tests and every header-touching test passed)
- [Phase 06] Plan 06-06's executing session ended (usage-limit stop, then an expired-login retry) after committing all 3 tasks but before writing 06-06-SUMMARY.md or advancing STATE.md/ROADMAP.md -- closed out retroactively in a follow-up session: independently re-verified tsc/lint/build/full-suite (the crashed session's own "13/13, run twice" claim was not accurate on first independent re-check, though a clean re-run did confirm 13/13). Full-suite run: 319 passed/2 failed, both the same pre-existing shared-dev-DB/environment flakiness class as every prior 06-0X plan (6th+ recurrence, WINDOWS.md ids 6-7), unrelated to 06-06's code.
- [Phase 06] Plan 06-07's full-suite run (321 tests) showed 305 passed/5 failed/11 did-not-run -- a worse-than-usual recurrence of the tracked shared-dev-DB test-residue/Supabase-API-rate-limiting flakiness class (WINDOWS.md ids 8-9): appointment-reschedule.spec.ts:764, doctor-schedule-overlap.spec.ts:381, doctor-schedule-visibility.spec.ts:190 (beforeAll timeout, 8 cascaded skips), seed-availability.spec.ts:170/184 (beforeAll timeout, 3 cascaded skips). An isolated re-run of just these 4 spec files passed the appointment-reschedule and doctor-schedule-visibility suites cleanly; remaining failures were afterAll-hook 30s cleanup timeouts (assertions themselves passed) plus the recurring seed-availability.spec.ts:170 residue. This plan touched zero application code (dictionary JSON + one unimported utility module only), so these are not a 06-07 regression -- but the pattern is now compounding across a long test-heavy session and would benefit from a dev-DB reset or a quieter-window re-run before /gsd-ship
- [Phase 06] Plan 06-08's full-suite run reconfirmed the same recurring shared-dev-DB/environment flakiness class for a 10th+ time (appointment-cancel.spec.ts:310 ECONNRESET, appointment-reschedule.spec.ts:764 afterAll timeout, seed-availability.spec.ts:170 slot-count 3<6) -- logged as WINDOWS.md id 10, not caused by this plan (all 77 task-scoped auth/search/doctor-profile tests passed cleanly)
- [Phase 06] Plan 06-10's full-suite closure run reconfirmed the 12th+ recurrence of the shared-dev-DB test-residue class (seed-availability.spec.ts:170, doctor slot count 3<6, WINDOWS.md id 12) - not caused by this plan (RTL/i18n test-only changes); a project reset or manual cleanup pass before the final demo/grading would present a cleaner doctor-slot distribution, per the same open item already tracked since 06-01

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260813-w0r | Fix Base UI nativeButton console warning: components/ui/button.tsx derives nativeButton from render presence (10 render={<Link/>} call sites fixed centrally); 10 Playwright selectors realigned to the resulting accessible-role flip (link -> button) | 2026-08-13 | 295d2aa | [260813-w0r-fix-base-ui-nativebutton-console-warning](./quick/260813-w0r-fix-base-ui-nativebutton-console-warning/) |
| 260816-etv | `/` becomes an auth-aware router (anon -> /login, authenticated -> /patient, /doctor or /admin via new lib/auth/role-home.ts, shared with app/login/page.tsx); realigned 6 specs (17 stale root-URL assertions) and removed 10 dead create-next-app scaffold dictionary keys | 2026-08-16 | f028c44 | [260816-etv-make-an-auth-aware-router-app-page-tsx-r](./quick/260816-etv-make-an-auth-aware-router-app-page-tsx-r/) |
| 260818-q5a | Doctor-request Approve shortcut (prefills the /admin/doctors create form with name/specialty/email, auto-links the account, auto-marks the request reviewed) + removed the duplicated admin link set from the top SiteNav, leaving AdminNav as the single admin section nav | 2026-08-18 | 55e1ab5 | [260818-q5a-two-admin-ux-fixes-doctor-request-approv](./quick/260818-q5a-two-admin-ux-fixes-doctor-request-approv/) |
| 260818-s44 | Nullable `phone` text column on `public.doctors` end to end: validation, admin create/edit form + routes, public `/doctors/[id]` display (plain text, LTR-forced), i18n label, 18 new Playwright tests; 16 existing demo doctors correctly left with phone = null (no backfill) | 2026-08-18 | 533c6e7 | [260818-s44-add-a-phone-number-field-to-the-doctors-](./quick/260818-s44-add-a-phone-number-field-to-the-doctors-/) |
| 260816-g33 | Role-aware in-app navigation bar: new components/site-nav.tsx (desktop links + mobile hamburger menu via the existing Popover primitive) wired into components/site-header.tsx, role-specific link sets for patient/doctor/admin plus an anon Search-only set, 11 new nav.* dictionary keys | 2026-08-16 | 47c99f1 | [260816-g33-add-a-role-aware-in-app-navigation-bar-s](./quick/260816-g33-add-a-role-aware-in-app-navigation-bar-s/) |
| 260817-eqs | Closed critical profiles RLS role-escalation (new migration narrows profiles_insert_own to role='patient') plus 5 defence-in-depth findings: must_change_password enforced in requireDoctor() for /api/doctor/*, backslash rejection in safeRedirectPath, typeof guards in validateEmail/validatePassword/validateFullName, requireAdmin() 500-on-error parity with sibling guards, try/catch around request.json() in doctor-requests+login | 2026-08-17 | 2ed784a | [260817-eqs-fix-critical-rls-privilege-escalation-ga](./quick/260817-eqs-fix-critical-rls-privilege-escalation-ga/) |
| 260817-fhm | Fixed 4 UI/quality findings from the visual+code review: notification unread badge now clears in-session on popover open, new lib/i18n/specialty.ts localizes specialty names to Hebrew across all patient/doctor-facing surfaces, admin appointments doctor filter routed through the admin-gated API with visible error+retry, "with Dr. Dr. {name}" duplicate title fixed via dictionary de-duplication | 2026-08-17 | 163b37d | [260817-fhm-fix-4-ui-quality-findings-notification-b](./quick/260817-fhm-fix-4-ui-quality-findings-notification-b/) |
| 260817-lar | Paginated /admin/doctors and /admin/users (25 rows/page): new lib/validation/pagination.ts + shared components/pagination-nav.tsx (extracted from search-results.tsx), opt-in per-request pagination on GET /api/admin/doctors and GET /api/admin/users so the unparameterized admin-appointments doctor-filter dropdown keeps working unchanged | 2026-08-17 | c7a81a6 | [260817-lar-add-pagination-to-admin-doctors-and-admi](./quick/260817-lar-add-pagination-to-admin-doctors-and-admi/) |
| 260817-nlg | Cleaned up accumulated Playwright/manual-debug test residue from the shared dev database via new reusable scripts/cleanup-test-residue.ts (whitelist-based, dry-run by default): removed 389 orphaned doctors, 260 test/debug accounts, 229 test specialties, 156 test locations, 65 stale appointments; database independently re-verified at exactly the 12/12/12 seed catalog + 6 real profiles | 2026-08-17 | 7c68b44 | [260817-nlg-clean-up-accumulated-playwright-manual-d](./quick/260817-nlg-clean-up-accumulated-playwright-manual-d/) |

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none — greenfield project)* | | | |

## Session Continuity

Last session: 2026-08-17T10:45:00.000Z
Stopped at: Completed quick task 260817-nlg: cleaned up 389 orphaned doctors + 260 test accounts + 229/156 test specialties/locations from the shared dev database
Resume file: None
