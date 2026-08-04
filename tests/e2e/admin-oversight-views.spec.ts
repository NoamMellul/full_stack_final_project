import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

import { cleanupTestAppointments, createTestAppointment } from "./helpers/appointments";
import {
  cleanupTestReferenceData,
  createTestDoctor,
  createTestLocation,
  createTestSpecialty,
} from "./helpers/reference-data";
import { cleanupTestUsers, createTestUser } from "./helpers/test-users";

type Credentials = { email: string; password: string };

const SHARED_PATIENT_NAME = `Same Name Patient ${Date.now()}`;

async function loginAs(page: Page, creds: Credentials, expectedHomeRoute: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(expectedHomeRoute);
}

test.describe("ADMIN-07 / ADMIN-08: platform oversight views", () => {
  let adminCreds: Credentials;
  let patientACreds: Credentials;
  let patientBCreds: Credentials;
  let patientAId: string;
  let patientBId: string;
  let doctor: { id: string; fullName: string };
  let appointmentA: { id: string; slotId: string };
  let appointmentB: { id: string; slotId: string };
  let slotAStart: Date;
  let slotAEnd: Date;
  let slotBStart: Date;
  let slotBEnd: Date;

  test.beforeAll(async () => {
    const admin = await createTestUser("admin");
    adminCreds = { email: admin.email, password: admin.password };

    const patientA = await createTestUser("patient", { fullName: SHARED_PATIENT_NAME });
    const patientB = await createTestUser("patient", { fullName: SHARED_PATIENT_NAME });
    patientACreds = { email: patientA.email, password: patientA.password };
    patientBCreds = { email: patientB.email, password: patientB.password };
    patientAId = patientA.id;
    patientBId = patientB.id;

    const specialty = await createTestSpecialty();
    const location = await createTestLocation();
    doctor = await createTestDoctor({ specialtyId: specialty.id, locationId: location.id });

    // Two well-separated, non-overlapping windows a few days out so this
    // spec never collides with any other test's slot data for this doctor.
    const base = new Date();
    base.setUTCDate(base.getUTCDate() + 3);
    base.setUTCHours(9, 0, 0, 0);

    slotAStart = new Date(base);
    slotAEnd = new Date(slotAStart.getTime() + 30 * 60 * 1000);
    slotBStart = new Date(base.getTime() + 3 * 60 * 60 * 1000);
    slotBEnd = new Date(slotBStart.getTime() + 30 * 60 * 1000);

    appointmentA = await createTestAppointment({
      doctorId: doctor.id,
      patientId: patientAId,
      startAt: slotAStart.toISOString(),
      endAt: slotAEnd.toISOString(),
      status: "scheduled",
    });
    appointmentB = await createTestAppointment({
      doctorId: doctor.id,
      patientId: patientBId,
      startAt: slotBStart.toISOString(),
      endAt: slotBEnd.toISOString(),
      status: "completed",
    });
  });

  test.afterAll(async () => {
    // Foreign keys never block a delete when cleaned up in this order:
    // appointments/slots first, then reference data, then the auth users.
    await cleanupTestAppointments();
    await cleanupTestReferenceData();
    await cleanupTestUsers();
  });

  test.describe("ADMIN-07: registered users", () => {
    test("two profiles sharing an identical full name render as two separate rows", async ({
      page,
    }) => {
      await loginAs(page, adminCreds, "/admin");
      await page.goto("/admin/users");

      const rows = page.getByRole("row").filter({ hasText: SHARED_PATIENT_NAME });
      await expect(rows).toHaveCount(2);
    });

    test("GET /api/admin/users returns rows ordered by created_at desc then id desc", async ({
      page,
    }) => {
      await loginAs(page, adminCreds, "/admin");

      const response = await page.request.get("/api/admin/users");
      expect(response.status()).toBe(200);

      const { users } = (await response.json()) as {
        users: { id: string; created_at: string }[];
      };
      const sorted = [...users].sort((a, b) => {
        if (a.created_at !== b.created_at) {
          return a.created_at < b.created_at ? 1 : -1;
        }
        return a.id < b.id ? 1 : -1;
      });
      expect(users.map((row) => row.id)).toEqual(sorted.map((row) => row.id));
    });

    test("a patient session receives 403 from GET /api/admin/users", async ({ page }) => {
      await loginAs(page, patientACreds, "/patient");

      const response = await page.request.get("/api/admin/users");
      expect(response.status()).toBe(403);
    });
  });

  test.describe("ADMIN-08: platform appointments", () => {
    test("admin sees both seeded appointments with the doctor's and patients' names", async ({
      page,
    }) => {
      await loginAs(page, adminCreds, "/admin");
      await page.goto("/admin/appointments");

      const rows = page.getByRole("row").filter({ hasText: doctor.fullName });
      await expect(rows).toHaveCount(2);
      await expect(rows.first().getByText(SHARED_PATIENT_NAME)).toBeVisible();
    });

    test("filtering by status narrows to the matching appointment", async ({ page }) => {
      await loginAs(page, adminCreds, "/admin");

      const response = await page.request.get("/api/admin/appointments?status=completed");
      expect(response.status()).toBe(200);

      const { appointments } = (await response.json()) as {
        appointments: { id: string; status: string }[];
      };
      const ids = appointments.map((row) => row.id);
      expect(ids).toContain(appointmentB.id);
      expect(ids).not.toContain(appointmentA.id);
      for (const appointment of appointments) {
        expect(appointment.status).toBe("completed");
      }
    });

    test("filtering by doctorId returns only that doctor's appointments", async ({ page }) => {
      await loginAs(page, adminCreds, "/admin");

      const response = await page.request.get(`/api/admin/appointments?doctorId=${doctor.id}`);
      expect(response.status()).toBe(200);

      const { appointments } = (await response.json()) as {
        appointments: { id: string; doctor: { id: string } }[];
      };
      const ids = appointments.map((row) => row.id);
      expect(ids).toContain(appointmentA.id);
      expect(ids).toContain(appointmentB.id);
      for (const appointment of appointments) {
        expect(appointment.doctor.id).toBe(doctor.id);
      }
    });

    test("a from/to window covering only the later slot returns only that appointment", async ({
      page,
    }) => {
      await loginAs(page, adminCreds, "/admin");

      const from = encodeURIComponent(slotBStart.toISOString());
      const to = encodeURIComponent(slotBEnd.toISOString());
      const response = await page.request.get(`/api/admin/appointments?from=${from}&to=${to}`);
      expect(response.status()).toBe(200);

      const { appointments } = (await response.json()) as { appointments: { id: string }[] };
      const ids = appointments.map((row) => row.id);
      expect(ids).toContain(appointmentB.id);
      expect(ids).not.toContain(appointmentA.id);
    });

    test("combining status and doctorId filters narrows to the intersection", async ({
      page,
    }) => {
      await loginAs(page, adminCreds, "/admin");

      const response = await page.request.get(
        `/api/admin/appointments?status=scheduled&doctorId=${doctor.id}`,
      );
      expect(response.status()).toBe(200);

      const { appointments } = (await response.json()) as { appointments: { id: string }[] };
      const ids = appointments.map((row) => row.id);
      expect(ids).toContain(appointmentA.id);
      expect(ids).not.toContain(appointmentB.id);
    });

    test("GET /api/admin/appointments returns rows ordered by created_at desc then id desc", async ({
      page,
    }) => {
      await loginAs(page, adminCreds, "/admin");

      const response = await page.request.get("/api/admin/appointments");
      expect(response.status()).toBe(200);

      const { appointments } = (await response.json()) as {
        appointments: { id: string; created_at: string }[];
      };
      const sorted = [...appointments].sort((a, b) => {
        if (a.created_at !== b.created_at) {
          return a.created_at < b.created_at ? 1 : -1;
        }
        return a.id < b.id ? 1 : -1;
      });
      expect(appointments.map((row) => row.id)).toEqual(sorted.map((row) => row.id));
    });

    test("a patient session receives 403, and a patient's own RLS-governed read never returns the other patient's appointment", async ({
      page,
    }) => {
      await loginAs(page, patientACreds, "/patient");

      const response = await page.request.get("/api/admin/appointments");
      expect(response.status()).toBe(403);

      // Bypasses the app entirely to prove appointments_select_own_or_admin
      // itself — not just the route guard — restricts a patient to their own
      // row (T-02-02).
      const anon = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } },
      );
      const { error: signInError } = await anon.auth.signInWithPassword({
        email: patientACreds.email,
        password: patientACreds.password,
      });
      expect(signInError).toBeNull();

      const { data: ownAppointments, error } = await anon
        .from("appointments")
        .select("id, patient_id");
      expect(error).toBeNull();

      const ids = (ownAppointments ?? []).map((row) => row.id);
      expect(ids).toContain(appointmentA.id);
      expect(ids).not.toContain(appointmentB.id);

      // Symmetric check from the other patient's side of the same boundary.
      const anonB = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } },
      );
      const { error: signInBError } = await anonB.auth.signInWithPassword({
        email: patientBCreds.email,
        password: patientBCreds.password,
      });
      expect(signInBError).toBeNull();

      const { data: patientBAppointments, error: patientBError } = await anonB
        .from("appointments")
        .select("id, patient_id");
      expect(patientBError).toBeNull();

      const patientBIds = (patientBAppointments ?? []).map((row) => row.id);
      expect(patientBIds).toContain(appointmentB.id);
      expect(patientBIds).not.toContain(appointmentA.id);
    });
  });
});
