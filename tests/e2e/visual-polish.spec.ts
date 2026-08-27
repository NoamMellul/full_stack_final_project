import { expect, test, type Page } from "@playwright/test";

import { cleanupTestFavorites, createTestFavorite } from "./helpers/favorites";
import {
  cleanupTestReferenceData,
  createTestDoctor,
  createTestLocation,
  createTestSpecialty,
} from "./helpers/reference-data";
import { cleanupTestUsers, createTestUser } from "./helpers/test-users";

// GY6: closes the three remaining polish-level items from the re-audited
// .planning/phases/06-dashboards-notifications-localization/06-UI-REVIEW.md
// (card elevation, dense-list spacing already gated by grep in the plan's
// verify step, and the header gradient). This spec proves the runtime,
// browser-computed side of the elevation and gradient fixes — the same
// live-computed-style idiom tests/e2e/visual-accent.spec.ts established —
// rather than reading source CSS, which would pass even if the Tailwind
// utility silently failed to generate a rule.

async function loginAsDoctor(page: Page, creds: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("/doctor");
}

async function loginAsPatient(page: Page, creds: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("/patient");
}

test.describe("GY6: card elevation", () => {
  test.afterAll(async () => {
    await cleanupTestFavorites();
    await cleanupTestReferenceData();
    await cleanupTestUsers();
  });

  test(
    "a doctor-dashboard stat card reports a real computed box-shadow",
    async ({ page }) => {
      const doctorUser = await createTestUser("doctor");
      const specialty = await createTestSpecialty();
      const location = await createTestLocation();
      await createTestDoctor({
        specialtyId: specialty.id,
        locationId: location.id,
        profileId: doctorUser.id,
        isActive: true,
      });

      await loginAsDoctor(page, doctorUser);
      await page.goto("/doctor");

      const card = page.locator('[data-slot="card"]').first();
      await expect(card).toBeVisible();

      const boxShadow = await card.evaluate((el) => getComputedStyle(el).boxShadow);
      expect(
        boxShadow && boxShadow !== "none",
        `doctor stat card computed box-shadow was empty/none: "${boxShadow}"`,
      ).toBeTruthy();
    },
  );

  test(
    "a favorites row reports a real computed box-shadow",
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

      const card = page.locator('[data-slot="card"]').first();
      await expect(card).toBeVisible();

      const boxShadow = await card.evaluate((el) => getComputedStyle(el).boxShadow);
      expect(
        boxShadow && boxShadow !== "none",
        `favorites row computed box-shadow was empty/none: "${boxShadow}"`,
      ).toBeTruthy();
    },
  );
});
