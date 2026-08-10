---
phase: 04-doctor-availability-management
plan: 03
subsystem: api
tags: [nextjs, supabase, postgres, playwright, exclusion-constraint]

requires:
  - phase: 04-doctor-availability-management
    plan: 02
    provides: DELETE /api/doctor/slots/[id] (the un-block route this plan reuses), requireDoctor(), ScheduleEntry, groupEntriesByJerusalemDay()
provides:
  - "validateBlockedPeriodInput(body) in lib/validation/availability.ts — shares the start/end ladder with validateSlotInput via an internal validateStartEnd() helper, adds an optional string-typed reason check"
  - "POST /api/doctor/blocked-periods — 201 { slot } / 400 / 401 / 403 / 409 / 500, one continuous availability_slots row per call, status='blocked'"
  - "Block period trigger (variant=outline) + its five-field dialog, and blocked-row reason rendering, on /doctor/schedule"
  - "tests/e2e/doctor-schedule-block-period.spec.ts — 14 cases covering AVAIL-06, AVAIL-07 and D-03/D-04/D-08/D-09 worked examples"
affects: [04-04-overlap-and-visibility]

actuals:
  tokens: 61000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Shared validation ladder: validateStartEnd(body, pastMessage) is called by both validateSlotInput and validateBlockedPeriodInput so shape/parseability/range-order faults can never report differently between the two write paths — only the past-date message string differs per caller"
    - "Trim-to-test, never trim-to-store: blankness is decided by reason.trim().length === 0, but the stored/sent value is the reason exactly as received — the only way a free-text field can round-trip byte-identical while still treating whitespace-only input as absent"

key-files:
  created:
    - tests/e2e/doctor-schedule-block-period.spec.ts
  modified:
    - lib/validation/availability.ts
    - app/api/doctor/blocked-periods/route.ts
    - app/doctor/(gated)/schedule/page.tsx

key-decisions:
  - "validateBlockedPeriodInput message contract (locked for plan 04-04): missing/non-string startAt or endAt -> \"Start and end time are required.\"; unparseable date -> \"Invalid date/time.\"; startAt <= now -> \"Cannot block a period in the past.\" (block-specific, differs from add-slot's \"Cannot add a slot in the past.\"); startAt >= endAt -> \"Start time must be before end time.\"; reason present and non-string -> \"Reason must be text.\""
  - "POST /api/doctor/blocked-periods insert payload keys (locked for plan 04-04): { doctor_id: guard.doctorId, start_at, end_at, status: \"blocked\", reason: reasonToStore }. error.code 23P01 -> 409 \"This time overlaps your existing schedule.\" (byte-identical to the add-slot route); error.code 23514 -> 400 \"Start time must be before end time.\"; anything else -> 500 \"Could not save this time slot. Please try again.\"; success -> 201 { slot: data } with data selected as \"id, start_at, end_at, status, reason\""
  - "Rule 1 fix (found by Task 3 case 6, committed with Task 3): the reason is now sent and stored exactly as submitted, never trimmed. The original implementation trimmed the reason before both the client's fetch body and the route's insert, which would have silently altered a reason with meaningful leading/trailing whitespace and broken the byte-identical round-trip D-04 requires. Trimming is now used only as a blankness test on both sides — the value that crosses the wire and lands in the column is the doctor's input unchanged."
  - "No un-block/status-toggle route was added in this plan, per D-01 and the plan's own scope guard — un-blocking is deleting the row through plan 04-02's DELETE /api/doctor/slots/[id], proven end to end by Task 3 case 13."

patterns-established:
  - "Any future write path that adds a second entry point into a table already governed by an exclusion constraint should factor its start/end validation through the same internal ladder used by the first entry point, rather than hand-copying it — this is what keeps two independent routes from silently disagreeing on which fault a given body has."
  - "Any free-text field whose value must round-trip byte-identical (D-04-style contracts) must trim only for a blankness check, never assign the trimmed value to the variable that gets sent or stored."

requirements-completed: [AVAIL-06]

coverage:
  - id: D1
    description: "A doctor blocks a period from /doctor/schedule via a Block period button (variant=outline) beside Add slot, opening its own five-field dialog (start date, start time, end date, end time, optional reason) that POSTs to /api/doctor/blocked-periods and shows the new row under the correct day heading with a Blocked badge and the reason text"
    requirement: "AVAIL-06"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-block-period.spec.ts#1. AVAIL-06 through the UI"
        status: pass
    human_judgment: false
  - id: D2
    description: "A same-day partial block, a multi-day block spanning night hours, and a seven-day vacation range each produce exactly ONE availability_slots row, never a per-day or per-business-hour decomposition (D-03's three worked examples)"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-block-period.spec.ts#2. D-03 same-day, #3. D-03 multi-day, #4. D-03 vacation range"
        status: pass
    human_judgment: false
  - id: D3
    description: "An absent reason stores null (not an empty string) and is not a validation failure; a 400-character reason round-trips byte-identical through the database and renders wrapped, un-truncated in the UI (D-04)"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-block-period.spec.ts#5. D-04 no reason, #6. D-04 verbatim reason"
        status: pass
    human_judgment: false
  - id: D4
    description: "A block overlapping any existing entry of any status is rejected 409 with the single generic overlap string, which never names the collided status (AVAIL-07, D-11, T-04-05); a block whose endpoint exactly touches an existing entry's endpoint is accepted 201 in both directions (half-open tstzrange bound)"
    requirement: "AVAIL-07"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-block-period.spec.ts#7. AVAIL-07 overlap, #8. AVAIL-07 adjacency"
        status: pass
    human_judgment: false
  - id: D5
    description: "A block starting in the past, or whose start is not strictly before its end, is rejected 400 with its own message before any insert; a body missing endAt is rejected 400, never 500 (D-08, D-09, empty-field backstop)"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-block-period.spec.ts#9. D-08, #10. D-09, #11. Empty-field backstop"
        status: pass
    human_judgment: false
  - id: D6
    description: "A forged doctorId in the POST body cannot redirect the block to another doctor's schedule — the row belongs to the session doctor and the named other doctor has zero rows (D-06, T-04-01); an anonymous request returns 401 and a logged-in patient returns 403"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-block-period.spec.ts#12. D-06/T-04-01, #14. Guard"
        status: pass
    human_judgment: false
  - id: D7
    description: "Un-blocking is deleting the blocked row through plan 04-02's DELETE /api/doctor/slots/[id]; the row is gone afterward and no available row regenerates in the freed range (D-01, D-02)"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-block-period.spec.ts#13. D-01 round trip"
        status: pass
    human_judgment: false
  - id: D8
    description: "Human check (deferred to end-of-phase verification per this plan's own <verification>): the Block period button reads as visually secondary next to Add slot, a multi-day block reads sensibly under its start-day heading, and a long reason wraps cleanly rather than pushing the row wide"
    verification: []
    human_judgment: true
    rationale: "Plan explicitly defers this visual check to end-of-phase human verification; not covered by an automated assertion in this plan's spec beyond the scrollWidth<=clientWidth check in case 6."

duration: 120min
completed: 2026-08-09
status: complete
---

# Phase 04 Plan 03: Block a Period of Unavailability Summary

**`validateBlockedPeriodInput` sharing its start/end ladder with the add-slot validator, `POST /api/doctor/blocked-periods` writing exactly one continuous `blocked` row through the same `23P01`-to-generic-409 translation the add-slot route uses, a secondary `Block period` dialog and blocked-row reason rendering on `/doctor/schedule`, and a 14-case Playwright spec proving AVAIL-06/AVAIL-07 including a Rule 1 fix so the optional reason round-trips byte-identical.**

## Performance

- **Duration:** ~120 min (spanning a session interruption between Task 2 and Task 3)
- **Started:** 2026-08-09
- **Completed:** 2026-08-09
- **Tasks:** 3 (all execution, no checkpoints)
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- `validateBlockedPeriodInput(body)`: reuses `validateSlotInput`'s exact start/end fault ladder via a new internal `validateStartEnd()` helper (identical messages for shape, parseability and range order), swaps in the block-specific past-date message, and adds an optional `reason` check that only rejects a non-string value — no length cap, no content filtering (D-04)
- `POST /api/doctor/blocked-periods`: `requireDoctor()` guard, one unconditional insert (no select-then-insert pre-check, per RESEARCH.md Pitfall 2), `doctor_id` from the guard only, `status: "blocked"`, `reason` stored exactly as submitted or `null` for a blank/absent value; `error.code` branched exactly like the add-slot route (`23P01` -> byte-identical 409 overlap string, `23514` -> 400 range message, else 500)
- `/doctor/schedule`: a `variant="outline"` `Block period` button beside the default-variant `Add slot` button, opening its own five-field dialog (`Textarea` for the optional reason, framed only as a doctor-side operational note); blocked rows render their reason as muted, wrapped, un-truncated text beside the `Blocked` badge
- `tests/e2e/doctor-schedule-block-period.spec.ts`: 14 cases — the UI happy path, all three D-03 exactly-one-row worked examples, D-04 null-vs-verbatim reason round-trip, AVAIL-07 overlap plus both adjacency directions, D-08/D-09 validation, the empty-field backstop, D-06 forged-doctorId isolation, the D-01 delete round-trip, and the anonymous/patient guard
- Rule 1 fix (found by Task 3 case 6): both the route and the dialog were trimming the reason before it was sent/stored, which would have broken the byte-identical round-trip D-04 requires for a reason with meaningful leading/trailing whitespace — fixed so trimming is used only to test for blankness, never to transform the stored value

## Task Commits

Each task was committed atomically:

1. **Task 1: `validateBlockedPeriodInput` and `POST /api/doctor/blocked-periods`** - `e7cd651` (feat)
2. **Task 2: Block period trigger and dialog, blocked-row reason rendering** - `75ca8e2` (feat)
3. **Task 3: `tests/e2e/doctor-schedule-block-period.spec.ts`, including the Rule 1 byte-identical-reason bugfix** - `ec05c1d` (test)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP/REQUIREMENTS update)

## Files Created/Modified

- `lib/validation/availability.ts` - adds `validateBlockedPeriodInput` and the shared `validateStartEnd` helper
- `app/api/doctor/blocked-periods/route.ts` - `POST` handler (new file)
- `app/doctor/(gated)/schedule/page.tsx` - `Block period` trigger, its dialog, and blocked-row reason rendering
- `tests/e2e/doctor-schedule-block-period.spec.ts` - 14-case Playwright spec (new file)

## Decisions Made

See `key-decisions` in frontmatter — the validator message contract and the insert payload/response shape are now locked for plan 04-04's overlap spec to assert against directly, and the byte-identical-reason fix is recorded as a Rule 1 auto-fix below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The optional reason was trimmed before being sent/stored, breaking the byte-identical round-trip D-04 requires**
- **Found during:** Task 3, case 6 (400-character reason round-trip assertion)
- **Issue:** Both `POST /api/doctor/blocked-periods` and the Block period dialog's submit handler trimmed the reason string before using it — the route stored `reason.trim()` and the dialog sent `blockReason.trim()`. D-04 requires the stored value to be byte-identical to what the doctor typed; a reason with meaningful leading/trailing whitespace would have silently lost it.
- **Fix:** Both sites now use `.trim()` only to test whether the reason is blank (`isBlankReason`); the value that is sent and stored is the original string, untransformed.
- **Files modified:** `app/api/doctor/blocked-periods/route.ts`, `app/doctor/(gated)/schedule/page.tsx`
- **Verification:** Task 3 case 6 asserts the stored `reason` is exactly `longReason` via a direct database read.
- **Committed in:** `ec05c1d` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for D-04 correctness. No scope creep — both call sites already existed from Tasks 1 and 2; only the trim-vs-store behavior changed.

## Issues Encountered

None beyond the Rule 1 fix documented above.

## User Setup Required

None.

## Next Phase Readiness

- `validateBlockedPeriodInput`'s exact message strings and `POST /api/doctor/blocked-periods`'s exact insert payload keys and response shape are locked contracts (see `key-decisions`) for plan 04-04's overlap-under-concurrency spec to drive this endpoint directly.
- AVAIL-07 is NOT marked complete by this plan — it is a shared requirement ID also declared by plan 04-04's frontmatter, which proves the concurrency half of the guarantee. It will flip to Complete when 04-04 finishes (requirements shared-ID gate, #2388).
- Full Playwright suite (217 tests, including this plan's 14) passes with no regressions to Phases 1-3 or plans 04-01/04-02.
- `/doctor/schedule` now has both write paths (Add slot, Block period) and the Delete/un-block control from 04-02; plan 04-04 adds no new UI, only proof specs and any hardening they surface.

---
*Phase: 04-doctor-availability-management*
*Completed: 2026-08-09*
