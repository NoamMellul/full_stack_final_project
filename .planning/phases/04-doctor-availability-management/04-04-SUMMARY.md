---
phase: 04-doctor-availability-management
plan: 04
subsystem: testing
tags: [playwright, postgres, exclusion-constraint, rls, concurrency]

requires:
  - phase: 04-doctor-availability-management
    plan: 03
    provides: validateBlockedPeriodInput, POST /api/doctor/blocked-periods (locked message strings and insert payload/response shape)
provides:
  - "tests/e2e/doctor-schedule-overlap.spec.ts — 11 cases proving availability_slots_no_overlap (not an application pre-check) is what prevents two overlapping writes, under real concurrency and across every status pairing"
  - "tests/e2e/doctor-schedule-visibility.spec.ts — 9 cases sweeping the cross-doctor ownership boundary, reason privacy under anonymous/patient RLS, and booked-row survival"
affects: []

actuals:
  tokens: 51000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Concurrency proof via Promise.all + sorted-status assertion: two page.request.post calls fired inside one Promise.all, their statuses sorted before comparing to [201, 409] — never asserting which specific request won, since the exclusion constraint's guarantee is on the pair, not on request ordering"
    - "Pairwise message-uniformity assertion: every captured 409 body across concurrency, idempotency and the six-direction status matrix is pushed into one shared array and compared against the array's own first element, so a future edit to one call site that leaves the other untouched fails the comparison instead of two separate literal checks silently drifting apart"
    - "Multi-context ownership sweep: persistent per-role BrowserContext objects (Doctor A, Doctor B, patient, unauthenticated) created once in beforeAll, mirroring admin-route-protection.spec.ts's pattern, with a single assertDoctorAUnchanged() helper re-run after every case that attempts a cross-boundary write"
    - "Per-run distinctive fixture text (a randomUUID()-suffixed reason) so a leftover row from a prior run can never make a privacy assertion pass for the wrong reason"

key-files:
  created:
    - tests/e2e/doctor-schedule-overlap.spec.ts
    - tests/e2e/doctor-schedule-visibility.spec.ts
  modified: []

key-decisions:
  - "No route handler required hardening — both specs passed against app/api/doctor/slots/route.ts, app/api/doctor/blocked-periods/route.ts and app/api/doctor/slots/[id]/route.ts exactly as plans 04-01 through 04-03 left them. Both task commits are test-file-only (no production code changed), which is itself the finding: the database-level guarantee plans 04-01/04-03 built on the exclusion constraint holds under concurrency and across the full status matrix with no application-layer patching needed."
  - "The concurrency assertion is deliberately winner-agnostic by design (plan's own instruction: 'assert on the pair, never on which one won') — the spec sorts [responseA.status(), responseB.status()] before comparing to [201, 409] and never logs or asserts which specific request received the 201. Observed across every local run of cases 1-3: the pair was always exactly one 201 and one 409, zero double-201s and zero double-409s, confirming the GiST exclusion constraint — not an application pre-check — is the authoritative guarantee (AVAIL-03, AVAIL-07, T-04-02)."
  - "AVAIL-07 is now fully proven: plan 04-03 covered the single-request adjacency/overlap shape at the block-period route, and this plan covers the concurrency and cross-path (add-slot vs block-period) edge the exclusion constraint is actually for."

patterns-established:
  - "Any future table protected by a Postgres exclusion constraint should get its own Promise.all-based concurrency spec asserting a sorted status pair, following this plan's pattern rather than trusting a single-threaded test to represent real concurrent behaviour — this is exactly the failure mode (an application check that looks correct serially) the plan's RESEARCH.md flagged."
  - "A cross-actor ownership/visibility sweep for a resource with more than one write path belongs in one dedicated spec (persistent per-role contexts, one re-usable 'assert unchanged' helper) rather than scattered incidentally across feature specs, so the full boundary is provably closed in one place."

requirements-completed: [AVAIL-03, AVAIL-07]

coverage:
  - id: D1
    description: "Two concurrent POST /api/doctor/slots requests for the same doctor and time range resolve to exactly one 201 and one 409, and exactly one row exists afterward — proving the GiST exclusion constraint, not an application pre-check, is the guarantee"
    requirement: "AVAIL-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-overlap.spec.ts#1. Concurrency, add-slot path"
        status: pass
    human_judgment: false
  - id: D2
    description: "Two concurrent requests across the two write paths (add-slot and block-period) for the same overlapping range likewise resolve to exactly one 201 and one 409"
    requirement: "AVAIL-07"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-overlap.spec.ts#2. Concurrency, cross-path"
        status: pass
    human_judgment: false
  - id: D3
    description: "A duplicate submission of the identical add-slot body creates exactly one row (201 then 409); a range whose endpoint exactly touches an existing entry's endpoint is accepted 201 in both directions on both write paths (half-open tstzrange bound)"
    requirement: "AVAIL-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-overlap.spec.ts#3. Duplicate submission idempotency, #4. Adjacency start-touching-end, #5. Adjacency end-touching-start"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every one of the six status-pairing directions (available/blocked new-row over available/blocked/booked existing-row) is rejected 409, every partial-overlap containment shape (strictly inside, strictly containing, leading-edge, trailing-edge) is rejected 409, and every captured 409 body across all these cases is byte-identical to every other one"
    requirement: "AVAIL-07"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-overlap.spec.ts#6. Status matrix, #7. Message uniformity, #9. Partial overlap shapes"
        status: pass
    human_judgment: false
  - id: D5
    description: "A rejected overlap leaves the doctor's row count unchanged; a malformed body (missing endAt, null startAt) returns 400 on both write paths, never 500, and creates no row; a second doctor's identical range does not block the first doctor's own request (the constraint is scoped per doctor_id)"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-overlap.spec.ts#8. No side effect on rejection, #10. Malformed body backstop, #11. Cross-doctor non-collision"
        status: pass
    human_judgment: false
  - id: D6
    description: "Doctor B cannot add, block or delete anything on Doctor A's schedule via a forged doctorId or a foreign slot id; Doctor B's own GET never leaks one of Doctor A's ids or the private reason text (D-06, D-07, T-04-01, T-04-03)"
    requirement: "AVAIL-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-visibility.spec.ts#1. Write sweep forged doctor id, #2. Delete sweep foreign slot id, #3. Read isolation"
        status: pass
    human_judgment: false
  - id: D7
    description: "An anonymous or logged-in-patient Supabase client, reading availability_slots directly (bypassing every route handler), receives only available rows and never a reason value — proving the RLS policy itself, not application discipline, is the boundary (T-04-06); the same clients' direct write/delete attempts against another doctor's rows all fail with no side effect"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-visibility.spec.ts#4. Anonymous read, #5. Patient read, #6. Anonymous and patient write attempts"
        status: pass
    human_judgment: false
  - id: D8
    description: "A booked row survives every write path this phase exposes against it (DELETE, add-slot, block-period all rejected with their proper message) and is byte-identical afterward — status, start_at and end_at unchanged; a four-endpoint anonymous/patient guard sweep and a final full-state re-read confirm no side effect anywhere in the boundary sweep"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-visibility.spec.ts#7. Booked-row survival, #8. Guard sweep, #9. No side effect after the sweep"
        status: pass
    human_judgment: false
  - id: D9
    description: "Human check (deferred to end-of-phase verification per this plan's own <verification>): read both new specs and confirm each concurrency assertion is on a sorted status pair rather than a specific winner, and that no assertion was relaxed to make a case pass"
    verification: []
    human_judgment: true
    rationale: "Plan explicitly defers this review to end-of-phase human verification; independently spot-checked during close-out (both specs read in full — sorted-pair assertions and pairwise message comparison confirmed present as written, no relaxed assertions found) but recorded here as human_judgment per the plan's own deferral."

duration: 20min
completed: 2026-08-09
status: complete
---

# Phase 04 Plan 04: Overlap Enforcement Under Concurrency + Cross-Doctor Visibility Sweep Summary

**Two new Playwright specs — 20 cases, zero production code changes — proving `availability_slots_no_overlap` (not an application check) is what stops two overlapping writes even under real `Promise.all` concurrency and across every status pairing, and sweeping the full cross-doctor ownership/visibility boundary including direct anonymous/patient RLS reads.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-09
- **Completed:** 2026-08-09
- **Tasks:** 2 (all execution, no checkpoints)
- **Files modified:** 2 (2 created, 0 modified)

## Accomplishments

- `tests/e2e/doctor-schedule-overlap.spec.ts`: 11 cases — same-path and cross-path concurrency (`Promise.all` firing two POSTs, sorted statuses asserted `[201, 409]`), duplicate-submission idempotency, half-open-bound adjacency in both directions on both write paths, the full six-direction status matrix, pairwise 409-body message uniformity across 9 captured bodies, no-side-effect-on-rejection, four partial-overlap containment shapes, the malformed-body 400 backstop, and cross-doctor non-collision
- `tests/e2e/doctor-schedule-visibility.spec.ts`: 9 cases — a forged-`doctorId` write sweep, a foreign-slot-id delete sweep, read isolation, direct anonymous- and patient-Supabase-client reads proving the RLS policy itself (not route-handler discipline) hides `blocked`/`booked` rows and `reason` values, direct anonymous/patient write attempts, booked-row survival against all three write paths, a four-endpoint guard sweep, and a final byte-identical re-read of Doctor A's full row set
- Zero production code changes: both task commits are test-file-only. This is the plan's central finding — the database-level guarantee built across plans 04-01 through 04-03 (one exclusion constraint, one generic message, one RLS policy) held under concurrency and the full status/ownership/visibility matrix with no application-layer patching required
- AVAIL-03 and AVAIL-07 are both now fully proven and marked complete — AVAIL-07's shared-ID gate (held open by plan 04-03) is satisfied now that this, the last plan declaring it, has its own SUMMARY.md
- Full Playwright suite: 237/237 passing (217 carried over + this plan's 20), confirming no regression to Phases 1-3 or plans 04-01/04-02/04-03

## Task Commits

Each task was committed atomically:

1. **Task 1: `tests/e2e/doctor-schedule-overlap.spec.ts` — the exclusion constraint proven under concurrency and every status pairing** - `0670266` (test)
2. **Task 2: `tests/e2e/doctor-schedule-visibility.spec.ts` — cross-doctor ownership sweep, reason privacy, booked-row survival** - `c7cd049` (test)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP/REQUIREMENTS update)

## Files Created/Modified

- `tests/e2e/doctor-schedule-overlap.spec.ts` - 11-case Playwright spec (new file)
- `tests/e2e/doctor-schedule-visibility.spec.ts` - 9-case Playwright spec (new file)

## Decisions Made

See `key-decisions` in frontmatter. No production code was changed by this plan — both specs passed against the routes as built by plans 04-01 through 04-03, which is itself the evidence this plan exists to produce.

## Deviations from Plan

None — plan executed exactly as written. No route handler required hardening (the plan explicitly anticipated this might be necessary; it was not).

## Issues Encountered

None. The plan's own execution was interrupted mid-session by an unrelated API stream error immediately after both task commits landed and before SUMMARY.md was written; this SUMMARY and the STATE/ROADMAP/REQUIREMENTS update were completed in a follow-up close-out pass, which independently re-ran both new specs (20/20 pass), `npm run build`, `eslint` on both files, and the full suite (237/237 pass) before proceeding — no code was altered during that pass.

## User Setup Required

None.

## Next Phase Readiness

- Phase 04 (Doctor Availability Management) is now complete: all 4 plans done, all 7 requirements (AVAIL-01 through AVAIL-07) satisfied and proven end to end.
- The pattern this plan establishes — a `Promise.all` concurrency spec asserting a sorted status pair, plus a dedicated cross-actor ownership/visibility sweep with persistent per-role browser contexts — is the template Phase 5 (Appointment Booking & Lifecycle) should reuse directly: PROJECT.md's core commitment (two patients can never book the same slot) is the identical shape of guarantee this plan proved for `availability_slots`, now on the `appointments` table.
- `doctor_id`-scoped exclusion constraints, RLS policies restricting non-`available` rows to owner-or-admin, and the generic-409-message convention are all now proven patterns future phases can extend rather than re-derive.

---
*Phase: 04-doctor-availability-management*
*Completed: 2026-08-09*
