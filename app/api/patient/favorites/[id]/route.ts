import { NextResponse } from "next/server";

import { requirePatient } from "@/lib/auth/require-patient";

// `[id]` is `doctors.id` being un-favorited, not `favorites.id` — this
// matches FavoriteToggle's by-doctor-id UX at every entry point and avoids a
// lookup round trip.
//
// Missing, already-deleted, foreign-patient and malformed-UUID ids all
// return this exact same 404 body, so the response can never confirm
// another patient's favorite exists (T-06-06, mirrors T-04-03's precedent
// in app/api/doctor/slots/[id]/route.ts). This is why a foreign id is 404,
// never 403 — 403 would itself confirm existence.
const NOT_FOUND_MESSAGE = "This doctor is not in your favorites.";
const GENERIC_FAILURE_MESSAGE = "Could not update your favorites. Please try again.";

// A malformed (non-UUID) id is rejected here, before it can reach Postgres
// and raise an "invalid input syntax for type uuid" error that would
// otherwise surface as a 500.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePatient();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
  }

  // Both scoping conditions live in the delete's own WHERE clause together
  // (T-06-05, IDOR) — never delete by doctor id alone followed by a
  // separate ownership comparison.
  const { count, error } = await guard.supabase
    .from("favorites")
    .delete({ count: "exact" })
    .eq("patient_id", guard.userId)
    .eq("doctor_id", id);

  if (error) {
    return NextResponse.json({ error: GENERIC_FAILURE_MESSAGE }, { status: 500 });
  }

  if (!count || count === 0) {
    return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
