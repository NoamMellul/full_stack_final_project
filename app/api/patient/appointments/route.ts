import { NextResponse } from "next/server";

import { requirePatient } from "@/lib/auth/require-patient";
import { PATIENT_APPOINTMENT_SELECT } from "@/app/api/appointments/route";

// Read-only endpoint for a patient's own appointment history (APPT-10,
// APPT-11). No status filter and no server-side upcoming/past split:
// PostgREST cannot order parent rows by an embedded column, and D-18 puts
// the split on the client (lib/appointments.ts's splitAppointments()).
export async function GET() {
  const guard = await requirePatient();
  if (!guard.ok) return guard.response;

  // `.eq("patient_id", guard.userId)` is a mandatory app-level restatement
  // of appointments_select_own_or_admin RLS (D-20) — never rely on RLS
  // alone to scope this read.
  const { data, error } = await guard.supabase
    .from("appointments")
    .select(PATIENT_APPOINTMENT_SELECT)
    .eq("patient_id", guard.userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Could not load your appointments. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ appointments: data });
}
