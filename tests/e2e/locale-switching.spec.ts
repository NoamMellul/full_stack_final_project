import { expect, test } from "@playwright/test";

// I18N-01/02, D-05/D-06: the language switcher (components/language-
// switcher.tsx, plan 06-05) writes a `locale` cookie via POST /api/locale
// and the root layout reads it server-side so `<html lang>`/`<html dir>`
// are correct on first paint — no client-side flash of the wrong direction.
// Declared with test.fixme so the suite stays green until 06-05 exists —
// 06-05/06-10 convert each test.fixme( to test( without touching the
// assertions.

const LOCALE_COOKIE_NAME = "locale";

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
