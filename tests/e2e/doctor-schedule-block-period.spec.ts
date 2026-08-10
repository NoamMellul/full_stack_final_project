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
import { formatJerusalemDayHeading, jerusalemDayKey, jerusalemWallClockToUtc } from "../../lib/timezone";

// AVAIL-06 and the blocked-period shape/reason/adjacency rules (D-03, D-04,
// AVAIL-07). Every fixture time is authored several days in the future via
// jerusalemWallClockToUtc so no case is sensitive to the day it runs, and
// every test links a fresh doctor so cases never collide with each other on
// the exclusion constraint.

const OVERLAP_MESSAGE = "This time overlaps your existing schedule.";
const PAST_MESSAGE = "Cannot block a period in the past.";
const RANGE_MESSAGE = "Start time must be before end time.";
const REQUIRED_MESSAGE = "Start and end time are required.";

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

async function blockPeriod(
  page: Page,
  body: { startAt: string; endAt: string; reason?: string | null; doctorId?: string },
) {
  return page.request.post("/api/doctor/blocked-periods", { data: body });
}

test.describe("AVAIL-06/AVAIL-07: doctor blocks a period of unavailability", () => {
  test.afterAll(async () => {
    await cleanupTestSlots();
    await cleanupTestReferenceData();
    await cleanupTestUsers();
  });

  test("1. AVAIL-06 through the UI: blocking a period with a reason shows a Blocked row under the expected day", async ({
    page,
  }) => {
    await setupLinkedDoctor(page);
    await page.goto("/doctor/schedule");

    const { dayKey, year, month, day } = futureJerusalemDay(40);
    const startInstant = jerusalemWallClockToUtc(year, month, day, 14, 0);
    const heading = formatJerusalemDayHeading(startInstant.toISOString());

    await page.locator("main").getByRole("button", { name: "Block period" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Start date").fill(dayKey);
    await dialog.getByLabel("Start time").fill("14:00");
    await dialog.getByLabel("End date").fill(dayKey);
    await dialog.getByLabel("End time").fill("18:00");
    await dialog.getByLabel("Reason (optional)").fill("Vacation");
    await dialog.getByRole("button", { name: "Block period" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByText("14:00 – 18:00")).toBeVisible();
    await expect(page.getByText("Blocked", { exact: true })).toBeVisible();
    await expect(page.getByText("Vacation")).toBeVisible();
  });

  test("2. D-03 same-day partial block: Monday 14:00-18:00 produces exactly one row", async ({ page }) => {
    const fixture = await setupLinkedDoctor(page);
    const { year, month, day } = futureJerusalemDay(41);
    const start = jerusalemWallClockToUtc(year, month, day, 14, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 18, 0);

    const response = await blockPeriod(page, { startAt: start.toISOString(), endAt: end.toISOString() });
    expect(response.status()).toBe(201);

    const admin = testAdminClient();
    const { data: rows, count } = await admin
      .from("availability_slots")
      .select("id, start_at, end_at", { count: "exact" })
      .eq("doctor_id", fixture.doctorId)
      .eq("status", "blocked");

    expect(count).toBe(1);
    expect(new Date(rows![0].start_at).toISOString()).toBe(start.toISOString());
    expect(new Date(rows![0].end_at).toISOString()).toBe(end.toISOString());
  });

  test("3. D-03 multi-day block spanning night hours: Monday 09:00 through Wednesday 18:00 produces exactly ONE row", async ({
    page,
  }) => {
    const fixture = await setupLinkedDoctor(page);
    const startDay = futureJerusalemDay(42);
    const endDay = futureJerusalemDay(44);
    const start = jerusalemWallClockToUtc(startDay.year, startDay.month, startDay.day, 9, 0);
    const end = jerusalemWallClockToUtc(endDay.year, endDay.month, endDay.day, 18, 0);

    const response = await blockPeriod(page, { startAt: start.toISOString(), endAt: end.toISOString() });
    expect(response.status()).toBe(201);

    const admin = testAdminClient();
    const { count } = await admin
      .from("availability_slots")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", fixture.doctorId)
      .eq("status", "blocked");

    // Explicitly asserting the count is 1 — the failure this guards against
    // is silent decomposition into per-day rows.
    expect(count).toBe(1);
  });

  test("4. D-03 vacation range: a seven-day 00:00-23:59 block produces exactly one row", async ({ page }) => {
    const fixture = await setupLinkedDoctor(page);
    const startDay = futureJerusalemDay(45);
    const endDay = futureJerusalemDay(51);
    const start = jerusalemWallClockToUtc(startDay.year, startDay.month, startDay.day, 0, 0);
    const end = jerusalemWallClockToUtc(endDay.year, endDay.month, endDay.day, 23, 59);

    const response = await blockPeriod(page, { startAt: start.toISOString(), endAt: end.toISOString() });
    expect(response.status()).toBe(201);

    const admin = testAdminClient();
    const { count } = await admin
      .from("availability_slots")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", fixture.doctorId)
      .eq("status", "blocked");

    expect(count).toBe(1);
  });

  test("5. D-04 no reason: an absent reason succeeds and stores null, not an empty string", async ({ page }) => {
    const fixture = await setupLinkedDoctor(page);
    const { year, month, day } = futureJerusalemDay(52);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 10, 0);

    const response = await blockPeriod(page, { startAt: start.toISOString(), endAt: end.toISOString() });
    expect(response.status()).toBe(201);
    const body = await response.json();

    const admin = testAdminClient();
    const { data: row } = await admin
      .from("availability_slots")
      .select("reason")
      .eq("id", body.slot.id)
      .eq("doctor_id", fixture.doctorId)
      .single();

    expect(row!.reason).toBeNull();
  });

  test("6. D-04 verbatim reason: a 400-character reason round-trips byte-identical and renders wrapped, un-truncated", async ({
    page,
  }) => {
    await setupLinkedDoctor(page);
    const { year, month, day } = futureJerusalemDay(53);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 10, 0);
    const longReason = "Vacation notes covering an extended leave period. ".repeat(8).slice(0, 400);
    expect(longReason.length).toBe(400);

    const response = await blockPeriod(page, {
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      reason: longReason,
    });
    expect(response.status()).toBe(201);
    const body = await response.json();

    const admin = testAdminClient();
    const { data: row } = await admin
      .from("availability_slots")
      .select("reason")
      .eq("id", body.slot.id)
      .single();
    expect(row!.reason).toBe(longReason);

    await page.goto("/doctor/schedule");
    const reasonLocator = page.getByText(longReason);
    await expect(reasonLocator).toBeVisible();
    const overflow = await reasonLocator.evaluate(
      (el) => el.scrollWidth - el.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("7. AVAIL-07 overlap: a block overlapping an existing available slot is rejected with the generic message", async ({
    page,
  }) => {
    const fixture = await setupLinkedDoctor(page);
    const { year, month, day } = futureJerusalemDay(54);
    const existingStart = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const existingEnd = jerusalemWallClockToUtc(year, month, day, 10, 0);

    await createTestSlots(fixture.doctorId, [
      { startAt: existingStart, endAt: existingEnd, status: "available" },
    ]);

    const overlapStart = jerusalemWallClockToUtc(year, month, day, 9, 30);
    const overlapEnd = jerusalemWallClockToUtc(year, month, day, 10, 30);

    const response = await blockPeriod(page, {
      startAt: overlapStart.toISOString(),
      endAt: overlapEnd.toISOString(),
    });
    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.error).toBe(OVERLAP_MESSAGE);
    expect(body.error.toLowerCase()).not.toContain("available");
    expect(body.error.toLowerCase()).not.toContain("booked");
    expect(body.error.toLowerCase()).not.toContain("blocked");
  });

  test("8. AVAIL-07 adjacency: a block touching an existing slot's endpoint (either direction) is accepted", async ({
    page,
  }) => {
    const fixtureA = await setupLinkedDoctor(page);
    const dayA = futureJerusalemDay(55);
    const existingAEnd = jerusalemWallClockToUtc(dayA.year, dayA.month, dayA.day, 12, 0);
    const existingAStart = jerusalemWallClockToUtc(dayA.year, dayA.month, dayA.day, 9, 0);
    await createTestSlots(fixtureA.doctorId, [
      { startAt: existingAStart, endAt: existingAEnd, status: "available" },
    ]);

    // A block starting exactly at the existing row's end_at is back-to-back,
    // not overlapping — `tstzrange` uses the default half-open `[)` bound.
    const blockAStart = existingAEnd;
    const blockAEnd = jerusalemWallClockToUtc(dayA.year, dayA.month, dayA.day, 14, 0);
    const responseA = await blockPeriod(page, {
      startAt: blockAStart.toISOString(),
      endAt: blockAEnd.toISOString(),
    });
    expect(responseA.status()).toBe(201);

    const fixtureB = await setupLinkedDoctor(page);
    const dayB = futureJerusalemDay(56);
    const existingBStart = jerusalemWallClockToUtc(dayB.year, dayB.month, dayB.day, 15, 0);
    const existingBEnd = jerusalemWallClockToUtc(dayB.year, dayB.month, dayB.day, 16, 0);
    await createTestSlots(fixtureB.doctorId, [
      { startAt: existingBStart, endAt: existingBEnd, status: "available" },
    ]);

    // A block ending exactly at the existing row's start_at is also
    // back-to-back and accepted.
    const blockBStart = jerusalemWallClockToUtc(dayB.year, dayB.month, dayB.day, 13, 0);
    const blockBEnd = existingBStart;
    const responseB = await blockPeriod(page, {
      startAt: blockBStart.toISOString(),
      endAt: blockBEnd.toISOString(),
    });
    expect(responseB.status()).toBe(201);
  });

  test("9. D-08: a block starting in the past is rejected with the block-specific past message", async ({
    page,
  }) => {
    await setupLinkedDoctor(page);
    const past = new Date(Date.now() - 60 * 60 * 1000);
    const pastEnd = new Date(Date.now() - 30 * 60 * 1000);

    const response = await blockPeriod(page, { startAt: past.toISOString(), endAt: pastEnd.toISOString() });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe(PAST_MESSAGE);
  });

  test("10. D-09: a startAt later than its endAt is rejected with the start-before-end message", async ({
    page,
  }) => {
    await setupLinkedDoctor(page);
    const { year, month, day } = futureJerusalemDay(57);
    const start = jerusalemWallClockToUtc(year, month, day, 11, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 10, 0);

    const response = await blockPeriod(page, { startAt: start.toISOString(), endAt: end.toISOString() });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe(RANGE_MESSAGE);
  });

  test("11. Empty-field backstop: a missing endAt returns 400, not 500", async ({ page }) => {
    await setupLinkedDoctor(page);
    const { year, month, day } = futureJerusalemDay(58);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);

    const response = await page.request.post("/api/doctor/blocked-periods", {
      data: { startAt: start.toISOString() },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe(REQUIRED_MESSAGE);
  });

  test("12. D-06/T-04-01: a forged doctorId in the body cannot redirect the block to another doctor's schedule", async ({
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

    const { year, month, day } = futureJerusalemDay(59);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 10, 0);

    const response = await blockPeriod(page, {
      doctorId: otherDoctor.id,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
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

  test("13. D-01 round trip: deleting a blocked row un-blocks it and regenerates nothing", async ({ page }) => {
    const fixture = await setupLinkedDoctor(page);
    const { year, month, day } = futureJerusalemDay(60);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 17, 0);

    const response = await blockPeriod(page, { startAt: start.toISOString(), endAt: end.toISOString() });
    expect(response.status()).toBe(201);
    const body = await response.json();

    const deleteResponse = await page.request.delete(`/api/doctor/slots/${body.slot.id}`);
    expect(deleteResponse.status()).toBe(200);

    const admin = testAdminClient();
    const { data: row } = await admin
      .from("availability_slots")
      .select("id")
      .eq("id", body.slot.id)
      .maybeSingle();
    expect(row).toBeNull();

    const { count } = await admin
      .from("availability_slots")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", fixture.doctorId);
    expect(count ?? 0).toBe(0);
  });

  test("14. Guard: an anonymous request is rejected with 401, and a logged-in patient is rejected with 403", async ({
    page,
    request,
  }) => {
    const { year, month, day } = futureJerusalemDay(61);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 10, 0);
    const body = { startAt: start.toISOString(), endAt: end.toISOString() };

    const anonResponse = await request.post("/api/doctor/blocked-periods", { data: body });
    expect(anonResponse.status()).toBe(401);

    const patient = await createTestUser("patient");
    await page.goto("/login");
    await page.getByLabel("Email").fill(patient.email);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("/patient");

    const patientResponse = await page.request.post("/api/doctor/blocked-periods", { data: body });
    expect(patientResponse.status()).toBe(403);
  });
});
