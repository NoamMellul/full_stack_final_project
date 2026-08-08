// Manual TypeScript validation/normalization for /search and GET /api/doctors
// query parameters (no schema library, mirrors lib/validation/doctor.ts's
// style: one exported function per concern, plain `if` chains, string | null
// return where null means valid).

// PAGE_SIZE is a server-side constant, never read from the request (T-03-04).
export const PAGE_SIZE = 6;

// Upper clamp on `page` so an absurd page number cannot force a huge OFFSET
// scan (T-03-04).
export const MAX_PAGE = 1000;

// Same 8-4-4-4-12 hex form used to guard the [id] path segment in
// app/api/doctors/[id]/route.ts — reused here to validate the `specialty`
// filter before it ever reaches a query.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Mirrors the `languages.code` check constraint
// (supabase/migrations/20260803230000_initial_schema.sql) — the only two
// values the `language` filter may ever carry.
export const LANGUAGE_CODES = ["he", "en"] as const;

const NEIGHBORHOOD_MAX_LENGTH = 120;

// Calendar-day form only (no time component) — the availability range is
// expressed in the URL as Asia/Jerusalem calendar days, not UTC instants, so
// a shared/refreshed URL selects the same Israeli days on both sides of a
// DST transition (D-13).
const CALENDAR_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Round-trips `dateStr` through Date.UTC and back to reject strings that
// match CALENDAR_DAY_PATTERN but are not real calendar dates (e.g.
// 2026-13-01, 2026-02-30) — Date.UTC silently rolls those over rather than
// throwing.
function isValidCalendarDate(dateStr: string): boolean {
  if (!CALENDAR_DAY_PATTERN.test(dateStr)) {
    return false;
  }
  const [year, month, day] = dateStr.split("-").map(Number);
  const asDate = new Date(Date.UTC(year, month - 1, day));
  return (
    asDate.getUTCFullYear() === year &&
    asDate.getUTCMonth() === month - 1 &&
    asDate.getUTCDate() === day
  );
}

// Widened by plans 03-05 (filters) and 03-06 (pagination controls) — keep
// this type exported so those plans extend rather than replace it.
export type ParsedSearchParams = {
  q: string | null;
  specialtyId: string | null;
  language: string | null;
  neighborhood: string | null;
  availableFrom: string | null;
  availableTo: string | null;
  page: number;
  // True only when the patient supplied a non-whitespace q that stripped
  // down to nothing (a lone %, _, * or \, or any combination of only those
  // characters) — deliberately distinct from q being null, which means no
  // search term was supplied at all. A patient search that matches nothing
  // must fail closed rather than fall through to an unfiltered view query
  // (T-03-16, mirrors the availability filter's T-03-13 short circuit).
  qMatchesNothing: boolean;
};

// LIKE/PostgREST pattern metacharacters stripped from `q` before it is used
// to build an `ilike` predicate. A doctor-name search has no legitimate use
// for any of these, and a lone wildcard character must not be able to match
// every row or alter the predicate (T-03-01).
const LIKE_METACHARACTERS_RE = /[%_*\\]/g;

export function validateSearchParams(params: URLSearchParams): string | null {
  const page = params.get("page");
  if (page !== null) {
    if (!/^[0-9]+$/.test(page)) {
      return "Page must be a whole number between 1 and 1000.";
    }
    const pageNumber = Number(page);
    if (pageNumber < 1 || pageNumber > MAX_PAGE) {
      return "Page must be a whole number between 1 and 1000.";
    }
  }

  const specialty = params.get("specialty");
  if (specialty !== null && specialty !== "" && !UUID_PATTERN.test(specialty)) {
    return "Specialty filter is invalid.";
  }

  const language = params.get("language");
  if (
    language !== null &&
    language !== "" &&
    !LANGUAGE_CODES.includes(language as (typeof LANGUAGE_CODES)[number])
  ) {
    return "Language filter must be Hebrew or English.";
  }

  const neighborhood = params.get("neighborhood");
  if (neighborhood !== null && neighborhood.length > NEIGHBORHOOD_MAX_LENGTH) {
    return "Neighborhood filter is invalid.";
  }

  const availableFrom = params.get("availableFrom");
  if (availableFrom !== null && availableFrom !== "" && !isValidCalendarDate(availableFrom)) {
    return "Dates must be in YYYY-MM-DD format.";
  }

  const availableTo = params.get("availableTo");
  if (availableTo !== null && availableTo !== "" && !isValidCalendarDate(availableTo)) {
    return "Dates must be in YYYY-MM-DD format.";
  }

  if (
    availableFrom &&
    availableTo &&
    isValidCalendarDate(availableFrom) &&
    isValidCalendarDate(availableTo) &&
    availableTo < availableFrom
  ) {
    return "The end date must be on or after the start date.";
  }

  return null;
}

export function parseSearchParams(params: URLSearchParams): ParsedSearchParams {
  const rawQ = params.get("q");
  let q: string | null = null;
  let qMatchesNothing = false;
  if (rawQ !== null) {
    const trimmed = rawQ.trim();
    if (trimmed) {
      const stripped = trimmed.replace(LIKE_METACHARACTERS_RE, "");
      if (stripped) {
        q = stripped;
      } else {
        // A non-whitespace term stripped down to nothing — this is a filter
        // that matches nothing, not the same as no filter at all.
        qMatchesNothing = true;
      }
    }
  }

  const rawSpecialty = params.get("specialty");
  const specialtyId = rawSpecialty !== null && rawSpecialty.trim() ? rawSpecialty.trim() : null;

  const rawLanguage = params.get("language");
  const language = rawLanguage !== null && rawLanguage.trim() ? rawLanguage.trim() : null;

  const rawNeighborhood = params.get("neighborhood");
  const neighborhood =
    rawNeighborhood !== null && rawNeighborhood.trim() ? rawNeighborhood.trim() : null;

  const rawAvailableFrom = params.get("availableFrom");
  const availableFrom =
    rawAvailableFrom !== null && rawAvailableFrom.trim() ? rawAvailableFrom.trim() : null;

  const rawAvailableTo = params.get("availableTo");
  const availableTo =
    rawAvailableTo !== null && rawAvailableTo.trim() ? rawAvailableTo.trim() : null;

  const rawPage = params.get("page");
  const page = rawPage !== null && /^[0-9]+$/.test(rawPage) ? Number(rawPage) : 1;

  return {
    q,
    specialtyId,
    language,
    neighborhood,
    availableFrom,
    availableTo,
    page,
    qMatchesNothing,
  };
}
