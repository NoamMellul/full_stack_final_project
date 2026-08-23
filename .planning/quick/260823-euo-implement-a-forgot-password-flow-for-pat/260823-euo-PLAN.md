---
phase: quick-260823-euo
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - dictionaries/en.json
  - dictionaries/he.json
  - app/login/page.tsx
  - app/forgot-password/page.tsx
  - app/reset-password/page.tsx
  - tests/e2e/helpers/test-users.ts
  - tests/e2e/auth-password-reset.spec.ts
autonomous: true
requirements: [EUO-01, EUO-02, EUO-03, EUO-04]

user_setup:
  - service: supabase
    why: "Supabase only honors a password-recovery `redirect_to` that is on the project's Redirect URL allow-list. An un-allow-listed target is silently replaced with the Site URL, so the recovery tokens land on `/` instead of `/reset-password` and the whole flow dead-ends. The agent has no credential for the Supabase Management API in this repo, so this is a human-only dashboard action."
    env_vars: []
    dashboard_config:
      - task: "Add `http://localhost:3000/reset-password` to Redirect URLs (dev). Add the deployed `https://<prod-domain>/reset-password` too, once the Vercel domain exists."
        location: "Supabase Dashboard -> Authentication -> URL Configuration -> Redirect URLs"

estimate:
  tokens: 58000
  raw_tokens: 58000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "A visitor on /login sees a visible 'Forgot password?' link that navigates to /forgot-password."
    - "Submitting ANY email on /forgot-password renders one neutral confirmation — identical whether the account exists, does not exist, or Supabase returned an error. The page is never a user-enumeration oracle."
    - "Following a real Supabase recovery link lands the browser on /reset-password with the new-password form rendered and ready."
    - "Saving a new password there updates the Supabase Auth password and lands the user on their own role home (/patient, /doctor or /admin) via the existing root router."
    - "After the reset, the OLD password is rejected by POST /api/auth/login and the NEW password logs the user in."
    - "Visiting /reset-password with no valid recovery session shows an expired/invalid-link state with a route back to /forgot-password, and renders no password field at all."
    - "Both new pages render fully in Hebrew under dir=rtl, with no physical-direction Tailwind utilities anywhere in either file."
    - "No database migration is added and no new npm package is installed."
  artifacts:
    - "app/forgot-password/page.tsx — Client Component; email field + neutral confirmation state"
    - "app/reset-password/page.tsx — Client Component; verifying / ready / invalid-link tri-state + new-password form"
    - "app/login/page.tsx — one new Link to /forgot-password"
    - "dictionaries/en.json + dictionaries/he.json — 21 new keys (auth.login.forgot_password_link, auth.forgot_password.*, auth.reset_password.*) present in BOTH files"
    - "tests/e2e/helpers/test-users.ts — generateRecoveryLink() helper built on testAdminClient()"
    - "tests/e2e/auth-password-reset.spec.ts — request-reset + complete-reset + invalid-link + RTL coverage"
  key_links:
    - "lib/supabase/client.ts createBrowserClient <- verified to carry NO auth overrides, so @supabase/ssr's own defaults apply: `flowType: 'pkce'` (hardcoded, node_modules/@supabase/ssr/dist/main/createBrowserClient.js:40) and `detectSessionInUrl: isBrowser()` -> true (:42). /reset-password's session recovery depends entirely on these two defaults staying untouched."
    - "supabase.auth.getSession() awaits the client's internal initializePromise, which is what performs the URL detection. This single await is the ONLY session-recovery mechanism on /reset-password — no onAuthStateChange listener, so there is no listener-attach race to lose."
    - "@supabase/ssr stores the recovered session in COOKIES (not localStorage). That is precisely why the existing cookie-bound POST /api/auth/change-password can see the recovery session server-side and why no new route handler is needed."
    - "POST /api/auth/change-password (existing, MUST NOT be modified) — validates server-side, calls supabase.auth.updateUser({password}), and clears profiles.must_change_password. That last effect is exactly right for a doctor who forgot an admin-issued temp password."
    - "app/page.tsx (root router, quick 260816-etv) <- the reset page's success redirect target. Pushing '/' lets the existing server-side role lookup pick /patient, /doctor or /admin; the reset page never needs to know the role itself."
    - "Supabase Redirect URL allow-list <- gates BOTH the real emailed link and the test-only generateLink() action_link. Not allow-listed = flow silently redirects to Site URL. See user_setup."
    - "dictionaries/he.json is typed as Record<TranslationKey, string> (lib/i18n/dictionaries.ts:24) — a key added to en.json without a he.json twin is a `npx tsc --noEmit` FAILURE, not a runtime blank."
---

<objective>
Add a self-service password reset flow for all three roles (patient / doctor / admin) on top of Supabase Auth's built-in recovery, with bilingual copy and end-to-end Playwright proof.

Purpose: today a user who forgets their password has no recovery path at all — a patient is locked out permanently and a doctor has to ask an admin to re-issue a temporary password. Supabase Auth + the already-configured Resend SMTP give the whole mechanism for free; this task is purely the two pages, the link, the copy, and the proof.
Output: two new pages (/forgot-password, /reset-password), one link on /login, 21 new dictionary keys in both languages, one test helper, one new Playwright spec. Zero migrations, zero new packages, zero changes to any existing route handler.
</objective>

<execution_context>
@C:/Users/mellu/Desktop/full_stack_final_project/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/mellu/Desktop/full_stack_final_project/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/CLAUDE.md

@app/login/page.tsx
@app/doctor/change-password/page.tsx
@app/api/auth/change-password/route.ts
@lib/supabase/client.ts
@lib/validation/auth.ts
@lib/i18n/validation-messages.ts
@tests/e2e/auth-login.spec.ts
@tests/e2e/helpers/test-users.ts
</context>

<copy_contract>
Author these 21 keys, verbatim, in BOTH `dictionaries/en.json` and `dictionaries/he.json`. Flat dot-namespaced `surface.element[.variant]` convention, locked by plan 06-05. Insert them in the existing `auth.*` alphabetical block so the diff stays readable.

| Key | en.json | he.json |
|-----|---------|---------|
| `auth.login.forgot_password_link` | `Forgot password?` | `שכחתם סיסמה?` |
| `auth.forgot_password.title` | `Reset your password` | `איפוס סיסמה` |
| `auth.forgot_password.description` | `Enter the email address on your account and we'll send you a link to set a new password.` | `הזינו את כתובת האימייל של החשבון שלכם ונשלח לכם קישור להגדרת סיסמה חדשה.` |
| `auth.forgot_password.email_label` | `Email` | `אימייל` |
| `auth.forgot_password.submit` | `Send reset link` | `שליחת קישור לאיפוס` |
| `auth.forgot_password.submitting` | `Sending…` | `שולח…` |
| `auth.forgot_password.sent_title` | `Check your inbox` | `בדקו את תיבת הדואר` |
| `auth.forgot_password.sent_message` | `If an account exists for that address, a password reset link is on its way. The link is valid for a limited time and can be used once.` | `אם קיים חשבון עבור הכתובת הזו, קישור לאיפוס הסיסמה נשלח אליה. הקישור תקף לזמן מוגבל ומיועד לשימוש חד-פעמי.` |
| `auth.forgot_password.back_to_login` | `Back to log in` | `חזרה להתחברות` |
| `auth.reset_password.title` | `Choose a new password` | `בחירת סיסמה חדשה` |
| `auth.reset_password.description` | `Enter a new password for your account. You'll be signed in once it's saved.` | `הזינו סיסמה חדשה לחשבון שלכם. לאחר השמירה תועברו לאזור האישי.` |
| `auth.reset_password.new_password_label` | `New password` | `סיסמה חדשה` |
| `auth.reset_password.confirm_password_label` | `Confirm new password` | `אימות סיסמה חדשה` |
| `auth.reset_password.submit` | `Save new password` | `שמירת הסיסמה החדשה` |
| `auth.reset_password.submitting` | `Saving…` | `שומר…` |
| `auth.reset_password.mismatch_error` | `Passwords do not match.` | `הסיסמאות אינן תואמות.` |
| `auth.reset_password.generic_error` | `Could not update password. Please try again.` | `לא ניתן היה לעדכן את הסיסמה. נסו שוב.` |
| `auth.reset_password.verifying` | `Checking your reset link…` | `בודק את קישור האיפוס…` |
| `auth.reset_password.invalid_link_title` | `This reset link is no longer valid` | `קישור האיפוס אינו תקף עוד` |
| `auth.reset_password.invalid_link_message` | `Password reset links expire and can only be used once. Request a new one to continue.` | `קישורי איפוס סיסמה פגים ומיועדים לשימוש חד-פעמי. בקשו קישור חדש כדי להמשיך.` |
| `auth.reset_password.request_new_link` | `Request a new link` | `בקשת קישור חדש` |

`auth.reset_password.title` is deliberately worded differently from the existing `auth.change_password.title` ("Set a new password") in both languages, so a Playwright heading locator can never match the wrong page.
</copy_contract>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: End-to-end "I forgot my password and set a new one" — the single happy path, wired through every layer</name>

  <read_first>
    app/login/page.tsx (form/error/Link idiom, Suspense wrapper),
    app/doctor/change-password/page.tsx (two-password-field form idiom, closest analog),
    app/api/auth/change-password/route.ts (the existing route this flow reuses unmodified),
    lib/supabase/client.ts, lib/validation/auth.ts, lib/i18n/validation-messages.ts,
    tests/e2e/helpers/test-users.ts, tests/e2e/auth-login.spec.ts
  </read_first>

  <precondition>
    `http://localhost:3000/reset-password` is present in Supabase Dashboard -> Authentication -> URL Configuration -> Redirect URLs. Assert it by generating a recovery link and following it: if the browser ends up on `/reset-password`, the precondition holds; if it ends up on `/` or `/login`, it does NOT — halt and tell the human to add the URL (see `user_setup`), because every remaining verify in this plan is unprovable without it.
  </precondition>

  <files>dictionaries/en.json, dictionaries/he.json, app/login/page.tsx, app/forgot-password/page.tsx, app/reset-password/page.tsx, tests/e2e/helpers/test-users.ts, tests/e2e/auth-password-reset.spec.ts</files>

  <behavior>
    - Given a registered patient, when a Supabase recovery link for their address is followed, then /reset-password renders the new-password form.
    - When a valid new password is saved there, then the browser ends on /patient.
    - After that, POST /api/auth/login with the OLD password returns 401, and the NEW password logs the user in through the /login form.
  </behavior>

  <action>
    Author ALL 21 keys from `<copy_contract>` in both dictionaries first (EUO-03) — not a subset. `dictionaries/he.json` is typed `Record<TranslationKey, string>`, so a missing Hebrew twin fails `tsc`, and both later tasks read these keys rather than inventing copy.

    Add the /login link (EUO-01): in `app/login/page.tsx`'s `LoginForm`, insert a new centered `<p className="text-center text-sm">` inside the `<form>` immediately BEFORE the existing "no account" paragraph, holding a `next/link` `<Link href="/forgot-password">` whose text is `t("auth.login.forgot_password_link")` and whose className copies the existing signup Link exactly (`text-primary underline-offset-4 hover:underline`). Change nothing else in this file — the submit handler, the generic-error literal and the Suspense wrapper are all load-bearing for existing specs (T-01-08 / T-06-37).

    Create `app/forgot-password/page.tsx` (EUO-01) as a `"use client"` default-export page structurally modeled on `app/login/page.tsx`: same `<main className="flex flex-1 items-center justify-center ps-4 pe-4">` shell, same `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent` composition, same `useT()` import from `@/lib/i18n/locale-provider`. It needs NO `useSearchParams`, therefore NO `Suspense` wrapper. State: `email`, `emailError`, `isSubmitting`, and `hasSubmitted`. On submit, validate with `validateEmail` from `@/lib/validation/auth` and render the failure through `translateValidationMessage(error, t)` at the render boundary exactly as login does — store the untranslated literal in state, translate only where it renders. On a valid email, build the browser client with `createClient()` from `@/lib/supabase/client` and await `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" })`. Note the option name is `redirectTo`, NOT `emailRedirectTo` — `emailRedirectTo` belongs to `signUp`/`signInWithOtp` and is silently ignored here, which would send the user to the Site URL instead. The path segment is a hardcoded string literal concatenated onto `window.location.origin`; it must never be read from a query param or any other request-controlled input (T-EUO-03). Then set `hasSubmitted` true. Deliberately DISCARD the `{ error }` this call returns without branching on it and without rendering any error Alert: an unknown address, a rate-limited address and a healthy send must all produce the byte-identical outcome, or the page becomes a user-enumeration oracle (T-EUO-01) — write that reasoning as a comment above the discard so a future reader does not "fix" it. When `hasSubmitted` is true, replace the form entirely with a confirmation panel showing `auth.forgot_password.sent_title` as the CardTitle and `auth.forgot_password.sent_message` as body text, plus a `<Link href="/login">` carrying `auth.forgot_password.back_to_login`.

    Create `app/reset-password/page.tsx` (EUO-02) as a `"use client"` default-export page with a three-value `status` state: `verifying` | `ready` | `invalid`. In a `useEffect(..., [])`, guard re-entry with a `useRef` boolean flag set on first run (mirroring the `hasInteractedRef` idiom in `components/favorite-toggle.tsx`) so React Strict Mode's double-invoked effect cannot construct two browser clients that race to consume the same one-time PKCE code. Inside that guard call `createClient()` ONCE and `await supabase.auth.getSession()`; set status `ready` when `data.session` is non-null, `invalid` otherwise. That single await is sufficient and race-free: `getSession()` awaits the client's internal `initializePromise`, and that promise is what performs the URL detection, so the recovery session is already resolved by the time it returns. Do not add an `onAuthStateChange` listener — a listener attached after construction can miss the event that already fired. Both link shapes are covered by this one mechanism: a real emailed link arrives as a PKCE `?code=` (the browser client is `flowType: 'pkce'`, hardcoded by @supabase/ssr) and an admin-generated link arrives as an implicit `#access_token=` hash, and `detectSessionInUrl` (defaulted true by @supabase/ssr for browsers, and NOT overridden in `lib/supabase/client.ts` — verified) handles both. Render `auth.reset_password.verifying` while `verifying`; render the `invalid_link_title` / `invalid_link_message` pair plus a `<Link href="/forgot-password">` carrying `request_new_link` while `invalid`, and render no password input at all in that branch. While `ready`, render the two-password-field form copied structurally from `app/doctor/change-password/page.tsx`: `password` + `confirmPassword` inputs with `type="password"`, `validatePassword` for the first, a `password !== confirmPassword` check yielding `t("auth.reset_password.mismatch_error")` for the second, `aria-invalid` on failure and the `<p className="text-sm font-normal text-destructive">` error paragraph. On a clean submit, POST `{ password, confirmPassword }` as JSON to the EXISTING `/api/auth/change-password` route — do not create a new route handler and do not modify that one. It works here because @supabase/ssr persists the recovered session in cookies, so its cookie-bound `getUser()` sees the recovery session; it also clears `profiles.must_change_password`, which is the correct outcome for a doctor who forgot an admin-issued temp password. On a non-ok response set the API error to `data.error ?? t("auth.reset_password.generic_error")`, wrap the fetch in try/catch falling back to the same key, and render it through the same `Alert`/`AlertDescription variant="destructive"` block login uses. On success `router.push("/")` then `router.refresh()` — the root router (`app/page.tsx`) resolves the role server-side and forwards to /patient, /doctor or /admin, so this page never needs to know the role. Use only logical Tailwind utilities in both new files (`ps-`/`pe-`/`ms-`/`me-`/`start-`/`end-`/`text-center`/`text-start`/`text-end`); no `pl-`, `pr-`, `ml-`, `mr-`, `left-`, `right-`, `text-left` or `text-right` anywhere, per the convention plan 06-10 verified holds repo-wide. No `dangerouslySetInnerHTML` in either file.

    Add `generateRecoveryLink(email: string, redirectTo: string): Promise<string>` to `tests/e2e/helpers/test-users.ts` (EUO-04): build `testAdminClient()`, call `admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo } })`, throw a descriptive Error on `error` or a missing `data.properties.action_link`, and return that `action_link`. Route privileged access exclusively through `testAdminClient()` — never read `SUPABASE_SERVICE_ROLE_KEY` directly, per the helper convention locked by plan 06-01.

    Create `tests/e2e/auth-password-reset.spec.ts` with ONE test for now, the full happy path: create a patient with `createTestUser("patient")`; `generateRecoveryLink(user.email, "http://localhost:3000/reset-password")`; `page.goto(actionLink)`; `page.waitForURL(/\/reset-password/)`; assert the `auth.reset_password.title` heading is visible (this is also the precondition assertion — landing anywhere else means the URL is not allow-listed); fill both password fields with a new password distinct from `TEST_PASSWORD`; submit; `page.waitForURL("/patient")`. Then `context.clearCookies()`, assert `page.request.post("/api/auth/login", { data: { email: user.email, password: TEST_PASSWORD } })` returns 401, and finally log in through the /login form with the new password and `waitForURL("/patient")`. Add an `afterAll` calling `cleanupTestUsers()`, matching `auth-login.spec.ts`.
  </action>

  <verify>
    <automated>cd C:/Users/mellu/Desktop/full_stack_final_project && node -e "const en=require('./dictionaries/en.json'),he=require('./dictionaries/he.json');const m=Object.keys(en).filter(k=>!(k in he));if(m.length){console.error('missing he keys',m);process.exit(1)};console.log('parity ok',Object.keys(en).length)" && npx tsc --noEmit && npx playwright test tests/e2e/auth-password-reset.spec.ts --reporter=list</automated>
  </verify>

  <done>Dictionary parity holds and `tsc` is clean. The single end-to-end test passes: a real Supabase recovery link lands on /reset-password, the new password saves, the browser reaches /patient, the old password is rejected with 401, and the new password logs the user back in.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Prove the non-happy paths — invalid link, client-side validation, and the non-enumeration guarantee</name>

  <read_first>
    app/forgot-password/page.tsx and app/reset-password/page.tsx (as Task 1 left them),
    tests/e2e/auth-login.spec.ts (the "makes no network call" and byte-identical-message idioms)
  </read_first>

  <files>tests/e2e/auth-password-reset.spec.ts, app/forgot-password/page.tsx, app/reset-password/page.tsx</files>

  <behavior>
    - Visiting /reset-password logged out with no token renders the invalid-link state and zero password inputs.
    - Submitting a blank/malformed email on /forgot-password shows the inline validation message and fires no Supabase request.
    - A stubbed Supabase 429 and a stubbed Supabase 200 both render the identical confirmation text, with no error banner in either case.
    - On /reset-password, a too-short password and a mismatched confirmation each block the submit with an inline message and fire no request to /api/auth/change-password.
  </behavior>

  <action>
    Extend `tests/e2e/auth-password-reset.spec.ts` — do not create a second spec file.

    Invalid-link case: `page.goto("/reset-password")` in a fresh (logged-out) context; assert the `auth.reset_password.invalid_link_title` text is visible, assert `page.locator('input[type="password"]')` has count 0, and assert the `auth.reset_password.request_new_link` link navigates to /forgot-password.

    Client-validation case on /forgot-password: install a request interceptor BEFORE navigating and record whether it fired, then submit an empty form. Use a REGEX matcher — `page.route(/\/auth\/v1\/recover/, ...)`, never a glob string: Playwright's glob dialect treats `?` as a single-character wildcard, which silently broke two admin route stubs in quick 260817-lar the moment a query string appeared. Assert the `Email is required.` inline message is visible and that the interceptor never fired.

    Non-enumeration cases (T-EUO-01): two tests that both stub the recover endpoint with the same regex matcher — one fulfilling `{ status: 200, contentType: "application/json", body: "{}" }`, the other fulfilling a 429 with a JSON error body. Both submit a syntactically valid address and both must assert the exact same thing: `auth.forgot_password.sent_title` and `auth.forgot_password.sent_message` are visible, and `page.getByRole("alert")` has count 0. Import the strings from `dictionaries/en.json` rather than retyping them, so the assertion tracks the copy contract. If the 429 case fails, fix the PAGE (the error object must be discarded, not branched on), not the test.

    Reset-form validation cases: generate a fresh recovery link with `generateRecoveryLink` (each link is one-time, so this test needs its own user and its own link — do not try to reuse Task 1's), land on /reset-password, install a counting interceptor on `/api/auth/change-password`, then (a) submit a 3-character password in both fields and assert the translated too-short message is visible, and (b) submit a valid password with a differing confirmation and assert `auth.reset_password.mismatch_error` is visible. Assert the interceptor never fired in either case. Reuse the same page/session for both sub-cases so only one recovery link is consumed.

    Touch `app/forgot-password/page.tsx` / `app/reset-password/page.tsx` ONLY if one of these tests exposes a real defect; if both files pass unchanged, say so explicitly in the summary rather than editing them to look busy.
  </action>

  <verify>
    <automated>cd C:/Users/mellu/Desktop/full_stack_final_project && npx playwright test tests/e2e/auth-password-reset.spec.ts --reporter=list</automated>
  </verify>

  <done>Every test in auth-password-reset.spec.ts passes, including the invalid-link state, both client-validation short-circuits, and both non-enumeration cases (200 and 429 producing byte-identical rendered output with no alert).</done>
</task>

<task type="auto">
  <name>Task 3: Bilingual + RTL proof, request-payload assertions, and full regression sweep</name>

  <read_first>
    tests/e2e/locale-switching.spec.ts (the `heDict` import + `locale` cookie idiom),
    dictionaries/he.json
  </read_first>

  <files>tests/e2e/auth-password-reset.spec.ts</files>

  <action>
    Finish the spec (EUO-03, EUO-04).

    Link-discoverability test: `page.goto("/login")`, click the `auth.login.forgot_password_link` link by role, assert the URL is /forgot-password and the `auth.forgot_password.title` heading is visible.

    Request-payload test: stub the recover endpoint with the same regex matcher used in Task 2, capture `route.request().postDataJSON()` and `route.request().url()`, fulfill 200, and assert the captured body's `email` equals the submitted address and that `decodeURIComponent(capturedUrl)` contains `http://localhost:3000/reset-password`. supabase-js sends `redirectTo` as a `redirect_to` query parameter on the recover request, not in the JSON body — assert against the URL, not the body. This is the mechanical proof that T-EUO-03's hardcoded same-origin target actually reaches Supabase.

    RTL/Hebrew tests: import the Hebrew dictionary as `heDict from "../../dictionaries/he.json"` and set the locale with `context.addCookies([{ name: "locale", value: "he", url: "http://localhost:3000" }])`, copying `tests/e2e/locale-switching.spec.ts` exactly. Two cases: (a) /forgot-password renders `heDict["auth.forgot_password.title"]` and `html` carries `dir="rtl"`; (b) /reset-password with no token renders `heDict["auth.reset_password.invalid_link_title"]` under `dir="rtl"`. Index the dictionary rather than pasting Hebrew literals into the spec.

    Then run the regression sweep and record the result in the summary. Scope it to the auth and i18n surfaces this task can plausibly have disturbed: `auth-login`, `auth-signup`, `auth-logout`, `auth-doctor-login`, `auth-session-persistence`, `auth-password-reset`, `locale-switching`, `site-nav`, `root-route-router`. Any failure in that set is this plan's to explain, since /login and both dictionaries were modified. If a failure matches the long-tracked shared-dev-DB residue / Supabase-rate-limit class already logged a dozen times in STATE.md, re-run that spec file in isolation before attributing it there — an isolated pass is the evidence required, not the assumption.

    In the SUMMARY.md, surface a clearly headed human checklist item stating that `http://localhost:3000/reset-password` must be present in Supabase Dashboard -> Authentication -> URL Configuration -> Redirect URLs for dev, and that the production `https://<domain>/reset-password` must be added there before the deployed app's reset flow will work. The agent cannot perform this dashboard change. Also record in the summary that this plan added no migration and no npm dependency.
  </action>

  <verify>
    <automated>cd C:/Users/mellu/Desktop/full_stack_final_project && npx tsc --noEmit && npx eslint app components lib tests && npx playwright test tests/e2e/auth-password-reset.spec.ts tests/e2e/auth-login.spec.ts tests/e2e/auth-signup.spec.ts tests/e2e/auth-logout.spec.ts tests/e2e/auth-doctor-login.spec.ts tests/e2e/auth-session-persistence.spec.ts tests/e2e/locale-switching.spec.ts tests/e2e/site-nav.spec.ts tests/e2e/root-route-router.spec.ts --reporter=list</automated>
  </verify>

  <done>`tsc` and `eslint` are clean; every test in the auth + i18n regression set passes, or any failure is proven pre-existing by an isolated re-run and named as such. The SUMMARY.md carries the Supabase Redirect URL human checklist item.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| anonymous browser -> /forgot-password | An unauthenticated caller supplies an arbitrary email address and observes the response. |
| Supabase recovery email -> /reset-password | A one-time recovery token crosses back into the app through the URL, carrying the ability to set a password. |
| browser (recovery session) -> POST /api/auth/change-password | The password change is authorized purely by the cookie-borne recovery session. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-EUO-01 | Information disclosure | app/forgot-password/page.tsx | high | mitigate | The `{ error }` from `resetPasswordForEmail` is discarded without branching; unknown address, rate-limited address and healthy send all render the identical `auth.forgot_password.sent_*` panel with no alert. Task 2 asserts a stubbed 429 and a stubbed 200 produce byte-identical output. Preserves the same non-oracle stance as the login route (T-01-08 / T-06-37). |
| T-EUO-02 | Elevation of privilege | app/reset-password/page.tsx | critical | mitigate | The password form renders only after `getSession()` returns a real session, and the actual authorization boundary is server-side: `/api/auth/change-password` re-derives the user from `getUser()` on the cookie-bound client, so a client-side `status` flag forced to `ready` still cannot change anyone's password. Task 2 asserts the no-session visit renders zero password inputs. |
| T-EUO-03 | Tampering | app/forgot-password/page.tsx `redirectTo` | high | mitigate | `redirectTo` is `window.location.origin` concatenated with a hardcoded `/reset-password` literal — never a query param, never any request-controlled value — so a crafted `/forgot-password?next=evil` cannot divert the recovery token. Supabase's own Redirect URL allow-list is the independent second layer. Task 3 asserts the outbound `redirect_to` value mechanically. |
| T-EUO-04 | Spoofing | Supabase recovery token | medium | accept | Token single-use and expiry are enforced by the Supabase Auth platform, not by this app; a consumed or expired link degrades to the invalid-link state (asserted in Task 2). Residual risk is inbox compromise, which is out of scope for a demo project holding no medical data. |
| T-EUO-05 | Denial of service | Supabase `/auth/v1/recover` | low | transfer | Recovery-email flooding is rate-limited by Supabase Auth's own per-project limits; no application-layer throttle is added. Deliberately NOT surfaced in the UI, because a distinguishable rate-limit message would reintroduce T-EUO-01. |
| T-EUO-SC | Tampering | npm/pip/cargo installs | high | accept | Not applicable — this plan installs zero packages. No `## Package Legitimacy Audit` is required and no legitimacy checkpoint is inserted, because there is no install task to gate. |
</threat_model>

<verification>
- `node` dictionary-parity check: every key in `dictionaries/en.json` exists in `dictionaries/he.json`.
- `npx tsc --noEmit` clean (this is also the enforcement mechanism for Hebrew key completeness — `he.json` is typed `Record<TranslationKey, string>`).
- `npx eslint app components lib tests` clean.
- `npx playwright test tests/e2e/auth-password-reset.spec.ts` fully green.
- Auth + i18n regression set green (or any failure proven pre-existing by an isolated re-run).
- `git status` shows no file under `supabase/migrations/` and no change to `package.json` / `package-lock.json`.
- No change to any file under `app/api/` — the flow reuses `POST /api/auth/change-password` exactly as it stands.
</verification>

<success_criteria>
- A visitor on /login can reach /forgot-password from a visible link, request a reset, and see one neutral confirmation regardless of whether the address exists.
- A real Supabase recovery link lands on /reset-password with a working form; saving a new password updates the Supabase Auth password and forwards the user to their own role home.
- The old password is provably rejected (401) and the new one provably works, asserted end-to-end in Playwright.
- /reset-password without a valid recovery session shows the expired-link state and renders no password field.
- Both pages read correctly in Hebrew under `dir="rtl"`, using only logical Tailwind utilities.
- Zero migrations, zero new npm packages, zero modified route handlers.
</success_criteria>

<output>
Create `.planning/quick/260823-euo-implement-a-forgot-password-flow-for-pat/260823-euo-SUMMARY.md` when done.

The summary MUST include a clearly headed human action item:

**Human action required — Supabase Dashboard (agent cannot do this):**
Add `http://localhost:3000/reset-password` to **Authentication -> URL Configuration -> Redirect URLs**, and add `https://<production-domain>/reset-password` there as well before/after the Vercel deployment. Without the entry, Supabase silently replaces the recovery link's `redirect_to` with the project Site URL and the reset flow dead-ends on `/`.
</output>
