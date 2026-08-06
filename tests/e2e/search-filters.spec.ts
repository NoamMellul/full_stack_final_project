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

const DAY_MS = 24 * 60 * 60 * 1000;

test.describe("SEARCH-01/07/08/09: public doctor search by name", () => {
  const runSuffix = randomUUID().slice(0, 8);
  const sharedToken = `SearchToken${runSuffix}`;

  // Task 3 fixtures — case-insensitivity, Hebrew-script matching, and the
  // sort/tie-break contract.
  const mixedCaseToken = `MiXeDCase${runSuffix}`;
  const hebrewWord = "בדיקה"; // "test" — the Hebrew-script search fragment
  const sortToken = `SortToken${runSuffix}`;
  const tieToken = `TieToken${runSuffix}`;

  let specialty: { id: string; nameEn: string };
  let location: { id: string; city: string; neighborhood: string };

  let doctorWithSlot: { id: string; fullName: string };
  let doctorWithoutSlot: { id: string; fullName: string };
  let controlDoctor: { id: string; fullName: string };

  let mixedCaseDoctor: { id: string; fullName: string };
  let hebrewDoctor: { id: string; fullName: string };

  let doctor2Day: { id: string; fullName: string };
  let doctor5Day: { id: string; fullName: string };
  let doctorNoAvail: { id: string; fullName: string };

  let tieA: { id: string; fullName: string };
  let tieB: { id: string; fullName: string };

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

    const start = new Date(Date.now() + 3 * DAY_MS);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    await createTestSlots(doctorWithSlot.id, [{ startAt: start, endAt: end }]);

    mixedCaseDoctor = await createTestDoctor({
      fullName: `Dr. ${mixedCaseToken} Test`,
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });
    hebrewDoctor = await createTestDoctor({
      fullName: `ד"ר ${hebrewWord} ${runSuffix}`,
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });

    doctor2Day = await createTestDoctor({
      fullName: `Dr. ${sortToken} TwoDay`,
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });
    doctor5Day = await createTestDoctor({
      fullName: `Dr. ${sortToken} FiveDay`,
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });
    doctorNoAvail = await createTestDoctor({
      fullName: `Dr. ${sortToken} NoAvail`,
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });

    const twoDayStart = new Date(Date.now() + 2 * DAY_MS);
    const twoDayEnd = new Date(twoDayStart.getTime() + 30 * 60 * 1000);
    await createTestSlots(doctor2Day.id, [{ startAt: twoDayStart, endAt: twoDayEnd }]);

    const fiveDayStart = new Date(Date.now() + 5 * DAY_MS);
    const fiveDayEnd = new Date(fiveDayStart.getTime() + 30 * 60 * 1000);
    await createTestSlots(doctor5Day.id, [{ startAt: fiveDayStart, endAt: fiveDayEnd }]);
    // doctorNoAvail intentionally receives no slots (D-02/D-06).

    tieA = await createTestDoctor({
      fullName: `Dr. ${tieToken} Alef`,
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });
    tieB = await createTestDoctor({
      fullName: `Dr. ${tieToken} Bet`,
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });

    const tieStart = new Date(Date.now() + 10 * DAY_MS);
    const tieEnd = new Date(tieStart.getTime() + 30 * 60 * 1000);
    await createTestSlots(tieA.id, [{ startAt: tieStart, endAt: tieEnd }]);
    await createTestSlots(tieB.id, [{ startAt: tieStart, endAt: tieEnd }]);
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

  test("name: case-insensitive search matches a mixed-case stored name", async ({ page }) => {
    await page.goto("/search");

    const lowercaseFragment = mixedCaseToken.toLowerCase();
    await page.getByLabel("Doctor name").fill(lowercaseFragment);
    await page.waitForURL((url) => url.searchParams.get("q") === lowercaseFragment);

    await expect(page.getByText(mixedCaseDoctor.fullName)).toBeVisible();
  });

  test("name: a Hebrew-script fragment matches the Hebrew-named doctor", async ({ page }) => {
    await page.goto("/search");

    await page.getByLabel("Doctor name").fill(hebrewWord);
    await page.waitForURL((url) => url.searchParams.get("q") === hebrewWord);

    await expect(page.getByText(hebrewDoctor.fullName)).toBeVisible();
  });

  test("name: an absent or whitespace-only query applies no filter", async ({ page }) => {
    await page.goto("/search");
    const emptyCount = page.getByText(/^\d+ results?$/);
    await expect(emptyCount).toBeVisible();
    const emptyText = (await emptyCount.textContent()) ?? "";
    const emptyTotal = Number(emptyText.match(/\d+/)?.[0] ?? "0");
    expect(emptyTotal).toBeGreaterThan(0);

    await page.goto("/search?q=%20%20");
    const whitespaceCount = page.getByText(/^\d+ results?$/);
    await expect(whitespaceCount).toBeVisible();
    const whitespaceText = (await whitespaceCount.textContent()) ?? "";
    const whitespaceTotal = Number(whitespaceText.match(/\d+/)?.[0] ?? "0");
    expect(whitespaceTotal).toBeGreaterThan(0);
    expect(whitespaceTotal).toBe(emptyTotal);
  });

  test("no results: an unmatched search term shows the empty state", async ({ page }) => {
    await page.goto("/search");

    const noMatchToken = randomUUID();
    await page.getByLabel("Doctor name").fill(noMatchToken);
    await page.waitForURL((url) => url.searchParams.get("q") === noMatchToken);

    await expect(page.getByRole("heading", { name: "No doctors found" })).toBeVisible();
    await expect(
      page.getByText(
        "Try adjusting your filters — search a different name, specialty, language, or neighborhood.",
      ),
    ).toBeVisible();
    await expect(page.locator('[data-slot="card"]')).toHaveCount(0);
  });

  test("sort: soonest availability first, no-availability doctors last", async ({ page }) => {
    await page.goto("/search");

    await page.getByLabel("Doctor name").fill(sortToken);
    await page.waitForURL((url) => url.searchParams.get("q") === sortToken);

    const sortCards = page.locator('[data-slot="card"]').filter({ hasText: sortToken });
    await expect(sortCards).toHaveCount(3);

    const texts = await sortCards.allTextContents();
    expect(texts[0]).toContain(doctor2Day.fullName);
    expect(texts[1]).toContain(doctor5Day.fullName);
    expect(texts[2]).toContain(doctorNoAvail.fullName);

    expect(texts[0]).toContain("Next available:");
    expect(texts[1]).toContain("Next available:");
    expect(texts[2]).toContain("No upcoming availability");
  });

  test("sort: tie-break by id is deterministic across repeated requests", async ({ request }) => {
    const response1 = await request.get(`/api/doctors?q=${encodeURIComponent(tieToken)}`);
    expect(response1.ok()).toBe(true);
    const body1 = await response1.json();

    const response2 = await request.get(`/api/doctors?q=${encodeURIComponent(tieToken)}`);
    expect(response2.ok()).toBe(true);
    const body2 = await response2.json();

    const ids1 = (body1.doctors as Array<{ id: string }>).map((d) => d.id);
    const ids2 = (body2.doctors as Array<{ id: string }>).map((d) => d.id);

    expect(ids1).toEqual(ids2);
    expect(ids1).toEqual([tieA.id, tieB.id].sort());
  });
});
