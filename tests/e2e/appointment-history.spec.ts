import { expect, test, type BrowserContext } from "@playwright/test";

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
import { formatJerusalemDayHeading, jerusalemDayKey, jerusalemWallClockToUtc } from "../../lib/timezone";

// APPT-10 through APPT-13: the patient's and the doctor's appointment
// history views are two projections of the same rows, so this file proves
// them together against one shared five-appointment fixture — the only way
// to show the two pages cannot drift apart on section placement or badge
// wording (D-14, D-16, D-17, D-18, T-05-08).

type Fixture = {
  doctorUserId: string;
  doctorEmail: string;
  doctorPassword: string;
  doctorId: string;
  patientEmail: string;
  patientPassword: string;
  patientId: string;
  doctorBUserId: string;
  doctorBEmail: string;
  doctorBPassword: string;
  doctorBId: string;
  patientBEmail: string;
  patientBPassword: string;
  patientBId: string;
};

type FixtureAppointments = {
  aStart: string;
  bStart: string;
  cStart: string;
  dStart: string;
  eStart: string;
  aId: string;
  bId: string;
  cId: string;
  dId: string;
  eId: string;
  fId: string;
};

function futureJerusalemDay(daysAhead: number): { year: number; month: number; day: number } {
  const future = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const dayKey = jerusalemDayKey(future.toISOString());
  const [year, month, day] = dayKey.split("-").map(Number);
  return { year, month, day };
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

test.describe("APPT-10/APPT-11/APPT-12/APPT-13: patient and doctor appointment history", () => {
  let fixture: Fixture;
  let appointments: FixtureAppointments;

  let patientContext: BrowserContext;
  let doctorContext: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    const doctorUser = await createTestUser("doctor");
    const specialty = await createTestSpecialty();
    const location = await createTestLocation();
    const doctor = await createTestDoctor({
      specialtyId: specialty.id,
      locationId: location.id,
      profileId: doctorUser.id,
      isActive: true,
    });

    const patient = await createTestUser("patient");

    const doctorBUser = await createTestUser("doctor");
    const specialtyB = await createTestSpecialty();
    const locationB = await createTestLocation();
    const doctorB = await createTestDoctor({
      specialtyId: specialtyB.id,
      locationId: locationB.id,
      profileId: doctorBUser.id,
      isActive: true,
    });

    const patientB = await createTestUser("patient");

    fixture = {
      doctorUserId: doctorUser.id,
      doctorEmail: doctorUser.email,
      doctorPassword: doctorUser.password,
      doctorId: doctor.id,
      patientEmail: patient.email,
      patientPassword: patient.password,
      patientId: patient.id,
      doctorBUserId: doctorBUser.id,
      doctorBEmail: doctorBUser.email,
      doctorBPassword: doctorBUser.password,
      doctorBId: doctorB.id,
      patientBEmail: patientB.email,
      patientBPassword: patientB.password,
      patientBId: patientB.id,
    };

    // A and B: future, non-cancelled — land under Upcoming, ascending by
    // start_at (A before B).
    const aDay = futureJerusalemDay(300);
    const aStart = jerusalemWallClockToUtc(aDay.year, aDay.month, aDay.day, 9, 0);
    const aEnd = jerusalemWallClockToUtc(aDay.year, aDay.month, aDay.day, 9, 30);
    const a = await createTestAppointment({
      doctorId: doctor.id,
      patientId: patient.id,
      startAt: aStart.toISOString(),
      endAt: aEnd.toISOString(),
      status: "scheduled",
    });

    const bDay = futureJerusalemDay(301);
    const bStart = jerusalemWallClockToUtc(bDay.year, bDay.month, bDay.day, 9, 0);
    const bEnd = jerusalemWallClockToUtc(bDay.year, bDay.month, bDay.day, 9, 30);
    const b = await createTestAppointment({
      doctorId: doctor.id,
      patientId: patient.id,
      startAt: bStart.toISOString(),
      endAt: bEnd.toISOString(),
      status: "confirmed",
    });

    // C: elapsed, never cancelled — lands under Past labeled "Past".
    const cStart = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const cEnd = new Date(Date.now() - 2.5 * 60 * 60 * 1000);
    const c = await createTestAppointment({
      doctorId: doctor.id,
      patientId: patient.id,
      startAt: cStart.toISOString(),
      endAt: cEnd.toISOString(),
      status: "scheduled",
    });

    // D: elapsed, cancelled by the patient — further in the past than C, so
    // Past's descending order is E, C, D.
    const dStart = new Date(Date.now() - 30 * 60 * 60 * 1000);
    const dEnd = new Date(Date.now() - 29.5 * 60 * 60 * 1000);
    const d = await createTestAppointment({
      doctorId: doctor.id,
      patientId: patient.id,
      startAt: dStart.toISOString(),
      endAt: dEnd.toISOString(),
      status: "cancelled_by_patient",
    });

    // E: cancelled by the doctor with a slot time still in the future — the
    // D-14/D-17 case: must land under Past, never Upcoming, despite the
    // future start_at.
    const eDay = futureJerusalemDay(302);
    const eStart = jerusalemWallClockToUtc(eDay.year, eDay.month, eDay.day, 9, 0);
    const eEnd = jerusalemWallClockToUtc(eDay.year, eDay.month, eDay.day, 9, 30);
    const e = await createTestAppointment({
      doctorId: doctor.id,
      patientId: patient.id,
      startAt: eStart.toISOString(),
      endAt: eEnd.toISOString(),
      status: "cancelled_by_doctor",
    });

    // F: a second doctor/patient pair, used only for cross-pair scoping.
    const fDay = futureJerusalemDay(303);
    const fStart = jerusalemWallClockToUtc(fDay.year, fDay.month, fDay.day, 9, 0);
    const fEnd = jerusalemWallClockToUtc(fDay.year, fDay.month, fDay.day, 9, 30);
    const f = await createTestAppointment({
      doctorId: doctorB.id,
      patientId: patientB.id,
      startAt: fStart.toISOString(),
      endAt: fEnd.toISOString(),
      status: "scheduled",
    });

    appointments = {
      aStart: aStart.toISOString(),
      bStart: bStart.toISOString(),
      cStart: cStart.toISOString(),
      dStart: dStart.toISOString(),
      eStart: eStart.toISOString(),
      aId: a.id,
      bId: b.id,
      cId: c.id,
      dId: d.id,
      eId: e.id,
      fId: f.id,
    };

    patientContext = await browser.newContext();
    doctorContext = await browser.newContext();
    await loginInContext(
      patientContext,
      { email: fixture.patientEmail, password: fixture.patientPassword },
      "/patient",
    );
    await loginInContext(
      doctorContext,
      { email: fixture.doctorEmail, password: fixture.doctorPassword },
      "/doctor",
    );
  });

  test.afterAll(async () => {
    await patientContext?.close();
    await doctorContext?.close();
    await cleanupTestAppointments();
    await cleanupTestSlots();
    await cleanupTestReferenceData();
    await cleanupTestUsers();
  });

  test("1. APPT-10/APPT-11 patient view: A and B under Upcoming ascending, C/D/E under Past descending with correct badges", async () => {
    const page = await patientContext.newPage();
    await page.goto("/patient/appointments");

    const upcomingSection = page.getByTestId("upcoming-section");
    const pastSection = page.getByTestId("past-section");
    await expect(upcomingSection.getByRole("heading", { name: "Upcoming" })).toBeVisible();
    await expect(pastSection.getByRole("heading", { name: "Past" })).toBeVisible();

    const upcomingRows = upcomingSection.locator("div.flex.items-center.gap-3");
    await expect(upcomingRows).toHaveCount(2);
    const upcomingTexts = await upcomingRows.allTextContents();
    expect(upcomingTexts[0]).toContain(formatJerusalemDayHeading(appointments.aStart));
    expect(upcomingTexts[0]).toContain("Confirmed");
    expect(upcomingTexts[1]).toContain(formatJerusalemDayHeading(appointments.bStart));
    expect(upcomingTexts[1]).toContain("Confirmed");

    const pastRows = pastSection.locator("div.flex.items-center.gap-3");
    await expect(pastRows).toHaveCount(3);
    const pastTexts = await pastRows.allTextContents();
    // Descending by start_at: E (future) > C (3h ago) > D (30h ago).
    expect(pastTexts[0]).toContain(formatJerusalemDayHeading(appointments.eStart));
    expect(pastTexts[0]).toContain("Cancelled by doctor");
    expect(pastTexts[1]).toContain(formatJerusalemDayHeading(appointments.cStart));
    expect(pastTexts[1]).toContain("Past");
    expect(pastTexts[2]).toContain(formatJerusalemDayHeading(appointments.dStart));
    expect(pastTexts[2]).toContain("Cancelled by patient");

    await page.close();
  });

  test("2. D-14/D-17 cancelled-but-future placement: E renders under Past, never Upcoming, with its real cancellation status", async () => {
    const page = await patientContext.newPage();
    await page.goto("/patient/appointments");

    const upcomingSection = page.getByTestId("upcoming-section");
    const pastSection = page.getByTestId("past-section");

    await expect(upcomingSection.getByText(formatJerusalemDayHeading(appointments.eStart))).toHaveCount(0);
    await expect(pastSection.getByText(formatJerusalemDayHeading(appointments.eStart))).toBeVisible();
    await expect(
      pastSection.locator('[data-slot="badge"]', { hasText: "Cancelled by doctor" }),
    ).toBeVisible();

    await page.close();
  });

  test("3. D-16 no write-back: C's stored status is still scheduled after both pages have rendered its derived Past label", async () => {
    const patientPage = await patientContext.newPage();
    await patientPage.goto("/patient/appointments");
    await patientPage.close();

    const doctorPage = await doctorContext.newPage();
    await doctorPage.goto("/doctor/appointments");
    await doctorPage.close();

    const admin = testAdminClient();
    const { data: row } = await admin
      .from("appointments")
      .select("status")
      .eq("id", appointments.cId)
      .single();
    expect(row?.status).toBe("scheduled");
  });

  test("4. APPT-12/APPT-13 doctor view: identical sections and badges as the patient view, showing the patient's name", async () => {
    const page = await doctorContext.newPage();
    await page.goto("/doctor/appointments");

    const upcomingSection = page.getByTestId("upcoming-section");
    const pastSection = page.getByTestId("past-section");
    await expect(upcomingSection.getByRole("heading", { name: "Upcoming" })).toBeVisible();
    await expect(pastSection.getByRole("heading", { name: "Past" })).toBeVisible();

    const upcomingRows = upcomingSection.locator("div.flex.items-center.gap-3");
    await expect(upcomingRows).toHaveCount(2);
    const upcomingTexts = await upcomingRows.allTextContents();
    expect(upcomingTexts[0]).toContain(formatJerusalemDayHeading(appointments.aStart));
    expect(upcomingTexts[0]).toContain("Confirmed");
    expect(upcomingTexts[1]).toContain(formatJerusalemDayHeading(appointments.bStart));
    expect(upcomingTexts[1]).toContain("Confirmed");

    const pastRows = pastSection.locator("div.flex.items-center.gap-3");
    await expect(pastRows).toHaveCount(3);
    const pastTexts = await pastRows.allTextContents();
    expect(pastTexts[0]).toContain(formatJerusalemDayHeading(appointments.eStart));
    expect(pastTexts[0]).toContain("Cancelled by doctor");
    expect(pastTexts[1]).toContain(formatJerusalemDayHeading(appointments.cStart));
    expect(pastTexts[1]).toContain("Past");
    expect(pastTexts[2]).toContain(formatJerusalemDayHeading(appointments.dStart));
    expect(pastTexts[2]).toContain("Cancelled by patient");

    // Shows the patient's name, not the doctor's own.
    await expect(page.getByText("Test patient", { exact: false }).first()).toBeVisible();

    await page.close();
  });

  test("5. T-05-08 data minimisation: the doctor's response carries exactly id/full_name on patient and no slot reason", async () => {
    const response = await doctorContext.request.get("/api/doctor/appointments");
    expect(response.status()).toBe(200);
    const body = await response.json();
    const rows = body.appointments as Array<{
      patient: Record<string, unknown> | null;
      slot: Record<string, unknown> | null;
    }>;
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.patient).not.toBeNull();
      expect(Object.keys(row.patient!).sort()).toEqual(["full_name", "id"]);
      expect(row.slot).not.toBeNull();
      expect(row.slot).not.toHaveProperty("reason");
    }
  });

  test("6. APPT-12 scoping: F never appears in the first doctor's response, which returns exactly the five fixture ids", async () => {
    const response = await doctorContext.request.get("/api/doctor/appointments");
    expect(response.status()).toBe(200);
    const body = await response.json();
    const ids = (body.appointments as Array<{ id: string }>).map((row) => row.id).sort();
    expect(ids).not.toContain(appointments.fId);
    expect(ids).toEqual(
      [appointments.aId, appointments.bId, appointments.cId, appointments.dId, appointments.eId].sort(),
    );
  });

  test("7. APPT-10 scoping: F never appears in the first patient's GET /api/patient/appointments response", async () => {
    const response = await patientContext.request.get("/api/patient/appointments");
    expect(response.status()).toBe(200);
    const body = await response.json();
    const ids = (body.appointments as Array<{ id: string }>).map((row) => row.id);
    expect(ids).not.toContain(appointments.fId);
  });

  test("8. Guards: anonymous 401, cross-role 403, and an unauthenticated browser visit redirects to /login", async ({
    request,
    browser,
  }) => {
    const anonDoctorResponse = await request.get("/api/doctor/appointments");
    expect(anonDoctorResponse.status()).toBe(401);

    const patientOnDoctorResponse = await patientContext.request.get("/api/doctor/appointments");
    expect(patientOnDoctorResponse.status()).toBe(403);

    const doctorOnPatientResponse = await doctorContext.request.get("/api/patient/appointments");
    expect(doctorOnPatientResponse.status()).toBe(403);

    const unauthContext = await browser.newContext();
    const page = await unauthContext.newPage();
    await page.goto("/doctor/appointments");
    await page.waitForURL(/\/login/);
    expect(new URL(page.url()).pathname).toBe("/login");
    await unauthContext.close();
  });

  test("9. Empty state, both pages: a freshly created patient and a freshly linked doctor each see their own empty state", async ({
    browser,
  }) => {
    const emptyPatient = await createTestUser("patient");
    const emptyPatientContext = await browser.newContext();
    await loginInContext(
      emptyPatientContext,
      { email: emptyPatient.email, password: emptyPatient.password },
      "/patient",
    );
    const patientPage = await emptyPatientContext.newPage();
    await patientPage.goto("/patient/appointments");
    await expect(patientPage.getByRole("heading", { name: "No appointments yet" })).toBeVisible();
    await expect(
      patientPage.getByText("Book an appointment with a doctor to see it here."),
    ).toBeVisible();
    await expect(patientPage.getByRole("button", { name: "Find a doctor" })).toBeVisible();
    await emptyPatientContext.close();

    const emptyDoctorUser = await createTestUser("doctor");
    const emptySpecialty = await createTestSpecialty();
    const emptyLocation = await createTestLocation();
    await createTestDoctor({
      specialtyId: emptySpecialty.id,
      locationId: emptyLocation.id,
      profileId: emptyDoctorUser.id,
      isActive: true,
    });
    const emptyDoctorContext = await browser.newContext();
    await loginInContext(
      emptyDoctorContext,
      { email: emptyDoctorUser.email, password: emptyDoctorUser.password },
      "/doctor",
    );
    const doctorPage = await emptyDoctorContext.newPage();
    await doctorPage.goto("/doctor/appointments");
    await expect(doctorPage.getByRole("heading", { name: "No appointments yet" })).toBeVisible();
    await expect(
      doctorPage.getByText("Appointments booked with you will show up here."),
    ).toBeVisible();
    await expect(doctorPage.locator("main").getByRole("button")).toHaveCount(0);
    await expect(doctorPage.locator("main").getByRole("link")).toHaveCount(0);
    await emptyDoctorContext.close();
  });

  test("10. Navigation: /doctor reaches /doctor/appointments and /patient reaches /patient/appointments", async () => {
    const doctorHomePage = await doctorContext.newPage();
    await doctorHomePage.goto("/doctor");
    await doctorHomePage.getByRole("button", { name: "My appointments" }).click();
    await doctorHomePage.waitForURL("/doctor/appointments");
    await doctorHomePage.close();

    const patientHomePage = await patientContext.newPage();
    await patientHomePage.goto("/patient");
    // /patient's dashboard (plan 06-03) renames this quick link to
    // "Appointment history" (same /patient/appointments target as the old
    // placeholder's "My appointments" button).
    await patientHomePage.getByRole("button", { name: "Appointment history" }).click();
    await patientHomePage.waitForURL("/patient/appointments");
    await patientHomePage.close();
  });

  test("11. No reschedule surface on the doctor page: with A and B rendered as upcoming rows, no rescheduling control exists anywhere", async () => {
    const page = await doctorContext.newPage();
    await page.goto("/doctor/appointments");
    await expect(page.getByTestId("upcoming-section")).toBeVisible();

    await expect(page.getByRole("button", { name: /reschedule/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /reschedule/i })).toHaveCount(0);
    await expect(page.getByText(/reschedule/i)).toHaveCount(0);

    await page.close();
  });
});
