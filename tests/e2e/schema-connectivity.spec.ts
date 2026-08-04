import { test, expect } from "@playwright/test";

import { testAdminClient } from "./helpers/supabase-admin";

const APPLICATION_TABLES = [
  "profiles",
  "specialties",
  "languages",
  "locations",
  "doctors",
  "doctor_languages",
  "availability_slots",
  "appointments",
  "favorites",
  "notifications",
] as const;

test("all ten application tables are reachable", async () => {
  const admin = testAdminClient();

  for (const table of APPLICATION_TABLES) {
    const { error } = await admin.from(table).select("*").limit(1);
    expect(error, `table "${table}" should be reachable: ${error?.message}`).toBeNull();
  }
});

test("RLS helper functions are callable", async () => {
  const admin = testAdminClient();

  const isAdminResult = await admin.rpc("is_admin");
  expect(isAdminResult.error, `is_admin() should be callable: ${isAdminResult.error?.message}`).toBeNull();
  expect(typeof isAdminResult.data).toBe("boolean");

  const isDoctorOwnerResult = await admin.rpc("is_doctor_owner", {
    target_doctor_id: "00000000-0000-0000-0000-000000000000",
  });
  expect(
    isDoctorOwnerResult.error,
    `is_doctor_owner() should be callable: ${isDoctorOwnerResult.error?.message}`,
  ).toBeNull();
  expect(isDoctorOwnerResult.data).toBe(false);
});

test("availability_slots rejects an invalid time range", async () => {
  const admin = testAdminClient();

  const startAt = new Date();
  const endAt = new Date(startAt.getTime() - 60 * 60 * 1000); // one hour BEFORE start_at

  const { error } = await admin.from("availability_slots").insert({
    doctor_id: "00000000-0000-0000-0000-000000000000",
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
    status: "available",
  });

  expect(error, "an insert with end_at before start_at must be rejected").not.toBeNull();
});

test("the dev server responds on /", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBeLessThan(400);
});
