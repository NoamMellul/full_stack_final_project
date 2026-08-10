# Phase 4: Doctor Availability Management - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Doctors fully control their own bookable schedule: adding available slots, deleting unbooked slots, blocking periods of unavailability, and un-blocking them again — with the server/database enforcing every conflict rule so the schedule shown to patients is always valid. This phase is doctor-only and self-service (no admin schedule-management UI). It covers AVAIL-01 through AVAIL-07 exclusively. Appointment booking, cancellation, and rescheduling are Phase 5 — this phase never creates or touches `appointments` rows; it only manages `availability_slots`.

</domain>

<decisions>
## Implementation Decisions

### Deleting / un-blocking a slot
- **D-01:** `DELETE /api/doctor/slots/[id]` is NOT restricted to `status = 'available'` as TASKS.md's literal wording suggested. The real rule (confirmed by the user, matches AVAIL-04's "has not been booked" wording) is:
  - `available` → can be deleted.
  - `blocked` → can be deleted (this is how a doctor un-blocks a period — there is no separate "unblock" endpoint, deleting the blocked row IS the unblock action).
  - `booked` (or otherwise tied to an appointment) → cannot be deleted directly; rejected (AVAIL-05).
- **D-02:** Deleting a blocked period only removes the restriction — it must NOT automatically recreate any availability slots that existed in that range before the block was created. The doctor re-adds availability manually afterward if they want it.

### Blocked-period shape
- **D-03:** A blocked period is represented as a single `availability_slots` row with `status = 'blocked'`, spanning one continuous `start_at`→`end_at` range (start date + start time → end date + end time) — never decomposed into per-day or business-hour rows. Reuses the existing schema/exclusion-constraint mechanism as-is; no data-model redesign. Examples confirmed by the user: same-day partial block (Mon 14:00→18:00), multi-day block spanning night hours (Mon 09:00→Wed 18:00), and a full-day vacation range (Aug 20 00:00→Aug 27 23:59).
- **D-04:** Add a nullable `reason text` column to `availability_slots` (new migration required — does not exist in the initial schema). Optional free-text set by the doctor when blocking (e.g. "Vacation", "Conference"); purely informational, no validation on content. Shown next to blocked entries in the schedule list. Not applicable to `available`/`booked` rows.

### Admin's role in slot management
- **D-05:** Availability management is doctor-only in this phase. No `app/api/admin/.../slots` routes and no admin schedule-management page are built. The admin continues to manage doctor accounts/profiles/reference data only (already shipped in Phase 2) and does not gain schedule CRUD here. — **Reversibility:** reversible — the existing `availability_slots_write_owner_or_admin` RLS policy already permits `is_admin()` writes at the DB layer (from Phase 1), so an admin-facing schedule UI can be added later purely as new routes/pages without any migration or policy change.
- **D-06:** Every add/delete/block endpoint in this phase resolves the acting doctor's `doctor_id` from the authenticated session (`doctors.profile_id = auth.uid()`), the same ownership pattern the `is_doctor_owner()` RLS helper already uses — never accept a client-supplied `doctor_id` that bypasses this resolution, since admin-on-behalf-of-doctor is explicitly out of scope for this phase (D-05).

### Conflict / validation rules (all server/DB-enforced, not just UI)
- **D-07:** A doctor can only ever modify their own schedule (enforced by D-06 + existing RLS `availability_slots_write_owner_or_admin`).
- **D-08:** No availability slot or blocked period can be created in the past (AVAIL-02), evaluated in `Asia/Jerusalem` input terms but compared as the resolved UTC instant.
- **D-09:** For any new slot or blocked period, `start_at` must be before `end_at` (already a DB check constraint `availability_slots_valid_range`; app-level validation duplicates it for a clean error message before hitting the DB).
- **D-10:** Available slots cannot overlap each other; an available slot cannot overlap a blocked period; a blocked period cannot overlap a booked appointment or another blocked period. All of this is already covered in one shot by the existing `availability_slots_no_overlap` GiST exclusion constraint (`doctor_id` + `tstzrange(start_at, end_at)`, applies across every status uniformly) — no new constraint needed, just correctly catching and translating its violation (Postgres error code `23P01`) into a user-facing message at the app layer.
- **D-11:** Overlap-rejection error message is **generic** regardless of what it collided with — one message such as "This time overlaps your existing schedule," never distinguishing available/booked/blocked in the copy. Simplest to implement and test; matches the user's explicit "keep it simple" guidance.
- **D-12:** All scheduling input/output on this phase's pages and forms is displayed and entered in `Asia/Jerusalem`, converted to/from UTC using the project's existing `lib/timezone.ts` helpers (`jerusalemWallClockToUtc` for date+time form fields) — no new timezone-conversion logic invented for this phase.

### `/doctor/schedule` page UX
- **D-13:** Day-grouped list view — NOT a calendar grid. Explicitly ruled out: a Google Calendar/Doctolib-style grid. Reuse the existing `groupSlotsByJerusalemDay` + `formatJerusalemDayHeading` + `formatJerusalemTime` pattern from `app/doctors/[id]/page.tsx` (adapted to a doctor's own multi-status slots instead of a patient-facing available-only list).
- **D-14:** The list must visually distinguish `available` vs `blocked` status per entry (e.g. label/badge/color), matching the format: `HH:MM – HH:MM   [Available|Blocked]`, with the optional `reason` (D-04) shown next to blocked entries.
- **D-15:** The page shows **future (today-and-forward) entries only** — no past/elapsed slots or blocks. Matches the existing "upcoming" pattern on the public profile page; nothing actionable exists in the past anyway and no AVAIL-* requirement asks for history here.
- **D-16:** "Add slot" is a single-slot-per-submission form (date + start time + end time) — no recurring-availability or bulk-generation feature in this phase, unless it turns out to be trivial with the current architecture (Claude's discretion at planning time, but not a requirement).
- **D-17:** "Block a period" is a separate form/action from "Add slot," taking start date/time + end date/time + optional reason (D-04).
- **D-18:** "Delete slot" action applies to both available slots and blocked periods per D-01, and is disabled/hidden for `booked` slots per AVAIL-05.

### Claude's Discretion
- Exact styling/wording of the available-vs-blocked distinction on the schedule list (badge variant, color) — reuse `components/ui/badge.tsx` per the project's established pattern (Phase 2/3 precedent).
- Exact copy of the generic overlap-rejection error message (D-11) and the past-date rejection message (D-08).
- Whether a "quick recurring slots" convenience is added on top of the single-slot form (D-16) — only if trivial; not required.
- Exact shape/placement of the "Add slot" vs "Block period" forms on `/doctor/schedule` (e.g. two inline forms, a tab switch, or a dialog per action) — any approach consistent with existing shadcn primitives is fine.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level context
- `.planning/PROJECT.md` — full product context, Key Decisions, Constraints (REST/no-Zod/Playwright-only/i18n/UI/timezone)
- `.planning/REQUIREMENTS.md` — AVAIL-01 through AVAIL-07 requirement text
- `.planning/ROADMAP.md` — Phase 4 goal, success criteria, dependency chain (depends on Phase 2)
- `.planning/phases/04-doctor-availability-management/TASKS.md` — the user's own hand-written route/page/test breakdown for this phase; note D-01 corrects its literal DELETE-endpoint wording (see above) — treat TASKS.md as a detailed reference outline, not a substitute for planning, and defer to this CONTEXT.md's D-01 where the two conflict

### Database (mostly ALREADY APPLIED — see code_context below; one new migration needed)
- `supabase/migrations/20260803230000_initial_schema.sql` — `availability_slots` table: `status` check (`available`/`booked`/`blocked`), `availability_slots_valid_range` check (`end_at > start_at`), `availability_slots_no_overlap` GiST exclusion constraint (per-doctor, any status, `tstzrange` overlap — the mechanism behind D-10), RLS `availability_slots_write_owner_or_admin` (owner-or-admin write, already permits the D-05 future-admin-UI reversibility), `is_doctor_owner(target_doctor_id)` helper function (the ownership-check mechanism D-06 must key off), `doctors.profile_id` (nullable FK to `profiles.id`, used to resolve doctor_id from `auth.uid()`).
- **New migration required this phase:** add `reason text` nullable column to `availability_slots` (D-04) — does not exist yet.

### Prior phase context
- `.planning/phases/03-doctor-discovery-search-public-profiles/03-CONTEXT.md` — D-01/D-02/D-03 (demo slot seeding rules Phase 4 must not break), D-08 (availability-slot semantics used by search filters, must stay consistent with what Phase 4 writes)
- `.planning/phases/02-admin-doctor-reference-data-management/02-CONTEXT.md` — D-09 (Phase 2 explicitly deferred slot seeding to whichever phase needed it — informational only, slots are already seeded by Phase 3)
- `.planning/phases/01-foundation-database-schema-authentication/01-CONTEXT.md` — REST routes / manual validation conventions this phase continues

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/timezone.ts` — `jerusalemWallClockToUtc(year, month, day, hour, minute)` is the direct fit for the add-slot/block-period forms' date+time inputs (D-12); `jerusalemDayKey`, `formatJerusalemDayHeading`, `formatJerusalemTime` are the exact helpers the schedule list (D-13) should reuse.
- `app/doctors/[id]/page.tsx` — `groupSlotsByJerusalemDay()` (local helper, lines 38-50) is the direct template for grouping the doctor's own slots by day on `/doctor/schedule`; will need adapting to carry `status` (and `reason` for blocked rows) instead of the public page's available-only slot shape.
- `components/ui/{badge,card,button}.tsx` — base primitives already established for status badges (available/blocked distinction, D-14) and forms.
- `lib/validation/doctor.ts`, `lib/validation/reference-data.ts` — established shape for this project's manual TypeScript validation functions; the new `lib/validation/availability.ts` (or similar) should follow the same pattern (`isInPast`, overlap pre-check per TASKS.md task 4).
- `app/doctor/(gated)/layout.tsx` / `app/doctor/layout.tsx` — existing doctor role-guard layout; `/doctor/schedule` lands under the gated group alongside the existing `app/doctor/(gated)/page.tsx` placeholder dashboard.

### Established Patterns
- REST route handlers at `app/api/.../route.ts` with manual validation functions — no `app/api/doctor/*` routes exist yet; this phase creates the first ones (`POST /api/doctor/slots`, `DELETE /api/doctor/slots/[id]`, `POST /api/doctor/blocked-periods` per TASKS.md, adjusted per D-01 so slot deletion also handles blocked rows).
- RLS already enforces owner-or-admin write on `availability_slots` — API routes built on the session-bound client (not `lib/supabase/admin.ts`) inherit this for free; defense-in-depth app-level ownership check (D-06) is still expected, matching the project's established "DB constraint is the real guarantee, app-level check is for UX" philosophy (TASKS.md task 4).
- Postgres exclusion-constraint violations surface as error code `23P01` — no existing helper in this codebase catches/translates this yet (Phase 3 dealt with `PGRST103`, a different code, in `app/api/doctors/route.ts`); this phase establishes that translation.

### Integration Points
- New page: `app/doctor/(gated)/schedule/page.tsx` (or `app/doctor/schedule/page.tsx` depending on how the gated group is structured — follow the existing `(gated)` convention).
- New routes: `app/api/doctor/slots/route.ts`, `app/api/doctor/slots/[id]/route.ts`, `app/api/doctor/blocked-periods/route.ts`.
- New migration: add `availability_slots.reason` column.
- Does NOT touch: `appointments` table, `app/api/admin/*`, or any existing search/profile code from Phase 3 (search already reads `status = 'available'` rows correctly via existing RLS and will pick up whatever this phase writes with no changes needed).

</code_context>

<specifics>
## Specific Ideas

The user provided complete, explicit business rules for this phase in a single detailed answer — captured verbatim as decisions D-01 through D-18 above. Notably:
- Explicit worked examples for blocked-period shape (D-03): "Monday 14:00 → Monday 18:00", "Monday 09:00 → Wednesday 18:00", "August 20 00:00 → August 27 23:59 for vacation".
- Explicit worked example for the schedule list format (D-13/D-14): "Monday, August 17 / 09:00–09:30 Available / 10:00–10:30 Available / 14:00–18:00 Blocked".
- Explicit instruction to keep the data model as simple as possible and reuse the existing `availability_slots` mechanism rather than redesigning anything, "unless there is a strong technical reason" — none was found; D-03/D-10 confirm the existing schema already covers every stated rule except the new `reason` column.
- Explicit instruction not to implement appointment booking in this phase — that remains Phase 5, reaffirming the ROADMAP.md phase boundary.

</specifics>

<deferred>
## Deferred Ideas

- **Admin schedule management** ("admin manages a doctor's schedule") — explicitly deferred by the user (D-05) to a future phase/need, not this milestone's roadmap. The RLS policy already supports it without a migration when/if it's added.
- **Recurring / bulk slot generation** — explicitly deferred unless trivial at planning time (D-16); not a requirement for this phase.
- **Past-slot history on the schedule page** — explicitly out of scope for this phase (D-15); no AVAIL-* requirement asks for it.

### Reviewed Todos (not folded)
None — `todo.match-phase` returned zero matches for Phase 4.

</deferred>

---

*Phase: 4-doctor-availability-management*
*Context gathered: 2026-08-08*
