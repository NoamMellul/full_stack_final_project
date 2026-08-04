# Phase 1 — API Coverage Decision Record

**Integration surface:** Supabase Auth via `@supabase/supabase-js` 2.112.0 + `@supabase/ssr` 0.12.4
**Policy:** Full API Coverage by Default — Opt Out, Never Opt In. Every capability relevant to AUTH-01..AUTH-07 is either `INTEGRATE` or carries an explicit `OPT-OUT` reason.
**Decided:** 2026-08-03 (plan-phase, Phase 1)

---

## Supabase Auth capability surface

| Capability | Decision | Reason |
|------------|----------|--------|
| `auth.admin.createUser({ email, password, email_confirm })` | **INTEGRATE** | AUTH-01 — `POST /api/auth/signup` creates an already-confirmed account server-side, sidestepping the unverified remote email-confirmation setting (RESEARCH Pitfall 4) |
| `auth.signInWithPassword` | **INTEGRATE** | AUTH-02, AUTH-05 — `POST /api/auth/login`, and also called by `POST /api/auth/signup` to land `Set-Cookie` on the signup response |
| `auth.signOut` | **INTEGRATE** | AUTH-03 — `POST /api/auth/logout` |
| `auth.getUser` | **INTEGRATE** | AUTH-04, AUTH-06, AUTH-07 — network-verified identity in `lib/supabase/proxy.ts` and in all three role-scoped layouts |
| `auth.admin.deleteUser` | **INTEGRATE** | Playwright test-user teardown only (`tests/e2e/helpers/test-users.ts`); never reachable from application code |
| `createBrowserClient` (`@supabase/ssr`) | **INTEGRATE** | `lib/supabase/client.ts` — the third of the three separate clients required by CONTEXT.md's discretion note and TASKS.md item 4 |
| `createServerClient` (`@supabase/ssr`) | **INTEGRATE** | `lib/supabase/server.ts` + `lib/supabase/proxy.ts` — cookie-bound SSR session client |
| `auth.signUp` | OPT-OUT | Superseded by `admin.createUser`: `signUp` returns a `null` session when the project requires email confirmation (Pitfall 4) and leaves the `profiles` insert on the anon client, where RLS does not constrain `role` (Pitfall 2) |
| `auth.getSession` | OPT-OUT | Reads the JWT from cookie storage without revalidating it; unsafe as the basis of any authorization decision (RESEARCH Anti-Patterns) |
| `auth.getClaims` | OPT-OUT | Latency optimization only; its benefit depends on asymmetric JWT signing keys whose state on the remote project could not be verified (RESEARCH Open Question 1). `getUser` is always correct |
| `auth.refreshSession` | OPT-OUT | Not called directly — `@supabase/ssr`'s cookie adapter refreshes implicitly during the `proxy.ts` `getUser()` call |
| `auth.onAuthStateChange` | OPT-OUT | D-01 routes every mutation through REST Route Handlers; Phase 1 has no client-side session subscriber |
| `auth.resetPasswordForEmail` / `auth.updateUser({ password })` | OPT-OUT | No requirement in AUTH-01..AUTH-07 covers password reset, and no email delivery is configured for this demo project |
| `auth.signInWithOtp` (magic link) | OPT-OUT | Not needed — no requirement covers this in v1; requires email delivery |
| `auth.verifyOtp` | OPT-OUT | No confirmation flow exists — accounts are created pre-confirmed via `admin.createUser` |
| `auth.signInWithOAuth` | OPT-OUT | Google OAuth is **AUTH-08**, listed under "Nice to Have" in REQUIREMENTS.md, explicitly not v1 |
| `auth.admin.listUsers` | OPT-OUT | Platform-wide user listing is ADMIN-07 (Phase 2), not an AUTH-01..07 requirement |
| `auth.admin.updateUserById` | OPT-OUT | Admin account administration is ADMIN-02/ADMIN-07 (Phase 2) |
| `auth.mfa.*` | OPT-OUT | No MFA requirement in v1 scope; REQUIREMENTS.md "Out of Scope" |
| `auth.admin.generateLink` | OPT-OUT | Doctor accounts are created with a temporary password (ADMIN-02, Phase 2), not an emailed link |

---

## Project REST API surface (this project's own routes, D-01)

| Route | Decision | Reason |
|-------|----------|--------|
| `POST /api/auth/signup` | **INTEGRATE** | AUTH-01 |
| `POST /api/auth/login` | **INTEGRATE** | AUTH-02, AUTH-05 |
| `POST /api/auth/logout` | **INTEGRATE** | AUTH-03 |
| `PATCH /api/profile` (generic profile update) | OPT-OUT | No requirement covers profile editing in v1, **and** a generic body-spreading update against `profiles` is the exact privilege-escalation vector RESEARCH Pitfall 2 warns about. If a profile-update endpoint is ever added, it must carry an explicit column allow-list that excludes `role` |
| `GET /api/auth/session` | OPT-OUT | Server Components read the session directly through `lib/supabase/server.ts`; a JSON session endpoint would add a second, weaker identity path |
