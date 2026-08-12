import { expect, test } from "@playwright/test";

import { TEST_PASSWORD, cleanupTestUsers, createTestUser, uniqueTestEmail } from "./helpers/test-users";

const GENERIC_ERROR = "Incorrect email or password. Please try again.";

test.describe("AUTH-02: patient login", () => {
  test.afterAll(async () => {
    await cleanupTestUsers();
  });

  test("a registered patient logs in and lands on /patient", async ({ page }) => {
    const user = await createTestUser("patient");

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Log in" }).click();

    await page.waitForURL("/patient");
    // /patient now renders the real dashboard (plan 06-03) rather than the
    // "Nothing here yet" placeholder this test originally asserted.
    await expect(page.getByRole("heading", { name: "My dashboard" })).toBeVisible();
  });

  test("a wrong password and an unregistered address return the byte-identical message", async ({
    request,
  }) => {
    const user = await createTestUser("patient");

    const wrongPasswordResponse = await request.post("/api/auth/login", {
      data: { email: user.email, password: "not-the-right-password" },
    });
    const unknownAddressResponse = await request.post("/api/auth/login", {
      data: { email: uniqueTestEmail("unknown"), password: TEST_PASSWORD },
    });

    expect(wrongPasswordResponse.status()).toBe(401);
    expect(unknownAddressResponse.status()).toBe(401);

    const wrongPasswordBody = await wrongPasswordResponse.json();
    const unknownAddressBody = await unknownAddressResponse.json();

    expect(wrongPasswordBody.error).toBe(GENERIC_ERROR);
    expect(unknownAddressBody.error).toBe(GENERIC_ERROR);
    expect(wrongPasswordBody).toStrictEqual(unknownAddressBody);
  });

  test("visiting /login?from=/patient and logging in lands on /patient", async ({ page }) => {
    const user = await createTestUser("patient");

    await page.goto("/login?from=/patient");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Log in" }).click();

    await page.waitForURL("/patient");
    await expect(page).toHaveURL("/patient");
  });

  test("an absolute-URL from param never sends the browser off-site", async ({ page }) => {
    const user = await createTestUser("patient");

    await page.goto("/login?from=https://evil.example.com");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Log in" }).click();

    await page.waitForURL("/patient");
    await expect(page).toHaveURL("/patient");
  });

  test("a protocol-relative from param never sends the browser off-site", async ({ page }) => {
    const user = await createTestUser("patient");

    await page.goto("/login?from=//evil.example.com");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Log in" }).click();

    await page.waitForURL("/patient");
    await expect(page).toHaveURL("/patient");
  });

  test("submitting a completely empty form shows inline required errors and makes no network call", async ({
    page,
  }) => {
    let loginRequestFired = false;
    await page.route("**/api/auth/login", (route) => {
      loginRequestFired = true;
      return route.continue();
    });

    await page.goto("/login");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByText("Email is required.")).toBeVisible();
    await expect(page.getByText("Password is required.")).toBeVisible();
    expect(loginRequestFired).toBe(false);
  });

  test("a wrong password shows the generic error banner in the login form", async ({ page }) => {
    const user = await createTestUser("patient");

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill("not-the-right-password");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByText(GENERIC_ERROR)).toBeVisible();
    await expect(page).toHaveURL("/login");
    await expect(page.getByRole("button", { name: "Log in" })).toBeEnabled();
  });
});
