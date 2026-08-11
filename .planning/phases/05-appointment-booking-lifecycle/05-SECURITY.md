---
phase: 05
slug: appointment-booking-lifecycle
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-11
---

# Phase 05 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser -> `POST /api/appointments`, `PATCH .../cancel`, `PATCH .../reschedule`, `GET /api/patient\|doctor/appointments` | Untrusted JSON (slot id, appointment id, free-text reason, any forged extra keys) | slot/appointment identifiers, free-text reason |
| route handler -> Postgres via session-bound Supabase client | RLS evaluates for reads; writes go through RPC | authenticated session (JWT) |
| `SECURITY DEFINER` function body (`book_appointment`, `reschedule_appointment`, `cancel_appointment`, `doctor_visible_patients`) -> rest of DB | RLS is bypassed inside; the function body is the sole authorization boundary | appointment/slot/profile rows |
| patient/doctor session -> another party's `appointments`/`availability_slots`/`profiles` rows | Ownership boundary enforced by `auth.uid()`-scoped filters, not client-supplied ids | appointment ownership, patient PII (name, email) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-05-01 | Tampering | slot reservation inside `book_appointment`/`reschedule_appointment` | critical | mitigate | Single conditional `UPDATE ... WHERE status='available' AND start_at>now() AND is_active` — availability check and status flip are the same statement; `appointments_active_slot_unique_idx` is the independent second layer. Proven by `appointment-booking.spec.ts#2` (concurrent booking, exactly one 201/one 409) and `appointment-reschedule.spec.ts#4` (concurrency, no orphaned slot). | closed |
| T-05-02 | Elevation of Privilege | RPC parameters / cancellation actor | high | mitigate | `patient_id`/actor is resolved from `auth.uid()` inside each function body, never a client parameter. Proven by `appointment-cancel.spec.ts#15` (actor not client-supplied, both directions). | closed |
| T-05-03 | Elevation of Privilege | `SECURITY DEFINER` functions reachable by `anon` | high | mitigate | `revoke execute ... from public` + `grant ... to authenticated`; explicit `auth.uid()` null check raising `MR005` as first statement. | closed |
| T-05-04 | Tampering | direct PostgREST `INSERT`/`UPDATE` on `appointments`, bypassing the RPC functions | high | mitigate | `revoke insert` (20260810120000) + `revoke update` (20260811100000, code-review CR-01 fix) on `appointments` from `anon, authenticated` — every legitimate write now goes exclusively through the three RPC functions. Verified by reading `20260811100000_revoke_appointments_direct_update.sql`; full suite green after the fix (290/290). | closed |
| T-05-05 | Elevation of Privilege / Info Disclosure | cancel/reschedule appointment-lookup ownership | high | mitigate | Function body filters by `patient_id = auth.uid() OR doctors.profile_id = auth.uid()` (cancel) / `patient_id = auth.uid()` (reschedule); route maps a foreign id and a missing id to one identical 404. Proven by `appointment-cancel.spec.ts#8/#16`, `appointment-reschedule.spec.ts#8`. | closed |
| T-05-06 | Tampering | concurrent cancel/reschedule racing on the same appointment | high | mitigate | `SELECT ... FOR UPDATE` on the appointment row as the first statement of every mutating function, serializing concurrent callers. | closed |
| T-05-07 | Denial of Service | unbounded `cancelled_reason` free text | low | mitigate | `validateCancelInput`/`validateRescheduleInput` enforce a 2000-char bound server-side before the RPC call. | closed |
| T-05-08 | Information Disclosure | doctor-facing patient data (`DOCTOR_APPOINTMENT_SELECT` + backing RLS) | high | mitigate | App select carries only `id, full_name` (no email, no slot reason). Original backing RLS policy (`profiles_select_via_own_appointment_doctor`) over-granted at row level (code-review CR-02) — dropped and replaced with `doctor_visible_patients()` SECURITY DEFINER function returning only `(id, full_name)`, resolved from `auth.uid()`/`is_doctor_owner()`, never a full-row embed. Verified by reading `20260811110000_fix_doctor_patient_profile_exposure.sql` and `app/api/doctor/appointments/route.ts`; full suite green after the fix. | closed |
| T-05-09 | Denial of Service | deadlock-aborted reschedule surfacing as unhandled 500 | low | mitigate | Route branches on `40P01` before the generic 500 fallback. Verified by source inspection (`app/api/appointments/[id]/reschedule/route.ts:88` precedes the fallback at `:103`) — deliberately not provoked at runtime (would be inherently flaky); recorded in UAT test 28. | closed |
| T-05-10 | Information Disclosure | booking/reschedule-rejection copy | low | mitigate | One literal generic string per call site; never reveals whether a slot was booked, in the past, or doctor-deactivated. Proven by pairwise body-comparison tests. | closed |
| T-05-11 | Information Disclosure | patient-scoped appointment read | medium | mitigate | Select string carries no `profiles` embed beyond scope and no slot `reason`; `.eq("patient_id", guard.userId)` restates RLS at the app layer. | closed |
| T-05-12 | Tampering | status changed without the slot released, or the reverse | medium | mitigate | Both writes happen inside one `SECURITY DEFINER` function call (one implicit transaction); neither route performs a separate `availability_slots` write. | closed |
| T-05-13 | Information Disclosure | `cancelled_reason` free text reaching the counterparty | low | mitigate | Reason is stored but never re-served, never rendered on either list page, never copied into a notification message. | closed |
| T-05-14 | Information Disclosure | cross-doctor appointment visibility | high | mitigate | `requireDoctor()` resolves `doctorId` from `doctors.profile_id = auth.uid()`; query carries `.eq("doctor_id", guard.doctorId)`; RLS is the independent backstop. Proven by `appointment-history.spec.ts#6`. | closed |
| T-05-15 | Elevation of Privilege | `/doctor/appointments` reachable pre-auth or before forced password change | medium | mitigate | Page placed inside the existing `app/doctor/(gated)/` route group, inheriting the Phase 1 role guard and Phase 2 password gate with no new code. | closed |
| T-05-16 | Information Disclosure | `cancelled_reason` rendered to the counterparty in the UI | low | mitigate | Column present on the type for completeness but never referenced in either page's JSX. | closed |
| T-05-17 | Elevation of Privilege | reschedule target slot belonging to a different doctor | high | mitigate | Reservation `UPDATE` carries `doctor_id = v_appt.doctor_id`; a foreign-doctor `newSlotId` matches zero rows and raises `MR001`. Proven by `appointment-reschedule.spec.ts#6d`. | closed |
| T-05-18 | Repudiation | cancelled appointment disappearing from either party's history | medium | mitigate | `cancel_appointment()` updates the row and never deletes it; both pages place a cancelled row under Past rather than filtering it out. | closed |
| T-05-SC | Tampering | npm/pip/cargo installs across all 5 plans | high | mitigate | Zero new packages installed in this phase (RESEARCH.md Package Legitimacy Audit: "Not applicable" for every plan). | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (`high`) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-11 | 19 | 19 | 0 | Claude (gsd-secure-phase, L1 grep-depth self-verification against plan-authored register + code-review fix commits `0359be3`/`ddb9c73`) |

Two threats above (T-05-04, T-05-08) were originally scoped narrower at plan time and widened during this audit to also cover `05-REVIEW.md` findings CR-01 (direct `UPDATE` bypass on `appointments`) and CR-02 (patient email leak via doctor-facing RLS) — both found by code review after planning, both fixed in commits `0359be3` and `ddb9c73` respectively, both re-verified here against the applied migrations and a green 290/290 Playwright run taken after the fixes landed.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-11
