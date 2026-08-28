import { expect, test, type Page } from "@playwright/test";

import heDict from "../../dictionaries/he.json";
import { cleanupTestUsers, createTestUser } from "./helpers/test-users";

type Role = "patient" | "doctor" | "admin";
type Credentials = { email: string; password: string };

// Mirrors components/site-nav.tsx's NAV_LINKS exactly — label + href, in
// order. Admin is deliberately absent: quick 260818-q5a removed the admin
// header nav entirely (admin navigation lives solely in
// components/admin/admin-nav.tsx). Per-role tests are the full-list,
// in-order proof that the component and this table agree.
const ROLE_LINKS: Record<"patient" | "doctor", { label: string; href: string }[]> = {
  patient: [
    { label: "Dashboard", href: "/patient" },
    { label: "Search", href: "/search" },
    { label: "Appointments", href: "/patient/appointments" },
    { label: "Favorites", href: "/patient/favorites" },
  ],
  doctor: [
    { label: "Dashboard", href: "/doctor" },
    { label: "Appointments", href: "/doctor/appointments" },
    { label: "Schedule", href: "/doctor/schedule" },
  ],
};

// Roles that render a header nav at all — admin does not (see ROLE_LINKS
// comment), so it's excluded from both per-role loops below while still
// getting a fixture user via beforeAll's `users` record.
const ROLES_WITH_HEADER_LINKS: ("patient" | "doctor")[] = ["patient", "doctor"];

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
    const doctor = await createTestUser("doctor");
    const admin = await createTestUser("admin");
    users.patient = { email: patient.email, password: patient.password };
    users.doctor = { email: doctor.email, password: doctor.password };
    users.admin = { email: admin.email, password: admin.password };
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

  for (const role of ROLES_WITH_HEADER_LINKS) {
    test(`per-role exact link set: a signed-in ${role} sees exactly their own links, in order`, async ({
      page,
    }) => {
      await loginAs(page, users[role], role);

      const nav = page.getByRole("navigation", { name: "Main navigation" });
      const texts = await nav.getByRole("link").allInnerTexts();
      expect(texts.map((text) => text.trim())).toEqual(ROLE_LINKS[role].map((link) => link.label));
    });
  }

  for (const role of ROLES_WITH_HEADER_LINKS) {
    test(`per-role click-through: a signed-in ${role} reaches every one of their links by clicking`, async ({
      page,
    }) => {
      await loginAs(page, users[role], role);

      const nav = page.getByRole("navigation", { name: "Main navigation" });
      for (const { label, href } of ROLE_LINKS[role]) {
        const link = nav.getByRole("link", { name: label, exact: true });
        await link.click();
        await page.waitForURL(href);
      }
    });
  }

  test("admin: no Main navigation landmark and no mobile Menu button; the Admin sections bar lists all seven destinations in order", async ({
    page,
  }) => {
    await loginAs(page, users.admin, "admin");

    await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);

    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await expect(page.getByRole("button", { name: "Menu", exact: true })).toHaveCount(0);

    const sectionNav = page.getByRole("navigation", { name: "Admin sections" });
    await expect(sectionNav).toBeVisible();
    const texts = await sectionNav.getByRole("link").allInnerTexts();
    expect(texts.map((text) => text.trim())).toEqual([
      "Dashboard",
      "Doctors",
      "Doctor requests",
      "Specialties",
      "Locations",
      "Users",
      "Appointments",
    ]);
  });

  test("anonymous visitor sees exactly Search, no Dashboard link, on /login and /search", async ({
    page,
  }) => {
    for (const path of ["/login", "/search"]) {
      await page.goto(path);
      const nav = page.getByRole("navigation", { name: "Main navigation" });
      const texts = await nav.getByRole("link").allInnerTexts();
      expect(texts.map((text) => text.trim())).toEqual(["Search"]);
      await expect(nav.getByRole("link", { name: "Dashboard", exact: true })).toHaveCount(0);
    }
  });

  test("the active-link marker moves with the current pathname", async ({ page }) => {
    await loginAs(page, users.patient, "patient");

    const nav = page.getByRole("navigation", { name: "Main navigation" });
    const dashboardLink = nav.getByRole("link", { name: "Dashboard", exact: true });
    const searchLink = nav.getByRole("link", { name: "Search", exact: true });

    await expect(dashboardLink).toHaveAttribute("aria-current", "page");
    expect(await searchLink.getAttribute("aria-current")).toBeNull();

    const appointmentsLink = nav.getByRole("link", { name: "Appointments", exact: true });
    await appointmentsLink.click();
    await page.waitForURL("/patient/appointments");

    await expect(appointmentsLink).toHaveAttribute("aria-current", "page");
    expect(await dashboardLink.getAttribute("aria-current")).toBeNull();
  });

  test("Hebrew: nav labels render translated, dir is rtl, and the mobile menu stays inside the viewport", async ({
    page,
    context,
  }) => {
    // Login first with English labels (the /login form's own Email/Password
    // labels must stay resolvable), then set the locale cookie and reload —
    // same idiom as tests/e2e/locale-switching.spec.ts's notification-popover
    // Hebrew test.
    await loginAs(page, users.patient, "patient");
    await context.addCookies([{ name: "locale", value: "he", url: "http://localhost:3000" }]);
    await page.goto("/patient");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const patientKeys = ["nav.dashboard", "nav.search", "nav.appointments", "nav.favorites"] as const;

    const nav = page.getByRole("navigation", { name: heDict["nav.aria_label"] });
    for (const key of patientKeys) {
      await expect(nav.getByRole("link", { name: heDict[key], exact: true })).toBeVisible();
    }

    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    const menuButton = page.getByRole("button", { name: heDict["nav.menu_label"], exact: true });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    const menu = page.getByTestId("site-nav-menu");
    const viewport = page.viewportSize();
    if (!viewport) {
      throw new Error("Missing viewport size");
    }
    for (const key of patientKeys) {
      const link = menu.getByRole("link", { name: heDict[key], exact: true });
      await expect(link).toBeVisible();
      const box = await link.boundingBox();
      if (!box) {
        throw new Error(`Missing bounding box for ${key}`);
      }
      expect(box.width).toBeGreaterThan(0);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    }
  });
});
