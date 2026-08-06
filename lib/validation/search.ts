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

// Widened by plans 03-05 (filters) and 03-06 (pagination controls) — keep
// this type exported so those plans extend rather than replace it.
export type ParsedSearchParams = {
  q: string | null;
  specialtyId: string | null;
  language: string | null;
  neighborhood: string | null;
  page: number;
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

  return null;
}

export function parseSearchParams(params: URLSearchParams): ParsedSearchParams {
  const rawQ = params.get("q");
  let q: string | null = null;
  if (rawQ !== null) {
    const trimmed = rawQ.trim();
    if (trimmed) {
      const stripped = trimmed.replace(LIKE_METACHARACTERS_RE, "");
      q = stripped ? stripped : null;
    }
  }

  const rawSpecialty = params.get("specialty");
  const specialtyId = rawSpecialty !== null && rawSpecialty.trim() ? rawSpecialty.trim() : null;

  const rawLanguage = params.get("language");
  const language = rawLanguage !== null && rawLanguage.trim() ? rawLanguage.trim() : null;

  const rawNeighborhood = params.get("neighborhood");
  const neighborhood =
    rawNeighborhood !== null && rawNeighborhood.trim() ? rawNeighborhood.trim() : null;

  const rawPage = params.get("page");
  const page = rawPage !== null && /^[0-9]+$/.test(rawPage) ? Number(rawPage) : 1;

  return { q, specialtyId, language, neighborhood, page };
}
