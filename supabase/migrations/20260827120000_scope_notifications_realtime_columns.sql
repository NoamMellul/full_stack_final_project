-- Closes 06-REVIEW.md WR-02: extend D-03's data minimization from the REST
-- select list (app/api/notifications/route.ts's NOTIFICATION_SELECT) to the
-- Realtime replication stream itself, so the stored `message` column never
-- reaches the browser over the wire — not just unrendered, but never
-- transmitted.
--
-- 20260812090000_enable_notifications_realtime.sql added
-- public.notifications to supabase_realtime with no column list, so every
-- postgres_changes INSERT event carried the full row (all 7 columns,
-- including `message`) to every subscriber's websocket connection.
--
-- Postgres has no "set the column list for one table already in a
-- publication" form — ALTER PUBLICATION ... SET TABLE would replace the
-- publication's ENTIRE table list, silently unpublishing every other table
-- currently on supabase_realtime. The only safe way to change one table's
-- column list is drop, then re-add with the explicit list.
--
-- Column list = NOTIFICATION_SELECT's 5 columns (id, type,
-- related_appointment_id, read_at, created_at) plus `user_id` — 6 total,
-- deliberately not the 7th (`message`, the stored English body text D-03
-- requires never reach a user):
--   - `user_id` is required even though the REST route omits it: the
--     browser subscription filter (`user_id=eq.${userId}` in
--     useNotificationRealtime, components/notification-bell.tsx) is
--     evaluated against the replicated columns, and the handler's
--     defense-in-depth `row.user_id !== userId` check
--     (components/notification-bell.tsx:81-85, T-06-26) reads it. Omitting
--     it breaks live delivery entirely, not just the defense check.
--   - `id` is mandatory: it is the table's replica identity (primary key),
--     and Postgres rejects a column list omitting replica-identity columns
--     on a publication that publishes UPDATE/DELETE.
--
-- No RLS policy and no REPLICA IDENTITY setting is touched here.
-- notifications_select_own / notifications_update_own
-- (20260803230000_initial_schema.sql:271-275) remain the sole per-subscriber
-- authorization boundary Realtime evaluates for every event — this
-- migration narrows transport, not authorization, exactly as
-- 20260812090000's own header states.
alter publication supabase_realtime drop table public.notifications;

alter publication supabase_realtime add table public.notifications (
  id,
  user_id,
  type,
  related_appointment_id,
  read_at,
  created_at
);
