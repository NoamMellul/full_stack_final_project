# MedRDV — Basic Security

> Interview-prep notes, not a deliverable from the assignment brief.

## Authentication

Handled entirely by **Supabase Auth** (email + password) — no homemade system. The flow:
1. `POST /api/auth/login` calls `supabase.auth.signInWithPassword({ email, password })`.
2. Supabase returns a JWT, which `@supabase/ssr` automatically stores in **httpOnly cookies** (never accessible from browser JavaScript — a baseline protection against token theft via XSS).
3. `lib/supabase/proxy.ts` (the Next.js middleware equivalent) refreshes the session on **every request** via `supabase.auth.getUser()`, and redirects to `/login?from=<page>` if no user is found on a protected area.
4. The `?from=` parameter is then validated by `safeRedirectPath()` (`lib/validation/redirect.ts`) before being used as the post-login redirect target — an **open-redirect** protection: it rejects any value that isn't a relative path starting with a single `/` (blocks `//evil.com`, `https://evil.com`, `javascript:...`, and even `/\evil.com`, which a browser would normalize into a cross-origin URL).

**Non-oracle login behavior**: `app/api/auth/login/route.ts` returns **the exact same error message** ("Incorrect email or password. Please try again.") whether the email is invalid, the password is wrong, or the request body is malformed JSON — an attacker can never determine whether an email exists in the database by observing the response (protection against account enumeration).

## Authorization

Two layers, never just one:

1. **RLS (Row Level Security) inside Postgres** — the absolute ground truth. Every table has its policies (see `architecture-database.md` for details), all keyed on `auth.uid()` (the identity resolved from the JWT, never a client-supplied parameter). Concrete examples:
   - `favorites_all_own`: `using (patient_id = auth.uid())` — a patient can only read/modify their own favorites.
   - `notifications_select_own`: `using (user_id = auth.uid())`.
   - `appointments_select_own_or_admin`: the patient sees their own appointments, the doctor sees theirs, the admin sees all.
   - `doctors_admin_write`: only an admin can modify the doctors table.
2. **Application-level guards** (`lib/auth/require-admin.ts`, `require-doctor.ts`, `require-patient.ts`) — re-read `profiles.role` and return a **clean, explicit** `401`/`403` before any business logic runs. This is **not** the real security boundary (it could theoretically have a bug) — it's a clarity layer that prevents a silent RLS rejection from looking like a generic server error.
3. **`proxy.ts`** — a third, coarse filter, at the URL level (`/patient`, `/doctor`, `/admin`): blocks a signed-out visitor before the page even starts loading.

## Actions restricted to signed-in users

Everything except: the home page, public search (`/search`), a doctor's public profile (`/doctors/[id]`), login/signup, and the public "request to join" form for doctors (`/api/doctor-requests`, the project's very first unauthenticated write endpoint — deliberately narrowed by its RLS policy to `with check (status = 'pending')`, so it's impossible to insert a row with any other status even by tampering with the request).

Everything else — booking/cancelling an appointment, managing favorites, viewing notifications, managing a schedule (doctor), every admin action — requires a valid session, checked at all 3 layers above.

## How we prevent access to another user's data (IDOR protection)

Concretely, on every route that takes an `[id]` in the URL (e.g. `DELETE /api/patient/favorites/[id]`), the pattern is systematic:

```ts
.delete({ count: "exact" })
.eq("patient_id", guard.userId)   // ALWAYS the server-resolved id
.eq("doctor_id", id)              // never blind trust in the URL's id
```

If `id` belongs to another user, the query affects **zero rows** (`count === 0`), and the route returns a **single, identical generic 404** — whether the resource doesn't exist at all, belongs to someone else, or was already deleted. **This message is deliberately indistinguishable** — an attacker probing random ids can never tell whether they found a real resource belonging to someone else.

And even if this application-level check had a bug, the RLS policy behind it (`favorites_all_own`, `notifications_select_own`, etc.) would perform the exact same check at the database level anyway — a double barrier.

## Input validation

Manual TypeScript validation (`lib/validation/*.ts`, 10 files) — no schema library like Zod, a deliberate simplicity choice for this project. The style is consistent everywhere: every function returns `string | null` (`null` = valid, otherwise the exact error message to display).

Notable points:
- **Systematic `typeof` guards** before any operation on a value (`validateEmail`, `validatePassword`, `validateFullName`) — without them, a missing or wrong-typed field would crash the route with an unhandled 500 instead of a clean 400.
- **No data is ever inserted into the database by simply spreading the request body** (`{ ...body }`) — every route explicitly extracts the expected fields by name. This prevents an attacker from injecting an unexpected field (e.g. trying to pass `role: "admin"` in a patient signup form — the field would simply be ignored, never read).
- **`safeRedirectPath()`** (detailed above) against open-redirect.

## How API calls are protected

- Every route starts with the appropriate authorization guard (`requireAdmin()`/`requireDoctor()`/`requirePatient()`), before any business logic.
- Session cookies are httpOnly + `SameSite` (default behavior of `@supabase/ssr`) — a baseline protection against session theft via XSS and against some CSRF scenarios.
- Every `request.json()` call is wrapped in `try/catch` — a malformed request body returns a clean 400 instead of crashing the route.
- **Accepted limitation**: no application-level rate limiting (see `architecture-scalability.md`) — an attacker could technically flood a route with valid requests. Documented as an accepted risk (see below), not silently ignored.

## How secrets are protected

- `.env.local` is **never committed** (`.gitignore` excludes `.env*`, except `.env.example`, which only contains variable names, no real values).
- Only variables prefixed `NEXT_PUBLIC_` are ever sent to the browser (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) — and this is **intentional and safe**: Supabase's "anon" key is designed by Supabase to be public, it grants no access on its own — everything rests on the RLS layer behind it.
- `SUPABASE_SERVICE_ROLE_KEY` (the key that bypasses RLS) is **never** prefixed `NEXT_PUBLIC_` and is only used in `lib/supabase/admin.ts`, which starts with `import "server-only";` — a package that **breaks the build** if this file is ever imported, even indirectly, from browser-bound code. A compile-time safety net, not just a convention.
- In production, secrets live exclusively in Vercel's dashboard environment variables — never in the source code.

## Known security risks, still open (worth owning, not hiding)

Formally documented in `06-SECURITY.md` (a STRIDE threat audit run on the project's last phase, 59 threats verified):

| Risk | Why it's accepted as-is |
|---|---|
| No global rate limiting | Zero traffic in a demo setting; would need to be added before any real production deployment |
| The `message` column on notifications still travels over the Realtime websocket despite a Postgres-level fix | Supabase's managed Realtime service appears to cache the old publication schema; fixed at the database level (verified), but the text itself is never sensitive (never medical content, never rendered client-side) |
| Locale-preference cookie without the `Secure` attribute | Very low-sensitivity cookie (just "en" or "he") |
| No CAPTCHA on signup/login | Low bot risk at demo scale |
| No 2FA | Out of scope for this academic project |

**What we'd prioritize for a real production deployment**: rate limiting, monitoring/alerting on repeated failed login attempts, regular rotation of the service-role key, and an external security audit (ours was self-run with AI assistance — useful, but not a substitute for a real pentest).
