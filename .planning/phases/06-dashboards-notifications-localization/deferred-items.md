# Deferred Items — Phase 06

Out-of-scope discoveries logged during plan execution, per the executor's Scope Boundary rule
(only auto-fix issues directly caused by the current task's changes).

## 06-01: three pre-existing full-suite failures, unrelated to this plan's changes

**Found during:** Task 2's full-suite regression check (`npx playwright test`, run after committing
all 7 new files).

**Observed:** `npx playwright test` reported `3 failed / 287 passed / 24 skipped` (314 total). The 24
skipped are exactly this plan's new placeholder tests (0 failed among them, as required). The 3
failures are in files this plan never touches:

- `tests/e2e/admin-doctor-crud.spec.ts:226` — "the same PATCH body sent twice leaves the row and the
  doctor_languages count identical"
- `tests/e2e/appointment-reschedule.spec.ts:764` — case 11, `afterAll` hook timeout (30000ms exceeded)
- `tests/e2e/seed-availability.spec.ts:170` — case 4, "every doctor holding any slot holds between 6
  and 10 of them" — received 4, expected >=6

**Why out of scope:** This plan adds only 7 new files (2 fixture helpers + 5 spec files), all under
`tests/e2e/`, and zero production code. Every new test is declared with `test.fixme(`, so no test body
in this plan's files executes — they cannot have written any fixture rows or otherwise perturbed
shared state. The three failing tests are pre-existing and match a condition STATE.md already tracks
as a known blocker: "Shared remote dev database holds accumulated Playwright test residue in
specialties/locations/doctors ... not a defect in [seeding], which correctly seeded and idempotently
re-ran its own 12/12/12 demo rows; a project reset or manual cleanup before final demo/grading would
present a cleaner catalog." The `seed-availability` failure (doctor holding only 4 slots instead of
6-10) is consistent with residue skewing the demo-doctor slot distribution; the other two are
`afterAll` hook timeouts / idempotency assertions plausibly sensitive to the same accumulated-row
volume slowing down cleanup queries.

**Action:** Not fixed — out of this plan's scope per the Scope Boundary rule. Recorded here and in
`.planning/WINDOWS.md` for visibility before `/gsd-ship`. Worth a project reset / manual cleanup pass
(already an open item in STATE.md Blockers/Concerns) before the final demo.

## 06-03: same pre-existing failure class recurs, on a third different admin spec file

**Found during:** the plan's required `npx playwright test` full-suite re-run, after fixing 7
pre-existing specs whose assertions this plan's own dashboard rewrite genuinely broke (documented as
Deviations, not here — those were in-scope, direct-consequence fixes, not deferred).

**Observed:** `300 passed / 11 skipped / 3 failed` (314 total; the 11 skipped are the still-unactivated
`test.fixme(` placeholders for notifications-realtime.spec.ts and locale-switching.spec.ts, owned by
later plans). The 3 failures:

- `tests/e2e/admin-route-protection.spec.ts:230` — "every admin endpoint returns 401
  unauthenticated, 403 for a patient session, and 403 for a doctor session"
- `tests/e2e/appointment-reschedule.spec.ts:764` — case 11, `afterAll` hook timeout (30000ms exceeded)
  — identical failure to 06-01/06-02
- `tests/e2e/seed-availability.spec.ts:170` — case 4, doctor slot count out of the 6-10 range —
  identical failure to 06-01/06-02

**Why out of scope:** `appointment-reschedule.spec.ts:764` and `seed-availability.spec.ts:170` are
byte-identical recurrences of the exact failures logged by 06-01 and 06-02. The third slot in this
recurring pattern has now landed on a third different admin spec file across three runs
(`admin-doctor-crud.spec.ts:226` in 06-01, `admin-route-protection.spec.ts:230` in 06-02, and again
`admin-route-protection.spec.ts:230` here) — none touched by this plan's changes (`app/patient/page.tsx`,
`app/doctor/(gated)/page.tsx`, and 9 test spec files, none of which reference `/admin` endpoints).
`admin-doctor-status.spec.ts`, which failed in an earlier same-session full-suite run before these test
fixes were committed, was independently re-run in isolation and passed 5/5 — confirming that class of
failure is a full-suite-only, shared-dev-DB-residue artifact rather than a defect in any spec file's
own logic, consistent with the already-tracked STATE.md blocker.

**Action:** Not fixed — out of this plan's scope per the Scope Boundary rule. Recorded here and in
`.planning/WINDOWS.md`.

## 06-04: fourth recurrence of the same failure class, plus a transient dev-server connectivity blip

**Found during:** the plan's required `npx playwright test` full-suite run, after committing Task 3.

**Observed:** `301 passed / 11 skipped / 9 failed` (321 total; up from 314 by +1 Task 1 test and +6
Task 2/3 API-contract tests). The 9 failures:

- 5 in `tests/e2e/notifications-realtime.spec.ts` — all 5 of this plan's new
  `GET/PATCH /api/notifications API contract (06-04)` tests
- 3 in `tests/e2e/patient-dashboard.spec.ts` (from 06-03, untouched by this plan)
- 1 in `tests/e2e/seed-availability.spec.ts:170` — the same doctor-slot-count assertion that has now
  failed in every one of 06-01, 06-03, and this run

All 8 of the first two groups failed with the identical error `net::ERR_CONNECTION_REFUSED at
http://localhost:3000/...` — the Next.js dev server (`webServer` in `playwright.config.ts`) was
unreachable for a window during the 27-minute run, not a defect in either this plan's routes or
06-03's dashboard pages. Re-running exactly those 4 spec files in isolation immediately afterward
produced `17 passed / 1 failed / 6 skipped` — every one of the 8 connection-refused failures passed
cleanly, confirming the transient-connectivity theory. The 1 remaining failure
(`seed-availability.spec.ts:170`, doctor slot count 3 < 6) reproduced identically in isolation — this
is the fourth recurrence of the same shared-dev-DB-residue class first logged by 06-01 (id 1) and
06-03 (id 2), now id 3 in `.planning/WINDOWS.md`.

**Why out of scope:** This plan's changes are `supabase/migrations/20260812090000_...sql`,
`app/api/notifications/route.ts`, `app/api/notifications/[id]/read/route.ts`, and additive-only test
edits to `tests/e2e/notifications-realtime.spec.ts`. None of the 3 `patient-dashboard.spec.ts` failures
or the 1 `seed-availability.spec.ts` failure touch code this plan modified, and this plan's own 5
"failures" were proven to be the dev-server blip, not a defect in the new routes (the identical 6 tests
already passed cleanly in an isolated run immediately after Task 3, before the full-suite run started).

**Action:** Not fixed — out of this plan's scope per the Scope Boundary rule. Recorded here and in
`.planning/WINDOWS.md` (ledger id 3).

## 06-10: pre-existing Base UI `nativeButton` console warning on `Button render={<Link .../>}`

**Found during:** Task 1/2's spec runs against `/search` and `/patient` — browser console output
repeatedly logged `Base UI: A component that acts as a button expected a native <button> because the
`nativeButton` prop is true. Rendering a non-<button> removes native button semantics...` for
`components/search/doctor-card.tsx`'s "View profile" button and `app/patient/page.tsx`'s three
quick-link buttons, all of which use shadcn's `Button` with `render={<Link .../>}` (producing an `<a>`,
not a `<button>`).

**Why out of scope:** This pattern (`Button render={<Link .../>}`) is used extensively across the
codebase (login/signup pages, search pagination, dashboard quick links, favorites empty-state CTA) and
predates this plan — none of it was introduced or modified by 06-10's changes (this plan touched only
`tests/e2e/locale-switching.spec.ts`; the grep audit found zero physical-direction utilities to fix in
`favorite-toggle.tsx`, `notification-bell.tsx`, `doctor-card.tsx`, or `favorites/page.tsx`, so none of
those four files needed an edit either). It is a console warning, not a test failure — every assertion
in every affected test passed. Fixing it would mean auditing every `Button render={<Link>}` call site
project-wide (an unbounded, cross-cutting change unrelated to RTL/I18N-02), squarely outside this plan's
declared file scope.

**Action:** Not fixed — out of this plan's scope per the Scope Boundary rule. Recorded here for
visibility before `/gsd-ship`.
