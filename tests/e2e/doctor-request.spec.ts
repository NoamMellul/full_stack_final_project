import { expect, test, type Page } from "@playwright/test";

import {
  cleanupTestDoctorRequests,
  createTestDoctorRequest,
  readDoctorRequestByEmail,
  readDoctorRequestById,
  trackDoctorRequestId,
} from "./helpers/doctor-requests";
import { cleanupTestReferenceData, createTestSpecialty } from "./helpers/reference-data";
import { testAnonClient } from "./helpers/supabase-anon";
import { cleanupTestUsers, createTestUser, uniqueTestEmail } from "./helpers/test-users";

// QUICK-260816-hb3 Task 1: an anonymous visitor submits a doctor request from
// /login and it lands in the database as an admin-only pending row. All four
// tests here are anonymous — no login anywhere in this file's first describe
// block.

test.describe("doctor request: anonymous submission", () => {
  let specialty: { id: string; nameEn: string; nameHe: string };

  test.beforeAll(async () => {
    specialty = await createTestSpecialty();
  });

  test.afterAll(async () => {
    await cleanupTestDoctorRequests();
    await cleanupTestReferenceData();
  });

  test("1. an anonymous visitor submits the dialog from /login and the row lands correctly", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByRole("button", { name: "Are you a doctor? Request to join" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const email = uniqueTestEmail("doctor-request");
    const fullName = "  Dr. Test Requester  ".trim();
    const message = "  Please reach out, I am very interested.  ";

    await dialog.getByLabel("Full name").fill(fullName);
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByLabel("Specialty").click();
    await page.getByRole("option", { name: specialty.nameEn }).click();
    await dialog.getByLabel("Message (optional)").fill(message);

    await dialog.getByRole("button", { name: "Send request" }).click();

    await expect(
      dialog.getByText("Thank you — your request was received. An administrator will review it."),
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Send request" })).toHaveCount(0);

    const row = await readDoctorRequestByEmail(email);
    expect(row).not.toBeNull();
    if (!row) return;
    trackDoctorRequestId(row.id);

    expect(row.status).toBe("pending");
    expect(row.created_at).toBeTruthy();
    expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(row.full_name).toBe(fullName);
    expect(row.email).toBe(email);
    expect(row.specialty_id).toBe(specialty.id);
    // Byte-identical round-trip including leading/trailing whitespace
    // (Phase 04 `reason` rule) — message is stored exactly as submitted.
    expect(row.message).toBe(message);
  });

  test("2. a direct anonymous select against doctor_requests returns zero rows (RLS boundary)", async ({
    request,
  }) => {
    const email = uniqueTestEmail("doctor-request-rls");
    // Create a fresh row via a direct POST so this test is self-sufficient,
    // then prove the anon client cannot see it.
    const response = await request.post("/api/doctor-requests", {
      data: {
        fullName: "RLS Boundary Doctor",
        email,
        specialtyId: specialty.id,
      },
    });
    expect(response.status()).toBe(201);
    const created = await readDoctorRequestByEmail(email);
    expect(created).not.toBeNull();
    if (created) trackDoctorRequestId(created.id);

    const anon = testAnonClient();
    const { data, error } = await anon
      .from("doctor_requests")
      .select("id")
      .eq("id", created?.id ?? "");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  test("3. the route ignores client-supplied id/created_at/status and always inserts a server-generated pending row", async ({
    request,
  }) => {
    const email = uniqueTestEmail("doctor-request-tamper");
    const suppliedId = "00000000-0000-0000-0000-000000000000";
    const suppliedCreatedAt = "2000-01-01T00:00:00.000Z";

    const response = await request.post("/api/doctor-requests", {
      data: {
        fullName: "Tamper Attempt Doctor",
        email,
        specialtyId: specialty.id,
        id: suppliedId,
        created_at: suppliedCreatedAt,
        status: "reviewed",
      },
    });
    expect(response.status()).toBe(201);

    const row = await readDoctorRequestByEmail(email);
    expect(row).not.toBeNull();
    if (!row) return;
    trackDoctorRequestId(row.id);

    expect(row.status).toBe("pending");
    expect(row.id).not.toBe(suppliedId);
    expect(row.created_at).not.toBe(suppliedCreatedAt);
  });

  test("4. a direct anonymous client insert cannot pre-mark itself reviewed, but a pending insert succeeds", async () => {
    const anon = testAnonClient();

    const reviewedEmail = uniqueTestEmail("doctor-request-reviewed-insert");
    const { error: reviewedError } = await anon.from("doctor_requests").insert({
      full_name: "Reviewed Insert Attempt",
      email: reviewedEmail,
      specialty_id: specialty.id,
      status: "reviewed",
    });
    expect(reviewedError).not.toBeNull();

    // No .select() chained after .insert(): doctor_requests_select_admin
    // denies SELECT to anon, so an anon insert().select() fails even for a
    // row that stored fine (the same pitfall the route itself avoids — see
    // key_links). Verify success via a separate admin-client lookup.
    const pendingEmail = uniqueTestEmail("doctor-request-pending-insert");
    const { error: pendingError } = await anon.from("doctor_requests").insert({
      full_name: "Pending Insert Attempt",
      email: pendingEmail,
      specialty_id: specialty.id,
    });

    expect(pendingError).toBeNull();
    const pendingRow = await readDoctorRequestByEmail(pendingEmail);
    expect(pendingRow?.status).toBe("pending");
    if (pendingRow?.id) trackDoctorRequestId(pendingRow.id);
  });

  test("6. a malformed JSON body returns 400, not a 500 (T-EQS-06)", async ({ request }) => {
    // A raw Buffer (unlike a string `data`) is always sent byte-for-byte —
    // Playwright's fetch client otherwise treats a non-parsable string paired
    // with a JSON content-type as a value to be JSON.stringify()'d, which
    // would silently produce a *valid* JSON string body and defeat this case
    // (precedent: appointment-booking.spec.ts test 9).
    const response = await request.post("/api/doctor-requests", {
      headers: { "Content-Type": "application/json" },
      data: Buffer.from("{ not json", "utf8"),
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid request body.");
  });

  test("5. submitting an empty full name shows the translated required-field error with no network request", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByRole("button", { name: "Are you a doctor? Request to join" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    let requestMade = false;
    page.on("request", (request) => {
      if (request.url().includes("/api/doctor-requests") && request.method() === "POST") {
        requestMade = true;
      }
    });

    await dialog.getByLabel("Email").fill(uniqueTestEmail("doctor-request-empty-name"));
    await dialog.getByRole("button", { name: "Send request" }).click();

    await expect(dialog.getByText("Full name is required.")).toBeVisible();
    expect(requestMade).toBe(false);
  });
});

// QUICK-260816-hb3 Task 2: the admin triage surface (list, mark reviewed)
// and both nav entries.
test.describe("doctor request: admin triage", () => {
  let adminCreds: { email: string; password: string };
  let specialty: { id: string; nameEn: string; nameHe: string };

  test.beforeAll(async () => {
    const admin = await createTestUser("admin");
    adminCreds = { email: admin.email, password: admin.password };
    specialty = await createTestSpecialty();
  });

  test.afterAll(async () => {
    await cleanupTestDoctorRequests();
    await cleanupTestReferenceData();
    await cleanupTestUsers();
  });

  async function loginAsAdmin(page: Page) {
    await page.goto("/login");
    await page.getByLabel("Email").fill(adminCreds.email);
    await page.getByLabel("Password").fill(adminCreds.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("/admin");
  }

  test("a. an anonymously submitted request is visible at /admin/doctor-requests with all its data and pending status", async ({
    page,
  }) => {
    const email = uniqueTestEmail("doctor-request-admin-view");
    const request = await createTestDoctorRequest({
      fullName: "Admin View Test Doctor",
      email,
      specialtyId: specialty.id,
      message: "A message the admin should see.",
    });

    await loginAsAdmin(page);
    await page.goto("/admin/doctor-requests");

    const row = page.getByRole("row").filter({ hasText: request.full_name });
    await expect(row).toBeVisible();
    await expect(row.getByText(email)).toBeVisible();
    await expect(row.getByText(specialty.nameEn)).toBeVisible();
    await expect(row.getByText("A message the admin should see.")).toBeVisible();
    await expect(row.getByText("Pending", { exact: true })).toBeVisible();
  });

  test("b/c. marking a request reviewed flips its status, surfaces confirmation, survives reload, and hides the button", async ({
    page,
  }) => {
    const email = uniqueTestEmail("doctor-request-mark-reviewed");
    const request = await createTestDoctorRequest({
      fullName: "Mark Reviewed Test Doctor",
      email,
      specialtyId: specialty.id,
    });

    await loginAsAdmin(page);
    await page.goto("/admin/doctor-requests");

    const row = page.getByRole("row").filter({ hasText: request.full_name });
    await row.getByRole("button", { name: `Mark reviewed for ${request.full_name}` }).click();

    await expect(page.getByText(`${request.full_name}'s request marked reviewed.`)).toBeVisible();
    await expect(row.getByText("Reviewed", { exact: true })).toBeVisible();
    await expect(row.getByRole("button", { name: "Mark reviewed" })).toHaveCount(0);

    await page.reload();
    const rowAfterReload = page.getByRole("row").filter({ hasText: request.full_name });
    await expect(rowAfterReload.getByText("Reviewed", { exact: true })).toBeVisible();
    await expect(rowAfterReload.getByRole("button", { name: "Mark reviewed" })).toHaveCount(0);
  });

  test("d. a second PATCH on an already-reviewed request is a 200 no-op", async ({ page }) => {
    const email = uniqueTestEmail("doctor-request-idempotent-patch");
    const fixture = await createTestDoctorRequest({
      fullName: "Idempotent PATCH Doctor",
      email,
      specialtyId: specialty.id,
      status: "reviewed",
    });

    await loginAsAdmin(page);
    const response = await page.request.patch(`/api/admin/doctor-requests/${fixture.id}`);
    expect(response.status()).toBe(200);

    const row = await readDoctorRequestById(fixture.id);
    expect(row?.status).toBe("reviewed");
  });

  test("e. a PATCH against a well-formed but nonexistent id returns 404", async ({ page }) => {
    await loginAsAdmin(page);
    const response = await page.request.patch(
      "/api/admin/doctor-requests/00000000-0000-0000-0000-000000000000",
    );
    expect(response.status()).toBe(404);
  });

  test("f. ordering: the newer of two requests appears in an earlier table row", async ({
    page,
  }) => {
    const olderEmail = uniqueTestEmail("doctor-request-order-older");
    const older = await createTestDoctorRequest({
      fullName: "Older Ordering Doctor",
      email: olderEmail,
      specialtyId: specialty.id,
    });
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const newerEmail = uniqueTestEmail("doctor-request-order-newer");
    const newer = await createTestDoctorRequest({
      fullName: "Newer Ordering Doctor",
      email: newerEmail,
      specialtyId: specialty.id,
    });

    await loginAsAdmin(page);
    await page.goto("/admin/doctor-requests");

    // Wait for the list fetch to resolve (skeleton rows carry no text) before
    // reading row order.
    await expect(page.getByRole("row").filter({ hasText: newer.full_name })).toBeVisible();

    const rows = page.getByRole("row");
    const allText = await rows.allInnerTexts();
    const newerIndex = allText.findIndex((text) => text.includes(newer.full_name));
    const olderIndex = allText.findIndex((text) => text.includes(older.full_name));
    expect(newerIndex).toBeGreaterThan(-1);
    expect(olderIndex).toBeGreaterThan(-1);
    expect(newerIndex).toBeLessThan(olderIndex);
  });

  test("g. both navs: the header nav link navigates, and the /admin section bar marks exactly the new page current", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin");

    const headerNav = page.getByRole("navigation", { name: "Main navigation" });
    await headerNav.getByRole("link", { name: "Doctor requests", exact: true }).click();
    await page.waitForURL("/admin/doctor-requests");

    const sectionNav = page.getByRole("navigation", { name: "Admin sections" });
    await expect(
      sectionNav.getByRole("link", { name: "Doctor requests", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      await sectionNav.getByRole("link", { name: "Doctors", exact: true }).getAttribute("aria-current"),
    ).toBeNull();
  });
});
