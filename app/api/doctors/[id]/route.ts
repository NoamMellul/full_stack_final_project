import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

// Guards the [id] path segment before it ever reaches a query. A non-UUID
// value would otherwise cause Postgres to reject the `.eq("id", id)` cast
// with a 22P02 error, surfacing as a 500 for what is really a missing
// resource (T-03-01).
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Public profile shape — deliberately narrower than the admin
// DOCTOR_LIST_SELECT (app/api/admin/doctors/[id]/route.ts): `profile_id`,
// `is_active` and `created_at` are omitted so they never reach a public
// response (T-03-05); `address` is added because PROFILE-01 requires it.
const PUBLIC_DOCTOR_SELECT =
  "id, full_name, bio, photo_url, phone, is_demo, " +
  "specialty:specialties(id,name_en,name_he), " +
  "location:locations(id,city,neighborhood,address), " +
  "languages:doctor_languages(languages(id,code))";

type RawDoctorRow = {
  id: string;
  full_name: string;
  bio: string | null;
  photo_url: string | null;
  phone: string | null;
  is_demo: boolean;
  specialty: { id: string; name_en: string; name_he: string } | null;
  location: { id: string; city: string; neighborhood: string; address: string | null } | null;
  languages: { languages: { id: string; code: string } | null }[] | null;
};

function toPublicDoctor(row: RawDoctorRow) {
  return {
    id: row.id,
    full_name: row.full_name,
    bio: row.bio,
    photo_url: row.photo_url,
    phone: row.phone,
    is_demo: row.is_demo,
    specialty: row.specialty,
    location: row.location,
    languages: (row.languages ?? []).flatMap((entry) => (entry.languages ? [entry.languages] : [])),
  };
}

// Public, unauthenticated endpoint — intentionally does not import
// requireAdmin(), matching app/api/doctors/route.ts. RLS
// (doctors_select_active_or_owner_or_admin,
// availability_slots_select_available_or_owner_or_admin) is the
// authorization authority; the .eq() predicates below restate it as
// defense-in-depth (T-03-03).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Doctor not found." }, { status: 404 });
  }

  const supabase = await createClient();

  const { data: doctor, error: doctorError } = await supabase
    .from("doctors")
    .select(PUBLIC_DOCTOR_SELECT)
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (doctorError) {
    return NextResponse.json(
      { error: "Could not load this doctor. Please try again." },
      { status: 500 },
    );
  }

  if (!doctor) {
    return NextResponse.json({ error: "Doctor not found." }, { status: 404 });
  }

  const { data: slots, error: slotsError } = await supabase
    .from("availability_slots")
    .select("id, start_at, end_at")
    .eq("doctor_id", id)
    .eq("status", "available")
    .gt("start_at", new Date().toISOString())
    .order("start_at", { ascending: true });

  if (slotsError) {
    return NextResponse.json(
      { error: "Could not load this doctor. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    doctor: toPublicDoctor(doctor as unknown as RawDoctorRow),
    upcomingSlots: slots ?? [],
  });
}
