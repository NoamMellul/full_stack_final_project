import { expect, test } from "@playwright/test";

import { cleanupTestUsers, createTestUser } from "./helpers/test-users";

type Role = "patient" | "doctor" | "admin";
type Credentials = { email: string; password: string };

const ROLES: Role[] = ["patient", "doctor", "admin"];
const ROUTES: Role[] = ["patient", "doctor", "admin"];

const HOME_BODY_COPY: Record<Role, string> = {
  patient: "This is your patient home base.",
  doctor: "This is your doctor home base.",
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
        : `a ${role} logged in is denied /${route} and redirected to / (role mismatch)`;

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
          await page.waitForURL("/");
          await expect(page).toHaveURL("/");
          await expect(page.getByText("Nothing here yet")).not.toBeVisible();
        }
      });
    }
  }

  test("defence in depth: a doctor session hitting /admin directly is denied at the layout guard behind the request gate", async ({
    page,
  }) => {
    const creds = users.doctor;

    await page.goto("/login");
    await page.getByLabel("Email").fill(creds.email);
    await page.getByLabel("Password").fill(creds.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("/doctor");

    await page.goto("/admin");
    await page.waitForURL("/");
    await expect(page).toHaveURL("/");
  });
});
