import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { validatePassword } from "@/lib/validation/auth";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json();
  const { password, confirmPassword } = body;

  const passwordError = validatePassword(password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    return NextResponse.json(
      { error: "Could not update password. Please try again." },
      { status: 500 },
    );
  }

  // The session client can no longer write must_change_password — the
  // column-level grants added by 20260804120200_add_must_change_password.sql
  // are exactly what stop a doctor clearing their own gate — so the
  // service-role client clears it here instead.
  const admin = createAdminClient();
  const { error: clearError } = await admin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", user.id);
  if (clearError) {
    return NextResponse.json(
      { error: "Could not update password. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
