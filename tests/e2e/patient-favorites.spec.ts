import { expect, test, type Page } from "@playwright/test";

import { cleanupTestFavorites, createTestFavorite, readFavoriteIds } from "./helpers/favorites";
import {
  cleanupTestReferenceData,
  createTestDoctor,
  createTestLocation,
  createTestSpecialty,
} from "./helpers/reference-data";
import { cleanupTestUsers, createTestUser } from "./helpers/test-users";

// PATIENT-01/02/03, D-01: favoriting a doctor from either of the toggle's
// two entry points (doctor profile, search result card), the removal flow
// on /patient/favorites, and the empty/IDOR edges. Every test here is
// declared with test.fixme so the suite stays green while
// components/favorite-toggle.tsx and the /api/patient/favorites routes
// (owned by plan 06-02) do not exist yet — 06-02 converts each test.fixme(
// to test( without touching the assertions.

async function loginAsPatient(page: Page, creds: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("/patient");
}

test.describe("PATIENT-01/02/03: favorites — add, remove, cross-entry-point consistency", () => {
  test.afterAll(async () => {
    await cleanupTestFavorites();
    await cleanupTestReferenceData();
    await cleanupTestUsers();
  });

  test.fixme(
    "patient adds a favorite from the doctor profile page",
    async ({ page }) => {
      const patient = await createTestUser("patient");
      const specialty = await createTestSpecialty();
      const location = await createTestLocation();
      const doctor = await createTestDoctor({
        specialtyId: specialty.id,
        locationId: location.id,
        isActive: true,
      });

      await loginAsPatient(page, patient);
      await page.goto(`/doctors/${doctor.id}`);

      const toggle = page.getByRole("button", { name: "Add to favorites" });
      await expect(toggle).toBeVisible();
      await toggle.click();

      await expect(page.getByRole("button", { name: "Remove from favorites" })).toBeVisible();
      expect(await readFavoriteIds(patient.id)).toContain(doctor.id);
    },
  );

  test.fixme(
    "patient adds a favorite from a search result card",
    async ({ page }) => {
      const patient = await createTestUser("patient");
      const specialty = await createTestSpecialty();
      const location = await createTestLocation();
      const doctor = await createTestDoctor({
        specialtyId: specialty.id,
        locationId: location.id,
        isActive: true,
      });

      await loginAsPatient(page, patient);
      await page.goto(`/search?q=${encodeURIComponent(doctor.fullName)}`);
      await expect(page.getByText(doctor.fullName)).toBeVisible();

      const toggle = page.getByRole("button", { name: "Add to favorites" });
      await toggle.click();

      await expect(page.getByRole("button", { name: "Remove from favorites" })).toBeVisible();
      expect(await readFavoriteIds(patient.id)).toContain(doctor.id);
    },
  );

  test.fixme(
    "favorite state added on the profile page is reflected on the search results page",
    async ({ page }) => {
      const patient = await createTestUser("patient");
      const specialty = await createTestSpecialty();
      const location = await createTestLocation();
      const doctor = await createTestDoctor({
        specialtyId: specialty.id,
        locationId: location.id,
        isActive: true,
      });

      await loginAsPatient(page, patient);
      await page.goto(`/doctors/${doctor.id}`);
      await page.getByRole("button", { name: "Add to favorites" }).click();
      await expect(page.getByRole("button", { name: "Remove from favorites" })).toBeVisible();

      await page.goto(`/search?q=${encodeURIComponent(doctor.fullName)}`);
      await expect(page.getByRole("button", { name: "Remove from favorites" })).toBeVisible();
    },
  );

  test.fixme(
    "patient removes a favorite from the favorites list",
    async ({ page }) => {
      const patient = await createTestUser("patient");
      const specialty = await createTestSpecialty();
      const location = await createTestLocation();
      const doctor = await createTestDoctor({
        specialtyId: specialty.id,
        locationId: location.id,
        isActive: true,
      });
      await createTestFavorite({ patientId: patient.id, doctorId: doctor.id });

      await loginAsPatient(page, patient);
      await page.goto("/patient/favorites");

      await expect(page.getByRole("heading", { name: "My favorites" })).toBeVisible();
      await expect(page.getByText(doctor.fullName)).toBeVisible();

      await page.getByRole("button", { name: "Remove from favorites" }).click();

      await expect(page.getByText(doctor.fullName)).not.toBeVisible();
      expect(await readFavoriteIds(patient.id)).not.toContain(doctor.id);
    },
  );

  test.fixme(
    "favorites list shows the empty state when the patient has no favorites",
    async ({ page }) => {
      const patient = await createTestUser("patient");

      await loginAsPatient(page, patient);
      await page.goto("/patient/favorites");

      await expect(page.getByRole("heading", { name: "No favorites yet" })).toBeVisible();
      await expect(
        page.getByText("Save doctors you like to find them quickly next time."),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: "Find a doctor" })).toBeVisible();
    },
  );

  test.fixme(
    "another patient's favorites are never returned",
    async ({ page }) => {
      const victim = await createTestUser("patient");
      const attacker = await createTestUser("patient");
      const specialty = await createTestSpecialty();
      const location = await createTestLocation();
      const doctor = await createTestDoctor({
        specialtyId: specialty.id,
        locationId: location.id,
        isActive: true,
      });
      await createTestFavorite({ patientId: victim.id, doctorId: doctor.id });

      await loginAsPatient(page, attacker);
      const response = await page.request.delete(`/api/patient/favorites/${doctor.id}`);
      expect(response.status()).toBe(404);

      expect(await readFavoriteIds(victim.id)).toContain(doctor.id);
    },
  );
});
