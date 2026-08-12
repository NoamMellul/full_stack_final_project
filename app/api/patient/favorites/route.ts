import { NextResponse } from "next/server";

import { requirePatient } from "@/lib/auth/require-patient";
import { validateFavoriteInput } from "@/lib/validation/favorites";

// The exact doctor_search_view column set DoctorSearchResult (components/
// search/doctor-card.tsx) expects — reused as-is so a favorites row's
// `doctor` field never needs a second, differently-shaped type.
const DOCTOR_SEARCH_SELECT =
  "id, full_name, bio, photo_url, is_demo, specialty_id, specialty_name_en, " +
  "specialty_name_he, location_id, city, neighborhood, language_codes, next_available_at";

// Mirrors app/api/doctors/route.ts's RawSearchRow — same view, same columns.
type RawDoctorSearchRow = {
  id: string;
  full_name: string;
  bio: string | null;
  photo_url: string | null;
  is_demo: boolean;
  specialty_id: string;
  specialty_name_en: string;
  specialty_name_he: string;
  location_id: string;
  city: string;
  neighborhood: string;
  language_codes: string[];
  next_available_at: string | null;
};

const GENERIC_LOAD_FAILURE = "Could not load your favorites. Please try again.";
const GENERIC_WRITE_FAILURE = "Could not update your favorites. Please try again.";

export async function POST(request: Request) {
  const guard = await requirePatient();
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const validationError = validateFavoriteInput(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { doctorId } = body as { doctorId: string };

  // `patient_id` is always taken from `guard.userId` — a client-supplied
  // `patientId` in the body is never read, so it is inert even though
  // `favorites_all_own` RLS would also reject a foreign write (T-06-04).
  const { error } = await guard.supabase
    .from("favorites")
    .insert({ patient_id: guard.userId, doctor_id: doctorId });

  if (error) {
    // Branch strictly on `error.code`, never `error.message` — the unique
    // (patient_id, doctor_id) constraint's exact violation text must never
    // reach the client.
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This doctor is already in your favorites." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: GENERIC_WRITE_FAILURE }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function GET() {
  const guard = await requirePatient();
  if (!guard.ok) return guard.response;

  // Two-step read (Phase 3 precedent, RESEARCH.md Pattern 1): reduce to an
  // id list first, then re-query doctor_search_view with `.in()` — a
  // PostgREST embed cannot cross a view boundary. `.eq("patient_id", ...)`
  // restates favorites_all_own RLS as defense-in-depth (T-06-07).
  const { data: favoriteRows, error: favoritesError } = await guard.supabase
    .from("favorites")
    .select("id, doctor_id, created_at")
    .eq("patient_id", guard.userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (favoritesError) {
    return NextResponse.json({ error: GENERIC_LOAD_FAILURE }, { status: 500 });
  }

  const rows = favoriteRows ?? [];

  if (rows.length === 0) {
    return NextResponse.json({ favorites: [] });
  }

  const doctorIds = rows.map((row) => row.doctor_id);

  const { data: doctorRows, error: doctorsError } = await guard.supabase
    .from("doctor_search_view")
    .select(DOCTOR_SEARCH_SELECT)
    .in("id", doctorIds);

  if (doctorsError) {
    return NextResponse.json({ error: GENERIC_LOAD_FAILURE }, { status: 500 });
  }

  const doctorById = new Map(
    ((doctorRows ?? []) as unknown as RawDoctorSearchRow[]).map((doctor) => [doctor.id, doctor]),
  );

  // Merge in JavaScript, preserving step one's order (stable across repeated
  // calls thanks to the `id` tiebreaker above). A row whose doctor is
  // inactive is not filtered here — doctor_search_view's `is_active = true`
  // filter simply has no match, so `doctor` is `null` and the favorites row
  // itself is left untouched.
  const favorites = rows.map((row) => ({
    id: row.id,
    doctor_id: row.doctor_id,
    created_at: row.created_at,
    doctor: doctorById.get(row.doctor_id) ?? null,
  }));

  return NextResponse.json({ favorites });
}
