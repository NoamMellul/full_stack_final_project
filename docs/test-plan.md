# MedRDV — Test Plan

> Covers the assignment brief's "Test Specification Document" requirement (מסמך אפיון בדיקות): what needs to be tested to prove the product actually works, and how each category is covered. This document describes the **actual, implemented** test suite — every example cited below is a real test in the repo, not an aspiration.

## Tooling and approach

**Playwright only**, end-to-end, against a real running dev server and a real (shared, linked) Supabase project — no Vitest, no React Testing Library, no mocked backend. This was a deliberate project decision: isolated component tests were judged to add little value for this product, whereas full end-to-end coverage of every critical flow (booking, permissions, double-booking) gives much stronger confidence that the system actually works as a whole, closer to how a real user or an attacker would interact with it.

**Scale of the suite**: 44 spec files, 382 individual `test()` cases, at `tests/e2e/`.

**Fixture and cleanup discipline**: test data created for a spec (users, doctors, appointments) is tracked and cleaned up via `test.afterAll` in shared helpers (`tests/e2e/helpers/*.ts`), each of which routes privileged access exclusively through a dedicated `testAdminClient()` — no test ever reads the service-role key directly.

---

## 1. Tests for core features

Each major feature has its own dedicated spec file, generally covering the happy path plus its immediate variations:

| Feature | Spec file(s) |
|---|---|
| Search (filters, sort, pagination) | `search-filters.spec.ts`, `search-sort-pagination.spec.ts`, `search-view-visibility.spec.ts` |
| Doctor public profile | `doctor-profile.spec.ts` |
| Booking an appointment | `appointment-booking.spec.ts` |
| Cancelling an appointment | `appointment-cancel.spec.ts` |
| Rescheduling an appointment | `appointment-reschedule.spec.ts` |
| Appointment history | `appointment-history.spec.ts` |
| Doctor schedule management (add/delete slots, block periods) | `doctor-schedule-add-slot.spec.ts`, `doctor-schedule-delete-slot.spec.ts`, `doctor-schedule-block-period.spec.ts` |
| Favorites | `patient-favorites.spec.ts` |
| Live notifications | `notifications-realtime.spec.ts` |
| Patient / doctor dashboards | `patient-dashboard.spec.ts`, `doctor-dashboard.spec.ts` |
| Admin CRUD (doctors, specialties, neighborhoods) | `admin-doctor-crud.spec.ts`, `admin-reference-data.spec.ts` |
| Doctor account provisioning by an admin | `admin-doctor-link-account.spec.ts`, `admin-doctor-request-approve.spec.ts` |
| Authentication (signup, login, logout, session) | `auth-signup.spec.ts`, `auth-login.spec.ts`, `auth-doctor-login.spec.ts`, `auth-logout.spec.ts`, `auth-session-persistence.spec.ts` |
| Password reset | `auth-password-reset.spec.ts` |
| Language switching (Hebrew/English, RTL) | `locale-switching.spec.ts` |

## 2. Tests for invalid inputs

Every write endpoint has explicit negative-input coverage, not just happy-path assertions. Real examples from the suite:

- `"a startAt later than its endAt is rejected with the start-before-end message"` (`doctor-schedule-add-slot.spec.ts`)
- `"a start time in the past is rejected with 400 and the past-date message"` (`doctor-schedule-add-slot.spec.ts`)
- `"a blank fullName is rejected with 400 and no doctor row is created"` (`admin-doctor-crud.spec.ts`)
- `"submitting an empty full name shows the translated required-field error with no network request"` (`auth-signup.spec.ts`)
- `"a malformed JSON body returns 400 with the byte-identical generic error, not a 500"` (multiple specs — a non-JSON request body must never crash the route)
- `"Empty-field backstop: a missing endAt returns 400, not 500"` (`doctor-schedule-add-slot.spec.ts` / `doctor-schedule-block-period.spec.ts`)
- `"Guards and validation: anonymous, doctor, malformed id, missing/non-UUID newSlotId and non-JSON body each reject cleanly"` (`appointment-reschedule.spec.ts`)
- `"Guards: anonymous, malformed id, non-string reason, over-length reason and non-JSON body each reject cleanly"` (`appointment-cancel.spec.ts`)

## 3. Tests for core business processes

These go beyond a single endpoint and prove an entire multi-step flow end-to-end, including the guarantees that matter most to the product's core value:

- **Anti-double-booking under real concurrency**: `"APPT-02 concurrency: two concurrent bookings of the same slot resolve to exactly one 201 and one 409"` (`appointment-booking.spec.ts`) — fires simultaneous `Promise.all` requests, not sequential ones, to prove the guarantee holds under a genuine race, not just in the common case.
- **Slot overlap prevention**: `"5. no two slots for the same doctor overlap (D-01)"` and `"Concurrency, add-slot path: two identical concurrent POSTs resolve to exactly one 201 and one 409"` (`doctor-schedule-overlap.spec.ts`).
- **Reschedule doesn't leak the old slot**: `"D-09 rollback leaves the old slot held: rescheduling onto a slot a second patient just booked is rejected with no release"` (`appointment-reschedule.spec.ts`) — proves a failed reschedule attempt can't silently free up the patient's original booking.
- **The forgot-password flow end-to-end**: a real recovery link is followed, a new password is set, the old password is proven rejected and the new one proven to work (`auth-password-reset.spec.ts`).
- **Doctor request → admin approval → live account**: `admin-doctor-request-approve.spec.ts` drives the full path from a public submission to a usable doctor login.

## 4. Permission / authorization tests (multi-role)

Every route is tested from the perspective of every role that could plausibly reach it, not just the "correct" one:

- `route-protection-unauthenticated.spec.ts`, `route-protection-role-mismatch.spec.ts`, `admin-route-protection.spec.ts` — a persistent per-role browser context matrix (patient/doctor/admin/anonymous) driven against every protected page and API endpoint, confirming both the page-level redirect and the API-level 401/403.
- `"a doctor account cannot reach /patient, and is bounced back to /doctor"` — cross-role page access.
- `"Guard sweep: anonymous requests to all four route handlers return 401, and patient requests return 403"` (`doctor-schedule-block-period.spec.ts`) — every route handler checked against every wrong role in one pass.
- `"a patient session calling link-account receives 403 and creates no auth user"` (`admin-doctor-link-account.spec.ts`) — proves a forbidden request has **zero side effects**, not just a rejected status code.
- `"T-05-05 cross-doctor 404: a doctor cancelling another doctor's appointment gets the same 404 as a missing id"` — an IDOR (Insecure Direct Object Reference) probe: a foreign resource id must be indistinguishable from a nonexistent one.
- `doctor-schedule-visibility.spec.ts`, `search-view-visibility.spec.ts` — proves inactive/foreign doctors' data never leaks into a view it shouldn't.

## 5. Database-level tests

- `schema-connectivity.spec.ts` — the schema is reachable and shaped as expected.
- `profiles-rls-escalation.spec.ts` — `"a bare authenticated user cannot self-insert role='admin'"` and `"...cannot self-insert role='doctor'"` — directly attacks the RLS policy that would otherwise let a patient grant themselves elevated privileges; this test exists because a real vulnerability of exactly this shape was found and fixed during development (see `.planning/STATE.md`, quick task `260817-eqs`).
- `doctor-schedule-overlap.spec.ts` — exercises the Postgres `EXCLUDE USING gist` constraint directly, including partial-overlap shapes (`"Partial overlap shapes: every containment shape is rejected 409"`).
- `seed-availability.spec.ts` — validates the demo data seeding produces a consistent, queryable dataset.
- `appointment-booking.spec.ts` / `appointment-reschedule.spec.ts` concurrency cases (above) are, at their core, database-constraint tests — they prove the unique partial index and the atomic conditional `UPDATE` inside `book_appointment()` actually hold under load, not just that the application code looks correct.

## 6. Edge case tests

- `"a startAt at (or before) the current instant is rejected — the cutoff excludes now itself"` — boundary condition on "now", not just "clearly in the past".
- `"AVAIL-04 concurrency: two concurrent deletes of the same id resolve to exactly one success and one 404"` — a delete race, not just a delete.
- `"D-12 already cancelled: a second cancellation attempt is rejected with 409 and does not overwrite the stored reason"` — a double-cancel doesn't corrupt state.
- `"D-13 blank reason: cancelling with the textarea left empty stores a null reason, not an empty string"` — a subtle data-representation edge case (`null` vs. `""`).
- `"Empty state, both pages: a freshly created patient and a freshly linked doctor each see their own empty state"` (`patient-dashboard.spec.ts` / `doctor-dashboard.spec.ts`) — the zero-data UI state is explicitly tested, not just the populated one.
- `admin-pagination.spec.ts` — page boundaries (first/last page, page beyond the data, malformed page parameter).

## 7. Basic UI tests

- `button-native-semantics.spec.ts` — every interactive control exposes the correct accessible role (e.g. a link styled as a button must still announce as a link to assistive technology).
- `site-nav.spec.ts` — the role-aware navigation bar renders the correct link set per role, with no duplication.
- `visual-accent.spec.ts` / `visual-polish.spec.ts` — proves visual/design properties via **live computed styles read from the rendered page**, not by inspecting the CSS source — e.g. the brand accent color genuinely has non-zero chroma in both light and dark mode, and a card genuinely has a non-`none` `box-shadow`.
- `locale-switching.spec.ts` — includes RTL-specific geometry assertions (e.g. a popover must stay inside the viewport when mirrored to Hebrew, an icon must sit at the correct inline-edge in both directions) — a real layout regression test, not just a translated-string check.
- `root-route-router.spec.ts` — the `/` route correctly routes an anonymous visitor to `/login` and a signed-in user to their role's home page.

## What is deliberately *not* covered

- **Unit tests** — no Vitest/Jest, by design (see `docs/architecture-tech-choices.md` for the reasoning applied project-wide: standard, transferable tooling over framework-specific or granularity-for-its-own-sake choices). Business logic that matters most (booking atomicity, RLS) is tested at the integration/E2E level instead, which is judged a stronger guarantee for this product.
- **Load/performance testing** — out of scope; see `docs/architecture-scalability.md` for the honest list of what isn't yet measured under real load.
- **Cross-browser matrix** — the suite runs on Chromium only (`playwright.config.ts`); acceptable for an academic demo, not for a production release.
