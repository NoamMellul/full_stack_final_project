import { expect, test } from "@playwright/test";

import { testAdminClient } from "./helpers/supabase-admin";
import {
  cleanupTestUsers,
  cleanupTrackedAccountEmails,
  createTestUser,
  trackLinkedAccountEmail,
  uniqueTestEmail,
} from "./helpers/test-users";
import {
  cleanupTestReferenceData,
  createTestDoctor,
  createTestLocation,
  createTestSpecialty,
} from "./helpers/reference-data";

const NEW_PASSWORD = "NewDoctorPassw0rd!";

test.describe("ADMIN-04: link a doctor login", () => {
  let adminCreds: { email: string; password: string };
  let specialty: { id: string; nameEn: string };
  let location: { id: string; city: string; neighborhood: string };
  let doctor: { id: string; fullName: string };
  let doctorEmail: string;
  let capturedPassword: string;
  let mustChangeAfterLink: boolean | undefined;

  test.beforeAll(async () => {
    const admin = await createTestUser("admin");
    adminCreds = { email: admin.email, password: admin.password };
    specialty = await createTestSpecialty();
    location = await createTestLocation();
    doctor = await createTestDoctor({
      fullName: `Link Account Doctor ${Date.now()}`,
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });
  });

  test.afterAll(async () => {
    await cleanupTrackedAccountEmails();
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

  test("1. the admin links the doctor and sees the one-time temporary password exactly once", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/doctors");

    doctorEmail = uniqueTestEmail("linked-doctor");

    const row = page.getByRole("row").filter({ hasText: doctor.fullName });
    await row.getByRole("button", { name: "Link account", exact: true }).click();

    await page.getByLabel("Email").fill(doctorEmail);
    await page.getByRole("button", { name: "Generate temporary password" }).click();

    await expect(page.getByText("Login created")).toBeVisible();
    await expect(
      page.getByText("This password will not be shown again. Share it with the doctor now."),
    ).toBeVisible();

    const passwordText = await page.getByText(/^Temporary password: /).textContent();
    capturedPassword = (passwordText ?? "").replace("Temporary password: ", "").trim();
    expect(capturedPassword.length).toBeGreaterThanOrEqual(12);
    trackLinkedAccountEmail(doctorEmail);

    // Capture the must_change_password state right after linking, before the
    // doctor ever changes their own password — this is the "before" half of
    // the flip that test 8 proves.
    const admin = testAdminClient();
    const { data: linkedProfile } = await admin
      .from("profiles")
      .select("must_change_password")
      .eq("email", doctorEmail)
      .single();
    mustChangeAfterLink = linkedProfile?.must_change_password;

    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText("Login created")).not.toBeVisible();

    await expect(
      page.getByRole("row").filter({ hasText: doctor.fullName }).getByText("Linked"),
    ).toBeVisible();
  });

  test("2. the linked doctor logs in and is redirected to /doctor/change-password, not /doctor", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(doctorEmail);
    await page.getByLabel("Password").fill(capturedPassword);
    await page.getByRole("button", { name: "Log in" }).click();

    await page.waitForURL("/doctor/change-password");
    await expect(page).toHaveURL("/doctor/change-password");
  });

  test("3. navigating directly to /doctor bounces back to /doctor/change-password with no redirect loop", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(doctorEmail);
    await page.getByLabel("Password").fill(capturedPassword);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("/doctor/change-password");

    await page.goto("/doctor");
    await page.waitForURL("/doctor/change-password");
    await expect(page.getByText("Set a new password")).toBeVisible();
  });

  test("4. submitting a new password lands on /doctor, and the next login goes straight there", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(doctorEmail);
    await page.getByLabel("Password").fill(capturedPassword);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("/doctor/change-password");

    await page.getByLabel("New password", { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel("Confirm new password").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Update password" }).click();

    await page.waitForURL("/doctor");
    // /doctor now renders the real dashboard (plan 06-03) rather than the
    // "Nothing here yet" placeholder this test originally asserted.
    await expect(page.getByRole("heading", { name: "My dashboard" })).toBeVisible();

    await page.getByRole("button", { name: "Log out" }).click();
    await page.waitForURL("/");

    await page.goto("/login");
    await page.getByLabel("Email").fill(doctorEmail);
    await page.getByLabel("Password").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();

    await page.waitForURL("/doctor");
    await expect(page).toHaveURL("/doctor");
  });

  test("5. a second link-account call on the same doctor returns 409 and creates no second account", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    const admin = testAdminClient();
    const { data: usersBefore } = await admin.auth.admin.listUsers();
    const countBefore = usersBefore?.users.length ?? 0;

    const response = await page.request.post(`/api/admin/doctors/${doctor.id}/link-account`, {
      data: { email: uniqueTestEmail("second-attempt") },
    });

    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.error).toBe("This doctor is already linked to a login account.");

    const { data: usersAfter } = await admin.auth.admin.listUsers();
    expect(usersAfter?.users.length ?? 0).toBe(countBefore);
  });

  test("6. link-account with an already-registered email surfaces the duplicate message and leaves the other account working", async ({
    page,
  }) => {
    const otherDoctor = await createTestDoctor({
      fullName: `Other Unlinked Doctor ${Date.now()}`,
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });

    await loginAsAdmin(page);

    const response = await page.request.post(
      `/api/admin/doctors/${otherDoctor.id}/link-account`,
      { data: { email: doctorEmail } },
    );

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("An account with this email already exists.");

    // The already-linked doctor's account still works with the password set in test 4.
    await page.goto("/login");
    await page.getByLabel("Email").fill(doctorEmail);
    await page.getByLabel("Password").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("/doctor");
  });

  test("7. a patient session calling link-account receives 403 and creates no auth user", async ({
    page,
  }) => {
    const patient = await createTestUser("patient");
    await page.goto("/login");
    await page.getByLabel("Email").fill(patient.email);
    await page.getByLabel("Password").fill(patient.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("/patient");

    const admin = testAdminClient();
    const { data: usersBefore } = await admin.auth.admin.listUsers();
    const countBefore = usersBefore?.users.length ?? 0;

    const response = await page.request.post(`/api/admin/doctors/${doctor.id}/link-account`, {
      data: { email: uniqueTestEmail("patient-attempt") },
    });
    expect(response.status()).toBe(403);

    const { data: usersAfter } = await admin.auth.admin.listUsers();
    expect(usersAfter?.users.length ?? 0).toBe(countBefore);
  });

  test("8. the linked doctor's profile row shows role=doctor and must_change_password flipped from true to false across the password change", async () => {
    expect(mustChangeAfterLink).toBe(true);

    const admin = testAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("role, must_change_password")
      .eq("email", doctorEmail)
      .single();

    expect(data?.role).toBe("doctor");
    expect(data?.must_change_password).toBe(false);
  });
});
