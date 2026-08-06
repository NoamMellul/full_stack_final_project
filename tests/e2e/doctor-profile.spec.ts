import { expect, test } from "@playwright/test";

import { formatJerusalemDayHeading, formatJerusalemTime } from "../../lib/timezone";
import { cleanupTestSlots, createTestSlots } from "./helpers/availability";
import {
  cleanupTestReferenceData,
  createTestDoctor,
  createTestLocation,
  createTestSpecialty,
} from "./helpers/reference-data";
import { testAdminClient } from "./helpers/supabase-admin";

// Every test in this spec drives the default (anonymous, no session)
// Playwright context — /doctors/[id] and GET /api/doctors/[id] are public,
// unauthenticated surfaces. No login helper is called anywhere in this file.

const DAY_MS = 24 * 60 * 60 * 1000;

test.describe("PROFILE-01/02/03, D-06, D-18: public doctor profile", () => {
  let specialty: { id: string; nameEn: string };
  let location: { id: string; city: string; neighborhood: string; address: string | null };

  let richDoctor: { id: string; fullName: string };
  let hebrewDoctor: { id: string; fullName: string };
  let bareDoctor: { id: string; fullName: string };
  let inactiveDoctor: { id: string; fullName: string };

  const richBio =
    "Board-certified physician with over fifteen years of clinical experience. " +
    "Specializes in preventive care, long-term patient relationships and evidence-based " +
    "treatment plans. Fluent in both Hebrew and English, welcoming new patients across " +
    "Tel Aviv.";

  const hebrewName = "ד\"ר יעל כהן";
  const hebrewBio = "רופאה מומחית עם ניסיון רב בטיפול בילדים ובני נוער.";

  let richDaySlots: { first: Date; second: Date };
  let richSlotSpecs: Array<{ startAt: Date; endAt: Date }>;

  test.beforeAll(async () => {
    specialty = await createTestSpecialty();
    location = await createTestLocation({ address: "12 Rothschild Blvd" });

    richDoctor = await createTestDoctor({
      fullName: `Dr. Profile Rich ${Date.now()}`,
      specialtyId: specialty.id,
      locationId: location.id,
      bio: richBio,
      isActive: true,
    });

    hebrewDoctor = await createTestDoctor({
      fullName: hebrewName,
      specialtyId: specialty.id,
      locationId: location.id,
      bio: hebrewBio,
      isActive: true,
    });

    bareDoctor = await createTestDoctor({
      fullName: `Dr. Profile Bare ${Date.now()}`,
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });

    inactiveDoctor = await createTestDoctor({
      fullName: `Dr. Profile Inactive ${Date.now()}`,
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: false,
    });

    // richDoctor: three future slots spread across two distinct Asia/Jerusalem
    // calendar days — two on day+3, one on day+6. 08:00/09:00 UTC keeps each
    // slot safely mid-day in Asia/Jerusalem (never near a local midnight
    // boundary), so the day grouping is unambiguous.
    const day3 = new Date(Date.now() + 3 * DAY_MS);
    day3.setUTCHours(8, 0, 0, 0);
    const day3Second = new Date(day3.getTime() + 60 * 60 * 1000);
    const day6 = new Date(Date.now() + 6 * DAY_MS);
    day6.setUTCHours(8, 0, 0, 0);
    richDaySlots = { first: day3, second: day6 };

    richSlotSpecs = [
      { startAt: day3, endAt: new Date(day3.getTime() + 30 * 60 * 1000) },
      { startAt: day3Second, endAt: new Date(day3Second.getTime() + 30 * 60 * 1000) },
      { startAt: day6, endAt: new Date(day6.getTime() + 30 * 60 * 1000) },
    ];
    await createTestSlots(richDoctor.id, richSlotSpecs);

    const hebrewSlotStart = new Date(Date.now() + 2 * DAY_MS);
    hebrewSlotStart.setUTCHours(8, 0, 0, 0);
    await createTestSlots(hebrewDoctor.id, [
      { startAt: hebrewSlotStart, endAt: new Date(hebrewSlotStart.getTime() + 30 * 60 * 1000) },
    ]);

    const inactiveSlotStart = new Date(Date.now() + 2 * DAY_MS);
    inactiveSlotStart.setUTCHours(9, 0, 0, 0);
    await createTestSlots(inactiveDoctor.id, [
      {
        startAt: inactiveSlotStart,
        endAt: new Date(inactiveSlotStart.getTime() + 30 * 60 * 1000),
      },
    ]);

    // Attach both spoken-language chips to richDoctor.
    const admin = testAdminClient();
    const { data: languages, error: languagesError } = await admin
      .from("languages")
      .select("id, code")
      .in("code", ["he", "en"]);
    expect(languagesError).toBeNull();
    expect(languages?.length).toBe(2);

    const { error: doctorLanguagesError } = await admin.from("doctor_languages").insert(
      (languages ?? []).map((lang) => ({
        doctor_id: richDoctor.id,
        language_id: lang.id,
      })),
    );
    expect(doctorLanguagesError).toBeNull();
  });

  test.afterAll(async () => {
    await cleanupTestSlots();
    // doctor_languages rows cascade-delete with their doctor row via
    // cleanupTestReferenceData()'s doctors delete — no separate cleanup needed.
    await cleanupTestReferenceData();
  });

  test("PROFILE-01: name, specialty, address, neighborhood, city, languages and full bio are all visible", async ({
    page,
  }) => {
    await page.goto(`/doctors/${richDoctor.id}`);

    await expect(page.getByRole("heading", { name: richDoctor.fullName })).toBeVisible();
    await expect(page.getByText(specialty.nameEn)).toBeVisible();
    await expect(
      page.getByText(`${location.address}, ${location.neighborhood}, ${location.city}`),
    ).toBeVisible();
    await expect(page.getByText("Hebrew", { exact: true })).toBeVisible();
    await expect(page.getByText("English", { exact: true })).toBeVisible();
    await expect(page.getByText(richBio)).toBeVisible();
  });

  test("PROFILE-01 encoding: a Hebrew-script name and bio survive end to end", async ({
    page,
  }) => {
    await page.goto(`/doctors/${hebrewDoctor.id}`);

    await expect(page.getByRole("heading", { name: hebrewName })).toBeVisible();
    await expect(page.getByText(hebrewBio)).toBeVisible();
  });

  test("PROFILE-01 empty: a null bio and null photo render the locked fallbacks", async ({
    page,
  }) => {
    await page.goto(`/doctors/${bareDoctor.id}`);

    await expect(page.getByText("No description provided.")).toBeVisible();

    // bareDoctor has no photo_url, so no img element renders anywhere on
    // this page (the only conditional <img> is the doctor's own photo).
    await expect(page.locator("img")).toHaveCount(0);
    await expect(page.locator('span[aria-hidden="true"]').first()).toBeVisible();
  });

  test("PROFILE-02: the Demo profile badge is visible in the header with no interaction", async ({
    page,
  }) => {
    await page.goto(`/doctors/${richDoctor.id}`);

    await expect(page.getByText("Demo profile")).toBeVisible();
  });

  test("PROFILE-03: slots render grouped by day, ascending, as two-digit 24-hour times", async ({
    page,
  }) => {
    await page.goto(`/doctors/${richDoctor.id}`);

    const dayHeadingFirst = formatJerusalemDayHeading(richDaySlots.first.toISOString());
    const dayHeadingSecond = formatJerusalemDayHeading(richDaySlots.second.toISOString());
    await expect(page.getByRole("heading", { name: dayHeadingFirst })).toBeVisible();
    await expect(page.getByRole("heading", { name: dayHeadingSecond })).toBeVisible();

    const times = page.getByText(/^\d{2}:\d{2} - \d{2}:\d{2}$/);
    await expect(times).toHaveCount(3);

    // Compare against the exact expected time strings in source (ascending
    // API) order, not a plain string sort — two slots on different calendar
    // days can share the same "HH:MM" local time, so sorting the bare
    // HH:MM strings would not reliably reflect true chronological order.
    const expectedTexts = richSlotSpecs.map(
      (spec) => `${formatJerusalemTime(spec.startAt.toISOString())} - ${formatJerusalemTime(spec.endAt.toISOString())}`,
    );
    const texts = await times.allTextContents();
    expect(texts).toEqual(expectedTexts);
    for (const text of texts) {
      expect(text).toMatch(/^\d{2}:\d{2} - \d{2}:\d{2}$/);
    }
  });

  test("disabled: every Select this slot control is disabled and force-clicking issues no request", async ({
    page,
  }) => {
    await page.goto(`/doctors/${richDoctor.id}`);

    const selectButtons = page.getByRole("button", { name: "Select this slot" });
    await expect(selectButtons).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await expect(selectButtons.nth(i)).toBeDisabled();
    }

    await expect(
      page.getByText(
        "Online booking isn't available yet in this demo — it arrives in a later phase of the project.",
      ),
    ).toBeVisible();

    let apiRequestSeen = false;
    page.on("request", (request) => {
      if (request.url().includes("/api/")) apiRequestSeen = true;
    });

    const urlBefore = page.url();
    await selectButtons.first().click({ force: true });
    await page.waitForTimeout(500);

    expect(apiRequestSeen).toBe(false);
    expect(page.url()).toBe(urlBefore);
  });

  test("D-06: a doctor with zero future slots shows the no-availability indicator and no slot control", async ({
    page,
  }) => {
    await page.goto(`/doctors/${bareDoctor.id}`);

    await expect(page.getByText("No upcoming availability")).toBeVisible();
    await expect(page.getByRole("button", { name: "Select this slot" })).toHaveCount(0);
  });

  test("not-found: a nonexistent id renders the not-found state with a working link back to search", async ({
    page,
  }) => {
    await page.goto("/doctors/00000000-0000-0000-0000-000000000000");

    await expect(page.getByRole("heading", { name: "Doctor not found" })).toBeVisible();
    await expect(
      page.getByText("This doctor profile doesn't exist or is no longer active."),
    ).toBeVisible();

    await page.getByRole("link", { name: "Back to search" }).click();
    await page.waitForURL("/search");
  });

  test("T-03-03: an inactive doctor's profile renders the same not-found state", async ({
    page,
  }) => {
    await page.goto(`/doctors/${inactiveDoctor.id}`);

    await expect(page.getByRole("heading", { name: "Doctor not found" })).toBeVisible();
    await expect(
      page.getByText("This doctor profile doesn't exist or is no longer active."),
    ).toBeVisible();
  });

  test("T-03-05: the serialized response body never contains profile_id, is_active or created_at", async ({
    request,
  }) => {
    const response = await request.get(`/api/doctors/${richDoctor.id}`);
    expect(response.ok()).toBe(true);

    const bodyText = await response.text();
    expect(bodyText).not.toContain("profile_id");
    expect(bodyText).not.toContain("is_active");
    expect(bodyText).not.toContain("created_at");
  });
});
