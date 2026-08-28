import { expect, test } from "@playwright/test";

import { testAdminClient } from "./helpers/supabase-admin";
import { cleanupTestUsers, createTestUser } from "./helpers/test-users";

type Role = "patient" | "doctor" | "admin";
type Credentials = { email: string; password: string };

const ROLES: Role[] = ["patient", "doctor", "admin"];

// Patient and doctor home routes render the shared "My dashboard" heading
// (plan 06-03); admin renders its own "Admin dashboard" heading — same
// idiom as route-protection-role-mismatch.spec.ts's HOME_BODY_COPY map.
const HOME_BODY_COPY: Record<Role, string> = {
  patient: "My dashboard",
  doctor: "My dashboard",
  admin: "Admin dashboard",
};

test.describe("root route router: / sends every visitor to the right place", () => {
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

  async function loginAs(page: import("@playwright/test").Page, creds: Credentials, role: Role) {
    await page.goto("/login");
    await page.getByLabel("Email").fill(creds.email);
    await page.getByLabel("Password").fill(creds.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL(`/${role}`);
  }

  test("an anonymous visitor to / is redirected to /login with no from param", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForURL(/\/login/);
    const url = new URL(page.url());
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("from")).toBeNull();
  });

  for (const role of ROLES) {
    test(`a signed-in ${role} visiting / lands on /${role}`, async ({ page }) => {
      await loginAs(page, users[role], role);

      await page.goto("/");
      await page.waitForURL(`/${role}`);
      await expect(page).toHaveURL(`/${role}`);
      await expect(page.getByText(HOME_BODY_COPY[role])).toBeVisible();
    });
  }

  test("an authenticated visitor with no profile row lands on /login, not a loop", async ({
    page,
  }) => {
    // `profiles.role` carries a NOT NULL + CHECK (role in ('patient','doctor',
    // 'admin')) constraint (supabase/migrations/20260803230000_initial_schema.sql:18),
    // so an "unrecognized role" string cannot be written into the row at all —
    // confirmed live: an UPDATE to role='nurse' is rejected with SQLSTATE 23514.
    // The two branches named in the must-haves truth ("profiles row is missing
    // or carries an unrecognized role") therefore collapse, at the database
    // layer, to a single reachable case: no profile row. Deleting the row
    // exercises the exact same `profile?.role ?? ""` fallback in app/page.tsx
    // that an unrecognized-role value would have, so this remains a real proof
    // of the loop-safety fallback rather than a weakened substitute.
    const stray = await createTestUser("patient");
    await loginAs(page, { email: stray.email, password: stray.password }, "patient");

    const admin = testAdminClient();
    const { error } = await admin.from("profiles").delete().eq("id", stray.id);
    expect(error).toBeNull();

    await page.goto("/");
    await page.waitForURL(/\/login/, { timeout: 15000 });
    const url = new URL(page.url());
    expect(url.pathname).toBe("/login");
  });
});
