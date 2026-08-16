import { expect, test, type Page } from "@playwright/test";

import { cleanupTestUsers, createTestUser } from "./helpers/test-users";

type Role = "patient" | "doctor" | "admin";
type Credentials = { email: string; password: string };

async function loginAs(page: Page, creds: Credentials, role: Role) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(`/${role}`);
}

// GSD-260816-g33: role-aware in-app navigation bar. Task 1 proves one path
// end-to-end (patient reaching /patient/appointments by clicking, on both
// the desktop inline nav and the mobile hamburger menu) before Task 2 widens
// coverage to every role, the anonymous visitor, the active-link marker and
// Hebrew rendering.
test.describe("site nav: a patient reaches /patient/appointments by clicking", () => {
  const users: Record<Role, Credentials> = {
    patient: { email: "", password: "" },
    doctor: { email: "", password: "" },
    admin: { email: "", password: "" },
  };

  test.beforeAll(async () => {
    const patient = await createTestUser("patient");
    users.patient = { email: patient.email, password: patient.password };
  });

  test.afterAll(async () => {
    await cleanupTestUsers();
  });

  test("desktop: clicking Appointments in the header nav navigates to /patient/appointments", async ({
    page,
  }) => {
    await loginAs(page, users.patient, "patient");

    const nav = page.getByRole("navigation", { name: "Main navigation" });
    const link = nav.getByRole("link", { name: "Appointments", exact: true });
    await expect(link).toBeVisible();
    await link.click();

    await page.waitForURL("/patient/appointments");
    await expect(page.getByRole("heading", { name: "My appointments" })).toBeVisible();
  });

  test("mobile: opening the Menu popover and clicking Appointments navigates to /patient/appointments", async ({
    page,
  }) => {
    await loginAs(page, users.patient, "patient");
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();

    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav).not.toBeVisible();

    const menuButton = page.getByRole("button", { name: "Menu", exact: true });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    const menu = page.getByTestId("site-nav-menu");
    const link = menu.getByRole("link", { name: "Appointments", exact: true });
    await link.click();

    await page.waitForURL("/patient/appointments");
    await expect(page.getByRole("heading", { name: "My appointments" })).toBeVisible();
    await expect(page.getByTestId("site-nav-menu")).not.toBeVisible();
  });
});
