import { expect, test } from "@playwright/test";

import { cleanupTestUsers, createTestUser } from "./helpers/test-users";

const LOGOUT_FAILURE = "Could not log out. Please try again.";

test.describe("AUTH-03: logout", () => {
  test.afterAll(async () => {
    await cleanupTestUsers();
  });

  test("logging out returns the user to /", async ({ page }) => {
    const user = await createTestUser("patient");

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("/patient");

    await page.getByRole("button", { name: "Log out" }).click();
    await page.waitForURL("/");
    await expect(page).toHaveURL("/");
  });

  test("after logout, navigating to /patient redirects to /login instead of rendering it", async ({
    page,
  }) => {
    const user = await createTestUser("patient");

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("/patient");

    await page.getByRole("button", { name: "Log out" }).click();
    await page.waitForURL("/");

    await page.goto("/patient");
    await expect(page).toHaveURL(/\/login/);
  });

  test("the logout control disables itself while the request is in flight", async ({ page }) => {
    const user = await createTestUser("patient");

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("/patient");

    await page.route("**/api/auth/logout", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });

    const logoutButton = page.getByRole("button", { name: "Log out" });
    await logoutButton.click();
    await expect(logoutButton).toBeDisabled();
    await page.waitForURL("/");
  });

  test("a failed logout request shows the failure copy and re-enables the control", async ({
    page,
  }) => {
    const user = await createTestUser("patient");

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("/patient");

    await page.route("**/api/auth/logout", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: LOGOUT_FAILURE }),
      }),
    );

    const logoutButton = page.getByRole("button", { name: "Log out" });
    await logoutButton.click();

    await expect(page.getByText(LOGOUT_FAILURE)).toBeVisible();
    await expect(logoutButton).toBeEnabled();
    await expect(page).toHaveURL("/patient");
  });
});
