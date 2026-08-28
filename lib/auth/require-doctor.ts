import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export type DoctorGuardResult =
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string; doctorId: string }
  | { ok: false; response: NextResponse };

// Defence-in-depth over the already-deployed `availability_slots_write_owner_or_admin`
// RLS policy — RLS remains the actual authority; this guard only gives a caller
// a clean 401/403 instead of an opaque database rejection, mirroring
// `requireAdmin()`'s shape (T-02-02 precedent).
//
// The `doctors` row lookup below re-derives the exact same condition as
// `is_doctor_owner()` in the initial schema migration — `profile_id = auth.uid()`
// — so the id this guard resolves is provably the same id RLS would accept
// (D-06, D-07).
export async function requireDoctor(): Promise<DoctorGuardResult> {
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

  const { data: doctor, error: doctorError } = await supabase
    .from("doctors")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (doctorError) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 },
      ),
    };
  }
  if (!doctor) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not authorized." }, { status: 403 }),
    };
  }

  // The `(gated)` layout only blocks the doctor *pages* on an unresolved
  // must_change_password flag — it never covers /api/doctor/*, leaving those
  // routes reachable indefinitely on an admin-issued temp password. This
  // closes that gap (T-EQS-02).
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("must_change_password")
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
  if (profile?.must_change_password) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "You must change your temporary password before continuing." },
        { status: 403 },
      ),
    };
  }

  return { ok: true, supabase, userId: user.id, doctorId: doctor.id };
}
