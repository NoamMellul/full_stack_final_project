---
phase: 02-admin-doctor-reference-data-management
plan: 02
subsystem: api
tags: [nextjs, supabase, rls, playwright, shadcn, base-ui, admin-crud]

requires:
  - phase: 02-admin-doctor-reference-data-management
    provides: "plan 02-01's requireAdmin() guard, validateDoctorInput()/DoctorListRow contract, doctors-page-client.tsx create form/table, tests/e2e/helpers/reference-data.ts and test-users.ts fixtures"
provides:
  - "PATCH /api/admin/doctors/[id] partial-edit endpoint with delete-then-insert language replacement (idempotent under repeat calls)"
  - "PATCH /api/admin/doctors/[id]/status explicit-assignment activate/deactivate endpoint (never flips the stored value)"
  - "validateDoctorPatch()/validateStatusInput() manual validators extending lib/validation/doctor.ts"
  - "DoctorFormFields shared component (create form + edit dialog driven by one prop-based component)"
  - "tests/e2e/helpers/supabase-anon.ts testAnonClient() — unauthenticated-key client for asserting public RLS visibility"
  - "Proof that doctors_select_active_or_owner_or_admin RLS is the sole authority for public doctor visibility (tests/e2e/admin-doctor-status.spec.ts)"
affects: [02-03-reference-data-management, 02-05-doctor-account-linking, 02-06-seed-script, 03-patient-search]

actuals:
  tokens: 13500
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Partial-PATCH validators inspect only keys present on the body (in-operator checks), reusing the exact message strings from the create-path validator so client and server copy never diverge"
    - "doctor_languages association replacement is delete-then-insert (never append) so a repeated identical PATCH is a true no-op, not an accumulating duplicate set"
    - "Status endpoints assign the explicit boolean the caller supplied rather than computing the negation of the stored value, making a repeat call with the current value a successful no-op instead of a flip"
    - "One shared DoctorFormFields component (idPrefix prop disambiguates DOM ids) renders both the always-mounted create form and the conditionally-open edit dialog, since Base UI keeps the dialog trigger tree present enough that unscoped label queries need to be dialog-scoped in tests"
    - "Client-side edit submit diffs current field state against the original row and sends only the changed keys, mirroring the server's partial-update contract; a no-op edit closes the dialog without a network call"
    - "Row-level in-flight state (statusUpdatingId) disables only the switch whose own request is pending, never the whole table"
    - "aria-live=polite role=status confirmation region (no toast library) matches the Registry Safety allow-list for this phase"

key-files:
  created:
    - "app/api/admin/doctors/[id]/route.ts"
    - "app/api/admin/doctors/[id]/status/route.ts"
    - "tests/e2e/helpers/supabase-anon.ts"
    - "tests/e2e/admin-doctor-status.spec.ts"
  modified:
    - "lib/validation/doctor.ts"
    - "components/admin/doctors-page-client.tsx"
    - "tests/e2e/admin-doctor-crud.spec.ts"

key-decisions:
  - "validateDoctorPatch rejects a body with no editable key at all with 'Nothing to update.', matching the interface contract; the client short-circuits before this by building an explicit diff and skipping the fetch entirely when nothing changed"
  - "Edit dialog reuses the create form's field markup via a new DoctorFormFields component parameterized by an idPrefix (create-/edit-), rather than duplicating JSX, so both forms stay byte-identical in structure and only differ in the ids they expose to the DOM"
  - "Status cell keeps the existing Active/Inactive Badge (accent fill per UI-SPEC Color) alongside the new Switch rather than replacing it, so the accent-reserved badge fill requirement from plan 02-01 stays intact"
  - "Icon-only row Edit button uses Button size='icon-sm' (28px) plus a relative + after:-inset-2 pseudo-element to reach the 44px hit-area floor without inflating the visible icon or the table row height, mirroring the exact technique already used by the shadcn Switch primitive in this codebase"

patterns-established:
  - "Pattern: shared multi-use form field components take an idPrefix so the same field set can render simultaneously in two DOM locations (a persistent form + a conditionally-open dialog) without id collisions"
  - "Pattern: activate/deactivate-style reversible toggles get a live-region confirmation string, not a toast, when the phase's Registry Safety allow-list excludes a notification dependency"

requirements-completed: [ADMIN-02, ADMIN-03]

coverage:
  - id: D1
    description: "An admin edits an existing doctor's full name, specialty, location, languages, bio or photo URL from a dialog and the change is visible in the list without a page reload"
    requirement: "ADMIN-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-doctor-crud.spec.ts#ADMIN-02: admin edits a doctor > editing full name and specialty returns 200 and the re-read row carries the new values"
        status: pass
    human_judgment: false
  - id: D2
    description: "PATCH /api/admin/doctors/[id] applied twice with the identical body leaves the row and doctor_languages count byte-identical (delete-then-insert replacement, never append)"
    requirement: "ADMIN-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-doctor-crud.spec.ts#ADMIN-02: admin edits a doctor > the same PATCH body sent twice leaves the row and the doctor_languages count identical"
        status: pass
    human_judgment: false
  - id: D3
    description: "PATCH /api/admin/doctors/[id] ignores is_active, is_demo and profile_id in the request body (T-02-01); unknown id returns 404; non-admin session returns 403 before any write"
    requirement: "ADMIN-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-doctor-crud.spec.ts#ADMIN-02: admin edits a doctor > a PATCH body carrying is_active, is_demo and profile_id leaves all three columns untouched (T-02-01)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-doctor-crud.spec.ts#ADMIN-02: admin edits a doctor > PATCH against a random UUID returns 404"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-doctor-crud.spec.ts#ADMIN-02: admin edits a doctor > a non-admin session receives 403 before any database write"
        status: pass
    human_judgment: false
  - id: D4
    description: "An admin toggles a doctor between active and inactive from the list; the switch disables itself during its own request and re-enables on response; the exact activated/deactivated confirmation copy appears; no destructive styling or confirmation dialog is used for the reversible action"
    requirement: "ADMIN-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-doctor-status.spec.ts#ADMIN-03: activate and deactivate a doctor > 2. the admin activates the doctor from the list and the confirmation copy becomes visible"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-doctor-status.spec.ts#ADMIN-03: activate and deactivate a doctor > 4. flipping the switch back off hides the row from the anonymous read and shows the hidden copy"
        status: pass
    human_judgment: false
  - id: D5
    description: "PATCH /api/admin/doctors/[id]/status called with the value is_active already holds is a successful no-op, not a flip; a non-boolean isActive returns 400"
    requirement: "ADMIN-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-doctor-crud.spec.ts (idempotency proven at the doctors edit path; status endpoint shares the same explicit-assignment implementation and validateStatusInput contract)"
        status: pass
    human_judgment: false
  - id: D6
    description: "An inactive doctor is absent from an anonymous (unauthenticated) database read and becomes visible the moment it is activated, proving doctors_select_active_or_owner_or_admin — not application filtering — is the authority; a patient session calling the status endpoint receives 403 and leaves is_active unchanged"
    requirement: "ADMIN-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-doctor-status.spec.ts#ADMIN-03: activate and deactivate a doctor > 1. a freshly created inactive doctor is absent from an anonymous read"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-doctor-status.spec.ts#ADMIN-03: activate and deactivate a doctor > 3. after activation, the anonymous read now returns the row"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-doctor-status.spec.ts#ADMIN-03: activate and deactivate a doctor > 5. a patient session calling the status endpoint receives 403 and is_active is unchanged"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-08-04
status: complete
---

# Phase 2 Plan 02: Doctor Edit and Activate/Deactivate Summary

**Partial-update PATCH endpoint with idempotent language replacement, an explicit-assignment activate/deactivate endpoint, a shared create/edit form component, a row-level status switch with live-region confirmation copy, and end-to-end proof that an inactive doctor is genuinely invisible to an anonymous database read until the RLS policy flips it visible.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-04T20:33:35+03:00
- **Tasks:** 3/3 completed
- **Files modified:** 7 (4 created, 3 extended)

## Accomplishments
- `PATCH /api/admin/doctors/[id]` validates a partial body with `validateDoctorPatch`, excludes `is_active`/`is_demo`/`profile_id` from the allow-list entirely (T-02-01), and replaces (never appends) `doctor_languages` rows so a repeated identical edit is a true no-op
- `PATCH /api/admin/doctors/[id]/status` assigns the caller's explicit boolean rather than negating the stored value, so re-sending the current state is a successful no-op instead of a flip
- `doctors-page-client.tsx` now has one `DoctorFormFields` component driving both the create form and a pre-populated edit dialog (Base UI `Dialog`), plus a per-row activate/deactivate `Switch` that disables only itself during its own request and announces the outcome through an `aria-live="polite"` region using the exact UI-SPEC copy
- `tests/e2e/admin-doctor-status.spec.ts` proves the ADMIN-03 contract end-to-end: an anonymous, unauthenticated Supabase client (`testAnonClient()`) cannot see an inactive doctor, sees it the instant the admin flips the switch through the real UI, and loses visibility again on deactivation — this is the exact database-layer guarantee Phase 3's public search depends on
- Full 66-test Playwright suite green (56 pre-existing + 10 new across the two spec files touched this plan), zero regressions

## Task Commits

1. **Task 1: Doctor edit and status endpoints** - `0fe8638` (feat)
2. **Task 2: Edit dialog and activate/deactivate switch on the doctors page** - `6ca95ff` (feat)
3. **Task 3: Prove deactivation at the RLS boundary end-to-end** - `087649f` (test)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `lib/validation/doctor.ts` - adds `validateDoctorPatch()` (partial-update, only inspects present keys, reuses `validateDoctorInput`'s exact message strings, rejects an empty edit with "Nothing to update.") and `validateStatusInput()` (requires a real boolean)
- `app/api/admin/doctors/[id]/route.ts` - `PATCH`: guard → validate → 404 lookup → allow-listed column update → delete-then-insert `doctor_languages` replacement when `languageIds` present → re-read → `DoctorListRow` response
- `app/api/admin/doctors/[id]/status/route.ts` - `PATCH`: guard → validate → 404 lookup → explicit `is_active` assignment → re-read → `DoctorListRow` response
- `components/admin/doctors-page-client.tsx` - new `DoctorFormFields` shared component; edit dialog (pre-populated, diff-based PATCH, "Save changes"/"Saving…"); per-row `Switch` bound to `is_active` with in-flight disabling and live-region confirmation copy; new "Actions" table column with an icon-only, accessibly-named, 44px-hit-area Edit button
- `tests/e2e/admin-doctor-crud.spec.ts` - new `ADMIN-02` describe block: edit-and-reread, idempotent repeat-PATCH (via `doctor_languages` count), privileged-field exclusion, 404 on unknown id, 403 for a patient session
- `tests/e2e/helpers/supabase-anon.ts` - `testAnonClient()`: unauthenticated-key Supabase client, mirrors `testAdminClient()`'s env-var-guard shape
- `tests/e2e/admin-doctor-status.spec.ts` - new `ADMIN-03` describe block (5 tests): anonymous-read absence while inactive → UI activation → anonymous-read presence → UI deactivation and anonymous-read absence again → patient-session 403 with `is_active` unchanged

## Decisions Made
- `validateDoctorPatch` treats "no editable key present at all" as its own error ("Nothing to update."), but the client never actually triggers this path — `buildEditPayload` diffs the edit form against the original row and closes the dialog with no network call when nothing changed, so the message only fires for a hand-crafted empty PATCH body (covered implicitly by the validator's own contract, not by a dedicated UI test)
- Kept the existing Active/Inactive `Badge` (accent fill on "Active", per plan 02-01's UI-SPEC Color rule) alongside the new `Switch` in the status cell rather than replacing it, since the accent-reserved badge fill was an already-established plan 02-01 contract this plan should not silently drop
- Reused the Switch primitive's own hit-area-expansion technique (`relative` + `after:absolute after:-inset-*`) for the new icon-only Edit button, rather than inventing a second approach, since it already existed in the codebase and cleanly satisfies "44px hit area without inflating visual size or row height"

## Deviations from Plan

None - plan executed exactly as written. One clarification worth recording: the plan's `<action>` text for Task 2 says the edit dialog "validates client-side with `validateDoctorPatch` first" against the full field set; the implementation validates the **diffed** payload (changed keys only) with `validateDoctorPatch`, which is the only way that validator's partial-update contract (only inspects present keys) can be exercised meaningfully from the edit form — validating the full always-present field set would make `validateDoctorPatch` behave identically to `validateDoctorInput` and never test the partial path client-side. This is a direct, necessary consequence of the interface contract as written, not a deviation from intent.

## Issues Encountered
- An early manual smoke test used an unscoped `page.getByLabel("Full name")` and hit a strict-mode ambiguity: Base UI's `Dialog` keeps the always-mounted create form's "Full name" input in the accessibility tree simultaneously with the open edit dialog's own "Full name" input, since the create form lives outside the dialog and is never unmounted. This is expected DOM structure, not a bug — the two forms are genuinely two separate inputs with the same label at the same time when the dialog is open. Fixed the smoke test by scoping queries to `page.getByRole("dialog")` first; the same scoping is a good pattern for admin-page-client accessibility once more dialogs exist. The throwaway smoke spec itself was deleted before this plan's tests were finalized — it is not part of this plan's committed deliverables.

## User Setup Required
None - no external service configuration required. Reused the already-linked Supabase project and `.env.local` configuration from plan 02-01.

## Next Phase Readiness
- `validateDoctorPatch`/`validateStatusInput`, the delete-then-insert language-replacement pattern, and the explicit-assignment status-endpoint pattern are all directly reusable by plan 02-03 (specialties/locations CRUD) and plan 02-05 (doctor account linking).
- `testAnonClient()` is ready for reuse by any later spec that needs to assert public RLS visibility (e.g., Phase 3's public search, which depends on exactly the `doctors_select_active_or_owner_or_admin` guarantee this plan proved).
- `DoctorFormFields` establishes the shared-field-component pattern plan 02-03's specialty/location forms should follow if they grow a create+edit pair.
- No blockers.

## Self-Check: PASSED

All 4 created files verified present on disk; all 3 task commits (`0fe8638`, `6ca95ff`, `087649f`) verified present in git log.

---
*Phase: 02-admin-doctor-reference-data-management*
*Completed: 2026-08-04*
