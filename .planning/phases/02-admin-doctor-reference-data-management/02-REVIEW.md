---
phase: 02-admin-doctor-reference-data-management
reviewed: 2026-08-05T00:00:00Z
depth: standard
files_reviewed: 42
files_reviewed_list:
  - app/admin/appointments/page.tsx
  - app/admin/doctors/page.tsx
  - app/admin/layout.tsx
  - app/admin/locations/page.tsx
  - app/admin/page.tsx
  - app/admin/specialties/page.tsx
  - app/admin/users/page.tsx
  - app/api/admin/appointments/route.ts
  - app/api/admin/doctors/[id]/link-account/route.ts
  - app/api/admin/doctors/[id]/route.ts
  - app/api/admin/doctors/[id]/status/route.ts
  - app/api/admin/doctors/route.ts
  - app/api/admin/locations/[id]/route.ts
  - app/api/admin/locations/route.ts
  - app/api/admin/specialties/[id]/route.ts
  - app/api/admin/specialties/route.ts
  - app/api/admin/users/route.ts
  - app/api/auth/change-password/route.ts
  - app/doctor/(gated)/layout.tsx
  - app/doctor/(gated)/page.tsx
  - app/doctor/change-password/page.tsx
  - components/admin/admin-nav.tsx
  - components/admin/doctors-page-client.tsx
  - components/admin/oversight-table.tsx
  - components/admin/reference-data-page-client.tsx
  - components/admin/temp-password-dialog.tsx
  - components/initials-avatar.tsx
  - components/ui/badge.tsx
  - components/ui/dialog.tsx
  - components/ui/select.tsx
  - components/ui/skeleton.tsx
  - components/ui/switch.tsx
  - components/ui/table.tsx
  - components/ui/textarea.tsx
  - lib/auth/require-admin.ts
  - lib/validation/doctor.ts
  - lib/validation/reference-data.ts
  - package.json
  - scripts/seed.ts
  - supabase/migrations/20260804120000_seed_language_rows.sql
  - supabase/migrations/20260804120100_add_reference_data_unique_constraints.sql
  - supabase/migrations/20260804120200_add_must_change_password.sql
  - tests/e2e/admin-doctor-crud.spec.ts
  - tests/e2e/admin-doctor-link-account.spec.ts
  - tests/e2e/admin-doctor-status.spec.ts
  - tests/e2e/admin-oversight-views.spec.ts
  - tests/e2e/admin-reference-data.spec.ts
  - tests/e2e/admin-route-protection.spec.ts
  - tests/e2e/auth-doctor-login.spec.ts
  - tests/e2e/helpers/appointments.ts
  - tests/e2e/helpers/reference-data.ts
  - tests/e2e/helpers/supabase-anon.ts
  - tests/e2e/helpers/test-users.ts
  - tests/e2e/route-protection-role-mismatch.spec.ts
findings:
  critical: 1
  warning: 7
  info: 2
  total: 10
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-08-05T00:00:00Z
**Depth:** standard
**Files Reviewed:** 42 (source files under review scope; a handful of listed test/helper files were also read for reliability but contain no findings of their own)
**Status:** issues_found

## Summary

Reviewed the admin doctor CRUD, reference-data CRUD (specialties/locations), doctor account linking, oversight views, admin dashboard/nav, cross-cutting route protection, the demo-data seed script, and the three related migrations. The authorization posture is solid throughout: every admin API route calls `requireAdmin()` before touching data, RLS policies back that up independently, delete-guard checks are re-verified server-side (never trusting the disabled button), and privileged fields (`is_active`, `is_demo`, `profile_id`, `role`) are never accepted from the request body. The `must_change_password` column-grant migration correctly closes a pre-existing self-role-escalation gap.

That said, one genuine functional bug was found in the reference-data edit flow (admins cannot clear an already-set location address — the save silently no-ops), and several data-integrity/robustness gaps exist around trimming, whitespace handling, malformed-id handling, a missing unique constraint that makes doctor-account linking racy, and unhandled JSON body parsing across every mutating route.

## Critical Issues

### CR-01: Clearing a location's address in the edit dialog silently fails to persist

**File:** `components/admin/reference-data-page-client.tsx:327-337`

**Issue:** `buildEditPayload` computes, for the optional `address` field:

```ts
payload[field.key] = field.optional ? current || undefined : current;
```

When an admin blanks out a previously-set address and saves, `current` is `""`, so `current || undefined` evaluates to `undefined`. `JSON.stringify` drops keys whose value is `undefined`, so the outgoing PATCH body never contains an `address` key at all.

Server-side, `app/api/admin/locations/[id]/route.ts` only touches fields that are present in the body:

```ts
if ("address" in body) updates.address = address ? address.trim() : null;
```

Since `"address"` is absent from the body, this branch never runs — the row's old address is left completely unchanged. The request still returns `200`, the dialog closes, and the list reloads showing the stale (un-cleared) address, with no error surfaced to the admin. The admin has no way to ever clear an address once one has been set.

**Fix:** Send an explicit `null` instead of `undefined` when the optional field is blanked, so the "field present → touch it" contract on the server is honored:

```ts
payload[field.key] = field.optional
  ? (current === "" ? null : current)
  : current;
```

(`validateLocationPatch` and the PATCH handler already accept `address: null` correctly — only the client-side payload construction needs to change.)

## Warnings

### WR-01: `link-account` has a TOCTOU race with no DB-level guard, enabling orphaned duplicate accounts

**File:** `app/api/admin/doctors/[id]/link-account/route.ts:24-99`

**Issue:** The route checks `doctor.profile_id` is `null` via a `SELECT`, then later creates an Auth user + profile and `UPDATE`s `doctors.profile_id`. There is no unique constraint on `public.doctors.profile_id` in `supabase/migrations/20260803230000_initial_schema.sql` (only a plain FK reference — confirmed via search, no `unique` on that column anywhere in `supabase/migrations/`). Two concurrent `POST` calls for the same doctor id (e.g. a double-click bypassing the disabled-button UI guard, or two admin tabs) can both pass the `profile_id` null check before either `UPDATE` commits. Both requests will create a full Auth user + `profiles` row; only one wins the final `doctors.profile_id` update, and the other becomes a permanently live login credential with `role: "doctor"` that is never linked to any doctor row, never visible in the admin UI, and never cleaned up.

**Fix:** Add a unique constraint/index on `doctors.profile_id` (partial, since the column is nullable: `create unique index doctors_profile_id_key on public.doctors (profile_id) where profile_id is not null;`) and catch the resulting `23505` on the final `UPDATE` to roll back the just-created auth user/profile and return the existing 409, closing the race the same way the reference-data delete guards already handle their own 23503/23505 races.

### WR-02: Malformed (non-UUID) path ids cause a raw 500 instead of a clean 400/404

**Files:** `app/api/admin/doctors/[id]/route.ts:57-61`, `app/api/admin/doctors/[id]/status/route.ts:57-61`, `app/api/admin/specialties/[id]/route.ts:25-29,80-84`, `app/api/admin/locations/[id]/route.ts:25-29,85-89`

**Issue:** None of these routes validate that `id` is a well-formed UUID before querying. Postgres rejects an invalid UUID literal with an `invalid input syntax for type uuid` error, which surfaces here as `lookupError` and is translated into the generic `{ error: "Could not save/delete X. Please try again." }` 500 response — not the `404 Not Found` a caller would reasonably expect for a garbage id, and not a `400` for a malformed request either.

**Fix:** Validate `id` against a UUID regex immediately after destructuring `params` and return `404` (or `400`) before issuing any query, e.g. a small shared `isUuid(value: string): boolean` helper used by all `[id]` route handlers.

### WR-03: `request.json()` is never guarded against malformed bodies in any mutating admin route

**Files (representative, same pattern repeats in every listed file):** `app/api/admin/doctors/route.ts:68`, `app/api/admin/doctors/[id]/route.ts:51`, `app/api/admin/doctors/[id]/status/route.ts:51`, `app/api/admin/doctors/[id]/link-account/route.ts:14`, `app/api/admin/specialties/route.ts:56`, `app/api/admin/specialties/[id]/route.ts:19`, `app/api/admin/locations/route.ts:58`, `app/api/admin/locations/[id]/route.ts:19`, `app/api/auth/change-password/route.ts:17`

**Issue:** Every one of these routes calls `const body = await request.json();` with no `try/catch`. A request with an invalid or empty JSON body throws a `SyntaxError` that is never caught, so Next.js returns its own unhandled-error response rather than the app's consistent `{ error: "..." }` JSON shape the rest of the codebase (and the client's error-message plumbing) relies on. This is masked in normal UI usage because the client wraps its `fetch` calls in `try/catch` and falls back to a generic message, but any direct API caller (tests, curl, an attacker probing the API) gets an inconsistent, potentially environment-dependent response instead of a clean `400`.

**Fix:** Wrap the `request.json()` call (or the whole handler body) in a `try/catch` and return `NextResponse.json({ error: "Invalid request body." }, { status: 400 })` on parse failure — one small shared helper would remove the need to repeat this in every route.

### WR-04: Doctor `fullName`, `bio`, and `photoUrl` are never trimmed server-side, unlike specialties/locations

**Files:** `app/api/admin/doctors/route.ts:87-94` (POST), `app/api/admin/doctors/[id]/route.ts:86-90` (PATCH)

**Issue:** `validateDoctorInput`/`validateDoctorPatch` only check that these fields are non-empty strings after trimming, but the actual values persisted are the raw, untrimmed strings:

```ts
full_name: fullName,      // not fullName.trim()
photo_url: photoUrl ?? null,  // not photoUrl?.trim()
bio: bio ?? null,             // not bio?.trim()
```

By contrast, `app/api/admin/specialties/route.ts` and `app/api/admin/locations/route.ts` both call `.trim()` on every string field before insert/update. This inconsistency lets a doctor's `full_name` or `photo_url` be stored with leading/trailing whitespace (visually invisible, but breaks exact-match lookups, sorting, and the `is_demo` name-dedup check in `scripts/seed.ts`, which matches by exact `full_name`). Separately, explicitly clearing `photoUrl`/`bio` to `""` stores an empty string rather than `null` (inconsistent with how "no value" is represented elsewhere in the schema).

**Fix:** Trim `fullName`, `bio`, and `photoUrl` the same way `city`/`neighborhood`/`address`/`nameEn`/`nameHe` already are, and normalize empty-string clears to `null` for consistency with the reference-data routes.

### WR-05: Whitespace-only `address` is stored as an empty string instead of `null`

**Files:** `app/api/admin/locations/route.ts:75` (POST), `app/api/admin/locations/[id]/route.ts:49` (PATCH)

**Issue:** `address: address ? address.trim() : null` treats a whitespace-only string (e.g. `" "`) as truthy, so it gets trimmed down to `""` and stored as an empty string rather than `null`. `validateLocationInput`/`validateLocationPatch` only check `typeof address !== "string"`, not that a non-empty value is actually meaningful content, so this passes validation silently.

**Fix:** Trim first, then decide null-ness: `const trimmedAddress = address?.trim(); updates.address = trimmedAddress ? trimmedAddress : null;`

### WR-06: `specialties.name_he` has no uniqueness enforcement — only `name_en` is deduplicated

**File:** `supabase/migrations/20260804120100_add_reference_data_unique_constraints.sql:12-13`

**Issue:** The migration adds `unique (name_en)` on `specialties` but nothing on `name_he`. An admin can create two specialties with different English names but an identical Hebrew name (`nameHe`), and the API's `23505`-based duplicate detection (`app/api/admin/specialties/route.ts:73-78`) will never catch it, since the underlying constraint doesn't cover that column. This directly undermines the Hebrew-facing side of the bilingual reference-data catalog described in the project's i18n requirements.

**Fix:** Either add `unique (name_he)` as a second constraint, or (if bilingual pairs are meant to be validated together) a composite check — whichever matches the intended data model; at minimum this gap should be a deliberate, documented decision rather than an unaddressed asymmetry.

### WR-07: ~40-line doctor row shape (`DOCTOR_LIST_SELECT` / `RawDoctorRow` / `toListRow`) is copy-pasted identically across three route files

**Files:** `app/api/admin/doctors/route.ts:6-40`, `app/api/admin/doctors/[id]/route.ts:6-40`, `app/api/admin/doctors/[id]/status/route.ts:6-40`

**Issue:** The select string, the `RawDoctorRow` type, and the `toListRow` mapping function are byte-identical across all three files. Any future change to the doctor list shape (e.g. adding a column) requires remembering to update all three copies in lockstep; a missed update silently produces divergent API responses between the list/create endpoint and the edit/status endpoints.

**Fix:** Extract these into a shared module (e.g. `lib/admin/doctor-row.ts`) and import from all three routes.

## Info

### IN-01: Appointment filter query params (`from`, `to`, `doctorId`) aren't format-validated

**File:** `app/api/admin/appointments/route.ts:32-57`

**Issue:** `status` is validated against `VALID_STATUSES`, but `doctorId`, `from`, and `to` are passed straight into `.eq()`/`.gte()`/`.lte()` with no format check. A malformed `doctorId` (not a UUID) or an unparsable `from`/`to` value causes a raw Postgrest type-mismatch error, translated into the generic 500 `"Could not load appointments. Please refresh the page."` instead of a `400` explaining what was wrong. Low impact since the UI only ever sends well-formed values, but any direct API caller hits an unhelpful response.

**Fix:** Validate `doctorId` as a UUID and `from`/`to` as parseable ISO date strings before building the query, returning `400` on failure (mirroring the existing `status` validation).

### IN-02: No minimum-language requirement on doctor create/edit

**File:** `lib/validation/doctor.ts:33-41` (`validateDoctorInput`), `lib/validation/doctor.ts:101-111` (`validateDoctorPatch`)

**Issue:** `languageIds: []` (an explicitly empty array) passes validation on both create and edit, so a doctor can be saved with zero spoken languages. Given the platform's core value proposition is filtering by spoken language, a doctor with no languages would be effectively unfindable via that filter. This may be intentional (languages optional at creation, added later), but it's worth confirming against product intent since nothing in the UI currently warns the admin about it.

**Fix (if unintended):** Require at least one language id in `validateDoctorInput`, mirroring the "Specialty is required." / "Location is required." pattern already used for the other required relations.

---

_Reviewed: 2026-08-05T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
