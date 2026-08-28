import { expect, test } from "@playwright/test";

import { cleanupTestUsers, createTestUser } from "./helpers/test-users";

test.describe("AUTH-05: doctor login", () => {
  test.afterAll(async () => {
    await cleanupTestUsers();
  });

  test("a doctor account created outside any signup route logs in and lands on /doctor", async ({
    page,
  }) => {
    const doctor = await createTestUser("doctor");

    await page.goto("/login");
    await page.getByLabel("Email").fill(doctor.email);
    await page.getByLabel("Password").fill(doctor.password);
    await page.getByRole("button", { name: "Log in" }).click();

    await page.waitForURL("/doctor");
    // /doctor now renders the real dashboard (plan 06-03) rather than the
    // "Nothing here yet" placeholder this test originally asserted.
    await expect(page.getByRole("heading", { name: "My dashboard" })).toBeVisible();
  });

  test("a doctor account cannot reach /patient, and is bounced back to /doctor", async ({
    page,
  }) => {
    const doctor = await createTestUser("doctor");

    await page.goto("/login");
    await page.getByLabel("Email").fill(doctor.email);
    await page.getByLabel("Password").fill(doctor.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("/doctor");

    await page.goto("/patient");
    await page.waitForURL("/doctor");
    await expect(page).toHaveURL("/doctor");
  });

  test("an admin account logs in and lands on /admin", async ({ page }) => {
    const admin = await createTestUser("admin");

    await page.goto("/login");
    await page.getByLabel("Email").fill(admin.email);
    await page.getByLabel("Password").fill(admin.password);
    await page.getByRole("button", { name: "Log in" }).click();

    await page.waitForURL("/admin");
    await expect(page.getByRole("heading", { name: "Admin dashboard" })).toBeVisible();
    await expect(page.getByText("Registered users")).toBeVisible();
  });
});
