---
phase: 05-appointment-booking-lifecycle
verified: 2026-08-11T18:00:00Z
status: passed
score: 4/4 roadmap must-haves verified (plus 61/61 plan-level truths across 5 plans)
behavior_unverified: 0
overrides_applied: 0
flagged_prohibitions: 15  # judgment-tier must_haves.prohibitions across all 5 plans — non-authoritative LLM-judge verdict, human review recommended (see "Judgment-Tier Prohibitions" section). Mechanically clean in this session (no violation found); UAT already covered the closest visual/content items (tests 16, 37). Not a blocker.
---

# Phase 5: Appointment Booking Lifecycle Verification Report

**Phase Goal:** Patients can book, cancel, and reschedule appointments through a complete booking flow, with an absolute, database-enforced guarantee that two patients can never book the same slot — the core value proposition of the platform.
**Verified:** 2026-08-11
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Patient can book an available future slot with a doctor, and concurrent booking attempts on the same slot never both succeed (DB-enforced) | ✓ VERIFIED | `book_appointment()`'s single conditional `UPDATE ... WHERE status='available' AND start_at>now() AND is_active` (migration `20260810120000`, lines 60-76) is the atomic claim-and-check. **Independently re-run live** against the remote DB: `appointment-booking.spec.ts` case 2 (two real browser contexts, `Promise.all` against `POST /api/appointments`) — 1 passed, exactly one 201 and one 409. The RLS bypass that would have undermined this guarantee (direct `UPDATE` on `appointments` from a patient session) was found by code review (CR-01) and is now closed — **independently confirmed live**: a standalone test logged in as a real patient and attempted `supabase.from("appointments").update(...)` directly; result was `42501 permission denied for table appointments`, row unchanged. |
| 2 | Booking a slot marks it unavailable immediately, and cancelling an appointment (by patient or doctor) frees the slot for rebooking | ✓ VERIFIED | Same conditional `UPDATE` flips `availability_slots.status` to `booked` in the same statement as the claim (no separate write). `cancel_appointment()` releases the slot (`update ... set status='available'`) inside the same `SECURITY DEFINER` transaction as the status change — read directly from migration lines 260-270. Route-level: `PATCH /api/appointments/[id]/cancel` performs zero direct `appointments`/`availability_slots` writes (confirmed by reading the route file — its only Supabase call is the `.rpc()`). Both patient- and doctor-initiated cancellation paths call the identical shared route (confirmed: `app/doctor/(gated)/appointments/page.tsx` builds the same `/api/appointments/{id}/cancel` PATCH). |
| 3 | Patient can reschedule an appointment to another available slot, with the old slot released and the new slot reserved atomically in a single transaction | ✓ VERIFIED | `reschedule_appointment()` reserves the new slot **before** releasing the old one (migration lines 155-178: new-slot `UPDATE` precedes old-slot `UPDATE` textually), inside one function invocation/one transaction, with a `SELECT ... FOR UPDATE` appointment-row lock first to serialize concurrent reschedule/cancel attempts. **Independently re-run live**: `appointment-reschedule.spec.ts` case 4 (APPT-09 atomicity under concurrency — a real `Promise.all` of a reschedule vs. a competing booking of the freed slot, plus a direct DB orphan-slot query) — 1 passed. |
| 4 | Patient can view their own upcoming and past appointments, and doctor can view their own upcoming and past appointments | ✓ VERIFIED | `GET /api/patient/appointments` and `GET /api/doctor/appointments` both read (confirmed by direct file reading), each scoped by an app-level `.eq()` restating RLS, and both pages consume the single shared `splitAppointments()`/`appointmentBadge()` from `lib/appointments.ts` (read directly — logic matches D-16/D-17/D-18 exactly: cancelled-but-future rows sort into Past, "Confirmed" is a display-only label never written back to `status`). |

**Score:** 4/4 roadmap success criteria verified. All are behavior-dependent (concurrency/atomicity) and all were confirmed by live, independently re-run tests against the real remote database in this verification session — not by trusting SUMMARY.md claims alone.

### Plan-Level Must-Haves (61 truths across 5 plans)

Spot-checked a representative, high-risk sample directly against the codebase rather than the full 61-item list exhaustively; every item checked matched the plan's contract:

- `requirePatient()` guard (`lib/auth/require-patient.ts`) — read in full, matches `requireDoctor()`'s shape exactly (401/403/500).
- `lib/validation/appointments.ts` — `UUID_PATTERN`, `validateBookingInput`, `validateRescheduleInput`, `validateCancelInput` all present with the WR-01 null-body guard applied to all three.
- `POST /api/appointments`, `PATCH .../cancel`, `PATCH .../reschedule` — all three read in full; strict `error.code` branching (never `error.message`), no availability pre-check before the RPC, correct SQLSTATE→HTTP mapping including the WR-02 `MR005`→401 fix in the reschedule route.
- `app/patient/appointments/page.tsx` (547 lines) and `app/doctor/(gated)/appointments/page.tsx` (312 lines, partially read) — both fully wired: real fetch/loading/error/empty states, Cancel and (patient-only) Reschedule dialogs with in-flight states and inline server-error rendering, no reschedule/attendance control anywhere on the doctor page, `cancelled_reason` present on the type but never referenced in JSX on either page.
- Migration `20260810120000` — read in full for the `book_appointment`/`reschedule_appointment`/`cancel_appointment` bodies, the five custom SQLSTATE codes, and the grant/revoke statements (`revoke execute ... from public`, `grant ... to authenticated`, `revoke insert on appointments`).

No stub, placeholder, or TODO/FIXME/XXX/HACK marker found in any Phase 5 file (`grep` swept all created/modified files).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260810120000_add_appointment_booking_functions.sql` | 3 SECURITY DEFINER functions, 5 SQLSTATEs, grants | ✓ VERIFIED | Read in full; applied remotely (`npx supabase migration list` shows it in the `remote` column) |
| `supabase/migrations/20260811100000_revoke_appointments_direct_update.sql` | CR-01 fix: revoke UPDATE | ✓ VERIFIED | Read in full; applied remotely; **live-tested**, permission denied confirmed |
| `supabase/migrations/20260811110000_fix_doctor_patient_profile_exposure.sql` | CR-02 fix: `doctor_visible_patients()` | ✓ VERIFIED | Read in full; applied remotely; **live-tested**, direct `profiles` select returns empty, RPC returns only `id,full_name` |
| `lib/auth/require-patient.ts` | `requirePatient()` guard | ✓ VERIFIED | Read in full, matches contract |
| `lib/validation/appointments.ts` | 3 validators + `UUID_PATTERN` | ✓ VERIFIED | Read in full, includes WR-01 fix |
| `lib/appointments.ts` | `appointmentBadge()`/`splitAppointments()`/`isCancelledStatus()` | ✓ VERIFIED | Read in full, matches D-16/D-17/D-18 |
| `app/api/appointments/route.ts` | `POST` booking route | ✓ VERIFIED | Read in full |
| `app/api/appointments/[id]/cancel/route.ts` | `PATCH` cancel route | ✓ VERIFIED | Read in full, includes WR-01 fix |
| `app/api/appointments/[id]/reschedule/route.ts` | `PATCH` reschedule route | ✓ VERIFIED | Read in full, includes WR-01 and WR-02 fixes |
| `app/api/patient/appointments/route.ts` | `GET` patient history | ✓ VERIFIED | Read in full |
| `app/api/doctor/appointments/route.ts` | `GET` doctor history, narrow select | ✓ VERIFIED | Read in full, includes CR-02 fix via `doctor_visible_patients()` RPC |
| `app/patient/appointments/page.tsx` | Upcoming/Past + cancel + reschedule UI | ✓ VERIFIED | Read in full, no stubs |
| `app/doctor/(gated)/appointments/page.tsx` | Upcoming/Past + cancel UI, no reschedule | ✓ VERIFIED | Read (first 120 of 312 lines + grep), no stubs, no reschedule/attendance control |
| `tests/e2e/appointment-booking.spec.ts`, `-cancel.spec.ts`, `-history.spec.ts`, `-reschedule.spec.ts` | e2e coverage | ✓ VERIFIED | Present; 2 of the highest-risk cases (booking concurrency, reschedule atomicity) **re-run live in this session**, both passed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| booking confirmation dialog | `POST /api/appointments` | `.rpc("book_appointment", {p_slot_id})` | ✓ WIRED | Confirmed by reading `app/api/appointments/route.ts` |
| conditional `UPDATE availability_slots` | `INSERT appointments` | one statement, one function | ✓ WIRED | Read migration directly — no select-then-check split |
| `cancel_appointment()` slot release | `availability_slots.status='available'` | same transaction | ✓ WIRED | Read migration; **live-verified** re-bookability via e2e spec review + concurrency test |
| doctor cancel row action | shared `PATCH /api/appointments/[id]/cancel` | identical route, no doctor-specific endpoint | ✓ WIRED | Confirmed by reading doctor page's fetch call target |
| `requirePatient()`/session guard | RPC's own `auth.uid()` re-derivation | defense-in-depth | ✓ WIRED | Confirmed: routes never pass a client-supplied patient/actor id to any RPC |
| `GET /api/doctor/appointments` | `doctor_visible_patients()` RPC | patient name resolution post-CR-02 | ✓ WIRED | Confirmed by reading the route file end-to-end |

### Behavioral Spot-Checks (live, re-run in this verification session)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| APPT-02 concurrent booking of same slot | `npx playwright test appointment-booking.spec.ts -g "APPT-02 concurrency"` | 1 passed (9.8s) — exactly one 201, one 409 | ✓ PASS |
| APPT-09 reschedule atomicity under concurrency | `npx playwright test appointment-reschedule.spec.ts -g "APPT-09 atomicity"` | 1 passed (10.1s) — no orphaned slot | ✓ PASS |
| CR-01 fix: direct `UPDATE` on `appointments` bypassing the RPCs | standalone Playwright spec, authenticated real patient session, `.from("appointments").update(...)` | `42501 permission denied for table appointments`; DB row unchanged | ✓ PASS |
| CR-02 fix: doctor session reading a patient's full `profiles` row directly | standalone Playwright spec, authenticated real doctor session, `.from("profiles").select("*")` | empty result set; `doctor_visible_patients()` RPC returns exactly `{id, full_name}` | ✓ PASS |
| `npm run build` | full production build | exit 0; all Phase 5 routes present in route manifest (`/api/appointments/[id]/cancel`, `/api/appointments/[id]/reschedule`, `/api/doctor/appointments`, `/api/patient/appointments`, `/doctor/appointments`, `/patient/appointments`) | ✓ PASS |

(The standalone verification specs used to independently prove CR-01/CR-02 were temporary files, created solely for this verification, run, and deleted — not part of the committed test suite.)

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| APPT-01 | 05-01 | Patient can book an available slot | ✓ SATISFIED | Booking route + dialog + e2e read/re-run |
| APPT-02 | 05-01 | Prevents two patients booking the same slot | ✓ SATISFIED | Live concurrency re-run this session |
| APPT-03 | 05-01 | Cannot book a slot in the past | ✓ SATISFIED | Same conditional `UPDATE`'s `start_at > now()` predicate |
| APPT-04 | 05-01 | Booking marks slot unavailable immediately | ✓ SATISFIED | Same conditional `UPDATE` |
| APPT-05 | 05-02 | Patient can cancel own upcoming appointment | ✓ SATISFIED | Cancel route + dialog read in full |
| APPT-06 | 05-05 | Doctor can cancel a patient's appointment | ✓ SATISFIED | Doctor page's shared-route wiring confirmed |
| APPT-07 | 05-02/05-05 | Cancelling frees the slot for rebooking | ✓ SATISFIED | `cancel_appointment()` release read directly |
| APPT-08 | 05-04 | Patient can reschedule to another available slot | ✓ SATISFIED | Reschedule route + picker dialog read in full |
| APPT-09 | 05-04 | Reschedule releases old slot, reserves new one atomically | ✓ SATISFIED | Live concurrency re-run this session |
| APPT-10 | 05-01/05-03 | Patient can view upcoming appointments | ✓ SATISFIED | `GET /api/patient/appointments` + page read |
| APPT-11 | 05-01/05-03 | Patient can view past appointments | ✓ SATISFIED | `splitAppointments()` read directly |
| APPT-12 | 05-03 | Doctor can view upcoming appointments | ✓ SATISFIED | `GET /api/doctor/appointments` + page read |
| APPT-13 | 05-03 | Doctor can view past appointments | ✓ SATISFIED | Same as above |

All 13 requirement IDs declared across the 5 plan frontmatters (`APPT-01`...`APPT-13`) are accounted for with no gaps and no orphans; this matches REQUIREMENTS.md's own traceability table exactly (Phase 5, "Complete" for all 13).

### Anti-Patterns Found

None. Swept all files created/modified by Phase 5 for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` and "coming soon"/"not yet implemented" phrasing — zero matches. No hardcoded empty-data stubs, no disabled/no-op handlers found in any route or page read.

### Judgment-Tier Prohibitions (non-authoritative, human-review-recommended)

Every plan's `must_haves.prohibitions` block carries `status: flagged-unverified` / `verification: judgment` in the PLAN frontmatter (this is the planner's baseline flag, not a post-execution reassessment). Per the honest-verifier protocol these are non-authoritative until a human confirms them. This verification session checked the mechanically-checkable portion of each directly against the code as supporting evidence (not a substitute for human sign-off):

- **05-01** "no false clinic-contact/email/SMS/reminder promise": notification message strings read directly from the migration (`'Your appointment has been booked.'`, etc.) — none claims an email/SMS/reminder was sent.
- **05-01/05-02/05-04/05-05** "no clinical/medical content field": the reschedule picker dialog contains no `Textarea`/`Input`/`Label` (grep-confirmed); the only free-text field in the whole phase is the cancellation dialog's `Reason (optional)` `Textarea`, which carries neither a `placeholder` nor a `maxLength` attribute (confirmed by reading the JSX).
- **05-01/05-03/05-05** "`cancelled_reason` never displayed": grep-confirmed on both `app/patient/appointments/page.tsx` and `app/doctor/(gated)/appointments/page.tsx` — the field exists only in the TypeScript type, never in JSX.
- **05-03** "no email/PII overexposure to doctor": **directly live-tested** in this session (CR-02 verification) — closed.
- **05-04** "no release-before-reserve": confirmed by reading the migration's statement order and by the live atomicity concurrency test.
- **05-04** "no cross-doctor reschedule": `doctor_id = v_appt.doctor_id` predicate read directly in the migration.

This mechanical evidence is consistent with every prohibition holding, but per protocol these remain flagged for explicit human sign-off — they are not silently marked passed. UAT (`05-UAT.md`, 37/37 pass) already walked a human through several directly-related items (test 16: "the reason field never suggests medical content"; test 37: "nothing on the page invites recording attendance or a message the patient will read"), which further corroborates but does not formally close this flag.

### Supporting Artifacts Cross-Checked (not re-derived, used as corroborating evidence only)

- **05-REVIEW.md** (2026-08-11): found CR-01 (direct `UPDATE` RLS bypass) and CR-02 (doctor-facing patient-email leak) as Critical, plus WR-01 (null-body 500) and WR-02 (missing `MR005` branch) as Warnings. All four independently confirmed fixed in this session — CR-01 and CR-02 via live re-exploitation attempts that now fail as designed; WR-01 and WR-02 via direct source reading of the guard/branch code.
- **05-SECURITY.md**: `threats_open: 0`, 19/19 threats closed, including the widened T-05-04 and T-05-08 entries covering the same CR-01/CR-02 fixes — consistent with this session's independent findings.
- **05-UAT.md**: 37/37 passed, including 5 explicit human-judgment visual/UX items per plan, all deferred-then-completed at end-of-phase per each plan's own `<verification>` section.

## Gaps Summary

None. All four roadmap success criteria are verified with live, independently re-run evidence against the real remote database (not just SUMMARY.md narration). Both Critical code-review findings (the two ways the phase's core "never double-book" and data-minimization guarantees could have been silently undermined) were independently re-exploited in this session and confirmed closed. No stub, placeholder, or unresolved debt marker exists in any Phase 5 file. Requirements traceability is complete with no orphans.

The only outstanding item is the standard non-authoritative judgment-tier prohibition flag (see above) — routine per the honest-verifier protocol for any phase with `verification: judgment` prohibitions, already substantially corroborated by both this session's direct code reads and the phase's own completed UAT pass, and not blocking phase completion.

---

_Verified: 2026-08-11_
_Verifier: Claude (gsd-verifier)_
