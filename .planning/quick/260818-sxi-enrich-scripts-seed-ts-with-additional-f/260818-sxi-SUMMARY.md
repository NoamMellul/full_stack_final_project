---
status: complete
phase: quick-260818-sxi
plan: 01
subsystem: demo-data-seed
tags: [seed, demo-data, doctors, phone]
dependency-graph:
  requires: [migration 20260818120000_add_doctors_phone.sql, quick-260818-s44]
  provides: [30-doctor demo catalog, phone field wired through seedDoctors()]
  affects: [scripts/seed.ts, scripts/cleanup-test-residue.ts, tests/e2e/seed-availability.spec.ts, linked dev Supabase project]
tech-stack:
  added: []
  patterns: ["tracer task (single new entry proves the full path before the remaining 17 are authored)"]
key-files:
  created: []
  modified:
    - scripts/seed.ts
    - scripts/cleanup-test-residue.ts
    - tests/e2e/seed-availability.spec.ts
decisions:
  - "D-01 consequence (see below): the original 12 seed doctors are never UPDATEd, so they keep phone = NULL in the DB even though their DOCTORS array entries now carry a phone value (for a fresh-database seed only)."
  - "D-04 phone format: 03-555-01NN landline or 05X-555-01NN mobile, suffixes 0101-0130, all distinct, all obviously fictional."
  - "D-05: tests/e2e/seed-availability.spec.ts keeps its 12-name DOCTOR_NAMES list unchanged; only its explanatory comment was reworded to describe it as a deliberate stable subset instead of a full mirror."
metrics:
  duration: "45min"
  completed: "2026-08-18"
actuals:
  tokens: 42000
  tasks: 2
  commits: 2
---

# Phase quick-260818-sxi Plan 01: Enrich scripts/seed.ts with additional fictional doctors and phone numbers Summary

Grew `scripts/seed.ts`'s demo doctor catalog from 12 to 30 fictional Tel-Aviv doctors, wired the
already-existing `public.doctors.phone` column through the seed pipeline (`DemoDoctor.phone` ->
`seedDoctors()`'s insert row -> `printSummary()`'s new catalog counters), synchronized
`scripts/cleanup-test-residue.ts`'s whitelist, and applied the result twice to the linked dev
Supabase project to prove idempotency.

## What Was Built

**Task 1 (tracer):** Proved the whole path — type, insert, database column, and reporting — with
a single new catalog entry (Dr. Yael Barnea, Family Medicine, Florentin) before authoring the
other seventeen.
- Added a required `phone: string` field to `DemoDoctor`, positioned after `bio`.
- Gave each of the original 12 `DOCTORS` entries a fictional phone (landline/mobile alternating,
  suffixes 0101-0112) — these values exist for a fresh-database seed only; per D-01 they never
  reach the already-seeded dev rows.
- `seedDoctors()`'s insert row now writes `phone: doctor.phone`.
- `printSummary()` gained two catalog-scoped counters, `catalog_doctors=<n>` and
  `catalog_doctors_with_phone=<n>`, computed via two standalone `.eq("is_demo", true).in("full_name",
  ...)` queries (one further narrowed with `.not("phone", "is", null)`) since `countRows()` only
  supports equality filters.
- `scripts/cleanup-test-residue.ts`'s `SEED_DOCTOR_NAMES` extended with `"Dr. Yael Barnea"` in the
  same commit.
- Verified: `npm run seed` reported `catalog_doctors=13 catalog_doctors_with_phone=1`, `npx tsc
  --noEmit` clean.

**Task 2:** Expanded the proven path to the full catalog.
- Appended data_spec rows 2-18 (17 more doctors) to `DOCTORS`, each with a one-sentence bio in the
  established clinical/plain voice and a distinct fictional phone (suffixes 0113-0130, `03-555-01NN`
  landline or `05X-555-01NN` mobile, alternating).
- `DOCTORS_WITHOUT_SLOTS` left unchanged at its two original names (D-03) — every new doctor is
  seeded with availability.
- `scripts/cleanup-test-residue.ts`'s whitelist extended to all 30 catalog names; header comment
  corrected from "12 seed doctor names" to "30 seed doctor names".
- `tests/e2e/seed-availability.spec.ts`'s comment above `DOCTOR_NAMES` reworded per D-05 to
  describe the list as a deliberate stable subset of the (now 30-doctor) catalog rather than a
  full mirror. Zero identifier, list entry, or assertion changes.
- Applied to the linked dev project: `npm run seed` reported `catalog_doctors=30
  catalog_doctors_with_phone=18`, byte-identical on a second consecutive run. `npx tsx
  scripts/cleanup-test-residue.ts` (dry run) reported "keeping 30 seed doctors" and proposed
  deleting 4 pre-existing residue doctors plus 1 stray specialty/location — never a catalog name.
- Regression sweep: `admin-pagination`, `admin-doctor-crud`, `doctor-phone`, `seed-availability` —
  47/48 passed. `npx tsc --noEmit` and `npm run lint` both clean.

## D-01 Consequence (explicitly recorded per plan's output spec)

On the current dev database, **the 12 original seed doctors still carry `phone = NULL`** while the
18 new doctors carry a value. `seedDoctors()` is idempotent by `full_name` and issues no UPDATE
against existing rows — it only ever inserts rows for names not yet present. The original 12's
`DOCTORS` array entries were given phone values in Task 1 so that a seed run against a **fresh**
database produces all 30 doctors with phones, but that has no effect on the already-seeded dev
rows. Independently re-verified against the live database: all 12 original doctors have `phone ===
null`; all 18 new doctors have a distinct, non-null phone.

Filling in the original 12's phones on the current dev database would require a separate, opt-in
backfill task (a deliberate UPDATE), which is out of scope here per D-01.

## Verification Evidence

- `catalog_doctors=30 catalog_doctors_with_phone=18` on two consecutive `npm run seed` runs
  (byte-identical summary line) — idempotency confirmed (T-02-16).
- Live DB query confirmed: 12 original doctors all `phone = null`; 18 new doctors all
  non-null and mutually distinct (18 distinct phone strings).
- Distribution confirmed live: all 12 specialties have >= 2 doctors (3,3,3,3,3,3,2,2,2,2,2,2 = 30
  total); all 12 neighborhoods have >= 2 doctors (3,3,3,3,2,3,2,2,3,2,2,2 = 30 total).
- `npx tsx scripts/cleanup-test-residue.ts` dry run: "Doctors to delete: 4 (of 34 total, keeping 30
  seed doctors)" — the 4 targeted for deletion are pre-existing unrelated test residue, never a
  catalog name (proven by construction: the script only targets names absent from
  `SEED_DOCTOR_NAMES`, which now holds exactly the 30 catalog names).
- `npx tsc --noEmit` and `npm run lint`: both clean after each task.
- Regression sweep (`admin-pagination`, `admin-doctor-crud`, `doctor-phone`,
  `seed-availability`): 47/48 passed.

## Deviations from Plan

None — plan executed exactly as written, including the tracer feedback gate (auto-mode active,
`workflow.auto_advance=true`; the tracer's own `<verify>` was re-run and passed before Task 2's
expansion began).

### Known Pre-existing Failure (not a regression, documented per plan instruction)

**`tests/e2e/seed-availability.spec.ts` test 4** ("every doctor holding any slot holds between 6
and 10 of them") failed with `Received: 3` against one of the original 12 doctors. This spec's
`DOCTOR_NAMES` list (D-05) contains only the original 12 doctor names — it was deliberately left
unchanged by this plan and therefore structurally cannot reference any of the 18 new doctors. This
is the long-tracked shared-dev-DB slot-count flake already logged in `WINDOWS.md` (ids
1/3/5/7/8/10/11/12): a doctor's earlier-seeded future slots expire over time as the 21-day horizon
advances, eventually dropping below the 6-slot minimum until the doctor is naturally re-seeded.
Not caused by this plan's changes; every other test across all 4 regression spec files passed
(47/48).

## Self-Check: PASSED

- FOUND: scripts/seed.ts (phone field, 30-entry DOCTORS array, updated printSummary counters)
- FOUND: scripts/cleanup-test-residue.ts (30-name whitelist)
- FOUND: tests/e2e/seed-availability.spec.ts (reworded comment, zero assertion changes)
- FOUND commit c49cbe2 (Task 1: wire phone end-to-end with one new doctor)
- FOUND commit c9a9900 (Task 2: grow catalog to 30, sync whitelist, apply)
- Live database independently re-verified: 30 catalog doctors, 18 with phone, 12 original with
  phone = null, distribution matches data_spec exactly.
