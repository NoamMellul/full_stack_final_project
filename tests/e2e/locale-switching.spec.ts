import { expect, test, type Page } from "@playwright/test";

import heDict from "../../dictionaries/he.json";
import { cleanupTestNotifications, insertTestNotification } from "./helpers/notifications";
import {
  cleanupTestReferenceData,
  createTestDoctor,
  createTestLocation,
  createTestSpecialty,
} from "./helpers/reference-data";
import { cleanupTestUsers, createTestUser } from "./helpers/test-users";

// I18N-01/02, D-05/D-06: the language switcher (components/language-
// switcher.tsx, plan 06-05) writes a `locale` cookie via POST /api/locale
// and the root layout reads it server-side so `<html lang>`/`<html dir>`
// are correct on first paint — no client-side flash of the wrong direction.
// Declared with test.fixme so the suite stays green until 06-05 exists —
// 06-05/06-10 convert each test.fixme( to test( without touching the
// assertions.

const LOCALE_COOKIE_NAME = "locale";

async function loginAsPatient(page: Page, creds: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("/patient");
}

test.describe("I18N-01/I18N-02: language switcher and RTL mirroring", () => {
  test(
    "switching to Hebrew sets lang and dir on the html element",
    async ({ page }) => {
      await page.goto("/search");
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

      await page.getByRole("button", { name: "עברית" }).click();

      await expect(page.locator("html")).toHaveAttribute("lang", "he");
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    },
  );

  test(
    "switching back to English restores ltr",
    async ({ page, context }) => {
      await context.addCookies([
        { name: LOCALE_COOKIE_NAME, value: "he", url: "http://localhost:3000" },
      ]);
      await page.goto("/search");
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

      await page.getByRole("button", { name: "English" }).click();

      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    },
  );

  test(
    "the chosen locale survives a fresh navigation with no wrong-direction flash",
    async ({ page, context }) => {
      await context.addCookies([
        { name: LOCALE_COOKIE_NAME, value: "he", url: "http://localhost:3000" },
      ]);

      // Read the raw server-rendered HTML (before any client-side hydration
      // could correct a wrong initial value) to prove there is no flash.
      const response = await page.request.get("/search");
      const html = await response.text();
      expect(html).toContain('dir="rtl"');
      expect(html).toContain('lang="he"');

      await page.goto("/search");
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    },
  );

  test(
    "the language switcher is available to a logged-out visitor",
    async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("button", { name: "English" })).toBeVisible();
      await expect(page.getByRole("button", { name: "עברית" })).toBeVisible();
    },
  );

  test(
    "an invalid locale value is rejected",
    async ({ page }) => {
      const response = await page.request.post("/api/locale", { data: { locale: "fr" } });
      expect(response.status()).toBe(400);
    },
  );
});

// I18N-02, T-06-45/T-06-46 (06-10): the logical-property invariant has held
// by convention since 06-05 (grep audit: zero physical-direction utilities
// in app/ or components/ this session) but was never exercised at runtime —
// these two tests make the two absolute-positioned overlays this phase
// introduced (the favorite heart, the notification unread badge/popover)
// mechanically provable rather than eyeballed.
test.describe("I18N-02: RTL geometry regression tests (favorite heart, notification popover)", () => {
  test.afterAll(async () => {
    await cleanupTestReferenceData();
    await cleanupTestNotifications();
    await cleanupTestUsers();
  });

  test(
    "the favorite heart sits at the inline-end edge in both directions",
    async ({ page, context }) => {
      const specialty = await createTestSpecialty();
      const location = await createTestLocation();
      const doctor = await createTestDoctor({
        specialtyId: specialty.id,
        locationId: location.id,
        isActive: true,
      });

      // components/search/doctor-card.tsx's FavoriteToggle is the only
      // control inside the card carrying aria-pressed (the "View profile"
      // link-button does not), so this selector is locale-independent.
      await page.goto(`/search?q=${encodeURIComponent(doctor.fullName)}`);
      const cardEn = page.locator('[data-slot="card"]', { hasText: doctor.fullName });
      const heartEn = cardEn.locator('button[aria-pressed]');
      await expect(heartEn).toBeVisible();
      const cardBoxEn = await cardEn.boundingBox();
      const heartBoxEn = await heartEn.boundingBox();
      if (!cardBoxEn || !heartBoxEn) {
        throw new Error("Missing bounding box for the English-locale card or heart");
      }
      const offsetFromLeftEn = heartBoxEn.x - cardBoxEn.x;

      await context.addCookies([
        { name: LOCALE_COOKIE_NAME, value: "he", url: "http://localhost:3000" },
      ]);
      await page.goto(`/search?q=${encodeURIComponent(doctor.fullName)}`);
      const cardHe = page.locator('[data-slot="card"]', { hasText: doctor.fullName });
      const heartHe = cardHe.locator('button[aria-pressed]');
      await expect(heartHe).toBeVisible();
      const cardBoxHe = await cardHe.boundingBox();
      const heartBoxHe = await heartHe.boundingBox();
      if (!cardBoxHe || !heartBoxHe) {
        throw new Error("Missing bounding box for the Hebrew-locale card or heart");
      }
      const offsetFromLeftHe = heartBoxHe.x - cardBoxHe.x;

      // English (LTR): "end" resolves to the card's right edge, so the
      // heart sits in the card's right half (offset-from-left > half width).
      expect(offsetFromLeftEn).toBeGreaterThan(cardBoxEn.width / 2);
      // Hebrew (RTL): "end" resolves to the card's left edge instead — the
      // heart has moved to the opposite side (offset-from-left < half width).
      expect(offsetFromLeftHe).toBeLessThan(cardBoxHe.width / 2);
    },
  );

  test(
    "the notification badge and popover stay inside the viewport in Hebrew",
    async ({ page, context }) => {
      test.setTimeout(60000);
      const patient = await createTestUser("patient");
      await insertTestNotification({ userId: patient.id, type: "appointment_booked" });

      // Set the Hebrew locale cookie before login rather than mid-session:
      // /login's own labels ("Email"/"Password") must stay resolvable in
      // English for loginAsPatient's locale-independent selectors.
      await loginAsPatient(page, patient);
      await context.addCookies([
        { name: LOCALE_COOKIE_NAME, value: "he", url: "http://localhost:3000" },
      ]);
      await page.goto("/patient");
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

      const trigger = page.getByRole("button", { name: heDict["notifications.title"] });
      await expect(trigger).toBeVisible();
      await trigger.click();

      // Resolves the UI-SPEC's flagged assumption that Base UI's Popover
      // align="end" mirrors against the ambient dir context — this
      // bounding-box assertion is that proof, not an eyeballed check.
      const popover = page.locator('[data-slot="popover-content"]');
      await expect(popover).toBeVisible();
      const popoverBox = await popover.boundingBox();
      const viewport = page.viewportSize();
      if (!popoverBox || !viewport) {
        throw new Error("Missing popover bounding box or viewport size");
      }

      expect(popoverBox.x).toBeGreaterThanOrEqual(0);
      expect(popoverBox.x + popoverBox.width).toBeLessThanOrEqual(viewport.width);
    },
  );
});
