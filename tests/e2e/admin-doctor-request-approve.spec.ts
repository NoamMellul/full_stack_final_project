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
});
