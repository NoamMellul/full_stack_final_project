import { expect, test, type BrowserContext } from "@playwright/test";

import {
  cleanupTestReferenceData,
  createTestDoctor,
  createTestLocation,
  createTestSpecialty,
} from "./helpers/reference-data";
import { testAdminClient } from "./helpers/supabase-admin";
import { cleanupTestUsers, createTestUser, uniqueTestEmail } from "./helpers/test-users";

// Cross-cutting denial matrix (T-02-02, T-02-18): every admin page and every
// admin API endpoint added across plans 02-01 through 02-05, proven closed to
// an unauthenticated caller, a patient session and a doctor session, with no
// side effect from a rejected request.

const ADMIN_PAGES = [
  "/admin",
  "/admin/doctors",
  "/admin/specialties",
  "/admin/locations",
  "/admin/users",
  "/admin/appointments",
] as const;

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

type EndpointDescriptor = {
  method: HttpMethod;
  label: string;
  path: () => string;
  body?: () => unknown;
};

test.describe("Admin cross-cutting denial matrix", () => {
  let adminCreds: { email: string; password: string };
  let patientCreds: { email: string; password: string };
  let doctorCreds: { email: string; password: string };

  let specialty: { id: string; nameEn: string; nameHe: string };
  let location: { id: string; city: string; neighborhood: string };
  let doctorFixture: { id: string; fullName: string };

  let unauthContext: BrowserContext;
  let patientContext: BrowserContext;
  let doctorContext: BrowserContext;
  let adminContext: BrowserContext;

  // Lazy `path`/`body` factories so the array can be declared once, at
  // module scope, while still resolving against fixtures that are only
  // created inside beforeAll — one row per endpoint, so adding an endpoint
  // later means adding one row.
  const ENDPOINTS: EndpointDescriptor[] = [
    { method: "GET", label: "GET /api/admin/doctors", path: () => "/api/admin/doctors" },
    {
      method: "POST",
      label: "POST /api/admin/doctors",
      path: () => "/api/admin/doctors",
      body: () => ({
        fullName: "Denial Sweep Doctor",
        specialtyId: specialty.id,
        locationId: location.id,
      }),
    },
    {
      method: "PATCH",
      label: "PATCH /api/admin/doctors/{id}",
      path: () => `/api/admin/doctors/${doctorFixture.id}`,
      body: () => ({ fullName: "Should Not Update" }),
    },
    {
      method: "PATCH",
      label: "PATCH /api/admin/doctors/{id}/status",
      path: () => `/api/admin/doctors/${doctorFixture.id}/status`,
      body: () => ({ isActive: false }),
    },
    {
      method: "POST",
      label: "POST /api/admin/doctors/{id}/link-account",
      path: () => `/api/admin/doctors/${doctorFixture.id}/link-account`,
      body: () => ({ email: uniqueTestEmail("denial-sweep") }),
    },
    { method: "GET", label: "GET /api/admin/specialties", path: () => "/api/admin/specialties" },
    {
      method: "POST",
      label: "POST /api/admin/specialties",
      path: () => "/api/admin/specialties",
      body: () => ({ nameEn: "Denial Sweep Specialty", nameHe: "התמחות בדיקה" }),
    },
    {
      method: "PATCH",
      label: "PATCH /api/admin/specialties/{id}",
      path: () => `/api/admin/specialties/${specialty.id}`,
      body: () => ({ nameEn: "Should Not Rename" }),
    },
    {
      method: "DELETE",
      label: "DELETE /api/admin/specialties/{id}",
      path: () => `/api/admin/specialties/${specialty.id}`,
    },
    { method: "GET", label: "GET /api/admin/locations", path: () => "/api/admin/locations" },
    {
      method: "POST",
      label: "POST /api/admin/locations",
      path: () => "/api/admin/locations",
      body: () => ({ city: "Tel Aviv", neighborhood: "Denial Sweep Neighborhood" }),
    },
    {
      method: "PATCH",
      label: "PATCH /api/admin/locations/{id}",
      path: () => `/api/admin/locations/${location.id}`,
      body: () => ({ city: "Should Not Rename" }),
    },
    {
      method: "DELETE",
      label: "DELETE /api/admin/locations/{id}",
      path: () => `/api/admin/locations/${location.id}`,
    },
    { method: "GET", label: "GET /api/admin/users", path: () => "/api/admin/users" },
    {
      method: "GET",
      label: "GET /api/admin/appointments",
      path: () => "/api/admin/appointments",
    },
  ];

  async function loginInContext(
    context: BrowserContext,
    creds: { email: string; password: string },
    expectedUrl: string,
  ) {
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel("Email").fill(creds.email);
    await page.getByLabel("Password").fill(creds.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL(expectedUrl);
    await page.close();
  }

  async function callEndpoint(context: BrowserContext, descriptor: EndpointDescriptor) {
    const path = descriptor.path();
    switch (descriptor.method) {
      case "GET":
        return context.request.get(path);
      case "POST":
        return context.request.post(path, { data: descriptor.body?.() });
      case "PATCH":
        return context.request.patch(path, { data: descriptor.body?.() });
      case "DELETE":
        return context.request.delete(path);
      default:
        throw new Error(`Unsupported method: ${descriptor.method}`);
    }
  }

  test.beforeAll(async ({ browser }) => {
    const admin = await createTestUser("admin");
    const patient = await createTestUser("patient");
    const doctorUser = await createTestUser("doctor");
    adminCreds = { email: admin.email, password: admin.password };
    patientCreds = { email: patient.email, password: patient.password };
    doctorCreds = { email: doctorUser.email, password: doctorUser.password };

    specialty = await createTestSpecialty();
    location = await createTestLocation();
    doctorFixture = await createTestDoctor({
      fullName: `Denial Matrix Doctor ${Date.now()}`,
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });

    // Four persistent contexts (never re-logged-in per assertion) — one per
    // session state, reused across the whole page and endpoint matrix below.
    unauthContext = await browser.newContext();
    patientContext = await browser.newContext();
    doctorContext = await browser.newContext();
    adminContext = await browser.newContext();

    await loginInContext(patientContext, patientCreds, "/patient");
    await loginInContext(doctorContext, doctorCreds, "/doctor");
    await loginInContext(adminContext, adminCreds, "/admin");
  });

  test.afterAll(async () => {
    await unauthContext?.close();
    await patientContext?.close();
    await doctorContext?.close();
    await adminContext?.close();
    await cleanupTestReferenceData();
    await cleanupTestUsers();
  });

  for (const path of ADMIN_PAGES) {
    test(`logged out visiting ${path} is redirected to /login with from=${path}`, async () => {
      const page = await unauthContext.newPage();
      await page.goto(path);
      await page.waitForURL(/\/login/);
      const url = new URL(page.url());
      expect(url.pathname).toBe("/login");
      expect(url.searchParams.get("from")).toBe(path);
      await page.close();
    });

    test(`a patient visiting ${path} is redirected away`, async () => {
      const page = await patientContext.newPage();
      await page.goto(path);
      await page.waitForURL("/");
      await expect(page).toHaveURL("/");
      await page.close();
    });

    test(`a doctor visiting ${path} is redirected away`, async () => {
      const page = await doctorContext.newPage();
      await page.goto(path);
      await page.waitForURL("/");
      await expect(page).toHaveURL("/");
      await page.close();
    });

    test(`an admin visiting ${path} renders the page`, async () => {
      const page = await adminContext.newPage();
      await page.goto(path);
      await expect(page).toHaveURL(path);
      await page.close();
    });
  }

  test("every admin endpoint returns 401 unauthenticated, 403 for a patient session, and 403 for a doctor session", async () => {
    for (const descriptor of ENDPOINTS) {
      const unauthResponse = await callEndpoint(unauthContext, descriptor);
      expect(unauthResponse.status(), `${descriptor.label} (unauthenticated)`).toBe(401);

      const patientResponse = await callEndpoint(patientContext, descriptor);
      expect(patientResponse.status(), `${descriptor.label} (patient)`).toBe(403);

      const doctorResponse = await callEndpoint(doctorContext, descriptor);
      expect(doctorResponse.status(), `${descriptor.label} (doctor)`).toBe(403);
    }
  });

  test("after the denial sweep, the fixture doctor, specialty and location rows are byte-identical to their pre-sweep values", async () => {
    const admin = testAdminClient();

    const { data: doctorRow } = await admin
      .from("doctors")
      .select("full_name, specialty_id, location_id, is_active, profile_id")
      .eq("id", doctorFixture.id)
      .single();
    expect(doctorRow?.full_name).toBe(doctorFixture.fullName);
    expect(doctorRow?.specialty_id).toBe(specialty.id);
    expect(doctorRow?.location_id).toBe(location.id);
    expect(doctorRow?.is_active).toBe(true);
    expect(doctorRow?.profile_id).toBeNull();

    const { data: specialtyRow } = await admin
      .from("specialties")
      .select("name_en, name_he")
      .eq("id", specialty.id)
      .single();
    expect(specialtyRow?.name_en).toBe(specialty.nameEn);
    expect(specialtyRow?.name_he).toBe(specialty.nameHe);

    const { data: locationRow } = await admin
      .from("locations")
      .select("city, neighborhood")
      .eq("id", location.id)
      .single();
    expect(locationRow?.city).toBe(location.city);
    expect(locationRow?.neighborhood).toBe(location.neighborhood);
  });
});
