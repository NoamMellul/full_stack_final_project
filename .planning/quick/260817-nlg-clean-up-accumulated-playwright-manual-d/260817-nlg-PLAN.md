---
phase: quick-260817-nlg
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/cleanup-test-residue.ts
autonomous: false
requirements: [QUICK-260817-nlg]

estimate:
  tokens: 0
  raw_tokens: 0
  tasks: 1
  confidence: high

must_haves:
  truths:
    - "Every row deleted is excluded by an explicit whitelist derived verbatim from scripts/seed.ts's known demo catalog (12 doctor names, 12 specialty names, 12 neighborhood names, 4 patient emails) plus two explicitly preserved real accounts (admin@medrdv.demo, mellulnoam@gmail.com) — nothing is deleted by pattern-matching alone."
    - "A dry run (default mode, no --apply) prints exact per-table counts and lists any profile the rule set cannot explain, before any row is touched."
    - "Deletion order respects the schema's on-delete-restrict FKs (appointments before doctors/profiles; specialties/locations after doctors) so the script cannot fail partway on a constraint violation."
    - "After execution, the live database contains exactly the 12 seed doctors/specialties/locations and 6 real profiles (4 seed patients + the 2 preserved accounts) — verified by an independent read-only re-audit, not just the script's own exit code."
  artifacts:
    - scripts/cleanup-test-residue.ts
  key_links:
    - "doctors.is_demo defaults to true at the schema level (supabase/migrations/20260803230000_initial_schema.sql:52) for every insert, seed or test-fixture alike — it cannot be used to distinguish legitimate demo doctors from test residue. The whitelist-by-name approach below was chosen specifically because this flag is not a reliable signal."
    - "tests/e2e/helpers/reference-data.ts's createTestSpecialty()/createTestLocation() default to 'Test Specialty {uuid8}'/'Test Neighborhood {uuid8}' naming, and tests/e2e/helpers/test-users.ts's uniqueTestEmail() always produces '{prefix}-{timestamp}-{hex8}@example.com' — but several specs (admin-reference-data.spec.ts's UI-driven specialty creation, admin-doctor-link-account.spec.ts's second-attempt/linked-doctor prefixes, and ad-hoc manual admin-UI debugging sessions producing 'Debug Doctor'/'Debug Spec'/'Debug {hex}' rows) don't follow those exact naming conventions, which is why the final rule is a whitelist of known-real names/domains rather than a residue pattern-match."
    - "FK cascade/restrict map (same migration): profiles.id -> auth.users.id ON DELETE CASCADE; doctors.profile_id -> profiles.id ON DELETE SET NULL; doctors.specialty_id/location_id -> specialties/locations ON DELETE RESTRICT; appointments.slot_id/patient_id/doctor_id all ON DELETE RESTRICT; availability_slots/doctor_languages -> doctors ON DELETE CASCADE; favorites/notifications -> profiles ON DELETE CASCADE."
---

# Quick Task 260817-nlg: Clean up accumulated test residue

**Context:** the visual/code review (this same session) found the shared dev Supabase database had accumulated hundreds of orphaned rows from Playwright test runs that crashed, timed out, or were killed before their `afterAll` cleanup hook ran, plus a handful of manual admin-UI debugging artifacts ("Debug Doctor", "UI Created Specialty {timestamp}"). This was visibly polluting both `/admin/doctors` (380+ rows, unpaginated before quick task 260817-lar) and real patient-facing `/search` results (garbled test doctor names appearing in live search).

**Task 1 — investigate, build, and run a whitelist-based cleanup script:**
1. Read `scripts/seed.ts` to extract the exact legitimate demo catalog (doctor names, specialty names, neighborhood names, seed patient emails) — this becomes the whitelist, not a guessed pattern.
2. Read the schema migration for the FK cascade/restrict graph to determine safe deletion order.
3. Write `scripts/cleanup-test-residue.ts`: dry-run by default, `--apply` to execute; reports exact counts and any row it cannot explain via the whitelist before touching anything.
4. Run in dry-run mode, manually review every unexplained row before proceeding — this step surfaced `admin@medrdv.demo` (real demo admin account) and `mellulnoam@gmail.com` (the project owner's real account), both added to an explicit preserved-accounts list.
5. Get explicit user confirmation of the exact counts (this is an irreversible operation on shared data).
6. Run with `--apply`.
7. Independently re-verify via a fresh read-only audit query — confirm exactly the 12/12/12/6 expected surviving rows, zero unexplained residue.
8. Smoke-test the app (targeted Playwright run against seed-dependent specs) to confirm nothing broke.

This was executed directly by the orchestrating session rather than dispatched to a planner/executor agent pair, given the irreversible, cross-table nature of the operation warranted the orchestrator's own careful step-by-step verification at each stage rather than a single autonomous pass.
