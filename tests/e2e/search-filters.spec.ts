import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { cleanupTestSlots, createTestSlots } from "./helpers/availability";
import {
  cleanupTestReferenceData,
  createTestDoctor,
  createTestLocation,
  createTestSpecialty,
} from "./helpers/reference-data";
import { testAdminClient } from "./helpers/supabase-admin";

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

  // Plan 03-05 fixtures — specialty/language/neighborhood/availability
  // filters and their combination.
  const filterToken = `FilterToken${runSuffix}`;
  const langToken = `LangToken${runSuffix}`;
  const comboToken = `ComboToken${runSuffix}`;
  const pitfallToken = `PitfallToken${runSuffix}`;

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

  // Plan 03-05 fixtures.
  let filterSpecialty: { id: string; nameEn: string };
  let filterLocation: { id: string; city: string; neighborhood: string };
  let filterDoctorA: { id: string; fullName: string };
  let filterDoctorB: { id: string; fullName: string };

  let hebrewOnlyDoctor: { id: string; fullName: string };
  let englishOnlyDoctor: { id: string; fullName: string };

  let comboSpecialty: { id: string; nameEn: string };
  let comboHeDoctor: { id: string; fullName: string };
  let comboEnDoctor: { id: string; fullName: string };

  let pitfallDoctor: { id: string; fullName: string };

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

    // Plan 03-05 fixtures — a throwaway specialty+neighborhood shared by
    // exactly two active doctors (tests 1 and 3: specialty/neighborhood
    // filters).
    filterSpecialty = await createTestSpecialty();
    filterLocation = await createTestLocation();
    filterDoctorA = await createTestDoctor({
      fullName: `Dr. ${filterToken} Alpha`,
      specialtyId: filterSpecialty.id,
      locationId: filterLocation.id,
      isActive: true,
    });
    filterDoctorB = await createTestDoctor({
      fullName: `Dr. ${filterToken} Beta`,
      specialtyId: filterSpecialty.id,
      locationId: filterLocation.id,
      isActive: true,
    });

    // A Hebrew-only doctor and an English-only doctor sharing a name token
    // (test 2: the language filter). doctor_languages rows cascade-delete
    // with their doctor row, so no separate cleanup is needed.
    const admin = testAdminClient();
    const { data: languageRows, error: languageError } = await admin
      .from("languages")
      .select("id,code")
      .in("code", ["he", "en"]);
    if (languageError || !languageRows) {
      throw new Error(`Failed to read languages fixture rows: ${languageError?.message}`);
    }
    const heLanguageId = (languageRows as Array<{ id: string; code: string }>).find(
      (row) => row.code === "he",
    )?.id;
    const enLanguageId = (languageRows as Array<{ id: string; code: string }>).find(
      (row) => row.code === "en",
    )?.id;
    if (!heLanguageId || !enLanguageId) {
      throw new Error("Missing seeded he/en rows in languages table.");
    }

    hebrewOnlyDoctor = await createTestDoctor({
      fullName: `Dr. ${langToken} Heb`,
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });
    englishOnlyDoctor = await createTestDoctor({
      fullName: `Dr. ${langToken} Eng`,
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });

    // A separate specialty (distinct from filterSpecialty, so test 1's
    // "exactly two doctors" count stays exact) shared by a Hebrew-speaking
    // and an English-speaking doctor with a common name token (test 6:
    // specialty + language + name combination).
    comboSpecialty = await createTestSpecialty();
    comboHeDoctor = await createTestDoctor({
      fullName: `Dr. ${comboToken} HeOnly`,
      specialtyId: comboSpecialty.id,
      locationId: location.id,
      isActive: true,
    });
    comboEnDoctor = await createTestDoctor({
      fullName: `Dr. ${comboToken} EnOnly`,
      specialtyId: comboSpecialty.id,
      locationId: location.id,
      isActive: true,
    });

    const { error: doctorLanguagesError } = await admin.from("doctor_languages").insert([
      { doctor_id: hebrewOnlyDoctor.id, language_id: heLanguageId },
      { doctor_id: englishOnlyDoctor.id, language_id: enLanguageId },
      { doctor_id: comboHeDoctor.id, language_id: heLanguageId },
      { doctor_id: comboEnDoctor.id, language_id: enLanguageId },
    ]);
    if (doctorLanguagesError) {
      throw new Error(`Failed to seed doctor_languages fixture: ${doctorLanguagesError.message}`);
    }

    // A doctor whose only two future slots are 2 days out and 18 days out —
    // the RESEARCH.md Common Pitfall 3 fixture (test 4: a range covering only
    // the later slot must still return the doctor).
    pitfallDoctor = await createTestDoctor({
      fullName: `Dr. ${pitfallToken} TwoSlots`,
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });
    const pitfallEarlyStart = new Date(Date.now() + 2 * DAY_MS);
    const pitfallEarlyEnd = new Date(pitfallEarlyStart.getTime() + 30 * 60 * 1000);
    const pitfallLateStart = new Date(Date.now() + 18 * DAY_MS);
    const pitfallLateEnd = new Date(pitfallLateStart.getTime() + 30 * 60 * 1000);
    await createTestSlots(pitfallDoctor.id, [
      { startAt: pitfallEarlyStart, endAt: pitfallEarlyEnd },
      { startAt: pitfallLateStart, endAt: pitfallLateEnd },
    ]);
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

  test("name: a q consisting only of LIKE/PostgREST metacharacters matches nothing, never the unfiltered directory", async ({
    request,
  }) => {
    const baselineResponse = await request.get("/api/doctors");
    expect(baselineResponse.ok()).toBe(true);
    const baselineBody = await baselineResponse.json();
    expect(baselineBody.total).toBeGreaterThan(0);

    const whitespaceResponse = await request.get(`/api/doctors?q=${encodeURIComponent("  ")}`);
    expect(whitespaceResponse.ok()).toBe(true);
    const whitespaceBody = await whitespaceResponse.json();
    expect(whitespaceBody.total).toBe(baselineBody.total);

    for (const metacharacter of ["%", "_", "*", "\\"]) {
      const response = await request.get(`/api/doctors?q=${encodeURIComponent(metacharacter)}`);
      expect(response.ok()).toBe(true);
      const body = await response.json();
      expect(body.total).toBe(0);
      expect(body.doctors).toHaveLength(0);
    }

    const combinedMetacharactersResponse = await request.get(
      `/api/doctors?q=${encodeURIComponent("%_*")}`,
    );
    expect(combinedMetacharactersResponse.ok()).toBe(true);
    const combinedMetacharactersBody = await combinedMetacharactersResponse.json();
    expect(combinedMetacharactersBody.total).toBe(0);
    expect(combinedMetacharactersBody.doctors).toHaveLength(0);

    const mixedTermResponse = await request.get(
      `/api/doctors?q=${encodeURIComponent(`%${sharedToken}`)}`,
    );
    expect(mixedTermResponse.ok()).toBe(true);
    const mixedTermBody = await mixedTermResponse.json();
    expect(mixedTermBody.total).toBe(2);
  });

  test("name: navigating to /search?q=%25 shows the locked empty state, not the unfiltered directory", async ({
    page,
  }) => {
    await page.goto("/search?q=%25");

    await expect(page.getByRole("heading", { name: "No doctors found" })).toBeVisible();
    await expect(
      page.getByText(
        "Try adjusting your filters — search a different name, specialty, language, or neighborhood.",
      ),
    ).toBeVisible();
    await expect(page.locator('[data-slot="card"]')).toHaveCount(0);
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

  // Plan 03-05: SEARCH-02..06, D-07..09, D-13, D-14.

  test("filter: selecting the fixture specialty shows only the two doctors carrying it, and the URL gains a specialty parameter", async ({
    page,
  }) => {
    await page.goto("/search");

    await page.getByLabel("Specialty").click();
    await page.getByRole("option", { name: filterSpecialty.nameEn }).click();
    await page.waitForURL((url) => url.searchParams.get("specialty") === filterSpecialty.id);

    await expect(page.getByText(filterDoctorA.fullName)).toBeVisible();
    await expect(page.getByText(filterDoctorB.fullName)).toBeVisible();
    await expect(page.locator('[data-slot="card"]')).toHaveCount(2);
  });

  test("filter: selecting Hebrew shows the Hebrew-only doctor and hides the English-only one, and selecting English does the inverse", async ({
    page,
  }) => {
    await page.goto("/search");

    await page.getByLabel("Doctor name").fill(langToken);
    await page.waitForURL((url) => url.searchParams.get("q") === langToken);

    await page.getByLabel("Spoken language").click();
    await page.getByRole("option", { name: "Hebrew" }).click();
    await page.waitForURL((url) => url.searchParams.get("language") === "he");

    await expect(page.getByText(hebrewOnlyDoctor.fullName)).toBeVisible();
    await expect(page.getByText(englishOnlyDoctor.fullName)).not.toBeVisible();

    await page.getByLabel("Spoken language").click();
    await page.getByRole("option", { name: "English" }).click();
    await page.waitForURL((url) => url.searchParams.get("language") === "en");

    await expect(page.getByText(englishOnlyDoctor.fullName)).toBeVisible();
    await expect(page.getByText(hebrewOnlyDoctor.fullName)).not.toBeVisible();
  });

  test("filter: selecting the fixture neighborhood narrows to the doctors in it", async ({
    page,
  }) => {
    await page.goto("/search");

    await page.getByLabel("Neighborhood").click();
    await page.getByRole("option", { name: filterLocation.neighborhood }).click();
    await page.waitForURL(
      (url) => url.searchParams.get("neighborhood") === filterLocation.neighborhood,
    );

    await expect(page.getByText(filterDoctorA.fullName)).toBeVisible();
    await expect(page.getByText(filterDoctorB.fullName)).toBeVisible();
  });

  test("availability: with a range covering only day 17 through day 19, the two-slot doctor is still returned even though the doctor's earliest slot is 2 days out and therefore outside the range", async ({
    page,
  }) => {
    // Wide margin (day 15-21) around the day-18 slot so a difference between
    // the test runner's local zone and Asia/Jerusalem (max 14h) can never
    // cross a day boundary and flip which slot lands inside the range.
    const filterFrom = new Date(Date.now() + 15 * DAY_MS).toISOString().slice(0, 10);
    const filterTo = new Date(Date.now() + 21 * DAY_MS).toISOString().slice(0, 10);

    await page.goto(
      `/search?q=${encodeURIComponent(pitfallToken)}&availableFrom=${filterFrom}&availableTo=${filterTo}`,
    );

    await expect(page.getByText(pitfallDoctor.fullName)).toBeVisible();
  });

  test("availability: clicking Today sets both date inputs to the same Israeli calendar day, marks the chip selected, and puts both values in the URL", async ({
    page,
  }) => {
    await page.goto("/search");

    await page.getByRole("button", { name: "Today", exact: true }).click();
    await page.waitForURL(
      (url) => url.searchParams.has("availableFrom") && url.searchParams.has("availableTo"),
    );

    const url = new URL(page.url());
    const from = url.searchParams.get("availableFrom");
    const to = url.searchParams.get("availableTo");
    expect(from).toBe(to);

    await expect(page.getByLabel("Available from")).toHaveValue(from ?? "");
    await expect(page.getByLabel("Available to")).toHaveValue(to ?? "");
    await expect(page.getByRole("button", { name: "Today", exact: true })).toHaveClass(
      /bg-primary/,
    );
  });

  test("combination: applying specialty plus language plus name together returns only the doctor satisfying all three, and clearing the language filter widens the set", async ({
    page,
  }) => {
    await page.goto("/search");

    await page.getByLabel("Doctor name").fill(comboToken);
    await page.waitForURL((url) => url.searchParams.get("q") === comboToken);

    await page.getByLabel("Specialty").click();
    await page.getByRole("option", { name: comboSpecialty.nameEn }).click();
    await page.waitForURL((url) => url.searchParams.get("specialty") === comboSpecialty.id);

    await page.getByLabel("Spoken language").click();
    await page.getByRole("option", { name: "Hebrew" }).click();
    await page.waitForURL((url) => url.searchParams.get("language") === "he");

    await expect(page.getByText(comboHeDoctor.fullName)).toBeVisible();
    await expect(page.getByText(comboEnDoctor.fullName)).not.toBeVisible();

    // Clearing only the language filter (via direct URL navigation, the same
    // state D-13 guarantees a reload/share reproduces) widens the set back
    // to both doctors sharing the specialty and name token.
    await page.goto(
      `/search?q=${encodeURIComponent(comboToken)}&specialty=${comboSpecialty.id}`,
    );

    await expect(page.getByText(comboHeDoctor.fullName)).toBeVisible();
    await expect(page.getByText(comboEnDoctor.fullName)).toBeVisible();
  });

  test("combination: reloading the page on a fully-filtered URL reproduces the same visible result set and the same populated filter controls", async ({
    page,
  }) => {
    const filteredUrl =
      `/search?q=${encodeURIComponent(filterToken)}&specialty=${filterSpecialty.id}` +
      `&neighborhood=${encodeURIComponent(filterLocation.neighborhood)}`;

    await page.goto(filteredUrl);
    await expect(page.getByText(filterDoctorA.fullName)).toBeVisible();
    await expect(page.getByText(filterDoctorB.fullName)).toBeVisible();
    await expect(page.locator('[data-slot="card"]')).toHaveCount(2);

    await page.reload();

    await expect(page.getByText(filterDoctorA.fullName)).toBeVisible();
    await expect(page.getByText(filterDoctorB.fullName)).toBeVisible();
    await expect(page.locator('[data-slot="card"]')).toHaveCount(2);
    await expect(page.getByLabel("Doctor name")).toHaveValue(filterToken);
    await expect(page.getByLabel("Specialty")).toContainText(filterSpecialty.nameEn);
    await expect(page.getByLabel("Neighborhood")).toContainText(filterLocation.neighborhood);
  });

  test("filter: landing on a URL that already carries page=3, then changing the specialty filter, results in a URL whose page value is 1", async ({
    page,
  }) => {
    await page.goto("/search?page=3");

    await page.getByLabel("Specialty").click();
    await page.getByRole("option", { name: filterSpecialty.nameEn }).click();
    await page.waitForURL((url) => url.searchParams.get("specialty") === filterSpecialty.id);

    const url = new URL(page.url());
    expect(url.searchParams.get("page")).toBe("1");
  });

  test("filter: opening /search with no query string shows every filter control in its unset state", async ({
    page,
  }) => {
    await page.goto("/search");

    await expect(page.getByLabel("Specialty")).toContainText("All specialties");
    await expect(page.getByLabel("Spoken language")).toContainText("All languages");
    await expect(page.getByLabel("Neighborhood")).toContainText("All neighborhoods");
    await expect(page.getByLabel("Available from")).toHaveValue("");
    await expect(page.getByLabel("Available to")).toHaveValue("");
    await expect(page.getByRole("button", { name: "Today", exact: true })).not.toHaveClass(
      /bg-primary/,
    );
    await expect(
      page.getByRole("button", { name: "Next 7 days", exact: true }),
    ).not.toHaveClass(/bg-primary/);
    await expect(
      page.getByRole("button", { name: "Next 30 days", exact: true }),
    ).not.toHaveClass(/bg-primary/);
  });
});
