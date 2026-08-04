import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { validateSpecialtyInput } from "@/lib/validation/reference-data";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { data: specialties, error } = await guard.supabase
    .from("specialties")
    .select("id, name_he, name_en")
    .order("name_en", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Could not load specialties. Please refresh the page." },
      { status: 500 },
    );
  }

  // One round trip for every doctor's specialty_id, folded into counts here —
  // never one count query per row.
  const { data: doctorRows, error: doctorsError } = await guard.supabase
    .from("doctors")
    .select("specialty_id");

  if (doctorsError) {
    return NextResponse.json(
      { error: "Could not load specialties. Please refresh the page." },
      { status: 500 },
    );
  }

  const doctorCountBySpecialty = new Map<string, number>();
  for (const row of doctorRows ?? []) {
    const key = row.specialty_id as string;
    doctorCountBySpecialty.set(key, (doctorCountBySpecialty.get(key) ?? 0) + 1);
  }

  return NextResponse.json({
    specialties: (specialties ?? []).map((specialty) => ({
      id: specialty.id,
      name_he: specialty.name_he,
      name_en: specialty.name_en,
      doctorCount: doctorCountBySpecialty.get(specialty.id) ?? 0,
    })),
  });
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json();
  const validationError = validateSpecialtyInput(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { nameEn, nameHe } = body as { nameEn: string; nameHe: string };

  const { data: inserted, error: insertError } = await guard.supabase
    .from("specialties")
    .insert({ name_en: nameEn.trim(), name_he: nameHe.trim() })
    .select("id, name_he, name_en")
    .single();

  if (insertError || !inserted) {
    // 23505 = Postgres unique_violation — never forward the raw constraint
    // name to the client (T-02-06).
    if (insertError?.code === "23505") {
      return NextResponse.json(
        { error: "A specialty with this name already exists." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Could not save specialty. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { specialty: { ...inserted, doctorCount: 0 } },
    { status: 201 },
  );
}
