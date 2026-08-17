import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export type AdminGuardResult =
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
  | { ok: false; response: NextResponse };

// Defence-in-depth over the already-deployed `doctors_admin_write` (and
// sibling) RLS policies — RLS remains the actual authority; this guard only
// gives a caller a clean 401/403 instead of an opaque database rejection
// (T-02-02).
export async function requireAdmin(): Promise<AdminGuardResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 },
      ),
    };
  }
  if (profile?.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not authorized." }, { status: 403 }),
    };
  }

  return { ok: true, supabase, userId: user.id };
}
