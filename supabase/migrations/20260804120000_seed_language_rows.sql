-- MedRDV — Seed the fixed set of language rows.
-- public.languages was created empty by the Phase 1 schema (only the CHECK
-- constraint restricts values to 'he' / 'en'); doctor_languages has nothing
-- to reference until these two rows exist.

insert into public.languages (code) values ('he'), ('en') on conflict (code) do nothing;
