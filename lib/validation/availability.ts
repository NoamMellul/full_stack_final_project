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

// Shared start/end validation ladder used by both `validateSlotInput` and
// `validateBlockedPeriodInput` so the two write paths can never drift apart
// on which fault a body has for shape, parseability, or range order — only
// the past-date message differs between the two callers (D-08 wording).
function validateStartEnd(
  body: Record<string, unknown>,
  pastMessage: string,
): string | null {
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
    return pastMessage;
  }

  if (start.getTime() >= end.getTime()) {
    return "Start time must be before end time.";
  }

  return null;
}

export function validateSlotInput(body: Record<string, unknown>): string | null {
  return validateStartEnd(body, "Cannot add a slot in the past.");
}

// Sibling validator for the block-period form/route (AVAIL-06, D-17). Runs
// the identical start/end ladder as `validateSlotInput`, with the
// block-specific past-date message (UI-SPEC Copywriting Contract), plus an
// optional `reason` check.
//
// `reason` is deliberately unvalidated in content — no length cap, no
// character filtering, no required value (D-04). It is the doctor's own
// operational note about their own availability (e.g. "Vacation",
// "Conference") and must never be treated as a place for patient-identifying
// or clinical information; that framing belongs to the form's label/
// placeholder copy, not to this validator.
export function validateBlockedPeriodInput(body: Record<string, unknown>): string | null {
  const startEndError = validateStartEnd(body, "Cannot block a period in the past.");
  if (startEndError) {
    return startEndError;
  }

  const reason = body.reason;
  if (reason !== undefined && reason !== null && typeof reason !== "string") {
    return "Reason must be text.";
  }

  return null;
}
