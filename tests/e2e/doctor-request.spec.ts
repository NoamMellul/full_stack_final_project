import { expect, test } from "@playwright/test";

import {
  cleanupTestDoctorRequests,
  readDoctorRequestByEmail,
  trackDoctorRequestId,
} from "./helpers/doctor-requests";
import { cleanupTestReferenceData, createTestSpecialty } from "./helpers/reference-data";
import { testAnonClient } from "./helpers/supabase-anon";
import { uniqueTestEmail } from "./helpers/test-users";

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
