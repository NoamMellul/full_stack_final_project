import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { validateEmail, validateFullName, validatePassword } from "@/lib/validation/auth";

export async function POST(request: Request) {
  const body = await request.json();
  const { email, password, fullName } = body;

  const emailError = validateEmail(email);
  const passwordError = validatePassword(password);
  const nameError = validateFullName(fullName);
  if (emailError || passwordError || nameError) {
    return NextResponse.json(
      { error: emailError ?? passwordError ?? nameError },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Create an already-confirmed user regardless of the project's email-confirmation
  // setting on the remote hosted Supabase project.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    const isDuplicate =
      createError?.message?.toLowerCase().includes("already been registered") ||
      createError?.message?.toLowerCase().includes("already registered") ||
      createError?.message?.toLowerCase().includes("already exists") ||
      createError?.code === "email_exists";
    if (isDuplicate) {
      return NextResponse.json(
        { error: "An account with this email already exists. Try logging in instead." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: createError?.message ?? "Could not create account." },
      { status: 400 },
    );
  }

  // Insert the profiles row server-side with a hardcoded role — the profiles
  // RLS INSERT policy only checks `id = auth.uid()`, never `role`, so the
  // role value must never be taken from client input (T-01-01).
  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    role: "patient",
    full_name: fullName,
    email,
  });
  if (profileError) {
    // Leave no orphaned auth account when the profile row can't be created.
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: "Could not create profile." }, { status: 500 });
  }

  // Sign in through the SSR server client so Set-Cookie headers land on this response.
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    return NextResponse.json({ error: signInError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
