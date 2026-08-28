# MedRDV — Medical Appointment Booking Platform (Israel)

A Doctolib-inspired web platform, adapted to the Israeli market, that lets a patient search for a private doctor by specialty, spoken language (Hebrew/English), neighborhood, and availability, then book an appointment directly online. V1 focuses on Tel-Aviv. Doctor profiles and their availability are clearly-identified demo data — no integration with real medical practices. This is a Full-Stack university final project (RUNI CS 2026, Internet Technologies).

**Core value**: a patient can find a doctor matching their criteria and book an available slot in a few clicks, with an absolute guarantee that two patients can never book the same slot.

Live app: _add the Vercel URL here once deployed_

## Tech stack

- **Framework**: Next.js (App Router) + TypeScript
- **Backend**: REST API Route Handlers (`app/api/**/route.ts`) — no Server Actions
- **Database / Auth / Realtime**: Supabase (Postgres, Row Level Security, Auth, Realtime)
- **Email**: Resend (SMTP provider plugged into Supabase Auth, for password-reset emails)
- **UI**: Tailwind CSS + shadcn/ui, custom lightweight i18n (React context + JSON dictionaries), full Hebrew/English RTL support
- **Testing**: Playwright (end-to-end only)
- **Deployment**: Vercel (app) + Supabase (database)

See `docs/` for a deep technical walkthrough (data flow, tech choices, database schema, scalability, security).

## Prerequisites

- Node.js 20+ (developed on Node 22)
- A Supabase project (free tier is enough) — either the project's own linked instance, or a new one you create yourself
- (Optional) [Supabase CLI](https://supabase.com/docs/guides/cli) if you want to apply migrations yourself rather than using an already-provisioned database

## 1. Clone and install

```bash
git clone https://github.com/NoamMellul/full_stack_final_project.git
cd full_stack_final_project
npm install
```

## 2. Configure environment variables

Copy the example file and fill in your own Supabase project's credentials:

```bash
cp .env.example .env.local
```

`.env.local` needs:

| Variable | Where to find it | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API | Public, safe to expose to the browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page | Public — RLS is the real authorization boundary, not this key |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page | **Secret** — server-only, bypasses Row Level Security. Never commit it, never expose it to the client |

`.env.local` is already listed in `.gitignore` and is never committed.

## 3. Set up the database

If you're using the project's already-provisioned Supabase instance, the schema is already applied — skip to step 4.

If you're starting from a fresh Supabase project, apply all migrations under `supabase/migrations/` (16 files, applied in filename order) via the Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

This creates all 11 application tables (`profiles`, `doctors`, `specialties`, `locations`, `languages`, `doctor_languages`, `availability_slots`, `appointments`, `favorites`, `notifications`, `doctor_requests`), their Row Level Security policies, and the booking business-logic functions (`book_appointment`, `reschedule_appointment`, `cancel_appointment`).

### Seed demo data (optional but recommended)

The app is much more meaningful to browse with demo data — 30 fictional Tel-Aviv doctors across every specialty and neighborhood, plus demo patients:

```bash
npm run seed
```

This script is **idempotent** (safe to re-run) and only ever inserts — it never truncates or deletes existing data.

### Password reset emails (optional)

To make the "forgot password" flow actually send emails in your own Supabase project, configure a custom SMTP provider under **Authentication → SMTP Settings** in the Supabase Dashboard (this project uses [Resend](https://resend.com)'s free tier). Without this, Supabase's default email sending is heavily rate-limited and not meant for anything beyond a quick manual test.

## 4. Run the app locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Anonymous visitors are redirected to `/login`.

- **Patients** can sign up themselves from `/signup`.
- **Doctors cannot self-register** (deliberate design decision — see `docs/architecture-security.md`) — a doctor account must be created by an admin (`/admin/doctors` → "Add doctor" → "Link account"), or a real-world doctor can submit a "request to join" from `/login`, which an admin then approves.
- **The first admin account** must be created manually: sign up as a patient, then in the Supabase Dashboard's Table Editor, change that row's `role` column (in `public.profiles`) from `patient` to `admin`.

## 5. Run the tests

```bash
npx playwright test
```

This automatically starts a local dev server (via `playwright.config.ts`'s `webServer` option) if one isn't already running, and needs the same 3 environment variables as the app itself (loaded from `.env.local`). The suite is Playwright-only, end-to-end, and covers every critical flow: booking, permissions per role, and double-booking prevention.

Run a single spec file:

```bash
npx playwright test tests/e2e/appointment-booking.spec.ts
```

## Other scripts

| Command | Purpose |
|---|---|
| `npm run build` | Production build |
| `npm run start` | Run the production build locally |
| `npm run lint` | ESLint |
| `npm run seed` | Idempotent demo-data seed (see above) |
| `npx tsx scripts/cleanup-test-residue.ts` | Dry-run report of orphaned test/demo rows in the database; add `--apply` to actually delete them |

## Project structure

```
app/                    Next.js App Router — pages + API route handlers
  api/                  REST API routes (auth, patient, doctor, admin, public)
  patient/ doctor/ admin/  Role-scoped pages
components/             Shared React components (shadcn/ui-based)
lib/
  supabase/             Supabase client factories (browser / server / admin)
  auth/                 Role guards (requireAdmin / requireDoctor / requirePatient)
  validation/            Manual TypeScript input validation (no schema library)
  i18n/                  Custom i18n system (dictionaries, translation helpers)
supabase/migrations/    All database schema changes, in chronological order
tests/e2e/              Playwright end-to-end test suite
scripts/                Seed + database cleanup utilities
docs/                   Architecture deep-dive documentation
.planning/              Project planning artifacts (GSD workflow — phases, decisions, state)
```

## Documentation

- [`docs/product-spec.md`](docs/product-spec.md) — problem, users, customer, business goals, main flows
- [`docs/architecture-data-flow.md`](docs/architecture-data-flow.md) — how data flows between Frontend, Backend, and Database
- [`docs/architecture-tech-choices.md`](docs/architecture-tech-choices.md) — why Tailwind/shadcn, why Postgres, why REST over Server Actions
- [`docs/architecture-database.md`](docs/architecture-database.md) — full schema, foreign keys, RLS policies
- [`docs/architecture-scalability.md`](docs/architecture-scalability.md) — indexes, pagination, known limitations
- [`docs/architecture-security.md`](docs/architecture-security.md) — authentication, authorization, input validation, known risks
- [`docs/test-plan.md`](docs/test-plan.md) — test strategy and coverage across the 382-test Playwright suite
