import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { validateLocationInput } from "@/lib/validation/reference-data";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { data: locations, error } = await guard.supabase
    .from("locations")
    .select("id, city, neighborhood, address")
    .order("city", { ascending: true })
    .order("neighborhood", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Could not load locations. Please refresh the page." },
      { status: 500 },
    );
  }

  // One round trip for every doctor's location_id, folded into counts here —
  // never one count query per row.
  const { data: doctorRows, error: doctorsError } = await guard.supabase
    .from("doctors")
    .select("location_id");

  if (doctorsError) {
    return NextResponse.json(
      { error: "Could not load locations. Please refresh the page." },
      { status: 500 },
    );
  }

  const doctorCountByLocation = new Map<string, number>();
  for (const row of doctorRows ?? []) {
    const key = row.location_id as string;
    doctorCountByLocation.set(key, (doctorCountByLocation.get(key) ?? 0) + 1);
  }

  return NextResponse.json({
    locations: (locations ?? []).map((location) => ({
      id: location.id,
      city: location.city,
      neighborhood: location.neighborhood,
      address: location.address,
      doctorCount: doctorCountByLocation.get(location.id) ?? 0,
    })),
  });
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json();
  const validationError = validateLocationInput(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { city, neighborhood, address } = body as {
    city: string;
    neighborhood: string;
    address?: string | null;
  };

  const { data: inserted, error: insertError } = await guard.supabase
    .from("locations")
    .insert({
      city: city.trim(),
      neighborhood: neighborhood.trim(),
      address: address ? address.trim() : null,
    })
    .select("id, city, neighborhood, address")
    .single();

  if (insertError || !inserted) {
    // 23505 = Postgres unique_violation — never forward the raw constraint
    // name to the client (T-02-06).
    if (insertError?.code === "23505") {
      return NextResponse.json(
        { error: "A location with this name already exists." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Could not save location. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { location: { ...inserted, doctorCount: 0 } },
    { status: 201 },
  );
}
