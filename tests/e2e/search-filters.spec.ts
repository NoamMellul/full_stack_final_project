import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { cleanupTestSlots, createTestSlots } from "./helpers/availability";
import {
  cleanupTestReferenceData,
  createTestDoctor,
  createTestLocation,
  createTestSpecialty,
} from "./helpers/reference-data";

// Every test in this spec drives the default (anonymous, no session)
// Playwright context — /search and GET /api/doctors are the first
// intentionally public surfaces in the app; no login helper is called here.

test.describe("SEARCH-01/07/08/09: public doctor search by name", () => {
  const runSuffix = randomUUID().slice(0, 8);
  const sharedToken = `SearchToken${runSuffix}`;

  let specialty: { id: string; nameEn: string };
  let location: { id: string; city: string; neighborhood: string };

  let doctorWithSlot: { id: string; fullName: string };
  let doctorWithoutSlot: { id: string; fullName: string };
  let controlDoctor: { id: string; fullName: string };

  test.beforeAll(async () => {
    specialty = await createTestSpecialty();
    location = await createTestLocation();

    doctorWithSlot = await createTestDoctor({
      fullName: `Dr. ${sharedToken} Alon`,
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });
    doctorWithoutSlot = await createTestDoctor({
      fullName: `Dr. ${sharedToken} Bar`,
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });
    controlDoctor = await createTestDoctor({
      fullName: `Dr. Unrelated Control ${runSuffix}`,
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });

    const start = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    await createTestSlots(doctorWithSlot.id, [{ startAt: start, endAt: end }]);
  });

  test.afterAll(async () => {
    await cleanupTestSlots();
    await cleanupTestReferenceData();
  });

  test("anonymous visitor searches by name and sees matching doctors, not the control", async ({
    page,
  }) => {
    await page.goto("/search");

    await page.getByLabel("Doctor name").fill(sharedToken);
    await page.waitForURL((url) => url.searchParams.get("q") === sharedToken);

    await expect(page.getByText(doctorWithSlot.fullName)).toBeVisible();
    await expect(page.getByText(doctorWithoutSlot.fullName)).toBeVisible();
    await expect(page.getByText(controlDoctor.fullName)).not.toBeVisible();
  });
});
