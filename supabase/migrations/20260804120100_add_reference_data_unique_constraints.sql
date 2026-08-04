-- Natural-key uniqueness for the two reference-data tables the admin manages
-- and the demo-data seed script depends on for idempotent `on conflict do
-- nothing` seeding (D-07).
--
-- Locked at the 02-03 checkpoint (option-a): `unique (neighborhood, city)` on
-- `public.locations` — matches the "one row per Tel-Aviv neighborhood" seed
-- design and Phase 3's planned neighborhood filter. If the remote project
-- already holds violating duplicate rows, this migration fails loudly on
-- `db push`, which is the correct outcome — resolve the data, never weaken
-- the constraint.

alter table public.specialties
  add constraint specialties_name_en_key unique (name_en);

alter table public.locations
  add constraint locations_neighborhood_city_key unique (neighborhood, city);
