// MedRDV — Idempotent demo-data seed script.
//
// Populates the full specialty catalog, the full Tel-Aviv neighborhood
// catalog, 10-15 demo doctors spread across them with language
// associations, and a handful of demo patient accounts.
//
// Safe to re-run: every step is an insert or upsert, guarded so a second run
// adds zero new rows. This script performs no row-removal or
// table-truncation call of any kind — it can never destroy data it did not
// create (T-02-16).
//
// Run with: npm run seed

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { createClient } from "@supabase/supabase-js";

// `tsx` resolves the project's "@/" path alias in the Next.js app, but this
// script runs standalone outside that resolution context — use a relative
// import (verified against `npm run seed`).
import { jerusalemDayKey, jerusalemWallClockToUtc, jerusalemWeekday } from "../lib/timezone";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!SUPABASE_URL) {
  throw new Error("Missing env var NEXT_PUBLIC_SUPABASE_URL");
}

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) {
  throw new Error("Missing env var SUPABASE_SERVICE_ROLE_KEY");
}

// Built directly with @supabase/supabase-js rather than
// lib/supabase/admin.ts, which is marked `server-only` and would fail
// outside a Next.js runtime.
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ============================================================================
// Fixed demo password for demo patient accounts (T-02-03: an accepted risk —
// obviously-demonstration credential for throwaway accounts, no real
// personal data behind it, no production deployment path).
// ============================================================================

const DEMO_PATIENT_PASSWORD = "DemoPatient123!";

// ============================================================================
// Specialties — full catalog a Tel-Aviv private-practice directory would
// realistically list.
// ============================================================================

const SPECIALTIES: Array<{ name_he: string; name_en: string }> = [
  { name_he: "רפואת משפחה", name_en: "Family Medicine" },
  { name_he: "קרדיולוגיה", name_en: "Cardiology" },
  { name_he: "דרמטולוגיה", name_en: "Dermatology" },
  { name_he: "רפואת ילדים", name_en: "Pediatrics" },
  { name_he: "גינקולוגיה", name_en: "Gynecology" },
  { name_he: "אורתופדיה", name_en: "Orthopedics" },
  { name_he: "רפואת עיניים", name_en: "Ophthalmology" },
  { name_he: "רפואת אף אוזן גרון", name_en: "Otolaryngology (ENT)" },
  { name_he: "גסטרואנטרולוגיה", name_en: "Gastroenterology" },
  { name_he: "פסיכיאטריה", name_en: "Psychiatry" },
  { name_he: "נוירולוגיה", name_en: "Neurology" },
  { name_he: "אורולוגיה", name_en: "Urology" },
];

// ============================================================================
// Locations — full Tel-Aviv neighborhood catalog (D-07).
// ============================================================================

const LOCATIONS: Array<{ city: string; neighborhood: string }> = [
  { city: "Tel Aviv", neighborhood: "Lev HaIr" },
  { city: "Tel Aviv", neighborhood: "Florentin" },
  { city: "Tel Aviv", neighborhood: "Neve Tzedek" },
  { city: "Tel Aviv", neighborhood: "Ramat Aviv" },
  { city: "Tel Aviv", neighborhood: "Old North" },
  { city: "Tel Aviv", neighborhood: "New North" },
  { city: "Tel Aviv", neighborhood: "Yad Eliyahu" },
  { city: "Tel Aviv", neighborhood: "Jaffa" },
  { city: "Tel Aviv", neighborhood: "Kerem HaTeimanim" },
  { city: "Tel Aviv", neighborhood: "Bavli" },
  { city: "Tel Aviv", neighborhood: "Montefiore" },
  { city: "Tel Aviv", neighborhood: "Shapira" },
];

// ============================================================================
// Demo doctors — 12 doctors (inside the 10-15 envelope), one per specialty
// and one per neighborhood, so every specialty id and every location id
// appears on at least one seeded doctor. Language mix is deliberate: every
// third doctor speaks both languages, every third speaks Hebrew only, every
// third speaks English only.
// ============================================================================

type DemoDoctor = {
  full_name: string;
  bio: string;
  specialty_name_en: string;
  location_neighborhood: string;
  languages: Array<"he" | "en">;
};

const DOCTORS: DemoDoctor[] = [
  {
    full_name: "Dr. Noa Ben-David",
    bio: "Family physician with over a decade of experience treating patients of all ages in Lev HaIr.",
    specialty_name_en: "Family Medicine",
    location_neighborhood: "Lev HaIr",
    languages: ["he", "en"],
  },
  {
    full_name: "Dr. Avi Rosenberg",
    bio: "Cardiologist specializing in preventive heart health and echocardiography.",
    specialty_name_en: "Cardiology",
    location_neighborhood: "Florentin",
    languages: ["he"],
  },
  {
    full_name: "Dr. Michal Katz",
    bio: "Dermatologist focused on skin cancer screening and cosmetic dermatology.",
    specialty_name_en: "Dermatology",
    location_neighborhood: "Neve Tzedek",
    languages: ["en"],
  },
  {
    full_name: "Dr. Yossi Peretz",
    bio: "Pediatrician providing well-child visits and vaccination care for infants through teens.",
    specialty_name_en: "Pediatrics",
    location_neighborhood: "Ramat Aviv",
    languages: ["he", "en"],
  },
  {
    full_name: "Dr. Tamar Levi",
    bio: "Gynecologist offering routine women's health care and prenatal consultations.",
    specialty_name_en: "Gynecology",
    location_neighborhood: "Old North",
    languages: ["he"],
  },
  {
    full_name: "Dr. Ronen Shapira",
    bio: "Orthopedic surgeon treating sports injuries and joint conditions.",
    specialty_name_en: "Orthopedics",
    location_neighborhood: "New North",
    languages: ["en"],
  },
  {
    full_name: "Dr. Dana Avraham",
    bio: "Ophthalmologist with a focus on cataract care and routine eye exams.",
    specialty_name_en: "Ophthalmology",
    location_neighborhood: "Yad Eliyahu",
    languages: ["he", "en"],
  },
  {
    full_name: "Dr. Eli Mizrahi",
    bio: "ENT specialist treating sinus, hearing and throat conditions for adults and children.",
    specialty_name_en: "Otolaryngology (ENT)",
    location_neighborhood: "Jaffa",
    languages: ["he"],
  },
  {
    full_name: "Dr. Shira Cohen-Barak",
    bio: "Gastroenterologist specializing in digestive health and endoscopic procedures.",
    specialty_name_en: "Gastroenterology",
    location_neighborhood: "Kerem HaTeimanim",
    languages: ["en"],
  },
  {
    full_name: "Dr. Omer Golan",
    bio: "Psychiatrist providing outpatient care for anxiety, depression and mood disorders.",
    specialty_name_en: "Psychiatry",
    location_neighborhood: "Bavli",
    languages: ["he", "en"],
  },
  {
    full_name: "Dr. Liora Segal",
    bio: "Neurologist treating headache disorders, epilepsy and general neurological complaints.",
    specialty_name_en: "Neurology",
    location_neighborhood: "Montefiore",
    languages: ["he"],
  },
  {
    full_name: "Dr. Amit Friedman",
    bio: "Urologist offering care for kidney stones, urinary conditions and men's health.",
    specialty_name_en: "Urology",
    location_neighborhood: "Shapira",
    languages: ["en"],
  },
];

// ============================================================================
// Availability slots — deliberately excludes the last two DOCTORS entries
// (D-02) so the no-availability UI state stays reachable in demos and tests.
// ============================================================================

const DOCTORS_WITHOUT_SLOTS: string[] = ["Dr. Liora Segal", "Dr. Amit Friedman"];

const SLOT_MINUTES = 30;
const SLOTS_PER_DAY = 3;
const DAYS_PER_DOCTOR = 3;
const WINDOW_START_HOUR = 9;
const WINDOW_END_HOUR = 17;
const HORIZON_DAYS = 21;

// ============================================================================
// Demo patients — content for the /admin/users oversight view (ADMIN-01).
// No admin account is ever created here; role is always the "patient"
// literal below.
// ============================================================================

const DEMO_PATIENTS: Array<{ full_name: string; email: string }> = [
  { full_name: "Noa Patient", email: "noa.patient@example.com" },
  { full_name: "Yossi Patient", email: "yossi.patient@example.com" },
  { full_name: "Maya Patient", email: "maya.patient@example.com" },
  { full_name: "Daniel Patient", email: "daniel.patient@example.com" },
];

// ============================================================================
// Steps
// ============================================================================

async function seedSpecialties(): Promise<Map<string, string>> {
  const { error: upsertError } = await supabase
    .from("specialties")
    .upsert(SPECIALTIES, { onConflict: "name_en", ignoreDuplicates: true });

  if (upsertError) {
    throw new Error(`Failed to upsert specialties: ${upsertError.message}`);
  }

  const { data, error: selectError } = await supabase
    .from("specialties")
    .select("id, name_en");

  if (selectError || !data) {
    throw new Error(`Failed to read back specialties: ${selectError?.message}`);
  }

  const byName = new Map<string, string>();
  for (const row of data as Array<{ id: string; name_en: string }>) {
    byName.set(row.name_en, row.id);
  }
  return byName;
}

async function seedLocations(): Promise<Map<string, string>> {
  const { error: upsertError } = await supabase
    .from("locations")
    .upsert(LOCATIONS, { onConflict: "neighborhood,city", ignoreDuplicates: true });

  if (upsertError) {
    throw new Error(`Failed to upsert locations: ${upsertError.message}`);
  }

  const { data, error: selectError } = await supabase
    .from("locations")
    .select("id, neighborhood, city");

  if (selectError || !data) {
    throw new Error(`Failed to read back locations: ${selectError?.message}`);
  }

  const byNeighborhood = new Map<string, string>();
  for (const row of data as Array<{ id: string; neighborhood: string; city: string }>) {
    byNeighborhood.set(row.neighborhood, row.id);
  }
  return byNeighborhood;
}

async function seedDoctors(
  specialtyIdByName: Map<string, string>,
  locationIdByNeighborhood: Map<string, string>,
): Promise<Array<{ id: string; full_name: string; languages: Array<"he" | "en"> }>> {
  const { data: existing, error: existingError } = await supabase
    .from("doctors")
    .select("full_name")
    .eq("is_demo", true);

  if (existingError) {
    throw new Error(`Failed to read existing demo doctors: ${existingError.message}`);
  }

  const existingNames = new Set(
    (existing as Array<{ full_name: string }>).map((row) => row.full_name),
  );

  const toInsert = DOCTORS.filter((doctor) => !existingNames.has(doctor.full_name));

  if (toInsert.length === 0) {
    return [];
  }

  const rows = toInsert.map((doctor) => {
    const specialtyId = specialtyIdByName.get(doctor.specialty_name_en);
    const locationId = locationIdByNeighborhood.get(doctor.location_neighborhood);

    if (!specialtyId) {
      throw new Error(`No specialty id found for "${doctor.specialty_name_en}"`);
    }
    if (!locationId) {
      throw new Error(`No location id found for "${doctor.location_neighborhood}"`);
    }

    return {
      full_name: doctor.full_name,
      bio: doctor.bio,
      specialty_id: specialtyId,
      location_id: locationId,
      is_active: true,
      photo_url: null,
    };
  });

  const { data: inserted, error: insertError } = await supabase
    .from("doctors")
    .insert(rows)
    .select("id, full_name");

  if (insertError || !inserted) {
    throw new Error(`Failed to insert demo doctors: ${insertError?.message}`);
  }

  const languagesByName = new Map(toInsert.map((doctor) => [doctor.full_name, doctor.languages]));

  return (inserted as Array<{ id: string; full_name: string }>).map((row) => ({
    id: row.id,
    full_name: row.full_name,
    languages: languagesByName.get(row.full_name) ?? [],
  }));
}

async function seedDoctorLanguages(
  insertedDoctors: Array<{ id: string; full_name: string; languages: Array<"he" | "en"> }>,
): Promise<void> {
  if (insertedDoctors.length === 0) {
    return;
  }

  const { data: languageRows, error: languageError } = await supabase
    .from("languages")
    .select("id, code");

  if (languageError || !languageRows) {
    throw new Error(`Failed to read languages: ${languageError?.message}`);
  }

  const languageIdByCode = new Map(
    (languageRows as Array<{ id: string; code: string }>).map((row) => [row.code, row.id]),
  );

  const rows = insertedDoctors.flatMap((doctor) =>
    doctor.languages.map((code) => {
      const languageId = languageIdByCode.get(code);
      if (!languageId) {
        throw new Error(`No language id found for code "${code}"`);
      }
      return { doctor_id: doctor.id, language_id: languageId };
    }),
  );

  if (rows.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from("doctor_languages").insert(rows);

  if (insertError) {
    throw new Error(`Failed to insert doctor_languages: ${insertError.message}`);
  }
}

// Returns the {year, month, day} Asia/Jerusalem calendar date `offsetDays`
// days after `referenceNow`, reusing jerusalemDayKey's Intl-based
// calculation rather than a second hand-rolled formatter.
function jerusalemCalendarDateAtOffset(
  referenceNow: Date,
  offsetDays: number,
): { year: number; month: number; day: number } {
  const instant = new Date(referenceNow.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  const [year, month, day] = jerusalemDayKey(instant.toISOString()).split("-").map(Number);
  return { year, month, day };
}

// Weekday (0 Sun .. 6 Sat) of the Asia/Jerusalem calendar date at
// `offsetDays` from `referenceNow`. Uses a noon instant on that calendar day
// so the lookup is stable across the DST-transition day's midnight
// ambiguity.
function weekdayAtOffset(referenceNow: Date, offsetDays: number): number {
  const { year, month, day } = jerusalemCalendarDateAtOffset(referenceNow, offsetDays);
  return jerusalemWeekday(jerusalemWallClockToUtc(year, month, day, 12, 0));
}

// Advances (or, once advancing would exceed HORIZON_DAYS, retreats) one day
// at a time from `startOffset` until landing on a Sunday-through-Thursday
// Israeli business day.
function resolveBusinessDayOffset(referenceNow: Date, startOffset: number): number {
  let offset = Math.min(startOffset, HORIZON_DAYS);
  let direction: 1 | -1 = 1;

  while (weekdayAtOffset(referenceNow, offset) >= 5) {
    if (direction === 1 && offset + direction > HORIZON_DAYS) {
      direction = -1;
    }
    offset += direction;
  }

  return offset;
}

// Resolves `rawOffsets` (day offsets from today) to distinct Sun-Thu
// calendar dates, replacing any collision produced by the weekday-skip with
// the next legal business day (D-01).
function resolveDoctorSlotDays(
  referenceNow: Date,
  rawOffsets: number[],
): Array<{ year: number; month: number; day: number }> {
  const usedOffsets: number[] = [];
  const resolvedDates: Array<{ year: number; month: number; day: number }> = [];

  for (const rawOffset of rawOffsets) {
    let offset = resolveBusinessDayOffset(referenceNow, rawOffset);
    let guard = 0;
    while (usedOffsets.includes(offset)) {
      guard += 1;
      if (guard > 30) {
        throw new Error("Unable to resolve distinct business-day offsets for slot seeding");
      }
      offset = resolveBusinessDayOffset(referenceNow, offset + 1);
    }
    usedOffsets.push(offset);
    resolvedDates.push(jerusalemCalendarDateAtOffset(referenceNow, offset));
  }

  return resolvedDates;
}

// Adds idempotent demo availability_slots for every active demo doctor
// except DOCTORS_WITHOUT_SLOTS (D-02). Idempotency (D-03): a doctor is
// skipped only if it already holds at least one FUTURE availability_slots
// row — a doctor whose seeded slots have all expired is re-seeded, and a
// doctor with any future slot is left untouched so the
// availability_slots_no_overlap exclusion constraint is never challenged.
async function seedAvailabilitySlots(): Promise<void> {
  const doctorNames = DOCTORS.map((doctor) => doctor.full_name);

  // Read the doctor set back from the database rather than from
  // seedDoctors()'s return value: seedDoctors() returns only newly inserted
  // rows (empty on every re-run), so keying off it would mean slots are
  // only ever seeded on the very first run of a fresh database.
  const { data: candidates, error: candidatesError } = await supabase
    .from("doctors")
    .select("id, full_name")
    .eq("is_demo", true)
    .in("full_name", doctorNames)
    .order("full_name");

  if (candidatesError || !candidates) {
    throw new Error(`Failed to read demo doctors for slot seeding: ${candidatesError?.message}`);
  }

  const eligible = (candidates as Array<{ id: string; full_name: string }>).filter(
    (doctor) => !DOCTORS_WITHOUT_SLOTS.includes(doctor.full_name),
  );

  if (eligible.length === 0) {
    return;
  }

  const eligibleIds = eligible.map((doctor) => doctor.id);

  const { data: futureSlotRows, error: futureSlotsError } = await supabase
    .from("availability_slots")
    .select("doctor_id")
    .in("doctor_id", eligibleIds)
    .gt("start_at", new Date().toISOString());

  if (futureSlotsError) {
    throw new Error(`Failed to read existing availability_slots: ${futureSlotsError.message}`);
  }

  const doctorsWithFutureSlots = new Set(
    (futureSlotRows as Array<{ doctor_id: string }>).map((row) => row.doctor_id),
  );

  const toSeed = eligible.filter((doctor) => !doctorsWithFutureSlots.has(doctor.id));

  if (toSeed.length === 0) {
    return;
  }

  const referenceNow = new Date();
  const rows: Array<{
    doctor_id: string;
    start_at: string;
    end_at: string;
    status: "available";
  }> = [];

  toSeed.forEach((doctor, i) => {
    const baseOffset = 1 + (i % 7);
    const rawOffsets = [baseOffset, baseOffset + 5, baseOffset + 11];
    const days = resolveDoctorSlotDays(referenceNow, rawOffsets);

    if (days.length !== DAYS_PER_DOCTOR) {
      throw new Error(
        `Expected ${DAYS_PER_DOCTOR} resolved slot days for doctor ${doctor.full_name}, got ${days.length}`,
      );
    }

    // Stagger each doctor's first daily slot across the window so not every
    // doctor's slots start at the exact same minute.
    const firstSlotOffsetMinutes = (i % 6) * SLOT_MINUTES;

    days.forEach(({ year, month, day }) => {
      for (let slotIndex = 0; slotIndex < SLOTS_PER_DAY; slotIndex++) {
        const startOffsetMinutes = firstSlotOffsetMinutes + slotIndex * SLOT_MINUTES;
        const endOffsetMinutes = startOffsetMinutes + SLOT_MINUTES;
        const endHour = WINDOW_START_HOUR + Math.floor(endOffsetMinutes / 60);
        const endMinute = endOffsetMinutes % 60;

        if (endHour > WINDOW_END_HOUR || (endHour === WINDOW_END_HOUR && endMinute !== 0)) {
          throw new Error(
            `Generated slot for doctor ${doctor.full_name} would end after the ` +
              `${WINDOW_END_HOUR}:00 consultation window`,
          );
        }

        const hour = WINDOW_START_HOUR + Math.floor(startOffsetMinutes / 60);
        const minute = startOffsetMinutes % 60;

        const startAt = jerusalemWallClockToUtc(year, month, day, hour, minute);
        const endAt = new Date(startAt.getTime() + SLOT_MINUTES * 60 * 1000);

        rows.push({
          doctor_id: doctor.id,
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
          status: "available",
        });
      }
    });
  });

  const { error: insertError } = await supabase.from("availability_slots").insert(rows);

  if (insertError) {
    throw new Error(`Failed to insert availability_slots: ${insertError.message}`);
  }
}

async function seedDemoPatients(): Promise<void> {
  for (const patient of DEMO_PATIENTS) {
    const { data: existingProfile, error: lookupError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", patient.email)
      .maybeSingle();

    if (lookupError) {
      throw new Error(`Failed to look up profile for ${patient.email}: ${lookupError.message}`);
    }

    if (existingProfile) {
      continue;
    }

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: patient.email,
      password: DEMO_PATIENT_PASSWORD,
      email_confirm: true,
    });

    if (createError || !created.user) {
      throw new Error(`Failed to create demo patient ${patient.email}: ${createError?.message}`);
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: created.user.id,
      role: "patient",
      full_name: patient.full_name,
      email: patient.email,
    });

    if (profileError) {
      throw new Error(
        `Failed to create profile for demo patient ${patient.email}: ${profileError.message}`,
      );
    }
  }
}

async function countRows(table: string, filters?: Record<string, string | boolean>): Promise<number> {
  let query = supabase.from(table).select("*", { count: "exact", head: true });

  if (filters) {
    for (const [column, value] of Object.entries(filters)) {
      query = query.eq(column, value);
    }
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`Failed to count rows in ${table}: ${error.message}`);
  }

  return count ?? 0;
}

async function printSummary(): Promise<void> {
  const specialtiesCount = await countRows("specialties");
  const locationsCount = await countRows("locations");
  const doctorsCount = await countRows("doctors", { is_demo: true });
  const doctorLanguagesCount = await countRows("doctor_languages");
  const availabilitySlotsCount = await countRows("availability_slots");
  const patientsCount = await countRows("profiles", { role: "patient" });

  console.log(
    `seed complete: specialties=${specialtiesCount} locations=${locationsCount} doctors=${doctorsCount} doctor_languages=${doctorLanguagesCount} availability_slots=${availabilitySlotsCount} patients=${patientsCount}`,
  );
}

async function main(): Promise<void> {
  const specialtyIdByName = await seedSpecialties();
  const locationIdByNeighborhood = await seedLocations();
  const insertedDoctors = await seedDoctors(specialtyIdByName, locationIdByNeighborhood);
  await seedDoctorLanguages(insertedDoctors);
  await seedAvailabilitySlots();
  await seedDemoPatients();
  await printSummary();
}

main().catch((error: unknown) => {
  console.error(`seed failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
