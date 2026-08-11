// Manual TypeScript validation for the appointment booking/reschedule/cancel
// request bodies (no schema library), mirroring the lib/validation/availability.ts
// convention: one exported function per input shape, a `string | null`
// return, and an early return of a plain user-facing message.
//
// These checks are shape and size only. Availability is never checked here —
// a select-then-check pre-check is race-prone (RESEARCH.md Pitfall 1/2), and
// the conditional UPDATE inside book_appointment()/reschedule_appointment()
// is the authoritative guarantee. The cancellation reason's content is
// deliberately unvalidated (no character filtering, no required value) but
// must never be labelled or prompted as a place for clinical information —
// PROJECT.md forbids storing medical data outright.

// Shared with app/api/doctor/slots/[id]/route.ts's own copy — exported here
// so the new routes import one pattern instead of adding a third copy. That
// existing route file is not refactored to use this export.
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateBookingInput(body: Record<string, unknown>): string | null {
  // A request body of the literal 4 bytes `null` parses successfully via
  // JSON.parse (no exception -- `null` is valid JSON), so the call sites'
  // try/catch around JSON parsing never triggers for it. Without this guard,
  // `body.slotId` below would throw on a null body, surfacing as an
  // unhandled 500 instead of this function's normal 400 (code review WR-01).
  if (typeof body !== "object" || body === null) {
    return "Slot is required.";
  }
  const slotId = body.slotId;
  if (typeof slotId !== "string" || !UUID_PATTERN.test(slotId)) {
    return "Slot is required.";
  }
  return null;
}

// Consumed by plan 05-04.
export function validateRescheduleInput(body: Record<string, unknown>): string | null {
  // See validateBookingInput's comment: guards the same literal-`null`-body
  // case (code review WR-01).
  if (typeof body !== "object" || body === null) {
    return "A new slot is required.";
  }
  const newSlotId = body.newSlotId;
  if (typeof newSlotId !== "string" || !UUID_PATTERN.test(newSlotId)) {
    return "A new slot is required.";
  }
  return null;
}

// Consumed by plan 05-02. Message strings and the 2000-character bound are
// copied verbatim from validateBlockedPeriodInput so the two free-text
// fields in this project cannot drift apart.
export function validateCancelInput(body: Record<string, unknown>): string | null {
  // See validateBookingInput's comment: guards the same literal-`null`-body
  // case (code review WR-01). Unlike the other two validators, a null/absent
  // reason is itself valid input here (the reason is optional), so this
  // guard returns null (no error) rather than a message.
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const reason = body.reason;
  if (reason !== undefined && reason !== null && typeof reason !== "string") {
    return "Reason must be text.";
  }
  if (typeof reason === "string" && reason.length > 2000) {
    return "Reason is too long.";
  }
  return null;
}
