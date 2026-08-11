# Phase 6: Dashboards, Notifications & Localization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-11
**Phase:** 6-dashboards-notifications-localization
**Areas discussed:** Favorites entry point, Real-time notifications, Notification message translation, i18n scope, Locale persistence & RTL rendering, Header for public + authenticated pages

---

## Favorites entry point

| Option | Description | Selected |
|--------|-------------|----------|
| Heart icon on doctor profile | On `/doctors/[id]` next to name/specialty. Simple, one place to maintain. | |
| Heart icon on search results | On each result card in `/doctors` search list — favorite without opening the profile. | |
| Both | Heart toggle on both profile and search result cards, synced state. | ✓ |

**User's choice:** Both
**Notes:** Neither existed in the code yet — this closed a real gap in TASKS.md, which only specified the API and the favorites list page, not the entry point UI.

---

## Real-time notifications

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase Realtime (live push) | `postgres_changes` subscription on `notifications` — bell updates live, no refresh. Matches roadmap's literal "real-time" wording; adds a technical layer (replication, subscription management). | ✓ |
| Fetch on load + light polling | Bell updates on page load and via interval (30-60s) or navigation. Simpler, no new infra. | |
| Fetch on load only | Bell reflects state as of last page load/navigation. Simplest, most consistent with the rest of the project's plain-REST approach. | |

**User's choice:** Supabase Realtime (vrai live push)
**Notes:** Chosen to be faithful to the roadmap goal's literal "real-time in-app updates" wording rather than treating it as loose phrasing.

---

## Notification message translation

| Option | Description | Selected |
|--------|-------------|----------|
| Translate via `type` | Ignore stored `message` for display; map `type` to a dictionary key. Stored text becomes fallback/log only. | ✓ |
| Always English | Stored text shown as-is regardless of chosen UI language. Simpler but breaks "fully bilingual" for this area. | |

**User's choice:** Traduire via le `type` (recommandé)
**Notes:** The stored `message` text is hardcoded English, written by Phase 5's `book_appointment`/`cancel_appointment`/`reschedule_appointment` SQL functions — it was never designed with i18n in mind.

---

## i18n scope

| Option | Description | Selected |
|--------|-------------|----------|
| Patient + Doctor + public only | Admin stays English-only — internal/demo-only role, never seen by an end user. | ✓ |
| Whole app, admin included | Full translation including `/admin/*` — more work, nothing left untranslated. | |

**User's choice:** Patient + Doctor + public uniquement (recommandé)
**Notes:** TASKS.md's "retroactively covering phases 1-5" wording was interpreted to mean patient/doctor/public phases, not the admin phase (Phase 2).

---

## Locale persistence & RTL rendering

| Option | Description | Selected |
|--------|-------------|----------|
| Cookie, read server-side | Root layout reads a `locale` cookie and sets `dir`/`lang` on first render — no flash. Switcher writes the cookie then refreshes. | ✓ |
| localStorage, client-applied | Simpler to code, no server read, but a brief LTR/English flash is possible before client JS applies the stored locale. | |

**User's choice:** Cookie, lu côté serveur (recommandé)
**Notes:** Root layout (`app/layout.tsx`) is a Server Component that must set `dir`/`lang` on `<html>` — a cookie avoids any SSR/CSR mismatch flash.

---

## Header for public + authenticated pages

| Option | Description | Selected |
|--------|-------------|----------|
| SiteHeader always rendered | Even logged out, header shows logo + switcher; logged in, adds name/bell/logout as today. One component everywhere. | ✓ |
| Two distinct headers | Minimal public header (logo + switcher) for unauthenticated pages, enriched SiteHeader (with bell) for authenticated zones. More code, clean separation. | |

**User's choice:** SiteHeader toujours rendu (recommandé)
**Notes:** `SiteHeader` currently returns `null` when no user is logged in — this closes that gap so the language switcher is reachable from every page, including `/login` and `/doctors`.

---

## Claude's Discretion

- Exact Postgres Realtime setup mechanics (enabling the publication, RLS-aware channel filtering, client subscription hook shape).
- Whether `/patient/dashboard` and `/doctor/dashboard` replace the existing placeholder pages in place or are added as new sibling routes.
- Exact mark-as-read interaction (auto on dropdown open vs. per-item click) and unread-badge styling.
- Exact dashboard card layout/composition beyond what TASKS.md already specifies.
- Dictionary key naming convention for `dictionaries/en.json` / `dictionaries/he.json`.

## Deferred Ideas

None — discussion stayed within phase scope.
