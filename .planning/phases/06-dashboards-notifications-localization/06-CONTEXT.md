# Phase 6: Dashboards, Notifications & Localization - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Patients and doctors get a personalized home base (dashboard) summarizing their activity, patients can favorite/unfavorite doctors and browse their favorites list, both roles receive live in-app notifications when a booking is confirmed, cancelled, or rescheduled, and the entire interface (patient, doctor, and public pages) is usable in Hebrew or English with correct RTL mirroring. It covers PATIENT-01 through PATIENT-04, DOCTOR-01, DOCTOR-02, NOTIF-01 through NOTIF-04, and I18N-01/I18N-02 exclusively. The `favorites` and `notifications` tables already exist (Phase 1 migration) with RLS in place, and Phase 5's booking/cancel/reschedule Postgres functions already insert `notifications` rows — this phase builds the read/display API and UI on top of that existing data, plus the favorites API/UI and the i18n system from scratch. Admin pages, payments, medical messaging, and anything beyond these requirements are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Favorites entry point
- **D-01:** A heart/favorite toggle is added in **two places**: on the doctor's public profile (`app/doctors/[id]/page.tsx`) and on each doctor card in the search results list (`/doctors`). Both reflect and update the same favorited state for the signed-in patient (favoriting from one place is reflected in the other on next render).

### Real-time notifications
- **D-02:** Notifications use **Supabase Realtime** (`postgres_changes` subscription on `public.notifications`, filtered to the signed-in user's own rows) so the notification bell/badge updates live without a page refresh, for both patients and doctors. This is a deliberate choice to match the roadmap goal's literal "real-time in-app updates" wording, not just "in-app." — **Reversibility:** costly — **rationale:** requires enabling Realtime replication on `public.notifications` and a client-side subscription hook; downgrading later to polling is a rewrite of the notification-bell component's data-fetching logic, not a config flip.

### Notification message translation
- **D-03:** Displayed notification text is derived from the `notifications.type` column mapped to a dictionary key (e.g., `appointment_booked` → `t("notifications.appointment_booked")`), not from the stored `message` column. The stored `message` text (hardcoded English, written by Phase 5's `book_appointment`/`cancel_appointment`/`reschedule_appointment` SQL functions) is never rendered directly to the user — it remains in the DB as a fallback/audit value only.

### i18n scope
- **D-04:** Translation coverage is **patient pages, doctor pages, and all public pages** (search, doctor profile, login/signup) — retroactively covering phases 1-5 per TASKS.md. **Admin pages (`/admin/*`) are explicitly excluded** and stay English-only, since admin is an internal/demo-only role never seen by an end user or evaluator outside the defense.

### Locale persistence & RTL rendering
- **D-05:** The selected locale is stored in a **cookie**, read server-side in the root layout (`app/layout.tsx`) so `lang`/`dir` on `<html>` are correct on the very first server-rendered response — no client-side flash of the wrong direction. The language switcher writes the cookie then triggers a reload/navigation so the server-rendered `dir` picks it up immediately.

### Header for public + authenticated pages
- **D-06:** `SiteHeader` (`components/site-header.tsx`) is **always rendered**, including for logged-out visitors — its current `if (!user) return null` early return is removed. Logged-out: logo + language switcher only. Logged-in: adds name, notification bell, and logout as today. One component reused across public and authenticated layouts, rather than maintaining two separate headers.

### Claude's Discretion
- Exact Postgres Realtime setup mechanics (enabling the publication on `notifications`, RLS-aware channel filtering, client subscription hook shape) — technical implementation, not a product decision.
- Whether `/patient/dashboard` and `/doctor/dashboard` (per TASKS.md item 6/7) replace the existing placeholder content at `app/patient/page.tsx` / `app/doctor/(gated)/page.tsx` in place, or are added as new sibling routes with the existing index redirecting — TASKS.md names the literal paths; the exact routing mechanics are the planner's call.
- Exact mark-as-read interaction (auto-mark-as-read when the notification dropdown opens vs. explicit per-item click) and unread-badge styling.
- Exact dashboard card layout/composition beyond what TASKS.md already specifies (upcoming appointments summary + quick links for patient; counts + quick link for doctor).
- Dictionary key naming convention for `dictionaries/en.json` / `dictionaries/he.json`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level context
- `.planning/PROJECT.md` — full product context, Key Decisions, Constraints (REST/no-Zod/Playwright-only/custom i18n/UI/timezone)
- `.planning/REQUIREMENTS.md` — PATIENT-01 through PATIENT-04, DOCTOR-01/02, NOTIF-01 through NOTIF-04, I18N-01/02 requirement text (lines 64-95)
- `.planning/ROADMAP.md` §"Phase 6: Dashboards, Notifications & Localization" — goal, success criteria, dependency on Phase 5
- `.planning/phases/06-dashboards-notifications-localization/TASKS.md` — the user's own hand-written route/function/page/test breakdown for this phase; this CONTEXT.md's decisions (D-01 through D-06) refine and take precedence where TASKS.md is silent or ambiguous

### Database (ALREADY APPLIED — see code_context below; verify at planning time)
- `supabase/migrations/20260803230000_initial_schema.sql` — `favorites` table (`patient_id`/`doctor_id`, unique constraint, `favorites_all_own` RLS policy) and `notifications` table (`user_id`/`type`/`message`/`related_appointment_id`/`read_at`, `notifications_select_own`/`notifications_update_own` RLS policies, no insert policy — server-side-only inserts)
- `supabase/migrations/20260810120000_add_appointment_booking_functions.sql` — the exact `notifications` inserts already wired into `book_appointment`/`cancel_appointment`/`reschedule_appointment`, including the hardcoded English `message` text and the `type` values this phase's dictionary must cover (see `<specifics>` below)

### Prior phase context
- `.planning/phases/01-foundation-database-schema-authentication/01-CONTEXT.md` — D-11 (shadcn/ui initialized with `"rtl": true` specifically for this phase's Hebrew/English requirement; no i18n library)
- `.planning/phases/05-appointment-booking-lifecycle/05-CONTEXT.md` — confirms notification *rows* are created in Phase 5, notification *display UI* is this phase's responsibility; establishes the `Asia/Jerusalem` timezone display pattern (`lib/timezone.ts`) this phase's dashboards/lists reuse
- `.planning/phases/04-doctor-availability-management/04-CONTEXT.md` — "DB constraint is the real guarantee, app layer translates the error" philosophy; RLS-plus-app-level-defense-in-depth pattern this phase's favorites/notifications endpoints continue

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/site-header.tsx` — current header, modified per D-06 (remove the logged-out early return, add language switcher + notification bell slots)
- `components/ui/card.tsx`, `components/ui/badge.tsx`, `components/ui/dialog.tsx` — direct fit for dashboard summary cards, unread-count badge, and the notification dropdown
- `lib/timezone.ts` — `jerusalemWallClockToUtc`/`formatJerusalemTime`/day-grouping helpers, reusable for "next appointment" and upcoming-summary display on both dashboards
- `lib/auth/require-doctor.ts` and the Phase 5 patient-role guard (`lib/auth/require-patient.ts` or equivalent) — role guards for the new dashboard/favorites/notifications routes
- `app/patient/page.tsx`, `app/doctor/(gated)/page.tsx` — existing placeholder dashboards ("Nothing here yet") this phase replaces with real content
- `app/patient/appointments/page.tsx`, `app/doctor/(gated)/appointments/page.tsx` — existing upcoming/past split logic (Phase 5) directly reusable for computing dashboard summary counts
- `app/doctors/[id]/page.tsx` and the `/doctors` search results component — where the favorite heart toggle (D-01) is added

### Established Patterns
- REST route handlers at `app/api/.../route.ts` with manual validation functions — this phase adds `app/api/patient/favorites`, `app/api/notifications`
- RLS already scopes ownership (`favorites_all_own`, `notifications_select_own`/`notifications_update_own`) — app-level ownership checks still expected as defense-in-depth, matching the Phase 4/5 precedent
- Tailwind logical properties only (`ps-`, `pe-`, `ms-`, `me-`, `text-start`, `text-end`), no physical-direction classes — standing invariant since Phase 1/5, critical now that RTL is actually exercised

### Integration Points
- New routes: `POST /api/patient/favorites`, `DELETE /api/patient/favorites/[id]`, `GET /api/patient/favorites`, `GET /api/notifications`, `PATCH /api/notifications/[id]/read`
- New/modified pages: `/patient/dashboard`, `/doctor/dashboard`, `/patient/favorites` (see Claude's Discretion on exact routing vs. existing placeholders)
- Modifies: `components/site-header.tsx` (D-06), `app/layout.tsx` (locale cookie read + `dir`/`lang`, D-05), `app/doctors/[id]/page.tsx` and the search results card component (favorite toggle, D-01)
- New: `dictionaries/en.json`, `dictionaries/he.json`, a `LocaleProvider` React context exposing current locale + `t()` helper, a language-switcher component
- Supabase Realtime: `public.notifications` needs to be added to the Realtime publication (D-02) — infra/migration detail for the researcher to confirm exact syntax

</code_context>

<specifics>
## Specific Ideas

- The exact `notifications.type` values already being inserted by Phase 5's SQL functions — the dictionary (D-03) must cover at least: `appointment_booked` (patient + doctor variants), `appointment_rescheduled` (patient + doctor variants), `appointment_cancelled` (patient + doctor variants). These are the literal strings in `supabase/migrations/20260810120000_add_appointment_booking_functions.sql`.
- The roadmap goal's literal wording "real-time in-app updates" was treated as intentional rather than loose phrasing, driving the Supabase Realtime decision (D-02) over simpler polling.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

### Reviewed Todos (not folded)
None — `todo.match-phase` returned zero matches for Phase 6.

</deferred>

---

*Phase: 6-dashboards-notifications-localization*
*Context gathered: 2026-08-11*
