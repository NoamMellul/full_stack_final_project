-- S44: adds an optional contact phone number to public.doctors.
--
-- D-01 (free text, no format constraint): plain nullable `text`, no CHECK
-- constraint, no length constraint in SQL, no normalization. Human-typed
-- Israeli formats ("03-555-1234", "052-123-4567") round-trip exactly as
-- typed. Length is capped only in application validation
-- (lib/validation/doctor.ts, PHONE_MAX_LENGTH = 20).
--
-- D-02 (no backfill): existing rows — the 12 seeded demo doctors and any
-- doctor created before this ships — keep NULL. No placeholder, no default.
--
-- No policy or grant change: `public.doctors` carries no column-level
-- GRANT/REVOKE statements anywhere in supabase/migrations/ (unlike
-- `public.profiles`, which does use column grants). Its two existing
-- row-level policies (`doctors_select_active_or_owner_or_admin`,
-- `doctors_admin_write`) already cover every column on the table, so a
-- plain `alter table ... add column` is automatically covered with no
-- policy change required.

alter table public.doctors add column phone text;
