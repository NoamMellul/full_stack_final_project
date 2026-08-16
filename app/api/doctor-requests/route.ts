import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { validateDoctorRequestInput } from "@/lib/validation/doctor-request";

// The application's first and only unauthenticated write endpoint — no
// requireX() guard. Authorization is the doctor_requests_insert_public RLS
// policy itself (with check (status = 'pending')), not this handler.
export async function POST(request: Request) {
  const body = await request.json();

  const validationError = validateDoctorRequestInput(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { fullName, email, specialtyId, message } = body as {
    fullName: string;
    email: string;
    specialtyId: string;
    message?: string | null;
  };

  // Trim behaviour: full_name/email are identity fields where surrounding
  // whitespace is never meaningful, so they are stored trimmed. message is
  // the one free-text field and is stored exactly as submitted, untrimmed
  // (the Phase 04 `reason` rule) — trim() below is used only to test
  // blankness. An empty-or-whitespace-only message is stored as null.
  const trimmedMessage = typeof message === "string" && message.trim() ? message : null;

  const supabase = await createClient();

  // status, id and created_at are never read from the request body — they
  // come from column defaults (pending / gen_random_uuid() / now()), the
  // same discipline as app/api/admin/doctors/route.ts's untouched
  // is_active/is_demo/profile_id note and app/api/auth/signup/route.ts's
  // hardcoded role.
  const { error } = await supabase.from("doctor_requests").insert({
    full_name: fullName.trim(),
    email: email.trim(),
    specialty_id: specialtyId,
    message: trimmedMessage,
  });

  if (error) {
    if (error.code === "23503") {
      return NextResponse.json({ error: "Specialty is required." }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Could not send your request. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
