---
phase: quick-260817-fhm
plan: 01
subsystem: frontend
tags: [i18n, rtl, notifications, admin, playwright]

requires:
  - phase: 06-dashboards-notifications-localization
    provides: notification-bell popover, lib/i18n locale-provider + dictionaries, admin oversight pages
provides:
  - notification unread badge/dots clear in-session when the bell popover opens (no reload needed)
  - specialty names render in the active locale (Hebrew/English) on every patient/doctor-facing surface
  - admin appointments doctor filter goes through the admin-gated API route, with a visible load-error + retry state
  - "with Dr. Dr. {name}" duplicate title removed from patient dashboard and appointment history
affects: [security-review, phase-06-verification]

actuals:
  tokens: 0
  tasks: 4
  commits: 4

tech-stack:
  added: []
  patterns:
    - "lib/i18n/specialty.ts: a locale-aware label resolver taking bare name_en/name_he strings (not a row object), so both the flat search-view shape and the nested/nullable join shape can call it identically after their own existing null guard"
    - "Client-side re-sort with localeCompare when swapping a direct table query for a REST route whose ORDER BY differs from the UI's expected order"

key-files:
  created:
    - lib/i18n/specialty.ts
  modified:
    - components/notification-bell.tsx
    - app/doctors/[id]/page.tsx
    - app/patient/favorites/page.tsx
    - components/doctor-request-dialog.tsx
    - components/search/doctor-card.tsx
    - components/search/search-filters.tsx
    - app/admin/appointments/page.tsx
    - dictionaries/en.json
    - dictionaries/he.json
    - tests/e2e/admin-oversight-views.spec.ts
    - tests/e2e/locale-switching.spec.ts
    - tests/e2e/notifications-realtime.spec.ts

key-decisions:
  - "with_doctor_prefix dictionary values changed from 'with Dr.'/'אצל ד״ר' to bare 'with'/'אצל' rather than stripping 'Dr.' from full_name — every doctor's stored full_name already includes the title and every other surface in the app (search cards, profile page, favorites) displays full_name raw with no separate prefix, so this keeps the fix consistent with the rest of the app instead of introducing a second, inconsistent naming convention"
  - "Admin surfaces (app/admin/appointments/page.tsx and the rest of the admin UI) intentionally left English-only — the admin UI has zero t() calls by construction; specialty localization was scoped to patient/doctor-facing surfaces only"
  - "search-filters.tsx stores raw name_en/name_he per specialty and resolves the label at render time (not inside the mount-only useEffect that fetches the list), so a locale switch relabels the filter dropdown immediately instead of freezing at whichever locale was active on first load"

requirements-completed: [QUICK-260817-fhm]

coverage:
  - id: D1
    description: "notification unread badge and per-row unread dot clear when the bell popover opens, without a page reload, and a live insert mid-flight is never clobbered (T-FHM-04)"
    requirement: QUICK-260817-fhm
    verification:
      - kind: e2e
        ref: "tests/e2e/notifications-realtime.spec.ts — 'the unread badge clears after opening the bell, without a page reload'"
        status: pass
    human_judgment: false
  - id: D2
    description: "specialty names render in Hebrew under the Hebrew locale and English under the English locale on search results, doctor profile (header + booking dialog), favorites, and the doctor-request dialog (T-FHM-02)"
    requirement: QUICK-260817-fhm
    verification:
      - kind: e2e
        ref: "tests/e2e/locale-switching.spec.ts — 'specialty names render in the active locale on the search results'"
        status: pass
    human_judgment: false
  - id: D3
    description: "admin appointments doctor filter is sourced from the admin-gated GET /api/admin/doctors (not a direct browser-client table query), sorted alphabetically client-side, with a visible error + retry on a failed load (T-FHM-01)"
    requirement: QUICK-260817-fhm
    verification:
      - kind: e2e
        ref: "tests/e2e/admin-oversight-views.spec.ts — 'the appointments doctor filter surfaces a failed doctor load'"
        status: pass
    human_judgment: false
  - id: D4
    description: "patient dashboard and appointment history render 'with {full_name}' / 'אצל {full_name}' — no duplicated title — since full_name already carries it (T-FHM-03)"
    requirement: QUICK-260817-fhm
    verification:
      - kind: manual
        ref: "Visual confirmation against live seeded doctors (all named 'Dr. {name}'); repo-wide grep found no e2e spec asserting the old 'with Dr.'/'אצל ד״ר' literal, so none needed updating"
        status: pass
    human_judgment: true
    rationale: "No pre-existing e2e assertion pinned the old string, so there was no regression test to flip red-to-green; correctness is established by dictionary diff review + the unchanged full_name rendering elsewhere in the app, not a new automated assertion."

duration: 15min
completed: 2026-08-17
status: complete
---

# Quick Task 260817-fhm Summary

**Fixed 4 UI/quality findings from the visual + code review: the notification unread badge never clearing in-session, specialty names staying English under the Hebrew locale, the admin appointments doctor filter bypassing the admin API and swallowing load errors, and a "with Dr. Dr. {name}" duplicated-title string on the patient dashboard and appointment history.**

## Performance

- **Duration:** ~15 min (executor commits) + manual verification after an executor session-limit interruption
- **Started:** 2026-08-17T11:20:03+03:00
- **Completed:** 2026-08-17T11:35:30+03:00
- **Tasks:** 4/4
- **Files modified:** 13 (1 created, 12 modified)

## Accomplishments

- **T-FHM-04:** `components/notification-bell.tsx`'s `handleOpenChange` now keeps a synchronous open-time snapshot of unread ids, awaits the PATCH loop via `Promise.allSettled`, and only moves server-confirmed ids to read via the functional `setRows` updater — so a live Realtime insert arriving mid-flight is never clobbered. Failed/rejected PATCHes stay unread and retry on the next open.
- **T-FHM-02:** New `lib/i18n/specialty.ts` exports `specialtyLabel(locale, nameEn, nameHe)`, mirroring the existing `translate()` locale-then-English fallback chain. Wired into `doctor-card.tsx`, the favorites page, the doctor profile page (header + booking dialog), `search-filters.tsx`, and `doctor-request-dialog.tsx`. `search-filters.tsx` resolves the label at render time (not inside its fetch effect) so a locale switch relabels the filter dropdown without a hard reload.
- **T-FHM-01:** `app/admin/appointments/page.tsx`'s doctor-filter options now come from `GET /api/admin/doctors` (`requireAdmin()`-gated) instead of a direct `createClient().from("doctors")` browser query — adding a route-level auth check in front of RLS. That route orders by `created_at`, so a client-side `localeCompare` sort reproduces the dropdown's existing alphabetical order. A failed load now renders a destructive-text message plus an outline Retry button, matching `doctors-page-client.tsx`'s existing loading/error-state convention.
- **T-FHM-03:** `patient_appointments.with_doctor_prefix` and `patient_dashboard.with_doctor_prefix` changed from `"with Dr."`/`"אצל ד״ר"` to bare `"with"`/`"אצל"` in both dictionaries — `full_name` already carries the title for every doctor in the app, and this was the only place re-adding it.

## Task Commits

1. **Task 1: clear notification unread badge in-session when the bell opens** - `d6d40b2` (fix)
2. **Task 2: localize specialty names to Hebrew on all patient/doctor-facing surfaces** - `c556c96` (feat)
3. **Task 3: route admin appointments doctor filter through the admin API and surface load errors** - `37f4dd4` (fix)
4. **Task 4: remove duplicated doctor title from the two with-doctor prefix strings** - `163b37d` (fix)

_All four commits are single-task, single-concern — verified via `git show --stat` that each touches only its own task's declared files._

## Files Created/Modified

- `lib/i18n/specialty.ts` - new locale-aware specialty label resolver
- `components/notification-bell.tsx` - snapshot-then-reconcile read-state update on popover open
- `app/doctors/[id]/page.tsx` - specialty label resolved via `specialtyLabel()` in header + booking dialog
- `app/patient/favorites/page.tsx` - specialty label resolved via `specialtyLabel()`
- `components/doctor-request-dialog.tsx` - specialty dropdown options localized
- `components/search/doctor-card.tsx` - specialty label resolved via `specialtyLabel()`
- `components/search/search-filters.tsx` - raw name_en/name_he stored per specialty, label resolved at render time in both the Select items map and SelectItem body
- `app/admin/appointments/page.tsx` - doctor options sourced from `/api/admin/doctors`, `doctorOptionsStatus` (loading/error/ready) + Retry control added
- `dictionaries/en.json`, `dictionaries/he.json` - `with_doctor_prefix` values de-duplicated (×2 each)
- `tests/e2e/admin-oversight-views.spec.ts` - new case: appointments doctor filter surfaces a failed doctor load
- `tests/e2e/locale-switching.spec.ts` - new case: specialty names render in the active locale on search results
- `tests/e2e/notifications-realtime.spec.ts` - new case: unread badge clears after opening the bell, without a reload

## Decisions Made

- **Fixed the duplicate-title bug by editing the prefix strings, not `full_name`.** Stripping "Dr." from `full_name` would have required touching every other display site (search cards, profile headers, favorites) that already renders it correctly raw, and risked drifting from how admin-entered doctor names are expected to look everywhere else. Editing the two redundant prefix strings is the smaller, more consistent fix.
- **Admin UI left English-only.** `app/admin/appointments/page.tsx` (and the admin section generally) has zero `t()` calls by construction — specialty localization was scoped strictly to patient/doctor-facing surfaces, matching the existing admin-is-English-only convention observed during planning.

## Deviations from Plan

None in the code itself — all 4 tasks match the plan's scope and file list. **Process deviation:** the original executor agent hit an account-level API session limit while running its final verification pass, after all 4 commits had already landed cleanly. The orchestrator (this session) completed verification manually: `npx tsc --noEmit` clean, `npx eslint .` clean, and the full targeted Playwright suite (68 tests across `admin-oversight-views.spec.ts`, `appointment-history.spec.ts`, `doctor-request.spec.ts`, `locale-switching.spec.ts`, `notifications-realtime.spec.ts`, `patient-dashboard.spec.ts`, `patient-favorites.spec.ts`) passed 68/68, including all 3 new tests added for this task. This SUMMARY.md was written by the orchestrator after the fact since the interrupted executor never reached that step.

## Issues Encountered

- Executor agent hit a session-limit API error mid-task (after all commits, during its own final test run) — see Deviations above. No code was left in a broken or partially-committed state; each of the 4 commits is complete and self-contained.

## User Setup Required

None.

## Next Phase Readiness

- All 4 UI/quality findings from the visual audit are fixed and verified.
- `npx tsc --noEmit`, `npx eslint .` both pass clean.
- Full targeted Playwright suite: 68/68 passed.
- No blockers for the next phase or for `/gsd-ship`.

---
*Quick task: 260817-fhm*
*Completed: 2026-08-17*

## Self-Check: PASSED

All 12 files listed in Files Created/Modified confirmed present on disk. All 4 task commit hashes (`d6d40b2`, `c556c96`, `37f4dd4`, `163b37d`) confirmed present in `git log`.
