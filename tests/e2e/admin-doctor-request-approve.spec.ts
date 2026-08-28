import { expect, test, type Page } from "@playwright/test";

import { testAdminClient } from "./helpers/supabase-admin";
import {
  cleanupTestDoctorRequests,
  createTestDoctorRequest,
  readDoctorRequestById,
} from "./helpers/doctor-requests";
import {
  cleanupTestReferenceData,
  createTestLocation,
  createTestSpecialty,
  trackDoctorId,
} from "./helpers/reference-data";
import {
  cleanupTestUsers,
  cleanupTrackedAccountEmails,
  createTestUser,
  trackLinkedAccountEmail,
  uniqueTestEmail,
} from "./helpers/test-users";

// QUICK-260818-q5a Task 1: the Approve shortcut on /admin/doctor-requests
// carries a pending request's name/specialty/email into the /admin/doctors
// create flow, auto-opens the Link account dialog on save, and marks the
// originating request reviewed once the login actually exists.

test.describe("admin doctor request approve shortcut", () => {
  let adminCreds: { email: string; password: string };
  let specialty: { id: string; nameEn: string; nameHe: string };
  let location: { id: string; city: string; neighborhood: string };

  test.beforeAll(async () => {
    const admin = await createTestUser("admin");
    adminCreds = { email: admin.email, password: admin.password };
    specialty = await createTestSpecialty();
    location = await createTestLocation();
  });

  test.afterAll(async () => {
    // Accounts before users before reference data, matching
    // admin-doctor-link-account.spec.ts, so the doctor row is deleted after
    // the profile that points at it.
    await cleanupTrackedAccountEmails();
    await cleanupTestUsers();
    await cleanupTestDoctorRequests();
    await cleanupTestReferenceData();
  });

  async function loginAsAdmin(page: Page) {
    await page.goto("/login");
    await page.getByLabel("Email").fill(adminCreds.email);
    await page.getByLabel("Password").fill(adminCreds.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("/admin");
  }

  test("1. an admin approves a pending request end-to-end: prefilled create form, auto-opened link dialog, request marked reviewed", async ({
    page,
  }) => {
    const fullName = `Approve Flow Doctor ${Date.now()}`;
    const email = uniqueTestEmail("approve-flow");
    const request = await createTestDoctorRequest({
      fullName,
      email,
      specialtyId: specialty.id,
    });

    await loginAsAdmin(page);
    await page.goto("/admin/doctor-requests");

    const row = page.getByRole("row").filter({ hasText: fullName });
    await row.getByRole("button", { name: `Approve request for ${fullName}` }).click();
    await page.waitForURL(/\/admin\/doctors\?/);

    await expect(page.locator("#create-fullName")).toHaveValue(fullName);
    await expect(page.locator("#create-specialtyId")).toContainText(specialty.nameEn);
    await expect(page.locator("#create-locationId")).toContainText("Select a location");

    await page.locator("#create-locationId").click();
    await page
      .getByRole("option", { name: `${location.neighborhood}, ${location.city}` })
      .click();
    await page.getByRole("button", { name: "Save doctor" }).click();

    const linkDialog = page.getByRole("dialog");
    await expect(linkDialog).toBeVisible();
    await expect(linkDialog.getByLabel("Email")).toHaveValue(email);

    await linkDialog.getByRole("button", { name: "Generate temporary password" }).click();
    await expect(page.getByText("Login created")).toBeVisible();

    trackLinkedAccountEmail(email);
    const admin = testAdminClient();
    const { data: createdDoctor } = await admin
      .from("doctors")
      .select("id, specialty_id, location_id, profile_id")
      .eq("full_name", fullName)
      .single();
    expect(createdDoctor).not.toBeNull();
    if (createdDoctor) trackDoctorId(createdDoctor.id);

    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText("Doctor request marked reviewed.")).toBeVisible();

    const reviewedRequest = await readDoctorRequestById(request.id);
    expect(reviewedRequest?.status).toBe("reviewed");

    expect(createdDoctor?.specialty_id).toBe(specialty.id);
    expect(createdDoctor?.location_id).toBe(location.id);
    expect(createdDoctor?.profile_id).not.toBeNull();
  });

  // QUICK-260818-q5a Task 2: edge cases — a no-specialty request, a plain
  // visit with no privileged side effect, and both actions coexisting.

  test("2. a request with no specialty approves cleanly: name/email prefill, specialty trigger shows its placeholder", async ({
    page,
  }) => {
    const fullName = `No Specialty Approve Doctor ${Date.now()}`;
    const email = uniqueTestEmail("approve-no-specialty");
    await createTestDoctorRequest({
      fullName,
      email,
      specialtyId: null,
    });

    await loginAsAdmin(page);
    await page.goto("/admin/doctor-requests");

    const row = page.getByRole("row").filter({ hasText: fullName });
    await row.getByRole("button", { name: `Approve request for ${fullName}` }).click();
    await page.waitForURL(/\/admin\/doctors\?/);

    await expect(page.locator("#create-fullName")).toHaveValue(fullName);
    await expect(page.locator("#create-specialtyId")).toContainText("Select a specialty");

    await page.locator("#create-specialtyId").click();
    await page.getByRole("option", { name: specialty.nameEn }).click();
    await page.locator("#create-locationId").click();
    await page
      .getByRole("option", { name: `${location.neighborhood}, ${location.city}` })
      .click();
    await page.getByRole("button", { name: "Save doctor" }).click();

    const linkDialog = page.getByRole("dialog");
    await expect(linkDialog).toBeVisible();
    await expect(linkDialog.getByLabel("Email")).toHaveValue(email);

    trackLinkedAccountEmail(email);
    const admin = testAdminClient();
    const { data: createdDoctor } = await admin
      .from("doctors")
      .select("id")
      .eq("full_name", fullName)
      .single();
    if (createdDoctor) trackDoctorId(createdDoctor.id);

    await linkDialog.getByRole("button", { name: "Generate temporary password" }).click();
    await expect(page.getByText("Login created")).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();
  });

  test("3. a plain visit to /admin/doctors with no approve params has no privileged side effect", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    let patchToDoctorRequests = false;
    page.on("request", (request) => {
      if (
        request.url().includes("/api/admin/doctor-requests") &&
        request.method() === "PATCH"
      ) {
        patchToDoctorRequests = true;
      }
    });

    await page.goto("/admin/doctors");
    await expect(page.locator("#create-fullName")).toHaveValue("");

    const doctorName = `Plain Visit Doctor ${Date.now()}`;
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
    const { data: createdDoctor } = await admin
      .from("doctors")
      .select("id")
      .eq("full_name", doctorName)
      .single();
    if (createdDoctor) trackDoctorId(createdDoctor.id);

    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(patchToDoctorRequests).toBe(false);
  });

  test("4. a pending row exposes both actions; a reviewed row exposes neither", async ({
    page,
  }) => {
    const pendingName = `Both Actions Pending Doctor ${Date.now()}`;
    const reviewedName = `Both Actions Reviewed Doctor ${Date.now()}`;
    await createTestDoctorRequest({
      fullName: pendingName,
      email: uniqueTestEmail("approve-both-actions-pending"),
      specialtyId: specialty.id,
    });
    await createTestDoctorRequest({
      fullName: reviewedName,
      email: uniqueTestEmail("approve-both-actions-reviewed"),
      specialtyId: specialty.id,
      status: "reviewed",
    });

    await loginAsAdmin(page);
    await page.goto("/admin/doctor-requests");

    const pendingRow = page.getByRole("row").filter({ hasText: pendingName });
    await expect(
      pendingRow.getByRole("button", { name: `Approve request for ${pendingName}` }),
    ).toBeVisible();
    await expect(
      pendingRow.getByRole("button", { name: `Mark reviewed for ${pendingName}` }),
    ).toBeVisible();

    const reviewedRow = page.getByRole("row").filter({ hasText: reviewedName });
    await expect(
      reviewedRow.getByRole("button", { name: `Approve request for ${reviewedName}` }),
    ).toHaveCount(0);
    await expect(
      reviewedRow.getByRole("button", { name: `Mark reviewed for ${reviewedName}` }),
    ).toHaveCount(0);
  });
});
