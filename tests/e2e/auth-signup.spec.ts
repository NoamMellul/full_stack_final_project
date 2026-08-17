import { expect, test } from "@playwright/test";

import { testAdminClient } from "./helpers/supabase-admin";
import {
  TEST_PASSWORD,
  cleanupTestUsers,
  createTestUser,
  deleteTestUserByEmail,
  uniqueTestEmail,
} from "./helpers/test-users";

test.describe("AUTH-01: patient signup", () => {
  const uiCreatedEmails: string[] = [];

  test.afterAll(async () => {
    await cleanupTestUsers();
    for (const email of uiCreatedEmails) {
      await deleteTestUserByEmail(email);
    }
  });

  test("a visitor can sign up and land on /patient already authenticated", async ({ page }) => {
    const email = uniqueTestEmail("signup");
    uiCreatedEmails.push(email);

    await page.goto("/signup");
    await page.getByLabel("Full name").fill("Signup Tracer");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    await page.waitForURL("/patient");
    // /patient now renders the real dashboard (plan 06-03) rather than the
    // "Nothing here yet" placeholder this test originally asserted.
    await expect(page.getByRole("heading", { name: "My dashboard" })).toBeVisible();

    const admin = testAdminClient();
    const { data: profile, error } = await admin
      .from("profiles")
      .select("role")
      .eq("email", email)
      .single();

    expect(error).toBeNull();
    expect(profile?.role).toBe("patient");
  });

  test("a request body claiming role=admin is ignored — the account is always a patient", async ({
    request,
  }) => {
    const email = uniqueTestEmail("privesc");
    uiCreatedEmails.push(email);

    const response = await request.post("/api/auth/signup", {
      data: {
        email,
        password: TEST_PASSWORD,
        fullName: "Privilege Escalation Attempt",
        role: "admin",
      },
    });

    expect(response.ok()).toBe(true);

    const admin = testAdminClient();
    const { data: profile, error } = await admin
      .from("profiles")
      .select("role")
      .eq("email", email)
      .single();

    expect(error).toBeNull();
    expect(profile?.role).toBe("patient");
  });

  test("a non-string email in the request body returns 400, not a 500 (T-EQS-04)", async ({
    request,
  }) => {
    const response = await request.post("/api/auth/signup", {
      data: {
        email: 123,
        password: TEST_PASSWORD,
        fullName: "Non-String Email Tester",
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Email is required.");
  });

  test("submitting a completely empty form shows inline required errors and makes no network call", async ({
    page,
  }) => {
    let signupRequestFired = false;
    await page.route("**/api/auth/signup", (route) => {
      signupRequestFired = true;
      return route.continue();
    });

    await page.goto("/signup");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Email is required.")).toBeVisible();
    await expect(page.getByText("Password is required.")).toBeVisible();
    await expect(page.getByText("Full name is required.")).toBeVisible();
    expect(signupRequestFired).toBe(false);
  });

  test("a syntactically bad email shows only the email error, makes no network call, and keeps other field values", async ({
    page,
  }) => {
    let signupRequestFired = false;
    await page.route("**/api/auth/signup", (route) => {
      signupRequestFired = true;
      return route.continue();
    });

    await page.goto("/signup");
    await page.getByLabel("Full name").fill("Bad Email Tester");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Invalid email format.")).toBeVisible();
    await expect(page.getByText("Password is required.")).not.toBeVisible();
    await expect(page.getByText("Full name is required.")).not.toBeVisible();
    await expect(page.getByLabel("Full name")).toHaveValue("Bad Email Tester");
    await expect(page.getByLabel("Password")).toHaveValue(TEST_PASSWORD);
    expect(signupRequestFired).toBe(false);
  });

  test("a five-character password shows only the password-length error and makes no network call", async ({
    page,
  }) => {
    const email = uniqueTestEmail("shortpw");
    let signupRequestFired = false;
    await page.route("**/api/auth/signup", (route) => {
      signupRequestFired = true;
      return route.continue();
    });

    await page.goto("/signup");
    await page.getByLabel("Full name").fill("Short Password Tester");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("abcde");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Password must be at least 6 characters.")).toBeVisible();
    await expect(page.getByText("Email is required.")).not.toBeVisible();
    await expect(page.getByText("Full name is required.")).not.toBeVisible();
    expect(signupRequestFired).toBe(false);
  });

  test("the submit button disables and reads 'Creating account…' while the request is in flight", async ({
    page,
  }) => {
    const email = uniqueTestEmail("inflight");
    uiCreatedEmails.push(email);

    await page.route("**/api/auth/signup", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue();
    });

    await page.goto("/signup");
    await page.getByLabel("Full name").fill("In Flight Tester");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    const submitButton = page.getByRole("button", { name: "Creating account…" });
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeDisabled();

    await page.waitForURL("/patient");
  });

  test("signing up with an email that already has an account shows the duplicate-account error", async ({
    page,
  }) => {
    const existing = await createTestUser("patient");

    await page.goto("/signup");
    await page.getByLabel("Full name").fill("Duplicate Email Tester");
    await page.getByLabel("Email").fill(existing.email);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(
      page.getByText("An account with this email already exists. Try logging in instead."),
    ).toBeVisible();
    await expect(page).toHaveURL("/signup");
    await expect(page.getByRole("button", { name: "Create account" })).toBeEnabled();
  });
});

test.describe("app/patient/layout.tsx role guard", () => {
  test("opening /patient without a session redirects to /login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/patient");
    // The root proxy.ts request gate (Plan 05) now redirects unauthenticated
    // requests with a `?from=` return-path param, so the URL is no longer
    // an exact "/login" match.
    await page.waitForURL(/\/login/);
    const url = new URL(page.url());
    expect(url.pathname).toBe("/login");
  });
});
