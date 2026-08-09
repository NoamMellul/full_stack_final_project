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
import { jerusalemDayKey, jerusalemWallClockToUtc, formatJerusalemDayHeading } from "../../lib/timezone";

// AVAIL-01, AVAIL-02: a doctor adds one available slot end to end, from the
// form through the API and the database back into the list. Every fixture
// time is computed several days in the future via jerusalemWallClockToUtc so
// no test is sensitive to the day it runs (D-16's midnight-crossing note is
// irrelevant here since every fixture slot stays inside a single day).

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
// "YYYY-MM-DD" (the exact value a `type="date"` input expects), plus the
// numeric year/month/day parts `jerusalemWallClockToUtc` takes.
function futureJerusalemDay(daysAhead: number): { dayKey: string; year: number; month: number; day: number } {
  const future = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const dayKey = jerusalemDayKey(future.toISOString());
  const [year, month, day] = dayKey.split("-").map(Number);
  return { dayKey, year, month, day };
}

test.describe("AVAIL-01/AVAIL-02: doctor adds an available slot", () => {
  test.afterAll(async () => {
    await cleanupTestSlots();
    await cleanupTestReferenceData();
    await cleanupTestUsers();
  });

  test("1. AVAIL-01 through the UI: adding a slot shows it in the day-grouped list without navigation", async ({
    page,
  }) => {
    await setupLinkedDoctor(page);
    await page.goto("/doctor/schedule");

    await page.locator("main").getByRole("button", { name: "Add slot" }).click();

    const { dayKey, year, month, day } = futureJerusalemDay(10);
    const startInstant = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const heading = formatJerusalemDayHeading(startInstant.toISOString());

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Date").fill(dayKey);
    await dialog.getByLabel("Start time").fill("09:00");
    await dialog.getByLabel("End time").fill("10:00");
    await dialog.getByRole("button", { name: "Add slot" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByText("09:00 – 10:00")).toBeVisible();
    await expect(page.getByText("Available", { exact: true })).toBeVisible();
    await expect(page).toHaveURL("/doctor/schedule");
  });

  test("2. AVAIL-02: a start time in the past is rejected with 400 and the past-date message", async ({
    page,
  }) => {
    await setupLinkedDoctor(page);
    const past = new Date(Date.now() - 60 * 60 * 1000);
    const pastEnd = new Date(Date.now() - 30 * 60 * 1000);

    const response = await page.request.post("/api/doctor/slots", {
      data: { startAt: past.toISOString(), endAt: pastEnd.toISOString() },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Cannot add a slot in the past.");
  });

  test("3. AVAIL-02 boundary: a startAt at (or before) the current instant is rejected — the cutoff excludes now itself", async ({
    page,
  }) => {
    await setupLinkedDoctor(page);
    const now = new Date();
    const inOneHour = new Date(Date.now() + 60 * 60 * 1000);

    const response = await page.request.post("/api/doctor/slots", {
      data: { startAt: now.toISOString(), endAt: inOneHour.toISOString() },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Cannot add a slot in the past.");
  });

  test("4. D-09: a startAt later than its endAt is rejected with the start-before-end message", async ({
    page,
  }) => {
    await setupLinkedDoctor(page);
    const { year, month, day } = futureJerusalemDay(11);
    const start = jerusalemWallClockToUtc(year, month, day, 11, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 10, 0);

    const response = await page.request.post("/api/doctor/slots", {
      data: { startAt: start.toISOString(), endAt: end.toISOString() },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Start time must be before end time.");
  });

  test("5. Empty-field backstop: a missing endAt returns 400, not 500", async ({ page }) => {
    await setupLinkedDoctor(page);
    const { year, month, day } = futureJerusalemDay(12);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);

    const response = await page.request.post("/api/doctor/slots", {
      data: { startAt: start.toISOString() },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Start and end time are required.");
  });

  test("6. D-06/T-04-01: a forged doctorId in the body cannot redirect the write to another doctor's schedule", async ({
    page,
  }) => {
    const fixture = await setupLinkedDoctor(page);
    const otherSpecialty = await createTestSpecialty();
    const otherLocation = await createTestLocation();
    const otherDoctor = await createTestDoctor({
      specialtyId: otherSpecialty.id,
      locationId: otherLocation.id,
      isActive: true,
    });

    const { year, month, day } = futureJerusalemDay(13);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 10, 0);

    const response = await page.request.post("/api/doctor/slots", {
      data: {
        doctorId: otherDoctor.id,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();

    const admin = testAdminClient();
    const { data: createdRow } = await admin
      .from("availability_slots")
      .select("doctor_id")
      .eq("id", body.slot.id)
      .single();
    expect(createdRow?.doctor_id).toBe(fixture.doctorId);

    const { count: otherDoctorCount } = await admin
      .from("availability_slots")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", otherDoctor.id);
    expect(otherDoctorCount ?? 0).toBe(0);
  });

  test("7. D-12: the stored start_at matches jerusalemWallClockToUtc for the entered Jerusalem wall-clock time", async ({
    page,
  }) => {
    await setupLinkedDoctor(page);
    const { year, month, day } = futureJerusalemDay(14);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 10, 0);

    const response = await page.request.post("/api/doctor/slots", {
      data: { startAt: start.toISOString(), endAt: end.toISOString() },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();

    const admin = testAdminClient();
    const { data: row } = await admin
      .from("availability_slots")
      .select("start_at")
      .eq("id", body.slot.id)
      .single();

    expect(new Date(row!.start_at).toISOString()).toBe(start.toISOString());
  });

  test("8. D-15: GET omits a fully elapsed row and includes an in-progress multi-day blocked row", async ({
    page,
  }) => {
    const fixture = await setupLinkedDoctor(page);

    // The elapsed row must sit entirely outside the multi-day blocked row's
    // range below, or the two would collide on the exclusion constraint —
    // pushed to 50-49 hours ago so it never overlaps the -24h..+24h block.
    const elapsedStart = new Date(Date.now() - 50 * 60 * 60 * 1000);
    const elapsedEnd = new Date(Date.now() - 49 * 60 * 60 * 1000);
    const inProgressStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const inProgressEnd = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const [elapsed, inProgress] = await createTestSlots(fixture.doctorId, [
      { startAt: elapsedStart, endAt: elapsedEnd, status: "available" },
      { startAt: inProgressStart, endAt: inProgressEnd, status: "blocked" },
    ]);

    const response = await page.request.get("/api/doctor/slots");
    expect(response.status()).toBe(200);
    const body = await response.json();
    const ids = (body.slots as Array<{ id: string }>).map((slot) => slot.id);

    expect(ids).not.toContain(elapsed.id);
    expect(ids).toContain(inProgress.id);
  });

  test("9. D-11 smoke: an overlapping range is rejected with 409 and the exact generic overlap string", async ({
    page,
  }) => {
    const fixture = await setupLinkedDoctor(page);
    const { year, month, day } = futureJerusalemDay(15);
    const existingStart = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const existingEnd = jerusalemWallClockToUtc(year, month, day, 10, 0);

    await createTestSlots(fixture.doctorId, [
      { startAt: existingStart, endAt: existingEnd, status: "available" },
    ]);

    const overlapStart = jerusalemWallClockToUtc(year, month, day, 9, 30);
    const overlapEnd = jerusalemWallClockToUtc(year, month, day, 10, 30);

    const response = await page.request.post("/api/doctor/slots", {
      data: { startAt: overlapStart.toISOString(), endAt: overlapEnd.toISOString() },
    });

    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.error).toBe("This time overlaps your existing schedule.");
  });

  test("10. Empty state: a freshly linked doctor with no rows sees the empty-state heading", async ({
    page,
  }) => {
    await setupLinkedDoctor(page);
    await page.goto("/doctor/schedule");

    await expect(page.getByRole("heading", { name: "No upcoming availability" })).toBeVisible();
    await expect(
      page.getByText("Add a slot or block a period to build out your schedule."),
    ).toBeVisible();
  });

  test("11. Guard: an anonymous request is rejected with 401, and a logged-in patient is rejected with 403", async ({
    page,
    request,
  }) => {
    const { year, month, day } = futureJerusalemDay(16);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 10, 0);
    const body = { startAt: start.toISOString(), endAt: end.toISOString() };

    const anonResponse = await request.post("/api/doctor/slots", { data: body });
    expect(anonResponse.status()).toBe(401);

    const patient = await createTestUser("patient");
    await page.goto("/login");
    await page.getByLabel("Email").fill(patient.email);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("/patient");

    const patientResponse = await page.request.post("/api/doctor/slots", { data: body });
    expect(patientResponse.status()).toBe(403);
  });
});
