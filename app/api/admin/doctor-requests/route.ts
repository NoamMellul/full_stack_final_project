import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";

const DOCTOR_REQUEST_LIST_SELECT =
  "id, full_name, email, message, status, created_at, specialty:specialties(id,name_en,name_he)";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { data, error } = await guard.supabase
    .from("doctor_requests")
    .select(DOCTOR_REQUEST_LIST_SELECT)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Could not load doctor requests. Please refresh the page." },
      { status: 500 },
    );
  }

  return NextResponse.json({ requests: data });
}
