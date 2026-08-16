import { expect, test } from "@playwright/test";

import { cleanupTestUsers, createTestUser } from "./helpers/test-users";

type Role = "patient" | "doctor" | "admin";
type Credentials = { email: string; password: string };

const ROLES: Role[] = ["patient", "doctor", "admin"];
const ROUTES: Role[] = ["patient", "doctor", "admin"];

// Patient and doctor home routes now render the real dashboard (plan
// 06-03) — both share the "My dashboard" <h1>, superseding the old
// per-role placeholder body copy this map originally held.
const HOME_BODY_COPY: Record<Role, string> = {
  patient: "My dashboard",
  doctor: "My dashboard",
  admin: "Admin dashboard",
};

test.describe("AUTH-07: role-versus-route denial matrix", () => {
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

  for (const role of ROLES) {
    for (const route of ROUTES) {
      const shouldAllow = role === route;
      const label = shouldAllow
        ? `a ${role} logged in reaches /${route} (matching role)`
        : `a ${role} logged in is denied /${route} and bounced to their own /${role} (role mismatch)`;

      test(label, async ({ page }) => {
        const creds = users[role];

        await page.goto("/login");
        await page.getByLabel("Email").fill(creds.email);
        await page.getByLabel("Password").fill(creds.password);
        await page.getByRole("button", { name: "Log in" }).click();
        await page.waitForURL(`/${role}`);

        await page.goto(`/${route}`);

        if (shouldAllow) {
          await expect(page).toHaveURL(`/${route}`);
          await expect(page.getByText(HOME_BODY_COPY[route])).toBeVisible();
        } else {
          // The mismatch bounce now terminates on the VISITOR's own home
          // (keyed off `role`, not `route`) since app/patient|doctor|admin's
          // layout redirect("/") chains one hop further through the new
          // auth-aware root router.
          await page.waitForURL(`/${role}`);
          await expect(page).toHaveURL(`/${role}`);
          await expect(page.getByText(HOME_BODY_COPY[role])).toBeVisible();
        }
      });
    }
  }

  test("defence in depth: a doctor session hitting /admin directly is denied at the layout guard behind the request gate, and bounced to /doctor", async ({
    page,
  }) => {
    const creds = users.doctor;

    await page.goto("/login");
    await page.getByLabel("Email").fill(creds.email);
    await page.getByLabel("Password").fill(creds.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("/doctor");

    await page.goto("/admin");
    await page.waitForURL("/doctor");
    await expect(page).toHaveURL("/doctor");
  });
});
