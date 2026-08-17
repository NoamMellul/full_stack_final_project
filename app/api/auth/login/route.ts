import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { validateEmail } from "@/lib/validation/auth";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    // Byte-identical to the route's other two 400/401 branches below — a
    // distinguishable parse-error message would itself be a user-enumeration
    // oracle signal, breaking this endpoint's non-oracle guarantee (T-01-08).
    return NextResponse.json(
      { error: "Incorrect email or password. Please try again." },
      { status: 400 },
    );
  }

  // A body of the literal 4 bytes `null` parses successfully above (no
  // exception -- `null` is valid JSON), so without this normalization a
  // null `body` would throw on the destructure immediately below (code
  // review WR-01, mirrored from app/api/appointments/route.ts).
  if (typeof body !== "object" || body === null) {
    body = {};
  }

  const { email, password } = body as { email: string; password: string };

  // Server-side validation failure returns the same generic copy as a bad
  // credential — a caller-visible difference between "malformed address" and
  // "wrong password" would be a user-enumeration oracle (T-01-08).
  const emailError = validateEmail(email);
  const hasPassword = typeof password === "string" && password.length > 0;
  if (emailError || !hasPassword) {
    return NextResponse.json(
      { error: "Incorrect email or password. Please try again." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return NextResponse.json(
      { error: "Incorrect email or password. Please try again." },
      { status: 401 },
    );
  }

  // Session-bound client, not the service-role admin client, so this read
  // stays behind profiles_select_own_or_admin RLS (T-01-05).
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  return NextResponse.json({ success: true, role: profile?.role ?? null });
}
