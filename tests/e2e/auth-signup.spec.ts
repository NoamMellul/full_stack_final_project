import { expect, test } from "@playwright/test";

import { testAdminClient } from "./helpers/supabase-admin";
import { TEST_PASSWORD, cleanupTestUsers, deleteTestUserByEmail, uniqueTestEmail } from "./helpers/test-users";

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
    await expect(page.getByText("Nothing here yet")).toBeVisible();

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
});
