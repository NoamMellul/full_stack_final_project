import { expect, test, type Page } from "@playwright/test";

import { cleanupTestAppointments, createTestAppointment } from "./helpers/appointments";
import { cleanupTestSlots } from "./helpers/availability";
import {
  cleanupTestReferenceData,
  createTestDoctor,
  createTestLocation,
  createTestSpecialty,
} from "./helpers/reference-data";
import { testAdminClient } from "./helpers/supabase-admin";
import { cleanupTestUsers, createTestUser } from "./helpers/test-users";
import { jerusalemDayKey, jerusalemWallClockToUtc } from "../../lib/timezone";

// APPT-05, APPT-07: patient-side cancellation proven end to end — the row
// survives with the right status and a byte-identical reason, the slot
// returns to `available` and is genuinely re-bookable by a different
// patient, elapsed/already-cancelled appointments are rejected with the
// locked copy, and a foreign appointment id is indistinguishable from a
// missing one. Plan 05-05 extends this file with the doctor-side cases;
// shared setup lives in the named helpers below rather than inlined per
// test. Every fixture time is authored several days in the future via
// jerusalemWallClockToUtc, each case on its own day offset, so no case is
// sensitive to the day it runs (playwright.config.ts runs
// fullyParallel: false / workers: 1, so ordering within this file is
// stable and later cases may depend on state produced by earlier ones).

const NOT_FOUND_MESSAGE = "This appointment no longer exists.";
const NOT_MODIFIABLE_MESSAGE = "This appointment can no longer be cancelled.";

// Appointments created directly through the route under test (not via
// helpers/appointments.ts's createTestAppointment fixture) are tracked here
// so they can be deleted before their slot/doctor/patient rows — every FK on
// `appointments` is ON DELETE RESTRICT.
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

async function loginAsPatient(page: Page, creds: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("/patient");
}

async function createFixtureDoctor(): Promise<{ id: string; fullName: string }> {
  const specialty = await createTestSpecialty();
  const location = await createTestLocation();
  return createTestDoctor({
    specialtyId: specialty.id,
    locationId: location.id,
    isActive: true,
  });
}

// Shared across tests 1, 2, 4 and 5 — the plan's own numbering treats these
// as one continuous story (UI cancel -> row/reason survival -> slot release
// -> re-booking) against the same appointment/slot.
let sharedAppointmentId: string;
let sharedSlotId: string;
let sharedDoctorId: string;
const sharedReason = "  Please reschedule for a later date.  ";

test.describe("APPT-05/APPT-07: patient cancellation, slot release and re-booking", () => {
  test.afterAll(async () => {
    await cleanupApiCreatedAppointments();
    await cleanupTestAppointments();
    await cleanupTestSlots();
    await cleanupTestReferenceData();
    await cleanupTestUsers();
  });

  test("1. APPT-05 through the UI: a patient cancels an upcoming appointment through the confirmation dialog", async ({
    page,
  }) => {
    const patient = await createTestUser("patient");
    const doctor = await createFixtureDoctor();
    const { year, month, day } = futureJerusalemDay(100);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 9, 30);
    const appointment = await createTestAppointment({
      doctorId: doctor.id,
      patientId: patient.id,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    });

    sharedAppointmentId = appointment.id;
    sharedSlotId = appointment.slotId;
    sharedDoctorId = doctor.id;

    await loginAsPatient(page, patient);
    await page.goto("/patient/appointments");

    await page.getByRole("button", { name: /^Cancel appointment/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Cancel this appointment?" })).toBeVisible();
    await expect(
      dialog.getByText(
        "This will cancel the appointment for both you and the other party. This cannot be undone.",
      ),
    ).toBeVisible();

    await dialog.getByLabel("Reason (optional)").fill(sharedReason);
    await dialog.getByRole("button", { name: "Cancel appointment" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("status")).toHaveText("Appointment cancelled.");
    await expect(
      page.getByTestId("past-section").locator('[data-slot="badge"]', {
        hasText: "Cancelled by patient",
      }),
    ).toBeVisible();
  });

  test("2. D-14 row survival and reason round-trip: the row survives with the right status and a byte-identical reason", async () => {
    const admin = testAdminClient();
    const { data: row } = await admin
      .from("appointments")
      .select("status, cancelled_reason")
      .eq("id", sharedAppointmentId)
      .single();

    expect(row).not.toBeNull();
    expect(row?.status).toBe("cancelled_by_patient");
    expect(row?.cancelled_reason).toBe(sharedReason);
  });

  test("3. D-13 blank reason: cancelling with the textarea left empty stores a null reason, not an empty string", async ({
    page,
  }) => {
    const patient = await createTestUser("patient");
    const doctor = await createFixtureDoctor();
    const { year, month, day } = futureJerusalemDay(101);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 9, 30);
    const appointment = await createTestAppointment({
      doctorId: doctor.id,
      patientId: patient.id,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    });

    await loginAsPatient(page, patient);
    await page.goto("/patient/appointments");

    await page.getByRole("button", { name: /^Cancel appointment/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Cancel appointment" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("status")).toHaveText("Appointment cancelled.");

    const admin = testAdminClient();
    const { data: row } = await admin
      .from("appointments")
      .select("cancelled_reason")
      .eq("id", appointment.id)
      .single();
    expect(row?.cancelled_reason).toBeNull();
  });

  test("4. APPT-07 slot release: the cancelled appointment's slot returns to available and reappears in the public profile", async ({
    page,
  }) => {
    const admin = testAdminClient();
    const { data: slotRow } = await admin
      .from("availability_slots")
      .select("status")
      .eq("id", sharedSlotId)
      .single();
    expect(slotRow?.status).toBe("available");

    const profileResponse = await page.request.get(`/api/doctors/${sharedDoctorId}`);
    expect(profileResponse.status()).toBe(200);
    const profileBody = await profileResponse.json();
    const slotIds = (profileBody.upcomingSlots as Array<{ id: string }>).map((s) => s.id);
    expect(slotIds).toContain(sharedSlotId);
  });

  test("5. APPT-07 re-booking: a different patient successfully books the freed slot", async ({
    page,
  }) => {
    const patientB = await createTestUser("patient");
    await loginAsPatient(page, patientB);

    const response = await page.request.post("/api/appointments", {
      data: { slotId: sharedSlotId },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    apiCreatedAppointmentIds.push(body.appointment.id);

    const admin = testAdminClient();
    const { count: activeCount } = await admin
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("slot_id", sharedSlotId)
      .eq("status", "scheduled");
    expect(activeCount).toBe(1);

    const { count: cancelledCount } = await admin
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("slot_id", sharedSlotId)
      .eq("status", "cancelled_by_patient");
    expect(cancelledCount).toBe(1);

    const { count: totalCount } = await admin
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("slot_id", sharedSlotId);
    expect(totalCount).toBe(2);
  });

  test("6. D-12 elapsed appointment: cancelling a past appointment is rejected with 409 and leaves its status unchanged", async ({
    page,
  }) => {
    const patient = await createTestUser("patient");
    const doctor = await createFixtureDoctor();
    const pastStart = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const pastEnd = new Date(Date.now() - 90 * 60 * 1000);
    const appointment = await createTestAppointment({
      doctorId: doctor.id,
      patientId: patient.id,
      startAt: pastStart.toISOString(),
      endAt: pastEnd.toISOString(),
    });

    await loginAsPatient(page, patient);
    const response = await page.request.patch(`/api/appointments/${appointment.id}/cancel`, {
      data: {},
    });
    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe(NOT_MODIFIABLE_MESSAGE);

    const admin = testAdminClient();
    const { data: row } = await admin
      .from("appointments")
      .select("status")
      .eq("id", appointment.id)
      .single();
    expect(row?.status).toBe("scheduled");
  });

  test("7. D-12 already cancelled: a second cancellation attempt is rejected with 409 and does not overwrite the stored reason", async ({
    page,
  }) => {
    const patient = await createTestUser("patient");
    const doctor = await createFixtureDoctor();
    const { year, month, day } = futureJerusalemDay(102);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 9, 30);
    const appointment = await createTestAppointment({
      doctorId: doctor.id,
      patientId: patient.id,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    });

    await loginAsPatient(page, patient);

    const firstReason = "First cancellation reason.";
    const firstResponse = await page.request.patch(`/api/appointments/${appointment.id}/cancel`, {
      data: { reason: firstReason },
    });
    expect(firstResponse.status()).toBe(200);
    expect((await firstResponse.json()).status).toBe("cancelled_by_patient");

    const secondResponse = await page.request.patch(`/api/appointments/${appointment.id}/cancel`, {
      data: { reason: "Second attempt, should not be stored." },
    });
    expect(secondResponse.status()).toBe(409);
    expect((await secondResponse.json()).error).toBe(NOT_MODIFIABLE_MESSAGE);

    const admin = testAdminClient();
    const { data: row } = await admin
      .from("appointments")
      .select("cancelled_reason")
      .eq("id", appointment.id)
      .single();
    expect(row?.cancelled_reason).toBe(firstReason);
  });

  test("8. T-05-05 non-oracle 404: a foreign appointment id and a nonexistent id return byte-identical 404 bodies", async ({
    page,
  }) => {
    const patientA = await createTestUser("patient");
    const patientB = await createTestUser("patient");
    const doctor = await createFixtureDoctor();
    const { year, month, day } = futureJerusalemDay(103);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 9, 30);
    const bAppointment = await createTestAppointment({
      doctorId: doctor.id,
      patientId: patientB.id,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    });

    await loginAsPatient(page, patientA);

    const foreignResponse = await page.request.patch(
      `/api/appointments/${bAppointment.id}/cancel`,
      { data: {} },
    );
    expect(foreignResponse.status()).toBe(404);
    const foreignBody = await foreignResponse.json();

    const missingResponse = await page.request.patch(
      `/api/appointments/00000000-0000-0000-0000-000000000000/cancel`,
      { data: {} },
    );
    expect(missingResponse.status()).toBe(404);
    const missingBody = await missingResponse.json();

    expect(foreignBody).toEqual(missingBody);
    expect(foreignBody.error).toBe(NOT_FOUND_MESSAGE);

    const admin = testAdminClient();
    const { data: row } = await admin
      .from("appointments")
      .select("status")
      .eq("id", bAppointment.id)
      .single();
    expect(row?.status).toBe("scheduled");
  });

  test("9. Guards: anonymous, malformed id, non-string reason, over-length reason and non-JSON body each reject cleanly", async ({
    page,
    request,
  }) => {
    const placeholderId = "00000000-0000-0000-0000-000000000000";

    const anonResponse = await request.patch(`/api/appointments/${placeholderId}/cancel`, {
      data: {},
    });
    expect(anonResponse.status()).toBe(401);

    const patient = await createTestUser("patient");
    await loginAsPatient(page, patient);

    const malformedResponse = await page.request.patch(
      `/api/appointments/not-a-uuid/cancel`,
      { data: {} },
    );
    expect(malformedResponse.status()).toBe(404);
    expect((await malformedResponse.json()).error).toBe(NOT_FOUND_MESSAGE);

    const nonStringReasonResponse = await page.request.patch(
      `/api/appointments/${placeholderId}/cancel`,
      { data: { reason: 42 } },
    );
    expect(nonStringReasonResponse.status()).toBe(400);
    expect((await nonStringReasonResponse.json()).error).toBe("Reason must be text.");

    const longReasonResponse = await page.request.patch(
      `/api/appointments/${placeholderId}/cancel`,
      { data: { reason: "a".repeat(2001) } },
    );
    expect(longReasonResponse.status()).toBe(400);
    expect((await longReasonResponse.json()).error).toBe("Reason is too long.");

    // A raw Buffer (unlike a string `data`) is always sent byte-for-byte —
    // Playwright's fetch client otherwise treats a non-parsable string
    // paired with a JSON content-type as a value to be JSON.stringify()'d,
    // which would silently produce a *valid* JSON string body and defeat
    // this case.
    const nonJsonResponse = await page.request.patch(
      `/api/appointments/${placeholderId}/cancel`,
      {
        headers: { "Content-Type": "application/json" },
        data: Buffer.from("not valid json{{{", "utf8"),
      },
    );
    expect(nonJsonResponse.status()).toBe(400);
    expect((await nonJsonResponse.json()).error).toBe("Invalid request body.");
  });

  test("10. UI eligibility: only the upcoming, non-cancelled row exposes a Cancel appointment control", async ({
    page,
  }) => {
    const patient = await createTestUser("patient");
    const doctor = await createFixtureDoctor();

    const upcomingDay = futureJerusalemDay(104);
    const upcomingStart = jerusalemWallClockToUtc(
      upcomingDay.year,
      upcomingDay.month,
      upcomingDay.day,
      9,
      0,
    );
    const upcomingEnd = jerusalemWallClockToUtc(
      upcomingDay.year,
      upcomingDay.month,
      upcomingDay.day,
      9,
      30,
    );

    const elapsedStart = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const elapsedEnd = new Date(Date.now() - 90 * 60 * 1000);

    const cancelledDay = futureJerusalemDay(105);
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
      startAt: upcomingStart.toISOString(),
      endAt: upcomingEnd.toISOString(),
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

    const cancelButtons = page.getByRole("button", { name: /^Cancel appointment/ });
    await expect(cancelButtons).toHaveCount(1);
    await expect(
      page.getByTestId("upcoming-section").getByRole("button", { name: /^Cancel appointment/ }),
    ).toHaveCount(1);
    await expect(
      page.getByTestId("past-section").getByRole("button", { name: /^Cancel appointment/ }),
    ).toHaveCount(0);
  });
});
