---
phase: 04-doctor-availability-management
reviewed: 2026-08-09T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - app/api/doctor/blocked-periods/route.ts
  - app/api/doctor/slots/[id]/route.ts
  - app/api/doctor/slots/route.ts
  - app/doctor/(gated)/page.tsx
  - app/doctor/(gated)/schedule/page.tsx
  - lib/auth/require-doctor.ts
  - lib/validation/availability.ts
  - supabase/migrations/20260809120000_add_availability_slots_reason.sql
  - tests/e2e/doctor-schedule-add-slot.spec.ts
  - tests/e2e/doctor-schedule-block-period.spec.ts
  - tests/e2e/doctor-schedule-delete-slot.spec.ts
  - tests/e2e/doctor-schedule-overlap.spec.ts
  - tests/e2e/doctor-schedule-visibility.spec.ts
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-08-09T00:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Reviewed the doctor availability management surface: the two write routes (`POST /api/doctor/slots`, `POST /api/doctor/blocked-periods`), the delete/un-block route (`DELETE /api/doctor/slots/[id]`), the `requireDoctor` guard, the shared start/end validator, the `reason` column migration, the schedule page UI, and the five e2e specs covering AVAIL-01 through AVAIL-07.

No critical/blocker-level defects were found — the ownership boundary (`requireDoctor` + RLS), the atomic overlap guarantee (GiST exclusion constraint, never a select-then-insert race), and the generic-error-message discipline (never leaking `error.message`/`error.details`, never distinguishing 403 from 404 on a foreign id) are all implemented correctly and are well covered by the test suite (including real concurrency cases run with `Promise.all`).

Four warnings and two info-level findings were found, mostly around a delete-time TOCTOU gap, a UI ambiguity for multi-day blocks, and a couple of defense-in-depth/robustness gaps. None of these are exploitable today given the phase's current scope (no booking flow yet, `reason` is only ever written by one route), but they are real latent bugs worth fixing before the next phase (booking) lands on top of this code.

## Warnings

### WR-01: Delete route reads booked-status live, but not atomically with the delete — a TOCTOU window contradicts the handler's own stated guarantee

**File:** `app/api/doctor/slots/[id]/route.ts:37-67`
**Issue:** The handler's header comment explicitly states the `status` guard "reads live database state inside this same request" so that AVAIL-05/T-04-04 ("deletable only while not booked") can never be violated by a stale read. In practice the implementation is two separate statements, not one atomic operation:

```ts
const { data: existing } = await guard.supabase
  .from("availability_slots")
  .select("id, status")
  .eq("id", id)
  .eq("doctor_id", guard.doctorId)
  .maybeSingle();
...
if (existing.status === "booked") { return 409; }
...
const { data: deleted, error: deleteError } = await guard.supabase
  .from("availability_slots")
  .delete()
  .eq("id", id)
  .eq("doctor_id", guard.doctorId)
  .select("id");
```

If the row's status transitions from non-booked to `booked` *between* the `select` and the `delete` (e.g. once a booking flow lands in a later phase), this handler will proceed to attempt the delete anyway. `appointments.slot_id` has `on delete restrict`, so the delete itself will fail with a Postgres FK-violation error — no data is lost — but `deleteError` is non-null and falls through to the generic branch, returning **500 "Could not delete this entry. Please try again."** instead of the correct **409 "This slot has already been booked and can't be deleted."** This silently breaks the exact invariant the code comments claim to guarantee, and there's no test exercising this transition (the delete-slot spec's "race" test, `#11`, only covers a row deleted out from under the page, not a status flip to `booked`).

**Fix:** Make the "not booked" condition part of the delete's own `WHERE` clause instead of a separate pre-check, so the check and the write are the same statement:

```ts
const { data: deleted, error: deleteError } = await guard.supabase
  .from("availability_slots")
  .delete()
  .eq("id", id)
  .eq("doctor_id", guard.doctorId)
  .neq("status", "booked")
  .select("id, status");

if (deleteError) { ... }
if (!deleted || deleted.length === 0) {
  // re-select to distinguish "not found" from "now booked" for the response message
  const { data: current } = await guard.supabase
    .from("availability_slots")
    .select("status")
    .eq("id", id)
    .eq("doctor_id", guard.doctorId)
    .maybeSingle();
  if (current?.status === "booked") return NextResponse.json({ error: BOOKED_MESSAGE }, { status: 409 });
  return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
}
```

### WR-02: Multi-day blocked periods render identically to same-day entries — the day component of the end time is silently dropped

**File:** `app/doctor/(gated)/schedule/page.tsx:486-495`
**Issue:** Entries are grouped by the Jerusalem day of `start_at` only (`groupEntriesByJerusalemDay`, line 41-53), and each row displays `formatJerusalemTime(entry.start_at)} – {formatJerusalemTime(entry.end_at)}` (line 493-495), which is an `HH:MM` string with no date component. A 3-day block (e.g. Monday 09:00 → Wednesday 18:00 — exactly the shape asserted as "exactly ONE row" by `doctor-schedule-block-period.spec.ts` test 3) renders as `09:00 – 18:00` under the "Monday" heading only, visually indistinguishable from a same-day 09:00-18:00 block. A doctor has no way to tell from the list that the block continues for two more days. This is untested: test 3 only asserts the DB row count is 1, never that the UI communicates the multi-day span.
**Fix:** When `jerusalemDayKey(entry.start_at) !== jerusalemDayKey(entry.end_at)`, include the end date in the displayed range (e.g. `formatJerusalemDayHeading(entry.end_at)` alongside the time), or add a distinct "multi-day" indicator/badge.

### WR-03: `request.json()` is not wrapped in try/catch on either write route — malformed JSON throws instead of returning a clean 400

**File:** `app/api/doctor/blocked-periods/route.ts:18`, `app/api/doctor/slots/route.ts:37`
**Issue:** Both `POST` handlers call `const body = await request.json();` directly. Any request whose body is not valid JSON (empty body, truncated body, wrong `Content-Type`) throws a `SyntaxError` that is never caught inside the handler, so Next.js's default error handling takes over and returns a generic 500 instead of going through this route's own `{ error: "..." }` JSON contract that every other failure path in the file follows. The route is reachable directly (not only through the app's own fetch calls, which always send well-formed JSON), so this is attacker/tool-reachable, e.g. via `curl -X POST .../api/doctor/blocked-periods -d 'not json'`. (Note: this pattern is pre-existing elsewhere in the codebase too, e.g. `app/api/auth/login/route.ts`, so it isn't unique to this phase, but it is present in both files newly added/modified here.)
**Fix:**
```ts
let body: unknown;
try {
  body = await request.json();
} catch {
  return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
}
```

### WR-04: No database-level constraint stops `reason` from being set on a publicly-readable `available` row

**File:** `supabase/migrations/20260809120000_add_availability_slots_reason.sql:10`
**Issue:** The migration adds `reason text` with no constraint, and the file's own comment says the "not applicable to available/booked rows" rule is "a convention enforced by the route handlers ..., not a database constraint." Today only `POST /api/doctor/blocked-periods` ever writes `reason`, and it always pairs it with `status: "blocked"`, so the convention holds in practice. But `availability_slots_select_available_or_owner_or_admin` makes any row with `status = 'available'` publicly readable to anonymous and patient users (confirmed by `doctor-schedule-visibility.spec.ts` tests 4-5, which read `reason` directly via the anon/patient Supabase client). If any future write path (an admin edit tool, a bulk-update script, a bug in a later phase) ever sets `reason` on an `available` row, that free-text note — which the same migration's comment says "must never be treated as a place for patient-identifying or clinical information," precisely because doctors *can* type such things — becomes visible to any unauthenticated visitor with no additional safeguard catching the mistake before it ships.
**Fix:** Add a defense-in-depth check constraint:
```sql
alter table public.availability_slots
  add constraint availability_slots_reason_only_when_blocked
  check (reason is null or status = 'blocked');
```

## Info

### IN-01: `SLOT_SELECT` is duplicated verbatim across two route files

**File:** `app/api/doctor/blocked-periods/route.ts:12`, `app/api/doctor/slots/route.ts:6`
**Issue:** Both files independently define `const SLOT_SELECT = "id, start_at, end_at, status, reason";`. The blocked-periods route's own header comment states the explicit goal is that "a blocked period and an available slot can never drift apart in behaviour" — but a literal string duplicated in two places can drift silently (e.g. one file gets a new column added to its select and the other doesn't) with no compiler error to catch it.
**Fix:** Hoist `SLOT_SELECT` into a shared module (e.g. `lib/validation/availability.ts` or a new `lib/db/availability-slots.ts`) and import it from both routes.

### IN-02: A malformed (non-UUID) `id` in `DELETE /api/doctor/slots/:id` returns 500 instead of a clean 4xx

**File:** `app/api/doctor/slots/[id]/route.ts:37-45`
**Issue:** `id` is taken from the route param and passed straight into `.eq("id", id)` against a `uuid` column with no format validation first. A non-UUID string (e.g. `/api/doctor/slots/not-a-uuid`) causes Postgres/PostgREST to return an "invalid input syntax for type uuid" error, which is treated by the handler as `lookupError` and answered with the generic 500 `GENERIC_FAILURE_MESSAGE`. This doesn't create an ownership oracle (T-04-03's actual concern, which is correctly handled — a foreign-but-well-formed id gets the same 404 as a nonexistent one), but it is a minor robustness/consistency gap: a client typo produces a 500 rather than a 400/404.
**Fix:** Validate `id` against a UUID regex before querying, and return 404 (to stay consistent with the "no info leak" posture already used elsewhere in this file) for anything that doesn't match, without touching the database.

---

_Reviewed: 2026-08-09T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
