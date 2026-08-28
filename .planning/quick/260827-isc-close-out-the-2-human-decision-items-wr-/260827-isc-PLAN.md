---
phase: quick-260827-isc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260827120000_scope_notifications_realtime_columns.sql
  - tests/e2e/notifications-realtime.spec.ts
  - .planning/phases/06-dashboards-notifications-localization/06-VERIFICATION.md
  - .planning/phases/06-dashboards-notifications-localization/06-UAT.md
autonomous: true
requirements: [WR-01, WR-02]
user_setup: []

estimate:
  tokens: 52000
  raw_tokens: 52000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "A Realtime `postgres_changes` INSERT event on `public.notifications` delivers ONLY the six published columns to a subscriber; the stored body column is absent from the wire payload entirely (D-03 closed at transport level, not just at render level)."
    - "The published column list is exactly `NOTIFICATION_SELECT` (app/api/notifications/route.ts) plus `user_id` — cross-checked against that file at execution time, never copied blind from this plan."
    - "The notification bell still receives its own live INSERTs in a real browser session after the publication change: the badge still increments without a reload, and all four booking/cancel/reschedule copy tests still pass."
    - "WR-01 is confirmed ALREADY FIXED in components/notification-bell.tsx (commit 163b37d, quick 260817-fhm) by direct code read plus a live-passing Playwright test — with zero new edits to that component."
    - "06-VERIFICATION.md and 06-UAT.md record both WR-01 and WR-02 as resolved with commit refs and the named automated test that proves each."
    - "Neither file's top-level status is changed until the FULL content of both files has been re-read and every remaining open item has been enumerated; WR-03, IN-01 and IN-02 survive the edit unchanged and are explicitly named as residual non-blocking items."
  artifacts:
    - "supabase/migrations/20260827120000_scope_notifications_realtime_columns.sql — drop + re-add of public.notifications on supabase_realtime with an explicit 6-column list, APPLIED to the linked remote project"
    - "tests/e2e/notifications-realtime.spec.ts — one new wire-level test asserting the received payload's exact key set"
    - ".planning/phases/06-dashboards-notifications-localization/06-VERIFICATION.md — status re-evaluated, both warnings recorded resolved, residual items named"
    - ".planning/phases/06-dashboards-notifications-localization/06-UAT.md — both tests resolved, summary counts and status re-evaluated"
  key_links:
    - "Migration column list <- `NOTIFICATION_SELECT` in app/api/notifications/route.ts (source of truth, 5 columns) + `user_id`. Drift here silently re-leaks or under-publishes."
    - "`user_id` in the column list <- the client subscription filter `user_id=eq.${userId}` AND the handler's defense-in-depth `row.user_id !== userId` check (components/notification-bell.tsx:81-85, T-06-26). Omitting it breaks live delivery entirely, not just the defense check."
    - "`id` in the column list <- the table's replica identity (primary key). Postgres rejects a column list on a publication that publishes UPDATE/DELETE if the replica identity columns are missing."
    - "insertTestNotification({ message }) (tests/e2e/helpers/notifications.ts:17-42) <- the new test's sentinel body value; the helper already accepts an optional message, so no helper change is needed."
    - "06-VERIFICATION.md's `status: human_needed` <- its own line 150 states the two human_verification entries are the ONLY reason for that status. That sentence is the precondition for flipping it."
---

<objective>
Close out the two human-decision items blocking Phase 6 formal sign-off: WR-01 (verify + document only — already fixed) and WR-02 (real fix — scope the Realtime publication to an explicit column list so the notification body column never reaches the browser over the wire), then re-evaluate the top-level status of 06-VERIFICATION.md and 06-UAT.md after a full re-read of both.

Purpose: 06-VERIFICATION.md sits at `human_needed` and 06-UAT.md at `testing` with 2 pending items purely because of these two warnings. One is already resolved and just undocumented; the other is a genuine, narrow data-minimization gap between the REST route (which deliberately withholds the body column) and the Realtime publication (which does not).
Output: one new migration applied live to the linked Supabase project, one new wire-level Playwright test, and two updated planning artifacts with auditable status changes.
</objective>

<execution_context>
@C:/Users/mellu/Desktop/full_stack_final_project/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/mellu/Desktop/full_stack_final_project/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/CLAUDE.md

@app/api/notifications/route.ts
@components/notification-bell.tsx
@supabase/migrations/20260812090000_enable_notifications_realtime.sql
@tests/e2e/notifications-realtime.spec.ts
@tests/e2e/helpers/notifications.ts

Project skills: `.claude/skills/supabase-postgres-best-practices/` exists and is registered with the Skill tool as `supabase-postgres-best-practices`. Task 1 MUST invoke it before writing any SQL.

Known facts established during planning (do not re-derive, but DO re-verify the two marked "cross-check"):
- `public.notifications` columns (20260803230000_initial_schema.sql:99-107): `id`, `user_id`, `type`, `message`, `related_appointment_id`, `read_at`, `created_at`.
- **cross-check** `NOTIFICATION_SELECT` = `"id, type, related_appointment_id, read_at, created_at"` (app/api/notifications/route.ts:16).
- **cross-check** WR-01's fix is present at components/notification-bell.tsx:157-186 (`markReadOnOpen` → `Promise.allSettled` → functional `setRows` on succeeded ids only), landed by quick task 260817-fhm, commit 163b37d.
- WR-01 is ALREADY covered by a live test: `tests/e2e/notifications-realtime.spec.ts:278` — "the unread badge clears after opening the bell, without a page reload".
- The linked project runs Postgres 17; publication column lists have existed since Postgres 15, so there is no version-compatibility concern.
- Live-apply convention (260817-eqs, 260818-s44): `npx supabase db push --linked`, using the CLI's cached authenticated session (`SUPABASE_ACCESS_TOKEN` is not set in the shell). No local Supabase stack is in use.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Scope the notifications Realtime publication to an explicit column list, apply it live, prove it at the wire</name>
  <files>supabase/migrations/20260827120000_scope_notifications_realtime_columns.sql, tests/e2e/notifications-realtime.spec.ts</files>
  <precondition>The Supabase CLI is linked and holds a valid cached session — confirm with `npx supabase projects list` before touching the migration (260818-s44 recorded that `db push --linked` uses this cached session, not `SUPABASE_ACCESS_TOKEN`). If the CLI is not authenticated, or the sandbox classifier blocks `db push`, apply the migration through the Supabase dashboard SQL editor instead and say so explicitly in the summary — never mark this task done on an unapplied migration file.</precondition>
  <read_first>
    - `.claude/skills/supabase-postgres-best-practices/SKILL.md` — invoke via the Skill tool BEFORE writing SQL (project-skill rule: it must be loaded before any schema/migration authoring).
    - `app/api/notifications/route.ts` — read `NOTIFICATION_SELECT` verbatim. This is the source of truth for the column list. If it no longer matches what the context block records, follow the FILE and flag the divergence in the summary; do not follow this plan's copy.
    - `supabase/migrations/20260812090000_enable_notifications_realtime.sql` — the migration being corrected; match its comment density and voice.
    - `tests/e2e/notifications-realtime.spec.ts:80-112` — the existing service-role subscribe/poll shape the new test reuses.
  </read_first>
  <behavior>
    - Test: a service-role Realtime subscriber receives a `postgres_changes` INSERT event for a newly inserted notification row, and the received `payload.new` object's key set is EXACTLY the six published columns.
    - Test (same case): the unique sentinel body string written into that row is absent from the entire serialized payload.
    - Edge case: a service-role subscriber has full column privileges on the table, so publication scope is the ONLY mechanism that can narrow its payload — which is precisely what makes this a wire-level proof rather than a proxy for one.
  </behavior>
  <action>
Write `supabase/migrations/20260827120000_scope_notifications_realtime_columns.sql` with two statements: first `alter publication supabase_realtime drop table public.notifications;`, then `alter publication supabase_realtime add table public.notifications (...)` carrying the explicit column list. The list is `NOTIFICATION_SELECT`'s columns as read from app/api/notifications/route.ts, plus `user_id` — six columns total, and deliberately not the seventh (the stored English body text, which D-03 requires never reach a user).

Header comment must record, in the voice of the migration it corrects: (1) that this closes 06-REVIEW.md WR-02, extending D-03's data minimization from the REST select list to the replication stream; (2) why drop-then-add rather than an in-place edit — Postgres offers no "set the column list for one table already in a publication" form, and `ALTER PUBLICATION ... SET TABLE` would replace the publication's ENTIRE table list, silently unpublishing every other table on `supabase_realtime`; (3) why `user_id` is in the list even though the REST route omits it — the browser subscription filter `user_id=eq.${userId}` is evaluated against the replicated columns, and the handler's defense-in-depth `row.user_id !== userId` comparison (components/notification-bell.tsx:81-85, T-06-26) reads it; without it, live delivery breaks outright; (4) why `id` is mandatory — it is the table's replica identity and Postgres rejects a column list omitting replica-identity columns on a publication that publishes UPDATE/DELETE; (5) that no RLS policy and no REPLICA IDENTITY setting is touched — `notifications_select_own` / `notifications_update_own` remain the sole per-subscriber authorization boundary, exactly as the 20260812090000 header states.

Apply with `npx supabase db push --linked`, then confirm with `npx supabase migration list --linked` that the new version appears on BOTH the local and remote side.

Then add ONE new test to `tests/e2e/notifications-realtime.spec.ts`, placed immediately after "notifications table is published to supabase_realtime" inside the same describe block, titled so it is greppable by the word `withholds`. Reuse that neighbour's exact idiom: `testAdminClient()`, `.channel(...)` with a distinct channel name, `.on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, ...)`, the promise-wrapped `channel.subscribe((status, err) => ...)` with the same SUBSCRIBED/CHANNEL_ERROR/TIMED_OUT/CLOSED branches, `expect.poll` with the same 55000ms timeout, and `admin.removeChannel(channel)` at the end. Differences from the neighbour: capture the WHOLE `payload.new` object into the closure variable rather than only its id, and call `insertTestNotification` with an explicit body value built from `randomUUID()` (imported from `node:crypto`) so no other fixture row in the shared dev database can coincidentally match it. Assert three things: the received row's id equals the inserted id; `Object.keys(received).sort()` deep-equals the six published column names sorted; and the serialized received object does not contain the sentinel substring.

Do NOT verify this migration by negative-grepping its own file for the withheld column name — the header comment names that column legitimately and repeatedly, so such a gate would be self-invalidating. Assert the positive column-list line instead if a static check is wanted.

If the first post-apply run of the new test still shows all seven columns, wait ~30s and re-run once before concluding anything: the Realtime service can still be emitting from a decoding context opened before the ALTER. If it persistently shows seven columns, STOP and report — do not paper over it by stripping the field in the client handler; that was WR-02's explicitly weaker fallback and is not what this task delivers.
  </action>
  <reversibility rating="costly">Publication membership on the shared remote dev database is mutated for every consumer at once, and every Realtime-dependent spec runs against it. Rollback is a single follow-up migration re-adding `public.notifications` with no column list (restoring 20260812090000's exact behaviour) plus another `db push --linked` — cheap to write, but it requires a second live apply against the shared database, so it is not free.</reversibility>
  <verify>
    <automated>npx playwright test tests/e2e/notifications-realtime.spec.ts -g "withholds" --reporter=line</automated>
    <automated>npx supabase migration list --linked</automated>
  </verify>
  <done>The migration file exists, is applied to the linked remote project (confirmed present on the remote side of `migration list`, or an explicitly-reported dashboard-SQL-editor fallback), and the new wire-level test passes live: the received Realtime payload carries exactly six keys and no trace of the sentinel body value.</done>
</task>

<task type="auto">
  <name>Task 2: Confirm WR-01 is already fixed (no code change) and that the column-scoped publication did not break browser-side delivery</name>
  <files>components/notification-bell.tsx (read-only), tests/e2e/notifications-realtime.spec.ts (read-only unless a genuine coverage gap is found)</files>
  <action>
WR-01 is a verify-and-document job, not an implementation job. Read `components/notification-bell.tsx` and confirm both halves of the claim: `markReadOnOpen` awaits `Promise.allSettled` over the per-id PATCH calls, builds the set of server-confirmed ids, and then calls `setRows` with a FUNCTIONAL updater (never the captured array) that flips only those ids to a read timestamp; and `handleOpenChange` snapshots the unread ids synchronously at open time before delegating. Then confirm `tests/e2e/notifications-realtime.spec.ts` already contains "the unread badge clears after opening the bell, without a page reload", asserting the badge is hidden after opening the popover WITHOUT a reload, and still hidden after one. Record commit 163b37d (quick task 260817-fhm) as the fix that landed this.

If BOTH hold: make no edit to either file. The deliverable here is evidence, not a diff.

If EITHER does not hold — the state update is missing, or the assertion does not actually cover the no-reload path — STOP and report it loudly in the summary as a deviation from this task's premise BEFORE writing any fix. The task description asserted WR-01 was already closed; discovering otherwise is a finding that the developer must see, not a silent scope expansion.

Then run the entire spec file, not just the greps above. This doubles as task 1's regression gate: the four booking/cancel/reschedule copy tests and "the notification badge updates without a page reload" all drive the REAL browser subscription — a client Supabase connection, under `notifications_select_own` RLS, with the `user_id=eq.` filter — which is exactly the path a wrong or incomplete column list would break. A failure of the live-badge test here is the rollback signal from task 1's reversibility note: write the rollback migration re-adding the table with no column list, apply it with `db push --linked`, and report; do not leave the shared dev database with Realtime broken for the notification bell.

This spec file is Realtime-timing sensitive and runs against the shared dev database that has a long-tracked flakiness history (WINDOWS.md ids 1-16). A single failure gets exactly one isolated re-run before being treated as real; a failure that reproduces on the isolated re-run is real. Finish with `npx tsc --noEmit` and `npm run lint`.
  </action>
  <verify>
    <automated>npx playwright test tests/e2e/notifications-realtime.spec.ts --reporter=line</automated>
    <automated>npx tsc --noEmit && npm run lint</automated>
  </verify>
  <done>components/notification-bell.tsx is confirmed correct and untouched, the existing badge-clears test is confirmed to cover WR-01's no-reload path, every test in tests/e2e/notifications-realtime.spec.ts passes after the publication change, and tsc/eslint are clean.</done>
</task>

<task type="auto">
  <name>Task 3: Re-read both Phase 6 sign-off artifacts in full, record both resolutions, then re-evaluate their top-level status</name>
  <files>.planning/phases/06-dashboards-notifications-localization/06-VERIFICATION.md, .planning/phases/06-dashboards-notifications-localization/06-UAT.md</files>
  <read_first>
    - `.planning/phases/06-dashboards-notifications-localization/06-VERIFICATION.md` — ENTIRE file, all 156 lines, not only the WR-01/WR-02 passages.
    - `.planning/phases/06-dashboards-notifications-localization/06-UAT.md` — ENTIRE file, all 67 lines.
    - `.planning/phases/05-appointment-booking-lifecycle/05-UAT.md` — the closed-UAT convention to match: `status: complete`, `## Current Test` reduced to `[testing complete]`, per-test `result: pass` with an optional `source: automated` line.
  </read_first>
  <action>
Before editing either file, enumerate in the summary EVERY open or unresolved item found in the full re-read of both, so the status change is auditable rather than assumed. Cover at minimum: 06-VERIFICATION.md's frontmatter `human_verification` entries, `status`, `score`, and `behavior_unverified`; its Anti-Patterns Found table (five rows: WR-01, WR-02, WR-03, IN-01, IN-02); its Human Verification Required section; its Gaps Summary; and 06-UAT.md's per-test `result:` fields plus its Summary counts.

The precondition for flipping 06-VERIFICATION.md's status is its OWN line 150, which states that the two warnings "are the reason overall status is `human_needed` rather than `passed`". If the full re-read surfaces any other item that independently gates that status, do NOT flip it — report the item instead and leave the status as found.

06-VERIFICATION.md edits: set `status: passed`; replace the two `human_verification:` entries with a resolution record (either a `resolved_human_verification:` block keeping each item's test/expected text plus a new resolution line, or removal of the block with the resolution moved into the body — pick one and be consistent); update the `score` line so it no longer describes two warnings as awaiting a human decision. Rewrite the "Human Verification Required" section into a resolved form carrying, per item: what resolved it, the commit ref (WR-01 → 163b37d, quick task 260817-fhm; WR-02 → this task's own commit and the new migration filename), and the exact name of the automated test that now proves it. Update the Anti-Patterns table's WR-01 and WR-02 rows to a resolved state pointing at those same references. Leave the WR-03, IN-01 and IN-02 rows and the WR-03 explanatory paragraph BYTE-IDENTICAL, and add one explicit line naming exactly those three as residual non-blocking items carried forward unchanged and out of this task's scope — so a reader can see the status flip did not absorb them.

06-UAT.md edits: mark test 1 and test 2 `result: pass`, each with a `source: automated` line naming the proving test title (test 1 → "the unread badge clears after opening the bell, without a page reload"; test 2 → task 1's new payload-key test). State on each that the resolution was a landed code/migration fix with automated proof, not a human eyeball pass. Reduce `## Current Test` to `[testing complete]`, matching 05-UAT.md. Set Summary to total 2 / passed 2 / issues 0 / pending 0 / skipped 0 / blocked 0. Set frontmatter `status: complete` and refresh `updated:`. Leave `## Gaps` empty.

Touch nothing related to WR-03's Hebrew pluralization, the Phase 3 warnings, or any other phase's artifacts.
  </action>
  <verify>
    <automated>cd "C:/Users/mellu/Desktop/full_stack_final_project" && V=.planning/phases/06-dashboards-notifications-localization/06-VERIFICATION.md && U=.planning/phases/06-dashboards-notifications-localization/06-UAT.md && echo "verif-passed:$(grep -c '^status: passed' $V) uat-complete:$(grep -c '^status: complete' $U) uat-pass-results:$(grep -c '^result: pass$' $U) uat-pending-zero:$(grep -c '^pending: 0$' $U) wr03-preserved:$(grep -c 'WR-03' $V)"</automated>
  </verify>
  <done>Both files re-read end to end with every open item enumerated in the summary; 06-VERIFICATION.md reads `status: passed` with both warnings recorded resolved and WR-03/IN-01/IN-02 preserved verbatim and named as residual; 06-UAT.md reads `status: complete` with 2 passed / 0 pending and `[testing complete]`. The verify line prints verif-passed:1 uat-complete:1 uat-pass-results:2 uat-pending-zero:1 wr03-preserved:1 or higher on the last field.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Postgres WAL → Realtime service → browser websocket | Row data crosses from the database into untrusted client memory. Column selection here is the only server-side control; the client cannot un-receive a column. |
| Publication definition → every Realtime consumer | A single `ALTER PUBLICATION` on the shared remote dev database changes delivery for every subscriber at once, including all Playwright specs. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-ISC-01 | Information Disclosure | `supabase_realtime` publication on `public.notifications` | low | mitigate | Task 1's explicit six-column publication list removes the stored English body text from the replication stream entirely, so it is not merely unrendered but never transmitted (extends D-03 from the REST select list to the wire). Proven by a service-role subscriber asserting the exact received key set. |
| T-ISC-02 | Denial of Service | Notification bell live delivery | medium | mitigate | A column list omitting `user_id` or `id` would break the `user_id=eq.` subscription filter or be rejected outright, silently killing all live notifications. Mitigated by deriving the list from `NOTIFICATION_SELECT` at execution time, documenting both mandatory columns in the migration header, and gating on task 2's full browser-driven spec run with a named rollback migration as the failure path. |
| T-ISC-03 | Tampering | Phase 6 sign-off artifacts | low | mitigate | A status flip could silently absorb unrelated open items. Mitigated by task 3's mandatory full re-read + enumeration before any edit, byte-identical preservation of WR-03/IN-01/IN-02, and a verify gate that positively asserts WR-03 still appears in the file. |
| T-ISC-SC | Tampering | package installs | low | accept | This task installs no npm/pip/cargo package. No legitimacy gate applies. |
</threat_model>

<verification>
- The new migration is present on the remote side of `npx supabase migration list --linked`.
- `npx playwright test tests/e2e/notifications-realtime.spec.ts` — every test in both describe blocks passes (one isolated re-run allowed for a single Realtime-timing flake, per the tracked shared-dev-DB flakiness class).
- `npx tsc --noEmit` and `npm run lint` clean.
- `git diff --stat` shows zero changes to `components/notification-bell.tsx`.
- 06-VERIFICATION.md and 06-UAT.md status fields re-evaluated only after the documented full re-read.
</verification>

<success_criteria>
- WR-02 is fixed at the database, applied live, and proven by a test that reads the actual Realtime payload rather than inferring from migration text.
- WR-01 is documented as resolved with its commit ref and its already-existing covering test, with no edit to the component.
- Both Phase 6 sign-off artifacts carry an auditable status change: every residual open item named, none silently swept.
- WR-03, the Phase 3 warnings, and every other phase's artifacts are untouched.
</success_criteria>

<output>
Create `.planning/quick/260827-isc-close-out-the-2-human-decision-items-wr-/260827-isc-SUMMARY.md` when done.
</output>
