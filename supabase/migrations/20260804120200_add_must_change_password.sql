-- Forced first-login password change for admin-linked doctor accounts (D-03, D-04).
--
-- Part 1: the gate flag. Default is deliberately `false` — defaulting to
-- `true` would sweep in every existing row and every future patient
-- self-signup through `/api/auth/signup`, forcing a password change on users
-- who never needed one (RESEARCH Pitfall 1). Only
-- app/api/admin/doctors/[id]/link-account/route.ts sets it `true`, and it
-- does so explicitly on insert.

alter table public.profiles
  add column must_change_password boolean not null default false;

-- Part 2: column-level write lockdown. `profiles_update_own_or_admin` is a
-- row-level policy with no WITH CHECK clause, so its USING expression governs
-- the check too — meaning a logged-in user can currently write any column of
-- their own row, including the new flag and their own `role`. Row-level
-- policies cannot express column scope, so column-level grants are used
-- instead. The table-level privilege must be revoked first — a column-level
-- REVOKE does not remove a table-level grant.
--
-- No existing code path updates `profiles` through the session-bound client
-- (verified: only `select` calls exist in app/*/layout.tsx and
-- app/api/auth/login/route.ts), and the service-role client is unaffected by
-- these grants, so nothing in the app breaks.

revoke update on public.profiles from authenticated;
grant update (full_name, email) on public.profiles to authenticated;
