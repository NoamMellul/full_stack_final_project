import { NextResponse } from "next/server";

import { requireDoctor } from "@/lib/auth/require-doctor";
import { validateSlotInput } from "@/lib/validation/availability";

const SLOT_SELECT = "id, start_at, end_at, status, reason";

export async function GET() {
  const guard = await requireDoctor();
  if (!guard.ok) return guard.response;

  // Filtered on `end_at`, not `start_at`: a multi-day blocked period that
  // started yesterday and ends tomorrow is still in force and must stay
  // visible (and therefore actionable) to the doctor, while a fully elapsed
  // row is dropped (D-15).
  const { data, error } = await guard.supabase
    .from("availability_slots")
    .select(SLOT_SELECT)
    .eq("doctor_id", guard.doctorId)
    .gt("end_at", new Date().toISOString())
    .order("start_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Could not load your schedule. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ slots: data });
}

export async function POST(request: Request) {
  const guard = await requireDoctor();
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const validationError = validateSlotInput(body as Record<string, unknown>);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { startAt, endAt } = body as { startAt: string; endAt: string };

  // `doctor_id` comes only from the guard — a `doctorId` key present in the
  // request body is inert (D-06, T-04-01). RLS `availability_slots_write_owner_or_admin`
  // independently rejects a write for a non-owned `doctor_id`.
  const { data, error } = await guard.supabase
    .from("availability_slots")
    .insert({
      doctor_id: guard.doctorId,
      start_at: startAt,
      end_at: endAt,
      status: "available",
    })
    .select(SLOT_SELECT)
    .single();

  if (error || !data) {
    // Branch strictly on the flat `error.code` string, never on `error.message`
    // or `error.details` — the database's exact rejection text must never
    // reach the client.
    if (error?.code === "23P01") {
      // Atomic GiST exclusion constraint violation — the authoritative overlap
      // guarantee. Always this exact generic string; never names whether the
      // collision was with an available, booked, or blocked row (D-11, T-04-05).
      return NextResponse.json(
        { error: "This time overlaps your existing schedule." },
        { status: 409 },
      );
    }
    if (error?.code === "23514") {
      // Defensive fallback behind validateSlotInput's own start-before-end check.
      return NextResponse.json(
        { error: "Start time must be before end time." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Could not save this time slot. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ slot: data }, { status: 201 });
}
