import { NextResponse } from "next/server";

import { requireDoctor } from "@/lib/auth/require-doctor";

// Both the lookup and the delete below are scoped by `id` AND
// `doctor_id = guard.doctorId` together, never by `id` alone followed by a
// separate ownership comparison. A slot id that exists but belongs to
// another doctor must produce the exact same empty result as an id that
// does not exist at all — otherwise the response becomes an oracle an
// attacker can use to confirm a foreign slot id is real (T-04-03). This is
// why a foreign id returns 404, not 403: 403 would confirm existence.
//
// The `status` guard below reads live database state inside this same
// request — never a status supplied by the caller and never one cached by
// the client at list-load time. RLS (`availability_slots_write_owner_or_admin`)
// proves ownership only; it has no way to express "deletable only while not
// booked", so that rule has to be application logic (AVAIL-05, T-04-04).
//
// This handler performs exactly one write statement: the delete itself.
// D-02 forbids any compensating insert/upsert/update when a `blocked` row
// is removed — un-blocking a period must never regenerate availability for
// the freed range.

const NOT_FOUND_MESSAGE = "This entry no longer exists.";
const BOOKED_MESSAGE = "This slot has already been booked and can't be deleted.";
const GENERIC_FAILURE_MESSAGE = "Could not delete this entry. Please try again.";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireDoctor();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  // The `status` guard must be enforced atomically inside the delete's own
  // `WHERE` clause (`.neq("status", "booked")`), not via a separate lookup
  // beforehand — a lookup-then-delete pair is two round-trips, and a booking
  // request can flip this row from `available`/`blocked` to `booked` in the
  // window between them (TOCTOU). Zero rows affected is therefore ambiguous
  // between "never existed / not owned" and "just became booked", so it is
  // disambiguated below with a single re-read, never by trusting the earlier
  // snapshot.
  const { data: deleted, error: deleteError } = await guard.supabase
    .from("availability_slots")
    .delete()
    .eq("id", id)
    .eq("doctor_id", guard.doctorId)
    .neq("status", "booked")
    .select("id");

  if (deleteError) {
    return NextResponse.json({ error: GENERIC_FAILURE_MESSAGE }, { status: 500 });
  }

  if (!deleted || deleted.length === 0) {
    const { data: nowExisting, error: recheckError } = await guard.supabase
      .from("availability_slots")
      .select("status")
      .eq("id", id)
      .eq("doctor_id", guard.doctorId)
      .maybeSingle();

    if (recheckError) {
      return NextResponse.json({ error: GENERIC_FAILURE_MESSAGE }, { status: 500 });
    }
    if (nowExisting?.status === "booked") {
      return NextResponse.json({ error: BOOKED_MESSAGE }, { status: 409 });
    }
    return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
