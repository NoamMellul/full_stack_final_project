import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";

// Read-only platform-wide oversight view (ADMIN-07). requireAdmin() gives a
// clean 401/403; profiles_select_own_or_admin RLS independently restricts a
// non-admin caller to their own row even if this guard were ever bypassed
// (T-02-02).
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { data, error } = await guard.supabase
    .from("profiles")
    .select("id, role, full_name, email, created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Could not load users. Please refresh the page." },
      { status: 500 },
    );
  }

  return NextResponse.json({ users: data });
}
