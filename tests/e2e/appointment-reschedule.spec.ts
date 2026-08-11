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
import {
  formatJerusalemDayHeading,
  formatJerusalemTime,
  jerusalemDayKey,
  jerusalemWallClockToUtc,
} from "../../lib/timezone";

// APPT-08/APPT-09: rescheduling proven end to end — the appointment moves in
// place to a new slot of the same doctor, the old slot is freed and the new
// one taken with no window in which neither is held, all six D-10 rejection
// conditions produce the two locked messages with no side effect, an
// inactive doctor's slot is refused (RESEARCH Open Question 1), a foreign
// appointment id is indistinguishable from a missing one, and no orphaned
// booked slot is ever left behind (RESEARCH Pitfall 2).
//
// Deliberate runtime gap: the `40P01` deadlock branch (RESEARCH Pitfall 3) is
// NOT exercised here. Provoking a genuine circular slot swap needs two
// transactions to interleave inside a sub-second window and a test written
// to force that is inherently flaky. Task 1's acceptance criteria instead
// assert the branch exists (and appears before the generic 500 fallback) by
// source inspection. Expected behaviour if it ever fires: 409 with "Could
// not complete this reschedule right now — please try again.", never an
// unhandled 500.

const NOT_FOUND_MESSAGE = "This appointment no longer exists.";
const SLOT_REJECTION_MESSAGE = "This slot is no longer available. Please choose another.";
const APPOINTMENT_REJECTION_MESSAGE = "This appointment can no longer be rescheduled.";

// Appointments created directly through the booking route under test (not
// via helpers/appointments.ts's createTestAppointment fixture) are tracked
// here so they can be deleted before their slot/doctor/patient rows — every
// FK on `appointments` is ON DELETE RESTRICT.
const apiCreatedAppointmentIds: string[] = [];

async function cleanupApiCreatedAppointments(): Promise<void> {
  const admin = testAdminClient();
  const ids = apiCreatedAppointmentIds.splice(0, apiCreatedAppointmentIds.length);
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

function slotAt(daysAhead: number, hour: number): { start: Date; end: Date } {
  const { year, month, day } = futureJerusalemDay(daysAhead);
  return {
    start: jerusalemWallClockToUtc(year, month, day, hour, 0),
    end: jerusalemWallClockToUtc(year, month, day, hour, 30),
  };
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

async function createFixtureDoctor(opts?: {
  isActive?: boolean;
  profileId?: string;
}): Promise<{ id: string; fullName: string }> {
  const specialty = await createTestSpecialty();
  const location = await createTestLocation();
  return createTestDoctor({
    specialtyId: specialty.id,
    locationId: location.id,
    isActive: opts?.isActive ?? true,
    profileId: opts?.profileId,
  });
}

async function readAppointment(
  appointmentId: string,
): Promise<{ slot_id: string; status: string } | null> {
  const admin = testAdminClient();
  const { data } = await admin
    .from("appointments")
    .select("slot_id, status")
    .eq("id", appointmentId)
    .single();
  return data as { slot_id: string; status: string } | null;
}

async function readSlotStatus(slotId: string): Promise<string | null> {
  const admin = testAdminClient();
  const { data } = await admin.from("availability_slots").select("status").eq("id", slotId).single();
  return data?.status ?? null;
}

// Real service-role query for booked slots with no non-cancelled appointment
// referencing them, scoped to one doctor (RESEARCH Pitfall 2's warning-sign
// query) — asserted to return zero rows.
async function assertNoOrphanedBookedSlots(doctorId: string): Promise<void> {
  const admin = testAdminClient();
  const { data: bookedSlots } = await admin
    .from("availability_slots")
    .select("id")
    .eq("doctor_id", doctorId)
    .eq("status", "booked");
  const { data: activeAppointments } = await admin
    .from("appointments")
    .select("slot_id")
    .eq("doctor_id", doctorId)
    .not("status", "in", "(cancelled_by_patient,cancelled_by_doctor)");
  const activeSlotIds = new Set((activeAppointments ?? []).map((a) => a.slot_id as string));
  const orphaned = (bookedSlots ?? []).filter((s) => !activeSlotIds.has(s.id as string));
  expect(orphaned.length).toBe(0);
}

// Shared across cases 1-3 — the plan treats these as one continuous story
// (UI reschedule -> in-place row survival -> slot state flip) against the
// same appointment/slots.
let sharedAppointmentId: string;
let sharedOldSlotId: string;
let sharedNewSlotId: string;
let sharedDoctorId: string;
let sharedPatientId: string;

test.describe("APPT-08/APPT-09: reschedule atomicity, the D-10 rejection matrix, and the deadlock translation", () => {
  test.afterAll(async () => {
    await cleanupApiCreatedAppointments();
    await cleanupTestAppointments();
    await cleanupTestSlots();
    await cleanupTestReferenceData();
    await cleanupTestUsers();
  });

  test("1. APPT-08 through the UI: a patient reschedules an upcoming appointment through the day-grouped picker", async ({
    page,
  }) => {
    const patient = await createTestUser("patient");
    const doctor = await createFixtureDoctor();

    const oldSlotTime = slotAt(200, 9);
    const appointment = await createTestAppointment({
      doctorId: doctor.id,
      patientId: patient.id,
      startAt: oldSlotTime.start.toISOString(),
      endAt: oldSlotTime.end.toISOString(),
    });

    const otherASlotTime = slotAt(201, 10);
    const otherBSlotTime = slotAt(202, 11);
    const [otherA, otherB] = await createTestSlots(doctor.id, [
      { startAt: otherASlotTime.start, endAt: otherASlotTime.end, status: "available" },
      { startAt: otherBSlotTime.start, endAt: otherBSlotTime.end, status: "available" },
    ]);

    sharedAppointmentId = appointment.id;
    sharedOldSlotId = appointment.slotId;
    sharedDoctorId = doctor.id;
    sharedPatientId = patient.id;

    await loginAsPatient(page, patient);
    await page.goto("/patient/appointments");

    await page.getByRole("button", { name: /^Reschedule appointment/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Reschedule your appointment" })).toBeVisible();

    // Both other slots are offered, day-grouped with their Jerusalem times.
    const slotButtons = dialog.getByRole("button", { name: "Select this slot" });
    await expect(slotButtons).toHaveCount(2);

    const otherADayHeading = formatJerusalemDayHeading(otherASlotTime.start.toISOString());
    const otherATimeRange = `${formatJerusalemTime(otherASlotTime.start.toISOString())} - ${formatJerusalemTime(otherASlotTime.end.toISOString())}`;
    const otherBDayHeading = formatJerusalemDayHeading(otherBSlotTime.start.toISOString());
    const otherBTimeRange = `${formatJerusalemTime(otherBSlotTime.start.toISOString())} - ${formatJerusalemTime(otherBSlotTime.end.toISOString())}`;

    await expect(dialog.getByText(otherADayHeading)).toBeVisible();
    await expect(dialog.getByText(otherATimeRange)).toBeVisible();
    await expect(dialog.getByText(otherBDayHeading)).toBeVisible();
    await expect(dialog.getByText(otherBTimeRange)).toBeVisible();

    // The appointment's own current slot is never offered — its day heading
    // (unique among this doctor's fixture slots, each on a different day)
    // is absent from the picker entirely.
    const oldSlotDayHeading = formatJerusalemDayHeading(oldSlotTime.start.toISOString());
    await expect(dialog.getByText(oldSlotDayHeading)).toHaveCount(0);

    await slotButtons.first().click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("status")).toHaveText("Your appointment has been rescheduled.");

    const admin = testAdminClient();
    const { data: row } = await admin
      .from("appointments")
      .select("slot_id")
      .eq("id", appointment.id)
      .single();
    expect([otherA.id, otherB.id]).toContain(row?.slot_id);
    sharedNewSlotId = row?.slot_id as string;

    // The row now shows a time that is neither the original slot's time.
    await expect(page.getByTestId("upcoming-section")).not.toContainText(
      oldSlotTime.start.toISOString(),
    );
  });

  test("2. D-08 in-place update: the appointment id is unchanged and no second row was created", async () => {
    const admin = testAdminClient();
    const { data: row } = await admin
      .from("appointments")
      .select("id, slot_id")
      .eq("id", sharedAppointmentId)
      .single();

    expect(row?.id).toBe(sharedAppointmentId);
    expect(row?.slot_id).toBe(sharedNewSlotId);

    const { count } = await admin
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("patient_id", sharedPatientId)
      .eq("doctor_id", sharedDoctorId);
    expect(count).toBe(1);
  });

  test("3. APPT-09 slot states: the old slot is available and the new slot is booked", async () => {
    expect(await readSlotStatus(sharedOldSlotId)).toBe("available");
    expect(await readSlotStatus(sharedNewSlotId)).toBe("booked");
  });

  test("4. APPT-09 atomicity under concurrency: no instant with neither slot held, no orphaned booked slot", async ({
    browser,
  }) => {
    const patientA = await createTestUser("patient");
    const patientB = await createTestUser("patient");
    const doctor = await createFixtureDoctor();

    const xTime = slotAt(210, 9);
    const appointment = await createTestAppointment({
      doctorId: doctor.id,
      patientId: patientA.id,
      startAt: xTime.start.toISOString(),
      endAt: xTime.end.toISOString(),
    });
    const slotX = appointment.slotId;

    const yTime = slotAt(211, 9);
    const [slotY] = await createTestSlots(doctor.id, [
      { startAt: yTime.start, endAt: yTime.end, status: "available" },
    ]);

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    await loginInContext(contextA, patientA, "/patient");
    await loginInContext(contextB, patientB, "/patient");

    const [rescheduleResponse, bookingXResponse] = await Promise.all([
      contextA.request.patch(`/api/appointments/${appointment.id}/reschedule`, {
        data: { newSlotId: slotY.id },
      }),
      contextB.request.post("/api/appointments", { data: { slotId: slotX } }),
    ]);

    expect(rescheduleResponse.status()).toBe(200);
    expect([201, 409]).toContain(bookingXResponse.status());
    if (bookingXResponse.status() === 201) {
      const body = await bookingXResponse.json();
      apiCreatedAppointmentIds.push(body.appointment.id);
    }

    const admin = testAdminClient();
    const { data: apptRow } = await admin
      .from("appointments")
      .select("slot_id")
      .eq("id", appointment.id)
      .single();
    // The appointment ends up on exactly one slot — the new one.
    expect(apptRow?.slot_id).toBe(slotY.id);

    const { count: totalCount } = await admin
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .in("slot_id", [slotX, slotY.id]);
    expect(totalCount ?? 0).toBeLessThanOrEqual(2);

    await assertNoOrphanedBookedSlots(doctor.id);

    await contextA.close();
    await contextB.close();
  });

  test("5. D-09 rollback leaves the old slot held: rescheduling onto a slot a second patient just booked is rejected with no release", async ({
    browser,
  }) => {
    const patientA = await createTestUser("patient");
    const patientB = await createTestUser("patient");
    const doctor = await createFixtureDoctor();

    const xTime = slotAt(215, 9);
    const appointment = await createTestAppointment({
      doctorId: doctor.id,
      patientId: patientA.id,
      startAt: xTime.start.toISOString(),
      endAt: xTime.end.toISOString(),
    });
    const slotX = appointment.slotId;

    const yTime = slotAt(216, 9);
    const [slotY] = await createTestSlots(doctor.id, [
      { startAt: yTime.start, endAt: yTime.end, status: "available" },
    ]);

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    await loginInContext(contextA, patientA, "/patient");
    await loginInContext(contextB, patientB, "/patient");

    const bookYResponse = await contextB.request.post("/api/appointments", {
      data: { slotId: slotY.id },
    });
    expect(bookYResponse.status()).toBe(201);
    const bookYBody = await bookYResponse.json();
    apiCreatedAppointmentIds.push(bookYBody.appointment.id);

    const rescheduleResponse = await contextA.request.patch(
      `/api/appointments/${appointment.id}/reschedule`,
      { data: { newSlotId: slotY.id } },
    );
    expect(rescheduleResponse.status()).toBe(409);
    expect((await rescheduleResponse.json()).error).toBe(SLOT_REJECTION_MESSAGE);

    // Nothing was released on the failure path — the original slot is still
    // booked and the appointment still points at it.
    const admin = testAdminClient();
    const { data: apptRow } = await admin
      .from("appointments")
      .select("slot_id")
      .eq("id", appointment.id)
      .single();
    expect(apptRow?.slot_id).toBe(slotX);
    expect(await readSlotStatus(slotX)).toBe("booked");

    await contextA.close();
    await contextB.close();
  });

  test("6. D-10 rejection matrix: all six conditions produce the two locked messages with no side effect", async ({
    page,
  }) => {
    // Six sub-cases, each creating its own patient/doctor/appointment fixture
    // and logging in fresh, exceed Playwright's default 30s test timeout
    // under normal dev-server latency — this is fixture-creation and
    // login-flow cost, not slowness under test, so the timeout is widened
    // rather than the matrix split apart (mirrors the precedent in
    // search-sort-pagination.spec.ts / seed-availability.spec.ts).
    test.setTimeout(90000);

    const slotClassBodies: string[] = [];
    const appointmentClassBodies: string[] = [];

    // a. new slot in the past.
    {
      const patient = await createTestUser("patient");
      const doctor = await createFixtureDoctor();
      const xTime = slotAt(220, 9);
      const appointment = await createTestAppointment({
        doctorId: doctor.id,
        patientId: patient.id,
        startAt: xTime.start.toISOString(),
        endAt: xTime.end.toISOString(),
      });
      const pastStart = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const pastEnd = new Date(Date.now() - 90 * 60 * 1000);
      const [pastSlot] = await createTestSlots(doctor.id, [
        { startAt: pastStart, endAt: pastEnd, status: "available" },
      ]);

      await loginAsPatient(page, patient);
      const response = await page.request.patch(`/api/appointments/${appointment.id}/reschedule`, {
        data: { newSlotId: pastSlot.id },
      });
      expect(response.status(), "6a past slot").toBe(409);
      const body = await response.json();
      expect(body.error).toBe(SLOT_REJECTION_MESSAGE);
      slotClassBodies.push(body.error);

      const apptRow = await readAppointment(appointment.id);
      expect(apptRow?.slot_id).toBe(appointment.slotId);
      expect(await readSlotStatus(appointment.slotId)).toBe("booked");
    }

    // b. new slot with status = 'blocked'.
    {
      const patient = await createTestUser("patient");
      const doctor = await createFixtureDoctor();
      const xTime = slotAt(221, 9);
      const appointment = await createTestAppointment({
        doctorId: doctor.id,
        patientId: patient.id,
        startAt: xTime.start.toISOString(),
        endAt: xTime.end.toISOString(),
      });
      const blockedTime = slotAt(222, 10);
      const [blockedSlot] = await createTestSlots(doctor.id, [
        { startAt: blockedTime.start, endAt: blockedTime.end, status: "blocked" },
      ]);

      await loginAsPatient(page, patient);
      const response = await page.request.patch(`/api/appointments/${appointment.id}/reschedule`, {
        data: { newSlotId: blockedSlot.id },
      });
      expect(response.status(), "6b blocked slot").toBe(409);
      const body = await response.json();
      expect(body.error).toBe(SLOT_REJECTION_MESSAGE);
      slotClassBodies.push(body.error);

      expect(await readSlotStatus(blockedSlot.id)).toBe("blocked");
      const apptRow = await readAppointment(appointment.id);
      expect(apptRow?.slot_id).toBe(appointment.slotId);
    }

    // c. new slot already booked.
    {
      const patient = await createTestUser("patient");
      const otherPatient = await createTestUser("patient");
      const doctor = await createFixtureDoctor();
      const xTime = slotAt(223, 9);
      const appointment = await createTestAppointment({
        doctorId: doctor.id,
        patientId: patient.id,
        startAt: xTime.start.toISOString(),
        endAt: xTime.end.toISOString(),
      });
      const bookedTime = slotAt(224, 10);
      const otherAppointment = await createTestAppointment({
        doctorId: doctor.id,
        patientId: otherPatient.id,
        startAt: bookedTime.start.toISOString(),
        endAt: bookedTime.end.toISOString(),
      });

      await loginAsPatient(page, patient);
      const response = await page.request.patch(`/api/appointments/${appointment.id}/reschedule`, {
        data: { newSlotId: otherAppointment.slotId },
      });
      expect(response.status(), "6c already booked").toBe(409);
      const body = await response.json();
      expect(body.error).toBe(SLOT_REJECTION_MESSAGE);
      slotClassBodies.push(body.error);

      expect(await readSlotStatus(otherAppointment.slotId)).toBe("booked");
      const apptRow = await readAppointment(appointment.id);
      expect(apptRow?.slot_id).toBe(appointment.slotId);
    }

    // d. new slot belonging to a different doctor (D-06).
    {
      const patient = await createTestUser("patient");
      const doctor = await createFixtureDoctor();
      const otherDoctor = await createFixtureDoctor();
      const xTime = slotAt(225, 9);
      const appointment = await createTestAppointment({
        doctorId: doctor.id,
        patientId: patient.id,
        startAt: xTime.start.toISOString(),
        endAt: xTime.end.toISOString(),
      });
      const otherTime = slotAt(226, 10);
      const [otherDoctorSlot] = await createTestSlots(otherDoctor.id, [
        { startAt: otherTime.start, endAt: otherTime.end, status: "available" },
      ]);

      await loginAsPatient(page, patient);
      const response = await page.request.patch(`/api/appointments/${appointment.id}/reschedule`, {
        data: { newSlotId: otherDoctorSlot.id },
      });
      expect(response.status(), "6d wrong doctor").toBe(409);
      const body = await response.json();
      expect(body.error).toBe(SLOT_REJECTION_MESSAGE);
      slotClassBodies.push(body.error);

      expect(await readSlotStatus(otherDoctorSlot.id)).toBe("available");
      const apptRow = await readAppointment(appointment.id);
      expect(apptRow?.slot_id).toBe(appointment.slotId);
    }

    // e. appointment already cancelled.
    {
      const patient = await createTestUser("patient");
      const doctor = await createFixtureDoctor();
      const xTime = slotAt(227, 9);
      const appointment = await createTestAppointment({
        doctorId: doctor.id,
        patientId: patient.id,
        startAt: xTime.start.toISOString(),
        endAt: xTime.end.toISOString(),
        status: "cancelled_by_patient",
      });
      const availableTime = slotAt(228, 10);
      const [availableSlot] = await createTestSlots(doctor.id, [
        { startAt: availableTime.start, endAt: availableTime.end, status: "available" },
      ]);

      await loginAsPatient(page, patient);
      const response = await page.request.patch(`/api/appointments/${appointment.id}/reschedule`, {
        data: { newSlotId: availableSlot.id },
      });
      expect(response.status(), "6e already cancelled").toBe(409);
      const body = await response.json();
      expect(body.error).toBe(APPOINTMENT_REJECTION_MESSAGE);
      appointmentClassBodies.push(body.error);

      const apptRow = await readAppointment(appointment.id);
      expect(apptRow?.status).toBe("cancelled_by_patient");
      expect(apptRow?.slot_id).toBe(appointment.slotId);
      expect(await readSlotStatus(availableSlot.id)).toBe("available");
    }

    // f. appointment whose own slot start_at has already passed.
    {
      const patient = await createTestUser("patient");
      const doctor = await createFixtureDoctor();
      const pastStart = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const pastEnd = new Date(Date.now() - 90 * 60 * 1000);
      const appointment = await createTestAppointment({
        doctorId: doctor.id,
        patientId: patient.id,
        startAt: pastStart.toISOString(),
        endAt: pastEnd.toISOString(),
        status: "scheduled",
      });
      const availableTime = slotAt(229, 10);
      const [availableSlot] = await createTestSlots(doctor.id, [
        { startAt: availableTime.start, endAt: availableTime.end, status: "available" },
      ]);

      await loginAsPatient(page, patient);
      const response = await page.request.patch(`/api/appointments/${appointment.id}/reschedule`, {
        data: { newSlotId: availableSlot.id },
      });
      expect(response.status(), "6f elapsed appointment").toBe(409);
      const body = await response.json();
      expect(body.error).toBe(APPOINTMENT_REJECTION_MESSAGE);
      appointmentClassBodies.push(body.error);

      const apptRow = await readAppointment(appointment.id);
      expect(apptRow?.status).toBe("scheduled");
      expect(apptRow?.slot_id).toBe(appointment.slotId);
      expect(await readSlotStatus(availableSlot.id)).toBe("available");
    }

    // Comparing pairwise, never against a separate literal, so a divergence
    // in copy fails the test without a hardcoded expectation duplicated
    // elsewhere.
    expect(slotClassBodies.length).toBe(4);
    const [firstSlotBody, ...restSlotBodies] = slotClassBodies;
    for (const message of restSlotBodies) {
      expect(message).toBe(firstSlotBody);
    }

    expect(appointmentClassBodies.length).toBe(2);
    const [firstApptBody, ...restApptBodies] = appointmentClassBodies;
    for (const message of restApptBodies) {
      expect(message).toBe(firstApptBody);
    }
  });

  test("7. D-19 consistency, flagged assumption: a slot belonging to a deactivated doctor is refused", async ({
    page,
  }) => {
    const patient = await createTestUser("patient");
    const doctor = await createFixtureDoctor({ isActive: false });

    const xTime = slotAt(230, 9);
    const appointment = await createTestAppointment({
      doctorId: doctor.id,
      patientId: patient.id,
      startAt: xTime.start.toISOString(),
      endAt: xTime.end.toISOString(),
    });
    const availableTime = slotAt(231, 10);
    const [availableSlot] = await createTestSlots(doctor.id, [
      { startAt: availableTime.start, endAt: availableTime.end, status: "available" },
    ]);

    await loginAsPatient(page, patient);
    const response = await page.request.patch(`/api/appointments/${appointment.id}/reschedule`, {
      data: { newSlotId: availableSlot.id },
    });
    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe(SLOT_REJECTION_MESSAGE);
  });

  test("8. T-05-05 non-oracle 404: a foreign appointment id and a nonexistent id return byte-identical 404 bodies", async ({
    page,
  }) => {
    const patientA = await createTestUser("patient");
    const patientB = await createTestUser("patient");
    const doctor = await createFixtureDoctor();
    const bTime = slotAt(232, 9);
    const bAppointment = await createTestAppointment({
      doctorId: doctor.id,
      patientId: patientB.id,
      startAt: bTime.start.toISOString(),
      endAt: bTime.end.toISOString(),
    });

    await loginAsPatient(page, patientA);

    const placeholderSlotId = "00000000-0000-0000-0000-000000000001";

    const foreignResponse = await page.request.patch(
      `/api/appointments/${bAppointment.id}/reschedule`,
      { data: { newSlotId: placeholderSlotId } },
    );
    expect(foreignResponse.status()).toBe(404);
    const foreignBody = await foreignResponse.json();

    const missingResponse = await page.request.patch(
      `/api/appointments/00000000-0000-0000-0000-000000000000/reschedule`,
      { data: { newSlotId: placeholderSlotId } },
    );
    expect(missingResponse.status()).toBe(404);
    const missingBody = await missingResponse.json();

    expect(foreignBody).toEqual(missingBody);
    expect(foreignBody.error).toBe(NOT_FOUND_MESSAGE);

    const apptRow = await readAppointment(bAppointment.id);
    expect(apptRow?.slot_id).toBe(bAppointment.slotId);
    expect(apptRow?.status).toBe("scheduled");
  });

  test("9. Guards and validation: anonymous, doctor, malformed id, missing/non-UUID newSlotId and non-JSON body each reject cleanly", async ({
    page,
    request,
  }) => {
    const placeholderId = "00000000-0000-0000-0000-000000000000";
    const placeholderSlotId = "00000000-0000-0000-0000-000000000001";

    const anonResponse = await request.patch(`/api/appointments/${placeholderId}/reschedule`, {
      data: { newSlotId: placeholderSlotId },
    });
    expect(anonResponse.status()).toBe(401);

    const doctorUser = await createTestUser("doctor");
    await createFixtureDoctor({ profileId: doctorUser.id });
    await page.goto("/login");
    await page.getByLabel("Email").fill(doctorUser.email);
    await page.getByLabel("Password").fill(doctorUser.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("/doctor");
    const doctorResponse = await page.request.patch(`/api/appointments/${placeholderId}/reschedule`, {
      data: { newSlotId: placeholderSlotId },
    });
    expect(doctorResponse.status()).toBe(403);

    const patient = await createTestUser("patient");
    await loginAsPatient(page, patient);

    const malformedResponse = await page.request.patch(
      `/api/appointments/not-a-uuid/reschedule`,
      { data: { newSlotId: placeholderSlotId } },
    );
    expect(malformedResponse.status()).toBe(404);
    expect((await malformedResponse.json()).error).toBe(NOT_FOUND_MESSAGE);

    const missingSlotResponse = await page.request.patch(
      `/api/appointments/${placeholderId}/reschedule`,
      { data: {} },
    );
    expect(missingSlotResponse.status()).toBe(400);
    expect((await missingSlotResponse.json()).error).toBe("A new slot is required.");

    const nonUuidSlotResponse = await page.request.patch(
      `/api/appointments/${placeholderId}/reschedule`,
      { data: { newSlotId: "not-a-uuid" } },
    );
    expect(nonUuidSlotResponse.status()).toBe(400);
    expect((await nonUuidSlotResponse.json()).error).toBe("A new slot is required.");

    // A raw Buffer (unlike a string `data`) is always sent byte-for-byte —
    // Playwright's fetch client otherwise treats a non-parsable string
    // paired with a JSON content-type as a value to be JSON.stringify()'d,
    // which would silently produce a *valid* JSON string body and defeat
    // this case.
    const nonJsonResponse = await page.request.patch(
      `/api/appointments/${placeholderId}/reschedule`,
      {
        headers: { "Content-Type": "application/json" },
        data: Buffer.from("not valid json{{{", "utf8"),
      },
    );
    expect(nonJsonResponse.status()).toBe(400);
    expect((await nonJsonResponse.json()).error).toBe("Invalid request body.");
  });

  test("10. No reschedule surface for the doctor: a doctor authenticated against their own appointment still receives 403", async ({
    page,
  }) => {
    const doctorUser = await createTestUser("doctor");
    const doctor = await createFixtureDoctor({ profileId: doctorUser.id });
    const patient = await createTestUser("patient");
    const ownTime = slotAt(233, 9);
    const ownAppointment = await createTestAppointment({
      doctorId: doctor.id,
      patientId: patient.id,
      startAt: ownTime.start.toISOString(),
      endAt: ownTime.end.toISOString(),
    });
    const availableTime = slotAt(234, 10);
    const [availableSlot] = await createTestSlots(doctor.id, [
      { startAt: availableTime.start, endAt: availableTime.end, status: "available" },
    ]);

    await page.goto("/login");
    await page.getByLabel("Email").fill(doctorUser.email);
    await page.getByLabel("Password").fill(doctorUser.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("/doctor");

    const response = await page.request.patch(
      `/api/appointments/${ownAppointment.id}/reschedule`,
      { data: { newSlotId: availableSlot.id } },
    );
    expect(response.status()).toBe(403);

    const apptRow = await readAppointment(ownAppointment.id);
    expect(apptRow?.slot_id).toBe(ownAppointment.slotId);
  });

  test("11. UI eligibility: on a page holding one upcoming, one elapsed and one cancelled appointment, exactly one Reschedule control exists and it belongs to the upcoming row", async ({
    page,
  }) => {
    const patient = await createTestUser("patient");
    const doctor = await createFixtureDoctor();

    const upcomingTime = slotAt(240, 9);
    const elapsedStart = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const elapsedEnd = new Date(Date.now() - 90 * 60 * 1000);
    const cancelledTime = slotAt(241, 9);

    await createTestAppointment({
      doctorId: doctor.id,
      patientId: patient.id,
      startAt: upcomingTime.start.toISOString(),
      endAt: upcomingTime.end.toISOString(),
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
      startAt: cancelledTime.start.toISOString(),
      endAt: cancelledTime.end.toISOString(),
      status: "cancelled_by_patient",
    });

    await loginAsPatient(page, patient);
    await page.goto("/patient/appointments");

    const rescheduleButtons = page.getByRole("button", { name: /^Reschedule appointment/ });
    await expect(rescheduleButtons).toHaveCount(1);
    await expect(
      page.getByTestId("upcoming-section").getByRole("button", { name: /^Reschedule appointment/ }),
    ).toHaveCount(1);
    await expect(
      page.getByTestId("past-section").getByRole("button", { name: /^Reschedule appointment/ }),
    ).toHaveCount(0);
  });
});
