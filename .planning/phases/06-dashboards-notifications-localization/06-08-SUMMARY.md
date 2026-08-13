---
phase: 06-dashboards-notifications-localization
plan: 08
subsystem: ui
tags: [i18n, react, nextjs, playwright]

requires:
  - phase: 06-dashboards-notifications-localization
    provides: dictionaries/en.json + dictionaries/he.json translation key inventory, useT()/getT() runtime, translateValidationMessage() bridge (06-05, 06-07)
provides:
  - Landing, login, signup, search (page + filters + results + doctor card) and doctor-profile pages fully retrofitted to render through t()
  - Both duplicate LANGUAGE_LABELS maps deleted, replaced by the shared languages.he/languages.en dictionary pair
affects: [06-09, 06-10]

actuals:
  tokens: 9429
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Server Components resolve translations via `await getT()` (lib/i18n/server.ts); Client Components via `useT()` (lib/i18n/locale-provider.tsx) — no component imports next/headers"
    - "lib/validation/auth.ts's literal error messages are stored untranslated in component state and translated only at the render boundary via translateValidationMessage(message, t)"
    - "Client-authored generic-error fallbacks (used only when a route response carries no error field) are translated via t(); the route's own returned error text is rendered as-is, unchanged, per T-06-37's non-oracle guarantee"
    - "A module-level constant that needs a translated label but lives outside a component (no hook access) stores a TranslationKey, not a literal string, and is resolved via t(key) inside the render function that consumes it"

key-files:
  created: []
  modified:
    - app/page.tsx
    - app/login/page.tsx
    - app/signup/page.tsx
    - app/search/page.tsx
    - components/search/search-filters.tsx
    - components/search/search-results.tsx
    - components/search/doctor-card.tsx
    - app/doctors/[id]/page.tsx

key-decisions:
  - "Client-side generic-error fallbacks (auth.login.generic_error, auth.signup.generic_error, doctor_profile.booking_generic_error) are routed through t(); the server route's own returned error string is rendered unchanged in either locale, preserving T-06-37's login non-oracle guarantee and avoiding any change to route handlers"
  - "search-filters.tsx's language Select `items` map (used for Select.Value label resolution) now resolves from languages.he/languages.en instead of its own separate hardcoded Hebrew/English map, so there is exactly one language-label source feeding both the filter dropdown and the two badge consolidations"
  - "The 'Demo profile' and 'No upcoming availability' badges on the doctor-profile page deliberately reuse doctor_card.demo_profile and doctor_card.no_availability rather than adding doctor_profile-scoped duplicates, since 06-07 authored one key per distinct string, not one key per file"

patterns-established:
  - "Message-string constants that must be both a TranslationKey and a validator-literal key (e.g. QUICK_SELECTS, LANGUAGE_KEY_BY_CODE) live in a Record<string, TranslationKey> at module scope and are resolved with t(key) inside the component, since t() itself is only available after useT() runs"

requirements-completed: [I18N-01]

coverage:
  - id: D1
    description: "Landing page (app/page.tsx) renders through getT(), byte-identical English output"
    requirement: "I18N-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/auth-login.spec.ts, tests/e2e/auth-signup.spec.ts, tests/e2e/auth-session-persistence.spec.ts (17 tests, unedited)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Login and signup pages translate all copy and route lib/validation/auth.ts messages through translateValidationMessage() at render"
    requirement: "I18N-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/auth-login.spec.ts, tests/e2e/auth-signup.spec.ts (unedited)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Search page, filters, results and doctor card translate all copy including pagination aria-labels; doctor-card.tsx's LANGUAGE_LABELS deleted"
    requirement: "I18N-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/search-filters.spec.ts, tests/e2e/search-sort-pagination.spec.ts, tests/e2e/search-view-visibility.spec.ts (37 tests, unedited)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Doctor profile page and booking dialog translate all copy across all four render branches; second LANGUAGE_LABELS deleted"
    requirement: "I18N-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-profile.spec.ts, tests/e2e/appointment-booking.spec.ts (23 tests, unedited)"
        status: pass
    human_judgment: false
  - id: D5
    description: "With the locale cookie set to he, /login, /search and /doctors/{id} render Hebrew copy including validation errors and language badges"
    verification: []
    human_judgment: true
    rationale: "Requires visually inspecting rendered Hebrew text and RTL layout in a live browser session — no automated assertion covers the actual Hebrew string content beyond the dictionary lookup itself"

duration: 55min
completed: 2026-08-13
status: complete
---

# Phase 6 Plan 8: Public and Authentication Surface Localization Summary

**Retrofitted the landing, login, signup, search (page + filters + results + doctor card) and doctor-profile pages to render entirely through `t()`, deleting both duplicate `LANGUAGE_LABELS` maps in favor of the shared `languages.he`/`languages.en` dictionary pair, with zero change to English output.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-08-13T10:30:00Z
- **Completed:** 2026-08-13T11:26:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Eight public/auth-surface files now resolve every user-facing string through `getT()` (Server Components) or `useT()` (Client Components) against the 06-07 dictionary inventory — no new dictionary keys added
- `lib/validation/auth.ts`'s literal validation messages are translated only at the render boundary via `translateValidationMessage()`, with `lib/validation/auth.ts` and every route handler left untouched
- Both independent `LANGUAGE_LABELS` maps (`components/search/doctor-card.tsx`, `app/doctors/[id]/page.tsx`) deleted and replaced by the shared `languages.he`/`languages.en` lookup, closing RESEARCH Pitfall 6
- `search-filters.tsx`'s language `Select` items map also now resolves from the shared dictionary pair instead of its own separate hardcoded map
- Pagination aria-labels (`Previous page`, `Next page`, `Page {n}`, the results-pagination nav label) translated alongside visible copy
- All 77 task-scoped Playwright tests (auth-login/auth-signup/auth-session-persistence: 17; search-filters/search-sort-pagination/search-view-visibility: 37; doctor-profile/appointment-booking: 23) pass with zero edited assertions
- `npx tsc --noEmit`, `npm run lint` and `npm run build` all exit clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Landing, login and signup pages, including translated validation errors** - `3e9e852` (feat)
2. **Task 2: Search page, filters, results and doctor card, with one shared language-label pair** - `abbe4ff` (feat)
3. **Task 3: Doctor profile page, including the booking dialog and the second language-label map** - `031db8f` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `app/page.tsx` - Server Component; resolves copy via `await getT()`
- `app/login/page.tsx` - Client Component; `useT()` + `translateValidationMessage()` bridge for field errors
- `app/signup/page.tsx` - Client Component; `useT()` + `translateValidationMessage()` bridge for field errors
- `app/search/page.tsx` - Client Component; page heading and load-error fallback translated
- `components/search/search-filters.tsx` - all labels, placeholders, quick-select chips and Clear filters translated; language Select items resolve from `languages.he`/`languages.en`
- `components/search/search-results.tsx` - error/empty states, result count, and all pagination aria-labels translated
- `components/search/doctor-card.tsx` - `LANGUAGE_LABELS` deleted, replaced by `languages.he`/`languages.en` lookup with raw-code fallback
- `app/doctors/[id]/page.tsx` - all four render branches plus the booking-confirmation dialog translated; second `LANGUAGE_LABELS` deleted

## Decisions Made
- Client-authored generic-error fallbacks (`auth.login.generic_error`, `auth.signup.generic_error`, `doctor_profile.booking_generic_error`) are translated via `t()`; the server route's own returned `data.error` string is rendered as-is in either locale — preserves T-06-37's login non-oracle guarantee without touching any route handler
- `search-filters.tsx`'s `LANGUAGE_ITEMS` Select-items map removed in favor of building the map from `languages.he`/`languages.en` inside the component, so the filter dropdown and both badge consolidations share one source
- The doctor-profile page's "Demo profile" and "No upcoming availability" strings reuse `doctor_card.demo_profile`/`doctor_card.no_availability` rather than adding profile-scoped duplicates, matching 06-07's one-key-per-string authoring convention

## Deviations from Plan

None - plan executed exactly as written for all 3 tasks. All acceptance criteria within this plan's declared file scope (8 files) were met.

### Note: a third `LANGUAGE_LABELS` instance exists outside this plan's scope

`grep -rc "LANGUAGE_LABELS" app components` reports a non-zero count because `app/patient/favorites/page.tsx` — not among this plan's `files_modified` — still carries its own `LANGUAGE_LABELS` map. The plan's own `must_haves.truths` scoped this consolidation to "the two independent LANGUAGE_LABELS maps" (`components/search/doctor-card.tsx` and `app/doctors/[id]/page.tsx`), both of which are now gone. `app/patient/favorites/page.tsx` is explicitly in 06-09's `files_modified` list and task 1's file set, so that third instance is 06-09's responsibility, not a gap in this plan. Documented here rather than fixed in-scope to avoid touching a file another plan owns mid-phase.

## Issues Encountered

Full-suite `npx playwright test` run (321 tests, 33.7 min) showed 318 passed / 3 failed:
- `appointment-cancel.spec.ts:310` — transient `ECONNRESET` on a PATCH request
- `appointment-reschedule.spec.ts:764` — `afterAll` hook timeout (30000ms), same recurring class as WINDOWS.md ids 2/9
- `seed-availability.spec.ts:170` — doctor slot count `3 < 6`, same recurring shared-dev-DB residue class as WINDOWS.md ids 1/3/5/7/8

None of the three failing specs touch any of this plan's 8 retrofitted files. All three task-scoped test runs (77 tests total, run individually per task before the full-suite run) passed cleanly with zero edited assertions. Logged as WINDOWS.md id 10, consistent with every prior 06-0X plan's full-suite closure run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The public/auth surface (landing, login, signup, search, doctor profile) is fully bilingual; 06-09 can proceed to retrofit the patient/doctor dashboards and `app/patient/favorites/page.tsx` (including its own `LANGUAGE_LABELS` instance) without any dependency on this plan's remaining work
- No blockers introduced by this plan

---
*Phase: 06-dashboards-notifications-localization*
*Completed: 2026-08-13*

## Self-Check: PASSED

All 8 modified files and the SUMMARY.md exist on disk; all 3 task commits (3e9e852, abbe4ff, 031db8f) verified present in `git log --oneline --all`.
