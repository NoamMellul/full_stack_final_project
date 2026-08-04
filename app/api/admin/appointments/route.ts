import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";

// Read-only platform-wide oversight view (ADMIN-08). requireAdmin() gives a
// clean 401/403; appointments_select_own_or_admin RLS independently restricts
// a non-admin caller to their own appointments even if this guard were ever
// bypassed (T-02-02).
const APPOINTMENT_SELECT =
  "id, status, cancelled_reason, created_at, updated_at, " +
  "slot:availability_slots!inner(id,start_at,end_at,status), " +
  "doctor:doctors(id,full_name), " +
  "patient:profiles(id,full_name,email)";

// Mirrors the exact set the `appointments` check constraint allows
// (supabase/migrations/20260803230000_initial_schema.sql) — never pass an
// arbitrary caller string into the query (T-02-13).
const VALID_STATUSES = [
  "scheduled",
  "confirmed",
  "cancelled_by_patient",
  "cancelled_by_doctor",
  "completed",
  "no_show",
] as const;

export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const doctorId = searchParams.get("doctorId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (status && !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    return NextResponse.json({ error: "Invalid status filter." }, { status: 400 });
  }

  let query = guard.supabase.from("appointments").select(APPOINTMENT_SELECT);

  if (status) {
    query = query.eq("status", status);
  }
  if (doctorId) {
    query = query.eq("doctor_id", doctorId);
  }
  if (from) {
    // Filters on the joined slot's own column — the `!inner` embed above is
    // what makes this genuinely narrow the parent rows rather than just
    // trimming the embedded object.
    query = query.gte("availability_slots.start_at", from);
  }
  if (to) {
    query = query.lte("availability_slots.start_at", to);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Could not load appointments. Please refresh the page." },
      { status: 500 },
    );
  }

  return NextResponse.json({ appointments: data });
}
