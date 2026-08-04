# Phase 2: Admin — Doctor & Reference Data Management - Context

**Gathered:** 2026-08-04
**Status:** Ready for planning

<domain>
## Phase Boundary

The admin has a complete management interface to populate and govern the platform: create/edit/activate/deactivate doctor profiles, link doctor login accounts with a one-time temporary password, manage specialties and locations, and view (read-only) all registered users and all appointments platform-wide. This phase produces the demo data (doctors, specialties, neighborhoods) that Phases 3-6 depend on.

</domain>

<decisions>
## Implementation Decisions

### Doctor photo handling
- **D-01:** No Supabase Storage bucket in this phase. `doctors.photo_url` stays a plain optional text field where the admin pastes an external image URL — no file upload, no bucket, no Storage permissions to manage. — **Reversibility:** reversible — a real Storage-backed upload can be added later without breaking anything that reads `photo_url` as a URL.
- **D-02:** Whenever `photo_url` is empty, render an initials-based avatar (derived from the doctor's `full_name`) everywhere a doctor photo would otherwise show (admin doctors list now; public profile/search cards in later phases).

### Temporary password & account linking
- **D-03:** After `POST /api/admin/doctors/[id]/link-account` succeeds, the temporary password is shown to the admin exactly once, in a dismissible modal with a "Copy password" button and an explicit warning that it will not be shown again anywhere.
- **D-04:** The linked doctor is forced to change their password on first login. Requires a new flag (e.g. `profiles.must_change_password`, default `true` when a profile is created via admin link-account) checked at login/middleware, redirecting to a change-password page before any other route is reachable. — **Reversibility:** reversible — the flag and redirect are additive and localized to the login flow.

### Reference data deletion guard
- **D-05:** The delete action for a specialty or location stays visible but is **disabled** (not hidden) when the item is referenced by at least one doctor, with inline explanatory text, e.g. "This specialty is used by 3 doctors and cannot be deleted." Same pattern for both specialties and locations.
- **D-06:** Disabling the button client-side is a UX convenience only, never the actual guard — the `DELETE` route must independently re-check for referencing doctors server-side and reject with an error regardless of client state (this was already implied by TASKS.md's "Prevent deleting a specialty still referenced by a doctor"; the discussion locked the specific UX + confirmed the server check is non-negotiable).

### Demo data seed script
- **D-07:** Seed script creates a moderate, realistic dataset: all specialties populated, all Tel-Aviv neighborhoods represented, and roughly 10-15 demo doctors spread across them.
- **D-08:** No photo URLs are seeded — demo doctors intentionally rely on the initials-avatar fallback (D-02), keeping the seed script free of external asset/network dependencies.
- **D-09:** Seed script does NOT create `availability_slots`. Slot seeding is deferred to whichever phase actually builds and validates availability logic (Phase 4 for doctor-side management, Phase 5 for booking) — Phase 2's seed script is scoped to doctors/specialties/locations/users only, since nothing in this phase reads or displays slots.

### Claude's Discretion
- Exact styling/implementation of the initials-avatar component (colors, sizing).
- Exact modal component implementation for the one-time password display (D-03) — any shadcn dialog primitive is fine.
- Exact demo doctor names/bios/specialty distribution within the "10-15 doctors, all specialties, all neighborhoods" envelope (D-07) — `is_demo = true` is already the schema default, so no extra labeling logic is needed beyond what Phase 1 already enforces.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level context
- `.planning/PROJECT.md` — full product context, Key Decisions, Constraints (REST/no-Zod/Playwright-only/i18n/UI/timezone)
- `.planning/REQUIREMENTS.md` — ADMIN-01 through ADMIN-08 requirement text
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, dependency chain (depends on Phase 1)
- `.planning/phases/02-admin-doctor-reference-data-management/TASKS.md` — the user's own hand-written route/page/test breakdown for this phase — treat as a detailed reference outline, not a substitute for planning

### Database (ALREADY APPLIED — see code_context below)
- `supabase/migrations/20260803230000_initial_schema.sql` — already-deployed schema for `doctors`, `specialties`, `locations`, `languages`, `doctor_languages` (columns, FKs, RLS policies: public read, admin-only write). `doctors.photo_url` is a plain `text` column (supports D-01 directly, no migration needed for photo handling). No `must_change_password`-style column exists yet — Phase 2 plans must add this via a new migration (D-04).

### Prior phase context
- `.planning/phases/01-foundation-database-schema-authentication/01-CONTEXT.md` — carries forward D-01/D-02 (REST routes, manual validation), D-06 (`doctors.full_name` stored redundantly because `profile_id` is nullable until link-account), D-09 (`is_admin()` / `is_doctor_owner()` RLS helper functions available for reuse in new RLS policies if needed)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/supabase/server.ts` / `client.ts` / `admin.ts` — the `admin.ts` service-role client is what `link-account` must use to create the Supabase Auth user (same pattern as the Phase 1 signup route's admin client usage).
- `components/ui/button.tsx` and other shadcn primitives — base for all new admin forms/modals; add further primitives via `npx shadcn add <component>` (e.g. dialog, table) as needed.
- `app/admin/` layout — already exists as a structural role-guard copy of `app/patient/layout.tsx` from Phase 1, currently empty of pages.

### Established Patterns
- REST route handlers at `app/api/.../route.ts` (see `app/api/auth/*` for the existing pattern of manual validation + Supabase client usage).
- Doctor/admin role-guard layouts are plain folders (not route groups), per Phase 1's D- convention, so `proxy.ts`'s matcher has real URL prefixes.

### Integration Points
- All new admin pages land under `app/admin/` (dashboard, doctors, specialties, locations, users, appointments).
- All new admin API routes land under `app/api/admin/`.
- `proxy.ts` / `lib/supabase/proxy.ts` already redirect unauthenticated `/admin` requests to login; role-specific admin-only enforcement still needs to happen in `app/admin/layout.tsx` per the Phase 1 pattern.

</code_context>

<specifics>
## Specific Ideas

No additional specifics beyond the decisions above — the user's own TASKS.md (referenced in canonical_refs) already lays out the intended route/page list and Playwright test list in detail.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-admin-doctor-reference-data-management*
*Context gathered: 2026-08-04*
