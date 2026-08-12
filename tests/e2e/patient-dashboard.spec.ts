import { expect, test, type Page } from "@playwright/test";

import { cleanupTestAppointments, createTestAppointment } from "./helpers/appointments";
import {
  cleanupTestReferenceData,
  createTestDoctor,
  createTestLocation,
  createTestSpecialty,
} from "./helpers/reference-data";
import { cleanupTestUsers, createTestUser } from "./helpers/test-users";
import { jerusalemDayKey, jerusalemWallClockToUtc } from "../../lib/timezone";

// PATIENT-04: the patient dashboard (app/patient/page.tsx, rewritten by
// plan 06-03) shows an upcoming-appointment summary and three quick links.
// Activated by 06-03 (converted from the placeholder test.fixme( declared
// in 06-01) without touching the assertions.

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

test.describe("PATIENT-04: patient dashboard upcoming summary + quick links", () => {
  test.afterAll(async () => {
    await cleanupTestAppointments();
    await cleanupTestReferenceData();
    await cleanupTestUsers();
  });

  test(
    "patient dashboard lists the next upcoming appointment",
    async ({ page }) => {
      const patient = await createTestUser("patient");
      const specialty = await createTestSpecialty();
      const location = await createTestLocation();
      const doctor = await createTestDoctor({
        specialtyId: specialty.id,
        locationId: location.id,
        isActive: true,
      });
      const { year, month, day } = futureJerusalemDay(10);
      const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
      const end = jerusalemWallClockToUtc(year, month, day, 9, 30);
      await createTestAppointment({
        doctorId: doctor.id,
        patientId: patient.id,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        status: "scheduled",
      });

      await loginAsPatient(page, patient);
      await page.goto("/patient");

      await expect(page.getByRole("heading", { name: "My dashboard" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Upcoming appointments" })).toBeVisible();
      await expect(page.getByText(doctor.fullName)).toBeVisible();
    },
  );

  test(
    "patient dashboard shows the empty state with no upcoming appointments",
    async ({ page }) => {
      const patient = await createTestUser("patient");

      await loginAsPatient(page, patient);
      await page.goto("/patient");

      await expect(page.getByRole("heading", { name: "No upcoming appointments" })).toBeVisible();
      await expect(
        page.getByText("Book a doctor to see your next appointment here."),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: "Find a doctor" })).toBeVisible();
    },
  );

  test(
    "patient dashboard quick links navigate to search, favorites and appointment history",
    async ({ page }) => {
      const patient = await createTestUser("patient");

      await loginAsPatient(page, patient);
      await page.goto("/patient");

      await expect(page.getByRole("link", { name: "Search doctors" })).toHaveAttribute(
        "href",
        "/search",
      );
      await expect(page.getByRole("link", { name: "My favorites" })).toHaveAttribute(
        "href",
        "/patient/favorites",
      );
      await expect(page.getByRole("link", { name: "Appointment history" })).toHaveAttribute(
        "href",
        "/patient/appointments",
      );
    },
  );
});
