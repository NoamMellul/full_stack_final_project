import { NextResponse } from "next/server";

import { requireDoctor } from "@/lib/auth/require-doctor";

// Read-only endpoint for a doctor's own appointment history (APPT-12,
// APPT-13). Deliberately narrower than the admin route's
// `APPOINTMENT_SELECT`: the patient embed carries only `id` and `full_name`
// (no `email` — platform administration needs it, a doctor reading their own
// schedule does not), and the slot embed carries no `reason` — that column
// is the doctor's own blocked-period note and has no meaning on a booked
// slot. Do not "align" this select with the admin route's; the omissions are
// the point (T-05-08).
const DOCTOR_APPOINTMENT_SELECT =
  "id, status, cancelled_reason, created_at, " +
  "slot:availability_slots!inner(id,start_at,end_at,status), " +
  "patient:profiles(id,full_name)";

export async function GET() {
  const guard = await requireDoctor();
  if (!guard.ok) return guard.response;

  // `.eq("doctor_id", guard.doctorId)` is a mandatory app-level restatement
  // of appointments_select_own_or_admin RLS (D-20) — never rely on RLS
  // alone to scope this read. No status filter and no server-side
  // upcoming/past split: PostgREST cannot order parent rows by an embedded
  // column, and D-18 puts the split on the client for both pages.
  const { data, error } = await guard.supabase
    .from("appointments")
    .select(DOCTOR_APPOINTMENT_SELECT)
    .eq("doctor_id", guard.doctorId)
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
