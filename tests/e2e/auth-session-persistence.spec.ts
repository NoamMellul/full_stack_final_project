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
    await expect(page.getByText("Nothing here yet")).toBeVisible();
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
    await expect(secondPage.getByText("Nothing here yet")).toBeVisible();
    await secondPage.close();
  });
});
