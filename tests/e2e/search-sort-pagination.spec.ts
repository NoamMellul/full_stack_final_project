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
import { PAGE_SIZE } from "../../lib/validation/search";

// Proves D-11 through D-15 (numbered pagination, total count, URL-carried
// page, D-14's reset-on-filter-change) and RESEARCH.md Common Pitfall 4 —
// that paging never duplicates, skips or reshuffles a doctor, and that the
// soonest-availability sort order is stable across separate paginated
// requests. Every test drives the default anonymous context, same as
// search-filters.spec.ts — /search and GET /api/doctors are public.

const DAY_MS = 24 * 60 * 60 * 1000;
const FIXTURE_DOCTOR_COUNT = 44;
const FIXTURE_SLOT_COUNT = 20;
const PAGE_COUNT = Math.ceil(FIXTURE_DOCTOR_COUNT / PAGE_SIZE); // 8

type SearchDoctorRow = { id: string; next_available_at: string | null };

test.describe("SEARCH-08/09: pagination correctness and cross-page sort stability", () => {
  test.setTimeout(120000);

  const runSuffix = randomUUID().slice(0, 8);
  const sharedToken = `PageToken${runSuffix}`;
  const soloToken = `SoloToken${runSuffix}`;

  let specialty: { id: string; nameEn: string };
  let location: { id: string; city: string; neighborhood: string };

  // Bulk-inserted fixture (44 doctors) — tracked and deleted by this spec
  // itself rather than by cleanupTestReferenceData()'s per-id tracking,
  // since a single bulk insert never goes through createTestDoctor().
  let fixtureDoctorIds: string[] = [];

  let soloDoctor: { id: string; fullName: string };

  test.beforeAll(async () => {
    specialty = await createTestSpecialty();
    location = await createTestLocation();

    const admin = testAdminClient();

    // Single bulk insert — 44 active doctors sharing one name token, each
    // ending in a zero-padded index, so a name-filtered search yields
    // exactly PAGE_COUNT (8) pages of PAGE_SIZE (6) doctors each.
    const doctorRows = Array.from({ length: FIXTURE_DOCTOR_COUNT }, (_, index) => ({
      full_name: `Dr. ${sharedToken} ${String(index + 1).padStart(2, "0")}`,
      specialty_id: specialty.id,
      location_id: location.id,
      is_active: true,
    }));

    const { data, error } = await admin
      .from("doctors")
      .insert(doctorRows)
      .select("id, full_name");
    if (error || !data) {
      throw new Error(`Failed to bulk insert pagination fixture doctors: ${error?.message}`);
    }

    fixtureDoctorIds = (data as Array<{ id: string; full_name: string }>).map((row) => row.id);

    // The first 20 fixture doctors each get one future slot at strictly
    // increasing start times — a known sort order (these 20, soonest
    // first) followed by a known no-availability tail (the remaining 24).
    for (let index = 0; index < FIXTURE_SLOT_COUNT; index++) {
      const start = new Date(Date.now() + (index + 1) * DAY_MS);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      await createTestSlots(fixtureDoctorIds[index], [{ startAt: start, endAt: end }]);
    }

    // A single, separately-tokened doctor for the "6 or fewer results, no
    // pagination nav" assertion (test 9) — created via the normal helper so
    // cleanupTestReferenceData() tracks and removes it.
    soloDoctor = await createTestDoctor({
      fullName: `Dr. ${soloToken} Solo`,
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });
  });

  test.afterAll(async () => {
    await cleanupTestSlots();

    if (fixtureDoctorIds.length > 0) {
      const admin = testAdminClient();
      await admin.from("doctors").delete().in("id", fixtureDoctorIds);
    }

    await cleanupTestReferenceData();
  });

  async function fetchAllPages(
    request: import("@playwright/test").APIRequestContext,
    queryString: string,
  ): Promise<SearchDoctorRow[]> {
    const rows: SearchDoctorRow[] = [];
    for (let pageNumber = 1; pageNumber <= PAGE_COUNT; pageNumber++) {
      const response = await request.get(`/api/doctors?${queryString}&page=${pageNumber}`);
      expect(response.ok()).toBe(true);
      const body = await response.json();
      rows.push(...(body.doctors as SearchDoctorRow[]));
    }
    return rows;
  }

  test("pagination: searching the shared token shows exactly 6 cards on page 1 and a total count of 44", async ({
    page,
  }) => {
    await page.goto(`/search?q=${encodeURIComponent(sharedToken)}`);

    await expect(page.locator('[data-slot="card"]')).toHaveCount(PAGE_SIZE);
    await expect(page.getByText(`${FIXTURE_DOCTOR_COUNT} results`)).toBeVisible();
  });

  test("pagination: the pagination nav renders with Prev disabled and Next enabled on page 1", async ({
    page,
  }) => {
    await page.goto(`/search?q=${encodeURIComponent(sharedToken)}`);

    await expect(page.getByRole("navigation", { name: "Search results pagination" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous page" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Next page" })).toBeEnabled();
  });

  test("pagination: with 8 pages and the current page in the middle, the control condenses with an ellipsis on each side and marks the current page", async ({
    page,
  }) => {
    await page.goto(`/search?q=${encodeURIComponent(sharedToken)}&page=4`);

    await expect(page.getByRole("button", { name: "Page 1" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Page 3" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Page 4" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Page 5" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Page 8" })).toBeVisible();

    await expect(page.getByRole("button", { name: "Page 2" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Page 6" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Page 7" })).toHaveCount(0);

    await expect(page.getByRole("button", { name: "Page 4" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("pagination: clicking Next moves to page 2 and enables Prev; the last page disables Next", async ({
    page,
  }) => {
    await page.goto(`/search?q=${encodeURIComponent(sharedToken)}`);

    await page.getByRole("button", { name: "Next page" }).click();
    await page.waitForURL((url) => url.searchParams.get("page") === "2");
    await expect(page.getByRole("button", { name: "Previous page" })).toBeEnabled();

    await page.goto(`/search?q=${encodeURIComponent(sharedToken)}&page=${PAGE_COUNT}`);
    await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  test("pagination: reloading a deep-page URL renders the same six names it rendered before the reload", async ({
    page,
  }) => {
    await page.goto(`/search?q=${encodeURIComponent(sharedToken)}&page=3`);
    await expect(page.locator('[data-slot="card"]')).toHaveCount(PAGE_SIZE);
    const before = await page.locator('[data-slot="card"]').allTextContents();

    await page.reload();
    await expect(page.locator('[data-slot="card"]')).toHaveCount(PAGE_SIZE);
    const after = await page.locator('[data-slot="card"]').allTextContents();

    expect(after).toEqual(before);
  });

  test("pagination: sweeping every page from 1 to 8 with the same filter covers every fixture doctor exactly once, with no duplicate and no omission", async ({
    request,
  }) => {
    const rows = await fetchAllPages(request, `q=${encodeURIComponent(sharedToken)}`);
    const ids = rows.map((row) => row.id);

    expect(ids).toHaveLength(FIXTURE_DOCTOR_COUNT);
    expect(new Set(ids).size).toBe(FIXTURE_DOCTOR_COUNT);
    expect([...ids].sort()).toEqual([...fixtureDoctorIds].sort());
  });

  test("sort: cross-page order is soonest-availability-first with a stable, ascending-by-id null tail across repeated sweeps", async ({
    request,
  }) => {
    const queryString = `q=${encodeURIComponent(sharedToken)}`;
    const sweep1 = await fetchAllPages(request, queryString);
    const sweep2 = await fetchAllPages(request, queryString);

    // Non-decreasing next_available_at, with every null value confined to a
    // contiguous tail (RESEARCH.md Pitfall 4).
    let inNullTail = false;
    let previous: string | null = null;
    for (const row of sweep1) {
      if (row.next_available_at === null) {
        inNullTail = true;
        continue;
      }
      expect(inNullTail).toBe(false);
      if (previous !== null) {
        expect(row.next_available_at >= previous).toBe(true);
      }
      previous = row.next_available_at;
    }

    // Within the null tail, ids ascend (the id tie-break).
    const nullTailIds = sweep1
      .filter((row) => row.next_available_at === null)
      .map((row) => row.id);
    expect(nullTailIds).toEqual([...nullTailIds].sort());
    expect(nullTailIds).toHaveLength(FIXTURE_DOCTOR_COUNT - FIXTURE_SLOT_COUNT);

    // Two independent sweeps produce an identical concatenated id order —
    // the sort is stable across separate requests, not just within one.
    expect(sweep1.map((row) => row.id)).toEqual(sweep2.map((row) => row.id));
  });

  test("pagination: requesting page 99 for this filter renders the empty state, not a blank grid", async ({
    page,
  }) => {
    await page.goto(`/search?q=${encodeURIComponent(sharedToken)}&page=99`);

    await expect(page.getByRole("heading", { name: "No doctors found" })).toBeVisible();
    await expect(page.locator('[data-slot="card"]')).toHaveCount(0);
  });

  test("pagination: a filter matching 6 or fewer doctors renders the count caption but no pagination nav", async ({
    page,
  }) => {
    await page.goto(`/search?q=${encodeURIComponent(soloToken)}`);

    await expect(page.getByText("1 result")).toBeVisible();
    await expect(page.getByText(soloDoctor.fullName)).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Search results pagination" })).toHaveCount(
      0,
    );
  });

  test("pagination: changing the specialty filter while on page 4 resets the URL's page to 1 (D-14)", async ({
    page,
  }) => {
    await page.goto(`/search?q=${encodeURIComponent(sharedToken)}&page=4`);

    await page.getByLabel("Specialty").click();
    await page.getByRole("option", { name: specialty.nameEn }).click();
    await page.waitForURL((url) => url.searchParams.get("specialty") === specialty.id);

    const url = new URL(page.url());
    expect(url.searchParams.get("page")).toBe("1");

    // Every fixture doctor shares this specialty, so applying it as a
    // filter alongside the unchanged name filter still resolves to all 44 —
    // a result set consistent with the newly-applied filter.
    await expect(page.getByText(`${FIXTURE_DOCTOR_COUNT} results`)).toBeVisible();
  });
});
