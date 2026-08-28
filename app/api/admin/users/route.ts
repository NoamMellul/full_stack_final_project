import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import {
  ADMIN_PAGE_SIZE,
  parseAdminPageParam,
  validateAdminPageParam,
} from "@/lib/validation/pagination";

// Read-only platform-wide oversight view (ADMIN-07). requireAdmin() gives a
// clean 401/403; profiles_select_own_or_admin RLS independently restricts a
// non-admin caller to their own row even if this guard were ever bypassed
// (T-02-02).
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
    .from("profiles")
    .select("id, role, full_name, email, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (page !== null) {
    const offset = (page - 1) * ADMIN_PAGE_SIZE;
    query = query.range(offset, offset + ADMIN_PAGE_SIZE - 1);
  }

  const { data, count, error } = await query;

  if (error) {
    // Mirrors the PGRST103 branch in GET /api/admin/doctors — an
    // offset-past-last-row page returns an empty page carrying the real
    // total via a head-only count, rather than a 500.
    if (error.code === "PGRST103") {
      const { count: realCount } = await guard.supabase
        .from("profiles")
        .select("id", { count: "exact", head: true });
      return NextResponse.json({
        users: [],
        total: realCount ?? 0,
        page,
        pageSize: ADMIN_PAGE_SIZE,
      });
    }
    return NextResponse.json(
      { error: "Could not load users. Please refresh the page." },
      { status: 500 },
    );
  }

  if (page !== null) {
    return NextResponse.json({
      users: data,
      total: count ?? 0,
      page,
      pageSize: ADMIN_PAGE_SIZE,
    });
  }

  return NextResponse.json({ users: data, total: count ?? (data ?? []).length });
}
