# Phase 1: Foundation — Database Schema & Authentication - Research

**Researched:** 2026-08-03
**Domain:** Supabase Auth (`@supabase/ssr` + `@supabase/supabase-js`) wired into Next.js 16 App Router, REST Route Handlers, and role-based route protection
**Confidence:** MEDIUM — core APIs verified against official Next.js/Supabase documentation and the actual installed package versions; some Supabase-hosted-project-specific behavior (remote Auth dashboard settings) could not be verified from this session and is flagged as an assumption requiring a manual check.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Classic REST API routes (Next.js Route Handlers, `app/api/.../route.ts`) — no Server Actions, for any business-logic endpoint built in this or later phases. Reversibility: costly.
- **D-02:** Manual TypeScript validation functions — no schema library (Zod explicitly rejected). Reversibility: reversible.
- **D-03:** Supabase Auth is used via its own official client SDK (`@supabase/ssr`, `@supabase/supabase-js`) directly — D-01/D-02 apply to OUR business logic endpoints, not to Supabase Auth's own sign-up/sign-in/sign-out calls.
- **D-04:** `blocked_periods` is merged into `availability_slots` via a `status` column (`available` / `booked` / `blocked`) — one table, not two. (Already applied — informational for Phase 1.)
- **D-05:** Anti-double-booking guaranteed at DB level via partial unique index on `appointments(slot_id)` + `book_appointment()` function (Phase 5). Phase 1 only needs the index (already applied).
- **D-06:** `doctors.full_name` stored on the `doctors` table itself, because `doctors.profile_id` is nullable.
- **D-07:** No separate `patients` table — patients are `profiles` rows with `role = 'patient'`.
- **D-08:** Overlap prevention on `availability_slots` uses a Postgres exclusion constraint (already applied).
- **D-09:** RLS policies use two `security definer` helper functions, `is_admin()` and `is_doctor_owner(doctor_id)`, to avoid RLS self-recursion (already applied).
- **D-10:** Playwright only for automated tests (end-to-end) — no Vitest, no React Testing Library.
- **D-11:** UI: Tailwind CSS v4 + shadcn/ui, initialized with native RTL support (`"rtl": true` in `components.json`) — no separate i18n library.
- **D-12:** Project language: all code, comments, commit messages, and docs are in English.

### Claude's Discretion
- Exact naming/shape of `lib/supabase/*.ts` client wrapper files — no prior constraint given beyond "server client, browser client, admin/service-role client, all separate."
- Exact copy/wording of auth error messages.
- Whether `/signup` and `/login` share a layout or are fully separate routes.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. Phases 2–6 already exist as separate ROADMAP.md phases with their own hand-written TASKS.md files.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Patient can sign up with email and password | `signUp()` pattern + manual validation + hardcoded server-side `role='patient'` insert (see Common Pitfalls #2, Code Examples) |
| AUTH-02 | Patient can log in with email and password | `signInWithPassword()` pattern (see Code Examples) |
| AUTH-03 | Patient can log out | `signOut()` pattern (see Code Examples) |
| AUTH-04 | Patient session persists across browser refresh | `@supabase/ssr` cookie-based SSR client + `proxy.ts` session refresh (see Architecture Patterns) |
| AUTH-05 | Doctor can log in with credentials created by the admin | Same `signInWithPassword()` path; doctor accounts have no self-signup route (see Architectural Responsibility Map) |
| AUTH-06 | Unauthenticated user is redirected away from protected patient/doctor/admin pages | `proxy.ts` route matcher + redirect-to-`/login` pattern (see Architecture Patterns, Pitfall #1) |
| AUTH-07 | User attempting to access a page for a role they don't have is denied access | `profiles.role` check in `proxy.ts` and/or role-scoped layouts (see Architecture Patterns, Pitfall #3) |
</phase_requirements>

## Summary

The database schema for the entire application is already deployed (`supabase/migrations/20260803230000_initial_schema.sql`, confirmed applied to the remote project). Phase 1's real work is wiring Supabase Auth into a **Next.js 16.2.12** App Router app using **`@supabase/ssr` 0.12.4** and **`@supabase/supabase-js` 2.112.0** (both already installed at these exact versions — confirmed via `npm view` matching `package.json`).

The single most important finding of this research: **`middleware.ts` does not exist as a working convention in Next.js 16.** Next.js 16.0.0 renamed the file/export from `middleware.ts`/`middleware()` to **`proxy.ts`/`proxy()`**, and this is not a soft deprecation — a leftover `middleware.ts` file is silently ignored (no build error, no warning at runtime; its `config.matcher` and auth logic simply never execute). The project's own `01-CONTEXT.md` (written before this research) still says "`middleware.ts` at repo root... is the integration point" — that line is now stale relative to the installed Next.js version and must not be followed literally. The planner must specify `proxy.ts`, not `middleware.ts`.

The second most important finding is a genuine security gap in the already-deployed RLS: the `profiles` table's `INSERT` and `UPDATE` policies only check `id = auth.uid()` — they do **not** constrain the `role` column. A client that calls `signUp()` and then inserts (or later updates) its own `profiles` row directly through the browser/anon client could set `role: 'admin'` or `role: 'doctor'` itself. Because the schema is treated as already-applied and out of scope for this phase, the mitigation must happen at the application layer: the signup Route Handler must write the `profiles` row using the **service-role (admin) client**, with `role` hardcoded to `'patient'` server-side, never taken from client input. This must be an explicit task in the plan, not an incidental detail.

Third, `signUp()` only returns an active `session` (not just a `user`) if the Supabase project's Auth email-confirmation setting is disabled — otherwise the freshly created user has no session and the RLS-gated `profiles` insert (`with check (id = auth.uid())`) cannot run client-side at all. The local `supabase/config.toml` already has `enable_confirmations = false`, but this setting is local-CLI-only and does not automatically propagate to the already-provisioned remote/hosted Supabase project. The planner must add a task to verify (Dashboard → Authentication → Providers → Email → "Confirm email") that the remote project matches, and if the signup route uses the service-role client to write `profiles` and confirm the user, that dependency on email-confirmation state can be sidestepped entirely (recommended — see Code Examples).

**Primary recommendation:** Use `proxy.ts` (not `middleware.ts`) with a `lib/supabase/proxy.ts` `updateSession()` helper for session refresh and coarse route protection by path prefix; enforce fine-grained role checks a second time inside each role-scoped layout (`app/patient/layout.tsx`, `app/doctor/layout.tsx`, `app/admin/layout.tsx` — see Pitfall #3 for why these must be plain folders, not Next.js route groups); have the signup Route Handler use the service-role admin client to insert the `profiles` row with a hardcoded `role: 'patient'`, closing the RLS gap.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Signup / login / logout form submission | Browser / Client | API / Backend | Client renders form and calls our own REST route (D-01); Supabase Auth call happens server-side inside the Route Handler using the SSR server client so cookies can be set on the response |
| Password/session issuance | External (Supabase Auth / GoTrue) | — | Never hand-roll password hashing or token issuance; fully delegated to Supabase Auth |
| Session persistence across refresh | Frontend Server (SSR) | Browser / Client | `@supabase/ssr` reads/writes httpOnly cookies via `next/headers` `cookies()`; browser only holds opaque cookies, never parses the JWT |
| Session refresh (silent) | Frontend Server (SSR) — `proxy.ts` | — | Only `proxy.ts` runs on every request before rendering and can rewrite the `Set-Cookie` header before Server Components read it |
| Coarse route protection (`/patient/*`, `/doctor/*`, `/admin/*`, unauthenticated → `/login`) | Frontend Server (SSR) — `proxy.ts` | API / Backend (route handlers) | `proxy.ts` is the single choke point for every request; Route Handlers under `app/api/**` must not assume `proxy.ts` ran, because a matcher misconfiguration or a future refactor can silently exclude a path (see Next.js 16 docs warning quoted in Pitfall #1) |
| Fine-grained role enforcement (`AUTH-07`) | API / Backend + Frontend Server (SSR) | Database / Storage (RLS) | Role check should happen in the role-scoped layout server component (redundant with `proxy.ts`, defense in depth) AND is backstopped by RLS `is_admin()`/`is_doctor_owner()` at the DB tier — RLS is the last line of defense, not the primary UX gate |
| Row-level data isolation (who can see which `profiles`/`doctors`/`appointments` rows) | Database / Storage | — | Already enforced via RLS policies in the deployed migration; this phase must not weaken it, and must compensate for the `profiles.role` gap (see Summary) at the API tier |
| Manual input validation (email format, password length, required fields) | API / Backend | Browser / Client (basic HTML5 attributes only, not trusted) | D-02: validation functions live server-side in the Route Handler; client-side HTML5 `required`/`type=email` is UX only, never the security boundary |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/ssr` | 0.12.4 (installed, matches latest on npm registry) | Cookie-aware Supabase client for SSR frameworks — `createBrowserClient` / `createServerClient` | Official Supabase package purpose-built to replace the deprecated `auth-helpers` packages for exactly this cookie-sync problem |
| `@supabase/supabase-js` | 2.112.0 (installed, matches latest on npm registry) | Core JS client — used directly for the service-role/admin client (no cookie handling needed there) | Official SDK; underlies `@supabase/ssr` |
| `next` | 16.2.12 (installed) | App Router, Route Handlers, `proxy.ts` | Project-mandated (CLAUDE.md) |
| `react` / `react-dom` | 19.2.4 (installed) | UI runtime | Bundled requirement of Next.js 16 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@playwright/test` | 1.62.1 (latest on npm registry — **not yet installed**, must be added this phase) | End-to-end tests (D-10) | Every Playwright test listed in TASKS.md (signup, login, logout, session persistence, unauthenticated redirect, role-mismatch denial) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual TS validation (D-02) | Zod | Rejected by user decision — Zod adds a dependency and a schema-definition layer the user judged unnecessary for this project's scope; manual functions are more explicit for an academic defense |
| Route Handlers (D-01) | Server Actions | Rejected by user decision — REST routes are more standard/universally understood and easier to defend in an academic setting |
| `@supabase/ssr` cookie session | NextAuth.js / Auth.js with a Supabase adapter | Not considered — D-03 locks in Supabase Auth's own SDK directly; adding a second auth abstraction layer would contradict "simple, standard, defendable" project bias |
| `getUser()` for every server-side identity check | `getClaims()` (newer, JWT-local verification) | `getClaims()` avoids a network round-trip per request when the project uses Supabase's newer asymmetric JWT signing keys, but adds an extra concept to explain in a defense; `getClaims()` transparently falls back to `getUser()` for symmetric/legacy JWTs or during key rotation, so it is safe to adopt, but `getUser()` alone is simpler to reason about for a first Auth implementation — see Open Questions |

**Installation:**
```bash
npm install -D @playwright/test
npx playwright install --with-deps chromium
```

**Version verification:** `@supabase/ssr`, `@supabase/supabase-js`, and `next` were checked with `npm view <pkg> version` against the installed `package.json` and `npm list` output — all three match exactly (0.12.4, 2.112.0, 16.2.12 respectively) `[VERIFIED: npm registry]`. `@playwright/test` was checked the same way (`npm view @playwright/test version` → `1.62.1`) `[VERIFIED: npm registry]`, but is a new install for this phase — see Package Legitimacy Audit.

## Package Legitimacy Audit

| Package | Registry | Age (publish date of current version) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@supabase/ssr` | npm | 2026-07-28 (recent patch/minor) | 6.35M/wk | github.com/supabase/ssr | SUS (`too-new`) | Approved — already installed, official Supabase org repo, extremely high download count; "too-new" signal is a false positive from a recent point release, not a young/unknown package |
| `@supabase/supabase-js` | npm | 2026-08-03 (recent patch/minor) | 25.1M/wk | github.com/supabase/supabase-js | SUS (`too-new`) | Approved — already installed, official Supabase org repo, same false-positive pattern |
| `@playwright/test` | npm | 2026-07-30 (recent patch/minor) | 51.7M/wk | github.com/microsoft/playwright | SUS (`too-new`) | Flagged — **new install this phase**; planner must add a `checkpoint:human-verify` task before `npm install -D @playwright/test`, even though the signals (Microsoft org repo, 51.7M weekly downloads) strongly indicate this is legitimate and the SUS verdict is solely the `too-new` heuristic reacting to a recent point release |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `@playwright/test` — planner must insert `checkpoint:human-verify` before the install task. `@supabase/ssr` and `@supabase/supabase-js` are also technically `SUS` per the raw seam output but are pre-existing installs already vetted by the user (build verified working per `01-CONTEXT.md`), so no new checkpoint is required for them — only re-verify if the plan bumps their versions.

## Architecture Patterns

### System Architecture Diagram

```
Browser (React Client Components)
   │  fetch('/api/auth/signup' | '/api/auth/login' | '/api/auth/logout')
   ▼
proxy.ts  (Next.js 16 request interception, runs before ANY route)
   │  1. createServerClient(cookies from request)
   │  2. supabase.auth.getUser()  ── refreshes/validates session, rewrites Set-Cookie
   │  3. if path matches /patient|/doctor|/admin AND unauthenticated → redirect /login
   │  4. if path matches /patient|/doctor|/admin AND role mismatch  → redirect /  (403-ish)
   ▼
┌─────────────────────────────┬───────────────────────────────────────────┐
│ app/api/auth/*/route.ts     │ app/{patient,doctor,admin}/layout.tsx      │
│ (Route Handlers, D-01)      │ (role-scoped layout, 2nd role check)       │
│  - manual validation (D-02) │  - reads profiles.role via server client   │
│  - createClient() server SSR│  - redundant guard vs proxy.ts             │
│  - signUp/signInWithPassword│                                             │
│    /signOut                 │                                             │
│  - admin client inserts     │                                             │
│    profiles row for signup  │                                             │
│    (role hardcoded server-  │                                             │
│    side, closes RLS gap)    │                                             │
└──────────────┬───────────────────────────────┬────────────────────────────┘
               ▼                               ▼
     Supabase Auth (GoTrue)          Postgres `public.profiles` / `doctors` / …
     issues JWT + refresh token       RLS: is_admin() / is_doctor_owner() /
     (external, do not hand-roll)     id = auth.uid()  (last line of defense)
```

### Recommended Project Structure
```
lib/
├── supabase/
│   ├── client.ts       # createBrowserClient — used in Client Components
│   ├── server.ts       # createServerClient — used in Route Handlers / Server Components
│   ├── admin.ts         # createClient with service_role key — server-only, bypasses RLS
│   └── proxy.ts         # updateSession(request) helper, imported by root proxy.ts
├── validation/
│   └── auth.ts          # manual validation functions (D-02): validateEmail, validatePassword, ...
proxy.ts                  # root file — NOT middleware.ts (see Pitfall #1)
app/
├── api/
│   └── auth/
│       ├── signup/route.ts
│       ├── login/route.ts
│       └── logout/route.ts
├── (auth)/               # optional shared layout for signup/login forms — Claude's discretion
│   ├── login/page.tsx
│   └── signup/page.tsx
├── patient/              # plain folder, NOT (patient) route group — see Pitfall #3
│   └── layout.tsx
├── doctor/                # plain folder, NOT (doctor) route group
│   └── layout.tsx
└── admin/                 # plain folder, NOT (admin) route group
    └── layout.tsx
```

### Pattern 1: Browser client
**What:** A Supabase client for Client Components that talks to Supabase directly from the browser using the publishable/anon key.
**When to use:** Any `'use client'` component that needs to call Supabase directly (rare in this project since D-01 routes business logic through our own REST endpoints — this is mainly for `onAuthStateChange` listeners or direct calls to `supabase.auth.signOut()` from a client button).
**Example:**
```typescript
// Source: official Vercel/Next.js "with-supabase" example (lib/supabase/client.ts)
// https://github.com/vercel/next.js/tree/canary/examples/with-supabase [CITED: github.com/vercel/next.js]
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // env var name per 01-CONTEXT.md, already provisioned
  );
}
```

### Pattern 2: Server client (Route Handlers / Server Components)
**What:** A Supabase client that reads/writes the session via Next.js's `cookies()`.
**When to use:** Inside `app/api/.../route.ts` Route Handlers (this project's chosen pattern, D-01) and Server Components that read the current user.
**Example:**
```typescript
// Source: official Vercel/Next.js "with-supabase" example (lib/supabase/server.ts),
// corrected import path — verified against https://nextjs.org/docs/app/api-reference/functions/cookies
// (version 16.2.12): the cookies() function is imported from 'next/headers', NOT 'next/handlers'.
// [CITED: nextjs.org/docs/app/api-reference/functions/cookies]
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll can throw if called from a Server Component render path;
            // safe to ignore because proxy.ts refreshes the session on every request.
          }
        },
      },
    },
  );
}
```

### Pattern 3: Admin (service-role) client
**What:** A plain `supabase-js` client authenticated with the `service_role` key — bypasses RLS entirely.
**When to use:** Server-only code that must write rows RLS would otherwise block — e.g. the signup Route Handler inserting `profiles` with a server-controlled `role`, and (Phase 2) admin doctor-account creation.
**Example:**
```typescript
// Composed for this project from @supabase/supabase-js's standard createClient signature
// (no cookie handling needed — service-role client is never tied to a user session).
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // server-only env var, never NEXT_PUBLIC_*
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
```
**Warning:** Never import this file from any Client Component or any module that could end up in the browser bundle. `SUPABASE_SERVICE_ROLE_KEY` is not prefixed `NEXT_PUBLIC_` precisely so Next.js excludes it from the client bundle — do not rename it.

### Pattern 4: `proxy.ts` session refresh + route protection
**What:** The Next.js 16 request-interception file (replaces `middleware.ts`).
**When to use:** Exactly one file, at the project root.
**Example:**
```typescript
// Source: official Vercel/Next.js "with-supabase" example — file is proxy.ts at repo root,
// delegating to lib/supabase/proxy.ts's updateSession(). [CITED: github.com/vercel/next.js]
// Matcher syntax verified against https://nextjs.org/docs/app/api-reference/file-conventions/proxy
// (version 16.2.12). [CITED: nextjs.org/docs/app/api-reference/file-conventions/proxy]
import { updateSession } from "@/lib/supabase/proxy";
import { type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

```typescript
// lib/supabase/proxy.ts — updateSession() helper.
// Structure per official example; role-gate logic for AUTH-06/AUTH-07 composed for this
// project's role values ('patient' | 'doctor' | 'admin'), verified against
// supabase/migrations/20260803230000_initial_schema.sql:18
// (`role text not null check (role in ('patient', 'doctor', 'admin'))`).
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ROLE_PREFIXES: Record<string, "patient" | "doctor" | "admin"> = {
  "/patient": "patient",
  "/doctor": "doctor",
  "/admin": "admin",
};

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run other code between createServerClient and getUser() —
  // both official examples warn this can cause users to be randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const matchedPrefix = Object.keys(ROLE_PREFIXES).find((p) =>
    pathname.startsWith(p),
  );

  if (matchedPrefix) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname); // relative path only — see Security Domain
      return NextResponse.redirect(loginUrl);
    }
    // Role check requires a profiles lookup; see role-scoped layout for the
    // authoritative check (Pattern 5) — proxy.ts can only cheaply check user
    // metadata here if it is mirrored into app_metadata, which this project
    // does not do. Recommendation: do the role redirect in the layout, keep
    // proxy.ts to auth-presence only, to avoid a DB round trip on every request.
  }

  return response;
}
```

### Pattern 5: Role-scoped layout (defense in depth for AUTH-07)
**What:** A server-component layout that re-checks the user's `profiles.role` and redirects/denies if it doesn't match the route group.
**When to use:** One per role folder (`app/patient/layout.tsx`, `app/doctor/layout.tsx`, `app/admin/layout.tsx`).
**Example (composed for this project, not from an external source):**
```typescript
// app/patient/layout.tsx (identical pattern for doctor/admin, swap the literal role string)
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "patient") redirect("/"); // AUTH-07: role mismatch → denied

  return <>{children}</>;
}
```

### Anti-Patterns to Avoid
- **Trusting `getSession()` for authorization:** `getSession()` reads the JWT from cookie storage without revalidating it against the Auth server — it can return a stale/invalid session. Use `getUser()` (or `getClaims()`) wherever an authorization decision is made.
- **Naming the file `middleware.ts` in this Next.js version:** it will not run; see Pitfall #1.
- **Letting the client dictate `profiles.role` on signup or update:** see Pitfall #2 and Security Domain.
- **Putting the service-role client in a file importable from Client Components:** leaks `SUPABASE_SERVICE_ROLE_KEY` semantics into the bundle graph even if the key itself doesn't leak; keep `lib/supabase/admin.ts` strictly server-only and never `'use client'`-adjacent.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Password hashing / storage | Custom bcrypt/argon2 wrapper | Supabase Auth (GoTrue) — `signUp`/`signInWithPassword` | Supabase Auth already hashes and stores passwords server-side; the app never sees or stores a raw or hashed password |
| Session token issuance / refresh | Custom JWT signing + refresh-token rotation | `@supabase/ssr` + `proxy.ts` `updateSession()` | Token rotation, expiry, and refresh-token reuse windows are already configured (`supabase/config.toml` `[auth]` block, `enable_refresh_token_rotation = true`) and implemented by Supabase Auth |
| Role-based access data isolation | Manual `WHERE user_id = ?` filters sprinkled through every query | Postgres RLS (already deployed) | RLS is enforced even if an application-layer filter is forgotten in a future route; app-layer checks are defense in depth, not the primary boundary |
| Email format / password length validation | Ad-hoc `.includes('@')` checks | Small, explicit manual validation functions (D-02) that mirror the DB-enforced minimum (`minimum_password_length = 6`, `supabase/config.toml:182`) | Explicitly the project's own chosen pattern — "don't hand-roll" here instead means "don't skip validating server-side just because Supabase Auth also validates," since Supabase's own password-length error message is not guaranteed to match the DB config projected to the remote hosted project |

**Key insight:** In this domain the temptation to hand-roll is almost entirely on the authorization side (role checks, redirects), not the cryptography side — Supabase Auth removes the cryptography temptation entirely. The remaining risk is trusting client-supplied data (like `role`) instead of deriving it server-side.

## Common Pitfalls

### Pitfall 1: `middleware.ts` silently does nothing in Next.js 16
**What goes wrong:** A developer (or the phase's own `01-CONTEXT.md`, written before this research) creates `middleware.ts` expecting it to intercept requests. Next.js 16 looks for `proxy.ts` instead. `middleware.ts` is not picked up, produces no build error, and no warning at runtime — routes that were supposed to be protected are simply never checked.
**Why it happens:** Next.js 16.0.0 renamed the file convention and the exported function from `middleware`/`middleware()` to `proxy`/`proxy()`. This is documented as a breaking change but is easy to miss coming from any Next.js ≤15 tutorial or training data. `[CITED: nextjs.org/docs/app/api-reference/file-conventions/proxy — Version history table, "v16.0.0: Middleware is deprecated and renamed to Proxy"]`
**How to avoid:** Name the file `proxy.ts` at the project root, export a function named `proxy` (or default export), and verify with a manual smoke test (visit a protected route unauthenticated, confirm redirect) rather than trusting the build to catch a missing file.
**Warning signs:** Protected routes render for an unauthenticated user with zero console errors; `npm run build` succeeds with no mention of `proxy.ts` or `middleware.ts`.

### Pitfall 2: `profiles` RLS does not restrict the `role` column — client-controlled privilege escalation
**What goes wrong:** The deployed RLS policies are:
```sql
-- supabase/migrations/20260803230000_initial_schema.sql:200-201
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());
-- supabase/migrations/20260803230000_initial_schema.sql:203-204
create policy "profiles_update_own_or_admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin());
```
Neither policy constrains `role`. If the browser/anon Supabase client is ever used to insert or update a user's own `profiles` row with a client-supplied `role` value, that value can be `'admin'` or `'doctor'` and RLS will allow it (`id = auth.uid()` is satisfied) — because Postgres RLS uses the `USING` expression as the implicit `WITH CHECK` when no explicit `WITH CHECK` is given for `UPDATE`, the same gap applies to updates, not just inserts.
**Why it happens:** The RLS design (correctly) delegates "is this the user's own row" to `auth.uid()`, but leaves column-level constraints to the application layer — which is a valid pattern, but only if the application layer actually enforces it.
**How to avoid:** The signup Route Handler must never forward a client-supplied `role` field into the `profiles` insert. Use the service-role admin client (Pattern 3) and hardcode `role: 'patient'` in the insert statement. Do not build a generic "update my profile" endpoint that accepts an arbitrary JSON body against the `profiles` table without an explicit allow-list of updatable columns (name/email only, never `role`).
**Warning signs:** A `PATCH`/`PUT` handler that does `supabase.from('profiles').update(await req.json())` — any endpoint that spreads the raw request body into a Supabase mutation against a table with a `role` or similar privilege column.

### Pitfall 3: Next.js route groups `(patient)` vs. plain folders `patient` — URL mismatch with `proxy.ts` matcher
**What goes wrong:** `01-CONTEXT.md`'s own code-context notes list `(patient)/layout.tsx`, `(doctor)/layout.tsx`, `(admin)/layout.tsx` — Next.js route-group syntax (parentheses). Route groups do **not** appear in the URL: `app/(patient)/dashboard/page.tsx` serves `/dashboard`, not `/patient/dashboard`. But the project's own TASKS.md item 5 describes `proxy.ts` matching path prefixes `/patient/*`, `/doctor/*`, `/admin/*`, and item 7 specifies post-login redirect targets `/patient/dashboard`, `/doctor/dashboard`, `/admin`. Using route groups would break both the matcher and the redirect targets.
**Why it happens:** Route groups and role-prefixed URL segments look superficially similar in a file tree and are easy to conflate; `(name)` is a very common pattern for "just group these layouts" without considering it also hides the segment from the URL.
**How to avoid:** Use plain folders — `app/patient/`, `app/doctor/`, `app/admin/` — so the URL segment is real and matches both the `proxy.ts` matcher and the redirect targets already specified in TASKS.md.
**Warning signs:** After implementing, `/patient/dashboard` 404s but `/dashboard` (unprefixed) works.

### Pitfall 4: Remote Supabase project's email-confirmation setting may not match local `config.toml`
**What goes wrong:** `signUp()` returns `{ data: { user, session } }` where `session` is `null` if the project requires email confirmation before login. AUTH-01 requires the patient to be usable immediately after signup (no separate "check your email" step is in scope — this is a demo project with no real email sending configured). The local `supabase/config.toml` has `enable_confirmations = false` (`supabase/config.toml:226`), but this is the CLI's local-dev configuration; it does not automatically apply to the already-provisioned remote hosted project (Auth email settings there are managed via the Supabase Dashboard, not by `supabase db push`, which only pushes schema migrations).
**Why it happens:** `db push` and Auth-provider configuration are two separate systems in Supabase; a common source of "works locally, breaks against the real project" bugs.
**How to avoid:** Either (a) verify/set the remote project's Auth → Email provider → "Confirm email" toggle to match `config.toml`, or (b) — the more robust option — have the signup Route Handler use the service-role admin client's `admin.createUser({ email, password, email_confirm: true })` instead of the anon client's `signUp()`, which creates an already-confirmed user server-side regardless of the project's email-confirmation setting, then call `signInWithPassword()` immediately after to establish the session/cookies. Option (b) also naturally solves Pitfall 2, since the admin client already bypasses RLS for the `profiles` insert.
**Warning signs:** Signup appears to succeed (`200 OK`) but the user is not logged in afterward, or a subsequent login attempt fails with "Email not confirmed."

## Code Examples

### Manual validation functions (D-02)
```typescript
// lib/validation/auth.ts — composed for this project (no schema library, per D-02).
// Password minimum length mirrors supabase/config.toml:182
// (`minimum_password_length = 6`) [VERIFIED: supabase/config.toml:182] — quoted verbatim:
// "minimum_password_length = 6"
export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Email is required.";
  // Simple RFC-5322-ish check; not exhaustive by design (server-side, not the security boundary).
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Invalid email format.";
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "Password is required.";
  if (password.length < 6) return "Password must be at least 6 characters.";
  return null;
}

export function validateFullName(fullName: string): string | null {
  if (!fullName.trim()) return "Full name is required.";
  return null;
}
```

### Signup Route Handler (closes Pitfall 2 and Pitfall 4 together)
```typescript
// app/api/auth/signup/route.ts — composed for this project from verified API signatures.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateEmail, validatePassword, validateFullName } from "@/lib/validation/auth";

export async function POST(request: Request) {
  const body = await request.json();
  const { email, password, fullName } = body;

  const emailError = validateEmail(email);
  const passwordError = validatePassword(password);
  const nameError = validateFullName(fullName);
  if (emailError || passwordError || nameError) {
    return NextResponse.json(
      { error: emailError ?? passwordError ?? nameError },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Create an already-confirmed user regardless of the project's email-confirmation
  // setting (sidesteps Pitfall 4).
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message ?? "Could not create account." },
      { status: 400 },
    );
  }

  // Insert the profiles row server-side with a hardcoded role — closes Pitfall 2.
  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    role: "patient", // hardcoded, never taken from client input
    full_name: fullName,
    email,
  });
  if (profileError) {
    return NextResponse.json({ error: "Could not create profile." }, { status: 500 });
  }

  // Now sign in through the SSR server client so Set-Cookie headers land on this response.
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    return NextResponse.json({ error: signInError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
```

### Login / Logout Route Handlers
```typescript
// app/api/auth/login/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateEmail, validatePassword } from "@/lib/validation/auth";

export async function POST(request: Request) {
  const { email, password } = await request.json();
  const emailError = validateEmail(email);
  const passwordError = validatePassword(password);
  if (emailError || passwordError) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  return NextResponse.json({ success: true, role: profile?.role ?? null });
}
```
```typescript
// app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.json({ success: true });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `middleware.ts` / `middleware()` | `proxy.ts` / `proxy()` | Next.js 16.0.0 | Any Next.js ≤15 tutorial or training-data example for auth middleware must be mentally translated to `proxy.ts`; see Pitfall 1 |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | Supabase deprecated auth-helpers in favor of `@supabase/ssr` (framework-agnostic cookie adapter pattern) well before this project started; already correctly using the current package | No action needed — already on the current package |
| `getSession()` for server-side auth checks | `getUser()` (network-verified) or `getClaims()` (local JWT verification with automatic fallback to `getUser()`) | Ongoing Supabase Auth guidance, reinforced across multiple current docs/discussions | `getSession()` must never be the basis of an authorization decision in `proxy.ts` or Route Handlers |
| `anon` / `service_role` API keys | `publishable` (`sb_publishable_...`) / `secret` (`sb_secret_...`) API keys | Supabase is phasing out `anon`/`service_role` naming; both key families work simultaneously through end of 2026 per Supabase's migration guide | No action needed this phase — the project's already-provisioned `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` env vars continue to work; note for a future phase before the deprecation date |

**Deprecated/outdated:**
- `middleware.ts`: deprecated as of Next.js 16.0.0, not yet removed but not invoked by the framework's convention resolver in the way a developer would expect — treat as non-functional for this project's installed version.
- `@supabase/auth-helpers-*` packages: long deprecated in favor of `@supabase/ssr`; not present in this project, no action needed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `getClaims()` is available and behaves as described (local JWT verification with automatic `getUser()` fallback) on `@supabase/supabase-js` 2.112.0 / `@supabase/ssr` 0.12.4 | Standard Stack (Alternatives), Summary | Low — the recommended primary pattern in this research uses `getUser()`, which is stable across all supabase-js versions; `getClaims()` is offered only as an optional future optimization, not required for Phase 1 to work |
| A2 | The remote/hosted Supabase project's Auth → Email → "Confirm email" setting is currently enabled (default) rather than already matching the local `config.toml`'s `enable_confirmations = false` | Pitfall 4 | Medium — if wrong (i.e., it's already disabled), the extra `admin.createUser({ email_confirm: true })` step is harmless but redundant; if the assumption that it needs checking is ignored entirely and the plan uses plain `signUp()`, signup could silently fail to produce a session on the remote project |
| A3 | `app/{patient,doctor,admin}` should be plain folders, not Next.js route groups, based on TASKS.md's stated URL scheme (`/patient/dashboard` etc.) taking precedence over `01-CONTEXT.md`'s route-group-styled file names | Pitfall 3, Recommended Project Structure | Medium — if the planner instead follows `01-CONTEXT.md`'s literal `(patient)` naming, the URLs described in TASKS.md and the `proxy.ts` matcher prefixes will not line up; this is a plan-time decision point, not a code bug once decided consistently |
| A4 | `proxy.ts`'s per-request `getUser()` call role-gates only by authentication presence (not role), deferring the role check to the layout server component, is an acceptable division of responsibility for AUTH-07 | Architecture Patterns (Pattern 4) | Low — functionally correct either way (RLS is the ultimate backstop); doing the role check only in the layout avoids one extra DB round-trip per request in `proxy.ts` at the cost of a per-role-tree round-trip in the layout, which is negligible at this project's scale |

**If this table is empty:** N/A — see above.

## Open Questions

1. **`getUser()` vs `getClaims()` for `proxy.ts` and layouts**
   - What we know: Both exist as of the currently published Supabase docs' Next.js template; `getClaims()` avoids a network round-trip via local JWT verification and falls back to `getUser()` automatically for edge cases (key rotation, symmetric/legacy JWTs).
   - What's unclear: Whether `getClaims()` requires the project's Auth to already be on asymmetric JWT signing keys to get any benefit, and whether the already-provisioned remote project has that enabled — not verifiable from this session.
   - Recommendation: Start with `getUser()` everywhere (simpler, always correct, easier to defend in an academic setting per the project's own stated bias toward simple/standard patterns). Revisit `getClaims()` only if per-request auth latency becomes a measured problem — unlikely at this project's scale (demo data, Tel-Aviv-only v1).

2. **Whether to route the doctor login through the same `/login` page/route as the patient, or a separate one**
   - What we know: AUTH-02 and AUTH-05 both use `signInWithPassword`; the only difference is how the account was created (self-signup vs. admin-created) and the post-login redirect target (`/patient/dashboard` vs `/doctor/dashboard`), which is already resolvable from `profiles.role` after login.
   - What's unclear: Nothing technical — this is a UX decision left to Claude's Discretion per `01-CONTEXT.md`.
   - Recommendation: Single shared `/login` route for both patient and doctor (and admin), branching the post-login redirect on `profile.role`. Simpler, fewer pages, matches "Claude's Discretion" framing in CONTEXT.md.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | All of Next.js dev/build | ✓ | (see `npm view` calls above; project builds successfully per `01-CONTEXT.md`) | — |
| `@supabase/ssr` | Server/browser Supabase clients | ✓ (installed) | 0.12.4 | — |
| `@supabase/supabase-js` | Admin client | ✓ (installed) | 2.112.0 | — |
| `@playwright/test` | All Playwright tests (D-10) | ✗ (not yet installed) | 1.62.1 available on registry | None viable — Playwright is a locked decision (D-10); must be installed this phase, gated behind `checkpoint:human-verify` per Package Legitimacy Audit |
| Remote Supabase project reachability | Every Auth call, every RLS-gated query | Not verified in this research session (no network credentials available to this agent) | — | Planner should add an early smoke-test task (e.g. a trivial `select` against `specialties`) to confirm connectivity before building the full auth flow on top of it |

**Missing dependencies with no fallback:**
- `@playwright/test` — must be installed (D-10 has no fallback; Playwright is the only test tool this project uses).

**Missing dependencies with fallback:**
- None beyond the connectivity smoke-test suggestion above.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (`@playwright/test` 1.62.1) — not yet installed, see Environment Availability |
| Config file | none yet — `playwright.config.ts` is a Wave 0 gap |
| Quick run command | `npx playwright test tests/e2e/auth-login.spec.ts` (single file, fastest feedback loop) |
| Full suite command | `npx playwright test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| AUTH-01 | Patient signs up successfully | e2e | `npx playwright test tests/e2e/auth-signup.spec.ts` | ❌ Wave 0 |
| AUTH-02 | Patient logs in with valid/invalid credentials | e2e | `npx playwright test tests/e2e/auth-login.spec.ts` | ❌ Wave 0 |
| AUTH-03 | Patient logs out | e2e | `npx playwright test tests/e2e/auth-logout.spec.ts` | ❌ Wave 0 |
| AUTH-04 | Session persists after browser refresh | e2e | `npx playwright test tests/e2e/auth-session-persistence.spec.ts` | ❌ Wave 0 |
| AUTH-05 | Doctor logs in with admin-created credentials | e2e | `npx playwright test tests/e2e/auth-doctor-login.spec.ts` | ❌ Wave 0 — also needs a seed/fixture doctor login account, since the admin UI that creates one doesn't exist until Phase 2 |
| AUTH-06 | Unauthenticated user redirected from protected pages | e2e | `npx playwright test tests/e2e/route-protection-unauthenticated.spec.ts` | ❌ Wave 0 |
| AUTH-07 | Role mismatch denied access | e2e | `npx playwright test tests/e2e/route-protection-role-mismatch.spec.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** run the single spec file covering the task just implemented.
- **Per wave merge:** `npx playwright test` (full suite).
- **Phase gate:** Full suite green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `npm install -D @playwright/test` + `npx playwright install --with-deps chromium` (gate behind `checkpoint:human-verify` per Package Legitimacy Audit)
- [ ] `playwright.config.ts` — baseURL pointing at local dev server (`http://localhost:3000`), reasonable timeouts
- [ ] `tests/e2e/` directory with the seven spec files listed above
- [ ] A fixture/helper to create a doctor login account directly via the admin client (bypassing the not-yet-built Phase 2 admin UI) so AUTH-05's test has something to log in with
- [ ] A test-user cleanup strategy: since these are real `auth.users`/`profiles` rows against the remote hosted Supabase project (no local Supabase test instance mentioned in `01-CONTEXT.md`), either (a) generate unique emails per test run (`test-${Date.now()}@example.com`) and accept accumulation, or (b) add a teardown step using the admin client to delete test users after each run — flag this choice for the planner, it is not resolved by this research

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | yes | Supabase Auth (GoTrue) — bcrypt password hashing, never hand-rolled |
| V3 Session Management | yes | `@supabase/ssr` httpOnly cookie-based sessions + `proxy.ts` refresh; refresh-token rotation already enabled (`supabase/config.toml:171`, `enable_refresh_token_rotation = true`) |
| V4 Access Control | yes | Postgres RLS (`is_admin()`, `is_doctor_owner()`) as last line of defense + `proxy.ts` coarse gate + role-scoped layout fine gate (defense in depth, see Pitfall 2/3) |
| V5 Input Validation | yes | Manual TS validation functions (D-02), see Code Examples |
| V6 Cryptography | partial | Fully delegated to Supabase Auth for password hashing and JWT signing — no custom crypto code should be written in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Client sets `profiles.role` to `'admin'`/`'doctor'` on signup or a future generic profile-update endpoint | Elevation of Privilege | Hardcode `role: 'patient'` server-side using the admin client on signup (see Code Examples); never build a profile-update endpoint that spreads raw client JSON into a Supabase mutation against `profiles` |
| Open redirect via the `?from=` query param used to return the user to their originally requested page after login | Tampering / Spoofing | Validate the `from` value is a same-origin relative path (starts with `/`, does not start with `//` or contain a scheme) before redirecting to it after login |
| Credential stuffing / brute-force login attempts | — (external threat, not STRIDE-mapped to this app's code) | Supabase's built-in Auth rate limits — locally configured `sign_in_sign_ups = 30` per 5 minutes per IP (`supabase/config.toml:207`); verify the remote hosted project has an equivalent or stricter limit configured (Dashboard, not code) |
| Trusting `getSession()` (unrevalidated) for an authorization decision in `proxy.ts` or a Route Handler | Spoofing | Use `getUser()` (network-verified) everywhere an authorization decision is made; reserve `getSession()`, if used at all, for reading the access/refresh token values only |
| BOLA/IDOR reading another user's `profiles`/`appointments` rows through a Route Handler that queries with the anon/session client but forgets a `WHERE` filter | Information Disclosure | Already mitigated by RLS in the deployed migration (`profiles_select_own_or_admin`, `appointments_select_own_or_admin`) — do not bypass this by routing reads through the admin/service-role client from a user-facing GET endpoint |

## Sources

### Primary (HIGH confidence)
- None — Context7 MCP tooling was unavailable in this session (see Metadata); all findings verified through direct WebFetch of official documentation pages instead, which this seam classifies as LOW/MEDIUM by provider risk profile even though the underlying source is authoritative. Tags below reflect source authority, not the seam's provider-risk score.

### Secondary (MEDIUM/CITED — official documentation, fetched and read directly this session)
- [nextjs.org/docs/app/api-reference/file-conventions/proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) — proxy.ts convention, matcher syntax, runtime, version history (`v16.0.0` entry). Page metadata confirms `version: 16.2.12`, matching this project's installed Next.js version.
- [nextjs.org/docs/app/api-reference/functions/cookies](https://nextjs.org/docs/app/api-reference/functions/cookies) — confirmed `cookies` is imported from `'next/headers'`, used to correct a hallucinated `'next/handlers'` import surfaced by an earlier WebFetch summary of a third-party GitHub example.
- [github.com/vercel/next.js — examples/with-supabase](https://github.com/vercel/next.js/tree/canary/examples/with-supabase) — official Vercel-maintained example showing current `proxy.ts` + `lib/supabase/{client,server,proxy}.ts` structure and code.
- [supabase.com/docs/guides/auth/server-side/nextjs](https://supabase.com/docs/guides/auth/server-side/nextjs) and [supabase.com/docs/guides/auth/server-side/creating-a-client](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — confirmed the two-client (browser/server) pattern and that Supabase's own current Next.js guide now refers to "Proxy" (not "middleware") and calls `getClaims()` in its own example.
- [supabase.com/docs/guides/getting-started/migrating-to-new-api-keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys) (via WebSearch synthesis) — publishable/secret key migration timeline, both key families usable simultaneously through end of 2026.

### Tertiary (LOW/ASSUMED — community sources, cross-checked against official docs where possible)
- Multiple Medium/dev.to articles on the `middleware.ts` → `proxy.ts` migration (used only to locate the correct official doc pages, not cited as a standalone source of truth).
- GitHub discussions (`supabase/supabase` #39947, #40985) on `getClaims()` vs `getUser()` vs `getSession()` guidance — informed the recommendation in Open Questions #1 but not treated as authoritative on its own.

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all installed versions directly verified with `npm view`/`npm list` against `package.json`.
- Architecture (proxy.ts, SSR client pattern): MEDIUM — verified against official Next.js docs (exact version match) and an official Vercel-maintained example repo; Context7 MCP was unavailable this session, so no HIGH-tier verification path was available, but cross-referencing two independent official sources plus catching and correcting one hallucinated import (`next/handlers`) gives reasonable confidence.
- Pitfalls (RLS role-escalation gap, route-group vs plain-folder mismatch): HIGH for the RLS finding — directly read and quoted from the already-applied migration file this session. MEDIUM for the route-group finding — inferred from a direct textual conflict between two of the project's own planning documents (`01-CONTEXT.md` vs `TASKS.md`), not from external research.
- Security Domain: MEDIUM — ASVS mapping and STRIDE patterns are standard practice for this stack, but the remote hosted Supabase project's actual Auth-dashboard configuration (email confirmation, rate limits) could not be inspected this session and is flagged as an open assumption (A2).

**Research date:** 2026-08-03
**Valid until:** 7 days — Next.js 16 is a very recently released major version under active early-adoption churn (the `middleware`→`proxy` rename itself is evidence of this), and Supabase's API key migration is mid-rollout; re-verify before acting on this research if more than a week has passed.
