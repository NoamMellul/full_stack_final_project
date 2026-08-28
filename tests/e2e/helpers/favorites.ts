import { testAdminClient } from "./supabase-admin";

// Fixture helper for Phase 6 favorites specs, mirroring
// tests/e2e/helpers/appointments.ts's module-level tracking array + splice-
// based cleanup idiom. Only a service-role client can insert on behalf of an
// arbitrary patient in a test setup step (the production write path is the
// patient's own session hitting POST /api/patient/favorites).
const createdFavoriteIds: string[] = [];

export async function createTestFavorite(opts: {
  patientId: string;
  doctorId: string;
}): Promise<{ id: string }> {
  const admin = testAdminClient();

  const { data, error } = await admin
    .from("favorites")
    .insert({ patient_id: opts.patientId, doctor_id: opts.doctorId })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create test favorite: ${error?.message}`);
  }

  createdFavoriteIds.push(data.id);
  return { id: data.id };
}

// Used to assert a POST/DELETE against the favorites API actually changed
// the stored row set for a given patient, independent of what the UI shows.
export async function readFavoriteIds(patientId: string): Promise<string[]> {
  const admin = testAdminClient();

  const { data, error } = await admin
    .from("favorites")
    .select("doctor_id")
    .eq("patient_id", patientId);

  if (error) {
    throw new Error(`Failed to read test favorites: ${error.message}`);
  }

  return (data ?? []).map((row) => row.doctor_id as string);
}

export async function cleanupTestFavorites(): Promise<void> {
  const admin = testAdminClient();

  const ids = createdFavoriteIds.splice(0, createdFavoriteIds.length);
  for (const id of ids) {
    try {
      await admin.from("favorites").delete().eq("id", id);
    } catch {
      // Swallow individual failures so one dead id cannot abort the rest.
    }
  }
}
