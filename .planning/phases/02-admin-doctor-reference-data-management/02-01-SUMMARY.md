---
phase: 02-admin-doctor-reference-data-management
plan: 01
subsystem: api
tags: [nextjs, supabase, rls, playwright, shadcn, base-ui, admin-crud]

requires:
  - phase: 01-foundation-database-schema-authentication
    provides: doctors/specialties/locations/languages schema, RLS policies (doctors_admin_write, is_admin()), createClient()/createAdminClient() Supabase clients, requireAdmin-style role-guard layout pattern, test-users.ts fixtures
provides:
  - "requireAdmin() shared route-handler admin guard (401/403 defence-in-depth over RLS)"
  - "validateDoctorInput() manual validator, message-string contract other admin forms will mirror"
  - "GET/POST /api/admin/doctors with the DoctorListRow response shape every later Phase 2 plan reuses"
  - "/admin/doctors page + doctors-page-client.tsx: create form, table, loading/empty/error states, count caption"
  - "InitialsAvatar fallback component (D-02) reusable by public profile/search cards in later phases"
  - "shadcn primitives: table, select, textarea, dialog, switch, badge, skeleton"
  - "tests/e2e/helpers/reference-data.ts fixture pattern (createTestSpecialty/createTestLocation/createTestDoctor/cleanupTestReferenceData)"
affects: [02-02-doctor-status-and-edit, 02-03-reference-data-management, 02-05-doctor-account-linking, 02-06-seed-script, 03-patient-search]

actuals:
  tokens: 14956
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Session-bound createClient() (never createAdminClient()) for every admin/** route RLS already authorizes — service-role reserved for the one route that structurally needs it"
    - "Manual validateDoctorInput() returning string | null, reused client-side and server-side for identical copy"
    - "Privileged fields (is_active, is_demo, profile_id) hardcoded from column defaults server-side, never read from request body"
    - "listStatus state machine (loading/error/ready) where only the initial GET shows skeleton rows; later refreshes update in place"

key-files:
  created:
    - supabase/migrations/20260804120000_seed_language_rows.sql
    - lib/auth/require-admin.ts
    - lib/validation/doctor.ts
    - app/api/admin/doctors/route.ts
    - app/admin/doctors/page.tsx
    - components/admin/doctors-page-client.tsx
    - components/initials-avatar.tsx
    - components/ui/table.tsx
    - components/ui/select.tsx
    - components/ui/textarea.tsx
    - components/ui/dialog.tsx
    - components/ui/switch.tsx
    - components/ui/badge.tsx
    - components/ui/skeleton.tsx
    - tests/e2e/helpers/reference-data.ts
    - tests/e2e/admin-doctor-crud.spec.ts
  modified: []

key-decisions:
  - "Doctors GET response flattens the nested doctor_languages(languages(id,code)) select into languages: {id,code}[] server-side, matching the interface contract exactly"
  - "Client-side field-error mapping keys off the exact validateDoctorInput message string (FIELD_BY_MESSAGE lookup) since the validator returns a single string, not a per-field object"
  - "listStatus (loading/error/ready) only flips to loading on the very first mount fetch — post-submit refresh and Retry reuse loadDoctors() without re-showing skeleton rows, matching the UI-SPEC's 'initial GET' wording precisely"

patterns-established:
  - "Pattern: browser Supabase client (lib/supabase/client.ts) reads public *_select_all reference tables (specialties/locations/languages) directly for form option lists; only the doctors resource itself goes through the REST route"
  - "Pattern: tests/e2e/helpers/reference-data.ts extends the id-tracking + swallow-individual-failures cleanup shape from test-users.ts for non-auth reference rows"

requirements-completed: [ADMIN-01]

coverage:
  - id: D1
    description: "Admin fills the doctor create form (name, specialty, location, languages, bio, photo URL) on /admin/doctors and the new doctor appears in the list without a page reload"
    requirement: "ADMIN-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-doctor-crud.spec.ts#admin fills the create form and the new doctor appears in the list without a reload"
        status: pass
    human_judgment: false
  - id: D2
    description: "POST /api/admin/doctors strips is_active/is_demo/profile_id from the request body regardless of client input (T-02-01)"
    requirement: "ADMIN-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-doctor-crud.spec.ts#privileged fields in the request body are ignored server-side (T-02-01)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Blank-field validation returns 400 server-side and inline errors client-side without a network call; no doctor row is created"
    requirement: "ADMIN-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-doctor-crud.spec.ts#submitting an empty form surfaces the required-field error without a network call"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-doctor-crud.spec.ts#a blank fullName is rejected with 400 and no doctor row is created"
        status: pass
    human_judgment: false
  - id: D4
    description: "requireAdmin() returns 401 for unauthenticated and 403 for non-admin sessions before any query"
    requirement: "ADMIN-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-doctor-crud.spec.ts#a non-admin session receives 403 before any database write"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-doctor-crud.spec.ts#an unauthenticated request receives 401 before any database write"
        status: pass
    human_judgment: false
  - id: D5
    description: "Duplicate name/specialty/location combinations create two distinct doctor rows (no dedupe)"
    requirement: "ADMIN-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-doctor-crud.spec.ts#creating two doctors with identical name/specialty/location yields two distinct rows"
        status: pass
    human_judgment: false
  - id: D6
    description: "Doctors list renders documented empty state, a neutral 'Not linked' badge for null profile_id, an initials-avatar fallback when photo_url is empty, and a correct singular/plural count caption"
    requirement: "ADMIN-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-doctor-crud.spec.ts#zero doctors renders the empty-state heading and body copy"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-doctor-crud.spec.ts#a doctor with no profile_id renders a neutral 'Not linked' badge"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-doctor-crud.spec.ts#a doctor with no photo URL renders the initials avatar instead of an image"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-doctor-crud.spec.ts#with exactly one doctor, the count caption reads '1 doctor'"
        status: pass
    human_judgment: false
  - id: D7
    description: "Loading skeleton (3 rows) and Retry-on-error UI states — visual correctness of the skeleton/error layout"
    verification: []
    human_judgment: true
    rationale: "The spec's route-stub coverage proves the state-selection logic fires correctly, but the skeleton/error layout's visual polish (spacing, alignment) was not screenshot-verified — left for the phase's end-of-phase UAT pass."

duration: ~50min
completed: 2026-08-04
status: complete
---

# Phase 2 Plan 01: Admin Creates a Doctor (End-to-End Tracer Slice) Summary

**Full admin doctor-create flow wired through every layer — REST route handler, requireAdmin() guard, manual validateDoctorInput(), RLS-governed insert, and a doctors list with initials-avatar/badge/skeleton/empty/error states — proven by 11 green Playwright tests.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-08-04T20:14:09+03:00
- **Tasks:** 2/2 completed
- **Files modified:** 16 (15 created in Task 1, 3 touched in Task 2 — 1 new, 2 extended)

## Accomplishments
- Proved the entire Phase 2 architecture end-to-end: browser form → REST route → manual validation → session-bound Supabase client → RLS-governed `doctors` insert → refreshed list, with zero references to the service-role client in the route
- `requireAdmin()` and `validateDoctorInput()` shipped as the shared contracts every later Phase 2 plan (specialties, locations, users, appointments, link-account) will build against
- Doctors list now covers every documented UI state: loading skeleton, empty, error+Retry, populated with initials-avatar/status-badge/not-linked-badge, and a correct singular/plural count caption
- 11 Playwright tests (7 CRUD/security + 4 list-state) all green; full 56-test suite has zero regressions

## Task Commits

1. **Task 1: End-to-end "admin creates a doctor"** - `e5d8bf2` (feat)
2. **Task 2: Doctors list states — initials avatar, badges, skeleton, empty, error, counts** - `7830ee3` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `supabase/migrations/20260804120000_seed_language_rows.sql` - seeds `he`/`en` rows into `public.languages` so `doctor_languages` has something to reference
- `lib/auth/require-admin.ts` - `requireAdmin()`: 401 unauthenticated / 403 non-admin / `{ ok: true, supabase, userId }` otherwise
- `lib/validation/doctor.ts` - `validateDoctorInput()`: full name/specialty/location required, optional photoUrl (http/https), optional bio (string), optional languageIds (string[])
- `app/api/admin/doctors/route.ts` - `GET` (ordered, nested-select list) and `POST` (validate → insert doctors → insert doctor_languages, rollback doctor row on language-insert failure → re-read → 201)
- `app/admin/doctors/page.tsx` - server shell rendering `<DoctorsPageClient />`
- `components/admin/doctors-page-client.tsx` - create form + table; fetches doctors via `/api/admin/doctors`, fetches specialties/locations/languages option lists directly via the browser Supabase client; listStatus state machine for loading/error/ready
- `components/initials-avatar.tsx` - decorative two-letter (or fallback glyph) avatar derived from `full_name`
- `components/ui/{table,select,textarea,dialog,switch,badge,skeleton}.tsx` - shadcn primitives installed via `npx shadcn add`
- `tests/e2e/helpers/reference-data.ts` - `createTestSpecialty`/`createTestLocation`/`createTestDoctor`/`cleanupTestReferenceData` fixtures
- `tests/e2e/admin-doctor-crud.spec.ts` - 11 tests across two `describe` blocks (CRUD/security, list states)

## Decisions Made
- Flattened the nested `doctor_languages(languages(id,code))` Supabase select into a plain `languages: {id, code}[]` array server-side in both `GET` and the post-insert re-read, so the client never has to unwrap the join shape
- Mapped `validateDoctorInput`'s single returned message string to a specific form field via a literal lookup table (`FIELD_BY_MESSAGE`), since the validator intentionally returns one message at a time (matching `lib/validation/auth.ts`'s style) rather than a per-field error object
- Scoped the loading-skeleton state to the very first mount fetch only — refreshing after a successful create or clicking Retry reuses the same `loadDoctors()` call but never resets `listStatus` back to `"loading"`, so the table doesn't flash empty on every refresh

## Deviations from Plan

None - plan executed exactly as written. The only non-code deviation was environmental: the prior execution attempt halted on an unmet precondition (Supabase CLI not linked in this session). The orchestrator resolved that before this run by linking the project and confirming `npx supabase migration list` reached the remote database; this run proceeded from Task 1 with no code-level changes to the plan's design.

## Issues Encountered
- `npx supabase db push` intermittently reported `Connection timed out` on the direct-DB-connection step (IPv6-only DNS resolution for `db.<ref>.supabase.co` combined with sandbox network latency) before succeeding on retry; confirmed via `npx supabase migration list` that the migration had, in fact, already applied. No code change needed — this is an environment/network characteristic, not a plan defect.
- ESLint's `react-hooks/set-state-in-effect` rule flagged calling a `useCallback`-wrapped `loadDoctors()` (which calls `setDoctors`) directly by reference inside a `useEffect`. Resolved by wrapping the call in a locally-scoped `async function initialLoad()` defined inside the effect body — mirrors the already-lint-clean pattern used for the options-loading effect in the same file. No behavior change, purely a call-shape adjustment to satisfy static analysis.
- Base UI's `Select` `onValueChange` signature is `(value: string | null, ...) => void`, not `Dispatch<SetStateAction<string>>` — `tsc` caught this immediately; fixed by wrapping each setter (`(value) => setSpecialtyId(value ?? "")`).

## User Setup Required
None - no external service configuration required. The Supabase CLI link (project-ref `hyxipqnrkpjkiojrxqtl`) and `SUPABASE_ACCESS_TOKEN` sourcing were already resolved by the orchestrator before this run.

## Next Phase Readiness
- `requireAdmin()`, `validateDoctorInput()`-style validators, the `DoctorListRow` response shape, and the `doctors-page-client.tsx` fetch/table/form pattern are all in place for 02-02 (status/edit), 02-03 (specialties/locations CRUD), and 02-05 (link-account) to extend directly per the plan's `<interface_contract>`.
- `tests/e2e/helpers/reference-data.ts` is ready for reuse by every later Phase 2 spec needing specialty/location/doctor fixtures.
- No blockers. The Supabase CLI's occasional direct-DB-connection timeout is worth noting for future plans in this phase that also run `npx supabase db push` — retry once if it times out before treating it as a real failure.

## Self-Check: PASSED

All 9 created files verified present on disk; both task commits (`e5d8bf2`, `7830ee3`) verified present in git log.

---
*Phase: 02-admin-doctor-reference-data-management*
*Completed: 2026-08-04*
