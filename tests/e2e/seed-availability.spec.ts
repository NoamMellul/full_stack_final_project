import { execSync } from "node:child_process";

import { expect, test } from "@playwright/test";

import { formatJerusalemTime, jerusalemWeekday } from "../../lib/timezone";
import { testAdminClient } from "./helpers/supabase-admin";

// Non-browser spec: drives the seed script and Supabase clients directly (no
// `page` fixture), same style as search-view-visibility.spec.ts. Proves
// D-01/D-02/D-03 by asserting over the seed's own output — it creates no
// fixtures of its own and performs no cleanup, since it never deletes seeded
// rows.
//
// This is a deliberate stable subset of scripts/seed.ts's DOCTORS catalog
// (not a full mirror — the catalog has since grown to 30 doctors), sufficient
// to prove the shape rules this spec asserts. DOCTORS_WITHOUT_SLOTS is copied
// verbatim, since it is exhaustive by construction (D-03) and never grows.
// Not imported: importing scripts/seed.ts would re-execute its top-level
// `main().catch(...)` seed run as a side effect of module load.
const DOCTOR_NAMES = [
  "Dr. Noa Ben-David",
  "Dr. Avi Rosenberg",
  "Dr. Michal Katz",
  "Dr. Yossi Peretz",
  "Dr. Tamar Levi",
  "Dr. Ronen Shapira",
  "Dr. Dana Avraham",
  "Dr. Eli Mizrahi",
  "Dr. Shira Cohen-Barak",
  "Dr. Omer Golan",
  "Dr. Liora Segal",
  "Dr. Amit Friedman",
];

const DOCTORS_WITHOUT_SLOTS = ["Dr. Liora Segal", "Dr. Amit Friedman"];

const HORIZON_TOLERANCE_MS = 22 * 24 * 60 * 60 * 1000; // 21-day horizon + 1 day for a run straddling midnight

type SeededSlot = { id: string; start_at: string; end_at: string; status: string };
type SeededDoctor = { id: string; full_name: string; slots: SeededSlot[] };

async function countFutureDemoSlots(): Promise<number> {
  const admin = testAdminClient();

  const { data: doctors, error: doctorsError } = await admin
    .from("doctors")
    .select("id")
    .eq("is_demo", true)
    .in("full_name", DOCTOR_NAMES);

  if (doctorsError || !doctors) {
    throw new Error(`Failed to read demo doctors: ${doctorsError?.message}`);
  }

  const doctorIds = (doctors as Array<{ id: string }>).map((row) => row.id);
  if (doctorIds.length === 0) {
    return 0;
  }

  const { count, error: countError } = await admin
    .from("availability_slots")
    .select("*", { count: "exact", head: true })
    .in("doctor_id", doctorIds)
    .gt("start_at", new Date().toISOString());

  if (countError) {
    throw new Error(`Failed to count future availability_slots: ${countError.message}`);
  }

  return count ?? 0;
}

async function loadDemoDoctorsWithFutureSlots(): Promise<SeededDoctor[]> {
  const admin = testAdminClient();

  const { data: doctors, error: doctorsError } = await admin
    .from("doctors")
    .select("id, full_name")
    .eq("is_demo", true)
    .in("full_name", DOCTOR_NAMES)
    .order("full_name");

  if (doctorsError || !doctors) {
    throw new Error(`Failed to read demo doctors: ${doctorsError?.message}`);
  }

  const result: SeededDoctor[] = [];
  for (const doctor of doctors as Array<{ id: string; full_name: string }>) {
    const { data: slots, error: slotsError } = await admin
      .from("availability_slots")
      .select("id, start_at, end_at, status")
      .eq("doctor_id", doctor.id)
      .eq("status", "available")
      .gt("start_at", new Date().toISOString())
      .order("start_at");

    if (slotsError) {
      throw new Error(
        `Failed to read availability_slots for ${doctor.full_name}: ${slotsError.message}`,
      );
    }

    result.push({ id: doctor.id, full_name: doctor.full_name, slots: (slots ?? []) as SeededSlot[] });
  }

  return result;
}

test.describe("seed-availability: idempotency and D-01/D-02/D-03 shape rules", () => {
  test.setTimeout(180000);

  let firstRunCount = -1;
  let secondRunCount = -1;
  let doctors: SeededDoctor[] = [];

  test.beforeAll(async () => {
    // Establish a seeded state, then re-run to prove the second run is a
    // no-op (D-03). Both invocations must exit 0 — execSync throws on a
    // non-zero exit, which fails this beforeAll and every test below.
    execSync("npm run seed", { stdio: "pipe", timeout: 150000 });
    firstRunCount = await countFutureDemoSlots();

    execSync("npm run seed", { stdio: "pipe", timeout: 150000 });
    secondRunCount = await countFutureDemoSlots();

    doctors = await loadDemoDoctorsWithFutureSlots();
  });

  test("1. idempotency: two consecutive npm run seed runs report an identical future availability_slots count", () => {
    expect(firstRunCount).toBeGreaterThan(0);
    expect(secondRunCount).toBe(firstRunCount);
  });

  test("2. every slot starts in the future and within the 21-day horizon (D-01)", () => {
    const now = Date.now();
    let sawAnySlot = false;

    for (const doctor of doctors) {
      for (const slot of doctor.slots) {
        sawAnySlot = true;
        const startMs = new Date(slot.start_at).getTime();
        expect(startMs).toBeGreaterThan(now);
        expect(startMs - now).toBeLessThanOrEqual(HORIZON_TOLERANCE_MS);
      }
    }

    expect(sawAnySlot).toBe(true);
  });

  test("3. every slot falls within 09:00-17:00 Israel time on a Sunday-through-Thursday weekday (D-01)", () => {
    let sawAnySlot = false;

    for (const doctor of doctors) {
      for (const slot of doctor.slots) {
        sawAnySlot = true;

        const startHour = Number(formatJerusalemTime(slot.start_at).split(":")[0]);
        expect(startHour).toBeGreaterThanOrEqual(9);
        expect(startHour).toBeLessThanOrEqual(16);

        const [endHour, endMinute] = formatJerusalemTime(slot.end_at).split(":").map(Number);
        expect(endHour < 17 || (endHour === 17 && endMinute === 0)).toBe(true);

        const weekday = jerusalemWeekday(new Date(slot.start_at));
        expect(weekday).toBeGreaterThanOrEqual(0);
        expect(weekday).toBeLessThanOrEqual(4);
      }
    }

    expect(sawAnySlot).toBe(true);
  });

  test("4. every doctor holding any slot holds between 6 and 10 of them (D-01)", () => {
    let sawAnyDoctorWithSlots = false;

    for (const doctor of doctors) {
      if (doctor.slots.length > 0) {
        sawAnyDoctorWithSlots = true;
        expect(doctor.slots.length).toBeGreaterThanOrEqual(6);
        expect(doctor.slots.length).toBeLessThanOrEqual(10);
      }
    }

    expect(sawAnyDoctorWithSlots).toBe(true);
  });

  test("5. no two slots for the same doctor overlap (D-01)", () => {
    for (const doctor of doctors) {
      const sorted = [...doctor.slots].sort(
        (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
      );

      for (let i = 1; i < sorted.length; i++) {
        expect(new Date(sorted[i].start_at).getTime()).toBeGreaterThanOrEqual(
          new Date(sorted[i - 1].end_at).getTime(),
        );
      }
    }
  });

  test("6. at least two active demo doctors have zero future slots, and DOCTORS_WITHOUT_SLOTS names are among them (D-02)", () => {
    const zeroSlotDoctorNames = doctors.filter((doctor) => doctor.slots.length === 0).map(
      (doctor) => doctor.full_name,
    );

    expect(zeroSlotDoctorNames.length).toBeGreaterThanOrEqual(2);
    for (const name of DOCTORS_WITHOUT_SLOTS) {
      expect(zeroSlotDoctorNames).toContain(name);
    }
  });

  test("7. no appointments reference any seeded slot (D-01)", async () => {
    const admin = testAdminClient();
    const allSlotIds = doctors.flatMap((doctor) => doctor.slots.map((slot) => slot.id));
    expect(allSlotIds.length).toBeGreaterThan(0);

    const { data, error } = await admin.from("appointments").select("id").in("slot_id", allSlotIds);

    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(0);
  });

  test("8. every loaded slot's status is the literal 'available'", () => {
    let sawAnySlot = false;
    for (const doctor of doctors) {
      for (const slot of doctor.slots) {
        sawAnySlot = true;
        expect(slot.status).toBe("available");
      }
    }
    expect(sawAnySlot).toBe(true);
  });
});
