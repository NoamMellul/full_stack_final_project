-- Add an optional free-text note a doctor attaches when blocking a period
-- (D-04). Nullable with no default and no length cap: the rows already
-- seeded by plan 03-02, and every existing `available` or `booked` row, must
-- never be forced to a placeholder value. Content is deliberately
-- unvalidated — this is informational only, never structured or parsed
-- (RESEARCH.md Pitfall 3). "Not applicable to available/booked rows" is a
-- convention enforced by the route handlers (plan 04-03), not a database
-- constraint (Task 1 decision: option-a).

alter table public.availability_slots add column reason text;
