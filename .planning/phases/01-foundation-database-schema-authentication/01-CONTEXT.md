# Phase 1: Foundation — Database Schema & Authentication - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning

<domain>
## Phase Boundary

The complete data schema (all tables, constraints, indexes, and RLS policies for the entire application — not just what Phase 1 needs at runtime) is deployed on Supabase, and patients/doctors can sign up, log in, and log out, with role-based route protection. Schema-first: every later phase builds pure API/UI against an already-validated data model.

</domain>

<decisions>
## Implementation Decisions

### API architecture
- **D-01:** Classic REST API routes (Next.js Route Handlers, `app/api/.../route.ts`) — no Server Actions, for any business-logic endpoint built in this or later phases. — **Reversibility:** costly — switching later means rewriting every mutation endpoint and client call site.
- **D-02:** Manual TypeScript validation functions — no schema library (Zod explicitly rejected). — **Reversibility:** reversible — validation logic is localized per route.
- **D-03:** Supabase Auth is used via its own official client SDK (`@supabase/ssr`, `@supabase/supabase-js`) directly — D-01/D-02 apply to OUR business logic endpoints, not to Supabase Auth's own sign-up/sign-in/sign-out calls.

### Database schema
- **D-04:** `blocked_periods` is merged into `availability_slots` via a `status` column (`available` / `booked` / `blocked`) — one table, not two. — **Reversibility:** one-way — splitting back out later requires a data migration and touches every query that reads slot status.
- **D-05:** Anti-double-booking is guaranteed at the database level: a partial unique index on `appointments(slot_id)` for active (non-cancelled) statuses, plus a `book_appointment()` Postgres transactional function added in Phase 5. Phase 1 lays the index; the function comes later. — **Reversibility:** one-way — this constraint is the core value guarantee of the whole product; removing it reopens the double-booking bug class.
- **D-06:** `doctors.full_name` is stored on the `doctors` table itself (not only via `profiles`), because `doctors.profile_id` is nullable — the admin can create a doctor profile before a login account exists (Phase 2).
- **D-07:** No separate `patients` table — patients are just `profiles` rows with `role = 'patient'`.
- **D-08:** Overlap prevention on `availability_slots` uses a Postgres exclusion constraint (`EXCLUDE USING gist`, `btree_gist` extension) — DB-enforced, not just application-checked.
- **D-09:** RLS policies use two `security definer` helper functions, `is_admin()` and `is_doctor_owner(doctor_id)`, to avoid RLS self-recursion — see canonical ref below.

### Testing & tooling
- **D-10:** Playwright only for automated tests (end-to-end) — no Vitest, no React Testing Library.
- **D-11:** UI: Tailwind CSS v4 + shadcn/ui, initialized with native RTL support (`components.json` has `"rtl": true`) for the Hebrew/English requirement landing in Phase 6 — no separate i18n library (next-intl rejected).
- **D-12:** Project language: all code, comments, commit messages, and docs are in English (the user chats in French but wants artifacts in English).

### Claude's Discretion
- Exact naming/shape of `lib/supabase/*.ts` client wrapper files — no prior constraint given beyond "server client, browser client, admin/service-role client, all separate."
- Exact copy/wording of auth error messages.
- Whether `/signup` and `/login` share a layout or are fully separate routes.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level context
- `.planning/PROJECT.md` — full product context, all Key Decisions, Constraints (REST/no-Zod/Playwright-only/i18n/UI/timezone), Business Context
- `.planning/REQUIREMENTS.md` — AUTH-01 through AUTH-07 requirement text
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, dependency chain
- `.planning/phases/01-foundation-database-schema-authentication/TASKS.md` — the user's own hand-written task/subtask breakdown for this phase (DB columns, RLS policy list, route list, page list, Playwright test list) — written before this CONTEXT.md, treat as a detailed reference outline, not a substitute for planning

### Database (ALREADY APPLIED — see code_context below)
- `supabase/migrations/20260803230000_initial_schema.sql` — the actual, already-deployed schema for ALL 10 tables (not just Phase 1's), all constraints, all indexes, all RLS policies, the two `security definer` helper functions, and the `appointments.updated_at` trigger. This is the source of truth for table/column names going forward — do not re-derive schema from TASKS.md's prose description, read this file.

[No other external specs — requirements fully captured in decisions above and PROJECT.md]

</canonical_refs>

<code_context>
## Existing Code Insights

### Already done (do NOT redo, build on top of it)
- **Database**: `supabase/migrations/20260803230000_initial_schema.sql` was already written and applied to the real remote Supabase project via `supabase db push` — confirmed applied (`supabase migration list` shows local/remote timestamps matching). All 10 tables, RLS, indexes, exclusion constraint, and helper functions already exist on the live database. Planning/execution for this phase should treat schema creation as DONE and focus on: Supabase client setup, middleware, and the signup/login/logout UI + routes.
- **Next.js app**: scaffolded at repo root via `create-next-app` — Next.js 16.2.12, React 19.2.4, TypeScript, App Router, Tailwind v4, ESLint 9. `package.json` name is `medrdv`. Build verified working (`npm run build` succeeds).
- **shadcn/ui**: initialized (`npx shadcn init -d --rtl`) — `components.json` present with `"rtl": true`, `lib/utils.ts` and `components/ui/button.tsx` already generated.
- **Supabase client libraries**: `@supabase/supabase-js` and `@supabase/ssr` already installed in `package.json` dependencies.
- **Env vars**: `.env.local` (gitignored, filled with real values) and `.env.example` (committable, placeholder-only) both exist with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Supabase CLI project structure**: `supabase/config.toml` exists (`supabase init` was run); migrations live in `supabase/migrations/`.

### Reusable Assets
- `components/ui/button.tsx`, `lib/utils.ts` (shadcn) — use as the pattern for any further shadcn component additions (`npx shadcn add <component>`).

### Established Patterns
- Tailwind v4 config lives in `app/globals.css` (no separate `tailwind.config.ts` — v4 convention).
- Import alias `@/*` maps to repo root (see `tsconfig.json`).

### Integration Points
- New `lib/supabase/server.ts` / `client.ts` / `admin.ts` files should sit alongside the existing `lib/utils.ts`.
- `middleware.ts` at repo root (does not exist yet) is the integration point for route protection, reading the Supabase session cookie.

</code_context>

<specifics>
## Specific Ideas

No additional specifics beyond the decisions above — the user's own TASKS.md (referenced in canonical_refs) already lays out the intended `/signup`, `/login`, layout structure, and Playwright test list in detail. Follow it as a strong reference, but the planner is free to adjust file-level structure as needed.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Phases 2-6 already exist as separate ROADMAP.md phases with their own hand-written TASKS.md files in `.planning/phases/`.)

</deferred>

---

*Phase: 1-foundation-database-schema-authentication*
*Context gathered: 2026-08-03*
