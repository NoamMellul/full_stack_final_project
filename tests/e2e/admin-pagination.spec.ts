import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import {
  cleanupTestReferenceData,
  createTestLocation,
  createTestSpecialty,
} from "./helpers/reference-data";
import { testAdminClient } from "./helpers/supabase-admin";
import { cleanupTestUsers, createTestUser } from "./helpers/test-users";

// Proves D-LAR-01 through D-LAR-05: page-only param contract, server-side
// page size, an unparameterized GET still returns everything (and the
// /admin/appointments doctor filter still lists the whole catalog), and both
// admin tables render at most ADMIN_PAGE_SIZE (25) rows with working
// controls.

const ADMIN_PAGE_SIZE = 25;
const FIXTURE_DOCTOR_COUNT = 26; // one more than a full page

type Credentials = { email: string; password: string };

async function loginAs(page: Page, creds: Credentials, expectedHomeRoute: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(expectedHomeRoute);
}

test.describe("LAR: admin list pagination", () => {
  test.setTimeout(120000);

  let adminCreds: Credentials;
  let patientCreds: Credentials;
  let specialty: { id: string; nameEn: string };
  let location: { id: string; city: string; neighborhood: string };

  // Bulk-inserted fixture (26 doctors) — tracked and deleted by this spec
  // itself, mirroring search-sort-pagination.spec.ts's idiom, so this file's
  // page-disjoint and UI-pagination assertions are deterministic regardless
  // of how many rows the shared dev database already holds.
  let fixtureDoctorIds: string[] = [];
  const runToken = `LarFixture${randomUUID().slice(0, 8)}`;

  test.beforeAll(async () => {
    const admin = await createTestUser("admin");
    adminCreds = { email: admin.email, password: admin.password };
    const patient = await createTestUser("patient");
    patientCreds = { email: patient.email, password: patient.password };

    specialty = await createTestSpecialty();
    location = await createTestLocation();

    const adminClient = testAdminClient();
    const doctorRows = Array.from({ length: FIXTURE_DOCTOR_COUNT }, (_, index) => ({
      full_name: `Dr. ${runToken} ${String(index + 1).padStart(2, "0")}`,
      specialty_id: specialty.id,
      location_id: location.id,
      is_active: true,
    }));

    const { data, error } = await adminClient.from("doctors").insert(doctorRows).select("id");
    if (error || !data) {
      throw new Error(`Failed to bulk insert pagination fixture doctors: ${error?.message}`);
    }
    fixtureDoctorIds = (data as Array<{ id: string }>).map((row) => row.id);
  });

  test.afterAll(async () => {
    if (fixtureDoctorIds.length > 0) {
      const adminClient = testAdminClient();
      await adminClient.from("doctors").delete().in("id", fixtureDoctorIds);
    }
    await cleanupTestReferenceData();
    await cleanupTestUsers();
  });

  test.describe("endpoint contract: GET /api/admin/doctors", () => {
    test("?page=1 returns pageSize 25, at most 25 rows, and a total at least as large", async ({
      page,
    }) => {
      await loginAs(page, adminCreds, "/admin");

      const response = await page.request.get("/api/admin/doctors?page=1");
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        doctors: unknown[];
        total: number;
        page: number;
        pageSize: number;
      };
      expect(body.pageSize).toBe(ADMIN_PAGE_SIZE);
      expect(body.page).toBe(1);
      expect(body.doctors.length).toBeLessThanOrEqual(ADMIN_PAGE_SIZE);
      expect(body.total).toBeGreaterThanOrEqual(body.doctors.length);
    });

    test("unparameterized GET returns every row: total equals the array length and no page key is present", async ({
      page,
    }) => {
      await loginAs(page, adminCreds, "/admin");

      const response = await page.request.get("/api/admin/doctors");
      expect(response.status()).toBe(200);
      const body = (await response.json()) as { doctors: unknown[]; total: number; page?: number };
      expect(body.total).toBe(body.doctors.length);
      expect(body.page).toBeUndefined();
      expect(body.total).toBeGreaterThanOrEqual(FIXTURE_DOCTOR_COUNT);
    });

    test("consecutive pages are disjoint, and every id on both pages appears in the unparameterized list", async ({
      page,
    }) => {
      await loginAs(page, adminCreds, "/admin");

      const [page1Res, page2Res, allRes] = await Promise.all([
        page.request.get("/api/admin/doctors?page=1"),
        page.request.get("/api/admin/doctors?page=2"),
        page.request.get("/api/admin/doctors"),
      ]);
      const page1 = (await page1Res.json()) as { doctors: { id: string }[] };
      const page2 = (await page2Res.json()) as { doctors: { id: string }[] };
      const all = (await allRes.json()) as { doctors: { id: string }[] };

      const page1Ids = page1.doctors.map((row) => row.id);
      const page2Ids = page2.doctors.map((row) => row.id);
      const allIds = new Set(all.doctors.map((row) => row.id));

      expect(page1Ids.length).toBeGreaterThan(0);
      expect(page2Ids.length).toBeGreaterThan(0);
      const intersection = page1Ids.filter((id) => page2Ids.includes(id));
      expect(intersection).toHaveLength(0);

      for (const id of [...page1Ids, ...page2Ids]) {
        expect(allIds.has(id)).toBe(true);
      }
    });

    test("page=0, page=abc and page=1001 each return 400 with the bounds message", async ({
      page,
    }) => {
      await loginAs(page, adminCreds, "/admin");

      for (const invalidPage of ["0", "abc", "1001"]) {
        const response = await page.request.get(`/api/admin/doctors?page=${invalidPage}`);
        expect(response.status()).toBe(400);
        const body = (await response.json()) as { error: string };
        expect(body.error).toBe("Page must be a whole number between 1 and 1000.");
      }
    });

    test("a patient session receives 403 with ?page=1, same as unparameterized", async ({
      page,
    }) => {
      await loginAs(page, patientCreds, "/patient");

      const response = await page.request.get("/api/admin/doctors?page=1");
      expect(response.status()).toBe(403);
    });
  });

  test.describe("endpoint contract: GET /api/admin/users", () => {
    test("?page=1 returns pageSize 25, at most 25 rows, and a total at least as large", async ({
      page,
    }) => {
      await loginAs(page, adminCreds, "/admin");

      const response = await page.request.get("/api/admin/users?page=1");
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        users: unknown[];
        total: number;
        page: number;
        pageSize: number;
      };
      expect(body.pageSize).toBe(ADMIN_PAGE_SIZE);
      expect(body.page).toBe(1);
      expect(body.users.length).toBeLessThanOrEqual(ADMIN_PAGE_SIZE);
      expect(body.total).toBeGreaterThanOrEqual(body.users.length);
    });

    test("unparameterized GET returns every row: total equals the array length and no page key is present", async ({
      page,
    }) => {
      await loginAs(page, adminCreds, "/admin");

      const response = await page.request.get("/api/admin/users");
      expect(response.status()).toBe(200);
      const body = (await response.json()) as { users: unknown[]; total: number; page?: number };
      expect(body.total).toBe(body.users.length);
      expect(body.page).toBeUndefined();
    });

    test("consecutive pages are disjoint, and every id on both pages appears in the unparameterized list", async ({
      page,
    }) => {
      await loginAs(page, adminCreds, "/admin");

      const [page1Res, page2Res, allRes] = await Promise.all([
        page.request.get("/api/admin/users?page=1"),
        page.request.get("/api/admin/users?page=2"),
        page.request.get("/api/admin/users"),
      ]);
      const page1 = (await page1Res.json()) as { users: { id: string }[] };
      const page2 = (await page2Res.json()) as { users: { id: string }[] };
      const all = (await allRes.json()) as { users: { id: string }[] };

      const page1Ids = page1.users.map((row) => row.id);
      const page2Ids = page2.users.map((row) => row.id);
      const allIds = new Set(all.users.map((row) => row.id));

      const intersection = page1Ids.filter((id) => page2Ids.includes(id));
      expect(intersection).toHaveLength(0);
      for (const id of [...page1Ids, ...page2Ids]) {
        expect(allIds.has(id)).toBe(true);
      }
    });

    test("an invalid page value returns 400", async ({ page }) => {
      await loginAs(page, adminCreds, "/admin");

      const response = await page.request.get("/api/admin/users?page=abc");
      expect(response.status()).toBe(400);
    });

    test("a patient session receives 403 with ?page=1, same as unparameterized", async ({
      page,
    }) => {
      await loginAs(page, patientCreds, "/patient");

      const response = await page.request.get("/api/admin/users?page=1");
      expect(response.status()).toBe(403);
    });
  });

  test.describe("UI: /admin/doctors", () => {
    test("renders at most 25 rows with a working 'Doctors pagination' nav and an accurate count caption", async ({
      page,
    }) => {
      await loginAs(page, adminCreds, "/admin");
      await page.goto("/admin/doctors");

      const bodyRows = page.locator("table tbody tr");
      await expect(bodyRows.first()).toBeVisible();
      const rowCount = await bodyRows.count();
      expect(rowCount).toBeLessThanOrEqual(ADMIN_PAGE_SIZE);

      const nav = page.getByRole("navigation", { name: "Doctors pagination" });
      await expect(nav).toBeVisible();
      await expect(page.getByRole("button", { name: "Previous page" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Next page" })).toBeEnabled();

      const firstRowNameBefore = await bodyRows.first().innerText();
      await page.getByRole("button", { name: "Next page" }).click();
      await expect(page.getByRole("button", { name: "Previous page" })).toBeEnabled();
      await expect(bodyRows.first()).not.toHaveText(firstRowNameBefore);

      const countCaption = page.getByText(/\d+ doctors?$/);
      await expect(countCaption).toBeVisible();
      const captionText = await countCaption.innerText();
      const total = Number(captionText.match(/\d+/)?.[0] ?? "0");
      expect(total).toBeGreaterThan(rowCount);
    });
  });

  test.describe("UI: /admin/users", () => {
    // Unlike the doctors fixture, this spec deliberately does NOT bulk-create
    // auth users — creating profiles requires real auth signups, which is a
    // tracked rate-limiting flakiness source in this project (STATE.md,
    // WINDOWS.md ids 8-11). Instead the true total is read from the API
    // first and the nav assertion is branched on it, so the test is correct
    // whether or not the shared dev database happens to exceed one page.
    test("renders at most 25 rows, with the pagination nav present only when the catalog exceeds one page", async ({
      page,
    }) => {
      await loginAs(page, adminCreds, "/admin");

      const response = await page.request.get("/api/admin/users?page=1");
      const { total } = (await response.json()) as { total: number };

      await page.goto("/admin/users");

      const bodyRows = page.locator("table tbody tr");
      await expect(bodyRows.first()).toBeVisible();
      const rowCount = await bodyRows.count();
      expect(rowCount).toBeLessThanOrEqual(ADMIN_PAGE_SIZE);

      const nav = page.getByRole("navigation", { name: "Users pagination" });
      if (total > ADMIN_PAGE_SIZE) {
        await expect(nav).toBeVisible();
        const firstRowNameBefore = await bodyRows.first().innerText();
        await page.getByRole("button", { name: "Next page" }).click();
        await expect(bodyRows.first()).not.toHaveText(firstRowNameBefore);
      } else {
        await expect(nav).toHaveCount(0);
      }
    });
  });

  test.describe("regression pin: /admin/appointments doctor filter keeps listing the full catalog", () => {
    // Pins the D-LAR-03 hazard this plan exists to prevent — a future edit
    // that made GET /api/admin/doctors paginated BY DEFAULT would silently
    // shrink loadDoctorOptions() in app/admin/appointments/page.tsx to the 25
    // most recently created doctors, dropping the oldest one first.
    test("the doctor filter still lists a doctor that would fall off page 1 if the endpoint ever became paginated by default", async ({
      page,
    }) => {
      await loginAs(page, adminCreds, "/admin");

      const response = await page.request.get("/api/admin/doctors");
      const { doctors, total } = (await response.json()) as {
        doctors: { id: string; full_name: string }[];
        total: number;
      };
      // created_at descending, id descending — the LAST entry is the oldest.
      const oldestDoctor = doctors[doctors.length - 1];
      expect(oldestDoctor).toBeDefined();

      await page.goto("/admin/appointments");
      await page.getByLabel("Doctor").click();

      const options = page.getByRole("option");
      await expect(options.filter({ hasText: oldestDoctor.full_name })).toHaveCount(1);
      expect(await options.count()).toBeGreaterThanOrEqual(total);
    });
  });

});
