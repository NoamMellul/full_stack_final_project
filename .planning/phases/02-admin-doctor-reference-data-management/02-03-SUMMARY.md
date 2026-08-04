---
phase: 02-admin-doctor-reference-data-management
plan: 03
subsystem: api
tags: [nextjs, supabase, postgres, rls, playwright, shadcn, base-ui, admin-crud]

requires:
  - phase: 02-admin-doctor-reference-data-management
    provides: "requireAdmin() guard, lib/supabase/server.ts session-bound client pattern, doctors-page-client.tsx fetch/dialog/table shape, tests/e2e/helpers/reference-data.ts and test-users.ts fixtures (from 02-01/02-02)"
provides:
  - "Unique-key migration: unique (name_en) on public.specialties, unique (neighborhood, city) on public.locations — the natural-key shape the demo-data seed script (02-06) needs for idempotent ON CONFLICT seeding"
  - "lib/validation/reference-data.ts: validateSpecialtyInput/Patch, validateLocationInput/Patch"
  - "GET/POST /api/admin/specialties and /api/admin/locations, PATCH/DELETE /api/admin/specialties/[id] and /api/admin/locations/[id] — guarded REST endpoints with a server-side delete guard independent of the disabled button"
  - "components/admin/reference-data-page-client.tsx: one shared client component parameterised by resource (specialties/locations), reusable shape for any future single-table admin CRUD list"
  - "tests/e2e/admin-reference-data.spec.ts: ADMIN-05/ADMIN-06 API + browser coverage including the direct-DELETE dev-tools bypass proof"
affects: [02-06-seed-script, 03-patient-search]

actuals:
  tokens: 13313
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Single generic client component parameterised by a resource union ('specialties' | 'locations') with a per-resource config table for copy/fields/columns, sharing all fetch/dialog/table/delete-guard logic"
    - "Server-side delete guard implemented as an explicit doctor-count pre-check (409 before attempting delete) plus a Postgres error-code (23503) fallback translation if a doctor is created in the race window between the check and the delete — never forwards raw Postgres text to the client"
    - "Duplicate-name rejection detected by Postgres error code 23505 (unique_violation), translated to a fixed friendly string per resource, never the raw constraint/table name (T-02-06)"
    - "Client-side field-level errors computed independently of the single-string validator message (which intentionally collapses to 'Name is required.' for every required field), by checking per-field blankness directly in the UI layer"

key-files:
  created:
    - supabase/migrations/20260804120100_add_reference_data_unique_constraints.sql
    - lib/validation/reference-data.ts
    - app/api/admin/specialties/route.ts
    - app/api/admin/specialties/[id]/route.ts
    - app/api/admin/locations/route.ts
    - app/api/admin/locations/[id]/route.ts
    - app/admin/specialties/page.tsx
    - app/admin/locations/page.tsx
    - components/admin/reference-data-page-client.tsx
    - tests/e2e/admin-reference-data.spec.ts
  modified: []

key-decisions:
  - "Checkpoint resolved as option-a: unique (neighborhood, city) on public.locations, plus unique (name_en) on public.specialties — the RESEARCH.md recommendation, locked before Task 1 per the continuation context. Migration applied cleanly against the remote project with zero pre-existing violating rows."
  - "The create and edit forms for both resources go through a shadcn/Base UI Dialog (not an always-mounted inline form like doctors) — the toolbar 'Add {resource}' button opens the create dialog, whose own submit button reuses the same resting label; the edit dialog's submit button reads 'Save {resource}', matching the UI-SPEC's documented CTA pairs verbatim"
  - "doctorCount for both GET endpoints is computed with exactly one extra round trip (a select of every doctor's specialty_id/location_id, folded into a Map in the handler), never one count query per row"
  - "PATCH partial-update validators (validateSpecialtyPatch/validateLocationPatch) mirror validateDoctorPatch's contract exactly: only keys present on the body are checked, reusing the identical 'Name is required.' message so create and edit paths never disagree on copy"

patterns-established:
  - "Resource-parameterised admin CRUD list component: a single components/admin/*-page-client.tsx driven by a per-resource config table (endpoint, copy, field/column descriptors) is the template for any future single-table reference-data admin page"

requirements-completed: [ADMIN-05, ADMIN-06]

coverage:
  - id: D1
    description: "Admin adds, renames and deletes a specialty from /admin/specialties, and the change is visible in the list without a page reload (ADMIN-05)"
    requirement: "ADMIN-05"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-reference-data.spec.ts#admin adds a specialty on /admin/specialties and sees it in the table without a reload"
        status: pass
    human_judgment: false
  - id: D2
    description: "Admin adds, edits and deletes a neighborhood/location from /admin/locations, and the change is visible in the list without a page reload (ADMIN-06)"
    requirement: "ADMIN-06"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-reference-data.spec.ts#deleting an unreferenced location on /admin/locations goes through the confirm dialog and the row disappears"
        status: pass
    human_judgment: false
  - id: D3
    description: "A duplicate specialty or location name is rejected with the friendly 409 message, never a raw Postgres constraint/table identifier, and creates no second row"
    requirement: "ADMIN-05"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-reference-data.spec.ts#POST with a name identical to an existing specialty returns 409 with no leaked db detail"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-reference-data.spec.ts#POST with a name identical to an existing location returns 409 with no leaked db detail"
        status: pass
    human_judgment: false
  - id: D4
    description: "A blank required name on either resource returns 400 'Name is required.' and inserts nothing"
    requirement: "ADMIN-05"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-reference-data.spec.ts#POST with a blank required name returns 400 and the list length is unchanged (specialties)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-reference-data.spec.ts#POST with a blank required name returns 400 and the list length is unchanged (locations)"
        status: pass
    human_judgment: false
  - id: D5
    description: "GET for both resources returns rows in the documented deterministic ascending order"
    requirement: "ADMIN-05"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-reference-data.spec.ts#GET returns specialties ordered by name_en then id ascending"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-reference-data.spec.ts#GET returns locations ordered by city, then neighborhood, then id ascending"
        status: pass
    human_judgment: false
  - id: D6
    description: "The delete control for a row referenced by a doctor is rendered but disabled with the D-05 inline explanation, pluralized correctly at N=1"
    requirement: "ADMIN-05"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-reference-data.spec.ts#a specialty referenced by a doctor renders a disabled Delete button with the 'used by 1 doctor' sentence"
        status: pass
    human_judgment: false
  - id: D7
    description: "DELETE independently re-checks referencing doctors server-side and returns 409 even called directly with no browser involved (D-06, T-02-05)"
    requirement: "ADMIN-05"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-reference-data.spec.ts#a direct DELETE against a specialty referenced by a doctor returns 409 and the row survives (T-02-05, D-06)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-reference-data.spec.ts#a direct DELETE against a location referenced by a doctor returns 409 and the row survives (T-02-05, D-06)"
        status: pass
    human_judgment: false
  - id: D8
    description: "A non-admin session receives 403 from every specialties/locations write endpoint before any database write (T-02-02)"
    requirement: "ADMIN-05"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-reference-data.spec.ts#a non-admin session receives 403 on every write endpoint and the data is unchanged (specialties)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-reference-data.spec.ts#a non-admin session receives 403 on every write endpoint and the data is unchanged (locations)"
        status: pass
    human_judgment: false
  - id: D9
    description: "Loading skeleton, empty state, error+Retry, and count caption visual correctness for both tables"
    verification: []
    human_judgment: true
    rationale: "The spec proves the state-selection logic and copy strings fire correctly, but pixel-level spacing/alignment of the skeleton/error layout and the 'partial-form'/'overflow-truncation' backstop truths were not screenshot-verified in this run — left for the phase's end-of-phase UAT pass, consistent with 02-01's D7 precedent."

duration: ~55min
completed: 2026-08-04
status: complete
---

# Phase 2 Plan 03: Specialties and Locations Reference-Data Management Summary

**Guarded REST CRUD for specialties and locations (unique-key migration + delete-guard endpoints + one shared resource-parameterised admin UI component), proven by 15 green Playwright tests including a direct-DELETE dev-tools bypass of the disabled button.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-08-04T21:10:00+03:00
- **Tasks:** 3/3 completed
- **Files modified:** 10 (all created)

## Accomplishments
- Locked and shipped the reference-data uniqueness migration (`unique (name_en)` on specialties, `unique (neighborhood, city)` on locations) to the remote Supabase project, clearing the way for the 02-06 seed script's idempotent `ON CONFLICT` seeding
- Symmetric, guarded REST endpoints for both resources with a server-side delete guard that is independently proven against a direct `page.request.delete` call bypassing the UI entirely (T-02-05, D-06)
- One shared `components/admin/reference-data-page-client.tsx` drives both `/admin/specialties` and `/admin/locations` — Dialog-based create/edit forms, the D-05 disabled-delete-with-explanation pattern, and a destructive confirm dialog — rather than two near-identical copies
- 15 new Playwright tests (12 API-level + 3 browser-level) all green; full 81-test project suite has zero regressions

## Task Commits

1. **Task 1: Uniqueness migration, validators, and specialty endpoints** - `5ee0ecb` (feat)
2. **Task 2: Location endpoints and the API-level reference-data spec** - `59f929e` (test)
3. **Task 3: Specialties and locations admin pages with the disabled-delete guard UX** - `9c600a5` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `supabase/migrations/20260804120100_add_reference_data_unique_constraints.sql` - `unique (name_en)` on `specialties`, `unique (neighborhood, city)` on `locations`; applied to the remote project with no pre-existing violations
- `lib/validation/reference-data.ts` - `validateSpecialtyInput/Patch`, `validateLocationInput/Patch`, mirroring `lib/validation/doctor.ts`'s single-message, no-schema-library style
- `app/api/admin/specialties/route.ts` - `GET` (ordered by name_en/id, doctorCount folded from one extra query) and `POST` (validate → insert → 409 on 23505 unique violation with friendly copy)
- `app/api/admin/specialties/[id]/route.ts` - `PATCH` (partial update, 404/409) and `DELETE` (doctor-count pre-check → 409 with `doctorCount`, or delete → 200; 23503 FK-violation fallback translated identically)
- `app/api/admin/locations/route.ts` - structural counterpart of the specialties route, ordered by city/neighborhood/id
- `app/api/admin/locations/[id]/route.ts` - structural counterpart of the specialties `[id]` route, guarded on `location_id`
- `app/admin/specialties/page.tsx`, `app/admin/locations/page.tsx` - server shells rendering the shared client component per resource
- `components/admin/reference-data-page-client.tsx` - one `"use client"` component parameterised by `resource`, covering fetch/skeleton/empty/error/count, Dialog create+edit forms, and the delete guard
- `tests/e2e/admin-reference-data.spec.ts` - `ADMIN-05`/`ADMIN-06` describe blocks (12 API tests) plus a third describe block with 3 browser-level tests (15 total)

## Decisions Made
- Checkpoint resolved as option-a per the continuation context: `unique (neighborhood, city)` on `locations` plus `unique (name_en)` on `specialties`. Migration pushed cleanly — the remote project held no rows violating either tuple.
- Create/edit for both resources use a Dialog (unlike doctors' always-mounted inline create form), with the toolbar "Add {resource}" button opening the create dialog and its own submit button reusing that label, while the edit dialog's submit reads "Save {resource}" — this matches the UI-SPEC's documented CTA pairs ("Add specialty" · "Save specialty" / "Add location" · "Save location") exactly.
- Since the shared validators intentionally return the single string "Name is required." for any blank required field (matching the project's no-schema-library convention), per-field inline errors in the UI are computed by a separate client-side blankness check rather than parsed from the validator's message — this is what makes "only the offending field(s) show inline errors" possible without a per-field error object leaking into the validator contract.
- `doctorCount` for both list endpoints costs exactly one extra round trip (select every doctor's `specialty_id`/`location_id`, fold into a `Map` in the handler) — never a per-row count query.

## Deviations from Plan

None - plan executed exactly as written. The only environmental note carried over from the continuation context: this run resumed directly from Task 1 with the locations uniqueness tuple already locked (option-a) by the orchestrator's auto-selected decision; no code-level deviation resulted from that resolution.

## Issues Encountered
- `npx supabase db push` printed several unrelated Docker Desktop connection errors while attempting to cache an edge-runtime image for migration diffing; the actual migration push itself succeeded (`"upToDate":false, ... "message":"Finished supabase db push."`). A subsequent `npx supabase migration list` call intermittently timed out on the direct-DB connection once before succeeding on retry, consistent with the network characteristic already noted in STATE.md for this project — no code change needed.

## User Setup Required
None - no external service configuration required. The Supabase CLI link and `SUPABASE_ACCESS_TOKEN` sourcing were already established by prior plans in this phase.

## Next Phase Readiness
- The `specialties`/`locations` natural-key uniqueness constraints are now in place for 02-06's demo-data seed script to use `ON CONFLICT DO NOTHING`.
- `components/admin/reference-data-page-client.tsx`'s resource-parameterised pattern is reusable for any future single-table admin CRUD list.
- No blockers.

## Self-Check: PASSED

All 10 created files verified present on disk; all three task commits (`5ee0ecb`, `59f929e`, `9c600a5`) verified present in git log.

---
*Phase: 02-admin-doctor-reference-data-management*
*Completed: 2026-08-04*
