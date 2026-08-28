// Manual TypeScript validation for admin list pagination (GET
// /api/admin/doctors and GET /api/admin/users) — mirrors lib/validation/
// search.ts's house style: one exported function per concern, plain `if`
// chains, string | null return where null means valid. Independent module
// from search.ts because these are independent surfaces (admin tables vs.
// public search filters), even though the bounds message is identical.

// ADMIN_PAGE_SIZE is a server-side constant, never read from the request
// (D-LAR-01/T-LAR-02) — a client-supplied page size would turn the endpoint
// into a full-table-dump primitive, mirroring the recorded T-03-04 rationale
// for PAGE_SIZE in lib/validation/search.ts.
export const ADMIN_PAGE_SIZE = 25;

// Upper clamp on `page` so an absurd page number cannot force a huge OFFSET
// scan (T-LAR-01), the same clamp lib/validation/search.ts uses.
export const MAX_ADMIN_PAGE = 1000;

// Returns null when `page` is absent — that is the valid unpaginated mode
// (D-LAR-03: an unparameterized GET still returns every row). Only returns
// an error when `page` is present and invalid.
export function validateAdminPageParam(params: URLSearchParams): string | null {
  const page = params.get("page");
  if (page === null) {
    return null;
  }

  if (!/^[0-9]+$/.test(page)) {
    return "Page must be a whole number between 1 and 1000.";
  }
  const pageNumber = Number(page);
  if (pageNumber < 1 || pageNumber > MAX_ADMIN_PAGE) {
    return "Page must be a whole number between 1 and 1000.";
  }

  return null;
}

// May assume validateAdminPageParam already ran. Returns null when `page` is
// absent (unpaginated mode) and the parsed number otherwise.
export function parseAdminPageParam(params: URLSearchParams): number | null {
  const page = params.get("page");
  if (page === null) {
    return null;
  }
  return Number(page);
}
