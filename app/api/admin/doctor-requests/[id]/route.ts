import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";

// The action is implicit in the endpoint — no request body is parsed. The
// operation is deliberately one-way and idempotent: a second PATCH on an
// already-reviewed row still matches, still writes 'reviewed', still
// returns 200. There is no un-review action.
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  // Chaining .select("id") on the update is required: a PostgREST write
  // matching zero rows does not error on its own, so without the chained
  // select a PATCH on a bogus id would silently return 200 (the 04-02
  // lesson).
  const { data, error } = await guard.supabase
    .from("doctor_requests")
    .update({ status: "reviewed" })
    .eq("id", id)
    .select("id");

  if (error) {
    return NextResponse.json(
      { error: "Could not update this request. Please try again." },
      { status: 500 },
    );
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Doctor request not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
