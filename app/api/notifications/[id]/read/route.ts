import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

// Both the lookup and the update below are scoped by `id` AND
// `user_id = <caller>` in the same `WHERE` clause, never by `id` alone
// followed by a separate ownership comparison. A notification id that
// exists but belongs to another user must produce the exact same "not
// found" result as an id that does not exist at all — otherwise the
// response becomes an oracle an attacker can use to confirm a foreign
// notification id is real. This is why a foreign id returns 404, not 403:
// 403 would confirm existence (mirrors app/api/doctor/slots/[id]/route.ts's
// T-04-03 doctrine).
const NOT_FOUND_MESSAGE = "This notification no longer exists.";
const GENERIC_FAILURE_MESSAGE = "Could not update this notification. Please try again.";

// A malformed (non-UUID) id is a client input error, not a server failure —
// it is rejected here before it ever reaches Postgres, which would
// otherwise reject it as an "invalid input syntax for type uuid" error and
// surface as a 500. Answered with the same 404 as a genuinely-missing id,
// never 400, so a malformed id never becomes an oracle for "this looked
// like a real id" vs. "this is garbage".
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
  }

  // read_at is written unconditionally (no `.is("read_at", null)` filter),
  // so re-marking an already-read notification succeeds and simply
  // refreshes the timestamp — the second call must not become a spurious
  // 404, since the UI-SPEC's mark-all-on-open interaction (06-06) is
  // fire-and-forget and may call this more than once for the same id.
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: GENERIC_FAILURE_MESSAGE }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
