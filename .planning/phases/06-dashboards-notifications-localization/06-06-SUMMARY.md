---
phase: 06-dashboards-notifications-localization
plan: 06
subsystem: notifications
tags: [supabase-realtime, websocket, popover, i18n, rls, playwright]

# Dependency graph
requires:
  - phase: 06-dashboards-notifications-localization
    provides: "06-04's GET /api/notifications + PATCH /api/notifications/[id]/read routes, the NOTIFICATION_SELECT column allowlist (no message field), and the supabase_realtime publication on public.notifications"
  - phase: 06-dashboards-notifications-localization
    provides: "06-05's i18n runtime (lib/i18n/dictionaries.ts, useT, TranslationKey) and the single-mount SiteHeader with profiles.role already fetched"
provides:
  - "components/ui/popover.tsx — generated Popover/PopoverTrigger/PopoverContent/PopoverHeader/PopoverTitle over the already-installed @base-ui/react, no new npm dependency"
  - "lib/i18n/notification-copy.ts — notificationCopyKey(type, viewerRole): TranslationKey, typed so a missing dictionary key is a compile error"
  - "components/notification-bell.tsx — default NotificationBell + exported useNotificationRealtime hook + exported NotificationRow type"
  - "components/site-header.tsx — bell mounted between the name span and LogoutButton, gated to patient/doctor roles, omitted for admin"
affects: []

# Actuals (#2632)
actuals:
  tokens: 4897
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Realtime postgres_changes subscription hook (useNotificationRealtime) exported alongside its consuming component: supabase.channel(`notifications-${userId}`) + .on('postgres_changes', {event:'INSERT', filter:'user_id=eq.<id>'}) + removeChannel cleanup"
    - "Await supabase.auth.getSession() before opening any Realtime channel on a freshly-constructed browser client — forces the client's internal auth-state listener (and its realtime.setAuth() call) to complete before .subscribe(), otherwise the channel can silently join authenticated as the anon key and RLS drops every broadcast with no visible error"

key-files:
  created:
    - components/ui/popover.tsx
    - lib/i18n/notification-copy.ts
    - components/notification-bell.tsx
  modified:
    - components/site-header.tsx
    - tests/e2e/notifications-realtime.spec.ts

key-decisions:
  - "notificationCopyKey(type, viewerRole) resolves copy from the viewer's OWN role (profiles.role), never a field read off the notification row — both recipients of one event share an identical type value with no role discriminator on the row itself"
  - "useNotificationRealtime awaits supabase.auth.getSession() before .subscribe() — closes RESEARCH Assumption A1 (flagged in the plan) by fixing an auth-hydration race on a fresh browser client, not the token-refresh scenario A1 specifically speculated about; root-caused via bisection (raw supabase-js in a bare page, Node.js reproductions, a debug widget mounted side-by-side with the real bell) that first ruled out Realtime infra, topic naming, and React Strict Mode double-invoke"
  - "Realtime channel topic kept at the plan's plain `notifications-${userId}` (no per-mount registry/reuse scheme) — an interim debugging pass had added a module-scope channel-reuse registry to work around a suspected Strict Mode issue before the real cause was found; removed once the getSession() fix made the simple per-effect channel sufficient"
  - "Session interruption mid-plan (Claude Code session usage limit, then one expired-login retry) — Tasks 1-2 were already committed and stood untouched; Task 3 resumed cleanly after re-authentication with no rework needed"

patterns-established:
  - "Type+viewer-role dictionary resolver pattern (lib/i18n/notification-copy.ts) for any future notification type — extend NOTIFICATION_COPY_KEYS, never the row schema"

requirements-completed: [NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04]

coverage:
  - id: D1
    description: "Popover dropdown primitive and the type+viewer-role dictionary resolver — notificationCopyKey(type, viewerRole) returns a typed TranslationKey, falling back to notifications.generic for an unrecognised type"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit; notificationCopyKey('appointment_booked','patient') -> 'notifications.appointment_booked.patient', notificationCopyKey('appointment_booked','doctor') -> '...doctor', notificationCopyKey('unknown','patient') -> 'notifications.generic' (lib/i18n/notification-copy.ts read + traced)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Patient sees an in-app notification after their booking is confirmed (NOTIF-01)"
    requirement: "NOTIF-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/notifications-realtime.spec.ts:114 'patient sees a notification after booking'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Doctor sees an in-app notification after a patient books an appointment with them (NOTIF-03)"
    requirement: "NOTIF-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/notifications-realtime.spec.ts:139 'doctor sees a notification after a patient books'"
        status: pass
    human_judgment: false
  - id: D4
    description: "Patient sees an in-app notification after their appointment is cancelled by the doctor (NOTIF-02)"
    requirement: "NOTIF-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/notifications-realtime.spec.ts:172 'patient sees a notification after the doctor cancels'"
        status: pass
    human_judgment: false
  - id: D5
    description: "Patient sees an in-app notification after rescheduling their own appointment (NOTIF-04)"
    requirement: "NOTIF-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/notifications-realtime.spec.ts:211 'patient sees a notification after rescheduling'"
        status: pass
    human_judgment: false
  - id: D6
    description: "The unread badge count increases with no page reload when a new row is inserted for the signed-in user, driven by the Realtime postgres_changes INSERT subscription (D-02)"
    verification:
      - kind: e2e
        ref: "tests/e2e/notifications-realtime.spec.ts:258 'the notification badge updates without a page reload'"
        status: pass
    human_judgment: false
  - id: D7
    description: "Cross-user isolation: one user never receives another user's notification over Realtime or the REST API, and PATCH mark-as-read returns the byte-identical 404 for a foreign, missing, or malformed id"
    verification:
      - kind: e2e
        ref: "tests/e2e/notifications-realtime.spec.ts:278 'one user never receives another user's notification'; :338 'GET never returns another user's notification'; :383 'PATCH returns the byte-identical 404 for a foreign, missing, or malformed id'"
        status: pass
    human_judgment: false
  - id: D8
    description: "The bell is mounted only for patient/doctor sessions and omitted entirely for admin; no Realtime channel opens for an anonymous visitor or an admin session"
    verification:
      - kind: unit
        ref: "components/site-header.tsx read: bell renders only when profile?.role === 'patient' || profile?.role === 'doctor'; components/notification-bell.tsx read: useNotificationRealtime's effect returns immediately when userId is null"
        status: pass
    human_judgment: false
  - id: D9
    description: "Opening the popover marks every currently-listed unread notification as read via fire-and-forget PATCH calls (snapshot-at-open semantics; a notification arriving while already open stays unread until the next open)"
    verification: []
    human_judgment: true
    rationale: "The underlying PATCH endpoint's idempotent mark-read contract is proven at the API level (tests/e2e/notifications-realtime.spec.ts:357, from 06-04), but no test intercepts or asserts that opening the popover actually fires those PATCH calls, nor that a live-arriving row is excluded from the snapshot. This UI-triggering behavior is proven only by reading handleOpenChange in components/notification-bell.tsx, not by an automated assertion."
  - id: D10
    description: "The Realtime channel is closed on unmount (removeChannel), so navigating away and back does not leak a websocket subscription"
    verification: []
    human_judgment: true
    rationale: "No runtime leak-detection test asserts the websocket is actually closed on unmount or that a second mount doesn't accumulate connections; only the static presence of the removeChannel() call in the effect's cleanup path was confirmed by reading components/notification-bell.tsx."
  - id: D11
    description: "Loading (2 skeleton rows), error (message + outline Retry button), and empty ('No notifications yet.', no CTA) popover states render per the UI-SPEC"
    verification: []
    human_judgment: true
    rationale: "The empty state is incidentally exercised by the 'one user never receives another user's notification' test, but the loading-skeleton and fetch-error/Retry branches are not reached by any automated test — only confirmed by reading the status-branched JSX in components/notification-bell.tsx."

# Metrics
duration: "commits span 2026-08-12T22:12 to 2026-08-13T09:22 (~70min if measured wall-clock), but a Claude Code session usage-limit stop and one expired-login retry fall inside that span — active implementation time is closer to the ~70min Tasks 1-2 took before the interruption plus a short Task 3 resumption; not a clean single-session duration"
completed: 2026-08-13
status: complete
---

# Phase 06 Plan 06: Notification Bell (Popover, Realtime Subscription, Header Mount) Summary

**Popover-anchored notification bell — type+viewer-role dictionary resolver, Realtime `postgres_changes` live badge updates, and mark-as-read-on-open — closing NOTIF-01 through NOTIF-04, retroactively documented after the executing session ended without writing this SUMMARY.**

## Performance

- **Tasks:** 3
- **Commits:** 3 (`343dc72`, `2fac422`, `64c53ef`)
- **Files:** 3 created, 2 modified
- **Note:** This SUMMARY was written retroactively. The executing agent completed and committed all three tasks but stopped (session usage limit, then an expired-login error on the first resume attempt) before writing 06-06-SUMMARY.md or advancing STATE.md/ROADMAP.md. This closure pass independently re-verified the implementation from the git history and a clean re-run rather than trusting the crashed session's own completion claim.

## Accomplishments
- `components/ui/popover.tsx` generated via `npx shadcn add popover` over the already-installed `@base-ui/react` — `package.json`/`package-lock.json` byte-unchanged
- `lib/i18n/notification-copy.ts`: `notificationCopyKey(type, viewerRole)` resolves the three known `notifications.type` values crossed with `patient`/`doctor` to a typed `TranslationKey`, falling back to `notifications.generic` for anything else — typed so a missing dictionary key is a `tsc` compile error, not a blank row
- `components/notification-bell.tsx`: `Popover`-anchored bell trigger (`Bell` icon, `size-11 sm:size-8`), unread badge (`absolute -top-1 end-1`, primary color, caps at `9+`), loading (2 `Skeleton` rows) / error (message + outline Retry) / empty (`No notifications yet.`) / populated states, each row showing an unread dot, dictionary-resolved copy, and a Jerusalem-timezone timestamp via `formatJerusalemDayHeading`/`formatJerusalemTime`
- Opening the popover snapshots currently-listed unread ids and fires one fire-and-forget `PATCH /api/notifications/{id}/read` per id (idempotent endpoint, no blocking, no per-item or mark-all-read control)
- `useNotificationRealtime(userId, onInsert)`: opens `supabase.channel(\`notifications-${userId}\`)`, subscribes to `postgres_changes` INSERT filtered to `user_id=eq.<id>`, independently re-checks `payload.new.user_id` against the prop before calling `onInsert` (defense in depth on top of the RLS/filter boundary), and tears the channel down via `removeChannel` on unmount; returns immediately with no channel opened when `userId` is `null`
- The hook awaits `supabase.auth.getSession()` before `.subscribe()` — the real bug found during Task 3: without it, `.subscribe()` could race ahead of the browser client's own auth-state listener and join the Realtime connection authenticated only as the anon key, so RLS silently dropped every broadcast for that connection even though the channel still acked `SUBSCRIBED`
- `components/site-header.tsx`: `<NotificationBell userId={user.id} viewerRole={profile.role} />` mounted between the name span and `LogoutButton`, rendered only when `profile?.role` is `"patient"` or `"doctor"` — omitted entirely (not disabled) for `admin`
- `tests/e2e/notifications-realtime.spec.ts`: all 6 remaining `test.fixme(` placeholders converted to `test(`; all 13 tests in the file pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Popover primitive and the type-plus-viewer-role copy resolver** - `343dc72` (feat)
2. **Task 2: NotificationBell — trigger, badge, popover list, and mark-as-read on open** - `2fac422` (feat)
3. **Task 3: Realtime subscription lifecycle and the header mount** - `64c53ef` (feat)

**Plan metadata:** commit pending (docs: complete plan — this closure)

## Files Created/Modified
- `components/ui/popover.tsx` - generated shadcn Popover/PopoverTrigger/PopoverContent/PopoverHeader/PopoverTitle
- `lib/i18n/notification-copy.ts` - notificationCopyKey(type, viewerRole) -> TranslationKey
- `components/notification-bell.tsx` - NotificationBell + useNotificationRealtime + NotificationRow
- `components/site-header.tsx` - bell mounted, gated to patient/doctor
- `tests/e2e/notifications-realtime.spec.ts` - 6 test.fixme( activated to test(

## Decisions Made
- See `key-decisions` in frontmatter — copy resolved from the viewer's own role, the `getSession()`-before-`subscribe()` auth-hydration fix, and dropping the interim debug-registry workaround once the real root cause was isolated.

## Deviations from Plan

### Auto-fixed Issues

**1. [Root-cause fix, not in original plan text] Await `supabase.auth.getSession()` before opening the Realtime channel**
- **Found during:** Task 3 — the "badge updates without a page reload" test failed consistently on a hard `page.goto` back to the same route (mirroring real navigation), even though the channel acked `SUBSCRIBED` cleanly
- **Issue:** `useNotificationRealtime` opened the channel using a server-sourced `userId` prop without ever touching the browser Supabase client's own auth state; `.subscribe()` could race ahead of `createClient()`'s internal auth-state listener and join Realtime authenticated only as the anon key, so `postgres_changes` broadcasts silently never passed RLS for that connection
- **Fix:** `await supabase.auth.getSession()` before `.channel().subscribe()`, forcing the auth-state listener's `realtime.setAuth()` call to complete first; the same await also acts as the effect's own Strict-Mode double-invoke guard
- **Files modified:** components/notification-bell.tsx
- **Verification:** `tests/e2e/notifications-realtime.spec.ts` "the notification badge updates without a page reload" passes reliably; confirmed again in this closure's independent full-suite run
- **Committed in:** `64c53ef` (Task 3 commit)

**2. [Process, not code] Interim debugging left in an uncommitted state after the session interruption**
- **Found during:** this closure pass, inspecting the working tree left behind by the crashed session
- **Issue:** before isolating the root cause above, the executing agent had added a module-scope channel-reuse registry (worked around a suspected React Strict Mode issue rather than the real cause) plus five `console.error("[debug] ...")` statements to `components/notification-bell.tsx`, and two untracked scratch files (`scratch-debug-overlap.mjs`, `tests/e2e/scratch-debug3.spec.ts`) used to reproduce the bug outside the app
- **Fix:** all of the above were removed before the Task 3 commit landed — confirmed by grep (`console\.|debug|CLIENT_INSTANCE_ID|notificationChannels` returns nothing in the committed file) and by `git status` (no untracked scratch files remain)
- **Files affected:** components/notification-bell.tsx (cleaned before commit, not after)
- **Verification:** `git show 64c53ef --stat` shows only the three plan-declared files; working tree clean of scratch files at closure time
- **Committed in:** `64c53ef` (never separately committed — cleaned up before that commit)

---

**Total deviations:** 1 auto-fixed code change (root-cause fix beyond the plan's literal text, but directly closing the plan's own flagged RESEARCH Assumption A1) + 1 process note (debug scaffolding cleaned before commit, not shipped). No scope creep in the final committed code.

## Issues Encountered
- **Session interruption:** the executing agent stopped mid-Task-3 on a Claude Code session usage-limit error, then failed a first resume attempt on an expired-login error. Tasks 1-2 were already committed and untouched by either failure; Task 3 resumed cleanly after `/login` and completed without redoing prior work. The session ended without writing `06-06-SUMMARY.md` or advancing `STATE.md`/`ROADMAP.md` — this SUMMARY and the accompanying state updates are that closure, done retroactively.
- **Self-report discrepancy:** the resumed session's own completion report claimed "Full suite: 13/13 passing, run twice for reliability." An independent re-run of just `notifications-realtime.spec.ts` immediately after showed 2 failures on the first attempt (`notifications table is published to supabase_realtime` timed out; `doctor sees a notification after a patient books` hit `ECONNRESET`). Both passed cleanly on isolated re-run and on a second full run of the same file (13/13) — consistent with this project's already-documented shared-dev-DB/environment flakiness, not a real regression, but the initial claim of a clean double-run was not accurate and is corrected here rather than repeated.
- **Closure-time build/test tooling accident:** while independently verifying, an `rm -rf .next` was run while a Playwright-driven dev server was still live against the same directory; this corrupted the Turbopack cache mid-run (a Rust panic in the dev server, `Unable to open static sorted file`) and produced a first, untrustworthy full-suite attempt. Recovered by killing all node processes, deleting `.next` cleanly with nothing else touching it, rebuilding, and re-running the full suite from a cold, uncontaminated state. The numbers reported in this SUMMARY are from that clean run, not the corrupted one.
- **Clean full-suite result (321 tests, 34.7min):** 319 passed, 2 failed. Both failures are the same pre-existing shared-dev-DB/environment flakiness class already logged in every prior 06-0X plan's SUMMARY and in `WINDOWS.md` (ids 1-5): `appointment-reschedule.spec.ts:764` (afterAll cleanup hook timeout) and `seed-availability.spec.ts:170` (doctor slot count 3 < 6). Logged as WINDOWS.md ids 6 and 7 — 6th+ recurrence of the same class. Neither touches notification code; all 13 of this plan's own `notifications-realtime.spec.ts` tests passed within that same clean run.
- `npx tsc --noEmit`: clean. `npm run lint`: clean (0 problems). `npm run build`: succeeds on a cold `.next` (the one failure seen during verification was the tooling accident above, not a real build defect — confirmed by a clean rebuild immediately after).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- NOTIF-01 through NOTIF-04 are all satisfied end-to-end with live, passing Playwright evidence.
- Phase 6 has four plans remaining: 06-07 (Wave 4), 06-08/06-09 (Wave 5), 06-10 (Wave 6) — none of them declare a dependency on 06-06 in their `depends_on` frontmatter, so this plan is a phase-internal leaf deliverable rather than a blocking dependency for what follows.
- Three coverage deliverables (D9 mark-as-read-on-open UI behavior, D10 websocket cleanup on unmount, D11 loading/error visual states) are marked `human_judgment: true` — none are proven by an automated test, only by source reading. Worth a manual UAT pass before shipping if time allows, though none contradict anything observed in the code.
- The pre-existing shared-dev-DB/environment flakiness class (`appointment-reschedule.spec.ts:764`, `seed-availability.spec.ts:170`, previously also `admin-route-protection.spec.ts:230`) has now recurred 6+ times across every phase-6 plan's full-suite run. STATE.md and WINDOWS.md both already flag this for a human to confirm before `/gsd-ship` — this plan's clean, isolated full-suite run (after ruling out this closure's own tooling accident) is further independent confirmation the pattern is environmental, not a code regression.

---
*Phase: 06-dashboards-notifications-localization*
*Completed: 2026-08-13*

## Self-Check: PASSED

All 5 key-files (3 created, 2 modified) verified present on disk with the expected exports; all 3 task commit hashes (`343dc72`, `2fac422`, `64c53ef`) verified present in git log; `npx tsc --noEmit` and `npm run lint` both clean; `npm run build` succeeds on a cold `.next`; `tests/e2e/notifications-realtime.spec.ts` 13/13 passed in both an isolated run and within a full 321-test suite run (319 passed, 2 failed — both pre-existing and unrelated, logged as WINDOWS.md ids 6-7).
