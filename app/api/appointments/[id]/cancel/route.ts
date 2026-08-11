import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN, validateCancelInput } from "@/lib/validation/appointments";

// Neither requirePatient() nor requireDoctor() fits this route: D-12 allows
// both the booking patient and the owning doctor to cancel, so a role guard
// would 403 one of the two legitimate actors. This handler only checks that
// a session exists (401 when it doesn't) — authorization proper is not
// attempted at this layer at all. cancel_appointment() resolves the acting
// party from auth.uid() and filters its appointment lookup by
// `patient_id = auth.uid() or doctors.profile_id = auth.uid()` inside its
// own SECURITY DEFINER body, which is the real boundary because the
// function bypasses RLS. Do not "fix" this by adding a role guard.

const NOT_FOUND_MESSAGE = "This appointment no longer exists.";
const NOT_MODIFIABLE_MESSAGE = "This appointment can no longer be cancelled.";
const GENERIC_FAILURE_MESSAGE = "Could not cancel this appointment. Please try again.";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;

  // A malformed id is answered identically to a genuinely missing one, so
  // the response gives no signal about which ids look real (T-05-05).
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
  }

  let body: unknown;
  try {
    const text = await request.text();
    body = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // A body of the literal 4 bytes `null` parses successfully above (no
  // exception -- `null` is valid JSON), so without this normalization
  // `body` could reach the `{ reason: rawReason } = body` destructure below
  // as `null`, which throws (code review WR-01). validateCancelInput treats
  // a bodyless request as "no reason provided" (reason is optional), so
  // normalizing to `{}` here keeps that behaviour while making the later
  // destructure safe.
  if (typeof body !== "object" || body === null) {
    body = {};
  }

  const validationError = validateCancelInput(body as Record<string, unknown>);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { reason: rawReason } = body as { reason?: unknown };

  // trim() is used only to test blankness — the value sent to the database
  // must be byte-identical to what the user typed (Phase 4's D-04 rule).
  const reason =
    typeof rawReason === "string" && rawReason.trim().length > 0 ? rawReason : null;

  const { data: newStatus, error } = await supabase.rpc("cancel_appointment", {
    p_appointment_id: id,
    p_reason: reason,
  });

  if (error || !newStatus) {
    // Branch strictly on the flat `error.code` string, never on
    // `error.message` — the database's own rejection text must never reach
    // the client.
    if (error?.code === "MR004") {
      return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
    }
    if (error?.code === "MR002") {
      return NextResponse.json({ error: NOT_MODIFIABLE_MESSAGE }, { status: 409 });
    }
    if (error?.code === "MR005") {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    return NextResponse.json({ error: GENERIC_FAILURE_MESSAGE }, { status: 500 });
  }

  return NextResponse.json({ status: newStatus }, { status: 200 });
}
