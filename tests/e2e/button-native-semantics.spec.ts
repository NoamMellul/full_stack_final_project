import { expect, test, type Page } from "@playwright/test";

import { cleanupTestSlots } from "./helpers/availability";
import {
  cleanupTestReferenceData,
  createTestDoctor,
  createTestLocation,
  createTestSpecialty,
} from "./helpers/reference-data";
import { cleanupTestUsers, createTestUser, TEST_PASSWORD } from "./helpers/test-users";

// QUICK-260813-w0r: components/ui/button.tsx derives its nativeButton default
// from props.render's presence (Base UI's useButton isNativeButton branch,
// node_modules/@base-ui/react/internals/use-button/useButton.mjs:32-51,
// 161-165). This spec proves both directions are silent in dev mode:
//   - forward: Button render={<Link/>} (e.g. app/patient/page.tsx's quick
//     links) must not warn, and must render real <a> elements reachable by
//     an end user.
//   - reverse: a Base UI part composed as `render={<Button/>}` (e.g.
//     DialogPrimitive.Close in components/ui/dialog.tsx) must still render a
//     real <button> and must not warn either.
// Closes the deferred item logged at
// .planning/phases/06-dashboards-notifications-localization/deferred-items.md:101.

// Base UI's error() helper (@base-ui/utils/error.mjs) de-duplicates by exact
// message string in a module-scoped Set that lives for the lifetime of the
// current document. The console listener must therefore be attached before
// any navigation, and the asserted page must be reached via a hard
// page.goto() rather than client-side routing, or an earlier warning in the
// same page session could be silently swallowed (false green).
function collectNativeButtonErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && msg.text().includes("nativeButton")) {
      errors.push(msg.text());
    }
  });
  return errors;
}

async function loginAsPatient(page: Page, creds: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("/patient");
}

type DoctorFixture = {
  doctorUserId: string;
  email: string;
  doctorId: string;
};

async function setupLinkedDoctor(page: Page): Promise<DoctorFixture> {
  const doctorUser = await createTestUser("doctor");
  const specialty = await createTestSpecialty();
  const location = await createTestLocation();
  const doctor = await createTestDoctor({
    specialtyId: specialty.id,
    locationId: location.id,
    profileId: doctorUser.id,
    isActive: true,
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill(doctorUser.email);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("/doctor");

  return { doctorUserId: doctorUser.id, email: doctorUser.email, doctorId: doctor.id };
}

test.describe("QUICK-260813-w0r: Button wrapper nativeButton default is silent in both directions", () => {
  test.afterAll(async () => {
    await cleanupTestSlots();
    await cleanupTestReferenceData();
    await cleanupTestUsers();
  });

  test(
    "forward: Button render={<Link/>} quick links on /patient render as real anchors with zero nativeButton warnings",
    async ({ page }) => {
      const nativeButtonErrors = collectNativeButtonErrors(page);

      const patient = await createTestUser("patient");
      await loginAsPatient(page, patient);
      await page.goto("/patient");

      await expect(page.getByRole("button", { name: "Search doctors" })).toHaveAttribute(
        "href",
        "/search",
      );
      await expect(page.getByRole("button", { name: "My favorites" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Appointment history" })).toBeVisible();

      expect(nativeButtonErrors).toEqual([]);
    },
  );

  test(
    "reverse: DialogPrimitive.Close render={<Button/>} still renders a real <button> with zero nativeButton warnings",
    async ({ page }) => {
      const nativeButtonErrors = collectNativeButtonErrors(page);

      await setupLinkedDoctor(page);
      await page.goto("/doctor/schedule");

      await page.locator("main").getByRole("button", { name: "Add slot" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      const closeControl = dialog.locator('[data-slot="dialog-close"]');
      const tagName = await closeControl.evaluate((el) => el.tagName);
      expect(tagName).toBe("BUTTON");

      expect(nativeButtonErrors).toEqual([]);
    },
  );
});
