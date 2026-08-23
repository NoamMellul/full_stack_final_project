import { expect, test } from "@playwright/test";

import {
  TEST_PASSWORD,
  cleanupTestUsers,
  createTestUser,
  generateRecoveryLink,
} from "./helpers/test-users";

const NEW_PASSWORD = "BrandNewPassw0rd!";

test.describe("EUO: forgot / reset password", () => {
  test.afterAll(async () => {
    await cleanupTestUsers();
  });

  test("a patient follows a real recovery link, sets a new password, and the old password is rejected while the new one works", async ({
    page,
    context,
  }) => {
    const user = await createTestUser("patient");

    const actionLink = await generateRecoveryLink(
      user.email,
      "http://localhost:3000/reset-password",
    );

    await page.goto(actionLink);
    await page.waitForURL(/\/reset-password/);
    // Also the precondition assertion: landing anywhere other than
    // /reset-password means the redirect URL is not allow-listed in the
    // Supabase Dashboard (see 260823-euo-PLAN.md user_setup).
    await expect(page.getByText("Choose a new password")).toBeVisible();

    await page.getByLabel("New password", { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel("Confirm new password").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Save new password" }).click();

    await page.waitForURL("/patient");

    await context.clearCookies();

    const oldPasswordResponse = await page.request.post("/api/auth/login", {
      data: { email: user.email, password: TEST_PASSWORD },
    });
    expect(oldPasswordResponse.status()).toBe(401);

    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("/patient");
  });
});
