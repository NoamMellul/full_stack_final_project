# MedRDV — Medical Appointment Booking Platform (Israel)

## What This Is

A Doctolib-like web platform adapted for the Israeli market, letting a patient search for a private doctor by specialty, spoken language (Hebrew/English), neighborhood, and availability, then book an appointment directly online. V1 is scoped to Tel-Aviv only. Doctor profiles and their availability are clearly-labeled demo data — there is no integration with real medical practices. This is a university final-year Full-Stack development project.

## Core Value

A patient must be able to find a doctor matching their criteria and book an available slot in a few clicks, with an absolute guarantee that two patients can never book the same slot.

## Business Context

- **Customer**: Patients (free to use) and private doctors/clinics (subscription — not implemented in v1)
- **Revenue model**: Monthly doctor/clinic subscription, envisioned for a future version — the data model must not block adding it later, but no payment integration is built now
- **Success metric**: A complete, flawless booking journey (search → profile → slot → booking → confirmation → management), demonstrable in the defense
- **Strategy notes**: —

## Requirements

### Validated

- [x] Patient authentication (sign up, log in, log out, persistent session) — Validated in Phase 1: Foundation — Database Schema & Authentication
- [x] Doctor accounts created and activated by the admin (no doctor self-registration) — Validated in Phase 2: Admin — Doctor & Reference Data Management
- [x] Full doctor management by the admin (create, edit, activate/deactivate) — Validated in Phase 2: Admin — Doctor & Reference Data Management
- [x] Reference data management by the admin (specialties, neighborhoods) — Validated in Phase 2: Admin — Doctor & Reference Data Management
- [x] Multi-criteria doctor search: name, specialty, language, neighborhood, availability — Validated in Phase 3: Doctor Discovery — Search & Public Profiles
- [x] Public doctor profiles (specialty, description, address, neighborhood, languages, next slots, demo status) — Validated in Phase 3: Doctor Discovery — Search & Public Profiles
- [x] Doctor availability management (add/remove slots, block periods) — Validated in Phase 4: Doctor Availability Management
- [x] Appointment booking with guaranteed double-booking prevention — Validated in Phase 5: Appointment Booking & Lifecycle
- [x] Appointment cancellation (patient and doctor) — Validated in Phase 5: Appointment Booking & Lifecycle
- [x] Rescheduling an appointment to another available slot — Validated in Phase 5: Appointment Booking & Lifecycle
- [x] Appointment history (upcoming/past) for patient and doctor — Validated in Phase 5: Appointment Booking & Lifecycle

### Active

- [ ] Favorites: patient can save favorite doctors
- [ ] In-app notifications (confirmation, cancellation, reschedule)
- [ ] Patient dashboard, doctor dashboard, admin dashboard
- [ ] Bilingual Hebrew/English interface with RTL support

### Out of Scope

- Medical records, diagnosis, prescriptions, lab results — regulated sensitive medical data, out of the ethical/legal scope of a demo project
- Full teleconsultation — video/streaming complexity disproportionate to the value for this project
- Consultation payment, reimbursement, insurance management — requires real financial/regulatory integration not relevant to the demo
- Real integration with actual doctors or Israeli healthcare systems — all data is clearly labeled demo data
- Medical AI, diagnostic recommendations — off-topic and risks user misinterpretation
- Detailed patient-doctor medical messaging — beyond appointment booking

## Context

- University final-year Full-Stack development project — must be presentable in a 10-15 minute defense and complete enough to demonstrate Full-Stack mastery (CRUD, roles, permissions, security, tests, scalability).
- Tech stack imposed by the assignment: Next.js, TypeScript, Supabase (DB + Auth), deployment on Vercel, public URL.
- The user explicitly prefers standard, widely-known technical choices over framework-specific abstractions, even if it means writing a bit more code — clarity and ease of defense take priority over Next.js idiomatic style. See decisions below (REST instead of Server Actions, manual validation instead of Zod).
- The database is considered by the user to be the most critical part of the project — the schema must be solid, well-constrained (DB-level anti-double-booking, RLS for role isolation) and explicitly validated before implementation.
- Target market: Israel, v1 scoped to Tel-Aviv only. Supported languages: Hebrew and English only.

## Constraints

- **Tech stack**: Next.js (App Router) + TypeScript + Supabase (Postgres, Auth, Storage) + Vercel deployment — imposed by the university assignment
- **API architecture**: Classic REST API routes (Next.js Route Handlers, `app/api/.../route.ts`) — no Server Actions. Explicit user choice: more standard, more universally understood, easier to defend. Supabase Auth itself is used via its own client SDK/REST API — this decision applies to our own business-logic endpoints (booking, admin CRUD, availability), not to Supabase Auth's own calls.
- **Validation**: manual TypeScript validation functions (no schema library like Zod) — same reasoning of simplicity and familiarity
- **Tests**: Playwright only (end-to-end) — no Vitest, no React Testing Library. The user judges isolated component tests add little value here; Playwright must cover all critical flows (booking, permissions, double-booking)
- **Medical data**: no sensitive medical data stored (no diagnosis, prescription, medical record, lab result)
- **i18n**: lightweight custom solution (React context + JSON dictionaries, conditional `dir="rtl"`) — no heavy i18n library (next-intl ruled out, no locale routing needed for 2 static languages)
- **UI**: Tailwind CSS + shadcn/ui — lightweight, customizable, good RTL support via CSS logical properties, more idiomatic with Server Components than Material UI or Ant Design
- **Timezone**: everything stored as `timestamptz` UTC; conversion to `Asia/Jerusalem` only at display/input time (DST handling)
- **Language**: all project documentation, code, comments, and commit messages are written in English

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Classic REST API routes instead of Server Actions | More standard, easier to explain/defend, less Next.js-specific "magic" | — Pending |
| Manual validation instead of Zod | Simplicity, no extra dependency, explicit logic readable by anyone | — Pending |
| Playwright only, no Vitest/React Testing Library | E2E tests cover everything that matters (flows, permissions, double-booking); isolated component tests add little value here | — Pending |
| Merge `blocked_periods` into `availability_slots` (status `blocked`) | Single table to query for the doctor's schedule, same overlap-detection logic applies | Validated Phase 4 — one table, one overlap-detection exclusion constraint for both booked and doctor-blocked time |
| DB-level guaranteed anti-double-booking (partial unique constraint + transaction) | Strong guarantee against concurrent bookings, not just an application-level check | Validated Phase 5 — `book_appointment`/`reschedule_appointment` use a single atomic conditional `UPDATE` plus a partial unique index as backstop; proven under real `Promise.all` concurrency in `appointment-booking.spec.ts`/`appointment-reschedule.spec.ts` and independently re-run live by the phase verifier |
| Every `appointments` write goes through a `SECURITY DEFINER` RPC function, never a direct table write | Table-level `INSERT`/`UPDATE` revoked from `anon`/`authenticated` on `appointments` so `book_appointment()`/`reschedule_appointment()`/`cancel_appointment()` are the only path, closing an RLS bypass a code review found mid-phase (CR-01) | Validated Phase 5 — re-verified live: a direct `supabase.from("appointments").update(...)` from an authenticated patient session returns `42501 permission denied` |
| Tailwind CSS + shadcn/ui | Lightweight, customizable, good RTL support, more idiomatic with Server Components than MUI/Ant Design | — Pending |
| Custom i18n (no next-intl) | Only 2 static languages, no locale routing needed | — Pending |
| V1 city: Tel-Aviv only | Younger market, high simulated density of English-speaking private doctors, consistent with demo data | — Pending |
| Doctor account creation via temporary password (no email invite) | Avoids setting up a real email-sending service for the demo | — Pending |
| Project language: English | Standard for software artifacts and code, even though the user chats in French | — Pending |
| Search and public profiles are fully unauthenticated (no login required to browse) | Patients should be able to evaluate doctors before creating an account | Validated Phase 3 — confirmed live via anon-client tests, no auth guard on `GET /api/doctors` or `GET /api/doctors/[id]` |
| Every search filter must fail closed on an unmatchable value (never fall through to an unfiltered result) | A filter parameter that normalizes to "nothing" must return zero rows, not silently degrade to "no filter" | Validated Phase 3 — established for the availability filter in 03-05, generalized to the name filter in 03-07 after a verification gap; now a standing invariant for any future filter on this route |
| Booking is out of scope for Phase 3 — profile shows upcoming slots but "Select this slot" is inert | Search & discovery ships independently of the booking flow, which is a later phase | Validated Phase 3 — control carries the native `disabled` attribute, no click handler, no booking endpoint exists yet |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-11 after Phase 5 completion*
