import { testAdminClient } from "./supabase-admin";

// Slot fixture helper for this phase's specs, mirroring the
// reference-data.ts conventions: a module-level tracking array plus a
// paired create/cleanup function.
const createdSlotIds: string[] = [];

export type TestSlotStatus = "available" | "booked" | "blocked";

export async function createTestSlots(
  doctorId: string,
  specs: Array<{ startAt: Date; endAt: Date; status?: TestSlotStatus }>,
): Promise<Array<{ id: string; startAt: Date; endAt: Date }>> {
  const admin = testAdminClient();

  const rows = specs.map((spec) => ({
    doctor_id: doctorId,
    start_at: spec.startAt.toISOString(),
    end_at: spec.endAt.toISOString(),
    status: spec.status ?? "available",
  }));

  const { data, error } = await admin.from("availability_slots").insert(rows).select("id");

  if (error || !data) {
    throw new Error(`Failed to create test availability slots: ${error?.message}`);
  }

  const ids = (data as Array<{ id: string }>).map((row) => row.id);
  createdSlotIds.push(...ids);

  return ids.map((id, index) => ({
    id,
    startAt: specs[index].startAt,
    endAt: specs[index].endAt,
  }));
}

export async function cleanupTestSlots(): Promise<void> {
  const admin = testAdminClient();

  const ids = createdSlotIds.splice(0, createdSlotIds.length);
  for (const id of ids) {
    try {
      await admin.from("availability_slots").delete().eq("id", id);
    } catch {
      // Swallow individual failures so one dead id cannot abort the rest.
    }
  }
}
