import { expect, test } from "@playwright/test";

import { testAdminClient } from "./helpers/supabase-admin";
import { cleanupTestUsers, createTestUser } from "./helpers/test-users";
import {
  cleanupTestReferenceData,
  createTestDoctor,
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

test.describe("S44 admin: edit an existing doctor's phone", () => {
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

  test("adding a phone to a doctor with none saves it to the table row and the DB", async ({
    page,
  }) => {
    const doctor = await createTestDoctor({
      fullName: `S44 Edit Add Phone ${Date.now()}`,
      specialtyId: specialty.id,
      locationId: location.id,
    });

    await loginAsAdmin(page);
    await page.goto("/admin/doctors");

    const row = page.getByRole("row").filter({ hasText: doctor.fullName });
    await row.getByRole("button", { name: `Edit ${doctor.fullName}` }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Phone").fill("052-123-4567");
    await dialog.getByRole("button", { name: "Save changes" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(row.getByText("052-123-4567")).toBeVisible();

    const admin = testAdminClient();
    const { data } = await admin.from("doctors").select("phone").eq("id", doctor.id).single();
    expect(data?.phone).toBe("052-123-4567");
  });

  test("clearing an existing phone stores NULL, not an empty string", async ({ page }) => {
    const doctor = await createTestDoctor({
      fullName: `S44 Edit Clear Phone ${Date.now()}`,
      specialtyId: specialty.id,
      locationId: location.id,
    });
    // createTestDoctor has no phone option yet (added in Task 3) — set it
    // directly so this fixture starts from a known non-null state.
    await testAdminClient().from("doctors").update({ phone: "03-555-9999" }).eq("id", doctor.id);

    await loginAsAdmin(page);
    await page.goto("/admin/doctors");

    const row = page.getByRole("row").filter({ hasText: doctor.fullName });
    await row.getByRole("button", { name: `Edit ${doctor.fullName}` }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Phone")).toHaveValue("03-555-9999");
    await dialog.getByLabel("Phone").fill("");
    await dialog.getByRole("button", { name: "Save changes" }).click();

    await expect(dialog).toHaveCount(0);

    const admin = testAdminClient();
    const { data } = await admin.from("doctors").select("phone").eq("id", doctor.id).single();
    expect(data?.phone).toBeNull();
  });

  test("editing only the bio leaves the stored phone untouched (partial-update contract)", async ({
    page,
  }) => {
    const doctor = await createTestDoctor({
      fullName: `S44 Edit Bio Only ${Date.now()}`,
      specialtyId: specialty.id,
      locationId: location.id,
    });
    // createTestDoctor has no phone option yet (added in Task 3) — set it
    // directly so this fixture starts from a known non-null state.
    await testAdminClient().from("doctors").update({ phone: "03-111-2222" }).eq("id", doctor.id);

    await loginAsAdmin(page);
    await page.goto("/admin/doctors");

    const row = page.getByRole("row").filter({ hasText: doctor.fullName });
    await row.getByRole("button", { name: `Edit ${doctor.fullName}` }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Bio").fill("Updated bio only.");

    const response = page.waitForResponse(
      (res) => res.url().includes(`/api/admin/doctors/${doctor.id}`) && res.request().method() === "PATCH",
    );
    await dialog.getByRole("button", { name: "Save changes" }).click();
    const patchResponse = await response;
    const patchRequestBody = patchResponse.request().postDataJSON();
    expect(patchRequestBody).not.toHaveProperty("phone");

    await expect(dialog).toHaveCount(0);

    const admin = testAdminClient();
    const { data } = await admin.from("doctors").select("phone").eq("id", doctor.id).single();
    expect(data?.phone).toBe("03-111-2222");
  });
});

test.describe("S44 public: doctor profile phone display", () => {
  // Drives the DEFAULT anonymous context with no login helper — /doctors/[id]
  // is a public, unauthenticated surface (matches tests/e2e/doctor-profile.spec.ts).
  let specialty: { id: string; nameEn: string };
  let location: { id: string; city: string; neighborhood: string };
  let doctorWithPhone: { id: string; fullName: string };
  let doctorWithoutPhone: { id: string; fullName: string };

  test.beforeAll(async () => {
    specialty = await createTestSpecialty();
    location = await createTestLocation();

    doctorWithPhone = await createTestDoctor({
      fullName: `S44 Public Phone ${Date.now()}`,
      specialtyId: specialty.id,
      locationId: location.id,
      phone: "03-777-8888",
      isActive: true,
    });

    doctorWithoutPhone = await createTestDoctor({
      fullName: `S44 Public No Phone ${Date.now()}`,
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });
  });

  test.afterAll(async () => {
    await cleanupTestReferenceData();
  });

  test("an active doctor with a phone shows the phone label and the number", async ({ page }) => {
    await page.goto(`/doctors/${doctorWithPhone.id}`);

    await expect(page.getByText("Phone:")).toBeVisible();
    await expect(page.locator("main").getByText("03-777-8888")).toBeVisible();
  });

  test("an active doctor with no phone renders no phone label at all", async ({ page }) => {
    await page.goto(`/doctors/${doctorWithoutPhone.id}`);

    await expect(page.getByText("Phone:")).toHaveCount(0);
  });

  test("the rendered phone is plain text — no link role, no anchor wraps it", async ({ page }) => {
    await page.goto(`/doctors/${doctorWithPhone.id}`);

    const phoneText = page.locator("main").getByText("03-777-8888");
    await expect(phoneText).toBeVisible();
    const wrappingAnchors = page.locator("main a").filter({ hasText: "03-777-8888" });
    await expect(wrappingAnchors).toHaveCount(0);
  });

  test("switching to Hebrew shows the Hebrew phone label with the number still reading left-to-right", async ({
    page,
  }) => {
    await page.goto(`/doctors/${doctorWithPhone.id}`);
    await expect(page.getByText("Phone:")).toBeVisible();

    await page.getByRole("button", { name: "עברית" }).click();

    await expect(page.getByText("טלפון:")).toBeVisible();
    const phoneNode = page.locator("main").getByText("03-777-8888");
    await expect(phoneNode).toBeVisible();
    await expect(phoneNode).toHaveAttribute("dir", "ltr");
  });
});
