// Manual TypeScript validation/normalization for /search and GET /api/doctors
// query parameters (no schema library, mirrors lib/validation/doctor.ts's
// style: one exported function per concern, plain `if` chains, string | null
// return where null means valid).

// PAGE_SIZE is a server-side constant, never read from the request (T-03-04).
export const PAGE_SIZE = 6;

// Upper clamp on `page` so an absurd page number cannot force a huge OFFSET
// scan (T-03-04).
export const MAX_PAGE = 1000;

// Widened by plans 03-05 (filters) and 03-06 (pagination controls) — keep
// this type exported so those plans extend rather than replace it.
export type ParsedSearchParams = {
  q: string | null;
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

  const rawPage = params.get("page");
  const page = rawPage !== null && /^[0-9]+$/.test(rawPage) ? Number(rawPage) : 1;

  return { q, page };
}
