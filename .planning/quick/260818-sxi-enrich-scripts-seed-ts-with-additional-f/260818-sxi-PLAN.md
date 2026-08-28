---
phase: quick-260818-sxi
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/seed.ts
  - scripts/cleanup-test-residue.ts
  - tests/e2e/seed-availability.spec.ts
autonomous: true
requirements: [SXI-01]
user_setup: []

estimate:
  tokens: 60000
  raw_tokens: 30000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "Running `npm run seed` against the linked dev database leaves the demo catalog at 30 doctors, with every one of the 12 specialties carrying at least 2 doctors and every one of the 12 Tel-Aviv neighborhoods carrying at least 2 doctors."
    - "Each of the 18 newly seeded doctors carries a fictional Israeli-format phone string, so a patient opening that doctor's public /doctors/[id] profile sees a phone line."
    - "A second consecutive `npm run seed` run inserts zero additional rows — the script stays idempotent."
    - "The 12 pre-existing seed doctors keep their original full_name, bio, specialty, neighborhood and language rows untouched; the run issues no UPDATE and no DELETE against them."
    - "Every newly seeded doctor holds future availability slots (the two documented no-slot names remain the only demo doctors with none), so the enriched catalog is bookable in a demo."
    - "`npx tsx scripts/cleanup-test-residue.ts` in dry-run mode reports zero of the 30 catalog doctors as deletable — the new doctors can never be swept as test residue."
  artifacts:
    - "scripts/seed.ts — DemoDoctor gains a phone field, DOCTORS grows from 12 to 30 entries, seedDoctors() writes phone, printSummary() reports catalog counters"
    - "scripts/cleanup-test-residue.ts — SEED_DOCTOR_NAMES whitelist extended from 12 to all 30 catalog names"
  key_links:
    - "DOCTORS[].full_name -> cleanup-test-residue.ts SEED_DOCTOR_NAMES: a name present in the seed catalog but absent from the whitelist gets deleted the next time the cleanup script is applied. This is the highest-consequence link in the task."
    - "DOCTORS[].full_name -> seedAvailabilitySlots()'s `.in(\"full_name\", doctorNames)` read-back: new entries automatically qualify for slot seeding with no change to that function."
    - "DOCTORS[].specialty_name_en / .location_neighborhood -> SPECIALTIES / LOCATIONS catalogs: seedDoctors() throws at insert time on an unmatched value, so a typo fails loudly rather than silently."
    - "DemoDoctor.phone -> seedDoctors() insert row -> public.doctors.phone (migration 20260818120000): the column already exists; only the script side is missing."
---

<objective>
Grow `scripts/seed.ts`'s demo doctor catalog from 12 to 30 fictional Tel-Aviv doctors and wire the
already-existing `public.doctors.phone` column through the seed pipeline, then apply the result to the
linked dev Supabase project.

Purpose: the app currently shows exactly one doctor per specialty, which reads as a stub during a
university thesis defense. A 30-doctor catalog with 2-3 doctors per specialty, phone numbers on the new
profiles, and real availability makes search, filtering and pagination demonstrate as a working product.

Output: an extended `DOCTORS` array with `phone` wired through `seedDoctors()`, a synchronized residue
whitelist in `scripts/cleanup-test-residue.ts`, and the enriched catalog live in the dev database.
</objective>

<execution_context>
@C:/Users/mellu/Desktop/full_stack_final_project/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/mellu/Desktop/full_stack_final_project/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/CLAUDE.md

@scripts/seed.ts
@scripts/cleanup-test-residue.ts
@supabase/migrations/20260818120000_add_doctors_phone.sql
</context>

<interface_context>

Facts already confirmed by reading the current files — do not re-derive these:

- `public.doctors.phone` exists as plain nullable `text`, no CHECK constraint, no default
  (migration `20260818120000_add_doctors_phone.sql`, applied live). Application-level cap is
  `PHONE_MAX_LENGTH = 20` in `lib/validation/doctor.ts`, enforced after `.trim()`.
- `scripts/seed.ts`'s `DemoDoctor` type and `seedDoctors()`'s insert row object both currently omit
  `phone`. The insert writes exactly: `full_name`, `bio`, `specialty_id`, `location_id`,
  `is_active: true`, `photo_url: null`.
- `seedDoctors()` is idempotent by `full_name`: it reads back every `is_demo = true` doctor, builds a
  name Set, and filters `DOCTORS` down to unseen names. It issues no UPDATE and no DELETE. Existing
  rows are therefore never touched — including their `phone`, which stays NULL for the original 12.
- `seedAvailabilitySlots()` re-reads eligible doctors from the database using
  `.eq("is_demo", true).in("full_name", DOCTORS.map(d => d.full_name))`, then excludes
  `DOCTORS_WITHOUT_SLOTS`. New `DOCTORS` entries are picked up automatically with zero change to that
  function. Each seeded doctor receives `DAYS_PER_DOCTOR * SLOTS_PER_DAY` = 9 slots.
- The slot generator's window guard is safe at 28 eligible doctors: `firstSlotOffsetMinutes` is
  `(i % 6) * 30`, so the latest possible slot ends at 13:00 Israel time, far inside the 17:00 bound.
  Slot day offsets are `(i % 7)`-derived and per-doctor, so more doctors cannot collide.
- `scripts/cleanup-test-residue.ts` deletes every `doctors` row whose `full_name` is absent from its
  hardcoded `SEED_DOCTOR_NAMES` Set (currently the same 12 names). Its console output derives counts
  from `SEED_DOCTOR_NAMES.size`, so the printed numbers update themselves once the Set grows.
- `GET /api/admin/doctors` orders `created_at` descending, so the new rows land at the top of
  `/admin/doctors` page 1 and push older rows down. `tests/e2e/admin-pagination.spec.ts` asserts
  "at most 25 rows" and presence of the pagination nav — both are satisfied more strongly, not less,
  by a larger catalog.
- `tests/e2e/seed-availability.spec.ts` carries its own hardcoded 12-name `DOCTOR_NAMES` mirror and
  scopes every assertion through it. Leaving that list at 12 keeps the spec a valid, narrower sample
  and avoids widening exposure to the long-tracked slot-count flake (WINDOWS.md ids 1/3/5/7/8/10/11/12).

</interface_context>

<decisions>

Locked before execution — do not re-litigate:

- **D-01 — The original 12 doctors are not modified.** No UPDATE, no backfill, no rewrite of their
  array entries' name/bio/specialty/neighborhood/languages. This is an explicit user constraint and
  aligns with T-02-16 (the seed script never destroys or mutates data it did not just create). The
  consequence is accepted and must be stated in the SUMMARY: on the current dev database the original
  12 doctors keep `phone = NULL` while the 18 new ones carry one. A future opt-in backfill is a
  separate task, not this one.
- **D-02 — All 30 array entries carry a `phone` value.** `phone` becomes a required field on
  `DemoDoctor` (not optional), so the catalog is complete and a seed against a *fresh* database yields
  30 doctors all carrying phones. On the already-seeded dev database only the 18 new rows receive it,
  per D-01.
- **D-03 — New doctors get availability slots.** `DOCTORS_WITHOUT_SLOTS` stays at exactly its two
  current names and gains nothing, preserving `seed-availability.spec.ts` test 6's assertion that at
  least two demo doctors have zero future slots.
- **D-04 — Phone strings are fictional by construction.** Format is Tel-Aviv landline `03-555-01NN`
  or Israeli mobile `05X-555-01NN`, with the 4-digit suffix drawn from the 0101-0199 range. The
  `555` exchange plus a `01NN` suffix reads as obviously synthetic, matches the fixture-phone shape
  already used elsewhere in the test suite, and cannot collide with the specific literals those tests
  assert on. Every string is 11-12 characters, comfortably inside `PHONE_MAX_LENGTH`.
- **D-05 — `tests/e2e/seed-availability.spec.ts` keeps its 12-name list.** Only its explanatory
  comment is corrected to describe the list as a deliberate subset rather than a full mirror. Zero
  assertion changes, zero behavior changes.
- **D-06 — No new specialties and no new neighborhoods.** Every new doctor reuses an existing
  `SPECIALTIES` / `LOCATIONS` entry, so no migration, no dictionary key, and no
  `lib/i18n/specialty.ts` change is needed.

</decisions>

<data_spec>

The 18 new doctors, appended to `DOCTORS` in this exact order. Specialty, neighborhood and languages
are **structural and locked** (they produce the verifiable distribution below). Names are given so the
`cleanup-test-residue.ts` whitelist is deterministic. Bios and phone digits are authored by the
executor within the rules in Task 2.

| # | Full name | Specialty (name_en) | Neighborhood | languages |
|---|-----------|---------------------|--------------|-----------|
| 1 | Dr. Yael Barnea | Family Medicine | Florentin | ["he", "en"] |
| 2 | Dr. Itai Shalev | Cardiology | Lev HaIr | ["he"] |
| 3 | Dr. Roni Halevi | Dermatology | Ramat Aviv | ["en"] |
| 4 | Dr. Sivan Ashkenazi | Pediatrics | Old North | ["he", "en"] |
| 5 | Dr. Gilad Sharabi | Gynecology | Jaffa | ["he"] |
| 6 | Dr. Maayan Doron | Psychiatry | Neve Tzedek | ["en"] |
| 7 | Dr. Nadav Tzur | Orthopedics | Bavli | ["he", "en"] |
| 8 | Dr. Efrat Nagar | Ophthalmology | Montefiore | ["he"] |
| 9 | Dr. Boaz Harari | Otolaryngology (ENT) | New North | ["en"] |
| 10 | Dr. Hila Vaknin | Gastroenterology | Yad Eliyahu | ["he", "en"] |
| 11 | Dr. Assaf Reuveni | Neurology | Kerem HaTeimanim | ["he"] |
| 12 | Dr. Talia Ben-Ari | Urology | Lev HaIr | ["en"] |
| 13 | Dr. Oren Malka | Family Medicine | Ramat Aviv | ["he", "en"] |
| 14 | Dr. Keren Elbaz | Cardiology | Old North | ["he"] |
| 15 | Dr. Doron Sela | Dermatology | Shapira | ["en"] |
| 16 | Dr. Adi Zohar | Pediatrics | Florentin | ["he", "en"] |
| 17 | Dr. Lior Amsalem | Gynecology | New North | ["he"] |
| 18 | Dr. Nitzan Kaplan | Psychiatry | Jaffa | ["en"] |

The `languages` column continues the existing every-third rotation uncut: array index 12 resumes at
both-languages, so the final catalog is 10 bilingual / 10 Hebrew-only / 10 English-only.

Resulting distribution the verification asserts:

- Specialties: Family Medicine 3, Cardiology 3, Dermatology 3, Pediatrics 3, Gynecology 3,
  Psychiatry 3, Orthopedics 2, Ophthalmology 2, Otolaryngology (ENT) 2, Gastroenterology 2,
  Neurology 2, Urology 2 — 30 total, minimum 2 per specialty.
- Neighborhoods: Lev HaIr 3, Florentin 3, Ramat Aviv 3, Old North 3, New North 3, Jaffa 3,
  Neve Tzedek 2, Yad Eliyahu 2, Kerem HaTeimanim 2, Bavli 2, Montefiore 2, Shapira 2 — 30 total,
  minimum 2 per neighborhood.

</data_spec>

<tasks>

<task type="tracer">
  <name>Task 1: Wire phone end-to-end through the seed pipeline with one new doctor</name>
  <files>scripts/seed.ts, scripts/cleanup-test-residue.ts</files>
  <precondition>`.env.local` supplies `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, and the linked dev Supabase project is reachable — `npm run seed` reads both at module load and throws immediately if either is absent. Halt and report if the run cannot reach the database rather than editing around it.</precondition>
  <action>
Prove the whole path — type, insert, database column, and reporting — with a single new catalog entry
before authoring the other seventeen.

In `scripts/seed.ts`:

1. Add a required `phone: string` field to the `DemoDoctor` type, positioned directly after `bio` so it
   mirrors how `bio` already sits in the shape.
2. Give each of the 12 existing `DOCTORS` entries a `phone` value following D-04's format
   (alternate landline and mobile shapes, suffixes drawn from the 0101-0199 range, every value
   distinct). Per D-01 these values will not reach the already-seeded dev rows — they exist so the
   catalog is complete for a fresh database. Change nothing else about those 12 entries.
3. Append data_spec row 1 only — Dr. Yael Barnea, Family Medicine, Florentin, `["he", "en"]` — with a
   one-sentence bio in the same voice as the existing entries (present tense, role plus clinical
   focus) and a phone matching D-04.
4. In `seedDoctors()`, add `phone: doctor.phone` to the insert row object, alongside the existing
   `bio` mapping. Do not touch the existing-name idempotency filter, the specialty/location id
   lookups, or the thrown error messages.
5. Extend `printSummary()` with two new catalog-scoped counters so the seed run self-reports what it
   built. Add a query counting `doctors` rows where `is_demo` is true and `full_name` is in
   `DOCTORS.map(d => d.full_name)` — call it the catalog count. Add a second identical query further
   narrowed with `.not("phone", "is", null)` — the catalog-with-phone count. Emit them inside the
   existing single `console.log` line as `catalog_doctors=<n>` and `catalog_doctors_with_phone=<n>`,
   placed between the existing `doctors=` and `doctor_languages=` fields. These two counters are the
   verification surface for both tasks, so the field names must appear exactly as written here.
   `countRows()` only supports equality filters, so write these as their own inline queries rather
   than bending that helper.
6. Update the two stale comment blocks: the file header's doctor-count phrase, and the block above
   `DOCTORS` describing the array as one doctor per specialty and per neighborhood. Both must describe
   the catalog the file actually holds once Task 2 lands (30 doctors, 2-3 per specialty, 2-3 per
   neighborhood, phone on every entry, language rotation unchanged).

In `scripts/cleanup-test-residue.ts`, add `"Dr. Yael Barnea"` to `SEED_DOCTOR_NAMES`. This must land in
the same commit as the seed change — a catalog name missing from that whitelist is a row the cleanup
script will delete.

Then run the seeder against the linked dev project and confirm the reported counters.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run seed 2>&1 | grep -E "catalog_doctors=13 catalog_doctors_with_phone=1( |$)"</automated>
  </verify>
  <done>
`npm run seed` completes without error and its summary line reports exactly 13 catalog doctors, 1 of
them carrying a phone. `npx tsc --noEmit` is clean. The new doctor exists in the dev database with its
phone stored, and the original 12 are untouched.
  </done>
</task>

<task type="auto">
  <name>Task 2: Author the remaining 17 doctors, sync the residue whitelist, and apply</name>
  <files>scripts/seed.ts, scripts/cleanup-test-residue.ts, tests/e2e/seed-availability.spec.ts</files>
  <precondition>Task 1 is committed and its seed run succeeded — this task's expected counters assume the catalog already stands at 13 doctors with the phone field wired through.</precondition>
  <action>
Expand the proven path to the full catalog.

In `scripts/seed.ts`, append data_spec rows 2 through 18 to `DOCTORS`, in the table's order, taking
`full_name`, `specialty_name_en`, `location_neighborhood` and `languages` verbatim from that table.
For each entry author:

- A bio of one sentence (two at most) in the established voice: present tense, the doctor's role
  followed by a clinical focus or the patient group they serve. Match the register of the existing
  entries — clinical and plain, never marketing copy, never a claim about credentials, awards,
  affiliations or years at a named institution. A neighborhood mention is acceptable in roughly one
  entry out of twelve, mirroring how sparingly the existing 12 do it.
- A `phone` per D-04: Tel-Aviv landline `03-555-01NN` or Israeli mobile with an `050`/`052`/`054`/`058`
  prefix as `05X-555-01NN`. Draw the 4-digit suffix from the 0101-0199 range, keep every value in the
  file distinct from every other, and alternate landline and mobile shapes so the directory does not
  read as machine-generated.

These are invented people. Do not reach for a recognizable public figure's name, and do not source a
digit sequence from any real clinic, business or directory. `.claude/CLAUDE.md` requires the demo data
be plainly identifiable as demonstration data.

Leave `DOCTORS_WITHOUT_SLOTS` at its two current names (D-03) — new doctors are seeded with
availability so the enriched catalog is bookable.

In `scripts/cleanup-test-residue.ts`, extend `SEED_DOCTOR_NAMES` with all 17 remaining names so the Set
holds exactly the 30 catalog names, and correct the header comment's description of the whitelist size
to match. The printed plan lines already read the Set's size dynamically, so they need no edit.

In `tests/e2e/seed-availability.spec.ts`, update only the comment above `DOCTOR_NAMES` (D-05): it
currently describes that list as mirroring the seed script's arrays, which stops being accurate once
the catalog grows. Reword it to state the list is a deliberate stable subset of the seed catalog,
sufficient for the shape rules this spec proves. Change no identifier, no list entry, and no assertion.

Then apply to the linked dev project: run `npm run seed`, confirm the counters, run it a second time
and confirm the counters are byte-identical (idempotency). Finally run
`npx tsx scripts/cleanup-test-residue.ts` in its default dry-run mode and confirm it reports keeping 30
seed doctors and that its doctors-to-delete figure covers only pre-existing residue, never a catalog
name. Do not pass `--apply`.

Run the regression sweep in the verify block. `seed-availability.spec.ts` is slow (it runs the seeder
twice) and its test 4 slot-count assertion is a long-tracked shared-dev-DB flake affecting doctors whose
earlier seeded slots have since expired — if that specific assertion fails on a pre-existing doctor,
record it as the known flake rather than treating it as a regression, but any failure naming one of the
18 new doctors is a real defect and must be fixed.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run lint && npm run seed 2>&1 | grep -E "catalog_doctors=30 catalog_doctors_with_phone=18( |$)" && npx tsx scripts/cleanup-test-residue.ts | grep -E "keeping 30 seed doctors" && npx playwright test tests/e2e/admin-pagination.spec.ts tests/e2e/admin-doctor-crud.spec.ts tests/e2e/doctor-phone.spec.ts tests/e2e/seed-availability.spec.ts</automated>
  </verify>
  <done>
`npm run seed` reports exactly 30 catalog doctors with 18 carrying a phone, and a second consecutive run
reports the identical line. The cleanup script's dry run keeps all 30 and proposes deleting none of
them. `npx tsc --noEmit` and `npm run lint` are clean. The regression sweep passes, with any failure
either absent or documented as the pre-existing shared-dev-DB slot-count flake on a doctor that predates
this task.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| seed script -> dev Postgres | `scripts/seed.ts` holds the service-role key and writes with RLS bypassed; nothing in the script is user input, but every write lands unmediated. |
| seed catalog -> public web surface | Every authored name, bio and phone becomes publicly readable through `GET /api/doctors` and `/doctors/[id]` with no authentication. |
| seed catalog -> cleanup whitelist | `scripts/cleanup-test-residue.ts` treats any doctor absent from its whitelist as deletable residue; the two files must agree or legitimate rows are destroyed. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-sxi-01 | Information disclosure | authored names/phones in `DOCTORS`, published unauthenticated via `/doctors/[id]` | high | mitigate | Task 2's action forbids recognizable real names and any digit sequence sourced from a real clinic or directory; D-04 constrains every phone to a `555` exchange with an `01NN` suffix, a shape that cannot route to a real subscriber. Enforced at authoring time, restated in the SUMMARY. |
| T-sxi-02 | Tampering | `seedDoctors()` writing over the 12 pre-existing demo doctors | medium | mitigate | D-01 forbids any UPDATE or backfill; the task adds a field to the insert row object only, leaving `seedDoctors()`'s existing-name filter (which skips seen rows entirely) as the enforcing mechanism. Task 1's counter check proves the original 12 still report no phone. |
| T-sxi-03 | Denial of service | `scripts/cleanup-test-residue.ts` deleting the 18 new doctors as unrecognized residue | critical | mitigate | The whitelist edit ships in the same commit as each batch of new names, and Task 2's verify runs the cleanup script in dry-run mode to prove all 30 catalog names are kept before the task closes. `--apply` is never passed. |
| T-sxi-04 | Tampering | slot generator exceeding the 09:00-17:00 consultation window at a larger doctor count | low | accept | Already bounded by inspection: `firstSlotOffsetMinutes` is `(i % 6) * 30`, capping the latest slot end at 13:00 Israel time regardless of how many doctors are seeded; `seedAvailabilitySlots()` additionally throws rather than writing an out-of-window row. No code change needed. |
| T-sxi-05 | Elevation of privilege | service-role key exposure through the seed run | low | accept | Unchanged from the script's existing model — the key is read from `.env.local` at module load, never logged, and the script builds its own client rather than importing the `server-only` admin module. This task introduces no new key handling. |
| T-sxi-SC | Tampering | npm/pip/cargo installs | n/a | accept | This plan installs no package. `tsx`, `@supabase/supabase-js` and `@next/env` are already project dependencies with a prior legitimacy checkpoint on record (plan 02-06). No supply-chain gate applies. |
</threat_model>

<verification>

1. **Catalog size and phone coverage** — `npm run seed` reports
   `catalog_doctors=30 catalog_doctors_with_phone=18`.
2. **Idempotency (T-02-16)** — two consecutive `npm run seed` runs emit the identical summary line; the
   script issues no UPDATE and no DELETE against `doctors`.
3. **Distribution** — every one of the 12 specialties and every one of the 12 neighborhoods appears on
   at least 2 doctors, matching the data_spec tables.
4. **Residue safety** — `npx tsx scripts/cleanup-test-residue.ts` (dry run) reports keeping 30 seed
   doctors and lists none of them for deletion.
5. **Availability** — the new doctors hold future slots; `DOCTORS_WITHOUT_SLOTS` is still exactly its
   two original names.
6. **Static gates** — `npx tsc --noEmit` and `npm run lint` clean.
7. **Regression sweep** — `admin-pagination`, `admin-doctor-crud`, `doctor-phone` and
   `seed-availability` specs pass, with any failure attributable to the pre-existing shared-dev-DB
   flake and explicitly named as such.

</verification>

<success_criteria>

- `scripts/seed.ts`'s `DOCTORS` array holds 30 entries; each carries a `phone` and reuses only the
  existing 12 specialties and 12 neighborhoods.
- The 18 new doctors exist in the linked dev database with phones stored and future availability slots
  seeded.
- The original 12 doctors are byte-identical in the database to their pre-task state.
- `scripts/cleanup-test-residue.ts`'s whitelist holds all 30 catalog names.
- Two commits land, one per task, each independently type-checking and seeding cleanly.

</success_criteria>

<output>
Create `.planning/quick/260818-sxi-enrich-scripts-seed-ts-with-additional-f/260818-sxi-SUMMARY.md` when done.

The SUMMARY must explicitly record the D-01 consequence: on the current dev database the 12 original
seed doctors still carry `phone = NULL` while the 18 new ones carry a value, because `seedDoctors()`
never updates an existing row. Note that filling those 12 would require a separate, opt-in task.
</output>
