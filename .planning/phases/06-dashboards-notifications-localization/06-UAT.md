---
status: testing
phase: 06-dashboards-notifications-localization
source: [06-VERIFICATION.md]
started: 2026-08-13T19:35:00Z
updated: 2026-08-13T19:35:00Z
---

## Current Test

number: 1
name: Notification bell badge/unread-dot clears on reopen without full page reload
expected: |
  Ideally the badge count and per-row bold/dot treatment reflect the marked-as-read
  state on reopen (ADR-style UX expectation), since the PATCH calls fired on first
  open succeeded server-side.
awaiting: user response

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
result: [pending]

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
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
