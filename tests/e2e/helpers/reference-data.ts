import { randomUUID } from "node:crypto";

import { testAdminClient } from "./supabase-admin";

const createdSpecialtyIds: string[] = [];
const createdLocationIds: string[] = [];
const createdDoctorIds: string[] = [];

export async function createTestSpecialty(opts?: {
  nameEn?: string;
  nameHe?: string;
}): Promise<{ id: string; nameEn: string; nameHe: string }> {
  const admin = testAdminClient();
  const suffix = randomUUID().slice(0, 8);
  const nameEn = opts?.nameEn ?? `Test Specialty ${suffix}`;
  const nameHe = opts?.nameHe ?? `התמחות בדיקה ${suffix}`;

  const { data, error } = await admin
    .from("specialties")
    .insert({ name_en: nameEn, name_he: nameHe })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create test specialty: ${error?.message}`);
  }

  createdSpecialtyIds.push(data.id);
  return { id: data.id, nameEn, nameHe };
}

export async function createTestLocation(opts?: {
  city?: string;
  neighborhood?: string;
  address?: string;
}): Promise<{ id: string; city: string; neighborhood: string; address: string | null }> {
  const admin = testAdminClient();
  const suffix = randomUUID().slice(0, 8);
  const city = opts?.city ?? "Tel Aviv";
  const neighborhood = opts?.neighborhood ?? `Test Neighborhood ${suffix}`;
  const address = opts?.address ?? null;

  const { data, error } = await admin
    .from("locations")
    .insert({ city, neighborhood, address })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create test location: ${error?.message}`);
  }

  createdLocationIds.push(data.id);
  return { id: data.id, city, neighborhood, address };
}

export async function createTestDoctor(opts: {
  fullName?: string;
  specialtyId: string;
  locationId: string;
  bio?: string;
  photoUrl?: string;
  phone?: string;
  isActive?: boolean;
  profileId?: string;
}): Promise<{ id: string; fullName: string }> {
  const admin = testAdminClient();
  const fullName = opts.fullName ?? `Test Doctor ${randomUUID().slice(0, 8)}`;

  const { data, error } = await admin
    .from("doctors")
    .insert({
      full_name: fullName,
      specialty_id: opts.specialtyId,
      location_id: opts.locationId,
      bio: opts.bio ?? null,
      photo_url: opts.photoUrl ?? null,
      phone: opts.phone ?? null,
      is_active: opts.isActive ?? false,
      profile_id: opts.profileId ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create test doctor: ${error?.message}`);
  }

  createdDoctorIds.push(data.id);
  return { id: data.id, fullName };
}

// Doctors born inside the flow under test (created via the UI rather than
// through createTestDoctor) are never in `createdDoctorIds` and would
// survive cleanup as residue. Mirrors trackDoctorRequestId (helpers/
// doctor-requests.ts) and trackLinkedAccountEmail (helpers/test-users.ts),
// which exist for exactly this case.
export function trackDoctorId(id: string): void {
  createdDoctorIds.push(id);
}

export async function cleanupTestReferenceData(): Promise<void> {
  const admin = testAdminClient();

  const doctorIds = createdDoctorIds.splice(0, createdDoctorIds.length);
  for (const id of doctorIds) {
    try {
      await admin.from("doctors").delete().eq("id", id);
    } catch {
      // Swallow individual failures so one dead id cannot abort the rest.
    }
  }

  const locationIds = createdLocationIds.splice(0, createdLocationIds.length);
  for (const id of locationIds) {
    try {
      await admin.from("locations").delete().eq("id", id);
    } catch {
      // Swallow individual failures so one dead id cannot abort the rest.
    }
  }

  const specialtyIds = createdSpecialtyIds.splice(0, createdSpecialtyIds.length);
  for (const id of specialtyIds) {
    try {
      await admin.from("specialties").delete().eq("id", id);
    } catch {
      // Swallow individual failures so one dead id cannot abort the rest.
    }
  }
}
