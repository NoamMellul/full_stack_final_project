import { testAdminClient } from "./supabase-admin";

// Mirrors tests/e2e/helpers/reference-data.ts's shape exactly: a
// module-scope tracking array, privileged access routed exclusively through
// testAdminClient() (never a direct SUPABASE_SERVICE_ROLE_KEY read), and a
// splice-based cleanup that swallows individual failures.

const createdDoctorRequestIds: string[] = [];

export type DoctorRequestRow = {
  id: string;
  full_name: string;
  email: string;
  specialty_id: string | null;
  message: string | null;
  status: string;
  created_at: string;
};

export async function createTestDoctorRequest(opts: {
  fullName?: string;
  email: string;
  specialtyId?: string | null;
  message?: string | null;
  status?: "pending" | "reviewed";
}): Promise<DoctorRequestRow> {
  const admin = testAdminClient();
  const fullName = opts.fullName ?? `Test Doctor Request ${Date.now()}`;

  const { data, error } = await admin
    .from("doctor_requests")
    .insert({
      full_name: fullName,
      email: opts.email,
      specialty_id: opts.specialtyId ?? null,
      message: opts.message ?? null,
      ...(opts.status ? { status: opts.status } : {}),
    })
    .select("id, full_name, email, specialty_id, message, status, created_at")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create test doctor request: ${error?.message}`);
  }

  createdDoctorRequestIds.push(data.id);
  return data as DoctorRequestRow;
}

export async function readDoctorRequestByEmail(email: string): Promise<DoctorRequestRow | null> {
  const admin = testAdminClient();
  const { data, error } = await admin
    .from("doctor_requests")
    .select("id, full_name, email, specialty_id, message, status, created_at")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read test doctor request: ${error.message}`);
  }

  return (data as DoctorRequestRow | null) ?? null;
}

export async function readDoctorRequestById(id: string): Promise<DoctorRequestRow | null> {
  const admin = testAdminClient();
  const { data, error } = await admin
    .from("doctor_requests")
    .select("id, full_name, email, specialty_id, message, status, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read test doctor request: ${error.message}`);
  }

  return (data as DoctorRequestRow | null) ?? null;
}

export function trackDoctorRequestId(id: string): void {
  createdDoctorRequestIds.push(id);
}

export async function cleanupTestDoctorRequests(): Promise<void> {
  const admin = testAdminClient();
  const ids = createdDoctorRequestIds.splice(0, createdDoctorRequestIds.length);

  for (const id of ids) {
    try {
      await admin.from("doctor_requests").delete().eq("id", id);
    } catch {
      // Swallow individual failures so one dead id cannot abort the rest.
    }
  }
}
