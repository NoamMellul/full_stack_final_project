---
phase: quick-260816-etv
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/auth/role-home.ts
  - app/page.tsx
  - app/login/page.tsx
  - tests/e2e/root-route-router.spec.ts
  - tests/e2e/route-protection-unauthenticated.spec.ts
  - tests/e2e/route-protection-role-mismatch.spec.ts
  - tests/e2e/auth-logout.spec.ts
  - tests/e2e/auth-doctor-login.spec.ts
  - tests/e2e/admin-route-protection.spec.ts
  - tests/e2e/admin-doctor-link-account.spec.ts
  - dictionaries/en.json
  - dictionaries/he.json
autonomous: true
requirements: [QUICK-260816-etv]

estimate:
  tokens: 70000
  raw_tokens: 70000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "An anonymous visitor navigating to `/` lands on `/login` instead of the create-next-app scaffold."
    - "A signed-in patient navigating to `/` lands on `/patient`; a doctor lands on `/doctor`; an admin lands on `/admin`."
    - "A signed-in user whose profiles row is missing or carries an unrecognized role lands on `/login` — never a blank page, and never a redirect loop."
    - "Clicking the MedRDV logo in the header takes an authenticated user to their own dashboard and an anonymous visitor to `/login`, with zero edits to components/site-header.tsx."
    - "A role-mismatch bounce (the `redirect(\"/\")` in each of the three role layouts) now terminates on the visitor's OWN role home instead of dead-ending on the scaffold."
    - "Exactly one ROLE_HOME definition exists across app/, lib/ and components/."
    - "Every Playwright assertion in tests/e2e/ that previously expected a navigation to settle on `/` has been rewritten to its new terminus; no spec still waits for the root URL."
    - "The ten now-dead `home.*` dictionary entries are gone from BOTH dictionaries, and the two dictionaries still carry an identical key set."
    - "The full Playwright suite shows no failure attributable to this change beyond the shared-dev-DB residue class already tracked in .planning/WINDOWS.md."
  artifacts:
    - lib/auth/role-home.ts
    - app/page.tsx
    - tests/e2e/root-route-router.spec.ts
  key_links:
    - "app/page.tsx's `redirect(ROLE_HOME[...])` -> the destination role layout's own getUser()+profiles.role guard, which re-runs on arrival. Both sides derive role from the same read, so they cannot disagree — but if they ever could, the result is an infinite `/` <-> `/{role}` ping-pong, which is why the unknown-role branch must fail closed to /login."
    - "The three role layouts' `redirect(\"/\")` on role mismatch (app/patient/layout.tsx:22, app/doctor/layout.tsx:22, app/admin/layout.tsx:23) -> `/`'s new redirect. This forms a deliberate two-hop chain and is what invalidates the role-mismatch assertions in three spec files."
    - "components/logout-button.tsx:29's `router.push(\"/\")` -> `/`'s anonymous branch -> /login. This is the breakage NOT flagged in the task brief: it invalidates four assertions in auth-logout.spec.ts and one in admin-doctor-link-account.spec.ts."
    - "app/login/page.tsx:74's `ROLE_HOME[data.role] ?? \"/\"` -> the new shared module. The `\"/\"` fallback is left as-is and is now itself auth-aware, so an unrecognized role from the login API lands on /login rather than the scaffold."
    - "lib/i18n/dictionaries.ts:26's `he as Record<TranslationKey, string>` is a CAST, not a checked assignment — an asymmetric dictionary edit does NOT produce a tsc error in either direction. Dictionary symmetry must be gated by a real key-set comparison, never by `npx tsc --noEmit`."
---

<objective>
Replace `app/page.tsx` — still the untouched create-next-app scaffold — with a pure async Server Component
that routes every visitor to where they actually belong: anonymous visitors to `/login`, authenticated
visitors to their role home. Extract the role→home map into a shared `lib/auth/role-home.ts` and delete the
duplicate that currently lives inside `app/login/page.tsx`.

Purpose: `/` is the only URL a user types by hand, and today it dead-ends on Next.js boilerplate. It is also
where all three role layouts already bounce a role-mismatched visitor, so fixing it simultaneously turns a
dead end into a correct second hop. The header logo (`href="/"`) starts working as a real "home" control for
free, with no edit to `components/site-header.tsx`.

Output: one new 5-line module, one rewritten page, one deleted duplicate, one new Playwright spec pinning all
four routing outcomes, the mechanical realignment of six existing spec files whose `/`-terminus assertions
this change invalidates, and removal of the ten dictionary keys the deleted scaffold was the sole consumer of.
</objective>

<execution_context>
@C:/Users/mellu/Desktop/full_stack_final_project/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/mellu/Desktop/full_stack_final_project/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/CLAUDE.md

@app/page.tsx
@app/login/page.tsx
@app/patient/layout.tsx
@lib/supabase/server.ts
@tests/e2e/helpers/test-users.ts
@tests/e2e/route-protection-unauthenticated.spec.ts
@tests/e2e/route-protection-role-mismatch.spec.ts

# Reference only — read the cited lines, not the whole file:
# - app/doctor/layout.tsx:22 and app/admin/layout.tsx:23 (structurally identical to the patient layout)
# - components/logout-button.tsx:29 (the router.push("/") that makes auth-logout.spec.ts a casualty)
# - components/site-header.tsx:28 (the href="/" logo — deliberately NOT edited)
# - lib/i18n/dictionaries.ts:20-27 (why tsc will not catch an asymmetric dictionary edit)
</context>

<critical_context>

## The approved design (already decided by the user — implement, do not re-derive)

`app/page.tsx` becomes an async Server Component mirroring the exact shape of `app/patient/layout.tsx`:
`createClient()` from `@/lib/supabase/server`, `supabase.auth.getUser()`, `redirect("/login")` when there is
no user, otherwise a single-row `profiles` select of `role` keyed on `user.id`, then
`redirect(ROLE_HOME[profile?.role ?? ""] ?? "/login")`. The new `lib/auth/role-home.ts` exports
`ROLE_HOME: Record<string, string>` mapping `patient`/`doctor`/`admin` to `/patient`/`/doctor`/`/admin`.
`app/login/page.tsx` imports that constant and deletes its local copy (currently lines 22-26); its usage site
at line 74 keeps its existing `?? "/"` fallback verbatim — no behavioral change there.

`components/site-header.tsx` is NOT edited. `next.svg` / `vercel.svg` in `public/` are explicitly out of scope.
Fix 3 (nav bar) and Fix 4 (doctor request form) from the source plan are separate quick tasks — do not touch them.

## Exhaustive blast-radius survey (already performed — verify these, do not re-derive)

The task brief names two affected spec files. A repo-wide grep for navigations that settle on the root URL
found **six**. The four unlisted ones break because `components/logout-button.tsx:29` does `router.push("/")`
and the three role layouts do `redirect("/")` — both of which now chain one hop further.

The exhaustive set of in-app navigations targeting `/` is: `components/logout-button.tsx:29` (`router.push`),
`app/patient/layout.tsx:22` + `app/doctor/layout.tsx:22` + `app/admin/layout.tsx:23` (`redirect`), and
`components/site-header.tsx:28` (`href`). There are no others.

**Six spec files carry assertions this invalidates:**

| File | Sites | Old terminus | New terminus |
|------|-------|--------------|--------------|
| `route-protection-unauthenticated.spec.ts` | 37-40 | anon at `/` stays on `/` | `/login`, with NO `from` param |
| `route-protection-role-mismatch.spec.ts` | 62-64, 82-83 | mismatch lands on `/` | the **visitor's own** `/${role}` |
| `auth-logout.spec.ts` | 22-23, 38, 61, 116 | logout lands on `/` | `/login` |
| `auth-doctor-login.spec.ts` | 36-37 | doctor at `/patient` lands on `/` | `/doctor` |
| `admin-route-protection.spec.ts` | 209-210, 217-218 | patient/doctor at an admin page land on `/` | `/patient` / `/doctor` |
| `admin-doctor-link-account.spec.ts` | 144 | logout lands on `/` | `/login` |

**Two further spec files touch `/` but are predicted to still pass — confirm empirically, do not assume:**
- `schema-connectivity.spec.ts:60-63` — `page.goto("/")` asserting `status() < 400`. Playwright returns the
  *final* response of a redirect chain, so this becomes `/login`'s 200. Predicted PASS.
- `locale-switching.spec.ts:82-89` — `page.goto("/")` then asserts both language-switcher buttons are
  visible. The switcher lives in `components/site-header.tsx`, mounted once in the root layout, so it renders
  on `/login` identically. Predicted PASS.

If either prediction is wrong, fixing it belongs to this task — it is a direct consequence, not scope creep.

## Why `waitForURL` on the old terminus hard-fails rather than flaking

`redirect()` in a Server Component resolves before the URL commits: for a hard `page.goto` the browser follows
the 307 chain and only ever commits the final URL, and for a client-side `router.push` the App Router resolves
the RSC redirect before updating the address bar. The root URL is therefore **never** observed at any point.
Every stale `waitForURL` on it will burn the full 30s timeout and fail — none of them will pass by accident.

The corollary is a strong invariant worth gating on: after this change, **no** spec in `tests/e2e/` should ever
legitimately wait for or assert the bare root URL, because `/` no longer renders anything for anybody.

## Dictionary dead keys — and why tsc cannot police this

`app/page.tsx` is the ONLY consumer of all ten `home.*` keys (grep-verified across `.ts`/`.tsx`; the sole other
hits are historical `.planning/` documents). Deleting the scaffold makes every one of them dead. They sit as a
contiguous ten-line block at lines 106-115 of BOTH `dictionaries/en.json` and `dictionaries/he.json`, in
identical order, mid-object — so removal is a clean ten-line deletion in each with no trailing-comma hazard.

`lib/i18n/dictionaries.ts:26` types the Hebrew dictionary as `he as Record<TranslationKey, string>`. That is a
**cast**, not a checked assignment: TypeScript permits it in both directions of divergence. An asymmetric edit
(removing from one file only) will therefore compile cleanly and silently. Symmetry must be gated by a real
key-set comparison — `npx tsc --noEmit` proves nothing here.

## Loop safety

`/login` is a Client Component that renders its form unconditionally and never redirects, even with a live
session. So the unknown-role branch (`/` → `/login`) terminates. The role branch terminates because `/` and the
destination layout derive `role` from the same `getUser()` + `profiles` read and cannot disagree for a given
session. Task 1 pins the unknown-role case with a real test rather than leaving it to this reasoning.

</critical_context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: End-to-end — `/` routes anonymous, patient, doctor, admin and unknown-role visitors to the right place</name>
  <files>tests/e2e/root-route-router.spec.ts, lib/auth/role-home.ts, app/page.tsx, app/login/page.tsx</files>

  <precondition>The Playwright environment can reach the linked Supabase project and `testAdminClient()` resolves a service-role key — `createTestUser()` in this spec creates real auth users, exactly as every existing role-based spec does.</precondition>

  <behavior>
    New spec `tests/e2e/root-route-router.spec.ts`, one describe block, using `createTestUser` /
    `cleanupTestUsers` from `./helpers/test-users` (a `beforeAll` creating one patient, one doctor and one
    admin; an `afterAll` calling `cleanupTestUsers`). Reuse the login idiom already used verbatim in
    `route-protection-role-mismatch.spec.ts:50-54`: goto `/login`, fill the Email and Password labels, click
    the `Log in` button, then wait for the role home.

    - Test 1 — anonymous: with no session, `page.goto("/")`. Expect the settled pathname to be `/login`, and
      expect the `from` search param to be absent. That absence is the deliberate contract difference between
      this page-level redirect and `lib/supabase/proxy.ts`'s prefix gate, which DOES attach `from` — pin it so
      a future change cannot quietly converge the two.

    - Tests 2-4 — one per role, driven by a `["patient", "doctor", "admin"]` loop: log in, then a hard
      `page.goto("/")`. Expect the settled URL to be `/${role}`. Additionally assert the destination actually
      rendered — `My dashboard` for patient and doctor, `Admin dashboard` for admin — reusing the same body-copy
      map idiom as `route-protection-role-mismatch.spec.ts:14-18`, so the test proves arrival at a live page
      rather than merely a URL that could itself be mid-redirect.

    - Test 5 — authenticated, unrecognized role: create a user via `createTestUser("patient")`, log in, then
      use `testAdminClient()` to update that user's `profiles.role` to a value outside the map (e.g.
      `nurse`). Hard-`goto("/")`. Expect the settled pathname to be `/login` and, critically, expect it to
      settle at all — this is the loop-safety proof for the `?? "/login"` fallback. Give this test a generous
      explicit timeout so a genuine loop surfaces as a timeout failure rather than a hung worker.

    RED is mandatory and must be observed before any production file is touched. Pre-fix, Test 1 fails
    (the scaffold renders and the pathname stays at the root) and Tests 2-5 fail the same way. Record the
    actual observed failure output in the SUMMARY.
  </behavior>

  <action>
    Write the spec FIRST and run it against the untouched scaffold. Confirm it fails and capture the real
    output. Do not touch a production file until RED is observed and recorded.

    Then create `lib/auth/role-home.ts`: a single named export `ROLE_HOME` typed `Record<string, string>`
    mapping the three role strings to their route prefixes. No default export, no helper function, no
    `server-only` import — `app/login/page.tsx` is a Client Component and must be able to import it.

    Then replace the entire body of `app/page.tsx` with the async Server Component described in
    `<critical_context>`. It renders nothing and returns nothing on every path: each branch ends in a
    `redirect()` call. Import `createClient` from `@/lib/supabase/server` and `redirect` from
    `next/navigation`, matching `app/patient/layout.tsx`'s import order. Drop the now-unused `next/image` and
    `@/lib/i18n/server` imports entirely. Do not add a `dynamic` export — reading cookies through
    `createClient()` already forces dynamic rendering, exactly as it does in the three role layouts.

    Add a short comment above the final redirect explaining that the fallback is deliberately `/login` rather
    than any dashboard: an authenticated session with no profile row or an unrecognized role has no home to go
    to, and `/login` is the only route guaranteed to render without redirecting, so it is the one destination
    that cannot start a loop.

    Then edit `app/login/page.tsx`: add the import of the shared constant alongside the existing `@/lib/...`
    imports (keeping that group's alphabetical ordering) and delete the local object literal at lines 22-26.
    Change NOTHING else in that file — line 74's expression, including its `?? "/"` fallback, stays exactly as
    written. Its behavior is unchanged and now strictly improves, because the fallback target has itself become
    an auth-aware route.

    Re-run the spec and confirm GREEN. If Test 5 times out rather than failing an assertion, you have a
    redirect loop — stop and report; do not paper over it by widening the timeout.
  </action>

  <verify>
    <automated>npx playwright test tests/e2e/root-route-router.spec.ts --reporter=list</automated>
    <automated>npx tsc --noEmit</automated>
    <automated>test "$(grep -rn 'const ROLE_HOME' app lib components | wc -l)" -eq 1</automated>
  </verify>

  <done>
    The spec was observed failing before any production file was edited (output recorded in the SUMMARY) and
    all five tests pass after. `npx tsc --noEmit` is clean. The single-definition gate returns exactly one
    line, and it is `lib/auth/role-home.ts`. `components/site-header.tsx` is unmodified.
  </done>
</task>

<task type="auto">
  <name>Task 2: Realign the six existing spec files whose root-URL terminus this change invalidates</name>
  <files>tests/e2e/route-protection-unauthenticated.spec.ts, tests/e2e/route-protection-role-mismatch.spec.ts, tests/e2e/auth-logout.spec.ts, tests/e2e/auth-doctor-login.spec.ts, tests/e2e/admin-route-protection.spec.ts, tests/e2e/admin-doctor-link-account.spec.ts</files>

  <action>
    Direct mechanical consequence of Task 1, not scope creep: `/` no longer renders for anybody, so every
    assertion that waited for a navigation to settle there is now unreachable. Work through the six files in
    the survey table in `<critical_context>`. Line numbers drift as you edit — match on the surrounding test
    title and assertion shape, not on the number. If any site does not match its description below, stop and
    report rather than guessing.

    <!-- planner-discipline-allow: waitForURL("/") -->
    <!-- planner-discipline-allow: toHaveURL("/") -->

    1. `route-protection-unauthenticated.spec.ts` — the fourth test (currently titled around an unauthenticated
       visit to the root not being redirected). Retitle it to describe the redirect to `/login`, and rewrite
       the body to wait for the login URL and assert `pathname === "/login"` plus an absent `from` param,
       mirroring the `new URL(page.url())` idiom the first three tests in that same file already use. Leave the
       `/signup` test completely alone — `/signup` genuinely still is not redirected, and that test is what
       keeps the gate provably scoped rather than global.

    2. `route-protection-role-mismatch.spec.ts` — the mismatch branch inside the nested loop. The new terminus
       is the **visitor's own** home, so it keys off `role`, not `route`: wait for and assert `/${role}`, then
       replace the stale negative placeholder assertion with a positive `HOME_BODY_COPY[role]` visibility check
       using the map already defined at the top of that file. Update the mismatch test label accordingly — it
       currently promises a redirect to the root. Apply the same change to the standalone defence-in-depth test
       at the bottom of the file: a doctor hitting `/admin` now terminates on `/doctor`.

    3. `auth-logout.spec.ts` — four sites, all downstream of `components/logout-button.tsx:29`. In each, the
       post-logout wait must target the login URL instead of the root. Also retitle the first test, whose name
       currently states that logging out returns the user to the root. The failed-logout test's assertion that
       the user is still on `/patient` is unaffected — leave it.

    4. `auth-doctor-login.spec.ts` — the "a doctor account cannot reach /patient" test. The bounce now
       terminates on `/doctor`.

    5. `admin-route-protection.spec.ts` — the two per-path cases inside the `ADMIN_PAGES` loop. The patient
       context now terminates on `/patient` and the doctor context on `/doctor`. Their titles say the visitor
       is "redirected away", which is still true but no longer specific — sharpen each to name the role home it
       now lands on. Leave the logged-out case and the admin-renders-the-page case untouched.

    6. `admin-doctor-link-account.spec.ts` — the single post-logout wait inside test 4.

    Do not leave the old root-URL literal behind anywhere in `tests/e2e/`, including inside an explanatory
    code comment — the gate below scans the whole directory and a comment would trip it. Where a comment is
    genuinely useful (e.g. explaining the new two-hop bounce), describe the behavior in prose without
    reproducing the old matcher literally.
  </action>

  <verify>
    <automated>npx playwright test tests/e2e/route-protection-unauthenticated.spec.ts tests/e2e/route-protection-role-mismatch.spec.ts tests/e2e/auth-logout.spec.ts tests/e2e/auth-doctor-login.spec.ts tests/e2e/admin-route-protection.spec.ts tests/e2e/admin-doctor-link-account.spec.ts --reporter=list</automated>
    <automated>test "$(grep -rn 'waitForURL("/")' tests/e2e/ | wc -l)" -eq 0</automated>
    <automated>test "$(grep -rn 'toHaveURL("/")' tests/e2e/ | wc -l)" -eq 0</automated>
    <automated>npx playwright test tests/e2e/schema-connectivity.spec.ts tests/e2e/locale-switching.spec.ts --reporter=list</automated>
  </verify>

  <done>
    All six realigned spec files pass. Both root-URL gates return zero: no spec anywhere in `tests/e2e/` still
    waits for or asserts the bare root URL. The two predicted-safe spec files were run and their predictions
    confirmed in the SUMMARY — or, if a prediction was wrong, the failure was fixed here and the correction
    recorded. No production file was modified by this task.
  </done>
</task>

<task type="auto">
  <name>Task 3: Remove the ten now-dead scaffold dictionary keys and run the closure sweep</name>
  <files>dictionaries/en.json, dictionaries/he.json</files>

  <action>
    First re-confirm the keys are genuinely dead rather than trusting the survey: grep the ten scaffold key
    names across `app/`, `components/`, `lib/` and `scripts/` and confirm the only remaining hits are inside
    `.planning/` historical documents. If any live consumer turns up, stop and report — do not delete a key
    that is still read.

    Then delete the contiguous ten-line block from BOTH dictionaries. They occupy identical positions in
    identical order in each file, mid-object, so no trailing comma needs adjusting. Remove from both or from
    neither: as documented in `<critical_context>`, `lib/i18n/dictionaries.ts` casts the Hebrew dictionary
    rather than assignment-checking it, so an asymmetric edit compiles silently and would leave a permanent
    invisible divergence. Change nothing else in either file — no reordering, no reformatting, no other key.

    Then run the closure sweep. `app/page.tsx` is the site's root and `app/login/page.tsx` is traversed by a
    large fraction of the suite, so the full run is the real safety net for this change — a routing change can
    surface in specs the survey did not predict.

    Triage every failure against `.planning/WINDOWS.md`: this project carries a long-tracked shared-dev-DB
    test-residue / Supabase-rate-limit flakiness class (ledger ids 1,3,5,7,8,10,11,12 — typically
    `seed-availability.spec.ts:170` slot-count assertions, `appointment-reschedule.spec.ts:764` afterAll
    cleanup timeouts, and `admin-*` login failures). Those are pre-existing and are NOT this change's
    regressions. Re-run any suspected-flaky spec in isolation before classifying it.

    Anything that fails on a navigation, a URL assertion, or a missing translated string IS this change's
    regression and must be fixed here, not deferred. Record in the SUMMARY: the pass/fail counts, the exact
    classification of every failure, and the Task 1 RED evidence.
  </action>

  <verify>
    <automated>node -e "const en=require('./dictionaries/en.json'),he=require('./dictionaries/he.json');const a=Object.keys(en).sort(),b=Object.keys(he).sort();if(JSON.stringify(a)!==JSON.stringify(b))throw new Error('dictionary key sets diverge');const dead=a.filter(k=>k.startsWith('home'+'.'));if(dead.length)throw new Error('dead scaffold keys remain: '+dead.join(','));console.log('ok',a.length,'keys')"</automated>
    <automated>npx tsc --noEmit</automated>
    <automated>npm run lint</automated>
    <automated>npx playwright test --reporter=list</automated>
  </verify>

  <done>
    The key-set gate prints an ok line: both dictionaries carry an identical key set and neither retains a
    scaffold key. `npx tsc --noEmit` and `npm run lint` are clean. Every full-suite failure is individually
    classified as either the tracked shared-dev-DB/rate-limit flakiness class (with its WINDOWS.md ledger id
    cited) or fixed. Zero failures remain that involve a navigation, a URL terminus, or a missing translation.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| anonymous ↔ authenticated at `/` | The root route becomes an auth decision point for the first time. It reads the session and a `profiles` row, and emits only a `Location` header. |
| session role → destination route | `/` now selects a destination from the caller's stored role. It selects only; it authorizes nothing. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-etv-01 | Information Disclosure | `app/page.tsx` profiles lookup | low | mitigate | The role read goes through the session-bound SSR client (`lib/supabase/server.ts`), never `lib/supabase/admin.ts`, so `profiles` RLS stays the real boundary — identical to the three role layouts. The row id comes from `getUser()`, never from request input. No profile field is rendered; the only output is a redirect target drawn from a fixed three-entry literal, so the response cannot leak a role value to an unauthenticated caller. |
| T-etv-02 | Elevation of Privilege | `ROLE_HOME` lookup in `app/page.tsx` | low | mitigate | `/` chooses a destination and nothing more. Every destination re-enforces its own guard in its layout and behind `lib/supabase/proxy.ts`'s prefix gate, so a wrong role value at `/` can at most send a visitor to a route that immediately bounces them back — it grants nothing. The map is keyed by three known literals with an explicit `?? "/login"` fallback, so any unexpected value fails closed to the login page rather than to an attacker-influenced path. |
| T-etv-03 | Denial of Service | the `/` ↔ role-layout redirect chain | medium | mitigate | A disagreement between `/` and a destination layout would produce an unbounded redirect loop. Both derive role from the same `getUser()` + `profiles.role` read, so they cannot disagree for a given session; the only divergence path — an authenticated user with no profile row or an unrecognized role — is routed to `/login`, which renders unconditionally and never redirects, terminating the chain. Task 1 Test 5 pins this branch with a real test and an explicit timeout so a loop surfaces as a failure rather than a hung worker. |
| T-etv-04 | Spoofing | session identity at `/` | low | accept | `supabase.auth.getUser()` validates the session against the Auth server instead of trusting the cookie payload — the identical call the three role layouts and `components/site-header.tsx` already make on every request. No new trust is extended and no new session-handling code is introduced. |
| T-etv-05 | Tampering | `app/login/page.tsx` deduplication | low | mitigate | Replacing the local literal with a shared import removes a divergence risk rather than adding one; the consuming expression and its fallback are unchanged, and Task 1's single-definition grep gate proves no second copy survives anywhere in `app/`, `lib/` or `components/`. |

No package-manager install occurs in this plan, so no supply-chain (`T-*-SC`) legitimacy checkpoint applies.
</threat_model>

<verification>
1. `npx tsc --noEmit` — clean.
2. `npm run lint` — clean.
3. `npx playwright test tests/e2e/root-route-router.spec.ts` — all five tests pass, and were observed failing
   before any production file was edited.
4. `test "$(grep -rn 'const ROLE_HOME' app lib components | wc -l)" -eq 1` — exactly one definition, in
   `lib/auth/role-home.ts`.
5. Both root-URL terminus gates over `tests/e2e/` return zero.
6. The dictionary key-set comparison passes: identical key sets, no scaffold keys remaining.
7. `npx playwright test` — no failure attributable to this change; every failure classified against
   `.planning/WINDOWS.md`.
8. Diff-shape confirmation: `components/site-header.tsx` unmodified, `public/next.svg` and `public/vercel.svg`
   untouched, and nothing from Fix 3 (nav bar) or Fix 4 (doctor request form) present in the diff.
</verification>

<success_criteria>
- Typing the bare site URL, or clicking the MedRDV logo, now always lands the visitor somewhere real:
  `/login` when signed out, their own dashboard when signed in.
- The role-mismatch bounce that the three role layouts already performed now completes on the visitor's own
  home instead of dead-ending on Next.js boilerplate — strictly better UX, delivered with zero layout edits.
- One `ROLE_HOME` definition exists, consumed by both the root router and the login page.
- The unknown-role branch is proven loop-free by an automated test, not by argument.
- Every spec assertion invalidated by the new redirect chain — including the four sites the task brief did not
  flag, in `auth-logout.spec.ts`, `auth-doctor-login.spec.ts`, `admin-route-protection.spec.ts` and
  `admin-doctor-link-account.spec.ts` — is realigned in this same task, leaving the suite at least as green as
  its pre-change baseline.
- No dead dictionary entries are left behind, and the two dictionaries remain key-for-key symmetric.
</success_criteria>

<output>
Create `.planning/quick/260816-etv-make-an-auth-aware-router-app-page-tsx-r/260816-etv-SUMMARY.md` when done.
</output>
