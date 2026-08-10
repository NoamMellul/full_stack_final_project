---
phase: 04-doctor-availability-management
fixed_at: 2026-08-10T00:00:00Z
review_path: .planning/phases/04-doctor-availability-management/04-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 04: Code Review Fix Report

**Fixed at:** 2026-08-10T00:00:00Z
**Source review:** .planning/phases/04-doctor-availability-management/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (1 critical, 4 warning; Info finding IN-01 out of scope)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: DELETE /api/doctor/slots/[id] can delete a slot that becomes "booked" between the lookup and the delete (TOCTOU)

**Files modified:** `app/api/doctor/slots/[id]/route.ts`
**Commit:** `91e8ee6`
**Applied fix:** Replaced the select-then-delete sequence with a single atomic `DELETE ... WHERE id = ? AND doctor_id = ? AND status <> 'booked'`. A zero-row result now triggers a re-read to disambiguate "never existed / wrong owner" (404) from "became booked between lookup and delete" (409), instead of trusting a stale `SELECT` snapshot. Closes the TOCTOU window the rest of the phase's overlap-enforcement design deliberately avoids elsewhere.

### WR-01: `requireDoctor()` maps any `doctors` lookup error to "Not authorized" (403), masking real failures

**Files modified:** `lib/auth/require-doctor.ts`
**Commit:** `c6cfd2e`
**Applied fix:** Captured the `error` half of the `doctors` lookup response. An infrastructure/query error now returns 500 (retryable, visible in logs/monitoring) instead of being silently folded into the 403 "Not authorized" path reserved for a genuinely unlinked doctor.

### WR-04: A malformed (non-UUID) slot id on DELETE surfaces as a generic 500 instead of 400

**Files modified:** `app/api/doctor/slots/[id]/route.ts`
**Commit:** `64bd160`
**Applied fix:** Added a UUID-shape check on the route param before querying. A malformed id now short-circuits to 404 (matching the existing not-found response, so the check doesn't leak which ids are validly-shaped-but-absent) instead of letting Postgres's `invalid input syntax for type uuid` error fall through to the generic 500 path.

### WR-02: Unguarded `request.json()` can throw on a malformed body, bypassing the app's consistent 400-not-500 contract

**Files modified:** `app/api/doctor/slots/route.ts`, `app/api/doctor/blocked-periods/route.ts`
**Commit:** `37d8df9`
**Applied fix:** Wrapped `await request.json()` in `try/catch` in both POST handlers. A malformed/empty/truncated body now returns 400 `{"error": "Invalid request body."}` before validation even runs, instead of throwing past the handler into Next's default (uncontrolled) error path.

### WR-03: `reason` free-text field has no length limit at any layer

**Files modified:** `lib/validation/availability.ts`
**Commit:** `37d8df9`
**Applied fix:** Added a 2000-character upper bound on `reason` in `validateBlockedPeriodInput`, applied independently of the existing (deliberate) no-content-filtering decision — bounding size is an abuse-resistance concern, not a content-policy one. An oversized `reason` now returns 400 "Reason is too long." instead of being persisted and re-served verbatim at arbitrary size.

## Skipped Issues

None — all in-scope findings were fixed. (IN-01, "near-duplicate POST handlers and `SLOT_SELECT` constant," is an Info-severity finding and was left out of scope per the default `critical_warning` fix scope.)

## Verification

- `npx tsc --noEmit` — clean, no errors.
- Full phase-4 Playwright suite (`doctor-schedule-add-slot`, `doctor-schedule-block-period`, `doctor-schedule-delete-slot`, `doctor-schedule-overlap`, `doctor-schedule-visibility`): **56/56 passed** (9.1m), including the pre-existing TOCTOU-adjacent concurrency and booked-row-survival tests, confirming CR-01's atomic-delete rewrite didn't regress the delete/booking-guard behavior the suite already covered.
- Ran in the main working tree (no isolated worktree — `workflow.use_worktrees` was not read/enforced by this manual session; all edits and the test run happened directly on `gsd/phase-4-doctor-availability-management`).

---

_Fixed: 2026-08-10T00:00:00Z_
_Fixer: Claude (manual session, gsd-code-fixer pattern)_
_Iteration: 1_
