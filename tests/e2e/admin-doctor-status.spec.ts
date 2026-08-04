import { expect, test } from "@playwright/test";

import { testAdminClient } from "./helpers/supabase-admin";
import { testAnonClient } from "./helpers/supabase-anon";
import { cleanupTestUsers, createTestUser } from "./helpers/test-users";
import {
  cleanupTestReferenceData,
  createTestDoctor,
  createTestLocation,
  createTestSpecialty,
} from "./helpers/reference-data";

test.describe("ADMIN-03: activate and deactivate a doctor", () => {
  let adminCreds: { email: string; password: string };
  let specialty: { id: string; nameEn: string };
  let location: { id: string; city: string; neighborhood: string };
  let doctor: { id: string; fullName: string };

  test.beforeAll(async () => {
    const admin = await createTestUser("admin");
    adminCreds = { email: admin.email, password: admin.password };
    specialty = await createTestSpecialty();
    location = await createTestLocation();
    doctor = await createTestDoctor({
      fullName: `RLS Status Doctor ${Date.now()}`,
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: false,
    });
  });

  test.afterAll(async () => {
    await cleanupTestUsers();
    await cleanupTestReferenceData();
  });

  async function loginAsAdmin(page: import("@playwright/test").Page) {
    await page.goto("/login");
    await page.getByLabel("Email").fill(adminCreds.email);
    await page.getByLabel("Password").fill(adminCreds.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("/admin");
  }

  test("1. a freshly created inactive doctor is absent from an anonymous read", async () => {
    const anon = testAnonClient();
    const { data, error } = await anon.from("doctors").select("id").eq("id", doctor.id);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  test("2. the admin activates the doctor from the list and the confirmation copy becomes visible", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/doctors");

    const row = page.getByRole("row").filter({ hasText: doctor.fullName });
    await row.getByRole("switch").click();

    await expect(
      page.getByText(`${doctor.fullName} activated — visible in public search.`),
    ).toBeVisible();
    await expect(row.getByRole("switch")).toBeEnabled();
  });

  test("3. after activation, the anonymous read now returns the row", async () => {
    const anon = testAnonClient();
    const { data, error } = await anon.from("doctors").select("id").eq("id", doctor.id);

    expect(error).toBeNull();
    expect(data?.length).toBe(1);
  });

  test("4. flipping the switch back off hides the row from the anonymous read and shows the hidden copy", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/doctors");

    const row = page.getByRole("row").filter({ hasText: doctor.fullName });
    await row.getByRole("switch").click();

    await expect(
      page.getByText(`${doctor.fullName} deactivated — hidden from public search.`),
    ).toBeVisible();
    await expect(row.getByRole("switch")).toBeEnabled();

    const anon = testAnonClient();
    const { data, error } = await anon.from("doctors").select("id").eq("id", doctor.id);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  test("5. a patient session calling the status endpoint receives 403 and is_active is unchanged", async ({
    page,
  }) => {
    const patient = await createTestUser("patient");
    await page.goto("/login");
    await page.getByLabel("Email").fill(patient.email);
    await page.getByLabel("Password").fill(patient.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("/patient");

    const response = await page.request.patch(`/api/admin/doctors/${doctor.id}/status`, {
      data: { isActive: true },
    });
    expect(response.status()).toBe(403);

    const admin = testAdminClient();
    const { data } = await admin.from("doctors").select("is_active").eq("id", doctor.id).single();
    expect(data?.is_active).toBe(false);
  });
});
