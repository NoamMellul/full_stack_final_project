import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { validateLocationPatch } from "@/lib/validation/reference-data";

const DUPLICATE_MESSAGE = "A location with this name already exists.";
const DELETE_GUARD_MESSAGE =
  "This location is still assigned to one or more doctors and cannot be deleted.";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  const body = await request.json();
  const validationError = validateLocationPatch(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { data: existing, error: lookupError } = await guard.supabase
    .from("locations")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json(
      { error: "Could not save location. Please try again." },
      { status: 500 },
    );
  }
  if (!existing) {
    return NextResponse.json({ error: "Location not found." }, { status: 404 });
  }

  const { city, neighborhood, address } = body as {
    city?: string;
    neighborhood?: string;
    address?: string | null;
  };
  const updates: Record<string, unknown> = {};
  if ("city" in body) updates.city = city?.trim();
  if ("neighborhood" in body) updates.neighborhood = neighborhood?.trim();
  if ("address" in body) updates.address = address ? address.trim() : null;

  const { data: updated, error: updateError } = await guard.supabase
    .from("locations")
    .update(updates)
    .eq("id", id)
    .select("id, city, neighborhood, address")
    .single();

  if (updateError || !updated) {
    if (updateError?.code === "23505") {
      return NextResponse.json({ error: DUPLICATE_MESSAGE }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Could not save location. Please try again." },
      { status: 500 },
    );
  }

  const { count: doctorCount } = await guard.supabase
    .from("doctors")
    .select("*", { count: "exact", head: true })
    .eq("location_id", id);

  return NextResponse.json({ location: { ...updated, doctorCount: doctorCount ?? 0 } });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  const { data: existing, error: lookupError } = await guard.supabase
    .from("locations")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json(
      { error: "Could not delete location. Please try again." },
      { status: 500 },
    );
  }
  if (!existing) {
    return NextResponse.json({ error: "Location not found." }, { status: 404 });
  }

  // The actual server-side guard (D-06) — never trust the client's disabled
  // button. Re-checked here independently of whatever the browser last saw.
  const { count: doctorCount, error: countError } = await guard.supabase
    .from("doctors")
    .select("*", { count: "exact", head: true })
    .eq("location_id", id);

  if (countError) {
    return NextResponse.json(
      { error: "Could not delete location. Please try again." },
      { status: 500 },
    );
  }

  if ((doctorCount ?? 0) > 0) {
    return NextResponse.json(
      { error: DELETE_GUARD_MESSAGE, doctorCount },
      { status: 409 },
    );
  }

  const { error: deleteError } = await guard.supabase
    .from("locations")
    .delete()
    .eq("id", id);

  if (deleteError) {
    // 23503 = Postgres foreign_key_violation — a doctor was created between
    // the count above and this delete. Translate, never forward raw text.
    if (deleteError.code === "23503") {
      const { count: recheckedCount } = await guard.supabase
        .from("doctors")
        .select("*", { count: "exact", head: true })
        .eq("location_id", id);
      return NextResponse.json(
        { error: DELETE_GUARD_MESSAGE, doctorCount: recheckedCount ?? 1 },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Could not delete location. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
