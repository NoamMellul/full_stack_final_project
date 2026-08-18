import { expect, test } from "@playwright/test";

import { testAdminClient } from "./helpers/supabase-admin";
import { cleanupTestUsers, createTestUser } from "./helpers/test-users";
import {
  cleanupTestReferenceData,
  createTestLocation,
  createTestSpecialty,
  trackDoctorId,
} from "./helpers/reference-data";

test.describe("S44 admin: create doctor with and without a phone", () => {
  let adminCreds: { email: string; password: string };
  let specialty: { id: string; nameEn: string };
  let location: { id: string; city: string; neighborhood: string };

  test.beforeAll(async () => {
    const admin = await createTestUser("admin");
    adminCreds = { email: admin.email, password: admin.password };
    specialty = await createTestSpecialty();
    location = await createTestLocation();
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

  test("admin fills the create form including a phone and the new row shows it", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/doctors");

    const doctorName = `S44 With Phone ${Date.now()}`;
    await page.getByLabel("Full name").fill(doctorName);
    await page.getByLabel("Specialty").click();
    await page.getByRole("option", { name: specialty.nameEn }).click();
    await page.getByLabel("Location").click();
    await page
      .getByRole("option", { name: `${location.neighborhood}, ${location.city}` })
      .click();
    await page.getByLabel("Phone").fill("03-555-1234");

    await page.getByRole("button", { name: "Save doctor" }).click();

    const row = page.getByRole("row").filter({ hasText: doctorName });
    await expect(row.getByText("03-555-1234")).toBeVisible();

    const admin = testAdminClient();
    const { data } = await admin
      .from("doctors")
      .select("id, phone")
      .eq("full_name", doctorName)
      .single();
    expect(data?.phone).toBe("03-555-1234");
    if (data?.id) trackDoctorId(data.id);
  });

  test("admin fills the create form and leaves phone empty — doctor is created exactly as before", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/doctors");

    const doctorName = `S44 No Phone ${Date.now()}`;
    await page.getByLabel("Full name").fill(doctorName);
    await page.getByLabel("Specialty").click();
    await page.getByRole("option", { name: specialty.nameEn }).click();
    await page.getByLabel("Location").click();
    await page
      .getByRole("option", { name: `${location.neighborhood}, ${location.city}` })
      .click();

    await page.getByRole("button", { name: "Save doctor" }).click();

    await expect(page.getByText(doctorName)).toBeVisible();

    const admin = testAdminClient();
    const { data } = await admin
      .from("doctors")
      .select("id, phone")
      .eq("full_name", doctorName)
      .single();
    expect(data?.phone).toBeNull();
    if (data?.id) trackDoctorId(data.id);
  });

  test("a 21+ character phone shows an inline field error and fires no POST request", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/doctors");

    let requestMade = false;
    page.on("request", (request) => {
      if (request.url().includes("/api/admin/doctors") && request.method() === "POST") {
        requestMade = true;
      }
    });

    const doctorName = `S44 Overlong Phone ${Date.now()}`;
    await page.getByLabel("Full name").fill(doctorName);
    await page.getByLabel("Specialty").click();
    await page.getByRole("option", { name: specialty.nameEn }).click();
    await page.getByLabel("Location").click();
    await page
      .getByRole("option", { name: `${location.neighborhood}, ${location.city}` })
      .click();
    await page.getByLabel("Phone").fill("1".repeat(21));

    await page.getByRole("button", { name: "Save doctor" }).click();

    await expect(
      page.getByText("Phone number must be 20 characters or fewer."),
    ).toBeVisible();
    expect(requestMade).toBe(false);
  });

  test("a POST that bypasses the form with an over-length phone returns 400 and creates no row", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    const doctorName = `S44 Server Reject Phone ${Date.now()}`;
    const response = await page.request.post("/api/admin/doctors", {
      data: {
        fullName: doctorName,
        specialtyId: specialty.id,
        locationId: location.id,
        phone: "1".repeat(21),
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Phone number must be 20 characters or fewer.");

    const admin = testAdminClient();
    const { data } = await admin.from("doctors").select("id").eq("full_name", doctorName);
    expect(data ?? []).toHaveLength(0);
  });
});
