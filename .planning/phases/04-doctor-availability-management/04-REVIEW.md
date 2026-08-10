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
  critical: 1
  warning: 4
  info: 1
  total: 6
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-08-09T00:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

Reviewed the doctor availability management API routes, the schedule page, the guard/validation helpers, the reason-column migration, and all five e2e spec files added/changed for this phase. The overlap-enforcement design (atomic GiST exclusion constraint instead of select-then-insert pre-checks) is sound and well tested. However, the delete path for un-booking/un-blocking a slot (`app/api/doctor/slots/[id]/route.ts`) has a check-then-act race: the "never delete a booked row" guarantee is enforced only against a snapshot read, not against the row state at delete time, so a slot that gets booked in the (small) window between the lookup and the delete statement can still be deleted — the exact class of bug the rest of this phase went out of its way to avoid via atomic constraints. Several lower-severity robustness and error-handling gaps round out the findings below.

## Critical Issues

### CR-01: DELETE /api/doctor/slots/[id] can delete a slot that becomes "booked" between the lookup and the delete (TOCTOU)

**File:** `app/api/doctor/slots/[id]/route.ts:37-67`

**Issue:** The handler enforces "never delete a booked row" (AVAIL-05) by reading `status` in a `SELECT` (lines 37-42), branching on it in application code (line 51), and only then issuing a separate `DELETE` (lines 62-67). The `DELETE` statement's own `WHERE` clause only filters on `id` and `doctor_id` — it does **not** re-check `status`. If a patient's booking request updates this same row from `available` to `booked` in the interval between the `SELECT` and the `DELETE` (both are separate round-trips, not one transaction), the `DELETE` will still succeed and silently remove the row backing an active appointment. This directly contradicts the code's own comment ("the `status` guard... reads live database state inside this same request"), which is true only at `SELECT` time, not at `DELETE` time. This is the same TOCTOU class of bug that the overlap-enforcement design elsewhere in this phase deliberately avoids by relying on an atomic exclusion constraint instead of a select-then-insert pre-check (see the comments in `lib/validation/availability.ts`); the delete path does not apply the same discipline. No existing test exercises this interleaving (the concurrency tests in `doctor-schedule-delete-slot.spec.ts` only cover two concurrent deletes of the same id, not a concurrent booking).

**Fix:** Push the `status` check into the `DELETE`'s own `WHERE` clause so the guarantee is atomic, then disambiguate "already gone" from "now booked" only if needed:

```ts
const { data: deleted, error: deleteError } = await guard.supabase
  .from("availability_slots")
  .delete()
  .eq("id", id)
  .eq("doctor_id", guard.doctorId)
  .neq("status", "booked")
  .select("id");

if (deleteError) {
  return NextResponse.json({ error: GENERIC_FAILURE_MESSAGE }, { status: 500 });
}

if (!deleted || deleted.length === 0) {
  // Zero rows affected: either the row never existed/belonged to another
  // doctor, or it just became booked. Re-read to report the right message.
  const { data: nowExisting } = await guard.supabase
    .from("availability_slots")
    .select("status")
    .eq("id", id)
    .eq("doctor_id", guard.doctorId)
    .maybeSingle();

  if (nowExisting?.status === "booked") {
    return NextResponse.json({ error: BOOKED_MESSAGE }, { status: 409 });
  }
  return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
}
```

## Warnings

### WR-01: `requireDoctor()` maps any `doctors` lookup error to "Not authorized" (403), masking real failures

**File:** `lib/auth/require-doctor.ts:31-42`

**Issue:** `const { data: doctor } = await supabase.from("doctors").select("id").eq("profile_id", user.id).maybeSingle();` discards the `error` half of the response. If this query fails for an infrastructure reason (network blip, RLS misconfiguration, DB outage) rather than because the user genuinely has no linked doctor row, `doctor` is `undefined` either way and the caller receives an indistinguishable 403 "Not authorized." A legitimate doctor experiencing a transient backend error is told they lack permission instead of seeing a retryable 500, and real outages are invisible in logs/monitoring as authorization failures.

**Fix:**
```ts
const { data: doctor, error: doctorError } = await supabase
  .from("doctors")
  .select("id")
  .eq("profile_id", user.id)
  .maybeSingle();

if (doctorError) {
  return {
    ok: false,
    response: NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 }),
  };
}
if (!doctor) {
  return { ok: false, response: NextResponse.json({ error: "Not authorized." }, { status: 403 }) };
}
```

### WR-02: Unguarded `request.json()` can throw on a malformed body, bypassing the app's consistent 400-not-500 contract

**File:** `app/api/doctor/slots/route.ts:37`, `app/api/doctor/blocked-periods/route.ts:18`

**Issue:** Both POST handlers call `const body = await request.json();` with no `try/catch`. `Request.json()` rejects when the body isn't valid JSON (e.g. an empty body, truncated body, or non-JSON content). Every other malformed-input case in this phase is deliberately tested and guaranteed to return a clean 400 (see `doctor-schedule-overlap.spec.ts` test 10, "never 500"), but literally-malformed JSON is not covered by any test and, unlike the other cases, isn't caught by `validateSlotInput`/`validateBlockedPeriodInput` at all — the throw happens before validation runs, so it propagates out of the handler and is handled by Next's default (uncontrolled) error path instead of the app's own error-response shape.

**Fix:**
```ts
let body: unknown;
try {
  body = await request.json();
} catch {
  return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
}
```

### WR-03: `reason` free-text field has no length limit at any layer

**File:** `lib/validation/availability.ts:71-74`, `supabase/migrations/20260809120000_add_availability_slots_reason.sql:10`

**Issue:** `validateBlockedPeriodInput` only checks that `reason` is `string | null | undefined` — there is no maximum length. The column is `text` with no `check` constraint. A caller hitting `POST /api/doctor/blocked-periods` directly (bypassing the UI's `Textarea`, which also has no `maxLength`) can submit an arbitrarily large `reason` string in a single insert, which is stored verbatim and returned verbatim on every subsequent `GET`. This is an unbounded-input acceptance gap: nothing in the stack prevents a multi-megabyte value from being persisted and repeatedly re-served. The in-repo comments frame the absence of a cap as a deliberate content-validation decision ("no length cap, no character filtering"), but that decision doesn't address the separate concern of bounding *size* for abuse resistance — those are independent axes.

**Fix:** Add a reasonable upper bound in the shared validator (e.g. 2,000 characters), independent of the "no content filtering" decision:
```ts
if (typeof reason === "string" && reason.length > 2000) {
  return "Reason is too long.";
}
```

### WR-04: A malformed (non-UUID) slot id on DELETE surfaces as a generic 500 instead of 400

**File:** `app/api/doctor/slots/[id]/route.ts:37-46`

**Issue:** `id` from the route param is passed straight into `.eq("id", id)` against a `uuid` column with no format check first. Postgres rejects a non-UUID string with an `invalid input syntax for type uuid` error, which lands in `lookupError` and is mapped to the generic 500 `GENERIC_FAILURE_MESSAGE` (line 44-46). Every other input-shape problem in this phase is deliberately surfaced as a 400; a malformed id is effectively a client input error too, but currently reads to the caller (and to logs/monitoring) as a server failure.

**Fix:** Validate the id shape before querying:
```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_RE.test(id)) {
  return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
}
```

## Info

### IN-01: Near-duplicate POST handlers and `SLOT_SELECT` constant across the two write routes

**File:** `app/api/doctor/slots/route.ts:6,59-83`, `app/api/doctor/blocked-periods/route.ts:12,52-79`

**Issue:** The `SLOT_SELECT` string and the entire `error?.code === "23P01"` / `"23514"` / generic-fallback branching block are duplicated near-verbatim between the two POST handlers. The in-code comments acknowledge this is intentional ("so a blocked period and an available slot can never drift apart in behaviour") but duplicated logic is still a maintenance risk: a future edit to one branch (e.g. adding a new Postgres error code to handle, or changing the generic message) can easily be applied to only one file, silently reintroducing the exact drift the comments say must never happen.

**Fix:** Extract a shared helper, e.g. `lib/api/availability-slot-errors.ts` exporting `mapSlotInsertError(error): NextResponse`, and call it from both routes so the two paths are structurally guaranteed to stay identical rather than guaranteed only by convention/comments.

---

_Reviewed: 2026-08-09T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
