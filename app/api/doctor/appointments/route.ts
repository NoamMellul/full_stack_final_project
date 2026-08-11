import { NextResponse } from "next/server";

import { requireDoctor } from "@/lib/auth/require-doctor";

// Read-only endpoint for a doctor's own appointment history (APPT-12,
// APPT-13). Deliberately narrower than the admin route's
// `APPOINTMENT_SELECT`: the patient name carries only `id` and `full_name`
// (no `email` — platform administration needs it, a doctor reading their own
// schedule does not), and the slot embed carries no `reason` — that column
// is the doctor's own blocked-period note and has no meaning on a booked
// slot. Do not "align" this select with the admin route's; the omissions are
// the point (T-05-08).
//
// The patient name is NOT fetched via a `profiles` embed (no
// `patient:profiles(id,full_name)` in this select) — code review CR-02
// found that the RLS policy previously backing that embed
// (profiles_select_via_own_appointment_doctor) was row-level only and so
// exposed a patient's full profile row, including `email`, to any doctor
// with a past appointment together. `patient_id` is fetched as a plain
// column instead and resolved to `{id, full_name}` via the
// doctor_visible_patients() SECURITY DEFINER function
// (20260811110000_fix_doctor_patient_profile_exposure.sql), which returns
// only those two columns and only for patients tied to the caller's own
// appointments (resolved from auth.uid() internally, never a client param).
const DOCTOR_APPOINTMENT_SELECT =
  "id, status, cancelled_reason, created_at, patient_id, " +
  "slot:availability_slots!inner(id,start_at,end_at,status)";

// The select string above is built via string concatenation (not a literal
// template), so postgrest-js's compile-time select parser cannot statically
// infer a row shape from it and falls back to a generic error type. This
// project's Supabase clients are not generated against a `Database` type
// (see lib/supabase/server.ts), so the row shape is declared by hand here —
// matching the DOCTOR_APPOINTMENT_SELECT string field-for-field — rather
// than left for TypeScript to infer.
type DoctorAppointmentRow = {
  id: string;
  status: string;
  cancelled_reason: string | null;
  created_at: string;
  patient_id: string;
  slot: { id: string; start_at: string; end_at: string; status: string } | null;
};

type DoctorVisiblePatient = { id: string; full_name: string };

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

  const { data: patients, error: patientsError } = await guard.supabase.rpc(
    "doctor_visible_patients",
  );

  if (patientsError) {
    return NextResponse.json(
      { error: "Could not load your appointments. Please try again." },
      { status: 500 },
    );
  }

  const rows = data as unknown as DoctorAppointmentRow[];
  const patientRows = patients as unknown as DoctorVisiblePatient[] | null;
  const patientById = new Map((patientRows ?? []).map((p) => [p.id, { id: p.id, full_name: p.full_name }]));

  const appointments = rows.map(({ patient_id, ...rest }) => ({
    ...rest,
    patient: patientById.get(patient_id) ?? null,
  }));

  return NextResponse.json({ appointments });
}
