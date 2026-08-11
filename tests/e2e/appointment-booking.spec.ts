import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { cleanupTestAppointments, createTestAppointment } from "./helpers/appointments";
import { cleanupTestSlots, createTestSlots } from "./helpers/availability";
import {
  cleanupTestReferenceData,
  createTestDoctor,
  createTestLocation,
  createTestSpecialty,
} from "./helpers/reference-data";
import { testAdminClient } from "./helpers/supabase-admin";
import { cleanupTestUsers, createTestUser } from "./helpers/test-users";
import { formatJerusalemDayHeading, jerusalemDayKey, jerusalemWallClockToUtc } from "../../lib/timezone";

// APPT-01 through APPT-04 and APPT-10/APPT-11: the whole booking path proven
// end to end, from the doctor profile's confirmation dialog through
// book_appointment()'s conditional UPDATE and back into the patient's own
// appointment list. Every fixture time is authored several days in the
// future via jerusalemWallClockToUtc so no case is sensitive to the day it
// runs (playwright.config.ts runs fullyParallel: false / workers: 1, so
// ordering within this file is stable).

const GENERIC_SLOT_MESSAGE = "This slot is no longer available. Please choose another.";

// Appointments created directly through the routes under test (not via
// helpers/appointments.ts's createTestAppointment fixture) are tracked here
// so they can be deleted before their slot/doctor/patient rows — every FK on
// `appointments` is ON DELETE RESTRICT.
const apiBookedAppointmentIds: string[] = [];

async function cleanupApiBookedAppointments(): Promise<void> {
  const admin = testAdminClient();
  const ids = apiBookedAppointmentIds.splice(0, apiBookedAppointmentIds.length);
  for (const id of ids) {
    try {
      await admin.from("appointments").delete().eq("id", id);
    } catch {
      // Swallow individual failures so one dead id cannot abort the rest.
    }
  }
}

function futureJerusalemDay(daysAhead: number): { year: number; month: number; day: number } {
  const future = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const dayKey = jerusalemDayKey(future.toISOString());
  const [year, month, day] = dayKey.split("-").map(Number);
  return { year, month, day };
}

async function loginAsPatient(page: Page, creds: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("/patient");
}

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

async function activeSlotCount(slotId: string): Promise<number> {
  const admin = testAdminClient();
  const { count } = await admin
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .eq("slot_id", slotId)
    .neq("status", "cancelled_by_patient")
    .neq("status", "cancelled_by_doctor");
  return count ?? 0;
}

test.describe("APPT-01/APPT-02/APPT-03/APPT-04/APPT-10/APPT-11: booking end to end", () => {
  test.afterAll(async () => {
    await cleanupApiBookedAppointments();
    await cleanupTestAppointments();
    await cleanupTestSlots();
    await cleanupTestReferenceData();
    await cleanupTestUsers();
  });

  test("1. APPT-01: a patient books one slot end to end through the confirmation dialog", async ({
    page,
  }) => {
    const patient = await createTestUser("patient");
    const specialty = await createTestSpecialty();
    const location = await createTestLocation({ address: "1 Test St" });
    const doctor = await createTestDoctor({
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });
    const { year, month, day } = futureJerusalemDay(60);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 9, 30);
    const [slot] = await createTestSlots(doctor.id, [{ startAt: start, endAt: end }]);

    await loginAsPatient(page, patient);
    await page.goto(`/doctors/${doctor.id}`);
    await page.getByRole("button", { name: "Select this slot" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Confirm your appointment" })).toBeVisible();
    await expect(dialog.getByText(doctor.fullName)).toBeVisible();
    await expect(dialog.getByText(specialty.nameEn)).toBeVisible();
    await expect(
      dialog.getByText(formatJerusalemDayHeading(start.toISOString()), { exact: false }),
    ).toBeVisible();
    await expect(dialog.getByText("09:00", { exact: false })).toBeVisible();
    await expect(dialog.getByText("1 Test St", { exact: false })).toBeVisible();

    await dialog.getByRole("button", { name: "Confirm booking" }).click();

    await page.waitForURL(/\/patient\/appointments\?booked=1/);
    await expect(page.getByText("Your appointment has been booked successfully.")).toBeVisible();
    await expect(
      page.getByTestId("upcoming-section").locator('[data-slot="badge"]', { hasText: "Confirmed" }),
    ).toBeVisible();

    const admin = testAdminClient();
    const { data: appointmentRow } = await admin
      .from("appointments")
      .select("id")
      .eq("slot_id", slot.id)
      .single();
    if (appointmentRow) apiBookedAppointmentIds.push(appointmentRow.id);
  });

  test("2. APPT-02 concurrency: two concurrent bookings of the same slot resolve to exactly one 201 and one 409", async ({
    browser,
  }) => {
    const patientA = await createTestUser("patient");
    const patientB = await createTestUser("patient");
    const specialty = await createTestSpecialty();
    const location = await createTestLocation();
    const doctor = await createTestDoctor({
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });
    const { year, month, day } = futureJerusalemDay(61);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 9, 30);
    const [slot] = await createTestSlots(doctor.id, [{ startAt: start, endAt: end }]);

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    await loginInContext(contextA, patientA, "/patient");
    await loginInContext(contextB, patientB, "/patient");

    const [responseA, responseB] = await Promise.all([
      contextA.request.post("/api/appointments", { data: { slotId: slot.id } }),
      contextB.request.post("/api/appointments", { data: { slotId: slot.id } }),
    ]);

    const statuses = [responseA.status(), responseB.status()].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);

    const results = [
      { status: responseA.status(), body: await responseA.json() },
      { status: responseB.status(), body: await responseB.json() },
    ];
    const accepted = results.find((r) => r.status === 201)!;
    const rejected = results.find((r) => r.status === 409)!;
    expect(rejected.body.error).toBe(GENERIC_SLOT_MESSAGE);
    apiBookedAppointmentIds.push(accepted.body.appointment.id);

    expect(await activeSlotCount(slot.id)).toBe(1);

    await contextA.close();
    await contextB.close();
  });

  test("3. APPT-02 same-patient duplicate: an identical booking posted twice sequentially returns 201 then 409", async ({
    page,
  }) => {
    const patient = await createTestUser("patient");
    const specialty = await createTestSpecialty();
    const location = await createTestLocation();
    const doctor = await createTestDoctor({
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });
    const { year, month, day } = futureJerusalemDay(62);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 9, 30);
    const [slot] = await createTestSlots(doctor.id, [{ startAt: start, endAt: end }]);

    await loginAsPatient(page, patient);

    const firstResponse = await page.request.post("/api/appointments", {
      data: { slotId: slot.id },
    });
    expect(firstResponse.status()).toBe(201);
    apiBookedAppointmentIds.push((await firstResponse.json()).appointment.id);

    const secondResponse = await page.request.post("/api/appointments", {
      data: { slotId: slot.id },
    });
    expect(secondResponse.status()).toBe(409);
    expect((await secondResponse.json()).error).toBe(GENERIC_SLOT_MESSAGE);

    expect(await activeSlotCount(slot.id)).toBe(1);
  });

  test("4. APPT-03: booking a slot whose start_at is in the past is rejected with the generic slot message", async ({
    page,
  }) => {
    const patient = await createTestUser("patient");
    const specialty = await createTestSpecialty();
    const location = await createTestLocation();
    const doctor = await createTestDoctor({
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });
    const pastStart = new Date(Date.now() - 60 * 60 * 1000);
    const pastEnd = new Date(Date.now() - 30 * 60 * 1000);
    const [slot] = await createTestSlots(doctor.id, [{ startAt: pastStart, endAt: pastEnd }]);

    await loginAsPatient(page, patient);
    const response = await page.request.post("/api/appointments", { data: { slotId: slot.id } });
    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe(GENERIC_SLOT_MESSAGE);
    expect(await activeSlotCount(slot.id)).toBe(0);
  });

  test("5. APPT-04: a successful booking immediately removes the slot from the doctor's public availability", async ({
    page,
  }) => {
    const patient = await createTestUser("patient");
    const specialty = await createTestSpecialty();
    const location = await createTestLocation();
    const doctor = await createTestDoctor({
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });
    const { year, month, day } = futureJerusalemDay(63);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 9, 30);
    const [slot] = await createTestSlots(doctor.id, [{ startAt: start, endAt: end }]);

    await loginAsPatient(page, patient);
    const bookResponse = await page.request.post("/api/appointments", {
      data: { slotId: slot.id },
    });
    expect(bookResponse.status()).toBe(201);
    apiBookedAppointmentIds.push((await bookResponse.json()).appointment.id);

    const profileResponse = await page.request.get(`/api/doctors/${doctor.id}`);
    const profileBody = await profileResponse.json();
    const slotIds = (profileBody.upcomingSlots as Array<{ id: string }>).map((s) => s.id);
    expect(slotIds).not.toContain(slot.id);

    const admin = testAdminClient();
    const { data: row } = await admin
      .from("availability_slots")
      .select("status")
      .eq("id", slot.id)
      .single();
    expect(row?.status).toBe("booked");
  });

  test("6. D-19: booking a slot belonging to an inactive doctor is rejected with the generic slot message", async ({
    page,
  }) => {
    const patient = await createTestUser("patient");
    const specialty = await createTestSpecialty();
    const location = await createTestLocation();
    const doctor = await createTestDoctor({
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: false,
    });
    const { year, month, day } = futureJerusalemDay(64);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 9, 30);
    const [slot] = await createTestSlots(doctor.id, [{ startAt: start, endAt: end }]);

    await loginAsPatient(page, patient);
    const response = await page.request.post("/api/appointments", { data: { slotId: slot.id } });
    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe(GENERIC_SLOT_MESSAGE);
    expect(await activeSlotCount(slot.id)).toBe(0);
  });

  test("7. D-19/D-20 role guards: an anonymous caller gets 401, a doctor and an admin each get 403", async ({
    request,
    browser,
  }) => {
    const specialty = await createTestSpecialty();
    const location = await createTestLocation();
    const doctor = await createTestDoctor({
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });
    const { year, month, day } = futureJerusalemDay(66);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 9, 30);
    const [slot] = await createTestSlots(doctor.id, [{ startAt: start, endAt: end }]);

    const anonResponse = await request.post("/api/appointments", { data: { slotId: slot.id } });
    expect(anonResponse.status()).toBe(401);

    const doctorUser = await createTestUser("doctor");
    const doctorContext = await browser.newContext();
    await loginInContext(doctorContext, doctorUser, "/doctor");
    const doctorResponse = await doctorContext.request.post("/api/appointments", {
      data: { slotId: slot.id },
    });
    expect(doctorResponse.status()).toBe(403);
    await doctorContext.close();

    const adminUser = await createTestUser("admin");
    const adminContext = await browser.newContext();
    await loginInContext(adminContext, adminUser, "/admin");
    const adminResponse = await adminContext.request.post("/api/appointments", {
      data: { slotId: slot.id },
    });
    expect(adminResponse.status()).toBe(403);
    await adminContext.close();

    expect(await activeSlotCount(slot.id)).toBe(0);
  });

  test("8. T-05-02: a forged patientId in the body has no effect on which patient the row belongs to", async ({
    page,
  }) => {
    const patientA = await createTestUser("patient");
    const patientB = await createTestUser("patient");
    const specialty = await createTestSpecialty();
    const location = await createTestLocation();
    const doctor = await createTestDoctor({
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });
    const { year, month, day } = futureJerusalemDay(67);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 9, 30);
    const [slot] = await createTestSlots(doctor.id, [{ startAt: start, endAt: end }]);

    await loginAsPatient(page, patientA);
    const response = await page.request.post("/api/appointments", {
      data: { slotId: slot.id, patientId: patientB.id },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    apiBookedAppointmentIds.push(body.appointment.id);

    const admin = testAdminClient();
    const { data: row } = await admin
      .from("appointments")
      .select("patient_id")
      .eq("id", body.appointment.id)
      .single();
    expect(row?.patient_id).toBe(patientA.id);

    const { count: patientBCount } = await admin
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("patient_id", patientB.id);
    expect(patientBCount).toBe(0);
  });

  test("9. Validation backstop: a missing slotId, a non-UUID slotId and a non-JSON body each return 400, never 500", async ({
    page,
  }) => {
    const patient = await createTestUser("patient");
    await loginAsPatient(page, patient);

    const missingResponse = await page.request.post("/api/appointments", { data: {} });
    expect(missingResponse.status()).toBe(400);
    expect((await missingResponse.json()).error).toBe("Slot is required.");

    const badUuidResponse = await page.request.post("/api/appointments", {
      data: { slotId: "not-a-uuid" },
    });
    expect(badUuidResponse.status()).toBe(400);
    expect((await badUuidResponse.json()).error).toBe("Slot is required.");

    // A raw Buffer (unlike a string `data`) is always sent byte-for-byte —
    // Playwright's fetch client otherwise treats a non-parsable string paired
    // with a JSON content-type as a value to be JSON.stringify()'d, which
    // would silently produce a *valid* JSON string body and defeat this case.
    const nonJsonResponse = await page.request.post("/api/appointments", {
      headers: { "Content-Type": "application/json" },
      data: Buffer.from("not valid json{{{", "utf8"),
    });
    expect(nonJsonResponse.status()).toBe(400);
    expect((await nonJsonResponse.json()).error).toBe("Invalid request body.");
  });

  test("10. D-04: an anonymous visitor clicking Select this slot is redirected to /login with no dialog opened", async ({
    page,
  }) => {
    const specialty = await createTestSpecialty();
    const location = await createTestLocation();
    const doctor = await createTestDoctor({
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });
    const { year, month, day } = futureJerusalemDay(68);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 9, 30);
    await createTestSlots(doctor.id, [{ startAt: start, endAt: end }]);

    await page.goto(`/doctors/${doctor.id}`);
    await page.getByRole("button", { name: "Select this slot" }).click();

    await page.waitForURL(/\/login/);
    const url = new URL(page.url());
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("from")).toBe(`/doctors/${doctor.id}`);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("11. APPT-10/APPT-11 rendering: upcoming, elapsed and cancelled appointments land in the right section with the right badge", async ({
    page,
  }) => {
    const patient = await createTestUser("patient");
    const specialty = await createTestSpecialty();
    const location = await createTestLocation();
    const doctor = await createTestDoctor({
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });

    const futureDay = futureJerusalemDay(90);
    const futureStart = jerusalemWallClockToUtc(futureDay.year, futureDay.month, futureDay.day, 9, 0);
    const futureEnd = jerusalemWallClockToUtc(futureDay.year, futureDay.month, futureDay.day, 9, 30);

    const elapsedStart = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const elapsedEnd = new Date(Date.now() - 90 * 60 * 1000);

    const cancelledDay = futureJerusalemDay(91);
    const cancelledStart = jerusalemWallClockToUtc(
      cancelledDay.year,
      cancelledDay.month,
      cancelledDay.day,
      9,
      0,
    );
    const cancelledEnd = jerusalemWallClockToUtc(
      cancelledDay.year,
      cancelledDay.month,
      cancelledDay.day,
      9,
      30,
    );

    await createTestAppointment({
      doctorId: doctor.id,
      patientId: patient.id,
      startAt: futureStart.toISOString(),
      endAt: futureEnd.toISOString(),
      status: "scheduled",
    });
    await createTestAppointment({
      doctorId: doctor.id,
      patientId: patient.id,
      startAt: elapsedStart.toISOString(),
      endAt: elapsedEnd.toISOString(),
      status: "scheduled",
    });
    await createTestAppointment({
      doctorId: doctor.id,
      patientId: patient.id,
      startAt: cancelledStart.toISOString(),
      endAt: cancelledEnd.toISOString(),
      status: "cancelled_by_patient",
    });

    await loginAsPatient(page, patient);
    await page.goto("/patient/appointments");

    const upcomingSection = page.getByTestId("upcoming-section");
    const pastSection = page.getByTestId("past-section");
    await expect(upcomingSection.getByRole("heading", { name: "Upcoming" })).toBeVisible();
    await expect(pastSection.getByRole("heading", { name: "Past" })).toBeVisible();

    await expect(
      upcomingSection.locator('[data-slot="badge"]', { hasText: "Confirmed" }),
    ).toBeVisible();
    await expect(pastSection.locator('[data-slot="badge"]', { hasText: "Past" })).toBeVisible();
    await expect(
      pastSection.locator('[data-slot="badge"]', { hasText: "Cancelled by patient" }),
    ).toBeVisible();
  });

  test("12. APPT-10 scoping: a second patient's appointment never appears in the first patient's own list", async ({
    page,
  }) => {
    const patientA = await createTestUser("patient");
    const patientB = await createTestUser("patient");
    const specialty = await createTestSpecialty();
    const location = await createTestLocation();
    const doctor = await createTestDoctor({
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });

    const { year, month, day } = futureJerusalemDay(92);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 9, 30);

    const bAppointment = await createTestAppointment({
      doctorId: doctor.id,
      patientId: patientB.id,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    });

    await loginAsPatient(page, patientA);
    const response = await page.request.get("/api/patient/appointments");
    expect(response.status()).toBe(200);
    const body = await response.json();
    const ids = (body.appointments as Array<{ id: string }>).map((a) => a.id);
    expect(ids).not.toContain(bAppointment.id);
  });

  test("13. Empty state: a patient with no appointments sees the empty-state heading and the Find a doctor CTA", async ({
    page,
  }) => {
    const patient = await createTestUser("patient");
    await loginAsPatient(page, patient);
    await page.goto("/patient/appointments");

    await expect(page.getByRole("heading", { name: "No appointments yet" })).toBeVisible();
    await expect(
      page.getByText("Book an appointment with a doctor to see it here."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Find a doctor" })).toBeVisible();
  });
});
