import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { cleanupTestAppointments, createTestAppointment } from "./helpers/appointments";
import { cleanupTestSlots, createTestSlots } from "./helpers/availability";
import {
  cleanupTestNotifications,
  insertTestNotification,
  readNotificationsFor,
} from "./helpers/notifications";
import {
  cleanupTestReferenceData,
  createTestDoctor,
  createTestLocation,
  createTestSpecialty,
} from "./helpers/reference-data";
import { testAdminClient } from "./helpers/supabase-admin";
import { cleanupTestUsers, createTestUser } from "./helpers/test-users";
import { jerusalemDayKey, jerusalemWallClockToUtc } from "../../lib/timezone";

// NOTIF-01/02/03/04: an in-app notification on booking, cancel and
// reschedule, scoped to the correct recipient only, reflected in the
// notification bell (components/notification-bell.tsx, plan 06-06) without
// a page reload — proven either via Supabase Realtime (D-02) or via a
// service-role fixture insert while the bell is already mounted. Declared
// with test.fixme so the suite stays green until 06-04 (publication +
// notification-copy resolver) and 06-06 (bell + Realtime subscription)
// exist — 06-06 converts each test.fixme( to test( without touching the
// assertions.

function futureJerusalemDay(daysAhead: number): { year: number; month: number; day: number } {
  const future = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const dayKey = jerusalemDayKey(future.toISOString());
  const [year, month, day] = dayKey.split("-").map(Number);
  return { year, month, day };
}

async function loginAsPatient(page: Page, creds: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("/patient");
}

async function loginInContext(
  context: BrowserContext,
  creds: { email: string; password: string },
  expectedUrl: string,
): Promise<Page> {
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(expectedUrl);
  return page;
}

test.describe("NOTIF-01/02/03/04: notifications on booking, cancel, reschedule", () => {
  test.beforeEach(async () => {
    // The Realtime websocket handshake (D-02) exceeds the 30s default
    // (playwright.config.ts) under a cold dev server.
    test.setTimeout(60000);
  });

  test.afterAll(async () => {
    await cleanupTestNotifications();
    await cleanupTestAppointments();
    await cleanupTestSlots();
    await cleanupTestReferenceData();
    await cleanupTestUsers();
  });

  // Proves Realtime replication itself, independent of RLS and independent
  // of any UI: a service-role subscriber (bypassing notifications_select_own
  // entirely) must receive a postgres_changes INSERT event the instant a row
  // lands in public.notifications. This isolates "is the table published to
  // supabase_realtime" from "is delivery correctly scoped per subscriber" —
  // the latter is 06-06's browser-session-scoped test, once the bell exists.
  test("notifications table is published to supabase_realtime", async () => {
    const patient = await createTestUser("patient");
    const admin = testAdminClient();

    let receivedId: string | null = null;
    const channel = admin.channel("notifications-realtime-proof").on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications" },
      (payload) => {
        receivedId = (payload.new as { id: string }).id;
      },
    );

    await new Promise<void>((resolve, reject) => {
      channel.subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          reject(
            new Error(
              `Realtime channel subscribe failed: ${status}${err ? ` (${err.message})` : ""}`,
            ),
          );
        }
      });
    });

    const notification = await insertTestNotification({ userId: patient.id });

    await expect.poll(() => receivedId, { timeout: 55000 }).toBe(notification.id);

    await admin.removeChannel(channel);
  });

  test("patient sees a notification after booking", async ({ page }) => {
    const patient = await createTestUser("patient");
    const specialty = await createTestSpecialty();
    const location = await createTestLocation();
    const doctor = await createTestDoctor({
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });
    const { year, month, day } = futureJerusalemDay(15);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 9, 30);
    const [slot] = await createTestSlots(doctor.id, [{ startAt: start, endAt: end }]);

    await loginAsPatient(page, patient);
    const bookResponse = await page.request.post("/api/appointments", {
      data: { slotId: slot.id },
    });
    expect(bookResponse.status()).toBe(201);

    await page.goto("/patient");
    await page.getByRole("button", { name: "Notifications" }).click();
    await expect(page.getByText("Your appointment has been booked.")).toBeVisible();
  });

  test("doctor sees a notification after a patient books", async ({ browser }) => {
    const patient = await createTestUser("patient");
    const doctorUser = await createTestUser("doctor");
    const specialty = await createTestSpecialty();
    const location = await createTestLocation();
    const doctor = await createTestDoctor({
      specialtyId: specialty.id,
      locationId: location.id,
      profileId: doctorUser.id,
      isActive: true,
    });
    const { year, month, day } = futureJerusalemDay(16);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 9, 30);
    const [slot] = await createTestSlots(doctor.id, [{ startAt: start, endAt: end }]);

    const patientContext = await browser.newContext();
    const patientPage = await loginInContext(patientContext, patient, "/patient");
    const bookResponse = await patientPage.request.post("/api/appointments", {
      data: { slotId: slot.id },
    });
    expect(bookResponse.status()).toBe(201);
    await patientContext.close();

    const doctorContext = await browser.newContext();
    const doctorPage = await loginInContext(doctorContext, doctorUser, "/doctor");
    await doctorPage.getByRole("button", { name: "Notifications" }).click();
    await expect(
      doctorPage.getByText("A patient booked an appointment with you."),
    ).toBeVisible();
    await doctorContext.close();
  });

  test("patient sees a notification after the doctor cancels", async ({ browser }) => {
    const patient = await createTestUser("patient");
    const doctorUser = await createTestUser("doctor");
    const specialty = await createTestSpecialty();
    const location = await createTestLocation();
    const doctor = await createTestDoctor({
      specialtyId: specialty.id,
      locationId: location.id,
      profileId: doctorUser.id,
      isActive: true,
    });
    const { year, month, day } = futureJerusalemDay(17);
    const start = jerusalemWallClockToUtc(year, month, day, 9, 0);
    const end = jerusalemWallClockToUtc(year, month, day, 9, 30);
    const appointment = await createTestAppointment({
      doctorId: doctor.id,
      patientId: patient.id,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    });

    const doctorContext = await browser.newContext();
    const doctorPage = await loginInContext(doctorContext, doctorUser, "/doctor");
    const cancelResponse = await doctorPage.request.patch(
      `/api/appointments/${appointment.id}/cancel`,
      { data: {} },
    );
    expect(cancelResponse.status()).toBe(200);
    await doctorContext.close();

    const patientContext = await browser.newContext();
    const patientPage = await loginInContext(patientContext, patient, "/patient");
    await patientPage.getByRole("button", { name: "Notifications" }).click();
    await expect(
      patientPage.getByText("Your appointment was cancelled by the doctor."),
    ).toBeVisible();
    await patientContext.close();
  });

  test("patient sees a notification after rescheduling", async ({ page }) => {
    const patient = await createTestUser("patient");
    const specialty = await createTestSpecialty();
    const location = await createTestLocation();
    const doctor = await createTestDoctor({
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });
    const originalDay = futureJerusalemDay(18);
    const originalStart = jerusalemWallClockToUtc(
      originalDay.year,
      originalDay.month,
      originalDay.day,
      9,
      0,
    );
    const originalEnd = jerusalemWallClockToUtc(
      originalDay.year,
      originalDay.month,
      originalDay.day,
      9,
      30,
    );
    const appointment = await createTestAppointment({
      doctorId: doctor.id,
      patientId: patient.id,
      startAt: originalStart.toISOString(),
      endAt: originalEnd.toISOString(),
    });
    const newDay = futureJerusalemDay(19);
    const newStart = jerusalemWallClockToUtc(newDay.year, newDay.month, newDay.day, 9, 0);
    const newEnd = jerusalemWallClockToUtc(newDay.year, newDay.month, newDay.day, 9, 30);
    const [newSlot] = await createTestSlots(doctor.id, [{ startAt: newStart, endAt: newEnd }]);

    await loginAsPatient(page, patient);
    const rescheduleResponse = await page.request.patch(
      `/api/appointments/${appointment.id}/reschedule`,
      { data: { newSlotId: newSlot.id } },
    );
    expect(rescheduleResponse.status()).toBe(200);

    await page.goto("/patient");
    await page.getByRole("button", { name: "Notifications" }).click();
    await expect(page.getByText("Your appointment has been rescheduled.")).toBeVisible();
  });

  test(
    "the notification badge updates without a page reload",
    async ({ page }) => {
      const patient = await createTestUser("patient");
      await insertTestNotification({ userId: patient.id, type: "appointment_booked" });

      await loginAsPatient(page, patient);
      await page.goto("/patient");

      const badge = page.getByTestId("notification-badge");
      await expect(badge).toHaveText("1");

      await insertTestNotification({ userId: patient.id, type: "appointment_booked" });

      // Auto-retrying expect() polls until the Realtime INSERT event lands —
      // no manual sleep, no page.reload().
      await expect(badge).toHaveText("2");
    },
  );

  test(
    "one user never receives another user's notification",
    async ({ page }) => {
      const viewer = await createTestUser("patient");
      const other = await createTestUser("patient");
      await insertTestNotification({ userId: other.id, type: "appointment_booked" });

      await loginAsPatient(page, viewer);
      await page.goto("/patient");
      await page.getByRole("button", { name: "Notifications" }).click();

      await expect(page.getByText("No notifications yet.")).toBeVisible();
      expect(await readNotificationsFor(viewer.id)).toHaveLength(0);
    },
  );
});

// GET /api/notifications and PATCH /api/notifications/[id]/read (06-04):
// direct API-level proof of the must-haves this plan's routes are
// responsible for. This is deliberately independent of the UI-dependent
// "one user never receives another user's notification" test above (still
// test.fixme — it needs the Notifications trigger button and bell dropdown
// 06-06 builds); these tests exercise the same isolation/ownership contract
// through the HTTP surface alone, so the routes have real, executable
// verification in this plan rather than borrowing a UI-gated title.
test.describe("GET/PATCH /api/notifications API contract (06-04)", () => {
  test.afterAll(async () => {
    await cleanupTestNotifications();
    await cleanupTestUsers();
  });

  test("GET /api/notifications requires authentication", async ({ request }) => {
    const response = await request.get("/api/notifications");
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Not authenticated." });
  });

  test("GET /api/notifications returns the caller's own notifications, message absent", async ({
    page,
  }) => {
    const patient = await createTestUser("patient");
    const notification = await insertTestNotification({
      userId: patient.id,
      type: "appointment_booked",
    });

    await loginAsPatient(page, patient);
    const response = await page.request.get("/api/notifications");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.notifications).toHaveLength(1);
    const row = body.notifications[0];
    expect(Object.keys(row).sort()).toEqual(
      ["created_at", "id", "read_at", "related_appointment_id", "type"].sort(),
    );
    expect(row.id).toBe(notification.id);
    expect(row).not.toHaveProperty("message");
  });

  test("GET /api/notifications never returns another user's notification", async ({ page }) => {
    const viewer = await createTestUser("patient");
    const other = await createTestUser("patient");
    await insertTestNotification({ userId: other.id, type: "appointment_booked" });

    await loginAsPatient(page, viewer);
    const response = await page.request.get("/api/notifications");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.notifications).toHaveLength(0);
  });

  test("PATCH /api/notifications/[id]/read requires authentication", async ({ request }) => {
    const response = await request.patch(
      "/api/notifications/00000000-0000-0000-0000-000000000000/read",
    );
    expect(response.status()).toBe(401);
  });

  test("PATCH /api/notifications/[id]/read marks the caller's own notification read, idempotently", async ({
    page,
  }) => {
    const patient = await createTestUser("patient");
    const notification = await insertTestNotification({
      userId: patient.id,
      type: "appointment_booked",
    });

    await loginAsPatient(page, patient);

    const response = await page.request.patch(`/api/notifications/${notification.id}/read`);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ ok: true });

    const [row] = await readNotificationsFor(patient.id);
    expect(row.read_at).not.toBeNull();

    // Repeating the identical PATCH is idempotent: still 200, still read —
    // no `.is("read_at", null)` filter turns the second call into a 404.
    const secondResponse = await page.request.patch(`/api/notifications/${notification.id}/read`);
    expect(secondResponse.status()).toBe(200);
    const [rowAfterSecond] = await readNotificationsFor(patient.id);
    expect(rowAfterSecond.read_at).not.toBeNull();
  });

  test("PATCH /api/notifications/[id]/read returns the byte-identical 404 for a foreign, missing, or malformed id", async ({
    page,
  }) => {
    const viewer = await createTestUser("patient");
    const other = await createTestUser("patient");
    const otherNotification = await insertTestNotification({
      userId: other.id,
      type: "appointment_booked",
    });

    await loginAsPatient(page, viewer);

    const foreignResponse = await page.request.patch(
      `/api/notifications/${otherNotification.id}/read`,
    );
    expect(foreignResponse.status()).toBe(404);
    const foreignBody = await foreignResponse.json();
    expect(foreignBody).toEqual({ error: "This notification no longer exists." });

    const missingResponse = await page.request.patch(
      "/api/notifications/00000000-0000-0000-0000-000000000000/read",
    );
    expect(missingResponse.status()).toBe(404);
    expect(await missingResponse.json()).toEqual(foreignBody);

    const malformedResponse = await page.request.patch("/api/notifications/not-a-uuid/read");
    expect(malformedResponse.status()).toBe(404);
    expect(await malformedResponse.json()).toEqual(foreignBody);

    // The foreign user's notification must remain unread throughout.
    const [otherRow] = await readNotificationsFor(other.id);
    expect(otherRow.read_at).toBeNull();
  });
});
