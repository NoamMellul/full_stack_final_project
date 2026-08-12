import { expect, test } from "@playwright/test";

import { cleanupTestUsers, createTestUser } from "./helpers/test-users";

test.describe("AUTH-04: session persistence", () => {
  test.afterAll(async () => {
    await cleanupTestUsers();
  });

  test("a session survives a full browser reload", async ({ page }) => {
    const user = await createTestUser("patient");

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("/patient");

    await page.reload();
    await expect(page).toHaveURL("/patient");
    // /patient now renders the real dashboard (plan 06-03) rather than the
    // "Nothing here yet" placeholder this test originally asserted.
    await expect(page.getByRole("heading", { name: "My dashboard" })).toBeVisible();
  });

  test("a session survives a second tab in the same browser context", async ({
    page,
    context,
  }) => {
    const user = await createTestUser("patient");

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("/patient");

    const secondPage = await context.newPage();
    await secondPage.goto("/patient");
    await expect(secondPage).toHaveURL("/patient");
    // /patient now renders the real dashboard (plan 06-03) rather than the
    // "Nothing here yet" placeholder this test originally asserted.
    await expect(secondPage.getByRole("heading", { name: "My dashboard" })).toBeVisible();
    await secondPage.close();
  });
});
