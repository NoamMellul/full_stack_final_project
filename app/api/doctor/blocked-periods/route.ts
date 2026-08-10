import { NextResponse } from "next/server";

import { requireDoctor } from "@/lib/auth/require-doctor";
import { validateBlockedPeriodInput } from "@/lib/validation/availability";

// Structurally the same shape as app/api/doctor/slots/route.ts's POST — the
// second write path into `availability_slots`. Guard, validate, insert
// exactly one row, then branch on the flat Postgres `error.code` string the
// same way, so a blocked period and an available slot can never drift apart
// in behaviour (D-10, D-11).

const SLOT_SELECT = "id, start_at, end_at, status, reason";

export async function POST(request: Request) {
  const guard = await requireDoctor();
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const validationError = validateBlockedPeriodInput(body as Record<string, unknown>);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { startAt, endAt, reason } = body as {
    startAt: string;
    endAt: string;
    reason?: unknown;
  };

  // A blank textarea (or an absent/null key) must store null, not an empty
  // string (D-04). Trimming is used only to decide blankness — the stored
  // value is the reason exactly as sent, never a trimmed copy, so the reason
  // round-trips byte-identical to what was submitted.
  const isBlankReason = typeof reason !== "string" || reason.trim().length === 0;
  const reasonToStore = isBlankReason ? null : (reason as string);

  // `doctor_id` comes only from the guard — a `doctorId` key present in the
  // request body is inert (D-06, T-04-01). One row, one continuous range: no
  // loop over days, no split at midnight, no per-business-hour rows (D-03).
  const { data, error } = await guard.supabase
    .from("availability_slots")
    .insert({
      doctor_id: guard.doctorId,
      start_at: startAt,
      end_at: endAt,
      status: "blocked",
      reason: reasonToStore,
    })
    .select(SLOT_SELECT)
    .single();

  if (error || !data) {
    // Branch strictly on the flat `error.code` string, never on
    // `error.message`/`error.details` — the database's exact rejection text
    // must never reach the client.
    if (error?.code === "23P01") {
      // Atomic GiST exclusion constraint violation — the authoritative
      // overlap guarantee. Always this exact generic string, byte-identical
      // to the add-slot route's; never names whether the collision was with
      // an available, booked, or another blocked row (D-11, AVAIL-07,
      // T-04-05).
      return NextResponse.json(
        { error: "This time overlaps your existing schedule." },
        { status: 409 },
      );
    }
    if (error?.code === "23514") {
      // Defensive fallback behind validateBlockedPeriodInput's own
      // start-before-end check.
      return NextResponse.json(
        { error: "Start time must be before end time." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Could not save this time slot. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ slot: data }, { status: 201 });
}
