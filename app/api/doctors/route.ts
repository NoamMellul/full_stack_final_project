import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, parseSearchParams, validateSearchParams } from "@/lib/validation/search";

// Locked column list from 03-01-SUMMARY.md (option-a, the RESEARCH.md
// minimal 13-column set) — must match doctor_search_view exactly.
const DOCTOR_SEARCH_SELECT =
  "id, full_name, bio, photo_url, is_demo, specialty_id, specialty_name_en, " +
  "specialty_name_he, location_id, city, neighborhood, language_codes, next_available_at";

type RawSearchRow = {
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

// Public, unauthenticated search endpoint (T-03-01/T-03-03/T-03-04 in
// 03-03-PLAN.md's threat model) — no requireAdmin() guard by design. RLS
// plus doctor_search_view's own is_active predicate are the only
// authorization authority for this route.
export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;

  const validationError = validateSearchParams(searchParams);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { q, specialtyId, language, neighborhood, page } = parseSearchParams(searchParams);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();

  let query = supabase
    .from("doctor_search_view")
    .select(DOCTOR_SEARCH_SELECT, { count: "exact" });

  if (q !== null) {
    query = query.ilike("full_name", `%${q}%`);
  }
  if (specialtyId) {
    query = query.eq("specialty_id", specialtyId);
  }
  if (neighborhood) {
    query = query.eq("neighborhood", neighborhood);
  }
  if (language) {
    query = query.contains("language_codes", [language]);
  }

  const { data, count, error } = await query
    .order("next_available_at", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) {
    return NextResponse.json(
      { error: "Could not load doctors. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    doctors: data as unknown as RawSearchRow[],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  });
}
