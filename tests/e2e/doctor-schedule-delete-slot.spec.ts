import { expect, test, type Page } from "@playwright/test";

import { cleanupTestSlots, createTestSlots } from "./helpers/availability";
import {
  cleanupTestReferenceData,
  createTestDoctor,
  createTestLocation,
  createTestSpecialty,
} from "./helpers/reference-data";
import { testAdminClient } from "./helpers/supabase-admin";
import { cleanupTestUsers, createTestUser, TEST_PASSWORD } from "./helpers/test-users";
import { formatJerusalemTime, jerusalemDayKey, jerusalemWallClockToUtc } from "../../lib/timezone";

// AVAIL-04, AVAIL-05: a doctor deletes their own available/blocked rows
// (deleting a blocked row IS the un-block action, D-01), a booked row can
// never be deleted through this endpoint, and the delete decision reads
// live database state so the double-delete, concurrent-delete,
// repeated-booked-rejection and foreign-id edges each resolve to a defined,
// non-destructive outcome. Every fixture time is authored several days in
// the future via jerusalemWallClockToUtc so no case is sensitive to the day
// it runs.

const NOT_FOUND_MESSAGE = "This entry no longer exists.";
const BOOKED_MESSAGE = "This slot has already been booked and can't be deleted.";

type DoctorFixture = {
  doctorUserId: string;
  email: string;
  doctorId: string;
};

async function setupLinkedDoctor(page: Page): Promise<DoctorFixture> {
  const doctorUser = await createTestUser("doctor");
  const specialty = await createTestSpecialty();
  const location = await createTestLocation();
  const doctor = await createTestDoctor({
    specialtyId: specialty.id,
    locationId: location.id,
    profileId: doctorUser.id,
    isActive: true,
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill(doctorUser.email);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("/doctor");

  return { doctorUserId: doctorUser.id, email: doctorUser.email, doctorId: doctor.id };
}

// Returns the Jerusalem-observed calendar day, `daysAhead` days from now, as
// the numeric year/month/day parts `jerusalemWallClockToUtc` takes.
function futureJerusalemDay(daysAhead: number): { year: number; month: number; day: number } {
  const future = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const dayKey = jerusalemDayKey(future.toISOString());
  const [year, month, day] = dayKey.split("-").map(Number);
  return { year, month, day };
}

function deleteButtonName(start: Date, end: Date): string {
  return `Delete ${formatJerusalemTime(start.toISOString())} – ${formatJerusalemTime(end.toISOString())}`;
}

test.describe("AVAIL-04/AVAIL-05: doctor deletes a slot or un-blocks a period", () => {
  test.afterAll(async () => {
    await cleanupTestSlots();
    await cleanupTestReferenceData();
    await cleanupTestUsers();
  });

  test("1. AVAIL-04 through the UI: deleting an available row removes it from the list and the database", async ({
    page,
  }) => {
    const fixture = await setupLinkedDoctor(page);
    const { year, month, day } = futureJerusalemDay(20);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 10, 0);

    const [slot] = await createTestSlots(fixture.doctorId, [
      { startAt: start, endAt: end, status: "available" },
    ]);

    await page.goto("/doctor/schedule");
    await expect(page.getByText("09:00 – 10:00")).toBeVisible();

    await page.getByRole("button", { name: deleteButtonName(start, end) }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Delete this slot?" })).toBeVisible();
    await dialog.getByRole("button", { name: "Delete" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText("09:00 – 10:00")).toBeHidden();

    const admin = testAdminClient();
    const { data: row } = await admin
      .from("availability_slots")
      .select("id")
      .eq("id", slot.id)
      .maybeSingle();
    expect(row).toBeNull();
  });

  test("2. AVAIL-04 for a blocked row: the confirm dialog reads 'Remove this block?' and the row is gone afterwards", async ({
    page,
  }) => {
    const fixture = await setupLinkedDoctor(page);
    const { year, month, day } = futureJerusalemDay(21);
    const start = jerusalemWallClockToUtc(year, month, day, 14, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 18, 0);

    const [slot] = await createTestSlots(fixture.doctorId, [
      { startAt: start, endAt: end, status: "blocked" },
    ]);

    await page.goto("/doctor/schedule");
    await expect(page.getByText("14:00 – 18:00")).toBeVisible();

    await page.getByRole("button", { name: deleteButtonName(start, end) }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Remove this block?" })).toBeVisible();
    await dialog.getByRole("button", { name: "Delete" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText("14:00 – 18:00")).toBeHidden();

    const admin = testAdminClient();
    const { data: row } = await admin
      .from("availability_slots")
      .select("id")
      .eq("id", slot.id)
      .maybeSingle();
    expect(row).toBeNull();
  });

  test("3. D-02: removing a block regenerates nothing — the doctor's row count reaches exactly zero", async ({
    page,
  }) => {
    const fixture = await setupLinkedDoctor(page);
    const { year, month, day } = futureJerusalemDay(22);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 17, 0);

    const [slot] = await createTestSlots(fixture.doctorId, [
      { startAt: start, endAt: end, status: "blocked" },
    ]);

    const response = await page.request.delete(`/api/doctor/slots/${slot.id}`);
    expect(response.status()).toBe(200);

    const admin = testAdminClient();
    const { count } = await admin
      .from("availability_slots")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", fixture.doctorId);
    expect(count ?? 0).toBe(0);
  });

  test("4. AVAIL-05 at the API: a booked row is rejected with 409 and stays present", async ({ page }) => {
    const fixture = await setupLinkedDoctor(page);
    const { year, month, day } = futureJerusalemDay(23);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 10, 0);

    const [slot] = await createTestSlots(fixture.doctorId, [
      { startAt: start, endAt: end, status: "booked" },
    ]);

    const response = await page.request.delete(`/api/doctor/slots/${slot.id}`);
    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.error).toBe(BOOKED_MESSAGE);

    const admin = testAdminClient();
    const { data: row } = await admin
      .from("availability_slots")
      .select("id")
      .eq("id", slot.id)
      .maybeSingle();
    expect(row).not.toBeNull();
  });

  test("5. AVAIL-05 in the UI: a booked row exposes no Delete control while an available row on the same page does", async ({
    page,
  }) => {
    const fixture = await setupLinkedDoctor(page);
    const { year, month, day } = futureJerusalemDay(24);
    const availableStart = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const availableEnd = jerusalemWallClockToUtc(year, month, day, 10, 0);
    const bookedStart = jerusalemWallClockToUtc(year, month, day, 11, 0);
    const bookedEnd = jerusalemWallClockToUtc(year, month, day, 12, 0);

    await createTestSlots(fixture.doctorId, [
      { startAt: availableStart, endAt: availableEnd, status: "available" },
      { startAt: bookedStart, endAt: bookedEnd, status: "booked" },
    ]);

    await page.goto("/doctor/schedule");
    await expect(page.getByText("11:00 – 12:00")).toBeVisible();

    await expect(
      page.getByRole("button", { name: deleteButtonName(availableStart, availableEnd) }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: deleteButtonName(bookedStart, bookedEnd) }),
    ).toHaveCount(0);
  });

  test("6. AVAIL-05 idempotency: repeated attempts against a still-booked row yield the identical 409 every time", async ({
    page,
  }) => {
    const fixture = await setupLinkedDoctor(page);
    const { year, month, day } = futureJerusalemDay(25);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 10, 0);

    const [slot] = await createTestSlots(fixture.doctorId, [
      { startAt: start, endAt: end, status: "booked" },
    ]);

    const first = await page.request.delete(`/api/doctor/slots/${slot.id}`);
    const second = await page.request.delete(`/api/doctor/slots/${slot.id}`);

    expect(first.status()).toBe(409);
    expect(second.status()).toBe(409);
    expect((await first.json()).error).toBe(BOOKED_MESSAGE);
    expect((await second.json()).error).toBe(BOOKED_MESSAGE);
  });

  test("7. AVAIL-04 idempotency: deleting the same id twice returns success then 404, never 500", async ({
    page,
  }) => {
    const fixture = await setupLinkedDoctor(page);
    const { year, month, day } = futureJerusalemDay(26);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 10, 0);

    const [slot] = await createTestSlots(fixture.doctorId, [
      { startAt: start, endAt: end, status: "available" },
    ]);

    const first = await page.request.delete(`/api/doctor/slots/${slot.id}`);
    expect(first.status()).toBe(200);

    const second = await page.request.delete(`/api/doctor/slots/${slot.id}`);
    expect(second.status()).toBe(404);
    expect(second.status()).not.toBe(500);
    const secondBody = await second.json();
    expect(secondBody.error).toBe(NOT_FOUND_MESSAGE);
  });

  test("8. AVAIL-04 concurrency: two concurrent deletes of the same id resolve to exactly one success and one 404", async ({
    page,
  }) => {
    const fixture = await setupLinkedDoctor(page);
    const { year, month, day } = futureJerusalemDay(27);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 10, 0);

    const [slot] = await createTestSlots(fixture.doctorId, [
      { startAt: start, endAt: end, status: "available" },
    ]);

    const [first, second] = await Promise.all([
      page.request.delete(`/api/doctor/slots/${slot.id}`),
      page.request.delete(`/api/doctor/slots/${slot.id}`),
    ]);

    const statuses = [first.status(), second.status()].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 404]);
  });

  test("9. T-04-03 cross-doctor: a valid-but-foreign slot id returns 404, identical to a non-existent one, and the other doctor's row is untouched", async ({
    page,
  }) => {
    // `page` is authenticated as this doctor (doctor A) for the rest of the test.
    await setupLinkedDoctor(page);

    const otherUser = await createTestUser("doctor");
    const otherSpecialty = await createTestSpecialty();
    const otherLocation = await createTestLocation();
    const otherDoctor = await createTestDoctor({
      specialtyId: otherSpecialty.id,
      locationId: otherLocation.id,
      profileId: otherUser.id,
      isActive: true,
    });

    const { year, month, day } = futureJerusalemDay(28);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 10, 0);

    const [otherSlot] = await createTestSlots(otherDoctor.id, [
      { startAt: start, endAt: end, status: "available" },
    ]);

    // `page` is authenticated as doctor A, not `otherDoctor`.
    const response = await page.request.delete(`/api/doctor/slots/${otherSlot.id}`);
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error).toBe(NOT_FOUND_MESSAGE);

    const admin = testAdminClient();
    const { data: row } = await admin
      .from("availability_slots")
      .select("id")
      .eq("id", otherSlot.id)
      .maybeSingle();
    expect(row).not.toBeNull();
  });

  test("10. Guard: an anonymous request returns 401 and a logged-in patient returns 403, before any lookup", async ({
    page,
    request,
  }) => {
    const placeholderId = "00000000-0000-0000-0000-000000000000";

    const anonResponse = await request.delete(`/api/doctor/slots/${placeholderId}`);
    expect(anonResponse.status()).toBe(401);

    const patient = await createTestUser("patient");
    await page.goto("/login");
    await page.getByLabel("Email").fill(patient.email);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("/patient");

    const patientResponse = await page.request.delete(`/api/doctor/slots/${placeholderId}`);
    expect(patientResponse.status()).toBe(403);
  });

  test("11. UI error backstop: a row deleted out from under the page corrects itself via the live status region and a list refresh", async ({
    page,
  }) => {
    const fixture = await setupLinkedDoctor(page);
    const { year, month, day } = futureJerusalemDay(29);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 10, 0);

    const [slot] = await createTestSlots(fixture.doctorId, [
      { startAt: start, endAt: end, status: "available" },
    ]);

    await page.goto("/doctor/schedule");
    await expect(page.getByText("09:00 – 10:00")).toBeVisible();

    // Delete the row directly, out from under the already-loaded page —
    // the page's in-memory list still shows it and its Delete control.
    const admin = testAdminClient();
    await admin.from("availability_slots").delete().eq("id", slot.id);

    await page.getByRole("button", { name: deleteButtonName(start, end) }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Delete" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("status")).toHaveText(NOT_FOUND_MESSAGE);
    await expect(page.getByText("09:00 – 10:00")).toBeHidden();
  });
});
