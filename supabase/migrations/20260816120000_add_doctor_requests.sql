-- QUICK-260816-hb3 — Doctor request table.
--
-- A doctor who finds the site has no self-signup path (AUTH-05 is a
-- deliberate Phase 1 decision: every doctor account is admin-provisioned).
-- This table lets a real-world doctor signal interest so an admin can reach
-- out and provision them manually through the existing
-- /api/admin/doctors + link-account flow. No account, profile, doctor row,
-- trigger, function, or email is created anywhere in this diff.

create table public.doctor_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  specialty_id uuid references public.specialties (id) on delete set null,
  message text,
  status text not null default 'pending' check (status in ('pending', 'reviewed')),
  created_at timestamptz not null default now()
);

alter table public.doctor_requests enable row level security;

-- Anyone may submit a request — this is the application's first
-- unauthenticated write endpoint. The insert policy is deliberately
-- narrowed from the approved `with check (true)` to `with check (status =
-- 'pending')`: Supabase grants `anon` table-level INSERT on new `public`
-- tables by default (see 20260811100000_revoke_appointments_direct_update.sql's
-- header), so a browser can reach this table directly, bypassing the route
-- entirely. Without this narrowing, a direct anonymous insert could create a
-- row that is already marked 'reviewed' — a row that would never appear in
-- the admin's pending triage list, silently defeating the feature. Since the
-- route itself never sets `status` (the column default supplies it), this
-- check is strictly narrower than approved and never wider.
create policy "doctor_requests_insert_public" on public.doctor_requests
  for insert with check (status = 'pending');

-- Only an admin may read requests — reuses the existing zero-argument
-- public.is_admin() helper, exactly as every other admin-only policy does.
create policy "doctor_requests_select_admin" on public.doctor_requests
  for select using (public.is_admin());

create policy "doctor_requests_update_admin" on public.doctor_requests
  for update using (public.is_admin()) with check (public.is_admin());
