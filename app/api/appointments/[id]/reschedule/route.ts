import { NextResponse } from "next/server";

import { requirePatient } from "@/lib/auth/require-patient";
import { PATIENT_APPOINTMENT_SELECT } from "@/app/api/appointments/route";
import { UUID_PATTERN, validateRescheduleInput } from "@/lib/validation/appointments";

// Unlike app/api/appointments/[id]/cancel/route.ts, this route uses
// requirePatient() and returns guard.response when not ok. Rescheduling is
// patient-initiated only: D-06 and D-07 scope it to the patient, UI-SPEC
// renders no reschedule control on the doctor page, and
// reschedule_appointment() itself filters its appointment lookup by
// `patient_id = auth.uid()`. The cancel route deliberately differs from this
// shape because D-12 admits both actors there — do not "fix" this route to
// match it.

const NOT_FOUND_MESSAGE = "This appointment no longer exists.";
const SLOT_REJECTION_MESSAGE = "This slot is no longer available. Please choose another.";
const APPOINTMENT_REJECTION_MESSAGE = "This appointment can no longer be rescheduled.";
const RETRY_MESSAGE = "Could not complete this reschedule right now — please try again.";
const GENERIC_FAILURE_MESSAGE = "Could not reschedule this appointment. Please try again.";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePatient();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  // A malformed id is answered identically to a genuinely missing one, so
  // the response gives no signal about which ids look real (T-05-05).
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const validationError = validateRescheduleInput(body as Record<string, unknown>);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { newSlotId } = body as { newSlotId: string };

  // No availability lookup on the new slot before the RPC: the conditional
  // UPDATE inside reschedule_appointment() is the authoritative check and a
  // pre-check here would be both redundant and race-prone (D-05).
  const { data: appointmentId, error } = await guard.supabase.rpc("reschedule_appointment", {
    p_appointment_id: id,
    p_new_slot_id: newSlotId,
  });

  if (error || !appointmentId) {
    // Branch strictly on the flat `error.code` string, never on
    // `error.message` — the database's own rejection text must never reach
    // the client.
    if (error?.code === "MR001") {
      // One code covers four of D-10's six conditions at once — a new slot
      // that is in the past, blocked, already booked, or owned by a
      // different doctor — because from the patient's side they are the
      // same fact and distinguishing them would tell a caller about slots
      // and doctors they did not ask about. UI-SPEC locks this two-bucket
      // grouping.
      return NextResponse.json({ error: SLOT_REJECTION_MESSAGE }, { status: 409 });
    }
    if (error?.code === "MR002") {
      // D-10's remaining two conditions: an already-cancelled appointment
      // and one whose current slot time has passed.
      return NextResponse.json({ error: APPOINTMENT_REJECTION_MESSAGE }, { status: 409 });
    }
    if (error?.code === "MR004") {
      // Identical for a nonexistent id and for another patient's id.
      return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
    }
    if (error?.code === "40P01") {
      // Postgres's deadlock detector cleanly aborting one of two
      // transactions in a genuine circular slot swap (RESEARCH.md
      // Pitfall 3). Expected behaviour under concurrency, the transaction
      // rolled back completely, and retrying usually succeeds — must never
      // fall through to the generic 500 branch below.
      return NextResponse.json({ error: RETRY_MESSAGE }, { status: 409 });
    }
    return NextResponse.json({ error: GENERIC_FAILURE_MESSAGE }, { status: 500 });
  }

  // Follow-up read on the same session-bound client so the client can
  // re-render the row with its new slot time without a second round trip.
  // No `appointments` or `availability_slots` write happens in this handler.
  const { data: appointment, error: readError } = await guard.supabase
    .from("appointments")
    .select(PATIENT_APPOINTMENT_SELECT)
    .eq("id", id)
    .single();

  if (readError || !appointment) {
    return NextResponse.json({ error: GENERIC_FAILURE_MESSAGE }, { status: 500 });
  }

  return NextResponse.json({ appointment }, { status: 200 });
}
