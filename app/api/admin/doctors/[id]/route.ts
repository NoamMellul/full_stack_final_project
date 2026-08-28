import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { validateDoctorPatch } from "@/lib/validation/doctor";

const DOCTOR_LIST_SELECT =
  "id, full_name, bio, photo_url, phone, is_active, is_demo, profile_id, created_at, " +
  "specialty:specialties(id,name_en,name_he), " +
  "location:locations(id,city,neighborhood), " +
  "languages:doctor_languages(languages(id,code))";

type RawDoctorRow = {
  id: string;
  full_name: string;
  bio: string | null;
  photo_url: string | null;
  phone: string | null;
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
    phone: row.phone,
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
  const validationError = validateDoctorPatch(body);
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

  const { fullName, specialtyId, locationId, bio, photoUrl, phone, languageIds } = body as {
    fullName?: string;
    specialtyId?: string;
    locationId?: string;
    bio?: string | null;
    photoUrl?: string | null;
    phone?: string | null;
    languageIds?: string[];
  };

  // is_active, is_demo and profile_id are never read from the request body on
  // this route — status changes go through the dedicated status endpoint and
  // the other two are server-owned (T-02-01).
  const updates: Record<string, unknown> = {};
  if ("fullName" in body) updates.full_name = fullName;
  if ("specialtyId" in body) updates.specialty_id = specialtyId;
  if ("locationId" in body) updates.location_id = locationId;
  if ("photoUrl" in body) updates.photo_url = photoUrl ?? null;
  if ("bio" in body) updates.bio = bio ?? null;
  // D-04: a non-blank string is stored trimmed; blank/undefined/null all
  // store NULL — this is what makes clearing the input in the edit dialog
  // persist as NULL rather than an empty string.
  if ("phone" in body) {
    updates.phone = typeof phone === "string" && phone.trim() ? phone.trim() : null;
  }

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await guard.supabase
      .from("doctors")
      .update(updates)
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { error: "Could not save doctor. Please try again." },
        { status: 500 },
      );
    }
  }

  if (Array.isArray(languageIds)) {
    // Replace (delete-then-insert), never append — this is what makes a
    // repeated identical PATCH a no-op instead of accumulating duplicates.
    const { error: deleteError } = await guard.supabase
      .from("doctor_languages")
      .delete()
      .eq("doctor_id", id);

    if (deleteError) {
      return NextResponse.json(
        { error: "Could not save doctor. Please try again." },
        { status: 500 },
      );
    }

    if (languageIds.length > 0) {
      const { error: insertError } = await guard.supabase.from("doctor_languages").insert(
        languageIds.map((languageId) => ({
          doctor_id: id,
          language_id: languageId,
        })),
      );

      if (insertError) {
        return NextResponse.json(
          { error: "Could not save doctor. Please try again." },
          { status: 500 },
        );
      }
    }
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
