// Manual TypeScript validation for the doctor add-slot form (no schema library),
// mirroring the lib/validation/doctor.ts convention: one exported function per
// input shape, a `string | null` return, and an early return of a plain
// user-facing message.
//
// These checks are the fast, clean-message path only. The authoritative
// guarantees are the database's own `availability_slots_valid_range` and
// `availability_slots_no_overlap` constraints — this module never performs a
// select-then-insert overlap pre-check, because that pattern is race-prone
// (RESEARCH.md Pitfall 2, threat T-04-02): two concurrent requests could both
// pass a pre-check and only the atomic exclusion constraint at insert time is
// safe to rely on.

export function validateSlotInput(body: Record<string, unknown>): string | null {
  const startAt = body.startAt;
  const endAt = body.endAt;

  if (typeof startAt !== "string" || typeof endAt !== "string") {
    return "Start and end time are required.";
  }

  const start = new Date(startAt);
  const end = new Date(endAt);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Invalid date/time.";
  }

  // Strictly later than now — a start exactly equal to the current instant is
  // rejected (D-08, AVAIL-02). Compared against the server's own clock only,
  // never a client-supplied one.
  if (start.getTime() <= Date.now()) {
    return "Cannot add a slot in the past.";
  }

  if (start.getTime() >= end.getTime()) {
    return "Start time must be before end time.";
  }

  return null;
}
