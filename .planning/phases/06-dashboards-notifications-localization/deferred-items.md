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
