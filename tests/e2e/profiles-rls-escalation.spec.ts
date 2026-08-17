import { expect, test } from "@playwright/test";

import { testAnonClient } from "./helpers/supabase-anon";
import { cleanupTestUsers, createBareAuthUser } from "./helpers/test-users";

// T-EQS-01: `profiles_insert_own` (initial schema) never constrained `role`,
// so any authenticated user could self-insert `role: "admin"` and inherit
// every admin-only policy via public.is_admin(). Migration
// 20260817120000_harden_profiles_self_insert_role.sql narrows the policy's
// `with check` to `id = auth.uid() and role = 'patient'`.
//
// tests/e2e/auth-signup.spec.ts:59 already proves the *signup route*
// (app/api/auth/signup/route.ts) ignores a `role: "admin"` field in its
// request body — but that route always inserts through the service-role
// client, which bypasses RLS entirely. It never exercised the direct
// anon-key-Supabase-client bypass this spec closes: an attacker who never
// touches /api/auth/signup and instead calls supabase.auth.signUp() (or, as
// here, an authenticated session) then inserts into `profiles` directly.
// This is the first test of the database boundary itself.
test.describe("T-EQS-01: profiles RLS blocks self-inserted admin/doctor role", () => {
  test.afterAll(async () => {
    await cleanupTestUsers();
  });

  test("a bare authenticated user cannot self-insert role='admin'", async () => {
    const user = await createBareAuthUser("patient");
    const anon = testAnonClient();

    const { error: signInError } = await anon.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });
    expect(signInError).toBeNull();

    const { error } = await anon.from("profiles").insert({
      id: user.id,
      role: "admin",
      full_name: "Escalation Attempt",
      email: user.email,
    });

    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  test("a bare authenticated user cannot self-insert role='doctor'", async () => {
    const user = await createBareAuthUser("patient");
    const anon = testAnonClient();

    const { error: signInError } = await anon.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });
    expect(signInError).toBeNull();

    const { error } = await anon.from("profiles").insert({
      id: user.id,
      role: "doctor",
      full_name: "Escalation Attempt",
      email: user.email,
    });

    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });

  test("a bare authenticated user CAN self-insert role='patient'", async () => {
    const user = await createBareAuthUser("patient");
    const anon = testAnonClient();

    const { error: signInError } = await anon.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });
    expect(signInError).toBeNull();

    const { error } = await anon.from("profiles").insert({
      id: user.id,
      role: "patient",
      full_name: "Legitimate Self-Signup",
      email: user.email,
    });

    expect(error).toBeNull();
  });
});
