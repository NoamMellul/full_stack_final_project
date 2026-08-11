import { NextResponse } from "next/server";

import { requirePatient } from "@/lib/auth/require-patient";
import { validateBookingInput } from "@/lib/validation/appointments";

// Shared with app/api/patient/appointments/route.ts, which imports this
// rather than restating the join. Deliberately carries no `patient:profiles`
// embed — the caller is the patient, so re-serving their own profile adds
// nothing and widens the response surface (T-05-11).
export const PATIENT_APPOINTMENT_SELECT =
  "id, status, cancelled_reason, created_at, " +
  "slot:availability_slots!inner(id,start_at,end_at,status), " +
  "doctor:doctors(id,full_name)";

export async function POST(request: Request) {
  const guard = await requirePatient();
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const validationError = validateBookingInput(body as Record<string, unknown>);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { slotId } = body as { slotId: string };

  // Never a client-supplied `patientId` — book_appointment() resolves the
  // acting patient from auth.uid() inside the function body (T-05-02). No
  // availability lookup happens before this call (D-05): the RPC's own
  // conditional UPDATE is the sole source of truth.
  const { data: appointmentId, error } = await guard.supabase.rpc("book_appointment", {
    p_slot_id: slotId,
  });

  if (error || !appointmentId) {
    // Branch strictly on the flat `error.code` string, never on
    // `error.message` — the database's own rejection text must never reach
    // the client (RESEARCH.md Anti-Patterns).
    if (error?.code === "MR001") {
      return NextResponse.json(
        { error: "This slot is no longer available. Please choose another." },
        { status: 409 },
      );
    }
    if (error?.code === "MR003" || error?.code === "MR005") {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Could not book this appointment. Please try again." },
      { status: 500 },
    );
  }

  // Follow-up read on the same session-bound client goes through
  // appointments_select_own_or_admin RLS, which is what makes it safe to
  // select by id alone.
  const { data: appointment, error: readError } = await guard.supabase
    .from("appointments")
    .select(PATIENT_APPOINTMENT_SELECT)
    .eq("id", appointmentId)
    .single();

  if (readError || !appointment) {
    return NextResponse.json(
      { error: "Could not book this appointment. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ appointment }, { status: 201 });
}
