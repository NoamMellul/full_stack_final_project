import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

// This guard exists for a clean 401/403 only — appointments_select_own_or_admin
// RLS remains the actual read authority, and book_appointment() independently
// re-derives the patient from auth.uid() because a SECURITY DEFINER function
// cannot rely on a caller-side guard (it bypasses RLS entirely). Mirrors
// requireDoctor()'s shape (T-02-02 precedent).
//
// There is no separate `patients` table, so the patient's id is auth.uid()
// directly (Phase 1 D-07) — this guard has no doctors-style second lookup
// to resolve a distinct resource id.
export type PatientGuardResult =
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
  | { ok: false; response: NextResponse };

export async function requirePatient(): Promise<PatientGuardResult> {
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
  if (profile?.role !== "patient") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not authorized." }, { status: 403 }),
    };
  }

  return { ok: true, supabase, userId: user.id };
}
