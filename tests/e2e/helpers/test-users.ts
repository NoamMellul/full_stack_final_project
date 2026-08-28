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

// Auth user with NO profiles row. createTestUser() always inserts one, which
// would make a later self-escalation insert fail on the primary-key conflict
// (23505) instead of the RLS policy (42501) — a false pass that proves
// nothing. Used by tests/e2e/profiles-rls-escalation.spec.ts.
export async function createBareAuthUser(
  role: "patient" | "doctor" | "admin",
): Promise<{ id: string; email: string; password: string }> {
  const admin = testAdminClient();
  const email = uniqueTestEmail(role);

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`Failed to create bare test ${role} user: ${error?.message}`);
  }

  createdUserIds.push(data.user.id);

  return { id: data.user.id, email, password: TEST_PASSWORD };
}

// Generates a real one-time Supabase recovery link, routed exclusively
// through testAdminClient() (never a direct SUPABASE_SERVICE_ROLE_KEY read,
// per the helper convention locked by plan 06-01).
//
// Deliberately returns a link to this app's own app/auth/confirm route
// (built from the raw hashed_token) rather than generateLink()'s
// `action_link` (Supabase's hosted /auth/v1/verify redirect). The hosted
// verify endpoint issues an implicit `#access_token=` hash for any token
// with no associated PKCE code challenge — which an admin-generated link
// always is — and @supabase/ssr's browser client hardcodes flowType:
// "pkce" (lib/supabase/client.ts, verified), which actively REJECTS that
// hash shape. Routing through /auth/confirm's verifyOtp(token_hash) call
// sidesteps that mismatch entirely and mirrors the same
// {{ .TokenHash }}-based link shape Supabase recommends a PKCE app's own
// email template use for its real emailed links (see 260823-euo-SUMMARY.md
// human action item — the Dashboard "Reset Password" template must be
// updated to match, or a real user's emailed link will hit the same
// mismatch this discovered).
export async function generateRecoveryLink(email: string, redirectTo: string): Promise<string> {
  const admin = testAdminClient();

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });

  if (error || !data.properties?.hashed_token) {
    throw new Error(`Failed to generate recovery link for ${email}: ${error?.message}`);
  }

  const origin = new URL(redirectTo).origin;
  return `${origin}/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery`;
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
