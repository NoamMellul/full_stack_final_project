-- Phase 3: public doctor search view.
--
-- doctor_search_view flattens the joins every search/filter/sort needs
-- (specialty, location, aggregated spoken languages, earliest future
-- available slot) into plain columns so the whole search — filter, sort
-- with nulls last, and server-side .range() pagination — is expressible as
-- a single Supabase-JS query builder call (03-RESEARCH.md Pattern 1).
--
-- security_invoker = true is mandatory: without it the view runs with the
-- owner's privileges and silently bypasses
-- doctors_select_active_or_owner_or_admin and
-- availability_slots_select_available_or_owner_or_admin (threat T-03-02).
-- Postgres 17 (supabase/config.toml) supports this option (PG15+).
--
-- Column list locked at the 03-01 plan checkpoint: option-a (minimal — the
-- RESEARCH.md column list). See 03-01-SUMMARY.md for the record.

create view public.doctor_search_view
with (security_invoker = true) as
select
  d.id,
  d.full_name,
  d.bio,
  d.photo_url,
  d.is_demo,
  d.specialty_id,
  s.name_en as specialty_name_en,
  s.name_he as specialty_name_he,
  d.location_id,
  l.city,
  l.neighborhood,
  coalesce(lang.codes, '{}') as language_codes,
  next_slot.start_at as next_available_at
from public.doctors d
join public.specialties s on s.id = d.specialty_id
join public.locations l on l.id = d.location_id
left join lateral (
  select array_agg(lng.code) as codes
  from public.doctor_languages dl
  join public.languages lng on lng.id = dl.language_id
  where dl.doctor_id = d.id
) lang on true
left join lateral (
  select a.start_at
  from public.availability_slots a
  where a.doctor_id = d.id
    and a.status = 'available'
    and a.start_at > now()
  order by a.start_at asc
  limit 1
) next_slot on true
where d.is_active = true; -- defense-in-depth; RLS also enforces this for anon (T-03-03)

-- A newly created relation does not inherit the anon/authenticated grants
-- already applied to the underlying tables — omitting this makes
-- GET /api/doctors return zero rows for every visitor (T-03-08).
grant select on public.doctor_search_view to anon, authenticated;
