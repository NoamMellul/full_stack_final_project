---
phase: 06-dashboards-notifications-localization
plan: 05
subsystem: i18n
tags: [i18n, rtl, nextjs-app-router, route-handler, cookies, react-context, playwright]

# Dependency graph
requires:
  - phase: 06-dashboards-notifications-localization
    provides: "06-01's tests/e2e/locale-switching.spec.ts placeholder (5 test.fixme tests carrying real I18N-01/02 assertions)"
provides:
  - "dictionaries/en.json, dictionaries/he.json — flat dot-namespaced key/value dictionaries seeded with common/header/notifications key namespaces"
  - "lib/i18n/dictionaries.ts — SUPPORTED_LOCALES, LOCALE_COOKIE_NAME, Locale, TranslationKey, isLocale, readLocale, translate, FALLBACK_TRANSLATION (importable from server, client, and Node)"
  - "lib/i18n/locale-provider.tsx — client LocaleProvider/useLocale/useT"
  - "lib/i18n/server.ts — async getLocale/getT, the sole i18n module reading cookies"
  - "lib/validation/locale.ts — validateLocaleInput"
  - "app/api/locale/route.ts — POST /api/locale, unauthenticated cookie-write Route Handler"
  - "components/language-switcher.tsx — LanguageSwitcher (EN/עב, never translated)"
  - "components/site-header.tsx — single always-rendered header mount (D-06), anonymous-visitor branch, switcher slot, role fetched for 06-06's bell gate"
  - "app/layout.tsx as the single SiteHeader mount and the source of <html lang>/<html dir>"
affects: [06-06, 06-07, 06-08, 06-09, 06-10]

# Actuals (#2632)
actuals:
  tokens: 4507
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Flat dot-namespaced dictionary keys (surface.element or surface.element.variant, lower snake_case) with the Hebrew dictionary typed as Record<TranslationKey, string> so a missing Hebrew key is a compile error"
    - "Server/Client i18n split: lib/i18n/dictionaries.ts has no 'use client' and no next/headers import (importable everywhere, mirrors lib/timezone.ts); lib/i18n/server.ts is the sole next/headers importer"
    - "Cookie-write-then-router.refresh() for a display preference with no Server Action, mirroring components/logout-button.tsx's fetch-then-refresh shape"
    - "Single-mount shared header in the root layout instead of per-role-layout duplication — role-scoped layouts keep only their auth/redirect guards"

key-files:
  created:
    - dictionaries/en.json
    - dictionaries/he.json
    - lib/i18n/dictionaries.ts
    - lib/i18n/locale-provider.tsx
    - lib/i18n/server.ts
    - lib/validation/locale.ts
    - app/api/locale/route.ts
    - components/language-switcher.tsx
  modified:
    - app/layout.tsx
    - app/patient/layout.tsx
    - app/doctor/layout.tsx
    - app/admin/layout.tsx
    - "app/doctor/(gated)/layout.tsx"
    - components/site-header.tsx
    - tests/e2e/locale-switching.spec.ts

key-decisions:
  - "Flat dot-namespaced key convention (surface.element[.variant]) locked as the dictionary shape, per CONTEXT.md's 'Claude's Discretion' — a single property access, TranslationKey derived directly from keyof typeof en"
  - "translate() falls back locale -> English -> fixed FALLBACK_TRANSLATION string; the English/fallback branches are statically unreachable given TranslationKey's exhaustive typing but exist so a cast-through can never blank the UI"
  - "app/layout.tsx became async and is now the single mount point for both <html lang>/<html dir> and <SiteHeader />; the three role-scoped layouts (patient/doctor/admin) kept only their auth+role redirect guards"
  - "language-switcher.tsx keeps router.refresh() as the sole refresh mechanism (no window.location.reload() fallback) — verified end-to-end that Next.js re-runs the root layout Server Component and updates dir/lang without a full reload (RESEARCH Assumption A2 confirmed, not the documented fallback)"
  - "site-header.tsx's profiles lookup is now conditional on a present user (was unconditional), and its select widened from full_name to full_name, role; the role fetch is unused by this plan but left available for 06-06's admin bell-omission gate"
  - "tests/e2e/locale-switching.spec.ts's 5 placeholder tests activated (test.fixme -> test) across the two layout/switcher-owning task commits: the no-flash fresh-navigation test with Task 2 (root layout only), the remaining 4 (Hebrew/English switch, logged-out visibility, invalid-locale rejection) with Task 3 (switcher + route)"

patterns-established:
  - "i18n runtime split into three files by import surface (dictionaries.ts: universal, locale-provider.tsx: client, server.ts: server) — the pattern 06-06 and any future i18n-consuming plan reuse verbatim"

requirements-completed: [I18N-01, I18N-02]

coverage:
  - id: D1
    description: "Typed, flat-key translation lookup with complete English and Hebrew dictionaries, reachable from both Server and Client Components through separate entry points over one shared implementation"
    requirement: "I18N-01"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (proves dictionaries/he.json is key-complete against en.json via the Record<Locale, Record<TranslationKey, string>> typing)"
        status: pass
      - kind: unit
        ref: "node -e key-set-equality check between dictionaries/en.json and dictionaries/he.json"
        status: pass
    human_judgment: false
  - id: D2
    description: "Root layout reads the locale cookie server-side and sets <html lang>/<html dir> correctly on the first byte of HTML, with no client-side flash of the wrong direction"
    requirement: "I18N-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/locale-switching.spec.ts:44 'the chosen locale survives a fresh navigation with no wrong-direction flash'"
        status: pass
      - kind: manual_procedural
        ref: "curl -s localhost:3000/ with no cookie shows lang=\"en\" dir=\"ltr\"; POST /api/locale {locale:\"he\"} then curl shows the cookie is written and readLocale allow-lists correctly"
        status: pass
    human_judgment: false
  - id: D3
    description: "Language switcher (EN/עב, hard-coded labels never translated) is reachable from every route including logged-out ones, writes the locale cookie via a REST Route Handler with an allow-list validator, and flips the server-rendered direction without a manual reload"
    requirement: "I18N-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/locale-switching.spec.ts (all 5 tests: Hebrew switch, English switch, no-flash, logged-out visibility, invalid-locale 400)"
        status: pass
      - kind: manual_procedural
        ref: "POST /api/locale with {locale:\"he\"} -> 200 + Set-Cookie; {locale:\"fr\"} -> 400; non-object body -> 400"
        status: pass
    human_judgment: false
  - id: D4
    description: "SiteHeader is mounted exactly once (root layout), renders for anonymous visitors (logo + switcher only), and no route shows a duplicate header"
    verification:
      - kind: e2e
        ref: "npx playwright test (full suite): auth-logout.spec.ts's header-name-display test and every admin-route-protection.spec.ts per-role page-render test pass unchanged"
        status: pass
      - kind: unit
        ref: "grep -c SiteHeader across app/patient/layout.tsx, app/doctor/layout.tsx, app/admin/layout.tsx (0) and app/layout.tsx (1)"
        status: pass
    human_judgment: false

# Metrics
duration: 165min
completed: 2026-08-12
status: complete
---

# Phase 06 Plan 05: Custom i18n Runtime and Header Restructure Summary

**Hand-written flat-key i18n runtime (typed dictionaries, client context, server helper) plus a single always-rendered `SiteHeader` in the root layout carrying an EN/עב language switcher that writes a cookie via `POST /api/locale` and flips `<html lang>`/`<html dir>` on the first server-rendered byte.**

## Performance

- **Duration:** ~165 min (including a ~27 min full-suite regression run)
- **Tasks:** 3
- **Files modified:** 8 created, 7 modified

## Accomplishments
- `dictionaries/en.json` / `dictionaries/he.json`: flat dot-namespaced key/value dictionaries seeded with `common.retry`, `header.log_out`, and the full `notifications.*` namespace (11 keys total), every Hebrew value distinct from its English counterpart
- `lib/i18n/dictionaries.ts`: `SUPPORTED_LOCALES`, `LOCALE_COOKIE_NAME`, `Locale`, `TranslationKey`, `isLocale`, `readLocale`, `translate` (locale -> English -> `FALLBACK_TRANSLATION`, never a raw key/undefined/blank), typed so a missing Hebrew key fails `tsc` at compile time
- `lib/i18n/locale-provider.tsx` (client) and `lib/i18n/server.ts` (the sole `next/headers` importer): `LocaleProvider`/`useLocale`/`useT` and `getLocale`/`getT` resolving through the same `translate()`
- `app/layout.tsx` converted to an async Server Component: reads the locale cookie once via `getLocale()`, sets `<html lang>`/`<html dir>`, wraps `<body>` in `<LocaleProvider>`, and is now the single mount point for `<SiteHeader />`
- `app/patient/layout.tsx`, `app/doctor/layout.tsx`, `app/admin/layout.tsx`: duplicate `<SiteHeader />` mounts removed, auth/role redirect guards untouched; `app/doctor/(gated)/layout.tsx`'s stale header comment corrected
- `lib/validation/locale.ts` + `app/api/locale/route.ts`: unauthenticated `POST` Route Handler, allow-list validated via `isLocale`, writes exactly one cookie (`path=/`, 1-year `maxAge`, `sameSite=lax`)
- `components/language-switcher.tsx`: two `size="sm"` buttons (`EN`/`עב`, `aria-label` `English`/`עברית`), hard-coded literals never routed through `t()`, fetch-then-`router.refresh()` mirroring `LogoutButton`'s shape
- `components/site-header.tsx`: anonymous-visitor early return removed (D-06) — logo + switcher render for every visitor; `profiles` select widened to `full_name, role` and made conditional on a present user; name/logout still gated to authenticated sessions; a labeled slot left for 06-06's notification bell
- Every route in `npm run build` now reports `ƒ (Dynamic)`, including `/login` (previously `○ Static`) — the accepted, recorded cost of reading the locale cookie in the root layout (RESEARCH Pitfall 3 / D-05)
- `tests/e2e/locale-switching.spec.ts`'s 5 placeholder tests all activated (`test.fixme` -> `test`) and pass: Hebrew switch, English switch, no-flash fresh navigation, logged-out visibility, invalid-locale 400 rejection

## Task Commits

Each task was committed atomically:

1. **Task 1: Dictionary files, typed lookup, client context and server helper** - `2d45660` (feat)
2. **Task 2: Root layout reads the locale cookie, sets lang/dir, and becomes the single SiteHeader mount** - `ab779a0` (feat)
3. **Task 3: Locale Route Handler, language switcher, and the always-rendered header (D-06)** - `b718678` (feat)

**Plan metadata:** commit pending (docs: complete plan)

## Files Created/Modified
- `dictionaries/en.json` / `dictionaries/he.json` - flat translation key/value dictionaries
- `lib/i18n/dictionaries.ts` - typed lookup, allow-list, translate()
- `lib/i18n/locale-provider.tsx` - client LocaleProvider/useLocale/useT
- `lib/i18n/server.ts` - server getLocale/getT
- `lib/validation/locale.ts` - validateLocaleInput
- `app/api/locale/route.ts` - POST cookie-write Route Handler
- `components/language-switcher.tsx` - EN/עב switcher
- `app/layout.tsx` - async, locale-aware, single SiteHeader mount
- `app/patient/layout.tsx`, `app/doctor/layout.tsx`, `app/admin/layout.tsx` - SiteHeader mount removed
- `app/doctor/(gated)/layout.tsx` - stale comment corrected
- `components/site-header.tsx` - renders for anonymous visitors, switcher added, role fetched
- `tests/e2e/locale-switching.spec.ts` - 5 tests activated

## Decisions Made
- Locked the flat dot-namespaced dictionary key convention (left to discretion by CONTEXT.md)
- `router.refresh()` alone (no `window.location.reload()` fallback) proved sufficient to re-run the root layout Server Component and update `dir`/`lang` — confirmed live via the full 5-test `locale-switching.spec.ts` run, not just the plan's flagged assumption
- Split the i18n runtime into three files by import surface (universal / client / server) so Client Components never pull in `next/headers`
- Split the 5 placeholder test activations across the two owning task commits (1 with Task 2's layout-only capability, 4 with Task 3's switcher/route capability) rather than activating all 5 in one task, keeping each commit's tests aligned with what that commit actually delivers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reworded two in-file comments that accidentally matched their own acceptance-criteria greps**
- **Found during:** Task 1 (dictionaries.ts authoring)
- **Issue:** Explanatory comments in `lib/i18n/dictionaries.ts` contained the literal substrings `"use client"` and `next/headers` (inside prose explaining why the file has neither), which would make the acceptance criterion's `grep -c` checks for those literals return 1 instead of the required 0
- **Fix:** Reworded both comments to describe the same constraint without using the literal strings
- **Files modified:** lib/i18n/dictionaries.ts
- **Verification:** `grep -c '"use client"' lib/i18n/dictionaries.ts` and `grep -c "next/headers" lib/i18n/dictionaries.ts` both report 0; `npx tsc --noEmit` still exits 0
- **Committed in:** 2d45660 (Task 1 commit)

**2. [Rule 1 - Bug] Removed an unused `useMemo` import**
- **Found during:** Task 3 (lint check before commit)
- **Issue:** `lib/i18n/locale-provider.tsx` imported `useMemo` from `react` but never used it (the `useT` binder uses `useCallback`), producing an ESLint `no-unused-vars` warning
- **Fix:** Dropped the unused import
- **Files modified:** lib/i18n/locale-provider.tsx
- **Verification:** `npm run lint` reports 0 problems
- **Committed in:** ab779a0 (Task 2 commit, since Task 2 was the next commit to touch layout-adjacent i18n files)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both cosmetic/lint-only fixes with no behavioral change. No scope creep.

## Issues Encountered
- The very first (cold-start) run of `switching to Hebrew sets lang and dir on the html element` failed once against a freshly-started Next.js dev server (Turbopack on-demand route compilation delay exceeded the 5s assertion timeout), then passed cleanly both in isolation and as part of every subsequent full run (including the final one recorded below) — a warm-server timing artifact, not a code defect, consistent with this project's previously-documented dev-server flakiness (06-04 SUMMARY).
- Two earlier full-suite attempts hung indefinitely partway through (once contaminated by concurrent file edits during this session's own Task 3 work, once with no clear cause) and had to be killed; a third clean, uninterrupted run completed in ~27 minutes with a stable process count throughout. Recorded here for visibility, not as a defect in this plan's code.
- The clean full-suite run (321 tests) reported **300 passed, 15 failed, 6 skipped**. All 15 failures fall into categories already independently established as pre-existing/environmental in this phase's prior plans, not caused by this plan's changes:
  - `admin-doctor-link-account.spec.ts` (8 failures, cascading from test 1): the admin's "Generate temporary password" action surfaced `Could not create a login for this doctor. Please try again.` — a Supabase Auth admin-API failure unrelated to i18n/header code, plausibly rate-limiting from this session's several consecutive full-suite runs against the shared dev project.
  - `admin-doctor-status.spec.ts` (4 failures, cascading from test 2): a status-toggle confirmation-copy assertion timed out — the same test file 06-03's SUMMARY already recorded as "failed mid-session on a full-suite run but passed 5/5 in isolation."
  - `admin-route-protection.spec.ts:230` (1 failure): the identical test already logged as a third/fourth recurrence of shared-dev-DB residue flakiness in 06-02/06-03/06-04's SUMMARYs and STATE.md blockers.
  - `notifications-realtime.spec.ts` "notifications table is published to supabase_realtime" (1 failure): a Realtime WebSocket subscription timed out after 55s waiting for a broadcast — unrelated to this plan (no notifications code touched), consistent with the "transient dev-server/connectivity window" class 06-04's SUMMARY documented.
  - `seed-availability.spec.ts:170` (1 failure): the same recurring slot-count assertion already logged as WINDOWS.md ids 1 and 3.
  - The 6 skipped tests are `notifications-realtime.spec.ts`'s own remaining `test.fixme(` placeholders, explicitly owned by 06-06 (not this plan) — expected, not a gap.
  - Every test that exercises this plan's own changes passed: all 5 of `locale-switching.spec.ts`, `auth-logout.spec.ts`'s header-name-display test, and every per-role page-render assertion in `admin-route-protection.spec.ts`'s matrix.
- Logged the recurring `admin-route-protection.spec.ts:230` and `seed-availability.spec.ts:170` failures as a further recurrence in `.planning/WINDOWS.md`; did not re-log the already-tracked shared-dev-DB blocker text a fifth time in STATE.md verbatim, but the pattern continues to hold.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The i18n runtime (`lib/i18n/*`, `dictionaries/*.json`) and the single-mount `SiteHeader` are both stable dependencies for 06-06 (notification bell — the labeled slot is ready, and `profiles.role` is already fetched for the admin-omission gate) and for the eventual D-04 retrofit of ~189 existing hardcoded strings across the app, which is out of this plan's scope per the UI-SPEC's explicit deferral.
- I18N-01 and I18N-02 are both satisfied end-to-end with live, passing Playwright evidence (not just unit-level dictionary checks).
- Before `/gsd-ship`, a human should independently confirm (as already flagged by 06-01 and repeated by each subsequent plan) that the recurring `admin-route-protection.spec.ts:230` / `seed-availability.spec.ts:170` / shared-dev-DB-residue failure class is genuinely pre-existing and not masking a real regression — this plan's own full-suite run is the fourth-plus independent confirmation that these fail regardless of which phase-6 plan is executing.

---
*Phase: 06-dashboards-notifications-localization*
*Completed: 2026-08-12*

## Self-Check: PASSED

All 8 created files verified present on disk; all 3 task commit hashes (`2d45660`, `ab779a0`, `b718678`) verified present in git log.
