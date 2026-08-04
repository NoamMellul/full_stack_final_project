import { expect, test } from "@playwright/test";

test.describe("AUTH-06: unauthenticated route protection", () => {
  test("an unauthenticated visitor to /patient is redirected to /login with a from param", async ({
    page,
  }) => {
    await page.goto("/patient");
    await page.waitForURL(/\/login/);
    const url = new URL(page.url());
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("from")).toBe("/patient");
    await expect(page.getByText("Nothing here yet")).not.toBeVisible();
  });

  test("an unauthenticated visitor to /doctor is redirected to /login with a from param", async ({
    page,
  }) => {
    await page.goto("/doctor");
    await page.waitForURL(/\/login/);
    const url = new URL(page.url());
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("from")).toBe("/doctor");
    await expect(page.getByText("Nothing here yet")).not.toBeVisible();
  });

  test("an unauthenticated visitor to /admin is redirected to /login with a from param", async ({
    page,
  }) => {
    await page.goto("/admin");
    await page.waitForURL(/\/login/);
    const url = new URL(page.url());
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("from")).toBe("/admin");
    await expect(page.getByText("Nothing here yet")).not.toBeVisible();
  });

  test("an unauthenticated visit to / is not redirected", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
  });

  test("an unauthenticated visit to /signup is not redirected", async ({ page }) => {
    await page.goto("/signup");
    await expect(page).toHaveURL("/signup");
  });
});
