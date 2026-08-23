import { expect, test } from "@playwright/test";

import enDict from "../../dictionaries/en.json";
import {
  TEST_PASSWORD,
  cleanupTestUsers,
  createTestUser,
  generateRecoveryLink,
} from "./helpers/test-users";

const NEW_PASSWORD = "BrandNewPassw0rd!";
// Regex, never a glob string: Playwright's glob dialect treats `?` as a
// single-character wildcard, which silently broke two admin route stubs in
// quick 260817-lar the moment a query string appeared.
const RECOVER_ENDPOINT = /\/auth\/v1\/recover/;

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

  test("visiting /reset-password logged out with no token renders the invalid-link state and zero password inputs", async ({
    page,
  }) => {
    await page.goto("/reset-password");

    await expect(page.getByText(enDict["auth.reset_password.invalid_link_title"])).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);

    const requestNewLink = page.getByRole("link", {
      name: enDict["auth.reset_password.request_new_link"],
    });
    await expect(requestNewLink).toBeVisible();
    await requestNewLink.click();
    await expect(page).toHaveURL("/forgot-password");
  });

  test("submitting a blank email on /forgot-password shows the inline validation message and fires no Supabase request", async ({
    page,
  }) => {
    let recoverRequestFired = false;
    await page.route(RECOVER_ENDPOINT, (route) => {
      recoverRequestFired = true;
      return route.continue();
    });

    await page.goto("/forgot-password");
    await page.getByRole("button", { name: enDict["auth.forgot_password.submit"] }).click();

    await expect(page.getByText("Email is required.")).toBeVisible();
    expect(recoverRequestFired).toBe(false);
  });

  test("a stubbed Supabase 200 and a stubbed Supabase 429 both render the identical confirmation, with no error banner (T-EUO-01)", async ({
    page,
  }) => {
    await page.route(RECOVER_ENDPOINT, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
    );

    await page.goto("/forgot-password");
    await page.getByLabel(enDict["auth.forgot_password.email_label"]).fill("someone@example.com");
    await page.getByRole("button", { name: enDict["auth.forgot_password.submit"] }).click();

    await expect(page.getByText(enDict["auth.forgot_password.sent_title"])).toBeVisible();
    await expect(page.getByText(enDict["auth.forgot_password.sent_message"])).toBeVisible();
    // components/ui/alert.tsx's Alert is the only [data-slot="alert"] on
    // this page — not page.getByRole("alert"), which also matches Next's
    // always-present #__next-route-announcer__ (role="alert", used to
    // announce route changes to screen readers) and would give a false
    // "banner present" positive on every page load, error or not.
    await expect(page.locator('[data-slot="alert"]')).toHaveCount(0);
  });

  test("a stubbed Supabase 429 renders the identical confirmation as a 200, with no error banner (T-EUO-01)", async ({
    page,
  }) => {
    await page.route(RECOVER_ENDPOINT, (route) =>
      route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ error: "rate limit exceeded" }),
      }),
    );

    await page.goto("/forgot-password");
    await page.getByLabel(enDict["auth.forgot_password.email_label"]).fill("someone@example.com");
    await page.getByRole("button", { name: enDict["auth.forgot_password.submit"] }).click();

    // If this assertion fails, fix the PAGE (the error object must be
    // discarded, not branched on), not the test.
    await expect(page.getByText(enDict["auth.forgot_password.sent_title"])).toBeVisible();
    await expect(page.getByText(enDict["auth.forgot_password.sent_message"])).toBeVisible();
    await expect(page.locator('[data-slot="alert"]')).toHaveCount(0);
  });

  test("on /reset-password, a too-short password and a mismatched confirmation each block the submit with an inline message and fire no request", async ({
    page,
  }) => {
    const user = await createTestUser("patient");
    // Each recovery link is one-time — this test needs its own user/link,
    // never Task 1's already-consumed one.
    const actionLink = await generateRecoveryLink(
      user.email,
      "http://localhost:3000/reset-password",
    );

    let changePasswordRequestCount = 0;
    await page.route("**/api/auth/change-password", (route) => {
      changePasswordRequestCount += 1;
      return route.continue();
    });

    await page.goto(actionLink);
    await page.waitForURL(/\/reset-password/);
    await expect(page.getByText(enDict["auth.reset_password.title"])).toBeVisible();

    // (a) too-short password
    await page.getByLabel("New password", { exact: true }).fill("abc");
    await page.getByLabel("Confirm new password").fill("abc");
    await page.getByRole("button", { name: enDict["auth.reset_password.submit"] }).click();
    await expect(page.getByText("Password must be at least 6 characters.")).toBeVisible();

    // (b) valid password, mismatched confirmation — reuses the same
    // session/page so only one recovery link is consumed.
    await page.getByLabel("New password", { exact: true }).fill("ValidPassw0rd!");
    await page.getByLabel("Confirm new password").fill("DifferentPassw0rd!");
    await page.getByRole("button", { name: enDict["auth.reset_password.submit"] }).click();
    await expect(page.getByText(enDict["auth.reset_password.mismatch_error"])).toBeVisible();

    expect(changePasswordRequestCount).toBe(0);
  });
});
