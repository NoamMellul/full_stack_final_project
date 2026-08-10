import { randomUUID } from "node:crypto";

import { expect, test, type BrowserContext } from "@playwright/test";

import { cleanupTestSlots, createTestSlots } from "./helpers/availability";
import {
  cleanupTestReferenceData,
  createTestDoctor,
  createTestLocation,
  createTestSpecialty,
} from "./helpers/reference-data";
import { testAdminClient } from "./helpers/supabase-admin";
import { testAnonClient } from "./helpers/supabase-anon";
import { cleanupTestUsers, createTestUser } from "./helpers/test-users";
import { jerusalemDayKey, jerusalemWallClockToUtc } from "../../lib/timezone";

// D-06/D-07/T-04-01/T-04-03: the ownership boundary (add, block, delete,
// list) swept in one place, plus T-04-06's public-read boundary (no
// blocked/booked row and no `reason` reaches anonymous or patient readers)
// and T-04-04's booked-row survival guarantee. Mirrors
// admin-route-protection.spec.ts's persistent-per-role-context pattern.

const NOT_FOUND_MESSAGE = "This entry no longer exists.";
const BOOKED_MESSAGE = "This slot has already been booked and can't be deleted.";
const OVERLAP_MESSAGE = "This time overlaps your existing schedule.";

type DoctorFixture = {
  doctorUserId: string;
  email: string;
  password: string;
  doctorId: string;
};

type SeededRows = {
  availableId: string;
  bookedId: string;
  blockedId: string;
  bookedStart: string;
  bookedEnd: string;
};

function futureJerusalemDay(daysAhead: number): { year: number; month: number; day: number } {
  const future = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const dayKey = jerusalemDayKey(future.toISOString());
  const [year, month, day] = dayKey.split("-").map(Number);
  return { year, month, day };
}

test.describe("Ownership boundary, reason privacy, and booked-row survival sweep", () => {
  let doctorA: DoctorFixture;
  let doctorB: DoctorFixture;
  let patientCreds: { email: string; password: string };

  let doctorAContext: BrowserContext;
  let doctorBContext: BrowserContext;
  let patientContext: BrowserContext;
  let unauthContext: BrowserContext;

  let seeded: SeededRows;
  const distinctiveReason = `visibility-sweep-${randomUUID()}`;

  async function loginInContext(
    context: BrowserContext,
    creds: { email: string; password: string },
    expectedUrl: string,
  ) {
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel("Email").fill(creds.email);
    await page.getByLabel("Password").fill(creds.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL(expectedUrl);
    await page.close();
  }

  // Re-reads doctor A's three seeded rows and asserts the set is
  // byte-identical to the values captured at seed time (case 9's repeated
  // no-side-effect assertion).
  async function assertDoctorAUnchanged() {
    const admin = testAdminClient();
    const { data: rows } = await admin
      .from("availability_slots")
      .select("id, status, start_at, end_at, reason")
      .eq("doctor_id", doctorA.doctorId)
      .order("start_at", { ascending: true });

    expect(rows?.length).toBe(3);
    const byId = new Map((rows ?? []).map((row) => [row.id, row]));

    const available = byId.get(seeded.availableId);
    expect(available?.status).toBe("available");
    expect(available?.reason).toBeNull();

    const booked = byId.get(seeded.bookedId);
    expect(booked?.status).toBe("booked");
    expect(new Date(booked!.start_at as string).toISOString()).toBe(seeded.bookedStart);
    expect(new Date(booked!.end_at as string).toISOString()).toBe(seeded.bookedEnd);

    const blocked = byId.get(seeded.blockedId);
    expect(blocked?.status).toBe("blocked");
    expect(blocked?.reason).toBe(distinctiveReason);
  }

  test.beforeAll(async ({ browser }) => {
    const doctorAUser = await createTestUser("doctor");
    const specialtyA = await createTestSpecialty();
    const locationA = await createTestLocation();
    const createdA = await createTestDoctor({
      specialtyId: specialtyA.id,
      locationId: locationA.id,
      profileId: doctorAUser.id,
      isActive: true,
    });
    doctorA = {
      doctorUserId: doctorAUser.id,
      email: doctorAUser.email,
      password: doctorAUser.password,
      doctorId: createdA.id,
    };

    const doctorBUser = await createTestUser("doctor");
    const specialtyB = await createTestSpecialty();
    const locationB = await createTestLocation();
    const createdB = await createTestDoctor({
      specialtyId: specialtyB.id,
      locationId: locationB.id,
      profileId: doctorBUser.id,
      isActive: true,
    });
    doctorB = {
      doctorUserId: doctorBUser.id,
      email: doctorBUser.email,
      password: doctorBUser.password,
      doctorId: createdB.id,
    };

    const patient = await createTestUser("patient");
    patientCreds = { email: patient.email, password: patient.password };

    // Doctor A: one row of each status, non-overlapping, several days out.
    const { year, month, day } = futureJerusalemDay(110);
    const availableStart = jerusalemWallClockToUtc(year, month, day, 8, 0);
    const availableEnd = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const bookedStart = jerusalemWallClockToUtc(year, month, day, 10, 0);
    const bookedEnd = jerusalemWallClockToUtc(year, month, day, 11, 0);
    const blockedStart = jerusalemWallClockToUtc(year, month, day, 12, 0);
    const blockedEnd = jerusalemWallClockToUtc(year, month, day, 13, 0);

    const [available, booked, blocked] = await createTestSlots(doctorA.doctorId, [
      { startAt: availableStart, endAt: availableEnd, status: "available" },
      { startAt: bookedStart, endAt: bookedEnd, status: "booked" },
      { startAt: blockedStart, endAt: blockedEnd, status: "blocked" },
    ]);

    const admin = testAdminClient();
    const { error: reasonError } = await admin
      .from("availability_slots")
      .update({ reason: distinctiveReason })
      .eq("id", blocked.id);
    expect(reasonError).toBeNull();

    seeded = {
      availableId: available.id,
      bookedId: booked.id,
      blockedId: blocked.id,
      bookedStart: bookedStart.toISOString(),
      bookedEnd: bookedEnd.toISOString(),
    };

    doctorAContext = await browser.newContext();
    doctorBContext = await browser.newContext();
    patientContext = await browser.newContext();
    unauthContext = await browser.newContext();

    await loginInContext(doctorAContext, { email: doctorA.email, password: doctorA.password }, "/doctor");
    await loginInContext(doctorBContext, { email: doctorB.email, password: doctorB.password }, "/doctor");
    await loginInContext(patientContext, patientCreds, "/patient");
  });

  test.afterAll(async () => {
    await doctorAContext?.close();
    await doctorBContext?.close();
    await patientContext?.close();
    await unauthContext?.close();
    await cleanupTestSlots();
    await cleanupTestReferenceData();
    await cleanupTestUsers();
  });

  test("1. Write sweep, forged doctor id: Doctor B's writes with Doctor A's id in the body land on Doctor B's own schedule", async () => {
    const { year, month, day } = futureJerusalemDay(111);
    const slotStart = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const slotEnd = jerusalemWallClockToUtc(year, month, day, 10, 0);
    const blockStart = jerusalemWallClockToUtc(year, month, day, 11, 0);
    const blockEnd = jerusalemWallClockToUtc(year, month, day, 12, 0);

    const admin = testAdminClient();
    const { count: beforeCount } = await admin
      .from("availability_slots")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", doctorA.doctorId);

    const slotResponse = await doctorBContext.request.post("/api/doctor/slots", {
      data: { doctorId: doctorA.doctorId, startAt: slotStart.toISOString(), endAt: slotEnd.toISOString() },
    });
    expect(slotResponse.status()).toBe(201);
    const slotBody = await slotResponse.json();

    const blockResponse = await doctorBContext.request.post("/api/doctor/blocked-periods", {
      data: { doctorId: doctorA.doctorId, startAt: blockStart.toISOString(), endAt: blockEnd.toISOString() },
    });
    expect(blockResponse.status()).toBe(201);
    const blockBody = await blockResponse.json();

    const { data: createdSlot } = await admin
      .from("availability_slots")
      .select("doctor_id")
      .eq("id", slotBody.slot.id)
      .single();
    expect(createdSlot?.doctor_id).toBe(doctorB.doctorId);

    const { data: createdBlock } = await admin
      .from("availability_slots")
      .select("doctor_id")
      .eq("id", blockBody.slot.id)
      .single();
    expect(createdBlock?.doctor_id).toBe(doctorB.doctorId);

    const { count: afterCount } = await admin
      .from("availability_slots")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", doctorA.doctorId);
    expect(afterCount).toBe(beforeCount);

    // Clean up the two rows this test created on Doctor B's schedule so they
    // cannot collide with a later case.
    await admin.from("availability_slots").delete().eq("id", slotBody.slot.id);
    await admin.from("availability_slots").delete().eq("id", blockBody.slot.id);
  });

  test("2. Delete sweep, foreign slot id: Doctor B deleting any of Doctor A's three rows gets the identical 404, and all three survive", async () => {
    for (const id of [seeded.availableId, seeded.bookedId, seeded.blockedId]) {
      const response = await doctorBContext.request.delete(`/api/doctor/slots/${id}`);
      expect(response.status(), id).toBe(404);
      const body = await response.json();
      expect(body.error).toBe(NOT_FOUND_MESSAGE);
    }

    await assertDoctorAUnchanged();
  });

  test("3. Read isolation: Doctor B's GET never includes one of Doctor A's ids or the distinctive reason string", async () => {
    const response = await doctorBContext.request.get("/api/doctor/slots");
    expect(response.status()).toBe(200);
    const rawText = await response.text();

    expect(rawText).not.toContain(seeded.availableId);
    expect(rawText).not.toContain(seeded.bookedId);
    expect(rawText).not.toContain(seeded.blockedId);
    expect(rawText).not.toContain(distinctiveReason);
  });

  test("4. Anonymous read of the table: only Doctor A's available row is visible, with no reason value", async () => {
    const anon = testAnonClient();
    const { data, error } = await anon
      .from("availability_slots")
      .select("id, status, reason")
      .eq("doctor_id", doctorA.doctorId);

    expect(error).toBeNull();
    const rows = data ?? [];
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe(seeded.availableId);
    expect(rows[0].status).toBe("available");
    for (const row of rows) {
      expect(row.status).not.toBe("blocked");
      expect(row.status).not.toBe("booked");
      expect(row.reason).not.toBe(distinctiveReason);
    }
  });

  test("5. Patient read of the table: the same outcome as the anonymous read — only the available row, no reason value", async () => {
    const patientClient = testAnonClient();
    const { error: signInError } = await patientClient.auth.signInWithPassword(patientCreds);
    expect(signInError).toBeNull();

    const { data, error } = await patientClient
      .from("availability_slots")
      .select("id, status, reason")
      .eq("doctor_id", doctorA.doctorId);

    expect(error).toBeNull();
    const rows = data ?? [];
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe(seeded.availableId);
    expect(rows[0].status).toBe("available");
    for (const row of rows) {
      expect(row.status).not.toBe("blocked");
      expect(row.status).not.toBe("booked");
      expect(row.reason).not.toBe(distinctiveReason);
    }
  });

  test("6. Anonymous and patient write attempts against Doctor A's schedule all fail, leaving Doctor A's rows unchanged", async () => {
    const { year, month, day } = futureJerusalemDay(112);
    const forgedStart = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const forgedEnd = jerusalemWallClockToUtc(year, month, day, 10, 0);

    const anon = testAnonClient();
    const patientClient = testAnonClient();
    const { error: signInError } = await patientClient.auth.signInWithPassword(patientCreds);
    expect(signInError).toBeNull();

    const { error: anonInsertError } = await anon.from("availability_slots").insert({
      doctor_id: doctorA.doctorId,
      start_at: forgedStart.toISOString(),
      end_at: forgedEnd.toISOString(),
      status: "available",
    });
    expect(anonInsertError).not.toBeNull();

    const { error: patientInsertError } = await patientClient.from("availability_slots").insert({
      doctor_id: doctorA.doctorId,
      start_at: forgedStart.toISOString(),
      end_at: forgedEnd.toISOString(),
      status: "available",
    });
    expect(patientInsertError).not.toBeNull();

    const { data: anonDeleteResult } = await anon
      .from("availability_slots")
      .delete()
      .eq("id", seeded.bookedId)
      .select("id");
    expect(anonDeleteResult ?? []).toHaveLength(0);

    const { data: patientDeleteResult } = await patientClient
      .from("availability_slots")
      .delete()
      .eq("id", seeded.bookedId)
      .select("id");
    expect(patientDeleteResult ?? []).toHaveLength(0);

    await assertDoctorAUnchanged();
  });

  test("7. Booked-row survival: every write path this phase exposes against Doctor A's own booked row is rejected, and the row is unchanged", async () => {
    const deleteResponse = await doctorAContext.request.delete(`/api/doctor/slots/${seeded.bookedId}`);
    expect(deleteResponse.status()).toBe(409);
    expect((await deleteResponse.json()).error).toBe(BOOKED_MESSAGE);

    const addSlotResponse = await doctorAContext.request.post("/api/doctor/slots", {
      data: { startAt: seeded.bookedStart, endAt: seeded.bookedEnd },
    });
    expect(addSlotResponse.status()).toBe(409);
    expect((await addSlotResponse.json()).error).toBe(OVERLAP_MESSAGE);

    const blockResponse = await doctorAContext.request.post("/api/doctor/blocked-periods", {
      data: { startAt: seeded.bookedStart, endAt: seeded.bookedEnd },
    });
    expect(blockResponse.status()).toBe(409);
    expect((await blockResponse.json()).error).toBe(OVERLAP_MESSAGE);

    await assertDoctorAUnchanged();
  });

  test("8. Guard sweep: anonymous requests to all four route handlers return 401, and patient requests return 403", async () => {
    const { year, month, day } = futureJerusalemDay(113);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 10, 0);
    const placeholderId = "00000000-0000-0000-0000-000000000000";

    const descriptors: Array<{
      label: string;
      call: (context: BrowserContext) => Promise<{ status(): number }>;
    }> = [
      {
        label: "GET /api/doctor/slots",
        call: (context) => context.request.get("/api/doctor/slots"),
      },
      {
        label: "POST /api/doctor/slots",
        call: (context) =>
          context.request.post("/api/doctor/slots", {
            data: { startAt: start.toISOString(), endAt: end.toISOString() },
          }),
      },
      {
        label: "DELETE /api/doctor/slots/{id}",
        call: (context) => context.request.delete(`/api/doctor/slots/${placeholderId}`),
      },
      {
        label: "POST /api/doctor/blocked-periods",
        call: (context) =>
          context.request.post("/api/doctor/blocked-periods", {
            data: { startAt: start.toISOString(), endAt: end.toISOString() },
          }),
      },
    ];

    for (const descriptor of descriptors) {
      const unauthResponse = await descriptor.call(unauthContext);
      expect(unauthResponse.status(), `${descriptor.label} (unauthenticated)`).toBe(401);

      const patientResponse = await descriptor.call(patientContext);
      expect(patientResponse.status(), `${descriptor.label} (patient)`).toBe(403);
    }

    await assertDoctorAUnchanged();
  });

  test("9. No side effect after the sweep: Doctor A's full row set is byte-identical to its seeded state", async () => {
    await assertDoctorAUnchanged();
  });
});
