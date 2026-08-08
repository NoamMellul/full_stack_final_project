import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { testAdminClient } from "./helpers/supabase-admin";
import { testAnonClient } from "./helpers/supabase-anon";
import {
  cleanupTestReferenceData,
  createTestDoctor,
  createTestLocation,
  createTestSpecialty,
} from "./helpers/reference-data";

// Non-browser spec: drives Supabase clients directly (no `page` fixture),
// same style as the RLS assertions in admin-doctor-status.spec.ts. Proves
// doctor_search_view (1) is selectable by the anon key at all, (2) only ever
// surfaces active doctors, and (3) computes next_available_at correctly for
// every "no qualifying future available slot" edge case.

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const doctorIdsWithSlots: string[] = [];

test.describe("doctor_search_view: access boundary and next-slot semantics", () => {
  const runSuffix = randomUUID().slice(0, 8);

  let specialty: { id: string; nameEn: string };
  let location: { id: string; city: string; neighborhood: string };

  let activeWithFutureSlot: { id: string; fullName: string };
  let activeNoSlots: { id: string; fullName: string };
  let activeBookedOnly: { id: string; fullName: string };
  let activePastOnly: { id: string; fullName: string };
  let inactiveWithFutureSlot: { id: string; fullName: string };

  // The earlier of the two touching slots on activeWithFutureSlot.
  let adjacencyFirstSlotStart: Date;

  test.beforeAll(async () => {
    const admin = testAdminClient();

    specialty = await createTestSpecialty();
    location = await createTestLocation();

    activeWithFutureSlot = await createTestDoctor({
      fullName: `Search View Active Future ${runSuffix}`,
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });
    activeNoSlots = await createTestDoctor({
      fullName: `Search View Active NoSlots ${runSuffix}`,
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });
    activeBookedOnly = await createTestDoctor({
      fullName: `Search View Active BookedOnly ${runSuffix}`,
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });
    activePastOnly = await createTestDoctor({
      fullName: `Search View Active PastOnly ${runSuffix}`,
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: true,
    });
    inactiveWithFutureSlot = await createTestDoctor({
      fullName: `Search View Inactive Future ${runSuffix}`,
      specialtyId: specialty.id,
      locationId: location.id,
      isActive: false,
    });

    const now = Date.now();

    // activeWithFutureSlot: two touching `available` slots — the first ends
    // at the exact instant the second begins. tstzrange defaults to
    // half-open bounds, so this is legal under availability_slots_no_overlap
    // and the pair must not merge or collide.
    adjacencyFirstSlotStart = new Date(now + 3 * DAY_MS);
    const adjacencyFirstSlotEnd = new Date(adjacencyFirstSlotStart.getTime() + 30 * 60 * 1000);
    const adjacencySecondSlotStart = adjacencyFirstSlotEnd;
    const adjacencySecondSlotEnd = new Date(
      adjacencySecondSlotStart.getTime() + 30 * 60 * 1000,
    );

    const { error: activeWithFutureSlotError } = await admin.from("availability_slots").insert([
      {
        doctor_id: activeWithFutureSlot.id,
        start_at: adjacencyFirstSlotStart.toISOString(),
        end_at: adjacencyFirstSlotEnd.toISOString(),
        status: "available",
      },
      {
        doctor_id: activeWithFutureSlot.id,
        start_at: adjacencySecondSlotStart.toISOString(),
        end_at: adjacencySecondSlotEnd.toISOString(),
        status: "available",
      },
    ]);
    expect(activeWithFutureSlotError).toBeNull();

    // activeBookedOnly: a booked slot 4 days out and a blocked slot 5 days
    // out — neither status is "available", so next_available_at must be null.
    const bookedStart = new Date(now + 4 * DAY_MS);
    const bookedEnd = new Date(bookedStart.getTime() + 30 * 60 * 1000);
    const blockedStart = new Date(now + 5 * DAY_MS);
    const blockedEnd = new Date(blockedStart.getTime() + 30 * 60 * 1000);

    const { error: activeBookedOnlyError } = await admin.from("availability_slots").insert([
      {
        doctor_id: activeBookedOnly.id,
        start_at: bookedStart.toISOString(),
        end_at: bookedEnd.toISOString(),
        status: "booked",
      },
      {
        doctor_id: activeBookedOnly.id,
        start_at: blockedStart.toISOString(),
        end_at: blockedEnd.toISOString(),
        status: "blocked",
      },
    ]);
    expect(activeBookedOnlyError).toBeNull();

    // activePastOnly: an `available` slot that is entirely in the past —
    // started 2 days ago, ended 1 hour after that (still well before now).
    const pastStart = new Date(now - 2 * DAY_MS);
    const pastEnd = new Date(pastStart.getTime() + HOUR_MS);

    const { error: activePastOnlyError } = await admin.from("availability_slots").insert({
      doctor_id: activePastOnly.id,
      start_at: pastStart.toISOString(),
      end_at: pastEnd.toISOString(),
      status: "available",
    });
    expect(activePastOnlyError).toBeNull();

    // inactiveWithFutureSlot: a future `available` slot that must never
    // surface through the view because the doctor itself is inactive.
    const inactiveStart = new Date(now + 3 * DAY_MS);
    const inactiveEnd = new Date(inactiveStart.getTime() + 30 * 60 * 1000);

    const { error: inactiveWithFutureSlotError } = await admin.from("availability_slots").insert({
      doctor_id: inactiveWithFutureSlot.id,
      start_at: inactiveStart.toISOString(),
      end_at: inactiveEnd.toISOString(),
      status: "available",
    });
    expect(inactiveWithFutureSlotError).toBeNull();

    doctorIdsWithSlots.push(
      activeWithFutureSlot.id,
      activeBookedOnly.id,
      activePastOnly.id,
      inactiveWithFutureSlot.id,
    );

    // Language rows: activeWithFutureSlot speaks both he and en;
    // activeNoSlots deliberately gets none (proves language_codes
    // coalesces to '{}' rather than null).
    const { data: languages, error: languagesError } = await admin
      .from("languages")
      .select("id, code")
      .in("code", ["he", "en"]);
    expect(languagesError).toBeNull();
    expect(languages?.length).toBe(2);

    const { error: doctorLanguagesError } = await admin.from("doctor_languages").insert(
      (languages ?? []).map((lang) => ({
        doctor_id: activeWithFutureSlot.id,
        language_id: lang.id,
      })),
    );
    expect(doctorLanguagesError).toBeNull();
  });

  test.afterAll(async () => {
    const admin = testAdminClient();

    const doctorIds = doctorIdsWithSlots.splice(0, doctorIdsWithSlots.length);
    for (const doctorId of doctorIds) {
      try {
        await admin.from("availability_slots").delete().eq("doctor_id", doctorId);
      } catch {
        // Swallow individual failures so one dead id cannot abort the rest.
      }
    }

    // doctor_languages rows cascade-delete with their doctor row via
    // cleanupTestReferenceData()'s doctors delete — no separate cleanup needed.
    await cleanupTestReferenceData();
  });

  test("1. grant present: an anon select against the view returns no permission error", async () => {
    const anon = testAnonClient();
    const { error } = await anon.from("doctor_search_view").select("id").limit(1);

    expect(error).toBeNull();
  });

  test("2. active-only: inactive doctors never appear, active doctors with future slots do", async () => {
    const anon = testAnonClient();
    const { data, error } = await anon
      .from("doctor_search_view")
      .select("id")
      .in("id", [activeWithFutureSlot.id, inactiveWithFutureSlot.id]);

    expect(error).toBeNull();
    const ids = (data ?? []).map((row) => row.id);
    expect(ids).toContain(activeWithFutureSlot.id);
    expect(ids).not.toContain(inactiveWithFutureSlot.id);
  });

  test("3. an active doctor with zero availability_slots rows is retained with a null next_available_at", async () => {
    const anon = testAnonClient();
    const { data, error } = await anon
      .from("doctor_search_view")
      .select("id, next_available_at")
      .eq("id", activeNoSlots.id)
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBe(activeNoSlots.id);
    expect(data?.next_available_at).toBeNull();
  });

  test("4. booked and blocked slots are not treated as available", async () => {
    const anon = testAnonClient();
    const { data, error } = await anon
      .from("doctor_search_view")
      .select("next_available_at")
      .eq("id", activeBookedOnly.id)
      .single();

    expect(error).toBeNull();
    expect(data?.next_available_at).toBeNull();
  });

  test("5. a slot entirely in the past is not treated as future", async () => {
    const anon = testAnonClient();
    const { data, error } = await anon
      .from("doctor_search_view")
      .select("next_available_at")
      .eq("id", activePastOnly.id)
      .single();

    expect(error).toBeNull();
    expect(data?.next_available_at).toBeNull();
  });

  test("6. adjacency: touching slots persist separately and next_available_at resolves to the earlier one", async () => {
    const anon = testAnonClient();

    const { data: viewRow, error: viewError } = await anon
      .from("doctor_search_view")
      .select("next_available_at")
      .eq("id", activeWithFutureSlot.id)
      .single();

    expect(viewError).toBeNull();
    // Postgres returns timestamptz as "...+00:00", not the "...Z" suffix
    // Date#toISOString() produces — compare parsed instants, not raw strings.
    expect(new Date(viewRow?.next_available_at as string).getTime()).toBe(
      adjacencyFirstSlotStart.getTime(),
    );

    const { data: slots, error: slotsError } = await anon
      .from("availability_slots")
      .select("id")
      .eq("doctor_id", activeWithFutureSlot.id);

    expect(slotsError).toBeNull();
    expect(slots?.length).toBe(2);
  });

  test("7. language_codes aggregates correctly and coalesces to an empty array, never null", async () => {
    const anon = testAnonClient();

    const { data: withLangs, error: withLangsError } = await anon
      .from("doctor_search_view")
      .select("language_codes")
      .eq("id", activeWithFutureSlot.id)
      .single();

    expect(withLangsError).toBeNull();
    expect(withLangs?.language_codes).not.toBeNull();
    expect([...(withLangs?.language_codes ?? [])].sort()).toEqual(["en", "he"]);

    const { data: noLangs, error: noLangsError } = await anon
      .from("doctor_search_view")
      .select("language_codes")
      .eq("id", activeNoSlots.id)
      .single();

    expect(noLangsError).toBeNull();
    expect(noLangs?.language_codes).toEqual([]);
    expect(noLangs?.language_codes).not.toBeNull();
  });

  test("8. neighborhood and specialty_id are flat, filterable columns", async () => {
    const anon = testAnonClient();
    const expectedIds = [
      activeWithFutureSlot.id,
      activeNoSlots.id,
      activeBookedOnly.id,
      activePastOnly.id,
    ].sort();

    const { data: byNeighborhood, error: byNeighborhoodError } = await anon
      .from("doctor_search_view")
      .select("id")
      .eq("neighborhood", location.neighborhood)
      .in("id", expectedIds);

    expect(byNeighborhoodError).toBeNull();
    expect((byNeighborhood ?? []).map((row) => row.id).sort()).toEqual(expectedIds);

    const { data: bySpecialty, error: bySpecialtyError } = await anon
      .from("doctor_search_view")
      .select("id")
      .eq("specialty_id", specialty.id)
      .in("id", expectedIds);

    expect(bySpecialtyError).toBeNull();
    expect((bySpecialty ?? []).map((row) => row.id).sort()).toEqual(expectedIds);
  });

  test("9. sort contract: next_available_at ascending, nulls last, id as tie-break", async () => {
    const anon = testAnonClient();
    const fixtureIds = [
      activeWithFutureSlot.id,
      activeNoSlots.id,
      activeBookedOnly.id,
      activePastOnly.id,
    ];

    const { data, error } = await anon
      .from("doctor_search_view")
      .select("id, next_available_at")
      .in("id", fixtureIds)
      .order("next_available_at", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true });

    expect(error).toBeNull();
    expect(data?.length).toBe(4);

    const orderedIds = (data ?? []).map((row) => row.id);
    const activeWithFutureSlotIndex = orderedIds.indexOf(activeWithFutureSlot.id);

    expect(activeWithFutureSlotIndex).toBe(0);
    for (const nullValuedId of [activeNoSlots.id, activeBookedOnly.id, activePastOnly.id]) {
      expect(orderedIds.indexOf(nullValuedId)).toBeGreaterThan(activeWithFutureSlotIndex);
    }
  });
});
