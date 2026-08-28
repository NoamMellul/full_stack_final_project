---
phase: 06-dashboards-notifications-localization
plan: 04
subsystem: api
tags: [supabase, realtime, postgres-changes, nextjs, route-handlers, playwright, rls]

# Dependency graph
requires:
  - phase: 05-appointment-booking-lifecycle
    provides: "book_appointment()/cancel_appointment()/reschedule_appointment() SECURITY DEFINER RPCs already write every notification row this plan reads"
  - phase: 06-dashboards-notifications-localization
    provides: "06-01's tests/e2e/helpers/notifications.ts fixture (insertTestNotification/readNotificationsFor/cleanupTestNotifications) and notifications-realtime.spec.ts test.fixme( placeholders"
provides:
  - "public.notifications added to the supabase_realtime publication (migration 20260812090000), applied to the linked remote project"
  - "GET /api/notifications — NOTIFICATION_SELECT allowlist (id, type, related_appointment_id, read_at, created_at), message column structurally excluded"
  - "PATCH /api/notifications/[id]/read — ownership-restated mark-as-read, byte-identical 404 across missing/foreign/malformed ids, idempotent"
  - "6 new active Playwright tests proving the replication + REST contract independently of the still-unbuilt notification bell UI"
affects: [06-06]

# Actuals (#2632)
actuals:
  tokens: 5900
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Service-role Realtime subscription test: testAdminClient().channel(...).on('postgres_changes', {event:'INSERT', schema:'public', table:'notifications'}, ...).subscribe() awaited to SUBSCRIBED via a Promise, then expect.poll() for the event payload — proves publication+replication independently of RLS/UI"
    - "API-contract Playwright tests as a substitute verify surface: when a plan's named UI-dependent test.fixme( test cannot be activated in-plan (its assertions need a component owned by a later plan), add new test( cases in the same describe block that exercise the same must-haves through page.request/request directly, rather than borrowing or prematurely converting the UI-gated title"

key-files:
  created:
    - supabase/migrations/20260812090000_enable_notifications_realtime.sql
    - app/api/notifications/route.ts
    - "app/api/notifications/[id]/read/route.ts"
  modified:
    - tests/e2e/notifications-realtime.spec.ts
    - .planning/WINDOWS.md
    - .planning/phases/06-dashboards-notifications-localization/deferred-items.md

key-decisions:
  - "The plan's named <verify> test for Task 2/3 (\"one user never receives another user's notification\") is still test.fixme( — it asserts on a Notifications trigger button and bell dropdown that components/notification-bell.tsx (06-06) has not been built yet, so activating it now would fail on missing UI, not prove anything about this plan's routes. Left it exactly as 06-01 declared it (owned by 06-06 per that plan's established convention: 'each owning plan converts only its own test.fixme( to test('), and added 6 new active tests directly exercising GET/PATCH /api/notifications over HTTP (401, ownership isolation, message-absence, idempotent mark-as-read, byte-identical 404 across foreign/missing/malformed ids) as the actual, executable verification for this plan's must-haves"
  - "NOTIF-01 through NOTIF-04 are NOT marked complete by this plan, despite being listed in this plan's frontmatter requirements — each requirement's own wording ('Patient/doctor RECEIVES an in-app notification') describes end-user-visible behavior that only exists once 06-06 wires the bell UI to this plan's routes and the Realtime subscription; 06-06's own PLAN.md frontmatter lists the identical four requirement IDs, confirming it is the intended completion point"
  - "REPLICA IDENTITY left at the Postgres default (primary key) — FULL is only needed for DELETE old-row payloads, and this application never deletes notification rows; the migration touches no RLS policy, since notifications_select_own/notifications_update_own (initial schema) already are the per-subscriber authorization boundary Realtime evaluates per event"

patterns-established:
  - "API-contract Playwright tests as a plan-scoped verification substitute when a plan's own must-haves are proven by routes whose UI consumer is explicitly a later plan in the same phase"

requirements-completed: []

coverage:
  - id: D1
    description: "public.notifications replicated to the supabase_realtime publication on the live linked Supabase project — an inserted row produces a received postgres_changes event for a service-role subscriber, independent of RLS/UI"
    requirement: "NOTIF-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/notifications-realtime.spec.ts#notifications table is published to supabase_realtime"
        status: pass
    human_judgment: false
  - id: D2
    description: "GET /api/notifications returns the calling user's own notifications, most recent first, with the stored message column structurally absent from both the select string and the response payload"
    requirement: "NOTIF-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/notifications-realtime.spec.ts#GET /api/notifications requires authentication"
        status: pass
      - kind: e2e
        ref: "tests/e2e/notifications-realtime.spec.ts#GET /api/notifications returns the caller's own notifications, message absent"
        status: pass
      - kind: e2e
        ref: "tests/e2e/notifications-realtime.spec.ts#GET /api/notifications never returns another user's notification"
        status: pass
    human_judgment: false
  - id: D3
    description: "PATCH /api/notifications/[id]/read marks the caller's own notification read (idempotently), and returns the byte-identical 404 for a missing, foreign-user, or malformed id — never an existence oracle"
    requirement: "NOTIF-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/notifications-realtime.spec.ts#PATCH /api/notifications/[id]/read requires authentication"
        status: pass
      - kind: e2e
        ref: "tests/e2e/notifications-realtime.spec.ts#PATCH /api/notifications/[id]/read marks the caller's own notification read, idempotently"
        status: pass
      - kind: e2e
        ref: "tests/e2e/notifications-realtime.spec.ts#PATCH /api/notifications/[id]/read returns the byte-identical 404 for a foreign, missing, or malformed id"
        status: pass
    human_judgment: false
  - id: D4
    description: "Full existing suite stays green after this plan's additive-only changes (no pre-existing test files edited, only notifications-realtime.spec.ts gained new tests)"
    verification:
      - kind: e2e
        ref: "npx playwright test (full suite): 301 passed, 11 skipped, 9 failed — the concurrent full-suite run; an isolated re-run of the 4 affected spec files immediately afterward showed 17 passed, 1 failed (seed-availability.spec.ts:170), confirming 8 of the 9 failures were a transient dev-server ERR_CONNECTION_REFUSED window, not a defect"
        status: unknown
    human_judgment: true
    rationale: "seed-availability.spec.ts:170 is the fourth recurrence of the same shared-dev-DB-residue class already tracked in WINDOWS.md ids 1/2 (06-01, 06-03) and STATE.md's Blockers/Concerns, unrelated to any file this plan touches. The other 8 failures (this plan's own 5 new tests plus 3 untouched patient-dashboard.spec.ts tests from 06-03) reproduced 0 failures on an isolated re-run of the same 4 files, consistent with a transient dev-server connectivity blip during the 27-minute concurrent run rather than a real regression — but a human should independently confirm this reading is correct before /gsd-ship, per the same open item 06-01/06-02/06-03 already carry forward."

# Metrics
duration: 100min
completed: 2026-08-12
status: complete
---

# Phase 06 Plan 04: Notification Replication and Read API Summary

**Enabled Supabase Realtime replication for `public.notifications` (applied to the linked remote project) and built the REST surface both roles consume: `GET /api/notifications` (message column structurally excluded) and `PATCH /api/notifications/[id]/read` (byte-identical 404 for missing/foreign/malformed ids, idempotent), verified end-to-end by 7 new active Playwright tests.**

## Performance

- **Duration:** ~100 min (includes a 27-minute full-suite regression run)
- **Tasks:** 3
- **Files modified:** 4 created/modified core files + 2 planning-doc updates (WINDOWS.md, deferred-items.md)

## Accomplishments
- `supabase/migrations/20260812090000_enable_notifications_realtime.sql`: single `alter publication supabase_realtime add table public.notifications;` statement, no RLS/REPLICA IDENTITY change, applied via `npx supabase db push` and confirmed present in both the `local` and `remote` columns of `npx supabase migration list`
- A first attempt to prove replication timed out (55s) immediately after applying the migration — a debug script and a second Playwright run minutes later both succeeded instantly, consistent with a brief Realtime-service publication-cache propagation delay after `ALTER PUBLICATION`, not a code defect; the final test is stable across repeated runs
- `app/api/notifications/route.ts`: `GET` handler using the bare session shape (`createClient()` + `auth.getUser()`, not `requirePatient()`/`requireDoctor()`, since both roles read this table), `NOTIFICATION_SELECT` allowlist omitting `message` entirely (D-03), `.eq("user_id", user.id)` restating `notifications_select_own` RLS, ordered `created_at desc, id desc`
- `app/api/notifications/[id]/read/route.ts`: `PATCH` handler scoping both `id` and `user_id` in the same update `WHERE` clause, `UUID_RE` pre-check rejecting malformed ids with the same 404 as a genuinely missing row (mirrors `app/api/doctor/slots/[id]/route.ts`'s T-04-03 doctrine), `read_at` written unconditionally (no `.is("read_at", null)` filter) so repeat calls are idempotent
- Added 7 new active Playwright tests to `tests/e2e/notifications-realtime.spec.ts`: 1 service-role Realtime publication proof (Task 1) + 6 direct HTTP-level API-contract tests (Tasks 2/3) covering 401s, ownership isolation, message-absence, idempotent mark-as-read, and the byte-identical 404 across foreign/missing/malformed ids — all pass in isolation and in a targeted re-run
- `npx tsc --noEmit`, `npm run lint`, and `npm run build` all pass with zero errors; both new routes appear in the build's route manifest (`ƒ /api/notifications`, `ƒ /api/notifications/[id]/read`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Realtime publication migration for public.notifications, applied to the linked project** - `4af9b88` (feat)
2. **Task 2: GET /api/notifications — role-agnostic, ownership-restated, message-free** - `ea959dd` (feat)
3. **Task 3: PATCH /api/notifications/[id]/read — ownership-restated, 404 for anything not yours** - `918d993` (feat)

**Plan metadata:** commit pending (docs: complete plan)

## Files Created/Modified
- `supabase/migrations/20260812090000_enable_notifications_realtime.sql` - adds `public.notifications` to the `supabase_realtime` publication
- `app/api/notifications/route.ts` - `GET`, `NOTIFICATION_SELECT` constant, `NotificationRow` type
- `app/api/notifications/[id]/read/route.ts` - `PATCH`, ownership-restated mark-as-read
- `tests/e2e/notifications-realtime.spec.ts` - +1 Realtime publication test (Task 1), +6 API-contract tests (Tasks 2/3); the 6 pre-existing UI-dependent `test.fixme(` tests were left untouched, still owned by 06-06
- `.planning/WINDOWS.md` - ledger entry id 3, fourth recurrence of the shared-dev-DB-residue class
- `.planning/phases/06-dashboards-notifications-localization/deferred-items.md` - 06-04 section documenting the full-suite run's 9 failures (8 transient, 1 pre-existing residue)

## Decisions Made
- Left `REPLICA IDENTITY` at the Postgres default (primary key) — `FULL` is only required for DELETE old-row payloads, and this application never deletes notification rows
- Added no RLS policy: `notifications_select_own`/`notifications_update_own` (initial schema) already are the per-subscriber authorization boundary Realtime evaluates for every `postgres_changes` event; replication broadens transport, not authorization (T-06-14)
- Substituted the plan's named UI-dependent `<verify>` test (`"one user never receives another user's notification"`, still `test.fixme(` — needs 06-06's bell UI) with 6 new active API-contract tests proving the identical must-haves (ownership isolation, message-absence, IDOR-safe 404s, idempotency) directly over HTTP, since converting that specific test now would fail on missing UI, not validate this plan's routes
- Did not mark NOTIF-01 through NOTIF-04 complete in REQUIREMENTS.md despite them being listed in this plan's frontmatter — each requirement describes end-user-visible in-app notification delivery, which is only true once 06-06 wires the bell component to this plan's routes and Realtime subscription (06-06's own PLAN.md frontmatter lists the identical four IDs)

## Deviations from Plan

### Auto-fixed Issues

None — no Rule 1/2/3 auto-fixes were needed; both routes and the migration were implemented as specified.

### Verification Substitution (documented, not a code fix)

**1. Plan's named `<verify>` test for Tasks 2/3 is UI-dependent and out of this plan's scope**
- **Found during:** preparing to run the plan's specified `<automated>` verify command for Task 2 (`npx playwright test tests/e2e/notifications-realtime.spec.ts -g "one user never receives another user's notification"`)
- **Issue:** That test (declared `test.fixme(` by 06-01) navigates to `/patient`, clicks a `"Notifications"`-labeled button, and asserts `"No notifications yet."` is visible — none of which exists yet (`components/notification-bell.tsx` is 06-06's deliverable, confirmed via `grep -rn "Notifications" app/` and `grep -rln "notification" components/` both returning zero matches before this plan ran). Activating it now would fail on missing UI, proving nothing about whether this plan's routes are correct, and would incorrectly claim a requirement 06-06 has not yet delivered.
- **Resolution:** Added 6 new active tests in the same file/describe block that exercise the identical must-haves (401 unauthenticated, ownership isolation, message-field absence, idempotent mark-as-read, byte-identical 404 for foreign/missing/malformed ids) directly through `page.request`/`request`, without touching the UI-dependent `test.fixme(` test. All 6 pass.
- **Files modified:** `tests/e2e/notifications-realtime.spec.ts`
- **Verification:** `npx playwright test tests/e2e/notifications-realtime.spec.ts -g "GET/PATCH /api/notifications API contract"` — 6/6 passed
- **Committed in:** `ea959dd` (Task 2), `918d993` (Task 3)

---

**Total deviations:** 0 auto-fixed; 1 documented verification substitution (not a code change, a test-strategy adjustment necessitated by a cross-plan UI dependency the original plan's verify command did not account for)
**Impact on plan:** No scope creep, no production-code deviation. The substitution gives this plan's own routes real, executable proof of every must-have without prematurely building or stubbing 06-06's UI.

## Issues Encountered
- The Task 1 Realtime publication test timed out (55s) on its very first run, immediately after `npx supabase db push` applied the migration. A standalone Node debug script using the identical `testAdminClient()` + channel-subscribe + insert pattern succeeded instantly a few minutes later, and the Playwright test itself then passed reliably on every subsequent run (confirmed 3 times). This reads as a one-time Realtime-service publication-cache propagation delay right after `ALTER PUBLICATION supabase_realtime ADD TABLE`, not a defect in the test or the migration — no code change was made in response, only re-verification.
- The full-suite `npx playwright test` run (27 minutes) reported 9 failures: 5 in this plan's own new API-contract tests and 3 in `patient-dashboard.spec.ts` (06-03, untouched by this plan), all with the identical `net::ERR_CONNECTION_REFUSED` error, plus 1 in `seed-availability.spec.ts:170` (the pre-existing shared-dev-DB-residue class already tracked in `WINDOWS.md` ids 1/2). Re-running exactly those 4 spec files in isolation immediately afterward produced 17 passed / 1 failed — every connection-refused failure passed cleanly, and only the pre-existing `seed-availability.spec.ts:170` failure reproduced. Logged as `WINDOWS.md` ledger id 3 and `deferred-items.md`'s 06-04 section, consistent with the same open item 06-01/06-02/06-03 already carry forward in `STATE.md` Blockers/Concerns.

## User Setup Required

None - no external service configuration required. The migration was applied non-interactively via the already-linked Supabase CLI (`SUPABASE_ACCESS_TOKEN` already configured from Phase 1).

## Next Phase Readiness
- 06-06 (notification bell + Realtime subscription) can now build directly against a live, replicated `public.notifications` table and a proven REST contract: `GET /api/notifications` (5-field allowlist, `message` structurally absent) and `PATCH /api/notifications/[id]/read` (idempotent, IDOR-safe)
- The 6 UI-dependent `test.fixme(` tests in `tests/e2e/notifications-realtime.spec.ts` (booking/cancel/reschedule notification copy, live badge update, cross-user isolation via the bell) are unchanged and ready for 06-06 to activate
- NOTIF-01 through NOTIF-04 remain "Pending" in `REQUIREMENTS.md` by design — 06-06 is the plan that should mark them complete, once the bell UI makes the notification genuinely visible to the user
- Before `/gsd-ship`, a human should independently confirm the fourth recurrence of the shared-dev-DB-residue class (`seed-availability.spec.ts:170`, now `WINDOWS.md` id 3) is not a regression — same open item 06-01/06-02/06-03 already carry forward, still unresolved by a project reset

---
*Phase: 06-dashboards-notifications-localization*
*Completed: 2026-08-12*

## Self-Check: PASSED

All 5 key files verified present on disk (migration, both route files, the modified spec file, this
SUMMARY); all 3 task commit hashes (`4af9b88`, `ea959dd`, `918d993`) verified present in `git log`.
