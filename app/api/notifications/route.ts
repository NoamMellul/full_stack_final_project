import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

// Read-only endpoint for a signed-in user's own notifications (NOTIF-01/02/
// 03/04). Both patients and doctors read the same `notifications` table, so
// this route deliberately uses the bare session shape (`createClient()` +
// `auth.getUser()`) instead of `requirePatient()`/`requireDoctor()` — either
// role guard would incorrectly lock the endpoint to one role.

// `message` is deliberately absent from this allowlist: D-03 requires the
// stored English text never be rendered to a user, and omitting it from the
// query entirely is a stronger guarantee than fetching and discarding it —
// it removes the possibility of a future component reading it off a
// response object. Do not add `message` back to this select.
export const NOTIFICATION_SELECT = "id, type, related_appointment_id, read_at, created_at";

export type NotificationRow = {
  id: string;
  type: string;
  related_appointment_id: string | null;
  read_at: string | null;
  created_at: string;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // `.eq("user_id", user.id)` is a mandatory app-level restatement of
  // notifications_select_own RLS — never rely on RLS alone to scope this
  // read. Ordered by created_at then id (stable tiebreak), matching
  // app/api/patient/appointments/route.ts.
  const { data, error } = await supabase
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Could not load notifications. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ notifications: data as unknown as NotificationRow[] });
}
