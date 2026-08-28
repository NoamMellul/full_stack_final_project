---
phase: quick-260817-fhm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - components/notification-bell.tsx
  - lib/i18n/specialty.ts
  - components/search/doctor-card.tsx
  - components/search/search-filters.tsx
  - components/doctor-request-dialog.tsx
  - app/doctors/[id]/page.tsx
  - app/patient/favorites/page.tsx
  - app/admin/appointments/page.tsx
  - dictionaries/en.json
  - dictionaries/he.json
  - tests/e2e/notifications-realtime.spec.ts
  - tests/e2e/locale-switching.spec.ts
  - tests/e2e/admin-oversight-views.spec.ts
autonomous: true
requirements: [FHM-01, FHM-02, FHM-03, FHM-04]

estimate:
  tokens: 65000
  raw_tokens: 65000
  tasks: 4
  confidence: low

must_haves:
  truths:
    - "Opening the notification bell clears the unread badge and the per-row unread dots in the same session, with no page reload and no bell remount."
    - "A patient browsing in Hebrew sees specialty names in Hebrew on the search cards, the search specialty filter, the doctor profile page, the booking dialog, the favorites list, and the public doctor-request form."
    - "Switching the interface language back to English restores English specialty names on every one of those surfaces without a hard reload."
    - "The admin appointments doctor-filter dropdown is populated through the admin-gated API route, and a failed load shows a visible error with a Retry control instead of a silently empty dropdown."
    - "A patient never sees a doubled doctor title: the upcoming-appointment line on the dashboard and the appointments list read as one preposition plus the stored full name."
  artifacts:
    - lib/i18n/specialty.ts
    - components/notification-bell.tsx
    - app/admin/appointments/page.tsx
    - dictionaries/en.json
    - dictionaries/he.json
  key_links:
    - "notification-bell.tsx handleOpenChange -> PATCH /api/notifications/{id}/read -> local rows state -> unreadCount -> badge visibility"
    - "useLocale() -> specialtyLabel() -> every patient/doctor-facing specialty render site"
    - "app/admin/appointments/page.tsx -> GET /api/admin/doctors (requireAdmin) -> doctorOptions + error state"
    - "dictionaries/en.json + dictionaries/he.json with_doctor_prefix values -> t() -> patient dashboard + appointments rows"
---

<objective>
Fix four independent UI/quality findings surfaced by a live visual audit, each as its own atomic commit.

Purpose: every one of these is a user-visible defect on a graded demo surface — a badge that lies about unread state, an entire product dimension (specialty) that is never translated in Hebrew, an admin data read that bypasses the app's own admin API gate and fails silently, and a duplicated doctor title reading "with Dr. Dr. Omer Golan".

Output: a corrected notification-read flow, a shared locale-aware specialty label helper wired into all six patient/doctor-facing render sites, an API-routed + error-surfaced admin doctor filter, two corrected dictionary values, and three new Playwright tests covering the three behaviors that currently have zero coverage.

**Task shape note (quick-mode batch):** the standard tracer-first / 2-3-tasks-per-plan shape does not apply here. These are four unrelated bug fixes with no shared state, no shared files, and no ordering dependency — each task is already a complete end-to-end user-visible slice on its own. Splitting into multiple plans would add orchestration overhead with zero information gain. Sizing exception recorded deliberately; the requester set a ~30% context target for the whole batch.
</objective>

<execution_context>
@C:/Users/mellu/Desktop/full_stack_final_project/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/mellu/Desktop/full_stack_final_project/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/CLAUDE.md

Project constraints that bind every task below (from CLAUDE.md, non-negotiable):
- REST Route Handlers only — no Server Actions.
- Manual TypeScript validation — no Zod or any schema library.
- Playwright end-to-end tests only — no Vitest, no React Testing Library.
- i18n is the custom `lib/i18n` system: flat dot-namespaced keys in `dictionaries/en.json` + `dictionaries/he.json`, both files edited in lockstep. `dictionaries/he.json` is typed `Record<TranslationKey, string>`, so a key present in one file and missing from the other is a `tsc` error.
- RTL via CSS logical properties only (`ps-`/`pe-`/`start-`/`end-`), never physical `left`/`right`.

Prior art the executor should mirror rather than reinvent:
- `components/search/doctor-card.tsx` — `LANGUAGE_KEY_BY_CODE` locale-aware lookup with a raw-value fallback.
- `components/admin/doctors-page-client.tsx` (lines ~264-292 and ~713-727) — the `listStatus: "loading" | "error" | "ready"` + destructive-text + outline-Retry convention used by every admin data read.
- `app/patient/favorites/page.tsx` (lines ~119-200) — the same convention on a patient surface, routed through `t()`.
- `tests/e2e/locale-switching.spec.ts` — `context.addCookies([{ name: "locale", ... }])` is how a spec forces Hebrew before navigating.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Clear the notification unread badge in-session when the bell opens</name>
  <files>components/notification-bell.tsx, tests/e2e/notifications-realtime.spec.ts</files>
  <read_first>
    Read `components/notification-bell.tsx` in full before editing — the whole file, not just `handleOpenChange`. The state shape you must preserve matters: `rows` is `NotificationRow[]` (`id`, `type`, `related_appointment_id`, `read_at`, `created_at`), `unreadCount` is derived from `rows.filter((row) => row.read_at === null).length`, and the same `read_at === null` test drives the per-row dot and the bold copy in the list body. `read_at` is used only as a null / non-null flag in this component — no code reads its value.

    Also read `app/api/notifications/[id]/read/route.ts` (66 lines): the endpoint is idempotent, responds `{ ok: true }` on success, and answers a foreign or malformed id with 404 by design.

    Read `tests/e2e/notifications-realtime.spec.ts` around lines 255-295 for the existing badge test and its fixture helpers (`createTestUser`, `insertTestNotification`, `loginAsPatient`, `cleanupTestNotifications`).
  </read_first>
  <behavior>
    - Bell mounts with 2 unread notifications: badge reads "2".
    - Popover opens: after the read requests resolve, the badge is gone and no list row renders the unread dot / bold treatment.
    - The cleared state survives a full page reload (proves the change persisted server-side, not just locally).
    - A notification that arrives live while the popover is already open stays visually unread — the existing snapshot-at-open semantics are preserved, not widened.
    - A read request that fails leaves that row unread, so the next open retries it.
  </behavior>
  <action>
    The bug: `handleOpenChange` snapshots the unread ids, fires one fire-and-forget request per id, and never touches `rows`. Because `NotificationBell` mounts once in the persistent root layout and never remounts on client-side navigation, the badge and dots stay stale for the rest of the session.

    Fix inside `components/notification-bell.tsx` only:

    1. Keep `handleOpenChange` synchronous (Base UI's `onOpenChange` must not receive a promise). Keep the existing open-time snapshot of unread ids and the existing early exit when that snapshot is empty — do not widen the snapshot to include rows that arrive later.
    2. Move the request loop into a separate async helper that awaits all of the read requests together via `Promise.allSettled`, then resolves which ids actually succeeded (settled fulfilled AND the response `ok`). Kick it off from `handleOpenChange` with `void`.
    3. Once resolved, mark exactly those succeeded ids read in local state using the functional `setRows` updater form (never a captured `rows` array) so a live insert landing mid-flight is not clobbered. For each matching row, replace the null `read_at` with a non-null ISO timestamp produced client-side — the component only needs non-null here, it never renders or compares the value.
    4. Ids whose request rejected or returned non-ok must be left untouched, so they remain unread and are retried on the next open.
    5. Update the existing explanatory comment block above the snapshot so it still describes what the code now does. Do not restate the acceptance criteria in comments.

    Do not change the realtime hook, the load/error/empty branches, the dictionary, the endpoint, or the markup.

    Then add ONE Playwright test to `tests/e2e/notifications-realtime.spec.ts`, in the existing UI describe block that owns the badge test, titled `the unread badge clears after opening the bell, without a page reload`. Reuse that block's fixture helpers exactly: create a patient, insert two notifications, log in, navigate to `/patient`, assert `getByTestId("notification-badge")` has text `2`, click the `Notifications` button, assert the badge is hidden, then `page.reload()` and assert it is still hidden. Register the test's fixtures with the same cleanup hooks the surrounding tests already use.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx next lint --file components/notification-bell.tsx && npx playwright test tests/e2e/notifications-realtime.spec.ts</automated>
  </verify>
  <done>All tests in `notifications-realtime.spec.ts` pass, including the new badge-clearing test. `npx tsc --noEmit` is clean. The badge-updates-without-a-page-reload test that existed before this task still passes unchanged.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Localize specialty names to Hebrew on every patient/doctor-facing surface</name>
  <files>lib/i18n/specialty.ts, components/search/doctor-card.tsx, components/search/search-filters.tsx, components/doctor-request-dialog.tsx, app/doctors/[id]/page.tsx, app/patient/favorites/page.tsx, tests/e2e/locale-switching.spec.ts</files>
  <read_first>
    Read each call site in full before editing it — the field name differs between the view-backed shape (`specialty_name_en` / `specialty_name_he`, flat on the doctor row) and the join-backed shape (`specialty.name_en` / `specialty.name_he`, nested and nullable). Do not assume one shape covers all sites.

    - `components/search/doctor-card.tsx` line 86 — flat shape, `DoctorSearchResult` already carries both fields.
    - `app/patient/favorites/page.tsx` line 79 (`FavoriteRow`) — same flat shape, reuses `DoctorSearchResult`.
    - `app/doctors/[id]/page.tsx` lines 300 and 371 — nested nullable shape, both already guarded by `doctor.specialty ? ... : null`.
    - `components/search/search-filters.tsx` lines 20, 73, 79-97, 108-110, 158-162 — the specialty query currently selects `id,name_en` only.
    - `components/doctor-request-dialog.tsx` lines 59-66 and 186-190 — already selects both names; only the render is English-only.

    Read `lib/i18n/notification-copy.ts` for the shape convention this project uses for a small pure i18n helper module, and `lib/i18n/locale-provider.tsx` for `useLocale()`.

    Confirm before you start: all five files above are Client Components (`"use client"` on line 1), so every one of them uses `useLocale()`. No Server Component path is involved and `lib/i18n/server.ts` is not needed for this task.
  </read_first>
  <behavior>
    - Under the Hebrew locale, a doctor whose specialty has a Hebrew name renders that Hebrew name on the search card; the English name is absent from that card.
    - Under the English locale, the same card renders the English name.
    - A specialty whose Hebrew name is missing or blank falls back to the English name rather than rendering an empty label.
    - Switching locale re-renders the search specialty filter with the new-locale labels without a hard page reload.
  </behavior>
  <action>
    Create `lib/i18n/specialty.ts` exporting one pure function, `specialtyLabel(locale: Locale, nameEn: string, nameHe: string | null | undefined): string`. It returns the Hebrew name when the locale is Hebrew AND the Hebrew name is a non-blank string after trimming; otherwise it returns the English name. Import `Locale` from `@/lib/i18n/dictionaries`. This fallback deliberately mirrors `translate()`'s locale-then-English chain locked in phase 06-05 — a specialty must never render as an empty label. Add a short header comment naming the two field shapes it serves and why it takes bare strings rather than a row object.

    Then wire it into all five call sites. Each site calls `useLocale()` at the top of its component (in `app/patient/favorites/page.tsx` that is `FavoriteRow`, which already calls `useT()`) and replaces the raw English field read with a `specialtyLabel(...)` call. Nested sites keep their existing null guard on the specialty object and pass its two name fields through.

    `components/search/search-filters.tsx` needs one extra structural change, and it is the one place a naive fix breaks. Its `useEffect` has an empty dependency array and stores pre-resolved `{ id, label }` rows in state, so resolving the label inside the effect would freeze the initial locale's labels until a hard reload — a locale switch only re-renders, it does not re-run that effect. Instead:
    - Widen the specialty query to also select the Hebrew name column. Leave the `.order(...)` clause exactly as it is; result ordering is not part of this fix and must not change.
    - Redefine the local `OptionRow` type (used only for specialties in this file — confirm with a grep before changing it) to carry the id plus both raw name fields instead of a pre-resolved label.
    - Resolve the label at render time in BOTH consumers: the `specialtyItems` map handed to `<Select items={...}>` and the `SelectItem` body. Both must resolve through the same helper so the trigger label and the popup entry can never disagree.

    Explicitly OUT of scope, leave English and do not touch: `components/admin/doctors-page-client.tsx`, `components/admin/reference-data-page-client.tsx`, `components/admin/doctor-requests-page-client.tsx`, `app/admin/appointments/page.tsx`, and every `app/api/**` route select. The admin interface has no `t()` calls anywhere and is English-only by construction; localizing one column inside an otherwise-English table would be a regression, not a fix. `scripts/seed.ts` is seed data, not display, and is likewise untouched.

    Then add ONE Playwright test to `tests/e2e/locale-switching.spec.ts`, titled `specialty names render in the active locale on the search results`. Build a fixture specialty with two distinct unique tokens for its English and Hebrew names using the existing reference-data helper in `tests/e2e/helpers/`, plus an active doctor pointing at it with a future slot — mirror how `tests/e2e/search-filters.spec.ts` sets up its doctor fixtures rather than inventing a new pattern. Assert: with the Hebrew locale cookie set, searching for that doctor shows the Hebrew token and the English token is not visible on the card; with the English cookie, the English token shows. Reuse the file's existing `context.addCookies` locale-cookie idiom and register cleanup with the helpers' existing teardown.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx playwright test tests/e2e/locale-switching.spec.ts tests/e2e/search-filters.spec.ts tests/e2e/patient-favorites.spec.ts tests/e2e/doctor-profile.spec.ts tests/e2e/doctor-request.spec.ts</automated>
  </verify>
  <done>`lib/i18n/specialty.ts` exists and is imported by all five call-site files (`grep -rl "i18n/specialty" components app | wc -l` reports 5). The new locale test passes in both locale directions. `npx tsc --noEmit` is clean. Search, favorites, doctor-profile, doctor-request and locale specs all pass with no assertion text changed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Route the admin appointments doctor filter through the admin API and surface load errors</name>
  <files>app/admin/appointments/page.tsx, tests/e2e/admin-oversight-views.spec.ts</files>
  <read_first>
    Read `app/admin/appointments/page.tsx` in full (155 lines). Note two things: the doctor-options effect (lines 53-60) queries the table directly through the browser client and destructures only `data`, discarding `error` entirely; and the page has zero `t()` calls — it is English-only like the rest of the admin interface, so every string you add here stays a plain English literal.

    Read `app/api/admin/doctors/route.ts` for the response contract: `GET` is `requireAdmin()`-gated, returns `{ doctors: [...] }` where each entry carries `id` and `full_name` among other fields, ordered by `created_at` descending then `id` descending — NOT alphabetically.

    Read `components/admin/doctors-page-client.tsx` lines 264-292 (the `listStatus` state + `loadDoctors` + `handleRetry` trio) and lines 713-727 (the destructive-paragraph + outline-Retry error render). That is the convention to match.
  </read_first>
  <behavior>
    - The doctor dropdown is populated from the admin-gated API route, not a direct table query.
    - Options stay ordered alphabetically by doctor name, exactly as before this change.
    - When that request fails, the page renders a visible error message plus a Retry control near the doctor filter instead of an empty dropdown and silence.
    - Retry re-issues the request and, on success, populates the dropdown and clears the error.
    - The status/date filters and the oversight table below are unaffected in every branch.
  </behavior>
  <action>
    In `app/admin/appointments/page.tsx`:

    1. Replace the direct browser-client table query in the doctor-options effect with a `fetch("/api/admin/doctors")`, reading `data.doctors` from the JSON body and mapping each entry to the existing `DoctorOption` shape (`id`, `label` from the full name).
    2. Because that route orders by creation time rather than by name, sort the mapped options client-side by label using `localeCompare` before setting state. This preserves the alphabetical dropdown the page has today — dropping this step would be a silent UX regression, not a no-op.
    3. Add a `doctorOptionsStatus` state of `"loading" | "error" | "ready"`, mirroring `listStatus` in `components/admin/doctors-page-client.tsx`. Set `"error"` on a non-ok response and inside the catch of a thrown request; set `"ready"` on success. Extract the loader into a `useCallback` so a Retry handler can call it again, following that same file's structure.
    4. When the status is error, render — directly beneath the doctor `Select`, inside its existing flex column — a `<p className="text-sm text-destructive">` carrying the literal `Could not load doctors. Please refresh the page.` and an outline `Button` labelled `Retry` that resets the status to loading and re-runs the loader. Reuse the already-imported `Button`. Keep the wrapper spacing consistent with the surrounding filter columns and use logical-property utilities only.
    5. Delete the now-unused browser-client import from this file.

    Do not touch the oversight table, the endpoint the table itself reads, the status options list, the date-boundary helpers, or the API route.

    Then add ONE Playwright test to `tests/e2e/admin-oversight-views.spec.ts`, titled `the appointments doctor filter surfaces a failed doctor load`. Log in as an admin using the file's existing admin login helper, intercept the admin doctors endpoint with `page.route` and fulfil it with a 500 and a JSON error body, navigate to `/admin/appointments`, and assert both the error text and the Retry control are visible. In the same test (or a sibling assertion before the route interception) assert via `page.waitForRequest` that the page really requests that endpoint — that is what proves the direct table query is gone. `page.route` interception works here because this page is a Client Component doing a browser `fetch`; note that it would NOT work against a Server Component's own Supabase query (see the 06-10 summary).
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx next lint --file app/admin/appointments/page.tsx && npx playwright test tests/e2e/admin-oversight-views.spec.ts tests/e2e/admin-route-protection.spec.ts</automated>
  </verify>
  <done>`grep -v '^\s*//' app/admin/appointments/page.tsx | grep -c 'from("doctors")'` reports 0. `grep -c '/api/admin/doctors' app/admin/appointments/page.tsx` reports at least 1. The new failed-load test passes, and `admin-oversight-views.spec.ts` plus `admin-route-protection.spec.ts` pass with no pre-existing assertion modified.</done>
</task>

<task type="auto">
  <name>Task 4: Remove the duplicated doctor title from the two with-doctor prefix strings</name>
  <files>dictionaries/en.json, dictionaries/he.json</files>
  <read_first>
    Read `dictionaries/en.json` and `dictionaries/he.json` around lines 165-182 to see the exact current values and the surrounding key ordering (keys are sorted; do not reorder anything).

    Read `app/patient/page.tsx` lines 36-55 and `app/patient/appointments/page.tsx` lines 112-128 to confirm the render shape: the prefix key, a literal space, then `appointment.doctor?.full_name`. Confirm from `tests/e2e/seed-availability.spec.ts` lines 17-32 that every seeded doctor's stored `full_name` already begins with the title — that is why the separate prefix is a duplicate.
  </read_first>
  <action>
    Four value edits, no key additions, no component changes, no new dictionary keys.

    In `dictionaries/en.json`, set both `patient_appointments.with_doctor_prefix` and `patient_dashboard.with_doctor_prefix` to the bare preposition `with`.

    In `dictionaries/he.json`, set the same two keys to the bare Hebrew preposition `אצל`.

    <!-- planner-discipline-allow: with Dr. -->
    <!-- planner-discipline-allow: ד״ר -->
    Both files must be edited in lockstep — `dictionaries/he.json` is typed as a complete record over `TranslationKey`, so a key edited in one file and not the other is a compile error. Do not strip the title from `full_name` anywhere: the stored name is the single source of truth for how a doctor is displayed, and every other surface in this app (search cards, doctor profile, favorites) already renders it raw with no added prefix. Do not add a new key, do not rename these two, and do not touch `patient_dashboard.unknown_doctor` or `patient_appointments.unknown_doctor`.

    Before committing, grep `tests/` for any spec asserting the old English or Hebrew prefix literal (both variants). A repo-wide grep at planning time found no such assertion, but re-verify rather than trust it — if a hit exists, update that assertion to the new value in the same commit and record it in the summary.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx playwright test tests/e2e/patient-dashboard.spec.ts tests/e2e/appointment-history.spec.ts tests/e2e/locale-switching.spec.ts</automated>
  </verify>
  <done>`grep -c '"patient_dashboard.with_doctor_prefix": "with",' dictionaries/en.json` reports 1 and the same holds for the `patient_appointments` key. Both Hebrew counterparts carry the bare Hebrew preposition. `npx tsc --noEmit` is clean, proving both dictionaries still cover the identical key set. The patient dashboard, appointment history and locale specs pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser -> `/api/notifications/{id}/read` | Caller-supplied notification id crosses here (task 1). |
| browser -> `/api/admin/doctors` | Admin-only doctor roster crosses here (task 3). |
| browser -> `specialties` table via RLS | Public reference data read directly by the client (task 2). |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-FHM-01 | Information disclosure | `app/admin/appointments/page.tsx` doctor list | low | mitigate | Task 3 moves the read behind `requireAdmin()` on `/api/admin/doctors`, adding a route-level authorization check in front of the RLS layer that was previously the only gate. Net reduction in exposure. |
| T-FHM-02 | Tampering | notification read-state local update (task 1) | low | mitigate | Local `read_at` is set only for ids whose PATCH the server confirmed with an ok response; a rejected or non-ok id stays unread. The client never presumes a write succeeded, so the badge cannot silently diverge from persisted state. |
| T-FHM-03 | Information disclosure | `specialtyLabel()` render sites (task 2) | low | accept | Specialty names are public reference data already served under `select using (true)` RLS and already rendered in English on the same anonymous-reachable surfaces. Rendering the Hebrew name of the same row exposes no new field or row. |
| T-FHM-04 | Tampering | npm/pip/cargo installs | high | mitigate | No package installs in this plan — every task edits existing files or adds a source module. If any task turns out to need a dependency, stop and run the package legitimacy gate before installing. |
</threat_model>

<verification>
After all four tasks:

1. `npx tsc --noEmit` — clean (also proves the two dictionaries still cover an identical key set).
2. `npx next lint` — clean.
3. `npm run build` — succeeds.
4. `npx playwright test` — full suite. Compare failures against the tracked shared-dev-DB residue / Supabase-rate-limit flakiness class recorded in `WINDOWS.md` (ids 1-12) and in STATE.md's Blockers section. Any failure inside a spec this plan touched, or inside `patient-dashboard`, `appointment-history`, `notifications-realtime`, `locale-switching`, `search-filters`, `patient-favorites`, `doctor-profile`, `doctor-request`, `admin-oversight-views` or `admin-route-protection`, is a real regression and must be fixed, not attributed to flakiness.
5. Re-run any failing spec in isolation before classifying it as pre-existing residue.
</verification>

<success_criteria>
- Opening the bell clears the badge and the unread dots without a reload, and the cleared state survives a reload.
- All six patient/doctor-facing specialty render sites resolve through `specialtyLabel()`; a Playwright test proves Hebrew and English both render correctly on the search card.
- The admin appointments doctor filter requests `/api/admin/doctors`, keeps its alphabetical ordering, and shows an error + Retry when that request fails.
- Neither `dictionaries/en.json` nor `dictionaries/he.json` carries a doctor title inside the two `with_doctor_prefix` values; no dictionary key was added or removed.
- Four commits, one per task, each independently buildable.
- The summary records, per finding, what Playwright coverage already existed versus what this plan added, and flags any remaining gap.
</success_criteria>

<output>
Create `.planning/quick/260817-fhm-fix-4-ui-quality-findings-notification-b/260817-fhm-SUMMARY.md` when done.

The summary must include a short **Test coverage** section with one row per finding: coverage that existed before this plan, coverage added by this plan, and any remaining gap. Known starting state, verified at planning time:
- Finding 1 (bell badge): `tests/e2e/notifications-realtime.spec.ts:258` covers the badge *incrementing* via Realtime; nothing covered it *clearing*. Gap closed by task 1.
- Finding 2 (specialty i18n): zero coverage — no spec asserted a specialty label in either locale. Gap closed by task 2.
- Finding 3 (admin doctor filter): zero coverage of the filter's data source or failure path; `admin-oversight-views.spec.ts` covers the table below it. Gap closed by task 3.
- Finding 4 (doubled title): a repo-wide grep found no spec asserting the old prefix literal, so no assertion update was expected — record what the task's own re-grep actually found.
</output>
