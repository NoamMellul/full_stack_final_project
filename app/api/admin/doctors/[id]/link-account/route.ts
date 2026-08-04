import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateEmail } from "@/lib/validation/auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await request.json();
  const { email } = body;

  const emailError = validateEmail(email);
  if (emailError) {
    return NextResponse.json({ error: emailError }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: doctor, error: doctorError } = await admin
    .from("doctors")
    .select("id, full_name, profile_id")
    .eq("id", id)
    .single();

  if (doctorError || !doctor) {
    return NextResponse.json({ error: "Doctor not found." }, { status: 404 });
  }

  if (doctor.profile_id) {
    return NextResponse.json(
      { error: "This doctor is already linked to a login account." },
      { status: 409 },
    );
  }

  // Cryptographically secure — this becomes a real login credential.
  const tempPassword = randomBytes(12).toString("base64url");

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
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
        { error: "An account with this email already exists." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Could not create a login for this doctor. Please try again." },
      { status: 500 },
    );
  }

  // Server-side literal — never taken from the request body (T-02-01), and
  // the flag lives in this real profiles column, never Supabase Auth's
  // client-editable metadata bag (T-02-04).
  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    role: "doctor",
    full_name: doctor.full_name,
    email,
    must_change_password: true,
  });
  if (profileError) {
    // Leave no orphaned auth account when the profile row can't be created.
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json(
      { error: "Could not create a login for this doctor. Please try again." },
      { status: 500 },
    );
  }

  const { error: linkError } = await admin
    .from("doctors")
    .update({ profile_id: created.user.id })
    .eq("id", id);
  if (linkError) {
    // A doctor row must never be left pointing at nothing while an account
    // exists for it — undo both the profile and the auth user.
    await admin.from("profiles").delete().eq("id", created.user.id);
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json(
      { error: "Could not create a login for this doctor. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ tempPassword, email }, { status: 201 });
}
