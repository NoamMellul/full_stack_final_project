---
status: complete
phase: 06-dashboards-notifications-localization
source: [06-VERIFICATION.md]
started: 2026-08-13T19:35:00Z
updated: 2026-08-27T00:00:00Z
---

## Current Test

None — both tests resolved. See Test 2's `decision_260827` below for the human decision that closed this UAT round.

## Tests

### 1. Notification bell badge/unread-dot clears on reopen without full page reload
expected: |
  Open the notification bell as a patient/doctor with 2+ unread notifications, close
  the popover, and reopen it without a full page reload. Ideally the badge count and
  per-row bold/dot treatment reflect the marked-as-read state on reopen, since the
  PATCH calls fired on first open succeeded server-side.
why_human: |
  Code review WR-01 (components/notification-bell.tsx:157-171) found the component
  never updates its own `rows` state after firing the mark-as-read PATCHes, so the
  badge/unread-dot stays stale for the rest of the browser session until a full
  reload. Not contradicted by any literal must-have truth in 06-06-PLAN.md, but it
  silently defeats the "mark-all-on-open" interaction documented in the route
  handler's own comment. Needs a human product decision: acceptable for phase
  sign-off, or follow-up fix required?
resolution: |
  Already fixed by commit 163b37d (quick task 260817-fhm, 2026-08-17), before this
  item was even filed. Re-confirmed by direct code read (quick task 260827-isc,
  2026-08-27) with zero new edits to components/notification-bell.tsx: markReadOnOpen
  awaits Promise.allSettled over the per-id PATCH calls and applies a functional
  setRows update to only the server-confirmed ids; handleOpenChange snapshots unread
  ids synchronously at open time. Resolved by a landed code fix with automated proof,
  not a human eyeball pass.
result: pass
source: automated
proving_test: "the unread badge clears after opening the bell, without a page reload"

### 2. Realtime notification payload does not leak the withheld `message` column over the wire
expected: |
  Inspect the WebSocket frames (or React DevTools state) delivered to the browser for
  a `postgres_changes` INSERT event on `public.notifications`. Ideally the frame would
  carry only the columns needed for client rendering (id, type, related_appointment_id,
  read_at, created_at, user_id).
why_human: |
  Code review WR-02 found the Realtime publication migration
  (supabase/migrations/20260812090000_enable_notifications_realtime.sql:14) has no
  column list, so every Realtime INSERT event carries the full row including `message`
  to the browser — even though `message` is never read or rendered by
  useNotificationRealtime's handler or the REST route. This is a literal, if narrow,
  reading of 06-04-PLAN.md's own prohibition ("The stored notifications.message column
  must never reach the browser or be rendered to a user") — the column reaches browser
  memory over the wire even though it never reaches the DOM. Needs a human
  product/security decision: acceptable transport-level exposure for this
  low-sensitivity audit field, or should a column-list publication be applied as a
  follow-up?
update_260827_isc: |
  supabase/migrations/20260827120000_scope_notifications_realtime_columns.sql applied
  live (db push --linked) and independently confirmed correct at the Postgres catalog
  level (pg_publication_tables shows exactly the 6 intended columns, message absent).
  A new wire-level Playwright test (tests/e2e/notifications-realtime.spec.ts,
  "notifications publication withholds the message column from the wire", currently
  test.fixme) still observed `message` in the live decoded payload across 5
  consecutive runs spanning several minutes, each with a fresh channel and fresh
  sentinel value. This points to the managed Realtime service's wal2json-based CDC
  decoder, not the Postgres publication definition itself, as the remaining gap —
  outside this session's CLI/application-level reach to fix or force-refresh. Still
  needs a human product/security decision, now narrowed to: accept the DB-level fix
  as delivered with wire-level exposure as a documented residual risk, or keep this
  blocking until wire-level delivery is independently reconfirmed (possibly requiring
  a Supabase-side project restart or a longer-elapsed re-test).
decision_260827: |
  Human decision: accepted as documented residual risk (not pursued further). The
  Postgres publication catalog is correctly scoped (the authoritative boundary
  Postgres itself enforces); the managed Realtime service's wire-level gap remains
  unresolved pending a Supabase-side fix, but `message` is short, server-generated,
  non-medical informational text, never rendered client-side by design (D-03) — so
  practical exposure is minimal. A full project restart (the only known remaining
  lever) was judged not worth the disruption for this risk level. Carried forward in
  STATE.md Blockers/Concerns as an optional follow-up before a production deploy with
  real user data.
result: pass
source: human_decision

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
