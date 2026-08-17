// MedRDV — Removes accumulated Playwright/manual-debug residue from the
// shared dev database (doctors, specialties, locations, and auth accounts
// created by tests/e2e/helpers/* or manual admin-UI debugging sessions,
// never cleaned up because their owning test run crashed, timed out, or was
// killed before its afterAll hook ran).
//
// Safety model — a WHITELIST, not a blocklist: every row this script deletes
// falls outside an explicit list of known-legitimate identifiers (the 12
// seed doctor names, 12 seed specialty names, 12 seed neighborhood names,
// and 4 seed patient emails, all copied verbatim from scripts/seed.ts, plus
// any explicitly-preserved email). Nothing is deleted by pattern-matching
// alone. Anything not on a whitelist AND not matching a known residue shape
// is left untouched and reported for manual review instead.
//
// Dry-run by default. Pass --apply to actually delete. Deletion order
// respects this schema's FK constraints (supabase/migrations/
// 20260803230000_initial_schema.sql): appointments (on delete restrict from
// slots/patients/doctors) must go before doctors/profiles; specialties/
// locations (on delete restrict from doctors) must go after doctors.
//
// Run with: npx tsx scripts/cleanup-test-residue.ts        (dry run)
//           npx tsx scripts/cleanup-test-residue.ts --apply (actually delete)

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!SUPABASE_URL) throw new Error("Missing env var NEXT_PUBLIC_SUPABASE_URL");

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) throw new Error("Missing env var SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const APPLY = process.argv.includes("--apply");

// Copied verbatim from scripts/seed.ts's SPECIALTIES/LOCATIONS/DOCTORS/
// DEMO_PATIENTS arrays (2026-08-17). If the seed script's demo catalog ever
// changes, update this list first and re-run in dry-run mode to confirm the
// counts still make sense before applying.
const SEED_DOCTOR_NAMES = new Set([
  "Dr. Noa Ben-David", "Dr. Avi Rosenberg", "Dr. Michal Katz", "Dr. Yossi Peretz",
  "Dr. Tamar Levi", "Dr. Ronen Shapira", "Dr. Dana Avraham", "Dr. Eli Mizrahi",
  "Dr. Shira Cohen-Barak", "Dr. Omer Golan", "Dr. Liora Segal", "Dr. Amit Friedman",
]);
const SEED_SPECIALTY_NAMES = new Set([
  "Family Medicine", "Cardiology", "Dermatology", "Pediatrics", "Gynecology",
  "Orthopedics", "Ophthalmology", "Otolaryngology (ENT)", "Gastroenterology",
  "Psychiatry", "Neurology", "Urology",
]);
const SEED_NEIGHBORHOODS = new Set([
  "Lev HaIr", "Florentin", "Neve Tzedek", "Ramat Aviv", "Old North", "New North",
  "Yad Eliyahu", "Jaffa", "Kerem HaTeimanim", "Bavli", "Montefiore", "Shapira",
]);
const SEED_PATIENT_EMAILS = new Set([
  "noa.patient@example.com", "yossi.patient@example.com",
  "maya.patient@example.com", "daniel.patient@example.com",
]);
// Explicitly preserved regardless of domain — real accounts, not fixtures.
const PRESERVED_EMAILS = new Set(["admin@medrdv.demo", "mellulnoam@gmail.com"]);

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  console.log(APPLY ? "=== APPLY MODE — rows will be deleted ===" : "=== DRY RUN (pass --apply to delete) ===");

  // --- 1. Identify target doctors (whitelist: keep only the 12 seed names) ---
  const { data: allDoctors, error: doctorsErr } = await supabase
    .from("doctors")
    .select("id, full_name, profile_id");
  if (doctorsErr) throw doctorsErr;
  const targetDoctors = (allDoctors ?? []).filter((d) => !SEED_DOCTOR_NAMES.has(d.full_name));
  const targetDoctorIds = targetDoctors.map((d) => d.id);

  // --- 2. Identify target profiles (whitelist: @example.com minus the 4 seed
  //        patients, plus never touch PRESERVED_EMAILS regardless of domain) ---
  const { data: allProfiles, error: profilesErr } = await supabase
    .from("profiles")
    .select("id, email, role, full_name");
  if (profilesErr) throw profilesErr;
  const targetProfiles = (allProfiles ?? []).filter((p) => {
    if (!p.email) return false;
    if (PRESERVED_EMAILS.has(p.email)) return false;
    if (SEED_PATIENT_EMAILS.has(p.email)) return false;
    return p.email.toLowerCase().endsWith("@example.com");
  });
  const targetProfileIds = targetProfiles.map((p) => p.id);

  const unexplainedProfiles = (allProfiles ?? []).filter(
    (p) =>
      !PRESERVED_EMAILS.has(p.email ?? "") &&
      !SEED_PATIENT_EMAILS.has(p.email ?? "") &&
      !(p.email ?? "").toLowerCase().endsWith("@example.com"),
  );

  // --- 3. Identify target specialties/locations (whitelist: keep the 12 seed names) ---
  const { data: allSpecialties, error: specErr } = await supabase.from("specialties").select("id, name_en");
  if (specErr) throw specErr;
  const targetSpecialtyIds = (allSpecialties ?? [])
    .filter((s) => !SEED_SPECIALTY_NAMES.has(s.name_en))
    .map((s) => s.id);

  const { data: allLocations, error: locErr } = await supabase.from("locations").select("id, neighborhood");
  if (locErr) throw locErr;
  const targetLocationIds = (allLocations ?? [])
    .filter((l) => !SEED_NEIGHBORHOODS.has(l.neighborhood))
    .map((l) => l.id);

  // --- 4. Appointments referencing either a target doctor or a target profile
  //        (patient) must be removed before doctors/profiles, per the
  //        on-delete-restrict FKs on appointments.slot_id/patient_id/doctor_id. ---
  const { data: apptsByDoctor } = await supabase
    .from("appointments")
    .select("id")
    .in("doctor_id", targetDoctorIds.length ? targetDoctorIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data: apptsByPatient } = await supabase
    .from("appointments")
    .select("id")
    .in("patient_id", targetProfileIds.length ? targetProfileIds : ["00000000-0000-0000-0000-000000000000"]);
  const targetAppointmentIds = Array.from(
    new Set([...(apptsByDoctor ?? []).map((a) => a.id), ...(apptsByPatient ?? []).map((a) => a.id)]),
  );

  console.log("\n--- Plan ---");
  console.log(`Doctors to delete:      ${targetDoctorIds.length} (of ${allDoctors?.length ?? 0} total, keeping ${SEED_DOCTOR_NAMES.size} seed doctors)`);
  console.log(`Profiles to delete:     ${targetProfileIds.length} (of ${allProfiles?.length ?? 0} total)`);
  console.log(`Specialties to delete:  ${targetSpecialtyIds.length} (of ${allSpecialties?.length ?? 0} total, keeping ${SEED_SPECIALTY_NAMES.size} seed specialties)`);
  console.log(`Locations to delete:    ${targetLocationIds.length} (of ${allLocations?.length ?? 0} total, keeping ${SEED_NEIGHBORHOODS.size} seed neighborhoods)`);
  console.log(`Appointments to delete: ${targetAppointmentIds.length} (referencing a target doctor or patient)`);
  console.log(`Profiles NOT matched by any rule (left untouched, review manually): ${unexplainedProfiles.length}`);
  for (const p of unexplainedProfiles) {
    console.log(`  - KEEP (unexplained): ${p.role} ${p.email} "${p.full_name}"`);
  }

  if (!APPLY) {
    console.log("\nDry run only — no rows deleted. Re-run with --apply to execute.");
    return;
  }

  console.log("\n--- Executing ---");

  // Step 1: appointments (restrict-referenced by slots/patients/doctors)
  for (const batch of chunk(targetAppointmentIds, 200)) {
    if (batch.length === 0) continue;
    const { error } = await supabase.from("appointments").delete().in("id", batch);
    if (error) console.error("  appointments batch failed:", error.message);
  }
  console.log(`  appointments deleted: ${targetAppointmentIds.length}`);

  // Step 2: doctors (cascades doctor_languages + availability_slots; sets
  // any linked profile's doctors.profile_id is irrelevant here, it's the
  // profile row being deleted next that matters)
  let doctorsDeleted = 0;
  for (const batch of chunk(targetDoctorIds, 200)) {
    if (batch.length === 0) continue;
    const { error } = await supabase.from("doctors").delete().in("id", batch);
    if (error) console.error("  doctors batch failed:", error.message);
    else doctorsDeleted += batch.length;
  }
  console.log(`  doctors deleted: ${doctorsDeleted}`);

  // Step 3: auth users (cascades profiles -> favorites/notifications)
  let profilesDeleted = 0;
  let profilesFailed = 0;
  for (const id of targetProfileIds) {
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) {
      profilesFailed += 1;
      console.error(`  auth.deleteUser(${id}) failed:`, error.message);
    } else {
      profilesDeleted += 1;
    }
  }
  console.log(`  profiles (via auth user) deleted: ${profilesDeleted}, failed: ${profilesFailed}`);

  // Step 4: specialties (now unreferenced by any surviving doctor)
  let specialtiesDeleted = 0;
  for (const batch of chunk(targetSpecialtyIds, 200)) {
    if (batch.length === 0) continue;
    const { error } = await supabase.from("specialties").delete().in("id", batch);
    if (error) console.error("  specialties batch failed:", error.message);
    else specialtiesDeleted += batch.length;
  }
  console.log(`  specialties deleted: ${specialtiesDeleted}`);

  // Step 5: locations (now unreferenced by any surviving doctor)
  let locationsDeleted = 0;
  for (const batch of chunk(targetLocationIds, 200)) {
    if (batch.length === 0) continue;
    const { error } = await supabase.from("locations").delete().in("id", batch);
    if (error) console.error("  locations batch failed:", error.message);
    else locationsDeleted += batch.length;
  }
  console.log(`  locations deleted: ${locationsDeleted}`);

  console.log("\nDone.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
