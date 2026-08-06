import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { jerusalemBoundaryToUtcIso } from "@/lib/timezone";
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

  const { q, specialtyId, language, neighborhood, availableFrom, availableTo, page } =
    parseSearchParams(searchParams);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();

  // Availability-range filter is a dedicated pre-query, never a range filter
  // on the view's next_available_at column — "has at least one slot in this
  // range" and "what is the earliest slot overall" are different questions
  // (RESEARCH.md Pattern 2 / Common Pitfall 3). Only runs when the filter is
  // active; leaves the final fetch a single .range() call either way (D-15).
  let matchingDoctorIds: string[] | null = null;
  if (availableFrom || availableTo) {
    let slotQuery = supabase
      .from("availability_slots")
      .select("doctor_id")
      .eq("status", "available")
      .gt("start_at", new Date().toISOString());

    if (availableFrom) {
      slotQuery = slotQuery.gte("start_at", jerusalemBoundaryToUtcIso(availableFrom, "start"));
    }
    if (availableTo) {
      slotQuery = slotQuery.lte("start_at", jerusalemBoundaryToUtcIso(availableTo, "end"));
    }

    const { data: slotRows, error: slotError } = await slotQuery;
    if (slotError) {
      return NextResponse.json(
        { error: "Could not load doctors. Please try again." },
        { status: 500 },
      );
    }

    matchingDoctorIds = [...new Set((slotRows ?? []).map((row) => row.doctor_id as string))];
    if (matchingDoctorIds.length === 0) {
      // Short circuit: no doctor has a matching slot, so an unfiltered view
      // query would silently return everyone (T-03-13) — return the empty
      // page directly instead.
      return NextResponse.json({ doctors: [], total: 0, page, pageSize: PAGE_SIZE });
    }
  }

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
  if (matchingDoctorIds) {
    query = query.in("id", matchingDoctorIds);
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
