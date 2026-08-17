import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { validateDoctorInput } from "@/lib/validation/doctor";
import {
  ADMIN_PAGE_SIZE,
  parseAdminPageParam,
  validateAdminPageParam,
} from "@/lib/validation/pagination";

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

export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const searchParams = new URL(request.url).searchParams;
  const validationError = validateAdminPageParam(searchParams);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }
  const page = parseAdminPageParam(searchParams);

  let query = guard.supabase
    .from("doctors")
    .select(DOCTOR_LIST_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (page !== null) {
    const offset = (page - 1) * ADMIN_PAGE_SIZE;
    query = query.range(offset, offset + ADMIN_PAGE_SIZE - 1);
  }

  const { data, count, error } = await query;

  if (error) {
    // PGRST103 ("Requested range not satisfiable", HTTP 416) fires when
    // `offset` lands beyond the last row of the result set (a stale deep
    // page after rows were deleted). Re-issue a head-only count so the
    // response still carries the REAL total — a deliberate improvement over
    // app/api/doctors/route.ts's equivalent branch, which returns a
    // fabricated `total: 0` there (recorded open warning, STATE.md Phase 3
    // WR-02). This branch only applies in paginated mode; page is non-null
    // here because .range() is only called when page is not null.
    if (error.code === "PGRST103") {
      const { count: realCount } = await guard.supabase
        .from("doctors")
        .select("id", { count: "exact", head: true });
      return NextResponse.json({
        doctors: [],
        total: realCount ?? 0,
        page,
        pageSize: ADMIN_PAGE_SIZE,
      });
    }
    return NextResponse.json(
      { error: "Could not load doctors. Please refresh the page." },
      { status: 500 },
    );
  }

  const doctors = (data as unknown as RawDoctorRow[]).map(toListRow);

  if (page !== null) {
    return NextResponse.json({
      doctors,
      total: count ?? 0,
      page,
      pageSize: ADMIN_PAGE_SIZE,
    });
  }

  return NextResponse.json({ doctors, total: count ?? doctors.length });
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json();
  const validationError = validateDoctorInput(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { fullName, specialtyId, locationId, bio, photoUrl, languageIds } = body as {
    fullName: string;
    specialtyId: string;
    locationId: string;
    bio?: string | null;
    photoUrl?: string | null;
    languageIds?: string[];
  };

  // is_active, is_demo and profile_id are never read from the request body —
  // they come from the column defaults (false, true, null), mirroring the
  // hardcoded `role` in app/api/auth/signup/route.ts (T-02-01).
  const { data: inserted, error: insertError } = await guard.supabase
    .from("doctors")
    .insert({
      full_name: fullName,
      specialty_id: specialtyId,
      location_id: locationId,
      bio: bio ?? null,
      photo_url: photoUrl ?? null,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: "Could not save doctor. Please try again." },
      { status: 500 },
    );
  }

  if (Array.isArray(languageIds) && languageIds.length > 0) {
    const { error: languagesError } = await guard.supabase.from("doctor_languages").insert(
      languageIds.map((languageId) => ({
        doctor_id: inserted.id,
        language_id: languageId,
      })),
    );

    if (languagesError) {
      // Leave no doctor row without its language associations.
      await guard.supabase.from("doctors").delete().eq("id", inserted.id);
      return NextResponse.json(
        { error: "Could not save doctor. Please try again." },
        { status: 500 },
      );
    }
  }

  const { data: created, error: reloadError } = await guard.supabase
    .from("doctors")
    .select(DOCTOR_LIST_SELECT)
    .eq("id", inserted.id)
    .single();

  if (reloadError || !created) {
    return NextResponse.json(
      { error: "Could not save doctor. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { doctor: toListRow(created as unknown as RawDoctorRow) },
    { status: 201 },
  );
}
