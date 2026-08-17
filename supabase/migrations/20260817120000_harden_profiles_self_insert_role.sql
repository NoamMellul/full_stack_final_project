-- CRITICAL RLS privilege-escalation fix: `profiles_insert_own` (initial
-- schema) never constrained `role`. `public.is_admin()` reads exactly this
-- table (`select 1 from public.profiles where id = auth.uid() and role =
-- 'admin'`), and it is the sole authority behind every `*_admin_write`
-- policy plus `doctor_requests_select_admin`/`doctor_requests_update_admin`.
-- A self-inserted `role = 'admin'` row is therefore total authorization
-- compromise, not a local bug.
--
-- Reachable attack path: an attacker calls `supabase.auth.signUp()` (or
-- `auth.admin.createUser()`) directly against the anon key from a browser,
-- never touching /api/auth/signup, then inserts their own `profiles` row
-- with `role: "admin"`. Supabase grants `authenticated` table-level INSERT
-- on new `public` tables by default — exactly as
-- 20260816120000_add_doctor_requests.sql's header already documents for
-- `doctor_requests` — so the old `with check (id = auth.uid())` was the only
-- gate, and it said nothing about `role`.
--
-- `patient` is the only role a user may ever grant themselves: doctor rows
-- are created by app/api/admin/doctors/[id]/link-account/route.ts with a
-- hardcoded `role: "doctor"` through the service-role client, and admin rows
-- are provisioned out-of-band — scripts/seed.ts line 208 states explicitly
-- that it never creates an admin account.
--
-- Nothing legitimate breaks: every `profiles` insert in the codebase goes
-- through the service-role client, which bypasses RLS entirely (verified via
-- `grep -rn "from(\"profiles\").insert" app scripts lib tests`):
--   - app/api/auth/signup/route.ts (admin client, hardcoded role: "patient")
--   - app/api/admin/doctors/[id]/link-account/route.ts (admin client, hardcoded role: "doctor")
--   - scripts/seed.ts (its own service-role client)
--   - tests/e2e/helpers/test-users.ts (testAdminClient())
-- None of these are `authenticated`-role inserts, so none are affected by
-- narrowing the policy that governs that role.
--
-- The sibling UPDATE escalation (granting yourself role='admin' after a
-- legitimate patient insert) was already closed by
-- 20260804120200_add_must_change_password.sql's
-- `revoke update on public.profiles from authenticated; grant update
-- (full_name, email) ...` — `role` is not in that column grant, so it cannot
-- be escalated after the fact either. That migration is deliberately left
-- untouched here.

drop policy if exists "profiles_insert_own" on public.profiles;

create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid() and role = 'patient');
