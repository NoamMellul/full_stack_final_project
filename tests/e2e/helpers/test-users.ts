import { randomUUID } from "node:crypto";

import { testAdminClient } from "./supabase-admin";

export const TEST_PASSWORD = "TestPassw0rd!";

const createdUserIds: string[] = [];

export function uniqueTestEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}@example.com`;
}

export async function createTestUser(
  role: "patient" | "doctor" | "admin",
  opts?: { fullName?: string },
): Promise<{ id: string; email: string; password: string }> {
  const admin = testAdminClient();
  const email = uniqueTestEmail(role);

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`Failed to create test ${role} user: ${error?.message}`);
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    role,
    full_name: opts?.fullName ?? `Test ${role}`,
    email,
  });

  if (profileError) {
    throw new Error(`Failed to create profile for test ${role} user: ${profileError.message}`);
  }

  createdUserIds.push(data.user.id);

  return { id: data.user.id, email, password: TEST_PASSWORD };
}

export async function deleteTestUserByEmail(email: string): Promise<void> {
  const admin = testAdminClient();

  const { data: profile, error: lookupError } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (lookupError || !profile) {
    return;
  }

  await admin.auth.admin.deleteUser(profile.id);
}

// Admin-created doctor accounts (via /api/admin/doctors/[id]/link-account)
// are born inside the route under test, not through createTestUser, so
// their ids are never in `createdUserIds`. Track them by email instead and
// resolve to a profile id at cleanup time, on the same
// swallow-individual-failures behaviour as cleanupTestUsers.
const trackedAccountEmails: string[] = [];

export function trackLinkedAccountEmail(email: string): void {
  trackedAccountEmails.push(email);
}

export async function cleanupTrackedAccountEmails(): Promise<void> {
  const emails = trackedAccountEmails.splice(0, trackedAccountEmails.length);

  for (const email of emails) {
    try {
      await deleteTestUserByEmail(email);
    } catch {
      // Swallow individual failures so one dead email cannot abort the rest.
    }
  }
}

export async function cleanupTestUsers(): Promise<void> {
  const admin = testAdminClient();
  const ids = createdUserIds.splice(0, createdUserIds.length);

  for (const id of ids) {
    try {
      await admin.auth.admin.deleteUser(id);
    } catch {
      // Swallow individual failures so one dead id cannot abort the rest.
    }
  }
}
