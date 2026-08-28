---
phase: quick-260817-eqs
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260817120000_harden_profiles_self_insert_role.sql
  - tests/e2e/helpers/test-users.ts
  - tests/e2e/profiles-rls-escalation.spec.ts
  - lib/auth/require-doctor.ts
  - lib/auth/require-admin.ts
  - lib/validation/redirect.ts
  - lib/validation/auth.ts
  - app/api/doctor-requests/route.ts
  - app/api/auth/login/route.ts
  - tests/e2e/admin-doctor-link-account.spec.ts
  - tests/e2e/auth-login.spec.ts
  - tests/e2e/auth-signup.spec.ts
  - tests/e2e/doctor-request.spec.ts
autonomous: true
requirements: [QUICK-260817-eqs]

estimate:
  tokens: 70000
  raw_tokens: 70000
  tasks: 6
  confidence: low

must_haves:
  truths:
    - "An authenticated user with no `profiles` row cannot insert a `profiles` row for themselves with `role='admin'` or `role='doctor'` through the Supabase client directly — the database rejects it with an RLS violation (42501), not the application layer."
    - "That same user CAN still insert their own `role='patient'` row, so the documented self-signup shape the policy exists for is not broken."
    - "A doctor whose `profiles.must_change_password` is still `true` receives a 403 from every `/api/doctor/*` route, not just a redirect on the `/doctor` pages; once the flag flips to `false` the same routes answer normally."
    - "`/api/auth/change-password` stays reachable while `must_change_password` is `true` — the new guard check must not lock a doctor out of the one endpoint that clears the flag."
    - "`safeRedirectPath('/\\\\evil.example.com', fallback)` returns the fallback, and logging in from `/login?from=/\\evil.example.com` leaves the browser on this origin."
    - "`validateEmail(123)` and `validatePassword(123)` return a validation-error string instead of throwing, so `POST /api/auth/signup` with a non-string `email` answers 400 with the project's `{\"error\": \"...\"}` shape rather than an unhandled 500."
    - "`requireAdmin()` returns 500 (not 403) when its `profiles` lookup errors, matching `requirePatient()`/`requireDoctor()` exactly."
    - "`POST /api/doctor-requests` and `POST /api/auth/login` return 400 with the project's `{\"error\": \"...\"}` shape on a malformed JSON body, never a 500."
    - "Each of the 6 fixes lands as its own commit; no fix carries an unrelated file in its diff."
  artifacts:
    - supabase/migrations/20260817120000_harden_profiles_self_insert_role.sql
    - tests/e2e/profiles-rls-escalation.spec.ts
  key_links:
    - "`public.is_admin()` (initial schema, line 153) reads `public.profiles.role` — it is the sole authority behind every `*_admin_write` policy, `doctor_requests_select_admin`, and `doctor_requests_update_admin`. A self-inserted `role='admin'` row is therefore total authorization compromise, not a local bug. The new INSERT policy is the only thing standing between an anon-key `auth.signUp()` and full admin."
    - "`20260804120200_add_must_change_password.sql` already closed the sibling UPDATE escalation via `revoke update on public.profiles from authenticated; grant update (full_name, email) ...`. INSERT was never given the same treatment — that asymmetry is the entire bug. Do not re-fix UPDATE; verify it is still in place and leave it alone."
    - "No application code path depends on `profiles_insert_own`: `app/api/auth/signup/route.ts`, `app/api/admin/doctors/[id]/link-account/route.ts` and `scripts/seed.ts` all insert through the service-role client, which bypasses RLS entirely. Tightening the policy therefore cannot break a legitimate write — confirm this with grep before writing the migration, do not take it on faith."
    - "`requireDoctor()` has exactly 5 call sites, all under `app/api/doctor/*` (`slots/route.ts` x2, `slots/[id]/route.ts`, `appointments/route.ts`, `blocked-periods/route.ts`). `app/api/auth/change-password/route.ts` does NOT use it — that is what makes Task 2 safe. Re-confirm with grep before editing."
---

<objective>
Close one critical RLS privilege-escalation hole plus five smaller security/robustness
findings surfaced by code review, each as an atomic commit.

Purpose: `public.is_admin()` reads `public.profiles.role`, and the `profiles` INSERT
policy never constrains `role`. Any authenticated user can self-insert an admin profile
row via the anon-key Supabase client, bypassing the Next.js signup route entirely, and
inherit every admin-only policy in the schema. The other five findings are defence-in-depth
and error-shape correctness in the auth guards, redirect validation, and route handlers.

Output: one new migration, five small source edits, one new Playwright spec, and four
extended specs. Six commits.
</objective>

<execution_context>
@C:/Users/mellu/Desktop/full_stack_final_project/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/mellu/Desktop/full_stack_final_project/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/CLAUDE.md

Project constraints that bind every task below:
- Manual TypeScript validation only — no Zod, no schema library.
- REST Route Handlers only — no Server Actions.
- Playwright end-to-end tests only — no Vitest, no React Testing Library. Every behaviour
  proven below must be proven over HTTP or through a real Supabase client, never a unit test.
- No new dependencies. No refactors. Every diff minimal and style-matched to its neighbours.
</context>

<tasks>

<task type="auto">
  <name>Task 1: CRITICAL — constrain self-inserted profiles rows to role='patient' (new migration)</name>
  <files>supabase/migrations/20260817120000_harden_profiles_self_insert_role.sql, tests/e2e/helpers/test-users.ts, tests/e2e/profiles-rls-escalation.spec.ts</files>
  <read_first>
    - `.claude/skills/supabase-postgres-best-practices/SKILL.md` — MANDATORY before writing any SQL. Follow its RLS-policy authoring rules (policy naming, `with check` vs `using`, wrapping `auth.uid()` for initplan caching where the file's existing style already does or does not).
    - `.claude/skills/supabase/SKILL.md` — MANDATORY. Follow its migration conventions (new timestamped file, never edit an applied migration).
    - `supabase/migrations/20260803230000_initial_schema.sql` lines 16-22 (the `profiles` table: `role text not null check (role in ('patient','doctor','admin'))`) and lines 153-204 (`public.is_admin()` plus the three `profiles_*` policies).
    - `supabase/migrations/20260804120200_add_must_change_password.sql` — the sibling UPDATE lockdown, already in place. This is the precedent for the *reasoning*, not the mechanism (that one used column GRANTs; this one uses a policy `with check`).
    - `supabase/migrations/20260811100000_revoke_appointments_direct_update.sql` and `20260811110000_fix_doctor_patient_profile_exposure.sql` — the repo's RLS-hardening migration style: a long comment header that states the finding, why the obvious alternative fix does not work, and what is deliberately left untouched, followed by a very short SQL body.
    - `tests/e2e/helpers/test-users.ts` (all 100 lines) and `tests/e2e/helpers/supabase-anon.ts`.
  </read_first>
  <action>
    Write a NEW migration `supabase/migrations/20260817120000_harden_profiles_self_insert_role.sql`.
    Do NOT edit `20260803230000_initial_schema.sql`.

    SQL body: `drop policy if exists "profiles_insert_own" on public.profiles;` then recreate a
    policy for INSERT on `public.profiles` whose `with check` requires BOTH `id = auth.uid()`
    AND `role = 'patient'`. Keep the policy name `profiles_insert_own` (a rename would orphan the
    initial schema's own comment); if the skill files prescribe a different naming rule for a
    narrowed policy, follow the skill and say so in the header.

    Header comment must state, in the style of the two 20260811 migrations: the finding (the
    original `with check (id = auth.uid())` never constrained `role`, and `public.is_admin()`
    reads this exact table, so a self-insert with `role='admin'` is full authorization
    compromise); the reachable attack path (an attacker calls `supabase.auth.signUp()` against
    the anon key directly from a browser, never touching `/api/auth/signup`, then inserts their
    own profiles row — Supabase grants `authenticated` table-level INSERT on `public` tables by
    default, exactly as `20260816120000_add_doctor_requests.sql`'s header already documents);
    why `patient` is the correct and only self-serviceable role (doctor rows are created by
    `app/api/admin/doctors/[id]/link-account/route.ts` with a hardcoded `role: "doctor"` through
    the service-role client, and admin rows are provisioned out-of-band — `scripts/seed.ts` line
    208 states explicitly that it never creates an admin account); and why nothing breaks (every
    legitimate `profiles` insert in the codebase goes through the service-role client, which
    bypasses RLS — verify this with `grep -rn "from(\"profiles\").insert" app scripts lib` before
    writing, and record the call sites you found in the header).

    Also note in the header that the sibling UPDATE escalation was already closed by
    `20260804120200_add_must_change_password.sql`'s `revoke update ... grant update (full_name,
    email)`, so `role` cannot be escalated after the fact either — that migration is deliberately
    untouched here.

    Then apply the migration to the linked remote project with `npx supabase db push --linked`.

    Test helper: add a `createBareAuthUser()` export to `tests/e2e/helpers/test-users.ts` that
    calls `testAdminClient().auth.admin.createUser({ email, password: TEST_PASSWORD,
    email_confirm: true })` and pushes the id onto the existing `createdUserIds` array (so the
    existing `cleanupTestUsers()` collects it) but creates NO `profiles` row. This helper is
    required because `createTestUser()` already inserts a profiles row — reusing it would make
    the escalation insert fail on the primary-key conflict (23505) instead of the RLS policy
    (42501), i.e. a false pass that proves nothing.

    New spec `tests/e2e/profiles-rls-escalation.spec.ts`: create a bare auth user, sign in with
    `testAnonClient().auth.signInWithPassword(...)` so the client carries a real authenticated
    JWT, then assert three cases against `.from("profiles").insert(...)`:
    (1) `{ id: user.id, role: "admin", full_name, email }` is rejected — assert on
    `error.code === "42501"` (RLS violation), not on the message text;
    (2) `{ ..., role: "doctor" }` is rejected the same way;
    (3) `{ ..., role: "patient" }` succeeds, proving the policy's legitimate branch survives.
    Run case 3 last, or use a separate bare user per case, since case 3 creates the row that
    would make a later insert conflict. Clean up via the existing `cleanupTestUsers()` in
    `test.afterAll`, matching the idiom in `tests/e2e/auth-signup.spec.ts`.
  </action>
  <verify>
    <automated>cd C:/Users/mellu/Desktop/full_stack_final_project &amp;&amp; npx playwright test tests/e2e/profiles-rls-escalation.spec.ts --reporter=line</automated>
  </verify>
  <done>
    Migration file exists, is applied to the linked project, and all three cases in
    `profiles-rls-escalation.spec.ts` pass. `20260803230000_initial_schema.sql` is byte-identical
    to before. `npx supabase db advisors --linked` reports no new security finding on `profiles`.

    Existing Playwright coverage for this behaviour: `tests/e2e/auth-signup.spec.ts:59` proves the
    *signup route* ignores a `role: "admin"` field in its request body — it does NOT touch the
    direct-Supabase-client bypass this task closes. That was the coverage gap; this new spec is
    the first test of the database boundary itself. Note this explicitly in the summary.
  </done>
  <reversibility rating="reversible">A policy narrowing; re-widening is a one-line follow-up migration. Nothing is dropped or rewritten destructively.</reversibility>
</task>

<task type="auto">
  <name>Task 2: enforce must_change_password inside requireDoctor()</name>
  <files>lib/auth/require-doctor.ts, tests/e2e/admin-doctor-link-account.spec.ts</files>
  <read_first>
    - `lib/auth/require-doctor.ts` (current, 54 lines).
    - `app/doctor/(gated)/layout.tsx` — the existing check being mirrored: `.from("profiles").select("must_change_password").eq("id", user.id).single()` then `redirect("/doctor/change-password")`.
    - `app/api/auth/change-password/route.ts` — confirm it does NOT call `requireDoctor()`. Re-run `grep -rn "requireDoctor" app lib` and confirm the call sites are exactly the 5 under `app/api/doctor/*`. If `change-password` turns out to use the guard, STOP and report — the fix as specified would lock the doctor out of the only endpoint that clears the flag.
    - `tests/e2e/admin-doctor-link-account.spec.ts` tests 2, 3, 4 and 8 (the existing `must_change_password` lifecycle coverage).
  </read_first>
  <action>
    In `requireDoctor()`, after the existing `doctors` lookup succeeds (so a non-doctor still
    receives the plain `Not authorized.` 403 and learns nothing about password state), add a
    second lookup on `profiles` selecting `must_change_password` for `user.id`, using
    `.maybeSingle()` and the guard's own error idiom — an error returns the same
    `{ error: "Something went wrong. Please try again." }` 500 the `doctorError` branch already
    returns.

    When the flag is `true`, return `ok: false` with a 403 carrying a distinct message so it is
    not confusable with the generic `Not authorized.` — use the literal
    `You must change your temporary password before continuing.`. Match the file's existing
    comment density: one short comment explaining that the `(gated)` layout covers only the
    doctor *pages*, leaving `/api/doctor/*` reachable indefinitely on an admin-issued temp
    password, which is what this check closes.

    Do not change the guard's success shape or its exported `DoctorGuardResult` type.
  </action>
  <verify>
    <automated>cd C:/Users/mellu/Desktop/full_stack_final_project &amp;&amp; npx tsc --noEmit &amp;&amp; npx playwright test tests/e2e/admin-doctor-link-account.spec.ts --reporter=line</automated>
  </verify>
  <done>
    Add two cases to `tests/e2e/admin-doctor-link-account.spec.ts`, reusing that file's existing
    linked-doctor fixture and login flow: (a) while `must_change_password` is `true`, a logged-in
    doctor's `GET /api/doctor/slots` returns 403 with the new message; (b) after the existing
    password-change step, the same request succeeds. Both pass, and tests 1-8 in that file still pass.

    Existing Playwright coverage: tests 2, 3, 4 and 8 of `admin-doctor-link-account.spec.ts` cover
    the flag's lifecycle through the *page* layer only (redirect to `/doctor/change-password`, no
    redirect loop, flag flipping true -> false). No test ever called an `/api/doctor/*` route while
    the flag was true — that was the gap, now closed by case (a). Note this in the summary.
  </done>
</task>

<task type="auto">
  <name>Task 3: reject backslashes in safeRedirectPath</name>
  <files>lib/validation/redirect.ts, tests/e2e/auth-login.spec.ts</files>
  <read_first>
    - `lib/validation/redirect.ts` (14 lines, current).
    - `app/login/page.tsx` line 71 — the only consumer.
    - `lib/supabase/proxy.ts` around line 55 — its comment asserts the `?from=` value it builds is always accepted by `safeRedirectPath`. Confirm the proxy builds that value from a Next.js `pathname`, which cannot contain a backslash, so this tightening cannot break the login redirect it feeds.
    - `tests/e2e/auth-login.spec.ts` lines 49-85 — the two existing off-site `from` cases.
  </read_first>
  <action>
    Add a backslash rejection to `safeRedirectPath` alongside the existing three guards:
    reject when the raw value contains a backslash anywhere (`raw.includes("\\")`), returning the
    fallback. Place it with the other rejections and extend the existing block comment to record
    why: a browser normalizes `/\evil.example.com` to a cross-origin URL
    (`new URL('/\\evil.example.com', 'https://good.com').href` resolves to `https://evil.example.com/`),
    so a leading-slash-plus-backslash slips past both the `//` check and the `:` check. Match the
    file's existing comment voice. Keep the function's signature and behaviour otherwise identical.
  </action>
  <verify>
    <automated>cd C:/Users/mellu/Desktop/full_stack_final_project &amp;&amp; npx playwright test tests/e2e/auth-login.spec.ts --reporter=line</automated>
  </verify>
  <done>
    A third off-site case added to `tests/e2e/auth-login.spec.ts`, structurally identical to the
    two neighbours: navigate to a `/login?from=` URL carrying the backslash payload (URL-encode
    the backslash as `%5C` in the `page.goto` string so it survives the address bar), log in, and
    assert the browser stays on this origin at the patient home. All 4 `from`-related cases pass.

    Existing Playwright coverage: `auth-login.spec.ts` already covers the absolute-URL
    (`https://evil.example.com`) and protocol-relative (`//evil.example.com`) payloads. The
    backslash variant was the untested third form — that was the gap. Note in the summary.
  </done>
</task>

<task type="auto">
  <name>Task 4: typeof guards in validateEmail / validatePassword</name>
  <files>lib/validation/auth.ts, tests/e2e/auth-signup.spec.ts</files>
  <read_first>
    - `lib/validation/auth.ts` (21 lines, current).
    - `app/api/auth/signup/route.ts` lines 7-19 — passes `body.email` / `body.password` / `body.fullName` straight in, untyped.
    - `app/api/auth/login/route.ts` lines 13-14 — note it already does its own `typeof password === "string"` check for password, but calls `validateEmail(email)` with an untyped value.
    - `lib/validation/doctor-request.ts` — read it to copy this project's established `typeof` guard phrasing and message style rather than inventing a new one.
  </read_first>
  <action>
    Add an explicit `typeof` check at the top of `validateEmail` and `validatePassword` that
    returns the function's existing required-field message (`Email is required.` /
    `Password is required.`) for any non-string input, so a non-string can never reach `.trim()`
    or `.length`. Return, never throw. Reuse the existing message literals verbatim — do not
    introduce new strings, because `lib/i18n/validation-messages.ts` maps these exact English
    literals to dictionary keys (locked by plan 06-07) and a new literal would render untranslated.

    Leave `validateFullName` alone unless the same one-line guard fits it identically; if you add
    it there too, keep it in the same commit and say so in the summary.
  </action>
  <verify>
    <automated>cd C:/Users/mellu/Desktop/full_stack_final_project &amp;&amp; npx tsc --noEmit &amp;&amp; npx playwright test tests/e2e/auth-signup.spec.ts --reporter=line</automated>
  </verify>
  <done>
    A case added to `tests/e2e/auth-signup.spec.ts` posting a non-string `email` (e.g. the number
    `123`) to `POST /api/auth/signup` via `request.post`, asserting a 400 with the project's
    `{ error }` shape — not a 500. Passes.

    Existing Playwright coverage: none for non-string input on either validator. The project is
    Playwright-only by constraint, so these validators have no unit tests and are reachable only
    through the signup/login routes; the new API-level case is the first coverage. Note in the summary.
  </done>
</task>

<task type="auto">
  <name>Task 5: handle the profiles lookup error in requireAdmin()</name>
  <files>lib/auth/require-admin.ts</files>
  <read_first>
    - `lib/auth/require-admin.ts` (40 lines, current) — destructures only `data`, so a DB error silently becomes `profile === null` and a 403.
    - `lib/auth/require-patient.ts` lines 31-51 and `lib/auth/require-doctor.ts` lines 31-51 — the exact pattern to mirror: `.maybeSingle()`, destructure `{ data: profile, error: profileError }`, an error branch returning `{ error: "Something went wrong. Please try again." }` at 500, then the role check.
  </read_first>
  <action>
    Bring `requireAdmin()`'s `profiles` lookup in line with its two siblings: destructure the
    `error`, switch `.single()` to `.maybeSingle()` so a genuinely missing row is not itself an
    error, add the 500 branch before the role check, and keep the existing
    `profile?.role !== "admin"` 403 branch unchanged. Byte-match the sibling guards' error message
    and status. No other change to the file.
  </action>
  <verify>
    <automated>cd C:/Users/mellu/Desktop/full_stack_final_project &amp;&amp; npx tsc --noEmit &amp;&amp; npx playwright test tests/e2e/admin-route-protection.spec.ts --reporter=line</automated>
  </verify>
  <done>
    `admin-route-protection.spec.ts` still passes unchanged — the 401 and 403 paths are untouched
    and that spec drives all 15 admin endpoints.

    Existing Playwright coverage: `admin-route-protection.spec.ts` covers the 401 (anonymous) and
    403 (wrong role) branches thoroughly. The new 500 branch is NOT covered and is not reachable
    from a Playwright test — forcing a `profiles` SELECT error would require breaking the database
    mid-run. This is an accepted, permanent coverage gap given the Playwright-only constraint;
    the fix is justified by consistency with the two sibling guards that already have it, not by a
    test. State this plainly in the summary rather than implying coverage.
  </done>
</task>

<task type="auto">
  <name>Task 6: try/catch around request.json() in doctor-requests and login</name>
  <files>app/api/doctor-requests/route.ts, app/api/auth/login/route.ts, tests/e2e/doctor-request.spec.ts, tests/e2e/auth-login.spec.ts</files>
  <read_first>
    - `app/api/appointments/route.ts` lines 19-34 — the canonical pattern in this codebase: `let body: unknown;` + `try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }` followed by the `typeof body !== "object" || body === null` normalization and its WR-01 comment.
    - `app/api/doctor-requests/route.ts` (current) and `app/api/auth/login/route.ts` (current).
    - `lib/validation/doctor-request.ts` — check whether `validateDoctorRequestInput` already null-guards its argument, which decides whether the `body = {}` normalization line is needed here.
  </read_first>
  <action>
    Apply the `app/api/appointments/route.ts` pattern to both routes, including the
    `typeof body !== "object" || body === null` normalization (a literal `null` body is valid JSON
    and parses without throwing, so the try/catch alone is not sufficient — the same WR-01 reasoning).

    `doctor-requests`: replace `const body = await request.json();` with the guarded form, keeping
    `Invalid request body.` as the 400 message to match `appointments`. Everything downstream
    (`validateDoctorRequestInput`, the destructure, the trim rules) stays exactly as-is.

    `login`: same guarded form, but the 400 it returns on malformed JSON must be the route's own
    existing generic credential string, NOT `Invalid request body.` — this endpoint's non-oracle
    guarantee (T-01-08, restated in plan 06-08) requires every 400/401 from it to be
    byte-identical, and a distinguishable parse error would be a new response-shape signal.
    Restate the literal inline as the file already does in both its existing branches; do not
    introduce a shared constant (plan 01-03 made that a deliberate decision).
  </action>
  <verify>
    <automated>cd C:/Users/mellu/Desktop/full_stack_final_project &amp;&amp; npx playwright test tests/e2e/doctor-request.spec.ts tests/e2e/auth-login.spec.ts --reporter=line</automated>
  </verify>
  <done>
    One case added to each spec, posting a raw malformed body (`request.post(url, { headers: {
    "Content-Type": "application/json" }, data: "{ not json" })`) and asserting 400 with the
    project's `{ error }` shape. The login case additionally asserts the returned string is
    byte-identical to the existing wrong-password error, preserving the non-oracle guarantee.
    Both specs pass in full.

    Existing Playwright coverage: `doctor-request.spec.ts` and `auth-login.spec.ts` both cover
    well-formed-body validation failures but neither ever sent malformed JSON — that was the gap.
    Note in the summary.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser (anon key) → Postgres | An attacker can call the Supabase REST/JS API directly with the public anon key and a self-obtained JWT, entirely bypassing every Next.js Route Handler. RLS is the only control on this path. |
| browser → Next.js Route Handler | Untrusted JSON bodies and untrusted `?from=` query values cross here. |
| Route Handler → Postgres (session-bound client) | Guards give clean status codes; RLS remains the authority. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-EQS-01 | Elevation of Privilege | `profiles_insert_own` RLS policy | critical | mitigate | Task 1 — `with check` narrowed to `id = auth.uid() and role = 'patient'`, proven by a live anon-client insert test asserting SQLSTATE 42501 |
| T-EQS-02 | Elevation of Privilege | `/api/doctor/*` reachable on an admin-issued temp password | medium | mitigate | Task 2 — `must_change_password` enforced inside `requireDoctor()`, not only in the page layout |
| T-EQS-03 | Spoofing (phishing via open redirect) | `safeRedirectPath` `?from=` guard | medium | mitigate | Task 3 — reject any backslash; browser-normalization bypass `/\evil.com` closed |
| T-EQS-04 | Denial of Service / Information Disclosure | `validateEmail`/`validatePassword` on non-string input | low | mitigate | Task 4 — `typeof` guards return a validation error instead of throwing a 500 with a stack-shaped response |
| T-EQS-05 | Information Disclosure | `requireAdmin()` masking a DB error as 403 | low | mitigate | Task 5 — error branch returns 500, matching sibling guards; a masked error could hide an ongoing attack from logs |
| T-EQS-06 | Denial of Service | unguarded `request.json()` on two routes | low | mitigate | Task 6 — try/catch + null normalization returning the project's standard 400 |
| T-EQS-07 | Elevation of Privilege | `profiles.role` UPDATE after insert | high | accept (already mitigated) | Closed by `20260804120200_add_must_change_password.sql` (`revoke update ... grant update (full_name, email)`); Task 1 verifies it is still in place and does not re-fix it |
</threat_model>

<verification>
After all six commits, from `C:/Users/mellu/Desktop/full_stack_final_project`:

1. `npx tsc --noEmit` — clean.
2. `npx eslint` — clean.
3. `npm run build` — succeeds.
4. `npx playwright test tests/e2e/profiles-rls-escalation.spec.ts tests/e2e/admin-doctor-link-account.spec.ts tests/e2e/auth-login.spec.ts tests/e2e/auth-signup.spec.ts tests/e2e/admin-route-protection.spec.ts tests/e2e/doctor-request.spec.ts --reporter=line` — all pass.
5. `git log --oneline -6` — six commits, one per task, each touching only its own task's files.

A full-suite run is optional and, if run, expect the recurring shared-dev-DB test-residue
failures already tracked in `.planning/WINDOWS.md` (ids 1/3/5/7/8/10/11/12). Attribute a failure
to this work only if it touches a file in `files_modified`.

Environment note: `npx supabase db push --linked` may be blocked by the sandbox classifier —
Phase 3 hit this with `npx supabase db query --linked`. If it is blocked, apply the migration
through the Supabase dashboard SQL editor, then prove application by running the Task 1 spec
(which fails loudly against the un-migrated policy), and record the manual step in the summary.
</verification>

<success_criteria>
- Six atomic commits, one per fix, in task order (critical first).
- `20260803230000_initial_schema.sql` unmodified; the fix ships as a new timestamped migration.
- The escalation spec proves `role='admin'` and `role='doctor'` self-inserts are rejected at
  SQLSTATE 42501 and `role='patient'` still succeeds.
- Every task's summary entry names the pre-existing Playwright coverage for that behaviour and
  states plainly whether a gap remained (Task 5's 500 branch is a knowingly untestable gap).
- No new dependency, no Zod, no Server Action, no unit-test framework.
</success_criteria>

<output>
Create `.planning/quick/260817-eqs-fix-critical-rls-privilege-escalation-ga/260817-eqs-SUMMARY.md` when done.
</output>
