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
