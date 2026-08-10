import { expect, test, type Page } from "@playwright/test";

import { cleanupTestSlots, createTestSlots, type TestSlotStatus } from "./helpers/availability";
import {
  cleanupTestReferenceData,
  createTestDoctor,
  createTestLocation,
  createTestSpecialty,
} from "./helpers/reference-data";
import { testAdminClient } from "./helpers/supabase-admin";
import { cleanupTestUsers, createTestUser, TEST_PASSWORD } from "./helpers/test-users";
import { jerusalemDayKey, jerusalemWallClockToUtc } from "../../lib/timezone";

// AVAIL-03/AVAIL-07: proves the `availability_slots_no_overlap` GiST
// exclusion constraint — not an application-level pre-check — is what
// actually prevents two overlapping writes, under real concurrency and
// across every status pairing in both directions. Every fixture time is
// authored several days in the future via jerusalemWallClockToUtc, and every
// test links a fresh doctor (or gives itself a private slice of the
// calendar), so a leftover row from a previous case can never make a later
// case pass or fail for the wrong reason (playwright.config.ts runs
// fullyParallel: false / workers: 1, so ordering within this file is stable).

const REQUIRED_MESSAGE = "Start and end time are required.";

// Populated by every case that captures a 409 overlap-rejection body (cases
// 1-3 and the six-direction status matrix in case 6), then compared
// pairwise — never against a separate literal — by case 7.
const capturedOverlapBodies: string[] = [];

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

async function addSlot(page: Page, body: Record<string, unknown>) {
  return page.request.post("/api/doctor/slots", { data: body });
}

async function blockPeriod(page: Page, body: Record<string, unknown>) {
  return page.request.post("/api/doctor/blocked-periods", { data: body });
}

async function doctorRowCount(doctorId: string): Promise<number> {
  const admin = testAdminClient();
  const { count } = await admin
    .from("availability_slots")
    .select("*", { count: "exact", head: true })
    .eq("doctor_id", doctorId);
  return count ?? 0;
}

test.describe("AVAIL-03/AVAIL-07: the exclusion constraint under concurrency and every status pairing", () => {
  test.afterAll(async () => {
    await cleanupTestSlots();
    await cleanupTestReferenceData();
    await cleanupTestUsers();
  });

  test("1. Concurrency, add-slot path: two identical concurrent POSTs resolve to exactly one 201 and one 409", async ({
    page,
  }) => {
    const fixture = await setupLinkedDoctor(page);
    const { year, month, day } = futureJerusalemDay(70);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 10, 0);
    const body = { startAt: start.toISOString(), endAt: end.toISOString() };

    const [responseA, responseB] = await Promise.all([addSlot(page, body), addSlot(page, body)]);
    const statuses = [responseA.status(), responseB.status()].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);

    expect(await doctorRowCount(fixture.doctorId)).toBe(1);

    const results = [
      { status: responseA.status(), body: await responseA.json() },
      { status: responseB.status(), body: await responseB.json() },
    ];
    const rejected = results.find((r) => r.status === 409);
    capturedOverlapBodies.push(rejected!.body.error);
  });

  test("2. Concurrency, cross-path: one add-slot and one block-period POST for the same range resolve to exactly one 201 and one 409", async ({
    page,
  }) => {
    const fixture = await setupLinkedDoctor(page);
    const { year, month, day } = futureJerusalemDay(71);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 10, 0);
    const body = { startAt: start.toISOString(), endAt: end.toISOString() };

    const [slotResponse, blockResponse] = await Promise.all([
      addSlot(page, body),
      blockPeriod(page, body),
    ]);
    const statuses = [slotResponse.status(), blockResponse.status()].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);

    expect(await doctorRowCount(fixture.doctorId)).toBe(1);

    const results = [
      { status: slotResponse.status(), body: await slotResponse.json() },
      { status: blockResponse.status(), body: await blockResponse.json() },
    ];
    const rejected = results.find((r) => r.status === 409);
    capturedOverlapBodies.push(rejected!.body.error);
  });

  test("3. Duplicate submission idempotency: the identical add-slot body submitted twice sequentially yields 201 then 409, exactly one row", async ({
    page,
  }) => {
    const fixture = await setupLinkedDoctor(page);
    const { year, month, day } = futureJerusalemDay(72);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 10, 0);
    const body = { startAt: start.toISOString(), endAt: end.toISOString() };

    const first = await addSlot(page, body);
    expect(first.status()).toBe(201);

    const second = await addSlot(page, body);
    expect(second.status()).toBe(409);
    const secondBody = await second.json();
    capturedOverlapBodies.push(secondBody.error);

    expect(await doctorRowCount(fixture.doctorId)).toBe(1);
  });

  test("4. Adjacency, start touching end: a new range starting exactly at an existing row's end is accepted on both write paths", async ({
    page,
  }) => {
    const fixtureA = await setupLinkedDoctor(page);
    const dayA = futureJerusalemDay(73);
    const existingAStart = jerusalemWallClockToUtc(dayA.year, dayA.month, dayA.day, 9, 0);
    const existingAEnd = jerusalemWallClockToUtc(dayA.year, dayA.month, dayA.day, 10, 0);
    await createTestSlots(fixtureA.doctorId, [
      { startAt: existingAStart, endAt: existingAEnd, status: "available" },
    ]);

    const newAStart = existingAEnd;
    const newAEnd = jerusalemWallClockToUtc(dayA.year, dayA.month, dayA.day, 11, 0);
    const responseA = await addSlot(page, {
      startAt: newAStart.toISOString(),
      endAt: newAEnd.toISOString(),
    });
    expect(responseA.status()).toBe(201);

    const fixtureB = await setupLinkedDoctor(page);
    const dayB = futureJerusalemDay(74);
    const existingBStart = jerusalemWallClockToUtc(dayB.year, dayB.month, dayB.day, 9, 0);
    const existingBEnd = jerusalemWallClockToUtc(dayB.year, dayB.month, dayB.day, 10, 0);
    await createTestSlots(fixtureB.doctorId, [
      { startAt: existingBStart, endAt: existingBEnd, status: "available" },
    ]);

    const newBStart = existingBEnd;
    const newBEnd = jerusalemWallClockToUtc(dayB.year, dayB.month, dayB.day, 11, 0);
    const responseB = await blockPeriod(page, {
      startAt: newBStart.toISOString(),
      endAt: newBEnd.toISOString(),
    });
    expect(responseB.status()).toBe(201);
  });

  test("5. Adjacency, end touching start: a new range ending exactly at an existing row's start is accepted on both write paths", async ({
    page,
  }) => {
    const fixtureA = await setupLinkedDoctor(page);
    const dayA = futureJerusalemDay(75);
    const existingAStart = jerusalemWallClockToUtc(dayA.year, dayA.month, dayA.day, 14, 0);
    const existingAEnd = jerusalemWallClockToUtc(dayA.year, dayA.month, dayA.day, 15, 0);
    await createTestSlots(fixtureA.doctorId, [
      { startAt: existingAStart, endAt: existingAEnd, status: "available" },
    ]);

    const newAStart = jerusalemWallClockToUtc(dayA.year, dayA.month, dayA.day, 13, 0);
    const newAEnd = existingAStart;
    const responseA = await addSlot(page, {
      startAt: newAStart.toISOString(),
      endAt: newAEnd.toISOString(),
    });
    expect(responseA.status()).toBe(201);

    const fixtureB = await setupLinkedDoctor(page);
    const dayB = futureJerusalemDay(76);
    const existingBStart = jerusalemWallClockToUtc(dayB.year, dayB.month, dayB.day, 14, 0);
    const existingBEnd = jerusalemWallClockToUtc(dayB.year, dayB.month, dayB.day, 15, 0);
    await createTestSlots(fixtureB.doctorId, [
      { startAt: existingBStart, endAt: existingBEnd, status: "available" },
    ]);

    const newBStart = jerusalemWallClockToUtc(dayB.year, dayB.month, dayB.day, 13, 0);
    const newBEnd = existingBStart;
    const responseB = await blockPeriod(page, {
      startAt: newBStart.toISOString(),
      endAt: newBEnd.toISOString(),
    });
    expect(responseB.status()).toBe(201);
  });

  test("6. Status matrix: every direction/status pairing is rejected 409 with the generic message", async ({
    page,
  }) => {
    const fixture = await setupLinkedDoctor(page);

    const directions: Array<{
      label: string;
      newStatus: "available" | "blocked";
      existingStatus: TestSlotStatus;
    }> = [
      { label: "available over available", newStatus: "available", existingStatus: "available" },
      { label: "available over blocked", newStatus: "available", existingStatus: "blocked" },
      { label: "available over booked", newStatus: "available", existingStatus: "booked" },
      { label: "blocked over available", newStatus: "blocked", existingStatus: "available" },
      { label: "blocked over booked", newStatus: "blocked", existingStatus: "booked" },
      { label: "blocked over blocked", newStatus: "blocked", existingStatus: "blocked" },
    ];

    let dayOffset = 80;
    for (const direction of directions) {
      const { year, month, day } = futureJerusalemDay(dayOffset++);
      const existingStart = jerusalemWallClockToUtc(year, month, day, 9, 0);
      const existingEnd = jerusalemWallClockToUtc(year, month, day, 10, 0);
      await createTestSlots(fixture.doctorId, [
        { startAt: existingStart, endAt: existingEnd, status: direction.existingStatus },
      ]);

      const overlapStart = jerusalemWallClockToUtc(year, month, day, 9, 30);
      const overlapEnd = jerusalemWallClockToUtc(year, month, day, 10, 30);
      const body = { startAt: overlapStart.toISOString(), endAt: overlapEnd.toISOString() };

      const response =
        direction.newStatus === "available"
          ? await addSlot(page, body)
          : await blockPeriod(page, body);

      expect(response.status(), direction.label).toBe(409);
      const respBody = await response.json();
      capturedOverlapBodies.push(respBody.error);
    }
  });

  test("7. Message uniformity: every captured 409 body across cases 1-3 and the status matrix is byte-identical", async () => {
    // 3 (cases 1-3) + 6 (case 6's six directions) = 9 captured bodies.
    expect(capturedOverlapBodies.length).toBe(9);

    const [first, ...rest] = capturedOverlapBodies;
    for (const message of rest) {
      expect(message).toBe(first);
    }
  });

  test("8. No side effect on rejection: a doctor's row count is unchanged after a rejected overlap request", async ({
    page,
  }) => {
    const fixture = await setupLinkedDoctor(page);
    const { year, month, day } = futureJerusalemDay(90);
    const existingStart = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const existingEnd = jerusalemWallClockToUtc(year, month, day, 10, 0);
    await createTestSlots(fixture.doctorId, [
      { startAt: existingStart, endAt: existingEnd, status: "available" },
    ]);

    const before = await doctorRowCount(fixture.doctorId);

    const overlapStart = jerusalemWallClockToUtc(year, month, day, 9, 30);
    const overlapEnd = jerusalemWallClockToUtc(year, month, day, 10, 30);
    const response = await addSlot(page, {
      startAt: overlapStart.toISOString(),
      endAt: overlapEnd.toISOString(),
    });
    expect(response.status()).toBe(409);

    const after = await doctorRowCount(fixture.doctorId);
    expect(after).toBe(before);
  });

  test("9. Partial overlap shapes: every containment shape is rejected 409", async ({ page }) => {
    const fixture = await setupLinkedDoctor(page);
    const { year, month, day } = futureJerusalemDay(95);
    const existingStart = jerusalemWallClockToUtc(year, month, day, 10, 0);
    const existingEnd = jerusalemWallClockToUtc(year, month, day, 14, 0);
    await createTestSlots(fixture.doctorId, [
      { startAt: existingStart, endAt: existingEnd, status: "available" },
    ]);

    const shapes = [
      {
        label: "strictly inside",
        start: jerusalemWallClockToUtc(year, month, day, 11, 0),
        end: jerusalemWallClockToUtc(year, month, day, 12, 0),
      },
      {
        label: "strictly containing",
        start: jerusalemWallClockToUtc(year, month, day, 9, 0),
        end: jerusalemWallClockToUtc(year, month, day, 15, 0),
      },
      {
        label: "leading edge overlap",
        start: jerusalemWallClockToUtc(year, month, day, 9, 0),
        end: jerusalemWallClockToUtc(year, month, day, 11, 0),
      },
      {
        label: "trailing edge overlap",
        start: jerusalemWallClockToUtc(year, month, day, 13, 0),
        end: jerusalemWallClockToUtc(year, month, day, 15, 0),
      },
    ];

    for (const shape of shapes) {
      const response = await addSlot(page, {
        startAt: shape.start.toISOString(),
        endAt: shape.end.toISOString(),
      });
      expect(response.status(), shape.label).toBe(409);
    }
  });

  test("10. Malformed body backstop: missing endAt and null startAt return 400 on both write paths, never 500, no row created", async ({
    page,
  }) => {
    const fixture = await setupLinkedDoctor(page);
    const { year, month, day } = futureJerusalemDay(100);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);

    const missingEndAtSlot = await addSlot(page, { startAt: start.toISOString() });
    expect(missingEndAtSlot.status()).toBe(400);
    expect((await missingEndAtSlot.json()).error).toBe(REQUIRED_MESSAGE);

    const nullStartAtSlot = await addSlot(page, {
      startAt: null,
      endAt: start.toISOString(),
    });
    expect(nullStartAtSlot.status()).toBe(400);
    expect((await nullStartAtSlot.json()).error).toBe(REQUIRED_MESSAGE);

    const missingEndAtBlock = await blockPeriod(page, { startAt: start.toISOString() });
    expect(missingEndAtBlock.status()).toBe(400);
    expect((await missingEndAtBlock.json()).error).toBe(REQUIRED_MESSAGE);

    const nullStartAtBlock = await blockPeriod(page, {
      startAt: null,
      endAt: start.toISOString(),
    });
    expect(nullStartAtBlock.status()).toBe(400);
    expect((await nullStartAtBlock.json()).error).toBe(REQUIRED_MESSAGE);

    expect(await doctorRowCount(fixture.doctorId)).toBe(0);
  });

  test("11. Cross-doctor non-collision: a second doctor's identical range does not block the first doctor's own request", async ({
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

    const { year, month, day } = futureJerusalemDay(101);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 10, 0);

    await createTestSlots(otherDoctor.id, [{ startAt: start, endAt: end, status: "available" }]);

    const response = await addSlot(page, {
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    });
    expect(response.status()).toBe(201);

    expect(await doctorRowCount(fixture.doctorId)).toBe(1);
  });
});
