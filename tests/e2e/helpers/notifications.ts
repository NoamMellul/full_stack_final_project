import { testAdminClient } from "./supabase-admin";

// `notifications` has no insert RLS policy for any client role — in
// production only the SECURITY DEFINER appointment functions
// (book_appointment/cancel_appointment/reschedule_appointment, Pattern 2)
// insert a row. The service-role client is therefore the only way a test
// can seed a notification directly, mirroring
// tests/e2e/helpers/appointments.ts's module-level tracking array +
// splice-based cleanup idiom.
const createdNotificationIds: string[] = [];

export type TestNotificationType =
  | "appointment_booked"
  | "appointment_cancelled"
  | "appointment_rescheduled";

export async function insertTestNotification(opts: {
  userId: string;
  type?: TestNotificationType;
  message?: string;
  relatedAppointmentId?: string | null;
}): Promise<{ id: string }> {
  const admin = testAdminClient();

  const { data, error } = await admin
    .from("notifications")
    .insert({
      user_id: opts.userId,
      type: opts.type ?? "appointment_booked",
      message: opts.message ?? "fixture row",
      related_appointment_id: opts.relatedAppointmentId ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create test notification: ${error?.message}`);
  }

  createdNotificationIds.push(data.id);
  return { id: data.id };
}

export type TestNotificationRow = {
  id: string;
  type: string;
  read_at: string | null;
  created_at: string;
};

export async function readNotificationsFor(userId: string): Promise<TestNotificationRow[]> {
  const admin = testAdminClient();

  const { data, error } = await admin
    .from("notifications")
    .select("id, type, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to read test notifications: ${error.message}`);
  }

  return data ?? [];
}

export async function cleanupTestNotifications(): Promise<void> {
  const admin = testAdminClient();

  const ids = createdNotificationIds.splice(0, createdNotificationIds.length);
  for (const id of ids) {
    try {
      await admin.from("notifications").delete().eq("id", id);
    } catch {
      // Swallow individual failures so one dead id cannot abort the rest.
    }
  }
}
