import { expect, test, type Locator, type Page } from "@playwright/test";

import { cleanupTestAppointments, createTestAppointment } from "./helpers/appointments";
import { cleanupTestSlots, createTestSlots } from "./helpers/availability";
import {
  cleanupTestReferenceData,
  createTestDoctor,
  createTestLocation,
  createTestSpecialty,
} from "./helpers/reference-data";
import { cleanupTestUsers, createTestUser } from "./helpers/test-users";
import { jerusalemDayKey, jerusalemWallClockToUtc } from "../../lib/timezone";

// DOCTOR-01/02: the doctor dashboard (app/doctor/(gated)/page.tsx,
// rewritten by plan 06-03) shows two head-only counts — upcoming
// appointments and available slots — reusing app/admin/page.tsx's stat-card
// markup ([data-slot="card"], per components/ui/card.tsx). Declared with
// test.fixme so the suite stays green until 06-03 exists — 06-03 converts
// each test.fixme( to test( without touching the assertions.

function futureJerusalemDay(daysAhead: number): { year: number; month: number; day: number } {
  const future = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const dayKey = jerusalemDayKey(future.toISOString());
  const [year, month, day] = dayKey.split("-").map(Number);
  return { year, month, day };
}

async function loginAsDoctor(page: Page, creds: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("/doctor");
}

function statCardValue(page: Page, caption: string): Locator {
  return page.locator('[data-slot="card"]', { hasText: caption }).locator("span").first();
}

test.describe("DOCTOR-01/02: doctor dashboard upcoming + available-slot counts", () => {
  test.afterAll(async () => {
    await cleanupTestAppointments();
    await cleanupTestSlots();
    await cleanupTestReferenceData();
    await cleanupTestUsers();
  });

  test.fixme(
    "doctor dashboard shows the upcoming appointment count",
    async ({ page }) => {
      const doctorUser = await createTestUser("doctor");
      const specialty = await createTestSpecialty();
      const location = await createTestLocation();
      const doctor = await createTestDoctor({
        specialtyId: specialty.id,
        locationId: location.id,
        profileId: doctorUser.id,
        isActive: true,
      });

      const dayOne = futureJerusalemDay(10);
      const dayTwo = futureJerusalemDay(11);
      await createTestAppointment({
        doctorId: doctor.id,
        patientId: (await createTestUser("patient")).id,
        startAt: jerusalemWallClockToUtc(dayOne.year, dayOne.month, dayOne.day, 9, 0).toISOString(),
        endAt: jerusalemWallClockToUtc(dayOne.year, dayOne.month, dayOne.day, 9, 30).toISOString(),
        status: "scheduled",
      });
      await createTestAppointment({
        doctorId: doctor.id,
        patientId: (await createTestUser("patient")).id,
        startAt: jerusalemWallClockToUtc(dayTwo.year, dayTwo.month, dayTwo.day, 9, 0).toISOString(),
        endAt: jerusalemWallClockToUtc(dayTwo.year, dayTwo.month, dayTwo.day, 9, 30).toISOString(),
        status: "scheduled",
      });

      await loginAsDoctor(page, doctorUser);
      await page.goto("/doctor");

      await expect(page.getByRole("heading", { name: "My dashboard" })).toBeVisible();
      await expect(statCardValue(page, "Upcoming appointments")).toHaveText("2");
    },
  );

  test.fixme(
    "doctor dashboard shows the remaining available slot count",
    async ({ page }) => {
      const doctorUser = await createTestUser("doctor");
      const specialty = await createTestSpecialty();
      const location = await createTestLocation();
      const doctor = await createTestDoctor({
        specialtyId: specialty.id,
        locationId: location.id,
        profileId: doctorUser.id,
        isActive: true,
      });

      const dayOne = futureJerusalemDay(20);
      const dayTwo = futureJerusalemDay(21);
      const dayThree = futureJerusalemDay(22);
      await createTestSlots(doctor.id, [
        {
          startAt: jerusalemWallClockToUtc(dayOne.year, dayOne.month, dayOne.day, 9, 0),
          endAt: jerusalemWallClockToUtc(dayOne.year, dayOne.month, dayOne.day, 9, 30),
        },
        {
          startAt: jerusalemWallClockToUtc(dayTwo.year, dayTwo.month, dayTwo.day, 9, 0),
          endAt: jerusalemWallClockToUtc(dayTwo.year, dayTwo.month, dayTwo.day, 9, 30),
        },
        {
          startAt: jerusalemWallClockToUtc(dayThree.year, dayThree.month, dayThree.day, 9, 0),
          endAt: jerusalemWallClockToUtc(dayThree.year, dayThree.month, dayThree.day, 9, 30),
        },
      ]);

      await loginAsDoctor(page, doctorUser);
      await page.goto("/doctor");

      await expect(statCardValue(page, "Available slots")).toHaveText("3");
    },
  );

  test.fixme(
    "a cancelled appointment is not counted as upcoming",
    async ({ page }) => {
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
      const { year, month, day } = futureJerusalemDay(30);
      const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
      const end = jerusalemWallClockToUtc(year, month, day, 9, 30);
      await createTestAppointment({
        doctorId: doctor.id,
        patientId: patient.id,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        status: "cancelled_by_patient",
      });

      await loginAsDoctor(page, doctorUser);
      await page.goto("/doctor");

      await expect(statCardValue(page, "Upcoming appointments")).toHaveText("0");
    },
  );

  test.fixme(
    "a past slot is not counted as available",
    async ({ page }) => {
      const doctorUser = await createTestUser("doctor");
      const specialty = await createTestSpecialty();
      const location = await createTestLocation();
      const doctor = await createTestDoctor({
        specialtyId: specialty.id,
        locationId: location.id,
        profileId: doctorUser.id,
        isActive: true,
      });
      const pastStart = new Date(Date.now() - 60 * 60 * 1000);
      const pastEnd = new Date(Date.now() - 30 * 60 * 1000);
      await createTestSlots(doctor.id, [{ startAt: pastStart, endAt: pastEnd }]);

      await loginAsDoctor(page, doctorUser);
      await page.goto("/doctor");

      await expect(statCardValue(page, "Available slots")).toHaveText("0");
    },
  );
});
