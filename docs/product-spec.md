# MedRDV — Product Specification

> Covers the assignment brief's "Product Specification Document" requirement (מסמך אפיון מוצר): the problem, the users, the customer, the business goals, the required software capabilities, and the main user flows.

## What problem does the product solve

In Israel, finding and booking an appointment with a private doctor is still largely manual — phone calls during office hours, no visibility into real availability, no way to compare doctors by criteria that actually matter to a patient (spoken language, neighborhood, specialty). MedRDV solves this by letting a patient search, compare, and book a real appointment slot online, in a few clicks, with an absolute technical guarantee that no two patients can ever be double-booked into the same slot.

## Who are the users

Three distinct roles, each with a different relationship to the product:

- **Patients** — search for a doctor, view public profiles, book/cancel/reschedule appointments, save favorite doctors, receive notifications about their bookings, use the app in Hebrew or English.
- **Doctors** — manage their own availability calendar (open slots, block time off), view and manage their upcoming appointments, cannot self-register (see below).
- **Admins** — the platform operator's staff: onboard doctors, curate the reference data (specialties, neighborhoods), oversee all appointments and users, triage doctor "request to join" submissions.

## Who is the customer

Two distinct customer segments, matching a realistic two-sided marketplace model:

- **Patients** — free to use, no payment required in v1.
- **Private doctors and clinics** — the intended future paying customer (subscription model), not implemented in v1. The data model is deliberately built so a subscription/billing layer could be added later without a schema rework, but no payment integration exists today.

## Business goals

- Reduce the time and friction of booking a private doctor appointment in Tel-Aviv, for both patients and doctors.
- Give patients enough information (specialty, language, neighborhood, real-time availability) to make a confident booking decision without a phone call.
- Let a doctor's practice run more efficiently: no back-and-forth phone scheduling, self-serve calendar management, in-app notifications instead of missed calls.
- Demonstrate, as this is an academic capstone, mastery of a real production-shaped stack: authentication, role-based authorization, a strongly-constrained relational schema, automated end-to-end testing, basic scalability and security practices, and a deployed public product — not just a local prototype.

## Software capabilities required to enable these business goals

- **Authentication & account provisioning** — patient self-signup; doctor accounts are admin-provisioned only (a deliberate trust-model decision, not an oversight — see `docs/architecture-security.md`), with a lightweight public "request to join" form as the on-ramp for real-world doctors.
- **Search & discovery** — multi-criteria doctor search (specialty, spoken language, neighborhood, name, availability window), sorted by soonest available slot, paginated.
- **Public doctor profiles** — specialty, bio, photo, neighborhood, spoken languages, phone, upcoming available slots — browsable with no login required.
- **Availability management** — a doctor can open slots and block time off; the system guarantees, at the database level, that no two time ranges for the same doctor ever overlap.
- **Booking lifecycle** — book, cancel (by either the patient or the doctor), and reschedule an appointment, with a hard guarantee (enforced in Postgres, not just in the UI) that two patients can never claim the same slot, even under simultaneous concurrent requests.
- **Favorites** — a patient can save/remove doctors to a personal shortlist.
- **In-app notifications** — real-time (websocket-delivered) notifications on booking confirmation, cancellation, and reschedule, for both the patient and the doctor side of the event.
- **Dashboards** — a patient home screen summarizing upcoming appointments; a doctor home screen summarizing upcoming appointments and remaining open slots; an admin overview of platform activity.
- **Admin back office** — full CRUD on doctors, specialties, and neighborhoods; oversight views over all appointments and users; doctor-request triage with a one-click path into account provisioning.
- **Bilingual interface** — the entire interface switches between Hebrew and English, including correct RTL mirroring of the layout, not just translated strings.

## Main processes users can perform

| Process | Who |
|---|---|
| Sign up / log in / log out | Patient |
| Search for a doctor by specialty, language, neighborhood, name, availability | Anyone (no login required) |
| View a doctor's public profile and upcoming slots | Anyone |
| Book an available slot | Patient |
| Cancel an appointment | Patient or the doctor involved |
| Reschedule an appointment to a different slot | Patient |
| View appointment history (upcoming / past) | Patient or doctor |
| Add / remove a doctor from favorites | Patient |
| Receive a live in-app notification on booking/cancel/reschedule | Patient and doctor |
| Open availability slots / block time off | Doctor |
| View and manage own upcoming appointments | Doctor |
| Submit a "request to join" as a doctor | Any visitor (no account) |
| Approve a doctor request and provision the account | Admin |
| Create / edit / activate / deactivate a doctor | Admin |
| Manage the specialty and neighborhood catalogs | Admin |
| Oversee all appointments and users platform-wide | Admin |
| Switch the interface language (Hebrew ↔ English) | Anyone |
| Reset a forgotten password | Any account holder |

## Explicitly out of scope

To keep the project's ethical and regulatory footprint appropriate for an academic demo:

- Medical records, diagnoses, prescriptions, lab results — sensitive regulated health data.
- Video/teleconsultation.
- Payment processing, insurance, reimbursement.
- Real integration with actual doctors or the Israeli healthcare system — every doctor profile in the seeded dataset is clearly fictional demo data.
- Medical AI or diagnostic recommendations.
- In-depth patient-doctor medical messaging beyond appointment logistics.
