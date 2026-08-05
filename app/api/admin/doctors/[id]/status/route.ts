import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { validateStatusInput } from "@/lib/validation/doctor";

const DOCTOR_LIST_SELECT =
  "id, full_name, bio, photo_url, is_active, is_demo, profile_id, created_at, " +
  "specialty:specialties(id,name_en,name_he), " +
  "location:locations(id,city,neighborhood), " +
  "languages:doctor_languages(languages(id,code))";

type RawDoctorRow = {
  id: string;
  full_name: string;
  bio: string | null;
  photo_url: string | null;
  is_active: boolean;
  is_demo: boolean;
  profile_id: string | null;
  created_at: string;
  specialty: { id: string; name_en: string; name_he: string } | null;
  location: { id: string; city: string; neighborhood: string } | null;
  languages: { languages: { id: string; code: string } | null }[] | null;
};

function toListRow(row: RawDoctorRow) {
  return {
    id: row.id,
    full_name: row.full_name,
    bio: row.bio,
    photo_url: row.photo_url,
    is_active: row.is_active,
    is_demo: row.is_demo,
    profile_id: row.profile_id,
    created_at: row.created_at,
    specialty: row.specialty,
    location: row.location,
    languages: (row.languages ?? []).flatMap((entry) => (entry.languages ? [entry.languages] : [])),
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  const body = await request.json();
  const validationError = validateStatusInput(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { data: existing, error: lookupError } = await guard.supabase
    .from("doctors")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json(
      { error: "Could not save doctor. Please try again." },
      { status: 500 },
    );
  }
  if (!existing) {
    return NextResponse.json({ error: "Doctor not found." }, { status: 404 });
  }

  const { isActive } = body as { isActive: boolean };

  // Assigns the explicit value the caller supplied — never the opposite of
  // the stored value — so sending the value the row already holds is a
  // successful no-op rather than a flip.
  const { error: updateError } = await guard.supabase
    .from("doctors")
    .update({ is_active: isActive })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json(
      { error: "Could not save doctor. Please try again." },
      { status: 500 },
    );
  }

  const { data: updated, error: reloadError } = await guard.supabase
    .from("doctors")
    .select(DOCTOR_LIST_SELECT)
    .eq("id", id)
    .single();

  if (reloadError || !updated) {
    return NextResponse.json(
      { error: "Could not save doctor. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ doctor: toListRow(updated as unknown as RawDoctorRow) });
}
