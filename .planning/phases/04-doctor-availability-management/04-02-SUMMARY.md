---
phase: 04-doctor-availability-management
plan: 02
subsystem: api
tags: [nextjs, supabase, postgres, playwright, rls, concurrency]

requires:
  - phase: 04-doctor-availability-management
    plan: 01
    provides: requireDoctor() auth guard, ScheduleEntry type, groupEntriesByJerusalemDay(), /doctor/schedule page shell, GET/POST /api/doctor/slots
provides:
  - "DELETE /api/doctor/slots/[id] — ownership-scoped delete, live status guard, race-safe idempotency"
  - "Per-row Delete control + 'Delete this slot?' / 'Remove this block?' confirm dialogs on /doctor/schedule"
  - "role=status aria-live=polite feedback region on /doctor/schedule"
affects: [04-03-block-period, 04-04-overlap-and-visibility]

actuals:
  tokens: 5728
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Delete-then-check-affected-rows: .delete().eq(id).eq(doctor_id).select(\"id\") lets the handler distinguish 'I deleted it' from 'a concurrent request already did', because a plain .delete() with zero matching rows does not error in Postgres/PostgREST"
    - "404-as-existence-shield: the same NOT_FOUND_MESSAGE literal covers missing, already-deleted and foreign-doctor ids, so the response is never an oracle for whether another doctor's slot id is real (T-04-03)"
    - "Status read inside the same request as the write it gates: booked-row rejection reads status from the just-completed SELECT, never from a client-supplied or list-cached value (T-04-04)"

key-files:
  created:
    - tests/e2e/doctor-schedule-delete-slot.spec.ts
  modified:
    - app/api/doctor/slots/[id]/route.ts
    - app/doctor/(gated)/schedule/page.tsx

key-decisions:
  - "DELETE /api/doctor/slots/[id] response contract: 200 { success: true }; 401 { error: \"Not authenticated.\" }; 403 { error: \"Not authorized.\" }; 404 { error: \"This entry no longer exists.\" } (missing, already-deleted, or foreign-doctor id — all three indistinguishable); 409 { error: \"This slot has already been booked and can't be deleted.\" }; 500 { error: \"Could not delete this entry. Please try again.\" }"
  - "Rule 1 bugfix (found by Task 3 case 8, concurrency): the delete statement now chains .select(\"id\") and treats a zero-row result as 404, not success. Without this, two concurrent DELETE requests for the same id both received 200 — a plain PostgREST .delete() with no matching row does not surface as an error, it just silently affects zero rows, so the second racer's lookup-then-delete both 'succeeded' against a row the first racer had already removed."
  - "Reason-text rendering on blocked rows (UI-SPEC Layout — Schedule list) is explicitly plan 04-03's Task 2 responsibility, not this plan's — confirmed against 04-03-PLAN.md's own must-haves before implementing Task 2, so this plan's row rendering adds only the Delete control, leaving reason display untouched for 04-03 to add without conflict."
  - "Delete-confirm dialog copy branches on entry.status read from the page's already-loaded ScheduleEntry (not re-fetched at dialog-open time) — matches the existing add-slot dialog's state-driven pattern and keeps the confirm flow synchronous with the click."

patterns-established:
  - "Any future doctor-owned-resource DELETE route in this codebase should chain .select() on its delete and check the returned row count before reporting success — the concurrency bug fixed here would recur identically in any handler that does lookup-then-delete without this check."

requirements-completed: [AVAIL-04, AVAIL-05]

coverage:
  - id: D1
    description: "A doctor deletes their own available row through the UI; it disappears from the list and no longer exists in availability_slots"
    requirement: "AVAIL-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-delete-slot.spec.ts#1. AVAIL-04 through the UI"
        status: pass
    human_judgment: false
  - id: D2
    description: "A doctor deletes their own blocked row the same way (the un-block action, D-01/D-18); confirm dialog reads 'Remove this block?'"
    requirement: "AVAIL-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-delete-slot.spec.ts#2. AVAIL-04 for a blocked row"
        status: pass
    human_judgment: false
  - id: D3
    description: "Deleting a blocked row regenerates nothing — the doctor's total row count reaches exactly zero (D-02)"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-delete-slot.spec.ts#3. D-02"
        status: pass
    human_judgment: false
  - id: D4
    description: "A booked row cannot be deleted through the API (409 with the exact AVAIL-05 message) or reached through the UI (no Delete control rendered)"
    requirement: "AVAIL-05"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-delete-slot.spec.ts#4. AVAIL-05 at the API, #5. AVAIL-05 in the UI"
        status: pass
    human_judgment: false
  - id: D5
    description: "The booked-row rejection is stable under repetition (idempotency) and the delete-success/already-deleted pair is stable under repetition and concurrency"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-delete-slot.spec.ts#6. AVAIL-05 idempotency, #7. AVAIL-04 idempotency, #8. AVAIL-04 concurrency"
        status: pass
    human_judgment: false
  - id: D6
    description: "T-04-03: a valid-but-foreign slot id returns the identical 404 a missing id returns, and the other doctor's row is verified untouched via the service-role client"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-delete-slot.spec.ts#9. T-04-03 cross-doctor"
        status: pass
    human_judgment: false
  - id: D7
    description: "An anonymous DELETE returns 401 and a logged-in patient returns 403, before any lookup"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-delete-slot.spec.ts#10. Guard"
        status: pass
    human_judgment: false
  - id: D8
    description: "A row whose deletability changed between list-load and click (deleted out from under the page) corrects itself: the live status region shows the server's message and the list refreshes to no longer contain the row"
    verification:
      - kind: e2e
        ref: "tests/e2e/doctor-schedule-delete-slot.spec.ts#11. UI error backstop"
        status: pass
    human_judgment: false
  - id: D9
    description: "Human check (deferred to end-of-phase verification per this plan's own <verification>): a booked row shows no Delete button on screen, the block-removal dialog's second sentence reads clearly, and the confirmation message is announced without stealing focus"
    verification: []
    human_judgment: true
    rationale: "Plan explicitly defers this visual/accessibility check to end-of-phase human verification; not covered by an automated assertion in this plan's spec."

duration: 65min
completed: 2026-08-09
status: complete
---

# Phase 04 Plan 02: Delete a Slot / Un-block a Period Summary

**`DELETE /api/doctor/slots/[id]` with a same-request live status guard and a race-safe delete-then-check-affected-rows pattern, plus the schedule page's per-row Delete control and its two status-branched confirm dialogs, proven end to end by an 11-case Playwright spec covering the idempotency, concurrency and cross-doctor edges.**

## Performance

- **Duration:** ~65 min
- **Started:** 2026-08-09
- **Completed:** 2026-08-09
- **Tasks:** 3 (all execution, no checkpoints)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `DELETE /api/doctor/slots/[id]`: a single ownership-scoped lookup (`id` AND `doctor_id = guard.doctorId`) followed by a status guard read from that same lookup, then a single delete statement — `available` and `blocked` rows fall through to deletion (D-01), `booked` rows are rejected with 409, and every not-found path (missing, already-deleted, foreign-doctor) shares one 404 message so the endpoint is never an existence oracle (T-04-03)
- Per-row `Delete` control (`variant="destructive"`, `min-h-11`) on `/doctor/schedule`, rendered for `available`/`blocked` rows and omitted entirely (not disabled) for `booked` rows
- Two status-branched confirm dialogs — `Delete this slot?` for available rows, `Remove this block?` with the D-02 no-regeneration sentence for blocked rows — and a `role="status" aria-live="polite"` region that surfaces a rejected delete's server message and triggers a list refresh
- `tests/e2e/doctor-schedule-delete-slot.spec.ts`: 11 cases proving AVAIL-04, AVAIL-05, D-02's zero-regeneration guarantee, double-delete idempotency, concurrent-delete resolution, repeated-booked-rejection idempotency, the T-04-03 cross-doctor 404, the anonymous/patient guard, and the UI's stale-row error backstop
- Rule 1 bugfix discovered by the concurrency case: the delete now chains `.select("id")` and treats zero affected rows as 404, closing a race where two concurrent deletes of the same id both silently reported 200

## Task Commits

Each task was committed atomically:

1. **Task 1: `DELETE /api/doctor/slots/[id]` — ownership-scoped lookup, live status guard, plain delete** - `9d88bba` (feat)
2. **Task 2: Per-row Delete control, the two confirm dialogs, and the live status region on `/doctor/schedule`** - `7407be5` (feat)
3. **Task 3: `tests/e2e/doctor-schedule-delete-slot.spec.ts`, including the Rule 1 concurrency bugfix to Task 1's route** - `b4b75e8` (test)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP/REQUIREMENTS update)

## Files Created/Modified

- `app/api/doctor/slots/[id]/route.ts` - `DELETE` handler: ownership-scoped lookup and delete, live `booked` guard, race-safe affected-row check
- `app/doctor/(gated)/schedule/page.tsx` - per-row Delete control, `deletingEntry`/`isDeleting`/`statusMessage` state, the two confirm dialogs, the `aria-live="polite"` status region
- `tests/e2e/doctor-schedule-delete-slot.spec.ts` - 11-case Playwright spec (new file)

## Decisions Made

- **Response contract:** see `key-decisions` in frontmatter — 200/401/403/404/409/500 shapes locked for plan 04-04's visibility sweep to assert against.
- **Concurrency fix (Rule 1):** a plain PostgREST `.delete()` against zero matching rows does not raise an error — it just affects nothing. The initial implementation (lookup, then unconditional delete) let two concurrent requests both pass the lookup before either delete ran, so both reported `{ success: true }`. Fixed by chaining `.select("id")` onto the delete and returning 404 when the returned array is empty, making "I deleted it" and "someone already did" distinguishable. Found by Task 3's case 8 (`Promise.all` concurrency assertion), fixed inline, and reverified green.
- **Reason-text scope boundary:** confirmed against `04-03-PLAN.md` before touching row rendering that blocked-row reason display is explicitly Task 2 of plan 04-03, not this plan — so Task 2 here adds only the Delete control to each row, leaving the existing status-badge-only rendering otherwise untouched for 04-03 to extend without a merge conflict in intent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Concurrent deletes of the same id both reported success**
- **Found during:** Task 3, case 8 (concurrency test)
- **Issue:** `DELETE /api/doctor/slots/[id]`'s delete statement had no way to tell whether it actually removed a row. Two `Promise.all`-fired deletes for the same id both passed the ownership lookup (the row still existed for both at that point), then both issued `.delete().eq("id", id).eq("doctor_id", ...)` — the second delete matched zero rows but PostgREST/Postgres do not treat a zero-row delete as an error, so both requests returned `{ success: true }` with a 200.
- **Fix:** Chained `.select("id")` onto the delete call and check the returned array length. Zero rows returned now maps to the same 404 `This entry no longer exists.` used everywhere else, making the two racing requests resolve to exactly one 200 and one 404 as the plan's must-have requires.
- **Files modified:** `app/api/doctor/slots/[id]/route.ts`
- **Commit:** `b4b75e8`

## Issues Encountered

None beyond the Rule 1 fix documented above.

## User Setup Required

None.

## Next Phase Readiness

- `DELETE /api/doctor/slots/[id]`'s exact 401/403/404/409/500 message strings are now locked contracts; plan 04-04's cross-doctor visibility sweep and any future consumer should assert against these literals rather than re-deriving them.
- The delete-then-check-affected-rows pattern established here (`key-decisions`/`tech-stack.patterns`) should be reused by any future doctor-owned-resource delete route in this codebase to avoid re-introducing the same concurrency gap.
- Row rendering on `/doctor/schedule` now carries the Delete control but not yet reason text — plan 04-03's Task 2 adds the Block period trigger, its dialog, and blocked-row reason rendering without needing to touch this plan's Delete-control code.
- Full Playwright suite (203 tests, including this plan's 11) passes with no regressions to Phase 1-3 or plan 04-01's specs.

---
*Phase: 04-doctor-availability-management*
*Completed: 2026-08-09*

## Self-Check: PASSED

All 3 claimed source files (`app/api/doctor/slots/[id]/route.ts`, `app/doctor/(gated)/schedule/page.tsx`, `tests/e2e/doctor-schedule-delete-slot.spec.ts`) found on disk; all 3 task commits (`9d88bba`, `7407be5`, `b4b75e8`) found in git history.
