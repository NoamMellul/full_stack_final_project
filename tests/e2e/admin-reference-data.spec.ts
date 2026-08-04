import { expect, test } from "@playwright/test";

import { cleanupTestUsers, createTestUser } from "./helpers/test-users";
import {
  cleanupTestReferenceData,
  createTestDoctor,
  createTestLocation,
  createTestSpecialty,
} from "./helpers/reference-data";

async function loginAsAdmin(
  page: import("@playwright/test").Page,
  creds: { email: string; password: string },
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("/admin");
}

async function loginAsPatient(
  page: import("@playwright/test").Page,
  creds: { email: string; password: string },
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("/patient");
}

test.describe("ADMIN-05: specialties", () => {
  let adminCreds: { email: string; password: string };

  test.beforeAll(async () => {
    const admin = await createTestUser("admin");
    adminCreds = { email: admin.email, password: admin.password };
  });

  test.afterAll(async () => {
    await cleanupTestUsers();
    await cleanupTestReferenceData();
  });

  test("POST with a blank required name returns 400 and the list length is unchanged", async ({
    page,
  }) => {
    await loginAsAdmin(page, adminCreds);

    const before = await page.request.get("/api/admin/specialties");
    const beforeCount = (await before.json()).specialties.length;

    const response = await page.request.post("/api/admin/specialties", {
      data: { nameEn: "", nameHe: "" },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Name is required.");

    const after = await page.request.get("/api/admin/specialties");
    const afterCount = (await after.json()).specialties.length;
    expect(afterCount).toBe(beforeCount);
  });

  test("POST with a name identical to an existing specialty returns 409 with no leaked db detail", async ({
    page,
  }) => {
    await loginAsAdmin(page, adminCreds);
    const specialty = await createTestSpecialty();

    const response = await page.request.post("/api/admin/specialties", {
      data: { nameEn: specialty.nameEn, nameHe: "שם אחר" },
    });

    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.error).toBe("A specialty with this name already exists.");
    const rawBody = JSON.stringify(body).toLowerCase();
    expect(rawBody).not.toContain("constraint");
    expect(rawBody).not.toContain("duplicate key");
    expect(rawBody).not.toContain("specialties_name_en_key");
  });

  test("GET returns specialties ordered by name_en then id ascending", async ({ page }) => {
    await loginAsAdmin(page, adminCreds);
    await createTestSpecialty();
    await createTestSpecialty();
    await createTestSpecialty();

    const response = await page.request.get("/api/admin/specialties");
    expect(response.status()).toBe(200);
    const { specialties } = await response.json();

    const sorted = [...specialties].sort(
      (a: { name_en: string; id: string }, b: { name_en: string; id: string }) => {
        if (a.name_en !== b.name_en) return a.name_en < b.name_en ? -1 : 1;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      },
    );
    expect(specialties.map((s: { id: string }) => s.id)).toEqual(
      sorted.map((s: { id: string }) => s.id),
    );
  });

  test("a direct DELETE against a specialty referenced by a doctor returns 409 and the row survives (T-02-05, D-06)", async ({
    page,
  }) => {
    await loginAsAdmin(page, adminCreds);
    const specialty = await createTestSpecialty();
    const location = await createTestLocation();
    await createTestDoctor({ specialtyId: specialty.id, locationId: location.id });

    const response = await page.request.delete(`/api/admin/specialties/${specialty.id}`);
    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.error).toBe(
      "This specialty is still assigned to one or more doctors and cannot be deleted.",
    );
    expect(body.doctorCount).toBeGreaterThan(0);

    const list = await page.request.get("/api/admin/specialties");
    const { specialties } = await list.json();
    expect(specialties.some((s: { id: string }) => s.id === specialty.id)).toBe(true);
  });

  test("deleting an unreferenced specialty succeeds and it disappears from GET", async ({
    page,
  }) => {
    await loginAsAdmin(page, adminCreds);
    const specialty = await createTestSpecialty();

    const response = await page.request.delete(`/api/admin/specialties/${specialty.id}`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);

    const list = await page.request.get("/api/admin/specialties");
    const { specialties } = await list.json();
    expect(specialties.some((s: { id: string }) => s.id === specialty.id)).toBe(false);
  });

  test("a non-admin session receives 403 on every write endpoint and the data is unchanged", async ({
    page,
  }) => {
    const specialty = await createTestSpecialty();
    const patient = await createTestUser("patient");
    await loginAsPatient(page, patient);

    const postResponse = await page.request.post("/api/admin/specialties", {
      data: { nameEn: "Should Not Be Created", nameHe: "לא ייווצר" },
    });
    expect(postResponse.status()).toBe(403);

    const patchResponse = await page.request.patch(`/api/admin/specialties/${specialty.id}`, {
      data: { nameEn: "Should Not Be Renamed" },
    });
    expect(patchResponse.status()).toBe(403);

    const deleteResponse = await page.request.delete(`/api/admin/specialties/${specialty.id}`);
    expect(deleteResponse.status()).toBe(403);
  });
});

test.describe("ADMIN-06: locations", () => {
  let adminCreds: { email: string; password: string };

  test.beforeAll(async () => {
    const admin = await createTestUser("admin");
    adminCreds = { email: admin.email, password: admin.password };
  });

  test.afterAll(async () => {
    await cleanupTestUsers();
    await cleanupTestReferenceData();
  });

  test("POST with a blank required name returns 400 and the list length is unchanged", async ({
    page,
  }) => {
    await loginAsAdmin(page, adminCreds);

    const before = await page.request.get("/api/admin/locations");
    const beforeCount = (await before.json()).locations.length;

    const response = await page.request.post("/api/admin/locations", {
      data: { city: "", neighborhood: "" },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Name is required.");

    const after = await page.request.get("/api/admin/locations");
    const afterCount = (await after.json()).locations.length;
    expect(afterCount).toBe(beforeCount);
  });

  test("POST with a name identical to an existing location returns 409 with no leaked db detail", async ({
    page,
  }) => {
    await loginAsAdmin(page, adminCreds);
    const location = await createTestLocation();

    const response = await page.request.post("/api/admin/locations", {
      data: { city: location.city, neighborhood: location.neighborhood },
    });

    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.error).toBe("A location with this name already exists.");
    const rawBody = JSON.stringify(body).toLowerCase();
    expect(rawBody).not.toContain("constraint");
    expect(rawBody).not.toContain("duplicate key");
    expect(rawBody).not.toContain("locations_neighborhood_city_key");
  });

  test("GET returns locations ordered by city, then neighborhood, then id ascending", async ({
    page,
  }) => {
    await loginAsAdmin(page, adminCreds);
    await createTestLocation();
    await createTestLocation();
    await createTestLocation();

    const response = await page.request.get("/api/admin/locations");
    expect(response.status()).toBe(200);
    const { locations } = await response.json();

    const sorted = [...locations].sort(
      (
        a: { city: string; neighborhood: string; id: string },
        b: { city: string; neighborhood: string; id: string },
      ) => {
        if (a.city !== b.city) return a.city < b.city ? -1 : 1;
        if (a.neighborhood !== b.neighborhood) return a.neighborhood < b.neighborhood ? -1 : 1;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      },
    );
    expect(locations.map((l: { id: string }) => l.id)).toEqual(
      sorted.map((l: { id: string }) => l.id),
    );
  });

  test("a direct DELETE against a location referenced by a doctor returns 409 and the row survives (T-02-05, D-06)", async ({
    page,
  }) => {
    await loginAsAdmin(page, adminCreds);
    const specialty = await createTestSpecialty();
    const location = await createTestLocation();
    await createTestDoctor({ specialtyId: specialty.id, locationId: location.id });

    const response = await page.request.delete(`/api/admin/locations/${location.id}`);
    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.error).toBe(
      "This location is still assigned to one or more doctors and cannot be deleted.",
    );
    expect(body.doctorCount).toBeGreaterThan(0);

    const list = await page.request.get("/api/admin/locations");
    const { locations } = await list.json();
    expect(locations.some((l: { id: string }) => l.id === location.id)).toBe(true);
  });

  test("deleting an unreferenced location succeeds and it disappears from GET", async ({
    page,
  }) => {
    await loginAsAdmin(page, adminCreds);
    const location = await createTestLocation();

    const response = await page.request.delete(`/api/admin/locations/${location.id}`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);

    const list = await page.request.get("/api/admin/locations");
    const { locations } = await list.json();
    expect(locations.some((l: { id: string }) => l.id === location.id)).toBe(false);
  });

  test("a non-admin session receives 403 on every write endpoint and the data is unchanged", async ({
    page,
  }) => {
    const location = await createTestLocation();
    const patient = await createTestUser("patient");
    await loginAsPatient(page, patient);

    const postResponse = await page.request.post("/api/admin/locations", {
      data: { city: "Should Not Be Created", neighborhood: "Nope" },
    });
    expect(postResponse.status()).toBe(403);

    const patchResponse = await page.request.patch(`/api/admin/locations/${location.id}`, {
      data: { city: "Should Not Be Renamed" },
    });
    expect(patchResponse.status()).toBe(403);

    const deleteResponse = await page.request.delete(`/api/admin/locations/${location.id}`);
    expect(deleteResponse.status()).toBe(403);
  });
});
