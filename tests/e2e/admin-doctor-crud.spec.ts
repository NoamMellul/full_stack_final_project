import { expect, test } from "@playwright/test";

import { testAdminClient } from "./helpers/supabase-admin";
import { cleanupTestUsers, createTestUser } from "./helpers/test-users";
import {
  cleanupTestReferenceData,
  createTestDoctor,
  createTestLocation,
  createTestSpecialty,
} from "./helpers/reference-data";

test.describe("ADMIN-01: admin creates a doctor", () => {
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

  test("admin fills the create form and the new doctor appears in the list without a reload", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/doctors");

    const doctorName = `UI Created Doctor ${Date.now()}`;
    await page.getByLabel("Full name").fill(doctorName);
    await page.getByLabel("Specialty").click();
    await page.getByRole("option", { name: specialty.nameEn }).click();
    await page.getByLabel("Location").click();
    await page
      .getByRole("option", { name: `${location.neighborhood}, ${location.city}` })
      .click();
    await page.getByLabel("Bio").fill("A demo doctor bio.");
    await page.getByLabel("Photo URL").fill("https://example.com/photo.jpg");

    await page.getByRole("button", { name: "Save doctor" }).click();

    await expect(page.getByText(doctorName)).toBeVisible();
  });

  test("submitting an empty form surfaces the required-field error without a network call", async ({
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

    await page.getByRole("button", { name: "Save doctor" }).click();

    await expect(page.getByText("Full name is required.")).toBeVisible();
    expect(requestMade).toBe(false);
  });

  test("privileged fields in the request body are ignored server-side (T-02-01)", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    const response = await page.request.post("/api/admin/doctors", {
      data: {
        fullName: `Privilege Test Doctor ${Date.now()}`,
        specialtyId: specialty.id,
        locationId: location.id,
        is_active: true,
        is_demo: false,
        profile_id: "00000000-0000-0000-0000-000000000000",
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.doctor.is_active).toBe(false);
    expect(body.doctor.is_demo).toBe(true);
    expect(body.doctor.profile_id).toBeNull();
  });

  test("a blank fullName is rejected with 400 and no doctor row is created", async ({ page }) => {
    await loginAsAdmin(page);

    const before = await page.request.get("/api/admin/doctors");
    const beforeCount = (await before.json()).doctors.length;

    const response = await page.request.post("/api/admin/doctors", {
      data: { fullName: "", specialtyId: specialty.id, locationId: location.id },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Full name is required.");

    const after = await page.request.get("/api/admin/doctors");
    const afterCount = (await after.json()).doctors.length;
    expect(afterCount).toBe(beforeCount);
  });

  test("creating two doctors with identical name/specialty/location yields two distinct rows", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    const duplicateName = `Duplicate Doctor ${Date.now()}`;
    const first = await page.request.post("/api/admin/doctors", {
      data: { fullName: duplicateName, specialtyId: specialty.id, locationId: location.id },
    });
    const second = await page.request.post("/api/admin/doctors", {
      data: { fullName: duplicateName, specialtyId: specialty.id, locationId: location.id },
    });

    expect(first.status()).toBe(201);
    expect(second.status()).toBe(201);

    const firstBody = await first.json();
    const secondBody = await second.json();
    expect(firstBody.doctor.id).not.toBe(secondBody.doctor.id);

    const listResponse = await page.request.get("/api/admin/doctors");
    const { doctors } = await listResponse.json();
    const matches = doctors.filter((doctor: { full_name: string }) => doctor.full_name === duplicateName);
    expect(matches.length).toBe(2);
  });

  test("a non-admin session receives 403 before any database write", async ({ page }) => {
    const patient = await createTestUser("patient");

    await page.goto("/login");
    await page.getByLabel("Email").fill(patient.email);
    await page.getByLabel("Password").fill(patient.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("/patient");

    const before = await page.request.get("/api/admin/doctors");
    expect(before.status()).toBe(403);

    const response = await page.request.post("/api/admin/doctors", {
      data: { fullName: "Should Not Be Created", specialtyId: specialty.id, locationId: location.id },
    });
    expect(response.status()).toBe(403);
  });

  test("an unauthenticated request receives 401 before any database write", async ({ page }) => {
    const response = await page.request.post("/api/admin/doctors", {
      data: { fullName: "Should Not Be Created", specialtyId: specialty.id, locationId: location.id },
    });
    expect(response.status()).toBe(401);
  });
});

test.describe("ADMIN-02: admin edits a doctor", () => {
  let adminCreds: { email: string; password: string };
  let specialty: { id: string; nameEn: string };
  let secondSpecialty: { id: string; nameEn: string };
  let location: { id: string; city: string; neighborhood: string };

  test.beforeAll(async () => {
    const admin = await createTestUser("admin");
    adminCreds = { email: admin.email, password: admin.password };
    specialty = await createTestSpecialty();
    secondSpecialty = await createTestSpecialty();
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

  test("editing full name and specialty returns 200 and the re-read row carries the new values", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    const doctor = await createTestDoctor({
      specialtyId: specialty.id,
      locationId: location.id,
    });

    const newName = `Edited Doctor ${Date.now()}`;
    const response = await page.request.patch(`/api/admin/doctors/${doctor.id}`, {
      data: { fullName: newName, specialtyId: secondSpecialty.id },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.doctor.full_name).toBe(newName);
    expect(body.doctor.specialty.id).toBe(secondSpecialty.id);

    const reread = await page.request.get("/api/admin/doctors");
    const { doctors } = await reread.json();
    const found = doctors.find((row: { id: string }) => row.id === doctor.id);
    expect(found.full_name).toBe(newName);
    expect(found.specialty.id).toBe(secondSpecialty.id);
  });

  test("the same PATCH body sent twice leaves the row and the doctor_languages count identical", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    const doctor = await createTestDoctor({
      specialtyId: specialty.id,
      locationId: location.id,
    });

    const admin = testAdminClient();
    const { data: languageRows } = await admin.from("languages").select("id").limit(2);
    const languageIds = (languageRows ?? []).map((row: { id: string }) => row.id);

    const patchBody = {
      fullName: "Idempotent Doctor",
      specialtyId: specialty.id,
      languageIds,
    };

    const first = await page.request.patch(`/api/admin/doctors/${doctor.id}`, {
      data: patchBody,
    });
    expect(first.status()).toBe(200);

    const { count: firstCount } = await admin
      .from("doctor_languages")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", doctor.id);

    const second = await page.request.patch(`/api/admin/doctors/${doctor.id}`, {
      data: patchBody,
    });
    expect(second.status()).toBe(200);

    const { count: secondCount } = await admin
      .from("doctor_languages")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", doctor.id);

    expect(secondCount).toBe(firstCount);
    expect(secondCount).toBe(languageIds.length);
  });

  test("a PATCH body carrying is_active, is_demo and profile_id leaves all three columns untouched (T-02-01)", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    const doctor = await createTestDoctor({
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: false,
    });

    const response = await page.request.patch(`/api/admin/doctors/${doctor.id}`, {
      data: {
        fullName: "Privilege Edit Test Doctor",
        is_active: true,
        is_demo: false,
        profile_id: "00000000-0000-0000-0000-000000000000",
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.doctor.is_active).toBe(false);
    expect(body.doctor.is_demo).toBe(true);
    expect(body.doctor.profile_id).toBeNull();
  });

  test("PATCH against a random UUID returns 404", async ({ page }) => {
    await loginAsAdmin(page);

    const response = await page.request.patch(
      "/api/admin/doctors/00000000-0000-0000-0000-000000000000",
      { data: { fullName: "Ghost Doctor" } },
    );

    expect(response.status()).toBe(404);
  });

  test("a non-admin session receives 403 before any database write", async ({ page }) => {
    const doctor = await createTestDoctor({
      specialtyId: specialty.id,
      locationId: location.id,
    });

    const patient = await createTestUser("patient");
    await page.goto("/login");
    await page.getByLabel("Email").fill(patient.email);
    await page.getByLabel("Password").fill(patient.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("/patient");

    const response = await page.request.patch(`/api/admin/doctors/${doctor.id}`, {
      data: { fullName: "Should Not Be Edited" },
    });
    expect(response.status()).toBe(403);
  });
});

test.describe("ADMIN-01: doctors list states", () => {
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

  test("zero doctors renders the empty-state heading and body copy", async ({ page }) => {
    await loginAsAdmin(page);

    // Playwright glob matches the FULL url including its query string, and a
    // `?` is a single-character wildcard in Playwright's glob dialect — so a
    // plain "**/api/admin/doctors" string stops matching once the client
    // requests ?page=N. Use a regex anchored on the path segment (with or
    // without a query string) instead, so it still matches the base list
    // endpoint but never swallows /api/admin/doctors/[id] sub-routes.
    await page.route(/\/api\/admin\/doctors(\?.*)?$/, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, json: { doctors: [] } });
        return;
      }
      await route.continue();
    });

    await page.goto("/admin/doctors");

    await expect(page.getByText("No doctors yet")).toBeVisible();
    await expect(
      page.getByText(
        "Add your first doctor profile, or run the demo data seed script, to start populating the platform catalog.",
      ),
    ).toBeVisible();
  });

  test("a doctor with no profile_id renders a neutral 'Not linked' badge", async ({ page }) => {
    const doctor = await createTestDoctor({
      fullName: `Not Linked Doctor ${Date.now()}`,
      specialtyId: specialty.id,
      locationId: location.id,
    });

    await loginAsAdmin(page);
    await page.goto("/admin/doctors");

    const row = page.getByRole("row").filter({ hasText: doctor.fullName });
    await expect(row.getByText("Not linked", { exact: true })).toBeVisible();
  });

  test("a doctor with no photo URL renders the initials avatar instead of an image", async ({
    page,
  }) => {
    const doctor = await createTestDoctor({
      fullName: `Avatar Doctor ${Date.now()}`,
      specialtyId: specialty.id,
      locationId: location.id,
    });

    await loginAsAdmin(page);
    await page.goto("/admin/doctors");

    const row = page.getByRole("row").filter({ hasText: doctor.fullName });
    await expect(row.locator("img")).toHaveCount(0);
    await expect(row.locator("[aria-hidden='true']").first()).toBeVisible();
  });

  test("with exactly one doctor, the count caption reads '1 doctor'", async ({ page }) => {
    await loginAsAdmin(page);

    // Playwright glob matches the FULL url including its query string, and a
    // `?` is a single-character wildcard in Playwright's glob dialect — so a
    // plain "**/api/admin/doctors" string stops matching once the client
    // requests ?page=N. Use a regex anchored on the path segment (with or
    // without a query string) instead, so it still matches the base list
    // endpoint but never swallows /api/admin/doctors/[id] sub-routes.
    await page.route(/\/api\/admin\/doctors(\?.*)?$/, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            doctors: [
              {
                id: "11111111-1111-1111-1111-111111111111",
                full_name: "Solo Doctor",
                bio: null,
                photo_url: null,
                is_active: false,
                is_demo: true,
                profile_id: null,
                created_at: new Date().toISOString(),
                specialty: { id: specialty.id, name_en: specialty.nameEn, name_he: specialty.nameEn },
                location: { id: location.id, city: location.city, neighborhood: location.neighborhood },
                languages: [],
              },
            ],
          },
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/admin/doctors");

    await expect(page.getByText("1 doctor", { exact: true })).toBeVisible();
  });
});
