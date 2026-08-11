# Phase 6: Dashboards, Notifications & Localization - Research

**Researched:** 2026-08-11
**Domain:** Supabase Realtime (postgres_changes + RLS), Next.js App Router cookie-based i18n/RTL, dashboard aggregation queries
**Confidence:** MEDIUM-HIGH (codebase touchpoints VERIFIED by direct Read; Supabase Realtime/Next.js mechanics CITED from official docs; no external package research needed — this phase adds zero new runtime dependencies)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (Favorites entry point):** A heart/favorite toggle is added in **two places**: on the doctor's public profile (`app/doctors/[id]/page.tsx`) and on each doctor card in the search results list (`/doctors`). Both reflect and update the same favorited state for the signed-in patient (favoriting from one place is reflected in the other on next render).
- **D-02 (Real-time notifications):** Notifications use **Supabase Realtime** (`postgres_changes` subscription on `public.notifications`, filtered to the signed-in user's own rows) so the notification bell/badge updates live without a page refresh, for both patients and doctors. Deliberate choice to match the roadmap goal's literal "real-time in-app updates" wording, not just "in-app." Reversibility: costly — requires enabling Realtime replication on `public.notifications` and a client-side subscription hook; downgrading later to polling is a rewrite of the notification-bell component's data-fetching logic, not a config flip.
- **D-03 (Notification message translation):** Displayed notification text is derived from the `notifications.type` column mapped to a dictionary key (e.g., `appointment_booked` → `t("notifications.appointment_booked")`), not from the stored `message` column. The stored `message` text (hardcoded English, written by Phase 5's SQL functions) is never rendered directly to the user — it remains in the DB as a fallback/audit value only.
- **D-04 (i18n scope):** Translation coverage is **patient pages, doctor pages, and all public pages** (search, doctor profile, login/signup) — retroactively covering phases 1-5. **Admin pages (`/admin/*`) are explicitly excluded** and stay English-only.
- **D-05 (Locale persistence & RTL rendering):** The selected locale is stored in a **cookie**, read server-side in the root layout (`app/layout.tsx`) so `lang`/`dir` on `<html>` are correct on the very first server-rendered response — no client-side flash of the wrong direction. The language switcher writes the cookie then triggers a reload/navigation so the server-rendered `dir` picks it up immediately.
- **D-06 (Header for public + authenticated pages):** `SiteHeader` (`components/site-header.tsx`) is **always rendered**, including for logged-out visitors — its current `if (!user) return null` early return is removed. Logged-out: logo + language switcher only. Logged-in: adds name, notification bell, and logout as today.

### Claude's Discretion

- Exact Postgres Realtime setup mechanics (enabling the publication on `notifications`, RLS-aware channel filtering, client subscription hook shape) — technical implementation, not a product decision.
- Whether `/patient/dashboard` and `/doctor/dashboard` replace the existing placeholder content at `app/patient/page.tsx` / `app/doctor/(gated)/page.tsx` in place, or are added as new sibling routes with the existing index redirecting.
- Exact mark-as-read interaction (auto-mark-as-read when the notification dropdown opens vs. explicit per-item click) and unread-badge styling.
- Exact dashboard card layout/composition beyond upcoming appointments summary + quick links for patient; counts + quick link for doctor.
- Dictionary key naming convention for `dictionaries/en.json` / `dictionaries/he.json`.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PATIENT-01 | Patient can add a doctor to favorites | `favorites` table + RLS already exist ([VERIFIED: supabase/migrations/20260803230000_initial_schema.sql:91-97,263-265]); new `POST /api/patient/favorites` route following the `requirePatient()` guard pattern |
| PATIENT-02 | Patient can remove a doctor from favorites | Same table/RLS; new `DELETE /api/patient/favorites/[id]` following the ownership-restatement pattern used by `app/api/doctor/slots/[id]/route.ts` |
| PATIENT-03 | Patient can view their list of favorite doctors | New `GET /api/patient/favorites` + `/patient/favorites` page; join `favorites` → `doctors` |
| PATIENT-04 | Patient dashboard shows a summary of upcoming appointments | Reuse `lib/appointments.ts` `splitAppointments()` against existing `GET /api/patient/appointments` (or a lighter dashboard-scoped query) — see Architecture Patterns |
| DOCTOR-01 | Doctor dashboard shows count of upcoming appointments | Head-only count query on `appointments`/`availability_slots`, mirroring the Phase 2 admin-dashboard four-count pattern ([VERIFIED: STATE.md decision log, Plan 02-07]) |
| DOCTOR-02 | Doctor dashboard shows count of remaining available slots | Head-only count query on `availability_slots` `status='available' AND start_at > now()`, mirroring `app/api/doctor/slots/route.ts`'s existing filter shape ([VERIFIED: app/api/doctor/slots/route.ts:16-21]) |
| NOTIF-01 | Patient notified when booking confirmed | Row already inserted by `book_appointment()` ([VERIFIED: supabase/migrations/20260810120000_add_appointment_booking_functions.sql:95-96]) — this phase builds display only |
| NOTIF-02 | Patient notified when appointment cancelled | Row already inserted by `cancel_appointment()` ([VERIFIED: 20260810120000...sql:280-281]) |
| NOTIF-03 | Doctor notified when new appointment booked | Row already inserted by `book_appointment()` ([VERIFIED: 20260810120000...sql:98-101]) |
| NOTIF-04 | Patient notified when appointment rescheduled | Row already inserted by `reschedule_appointment()` ([VERIFIED: 20260810120000...sql:186-187]) |
| I18N-01 | User can switch interface between Hebrew and English | Custom `LocaleProvider` + dictionaries + cookie, per D-05 — see Architecture Patterns |
| I18N-02 | Interface layout mirrors correctly (RTL) when Hebrew is selected | `dir` attribute set server-side on `<html>` from the cookie; Tailwind logical-property invariant already established since Phase 1 ([VERIFIED: components.json `"rtl": true`]) |
</phase_requirements>

## Summary

This phase adds zero new npm dependencies — it is a composition phase over infrastructure Phases 1 and 5 already built. The `favorites` and `notifications` tables, their RLS policies, and the exact notification-insert call sites all already exist and were read directly this session (quoted below with line numbers). The three genuinely new technical surfaces are: (1) enabling and correctly filtering a Supabase Realtime `postgres_changes` subscription on `public.notifications` from a Client Component using the already-installed `@supabase/ssr` browser client; (2) a cookie-read-in-root-layout + Route-Handler-cookie-write pattern for locale persistence that respects the project's "no Server Actions" constraint; and (3) a custom (non-library) `LocaleProvider`/dictionary/`t()` system plus a realistic retrofit of ~28 existing files carrying ~189 hardcoded English strings across patient, doctor, and public pages.

One correction to CONTEXT.md's specifics section worth flagging early: the database does **not** store six distinct `notifications.type` values ("patient variant" / "doctor variant"). It stores exactly three type strings (`appointment_booked`, `appointment_rescheduled`, `appointment_cancelled`), each inserted **twice** per event — once for the patient's `user_id`, once for the doctor's `profile_id` — with a different (never-rendered) `message` per insert. Since D-03 renders from `type` alone, the dictionary must resolve to the correct patient/doctor copy using the **viewing user's own role** (`profiles.role`, already fetched by `requirePatient()`/`requireDoctor()`), not from anything stored on the notification row itself. This is a real design decision the planner must make explicit — it is documented in detail below.

**Primary recommendation:** Build all three new surfaces on existing patterns already proven in this codebase (head-only count queries from Phase 2's admin dashboard, the `requirePatient()`/`requireDoctor()` guard shape, the ownership-restatement-behind-RLS defense-in-depth rule, and the `router.push()` + `router.refresh()` pattern already used by `LogoutButton`) rather than introducing new architectural idioms.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Favorites add/remove/list | API / Backend | Database (RLS) | REST route handlers own validation + ownership restatement; `favorites_all_own` RLS is the second layer, matching the Phase 4/5 defense-in-depth precedent |
| Favorite heart toggle state | Browser / Client | API / Backend | Client Component (doctor card, doctor profile) holds optimistic toggle state; API is the source of truth on load/mismatch |
| Patient/doctor dashboard aggregates | API / Backend | Database | Count/summary queries computed server-side (head-only counts, or existing appointment list reused client-side per D-18 precedent) — never trust a client-computed count |
| Realtime notification delivery | Database (Realtime publication + RLS) | Browser / Client | Postgres's `postgres_changes` replication is the transport; RLS `notifications_select_own` is the authorization boundary evaluated server-side per subscriber, not the client-side channel filter |
| Realtime subscription lifecycle | Browser / Client | — | `@supabase/ssr` browser client in a Client Component (notification bell); must live in a component that unmounts (cleanup) and cannot live in a Server Component |
| Notification mark-as-read | API / Backend | Database (RLS) | `PATCH /api/notifications/[id]/read` restates `user_id = auth.uid()` ownership behind `notifications_update_own` RLS |
| Locale selection & persistence | Frontend Server (SSR root layout) | API / Backend (cookie write) | `app/layout.tsx` reads the cookie server-side for first-paint `lang`/`dir` (no Server Actions per project constraint, so the switcher POSTs to a Route Handler that sets the cookie) |
| `t()` translation lookup / RTL text rendering | Browser / Client + Frontend Server | — | Both Server and Client Components need `t()`; a plain dictionary lookup function has no server/client split concern (no I/O), so it can be imported in either |

## Standard Stack

### Core

No new libraries. This phase is built entirely on already-installed dependencies.

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | `2.112.0` (registry latest: `2.112.3`) [VERIFIED: npm view] | Realtime client (`.channel().on('postgres_changes', ...)`) | Already the project's DB client; Realtime is bundled, not a separate install |
| `@supabase/ssr` | `0.12.4` (registry latest: `0.12.4`, current) [VERIFIED: npm view] | Browser/server Supabase client factories already used project-wide | Already in use — `lib/supabase/client.ts` / `lib/supabase/server.ts` |
| `next` | `16.2.12` | `cookies()` in root layout for D-05; Route Handlers for the cookie-write endpoint | Already the project framework |
| `@base-ui/react` (via shadcn) | `^1.6.0`, includes `@base-ui/react/popover` already present in `node_modules` [VERIFIED: `node_modules/@base-ui/react` directory listing] | Optional notification-dropdown anchor if the planner chooses a Popover UI over reusing `Dialog` | Already a dependency; adding `components/ui/popover.tsx` via `npx shadcn add popover` generates a wrapper file, it does **not** add a new npm package |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | — | — | This phase intentionally has zero new dependencies — favorites/notifications tables, RLS, and Realtime are Supabase-native; i18n is a from-scratch custom context per project constraint (no next-intl) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Supabase Realtime `postgres_changes` (D-02 locked) | Polling (`setInterval` + `GET /api/notifications`) | Simpler, no publication/RLS-per-subscriber concerns, but explicitly rejected by D-02 to match the roadmap's literal "real-time" wording — not reversible without a rewrite |
| Supabase Realtime `postgres_changes` | Realtime Broadcast (`private` channels + Realtime Authorization RLS policies) | Broadcast scales better past ~3,000 concurrent subscribers and doesn't pay the per-subscriber authorization-check cost, but requires a separate `realtime.messages` authorization RLS policy and a `broadcast` trigger — unnecessary complexity for a demo app with a handful of concurrent users; `postgres_changes` is the simpler, directly-matching-D-02 choice |
| Custom `LocaleProvider` (D-04/D-05 implied) | `next-intl` | Explicitly rejected in PROJECT.md constraints: "next-intl écarté, pas de routing par locale nécessaire pour 2 langues statiques" |
| Cookie-based locale (D-05 locked) | `next/root-params` / `app/[lang]/layout.js` dynamic segment | Would restructure every route under a `[lang]` segment — much larger blast radius than a cookie read, and contradicts D-05's explicit cookie choice |

**Installation:**
```bash
# No installs required for this phase's core work.
# Optional, only if the planner selects a Popover-based notification dropdown:
npx shadcn add popover
```

**Version verification:** `npm view @supabase/supabase-js version` → `2.112.3` (installed: `^2.112.0`, compatible). `npm view @supabase/ssr version` → `0.12.4` (installed: exact match). Both checked live this session.

## Package Legitimacy Audit

No new external packages are introduced by this phase. All work is built on already-installed, already-vetted dependencies (`@supabase/supabase-js`, `@supabase/ssr`, `next`, `@base-ui/react` via shadcn). If the planner opts to run `npx shadcn add popover`, that command generates a source file into `components/ui/` from the already-installed `@base-ui/react` package — it does not add a new `package.json` dependency, so no legitimacy check applies.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ Browser (Client Components)                                         │
│                                                                       │
│  LanguageSwitcher ──POST /api/locale (Route Handler)──┐             │
│       │                                                 │             │
│       │ router.push('/api/locale',{method:'POST'})     │             │
│       │ .then(() => router.refresh())                   ▼             │
│       │                                    Set-Cookie: locale=he     │
│       │                                                 │             │
│  NotificationBell (Client Component)                    │             │
│       │  1. GET /api/notifications (initial load)       │             │
│       │  2. supabase.channel('notifications-<uid>')     │             │
│       │       .on('postgres_changes',                   │             │
│       │           {event:'INSERT', schema:'public',     │             │
│       │            table:'notifications',               │             │
│       │            filter:'user_id=eq.<uid>'}, cb)       │             │
│       │       .subscribe()                               │             │
│       │  3. cleanup: supabase.removeChannel() on unmount │             │
└───────┼───────────────────────────────────────────────┼─────────────┘
        │                                                 │
        ▼                                                 ▼
┌──────────────────────────┐          ┌──────────────────────────────┐
│ Next.js Route Handlers    │          │ Supabase Realtime             │
│ app/api/.../route.ts      │          │ (websocket, RLS-authorized    │
│  - requirePatient()/      │          │  per-subscriber on            │
│    requireDoctor() guard  │          │  postgres_changes)            │
│  - .eq(ownership) restate │          └───────────────┬────────────────┘
└──────────────┬─────────────┘                          │
               ▼                                         ▼
┌───────────────────────────────────────────────────────────────────┐
│ Postgres (Supabase)                                                │
│  public.favorites   (RLS: favorites_all_own)                       │
│  public.notifications (RLS: notifications_select_own/update_own,   │
│                         NO insert policy — rows only from           │
│                         SECURITY DEFINER book/cancel/reschedule)    │
│  supabase_realtime publication ── ALTER PUBLICATION ... ADD TABLE  │
│                                     public.notifications             │
└───────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ Server (Next.js) — app/layout.tsx (Root Server Component)             │
│  1. const cookieStore = await cookies()                               │
│  2. const locale = validate(cookieStore.get('locale')?.value) ?? 'en' │
│  3. <html lang={locale} dir={locale === 'he' ? 'rtl' : 'ltr'}>         │
│  4. <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>│
│     (reading cookies() here opts the whole app into dynamic          │
│      rendering — see Pitfalls)                                        │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
app/
├── layout.tsx                         # reads locale cookie, sets <html lang dir>, wraps LocaleProvider
├── api/
│   ├── locale/route.ts                # POST — sets the locale cookie (no Server Actions per project constraint)
│   ├── patient/
│   │   └── favorites/
│   │       ├── route.ts               # GET (list), POST (add)
│   │       └── [id]/route.ts          # DELETE (remove) — [id] = doctor_id or favorites row id, planner's call
│   ├── notifications/
│   │   ├── route.ts                   # GET (list own notifications)
│   │   └── [id]/read/route.ts         # PATCH (mark as read)
│   └── doctor/
│       └── dashboard-summary/route.ts # GET — counts for DOCTOR-01/02 (or inline in the page's server fetch)
├── patient/
│   ├── page.tsx                       # dashboard content (replaces or redirects — planner's call, see Discretion)
│   └── favorites/page.tsx             # PATIENT-03 list page
└── doctor/(gated)/
    └── page.tsx                       # dashboard content

components/
├── site-header.tsx                    # D-06: remove early return, add language switcher + notification bell slots
├── language-switcher.tsx              # new, "use client"
├── notification-bell.tsx              # new, "use client" — owns the Realtime subscription
└── favorite-toggle.tsx                # new, "use client" — shared by doctor card + doctor profile (D-01)

lib/
├── i18n/
│   ├── locale-provider.tsx            # "use client" React context: current locale + t()
│   ├── dictionaries.ts                # imports dictionaries/en.json, dictionaries/he.json
│   └── notification-copy.ts           # type + viewer-role → dictionary key resolver (see Pitfall 1)
└── supabase/
    └── realtime.ts                    # thin helper wrapping channel creation/cleanup, if the planner wants it centralized

dictionaries/
├── en.json
└── he.json
```

### Pattern 1: Head-only count query for dashboard aggregates

**What:** Use `.select("*", { count: "exact", head: true })` with `.eq()`/`.gt()` filters rather than fetching full rows to compute a count.
**When to use:** DOCTOR-01 (upcoming appointment count), DOCTOR-02 (remaining available slot count). PATIENT-04 can reuse the existing full-row `GET /api/patient/appointments` + client-side `splitAppointments()` since that data is already fetched for the appointments page — a head-only count is unnecessary there unless the dashboard is a separate, lighter-weight fetch.
**Example (established precedent from Phase 2, confirmed via `app/api/doctor/slots/route.ts`'s existing filter shape):**
```typescript
// DOCTOR-02: remaining available slots — same predicate shape as the
// existing GET /api/doctor/slots route (status + start_at filter),
// just requesting a count instead of rows.
const { count, error } = await guard.supabase
  .from("availability_slots")
  .select("*", { count: "exact", head: true })
  .eq("doctor_id", guard.doctorId)
  .eq("status", "available")
  .gt("start_at", new Date().toISOString());
```
Source pattern: STATE.md decision log, Plan 02-07 — "Admin dashboard reads counts via four head-only count queries through the session-bound client (not the admin client), keeping RLS a real second layer behind the layout guard." [VERIFIED: .planning/STATE.md line 127]

### Pattern 2: Notification type + viewer role → dictionary key resolution (D-03 mechanics)

**What:** `notifications.type` is one of exactly three literal strings. The patient-facing and doctor-facing copy for the *same* `type` differ, but that difference is not encoded in any column — it is implicit in which `user_id` the row belongs to. Since RLS already scopes `GET /api/notifications` to `user_id = auth.uid()`, every row returned to a given request belongs to a user of a single, already-known role (`profiles.role` is `'patient' | 'doctor' | 'admin'` [VERIFIED: supabase/migrations/20260803230000_initial_schema.sql:18 — `role text not null check (role in ('patient', 'doctor', 'admin'))`]).
**When to use:** Rendering any notification list/bell item.
**Example:**
```typescript
// lib/i18n/notification-copy.ts
// viewerRole is the CURRENT user's own role (from requirePatient()/
// requireDoctor(), never from the notification row) — a user only ever
// sees their own notifications (RLS), so their role IS the recipient role.
export function notificationDictionaryKey(
  type: "appointment_booked" | "appointment_rescheduled" | "appointment_cancelled",
  viewerRole: "patient" | "doctor",
): string {
  return `notifications.${type}.${viewerRole}`;
}
```
Verbatim confirmation of the three `type` values and their paired (patient, doctor) inserts, quoted directly from the migration:
```sql
-- book_appointment(), lines 95-101
insert into public.notifications (user_id, type, message, related_appointment_id)
values (v_patient_id, 'appointment_booked', 'Your appointment has been booked.', v_appointment_id);
insert into public.notifications (user_id, type, message, related_appointment_id)
select d.profile_id, 'appointment_booked', 'A patient booked an appointment with you.', v_appointment_id
from public.doctors d where d.id = v_doctor_id and d.profile_id is not null;

-- reschedule_appointment(), lines 186-192
insert into public.notifications (user_id, type, message, related_appointment_id)
values (v_actor_id, 'appointment_rescheduled', 'Your appointment has been rescheduled.', p_appointment_id);
insert into public.notifications (user_id, type, message, related_appointment_id)
select d.profile_id, 'appointment_rescheduled', 'A patient rescheduled their appointment.', p_appointment_id
from public.doctors d where d.id = v_appt.doctor_id and d.profile_id is not null;

-- cancel_appointment(), lines 275-281
insert into public.notifications (user_id, type, message, related_appointment_id)
select v_doctor_profile_id, 'appointment_cancelled', 'A patient cancelled their appointment.', p_appointment_id
where v_doctor_profile_id is not null;
insert into public.notifications (user_id, type, message, related_appointment_id)
values (v_patient_id, 'appointment_cancelled', 'Your appointment was cancelled by the doctor.', p_appointment_id);
```
[VERIFIED: supabase/migrations/20260810120000_add_appointment_booking_functions.sql:95-101,186-192,275-281]

Note the asymmetry: `reschedule_appointment()`'s patient-side notification uses `v_actor_id` (line 187), not `v_patient_id` — because only the patient can reschedule, `v_actor_id` is always the patient in that function, so this is not a bug, just worth the planner knowing the variable naming differs from `cancel_appointment()`'s explicit `v_patient_id`/`v_doctor_profile_id` split (since either party can cancel).

### Pattern 3: Realtime `postgres_changes` migration + client hook

**What:** Enabling Realtime replication and subscribing from a Client Component.
**When to use:** NOTIF-01 through NOTIF-04 (D-02).

**Migration SQL** (new migration file, e.g. `supabase/migrations/<timestamp>_enable_notifications_realtime.sql`):
```sql
-- Adds public.notifications to the Realtime publication so postgres_changes
-- events are broadcast for this table. No REPLICA IDENTITY change needed —
-- default (primary key) replica identity is sufficient for INSERT/UPDATE;
-- FULL is only required for DELETE events carrying old-row data, and this
-- app never deletes notifications rows.
alter publication supabase_realtime add table public.notifications;
```
[CITED: supabase.com/docs/guides/realtime/postgres-changes — "alter publication supabase_realtime add table your_table_name;"]

**RLS and Realtime Authorization:** Confirmed current behavior — "Postgres Changes authorizes every event against each subscriber," i.e. RLS `SELECT` policies (here, `notifications_select_own`, quoted below) are evaluated **per subscriber, per event**, server-side, regardless of what client-side filter was passed to `.on()`. A client-side filter (`user_id=eq.<uid>`) is a performance/noise optimization, not the authorization boundary — but it is still required in practice, because without it the client would receive (and RLS would authorize, since it IS their own row) every notification event system-wide that happens to pass RLS, which for a `user_id = auth.uid()` policy correctly means "only ever their own rows anyway." In other words: for this specific table (`user_id = auth.uid()` is the entire policy), RLS alone already scopes delivery to the caller's own notifications even if the `.on()` filter were omitted — the filter is still recommended for defense-in-depth and to make the subscription explicit/self-documenting. [CITED: supabase.com/docs/guides/realtime/postgres-changes]

**Caveat:** RLS is **not** applied to DELETE events (Postgres cannot re-check access to a row that no longer exists). Not a concern here — this app never deletes `notifications` rows. [CITED: supabase.com/docs/guides/realtime/postgres-changes]

Verbatim current RLS policies on `notifications` (no separate authorization work needed for this phase — already deployed):
```sql
-- notifications: readable/markable-as-read by the recipient only.
-- No insert policy: notifications are always created server-side via the
-- service_role client (a user should never be able to write into another
-- user's notification feed).
create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());

create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid());
```
[VERIFIED: supabase/migrations/20260803230000_initial_schema.sql:267-275]

**Client-side subscription hook shape** (Client Component, e.g. `components/notification-bell.tsx`):
```typescript
"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client"; // existing createBrowserClient wrapper

export function useNotificationRealtime(userId: string | null, onInsert: (row: NotificationRow) => void) {
  useEffect(() => {
    if (!userId) return; // do not subscribe for anonymous visitors (D-06: header renders for logged-out users too)

    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => onInsert(payload.new as NotificationRow),
      )
      .subscribe();

    // Cleanup on unmount — required, or the websocket subscription and its
    // closure leak across every navigation that unmounts/remounts the bell.
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, onInsert]);
}
```
[CITED: supabase.com/docs/guides/realtime/postgres-changes — channel/filter/`removeChannel` shape confirmed against the official example]

**Auth token refresh for the Realtime connection:** `createBrowserClient` (from `@supabase/ssr`, already in use) wraps the standard `supabase-js` `SupabaseClient`, whose internal auth-state listener calls `realtime.setAuth()` automatically on `TOKEN_REFRESHED` — no manual `supabase.realtime.setAuth(token)` call is required for the common case. A known edge case exists where a tab backgrounded/offline for a long time can miss a refresh and the Realtime connection disconnects when its cached JWT expires (reconnecting on next `subscribe()`/focus); this is a pre-existing `realtime-js` behavior, not something to hand-roll around for a demo app. [CITED: github.com/supabase/realtime-js issue #274 discussion + supabase-js `onAuthStateChange`/`setAuth` reference docs — MEDIUM confidence, community-sourced explanation of internal behavior, not an official docs page]

### Pattern 4: Locale cookie read (root layout) + Route Handler cookie write + `router.refresh()`

**What:** D-05's cookie-first-paint mechanics, respecting the "no Server Actions" project constraint.
**When to use:** I18N-01/02, all pages.

`cookies()` is confirmed (Next.js 16.3 docs, matching this project's installed `16.2.12`) to be:
- an **async** function — `const cookieStore = await cookies()` (already the pattern in `lib/supabase/server.ts:5` [VERIFIED])
- readable in a Server Component (root layout qualifies)
- **not** settable during Server Component render — `.set()` is only valid in a Server Function (excluded by project constraint) or a **Route Handler**, which is exactly this project's established pattern
- a **Request-time API**: "Using it in a layout or page will opt a route into dynamic rendering" — reading the locale cookie in the root layout makes the **entire app** dynamically rendered per-request (see Pitfalls)

[CITED: nextjs.org/docs/app/api-reference/functions/cookies, version 16.3.0, lastUpdated 2026-06-09]

```typescript
// app/layout.tsx (Server Component)
import { cookies } from "next/headers";

const SUPPORTED_LOCALES = ["en", "he"] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

function readLocale(value: string | undefined): Locale {
  return SUPPORTED_LOCALES.includes(value as Locale) ? (value as Locale) : "en";
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const locale = readLocale(cookieStore.get("locale")?.value);
  const dir = locale === "he" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} className={/* existing font vars */}>
      <body className="min-h-full flex flex-col">
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
```

```typescript
// app/api/locale/route.ts — Route Handler, not a Server Action (project constraint)
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const { locale } = await request.json();
  if (locale !== "en" && locale !== "he") {
    return NextResponse.json({ error: "Invalid locale." }, { status: 400 });
  }
  const cookieStore = await cookies();
  cookieStore.set("locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return NextResponse.json({ ok: true });
}
```

```typescript
// components/language-switcher.tsx — "use client"
// Mirrors the existing LogoutButton pattern exactly: fetch a Route Handler,
// then router.push (if needed) + router.refresh() to force the server
// (including the root layout) to re-render with the new cookie value.
// [VERIFIED pattern precedent: components/logout-button.tsx:19-28]
"use client";
import { useRouter } from "next/navigation";

export default function LanguageSwitcher({ current }: { current: "en" | "he" }) {
  const router = useRouter();
  async function switchTo(locale: "en" | "he") {
    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    });
    router.refresh(); // re-runs Server Components (incl. root layout) for the current URL, picking up the new cookie
  }
  // ... render toggle/buttons calling switchTo("en") / switchTo("he")
}
```

`router.refresh()` re-fetches the current route's Server Component tree (including the root layout) from the server without a full page reload or loss of client-side state elsewhere on the page — this is the standard App Router mechanism for "server data changed, re-render Server Components in place," and is already the exact pattern this codebase uses after logout (`router.push("/"); router.refresh();`). [CITED: general Next.js App Router `router.refresh()` semantics, consistent with the already-verified codebase precedent]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Realtime delivery/polling | A `setInterval` poller or a custom SSE endpoint | Supabase `postgres_changes` (D-02 locked) | Already the locked decision; Postgres logical replication + RLS-authorized broadcast is battle-tested infrastructure, not worth re-deriving |
| Realtime authorization | A custom "only return rows where user_id matches" filter re-implemented app-side on top of an unauthenticated firehose | RLS `notifications_select_own`, already deployed | RLS is evaluated server-side per subscriber before the event ever reaches the client — trying to filter client-side after the fact would be both redundant and a strictly weaker security boundary |
| Locale detection/negotiation | `Accept-Language` header parsing, locale-prefixed routing (`/en/...`, `/he/...`) | Cookie read in root layout (D-05 locked) | Explicitly out of scope — "pas de routing par locale nécessaire pour 2 langues statiques" (PROJECT.md) |
| Translation string management | A full i18n library (ICU MessageFormat, pluralization engines, `next-intl`) | Flat JSON dictionaries + a `t(key)` lookup function | Explicitly rejected in PROJECT.md constraints; 2 static languages, no runtime locale routing needed |
| Dashboard count correctness | Fetching all rows client-side and `.length`-ing them | `.select("*", { count: "exact", head: true })` server-side query | Already the established Phase 2 admin-dashboard pattern; avoids shipping full row payloads just to display an integer |

**Key insight:** Every "hard part" of this phase (double-booking-safe writes, RLS ownership, the notification insert call sites) was already solved in Phases 1 and 5. The actual net-new engineering here is thin: wire Realtime's publication + a subscription hook, wire a cookie + a `t()` function, and retrofit strings. Resist the urge to introduce new abstractions (a generic pub/sub layer, a full i18n framework) for what is fundamentally three small, well-precedented additions.

## Common Pitfalls

### Pitfall 1: Treating `notifications.type` as sufficient to pick display copy
**What goes wrong:** Rendering `t(\`notifications.${row.type}\`)` directly produces the wrong copy for one of the two recipients, because both the patient-facing and doctor-facing rows for the same event share the same `type` string (verified above — `appointment_booked` is inserted twice with different `message` text but identical `type`).
**Why it happens:** D-03's phrasing ("`type` column mapped to a dictionary key") reads as if `type` alone is the key, but the DB schema doesn't carry a role discriminator on the row.
**How to avoid:** Resolve the dictionary key from `type` **and** the current viewer's own role (`profiles.role`, already available from `requirePatient()`/`requireDoctor()` — a user only ever sees their own notifications via RLS, so their role is definitionally the recipient role for every row they can see). See Pattern 2.
**Warning signs:** A doctor's notification bell showing "Your appointment has been booked" (patient-voiced copy) instead of "A patient booked an appointment with you."

### Pitfall 2: Forgetting the Realtime publication migration
**What goes wrong:** The subscription hook connects and never fires — no error, just silence — because `public.notifications` was never added to `supabase_realtime`.
**Why it happens:** RLS being correctly configured (it already is) is a separate concern from replication being enabled for the table; both are required.
**How to avoid:** Include `alter publication supabase_realtime add table public.notifications;` as an explicit migration (Pattern 3) and verify with a manual insert-and-observe test before wiring the UI.
**Warning signs:** `GET /api/notifications` returns the row (RLS works), but the bell never updates live.

### Pitfall 3: `cookies()` in the root layout makes the whole app dynamic
**What goes wrong:** Reading the locale cookie in `app/layout.tsx` (required by D-05) opts every route in the app into per-request dynamic rendering — including `/login`, which a prior phase's plan deliberately wrapped in `Suspense` specifically to keep it statically prerendering at build time ([VERIFIED: .planning/STATE.md — "app/login/page.tsx wraps its useSearchParams()-consuming form in a Suspense boundary so /login still statically prerenders at build time"]).
**Why it happens:** `cookies()` is documented as a "Request-time API" that opts its route into dynamic rendering the moment it's called anywhere in that route's Server Component tree, and the root layout wraps every route. [CITED: nextjs.org/docs/app/api-reference/functions/cookies]
**How to avoid:** This is an accepted, unavoidable tradeoff of D-05 (no simpler cookie-based alternative avoids it) — not a defect to "fix." Flag it explicitly to the planner as an intentional behavior change from static to dynamic rendering for every route, and confirm it doesn't regress any performance requirement (none exists in REQUIREMENTS.md for this demo app). No action needed beyond awareness; do not attempt to work around it with client-only locale detection, which would reintroduce the RTL flash D-05 exists to prevent.
**Warning signs:** Build output previously showing `/login` as `○ (Static)` now showing `ƒ (Dynamic)` — expected, not a bug.

### Pitfall 4: Validation error messages are hardcoded English literals, not keys
**What goes wrong:** `lib/validation/*.ts` functions (e.g. `validateEmail`, `validatePassword`) return literal English strings directly (`"Email is required."`), not error codes [VERIFIED: lib/validation/auth.ts:6,8,13,14,19 — `"Email is required."`, `"Invalid email format."`, `"Password is required."`, `"Password must be at least 6 characters."`, `"Full name is required."`]. D-04's scope explicitly includes login/signup pages, which surface these exact strings to the user. There is no existing mechanism to translate a return value that is already rendered English prose.
**Why it happens:** These functions predate this phase and were written under the "manual TS validation, no schema library" constraint without an i18n concern in view. The codebase's own established precedent (`FIELD_BY_MESSAGE` lookup in the admin doctor form, per STATE.md Plan 02-01) already keys off the literal message string for a different purpose (mapping a message to a form field), confirming this message-as-identifier pattern is the existing idiom here.
**How to avoid:** This needs an explicit planning decision (not resolved by CONTEXT.md's Claude's Discretion list) — either (a) add a message-string → dictionary-key lookup table mirroring the existing `FIELD_BY_MESSAGE` idiom, translating at the render boundary without touching `lib/validation/*.ts`, or (b) refactor `validate*()` to return a stable code (`"EMAIL_REQUIRED"`) and let both the API JSON response and the client map code → `t(code)`. Option (a) is lower-risk (zero changes to already-tested validation functions and their route call sites) and matches the codebase's existing precedent; recommend flagging this explicitly for the planner to lock in Task 1, not leaving it implicit.
**Warning signs:** Signup/login form validation errors staying in English even after the rest of the page translates.

### Pitfall 5: No dropdown/popover shadcn component installed yet
**What goes wrong:** Planning a "notification bell dropdown" assuming a `Popover`/`DropdownMenu` component already exists in `components/ui/` — it does not. Installed `components/ui/`: `alert, badge, button, card, dialog, input, label, select, skeleton, switch, table, textarea` [VERIFIED: `ls components/ui/` this session]. `@base-ui/react/popover` exists in `node_modules` (bundled with the already-installed `@base-ui/react` package) but no shadcn wrapper file has been generated yet.
**How to avoid:** Either run `npx shadcn add popover` (or `dropdown-menu`) to generate the wrapper component, or reuse the already-present `Dialog` pattern (as every other modal-like UI in this codebase does — cancel/reschedule dialogs) for the notification list, avoiding a new component generation step entirely. Both are valid; this is explicitly left to Claude's Discretion in CONTEXT.md ("Exact mark-as-read interaction... left to the planner"), but the planner should pick one explicitly rather than assume a component exists.

### Pitfall 6: Duplicated `LANGUAGE_LABELS` maps will silently miss translation
**What goes wrong:** The literal `{ he: "Hebrew", en: "English" }` label map exists independently in at least two files — `components/search/doctor-card.tsx:30` and `app/doctors/[id]/page.tsx:23` [VERIFIED, both Read this session]. If only one is updated to route through `t()`, the other silently stays hardcoded English even after the rest of the page is translated.
**How to avoid:** Consolidate into a single dictionary-driven helper (e.g. `t("languages.he")` / `t("languages.en")`) during the retrofit, imported by both call sites, rather than leaving two independent literal maps.

### Pitfall 7: RTL is untested until this phase — physical-direction Tailwind classes will only break visibly in Hebrew
**What goes wrong:** The project has used only logical properties (`ps-`, `pe-`, `ms-`, `me-`, `text-start`, `text-end`) since Phase 1 by convention, but this is the first phase where `dir="rtl"` is actually exercised at runtime — any missed physical-direction class (`pl-`, `pr-`, `ml-`, `mr-`, `text-left`, `text-right`, `left-`, `right-`) will render correctly in English (LTR, the only mode tested so far) and visibly mirror-broken only once Hebrew is selected.
**How to avoid:** Run a targeted grep audit (`pl-|pr-|ml-|mr-|text-left|text-right`) across `app/` and `components/` as a verification step before closing this phase, not just relying on the "we've always used logical properties" convention holding for 5 phases of code nobody RTL-tested.
**Warning signs:** Icons/badges/buttons appearing to hug the wrong edge only when Hebrew is active.

## Runtime State Inventory

Not applicable — this is a feature-addition phase (new tables' RLS/schema already deployed in Phase 1; new UI/API surfaces built on top), not a rename/refactor/migration phase. No existing runtime state needs to change identity.

## Code Examples

### Favorite toggle — ownership-restated DELETE (mirrors established `app/api/doctor/slots/[id]/route.ts` precedent)

```typescript
// app/api/patient/favorites/[id]/route.ts
// [id] = the doctors.id being un-favorited, matching D-01's toggle-by-doctor-id UX.
import { NextResponse } from "next/server";
import { requirePatient } from "@/lib/auth/require-patient";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePatient();
  if (!guard.ok) return guard.response;
  const { id: doctorId } = await params;

  // Mandatory app-level restatement of favorites_all_own RLS (D-20 precedent)
  // — never rely on RLS alone. Delete-by-composite-key rather than a
  // favorites.id lookup avoids a round trip to resolve the row id first.
  const { error, count } = await guard.supabase
    .from("favorites")
    .delete({ count: "exact" })
    .eq("patient_id", guard.userId)
    .eq("doctor_id", doctorId);

  if (error) {
    return NextResponse.json({ error: "Could not remove this favorite. Please try again." }, { status: 500 });
  }
  if (count === 0) {
    return NextResponse.json({ error: "This doctor is not in your favorites." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
```

### Notification list GET (RLS-scoped, mirrors `app/api/patient/appointments/route.ts` shape)

```typescript
// app/api/notifications/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  // .eq("user_id", user.id) restates notifications_select_own RLS.
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, related_appointment_id, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Could not load notifications. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ notifications: data });
}
```
Note: `message` is deliberately **not** selected — D-03 requires it never be rendered, so omitting it from the API response entirely (rather than fetching-and-ignoring) is the stronger guarantee against an accidental future render.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Realtime Broadcast requiring manual `broadcast` triggers for row-change fan-out | `postgres_changes` with per-subscriber RLS authorization (this phase's approach) is the direct, no-trigger path for "notify the owning row's user" | Ongoing Supabase Realtime evolution — Realtime Authorization / private channels is the newer recommended pattern **for Broadcast**, not a replacement requirement for `postgres_changes` | `postgres_changes` remains fully supported and is the right fit for this phase's scale (small number of concurrent users); Broadcast is Supabase's recommendation only past ~3,000 concurrent subscribers |
| `cookies()` synchronous (Next.js ≤14) | `cookies()` async, `await`-required (Next.js 15+) | Next.js 15.0.0-RC | Already correctly handled everywhere in this codebase (`lib/supabase/server.ts` already awaits it) — the new locale-read code must follow the same pattern |

**Deprecated/outdated:** None directly relevant — no APIs used by this phase are deprecated in the installed versions.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `createBrowserClient`'s realtime auth token refresh is automatic via the internal `supabase-js` auth listener, with no manual `setAuth()` call needed for the common case | Architecture Patterns, Pattern 3 | If wrong, a long-lived notification bell session could silently stop receiving events after token expiry with no visible error; mitigation is cheap (add an explicit `onAuthStateChange` → `realtime.setAuth()` listener) if observed during manual/E2E testing |
| A2 | `router.refresh()` re-renders the root layout's Server Component tree (not just the leaf page) for the current route, picking up the new locale cookie | Architecture Patterns, Pattern 4 | If wrong (e.g. root layout output is cached independently of the leaf route under some Next.js 16 Cache Components configuration not otherwise exercised by this project), the language switcher would need a hard `window.location.reload()` fallback instead — low risk since this project's `use cache`/Cache Components directives are not currently used anywhere in the codebase (unverified negative — not explicitly grepped this session) |
| A3 | Message-string-based dictionary lookup (Pitfall 4, option a) is the recommended retrofit approach for validation error translation, rather than refactoring `validate*()` to return codes | Common Pitfalls, Pitfall 4 | If the planner instead chooses code-based refactoring, every route handler consuming `validate*()` return values needs a matching update — larger blast radius than assumed here; this is presented as a recommendation, not a locked decision, precisely because it wasn't in CONTEXT.md's Claude's Discretion list |

## Open Questions

1. **Does `/patient/dashboard` and `/doctor/dashboard` replace the existing placeholder pages in place, or become new sibling routes?**
   - What we know: CONTEXT.md explicitly defers this to Claude's Discretion; `app/patient/page.tsx` and `app/doctor/(gated)/page.tsx` currently render "Nothing here yet" placeholders [VERIFIED, both Read this session].
   - What's unclear: Whether TASKS.md's literal `/patient/dashboard` / `/doctor/dashboard` paths (referenced in CONTEXT.md but not read this session — file not in the required-reads list) mean new routes distinct from `/patient` and `/doctor`, or are shorthand for "the patient/doctor home base," i.e. the existing index routes.
   - Recommendation: Read `TASKS.md` at planning time (it's a canonical ref per CONTEXT.md but wasn't in this research's required file list) before locking the routing decision; absent a strong signal there, replacing the existing placeholder content in place (`app/patient/page.tsx`, `app/doctor/(gated)/page.tsx`) is the simpler choice with zero new route/proxy-matcher considerations.

2. **Should the dashboard's "upcoming appointments" fetch be a new lightweight endpoint or reuse `GET /api/patient/appointments` client-side?**
   - What we know: `GET /api/patient/appointments` already returns full appointment history with embedded slot/doctor data, and `lib/appointments.ts`'s `splitAppointments()` already computes the upcoming/past split client-side (D-18 precedent).
   - What's unclear: Whether a dashboard "summary" (PATIENT-04) implies just the count + next appointment, or a richer list — REQUIREMENTS.md only says "shows a summary of upcoming appointments," which is satisfied by reusing the existing endpoint and just rendering fewer rows/a count from the already-split `upcoming` array.
   - Recommendation: Reuse the existing endpoint (no new route) unless the UI-SPEC (if one exists for this phase) demands a payload shape the existing endpoint can't cheaply provide.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase project with Realtime enabled | NOTIF-01–04 (D-02) | ✓ | `[realtime] enabled = true` in local `supabase/config.toml` [VERIFIED] | — |
| `supabase_realtime` publication containing `public.notifications` | NOTIF-01–04 | ✗ (not yet added — confirmed via `grep -rn "publication\|realtime"` across `supabase/`, no `ALTER PUBLICATION` statement found in any existing migration) | — | New migration required (Pattern 3) — this is expected, in-scope work for this phase, not a missing external dependency |
| `@base-ui/react/popover` (if Popover UI chosen) | Notification bell UI (optional) | ✓ | bundled with installed `@base-ui/react` `^1.6.0` | Reuse existing `Dialog` component instead (zero new generation step) |

**Missing dependencies with no fallback:** none — the Realtime publication entry is in-scope work for this phase's own migration, not an external blocker.
**Missing dependencies with fallback:** `@base-ui/react/popover` wrapper not yet generated as a shadcn component — fallback is reusing `Dialog`, already available.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright `1.62.1` [VERIFIED: package.json] |
| Config file | `playwright.config.ts` (testDir `./tests/e2e`, single chromium project, `webServer` auto-starts `npm run dev`) [VERIFIED: Read this session] |
| Quick run command | `npx playwright test tests/e2e/<file>.spec.ts` |
| Full suite command | `npx playwright test` (per `.planning/config.json` `workflow.test_command`) [VERIFIED] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PATIENT-01/02/03 | Add/remove/list favorites, reflected in both entry points (D-01) | e2e | `npx playwright test tests/e2e/patient-favorites.spec.ts` | ❌ Wave 0 |
| PATIENT-04 | Dashboard shows upcoming appointment summary | e2e | `npx playwright test tests/e2e/patient-dashboard.spec.ts` | ❌ Wave 0 |
| DOCTOR-01/02 | Dashboard shows upcoming count + available-slot count | e2e | `npx playwright test tests/e2e/doctor-dashboard.spec.ts` | ❌ Wave 0 |
| NOTIF-01–04 | Live in-app notification on booking/cancel/reschedule, both roles | e2e (requires asserting a live UI update without reload — Playwright's auto-retrying `expect()` polling is sufficient, no manual `sleep`) | `npx playwright test tests/e2e/notifications-realtime.spec.ts` | ❌ Wave 0 |
| I18N-01/02 | Switch locale from any page; RTL mirroring correct | e2e | `npx playwright test tests/e2e/locale-switching.spec.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the relevant new spec file(s) for that task, run in isolation
- **Per wave merge:** full suite (`npx playwright test`) to catch cross-cutting regressions — notably, the D-04 retrofit touches ~28 existing files whose existing specs (28 spec files already exist covering Phases 1-5 flows) must still pass after strings are extracted to `t()` calls
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/e2e/patient-favorites.spec.ts` — PATIENT-01/02/03, both entry points (D-01)
- [ ] `tests/e2e/patient-dashboard.spec.ts` — PATIENT-04
- [ ] `tests/e2e/doctor-dashboard.spec.ts` — DOCTOR-01/02
- [ ] `tests/e2e/notifications-realtime.spec.ts` — NOTIF-01–04, must assert live update (no reload) via a second browser context or a service-role fixture insert while the first context's bell is mounted
- [ ] `tests/e2e/locale-switching.spec.ts` — I18N-01/02, assert `dir="rtl"` and `lang="he"` on `<html>` after switching, and no wrong-direction flash on a fresh navigation (cookie already set)
- [ ] `tests/e2e/helpers/favorites.ts` — new fixture helper (service-role insert/cleanup), mirroring `tests/e2e/helpers/appointments.ts`'s existing pattern [VERIFIED: tests/e2e/helpers/appointments.ts]
- [ ] `tests/e2e/helpers/notifications.ts` — new fixture helper for asserting/seeding notification rows via `testAdminClient()`, same pattern

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth surfaces this phase |
| V3 Session Management | no | Realtime token refresh relies on existing session management (Pattern 3, A1) — no new session logic introduced |
| V4 Access Control | yes | `requirePatient()`/`requireDoctor()` guards + ownership-restatement (`.eq("patient_id"/"user_id", guard.userId)`) behind RLS for every new route (favorites CRUD, notifications GET/PATCH) — same established defense-in-depth pattern as Phases 2/4/5 |
| V5 Input Validation | yes | Manual TS validation functions (project constraint, no Zod) for the locale POST body (`en`/`he` allow-list) and any favorites/notifications route bodies |
| V6 Cryptography | no | No new cryptographic operations — Realtime channel auth reuses the existing Supabase session JWT, not a new crypto surface |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on `DELETE /api/patient/favorites/[id]` or `PATCH /api/notifications/[id]/read` (caller supplies another user's id) | Tampering / Elevation of Privilege | App-level `.eq(ownership_column, guard.userId)` restatement behind `favorites_all_own`/`notifications_update_own` RLS — same pattern as every existing mutating route in this codebase (D-20 precedent); a 404 (not 403) response for a foreign id, matching the existing "never confirm another party's id is real" convention from Phase 5 |
| A malicious/garbage `locale` cookie value crashing the root layout or bypassing the `en`/`he` allow-list | Tampering | `readLocale()` (Pattern 4) validates against a fixed allow-list and falls back to `"en"` — never trust the cookie value directly as `lang`/`dir` input |
| Realtime channel filter spoofing (client claims a different `user_id` in its own `.on()` filter) | Elevation of Privilege / Information Disclosure | Not exploitable: `notifications_select_own` RLS re-authorizes every event server-side per subscriber regardless of the client-supplied filter string — the filter only reduces noise, it is never the security boundary (confirmed above, Pattern 3) |
| Stored `notifications.message` (server-authored English text) being rendered directly, defeating D-03's translation and potentially leaking internal phrasing | Information Disclosure (minor) | `GET /api/notifications` deliberately omits `message` from its `select()` entirely (Code Examples) rather than fetching-and-discarding it client-side |
| XSS via dictionary string interpolation (e.g., inserting a doctor's `full_name` into a translated notification/dashboard string) | Tampering / Injection | Always interpolate as a React child (`{t("x")} {doctorName}` or `t()` returning a template with a typed placeholder rendered as JSX), never via `dangerouslySetInnerHTML` — no different from the existing project-wide convention, just worth restating since this phase introduces the first template-with-interpolation strings (`t("notifications.appointment_booked.patient")` is static, but any future "Dr. {name} confirmed..." style string would need this care) |

## Sources

### Primary (HIGH confidence)
- Direct `Read` of `supabase/migrations/20260803230000_initial_schema.sql` (favorites/notifications schema, RLS policies, profiles.role constraint)
- Direct `Read` of `supabase/migrations/20260810120000_add_appointment_booking_functions.sql` (exact notification type/message inserts)
- Direct `Read` of `components/site-header.tsx`, `lib/timezone.ts`, `app/patient/page.tsx`, `app/doctor/(gated)/page.tsx`, `app/patient/appointments/page.tsx`, `app/doctor/(gated)/appointments/page.tsx`, `app/doctors/[id]/page.tsx`, `lib/appointments.ts`, `lib/auth/require-patient.ts`, `lib/auth/require-doctor.ts`, `lib/supabase/client.ts`, `lib/supabase/server.ts`, `app/layout.tsx`, `components/logout-button.tsx`, `lib/validation/auth.ts`, `components/search/doctor-card.tsx`, `app/api/patient/appointments/route.ts`, `app/api/doctor/slots/route.ts`, `package.json`, `components.json`
- `npm view @supabase/supabase-js version` / `npm view @supabase/ssr version` (live registry check)

### Secondary (MEDIUM confidence)
- supabase.com/docs/guides/realtime/postgres-changes (publication SQL, RLS-per-subscriber authorization, DELETE-events caveat, filter/subscription code shape) — fetched live this session
- nextjs.org/docs/app/api-reference/functions/cookies (async `cookies()`, dynamic-rendering opt-in, Server-Function/Route-Handler-only `.set()`) — fetched live this session, version 16.3.0 matches installed `16.2.12`

### Tertiary (LOW confidence)
- GitHub discussion/issue threads on `supabase-js` realtime token refresh internals (A1) — community-sourced explanation of internal `setAuth()` auto-refresh behavior, not an official docs page; flagged in Assumptions Log

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all versions live-verified against the registry
- Architecture: MEDIUM-HIGH — codebase touchpoints are directly Read and quoted; Realtime/cookie mechanics are CITED from official docs fetched this session, not from training memory alone
- Pitfalls: HIGH — every pitfall traces to a directly-verified codebase fact (exact type values, exact validation strings, exact component inventory) rather than speculation

**Research date:** 2026-08-11
**Valid until:** 2026-09-10 (30 days — stable stack, no fast-moving dependencies; re-verify Supabase Realtime docs if the Realtime Authorization/Broadcast migration path changes, as that area is actively evolving)
