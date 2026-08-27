---
phase: 06
slug: dashboards-notifications-localization
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-27
---

# Phase 06 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Retroactive security verification for a phase that was already implemented and goal-backward
verified (`06-VERIFICATION.md`, status: passed) before this report was authored. All 10 phase
plans plus the 3 quick tasks that touched this phase's surface area (`260817-fhm`, `260823-mn1`,
`260827-isc`) authored their own `<threat_model>` blocks at plan time
(`register_authored_at_plan_time: true`), so this audit verifies claimed mitigations against the
current codebase rather than constructing a register from scratch.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser ↔ Next.js Route Handlers | Patient/doctor/admin clients call `app/api/**` over HTTPS | Favorites, notifications, dashboard counts, locale preference — no medical data (project-wide constraint) |
| Route Handlers ↔ Supabase Postgres (session-bound client) | Server code queries as the signed-in user's own JWT; RLS is the primary authorization layer, route-level `.eq()` restatement is defense in depth | Row-scoped reads/writes (favorites, notifications, appointment counts) |
| Route Handlers ↔ Supabase Postgres (service-role/admin client) | Used only where a route structurally needs to bypass RLS (none newly introduced in Phase 6; test fixtures only) | Test fixture creation/cleanup via `testAdminClient()` |
| Browser ↔ Supabase Realtime (WebSocket) | `postgres_changes` subscription on `public.notifications`, filtered client-side by `user_id=eq.<uid>` | Notification row inserts; `notifications_select_own` RLS policy re-authorizes every event server-side per subscriber regardless of the client-supplied filter string |
| Anonymous ↔ Authenticated | Locale switching (`/api/locale`) is reachable pre-auth; dashboards/favorites/notifications are not | Locale cookie only, pre-auth; no PII pre-auth |
| Patient/Doctor/Admin role boundary | Notification copy, dashboard content, and cancel/reschedule eligibility all branch on role or derived state | `appointmentBadge().labelKey` (stable key, not translated text) drives authorization-adjacent UI decisions (T-06-40) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-06-01 | Info Disclosure | tests/e2e/helpers/{favorites,notifications}.ts | high | mitigate | Privileged access only via `testAdminClient()`; zero direct service-role key reads (grep-verified) | closed |
| T-06-02 | Tampering | Same fixture helpers | medium | mitigate | Created-id tracking arrays + exported cleanup wired into every spec's `test.afterAll` | closed |
| T-06-03 | Repudiation | Notification fixture rows | low | accept | Demo project on shared dev DB; test residue accepted per STATE.md | closed |
| T-06-SC (×9) | Tampering | npm/pip/cargo installs, 06-01 through 06-10 | high | mitigate | Zero new packages across all of Phase 6, confirmed via `git log` on package.json/lockfile | closed |
| T-06-04 | Elevation of Privilege | POST /api/patient/favorites | high | mitigate | `patient_id` written exclusively from `guard.userId`; body-supplied value never read | closed |
| T-06-05 | Tampering | DELETE /api/patient/favorites/[id] (IDOR) | high | mitigate | Delete scoped by `patient_id` + `doctor_id` in one WHERE clause; foreign/unknown id → 404 | closed |
| T-06-06 | Info Disclosure | Same route's response | high | mitigate | Missing/deleted/foreign/malformed cases share one byte-identical 404 message | closed |
| T-06-07 | Info Disclosure | GET /api/patient/favorites | high | mitigate | Query restates `patient_id = guard.userId`; joined doctor columns are already-public | closed |
| T-06-08 | Denial of Service | POST /api/patient/favorites unbounded inserts | low | accept | Unique constraint bounds row count; rate limiting out of scope at ASVS L1 for bounded demo data | closed |
| T-06-09 | Tampering | Non-UUID `[id]` reaching Postgres | medium | mitigate | UUID pre-check rejects malformed ids with 404 before any DB call | closed |
| T-06-10 | Info Disclosure | Doctor dashboard count queries | high | mitigate | `doctorId` resolved server-side from `profile_id = auth.uid()`; both counts scoped to it | closed |
| T-06-11 | Info Disclosure | Patient dashboard row rendering | medium | mitigate | Renders day/time/doctor/badge only; `reason`/`cancelled_reason` never referenced | closed |
| T-06-12 | Tampering | Dashboard counts | medium | mitigate | Server-side `count: "exact"` queries only; never client-supplied | closed |
| T-06-13 | Info Disclosure | Doctor dashboard patient-identity exposure | medium | mitigate | Renders integers only — no patient name/email/detail; Phase 5 CR-02 fix intact | closed |
| T-06-14 | Info Disclosure | supabase_realtime publication on notifications | high | mitigate | Migration touches no RLS policy; `notifications_select_own` remains the per-subscriber boundary | closed |
| T-06-15 | Tampering | PATCH /api/notifications/[id]/read (IDOR) | high | mitigate | Update scoped by `id` + `user_id` in one WHERE clause; foreign id affects 0 rows → 404 | closed |
| T-06-16 | Info Disclosure | Same route's response | high | mitigate | Missing/foreign/malformed cases share one byte-identical 404 message | closed |
| T-06-17 | Info Disclosure | GET /api/notifications payload | medium | mitigate | `message` structurally excluded from the select allowlist (D-03) | closed |
| T-06-18 | Elevation of Privilege | Writing into another user's notification feed | high | mitigate | No insert policy, no insert route; only the 3 SECURITY DEFINER appointment RPCs write | closed |
| T-06-19 | Info Disclosure | DELETE events bypassing RLS on postgres_changes | low | accept | App never deletes notification rows, so no such event is ever produced | closed |
| T-06-20 | Tampering | Locale cookie → lang/dir | high | mitigate | `readLocale()` validates against a fixed 2-value allow-list, defaults to "en" | closed |
| T-06-21 | Tampering | POST /api/locale body | medium | mitigate | Allow-list validation returns 400 before the cookie is set | closed |
| T-06-22 | Info Disclosure | site-header.tsx for anonymous visitors | medium | mitigate | Profiles lookup skipped entirely when no user | closed |
| T-06-23 | Info Disclosure | Header profiles select widened to include `role` | low | mitigate | Own-row read under RLS, used only to gate the bell, never rendered as text | closed |
| T-06-24 | Denial of Service | Unauthenticated POST /api/locale | low | accept | No DB work, one bounded cookie write; rate limiting out of scope at ASVS L1 | closed |
| T-06-25 | Tampering | XSS via a dictionary value | medium | mitigate | Zero `dangerouslySetInnerHTML` in app/, components/, lib/ (grep-verified) | closed |
| T-06-26 | Elevation of Privilege | Realtime channel filter spoofing | high | mitigate | `notifications_select_own` re-authorizes server-side per event; client also drops `user_id` mismatches | closed |
| T-06-27 | Info Disclosure | Replicated row carrying `message` | medium | mitigate | Client type has no `message` field; rendered copy comes exclusively from `notificationCopyKey()` | closed |
| T-06-28 | Info Disclosure | Wrong-role notification copy | medium | mitigate | Copy resolved from the viewer's own server-fetched `role`, never from the notification row | closed |
| T-06-29 | Denial of Service | Leaked websocket subscriptions | medium | mitigate | Effect cleanup calls `removeChannel`; no channel opened when `userId` is null | closed |
| T-06-30 | Tampering | XSS via interpolated dictionary string | medium | mitigate | Same zero-match `dangerouslySetInnerHTML` grep | closed |
| T-06-31 | Info Disclosure | Admin session subscribing to an unpopulatable feed | low | mitigate | Bell omitted entirely for admin role | closed |
| T-06-32 | Tampering | XSS via a dictionary value (i18n inventory) | medium | mitigate | Zero-match grep; static repo-authored JSON | closed |
| T-06-33 | Info Disclosure | Validation messages leaking internal detail | low | mitigate | Only pre-existing user-facing messages mapped, none invented | closed |
| T-06-34 | Tampering | Unmapped validator message rendering blank | medium | mitigate | Falls back to the original English message, never blank/key-path | closed |
| T-06-35 | Info Disclosure | Untranslated Hebrew value shipping as English | low | mitigate | Live parity check: 248/248 keys both languages, 0 identical-value pairs | closed |
| T-06-36 | Tampering | XSS via translated string (public retrofit) | medium | mitigate | Zero-match `dangerouslySetInnerHTML` grep | closed |
| T-06-37 | Info Disclosure | Login copy becoming a user-enumeration oracle | high | mitigate | Identical "Incorrect email or password." across every failure branch | closed |
| T-06-38 | Tampering | Retrofit silently changing rendered English text | medium | mitigate | Zero test files touched by the 06-08 commits — pre-existing specs are the regression detector | closed |
| T-06-39 | Info Disclosure | Search sanitisation regressing during retrofit | high | mitigate | `lib/validation/search.ts` untouched by any 06-08 commit | closed |
| T-06-40 | Elevation of Privilege | Eligibility predicate keyed on translatable text | high | mitigate | Both appointment pages gate on stable `labelKey`, not rendered text; RPC guards remain the real boundary | closed |
| T-06-41 | Tampering | XSS via translated string (authenticated retrofit) | medium | mitigate | Zero-match grep | closed |
| T-06-42 | Tampering | Retrofit silently changing rendered English text | medium | mitigate | Zero test files touched by 06-09 commits | closed |
| T-06-43 | Info Disclosure | Doctor schedule retrofit reintroducing patient identity | high | mitigate | Zero matches for patient-identity fields; no route/select changed | closed |
| T-06-44 | Tampering | Admin surfaces drifting into i18n scope | low | mitigate | Zero files under app/admin/ or components/admin/ in the 06-09 diff | closed |
| T-06-45 | Tampering | Physical-direction utility surviving into shipped code | medium | mitigate | Repo-wide grep for pl-/pr-/left-/right-/etc. = 0 matches; standing regression test | closed |
| T-06-46 | Denial of Service | Notification popover overflowing viewport in RTL | medium | mitigate | Live bounding-box assertion: popover stays inside viewport width in Hebrew | closed |
| T-06-47 | Tampering | Bulk fixture rows left in shared dev DB | medium | mitigate | Registered ids + `test.afterAll` cleanup for both 25-favorite and long-name fixtures | closed |
| T-06-48 | Repudiation | Backstop silently marked resolved without evidence | medium | mitigate | Every backstop's disposition recorded in SUMMARY.md; one correctly left `human_judgment: true` | closed |
| T-FHM-01 | Info Disclosure | Admin appointments doctor-list read | low | mitigate | Moved behind `requireAdmin()` on /api/admin/doctors — net reduction in exposure | closed |
| T-FHM-02 | Tampering | Notification read-state local update | low | mitigate | `Promise.allSettled` + functional `setRows` over only server-confirmed ids | closed |
| T-FHM-03 | Info Disclosure | specialtyLabel() render sites | low | accept | Specialty names are public reference data, already served under `select using(true)` RLS | closed |
| T-ISC-01 | Info Disclosure | supabase_realtime publication column scope | low | accept | Postgres catalog correctly scoped (message absent, `pg_publication_tables`-verified); managed Realtime service still delivers `message` on the wire per a `test.fixme` finding — human-accepted 2026-08-27 as a documented residual risk (non-medical, server-generated, never-rendered text). See Accepted Risks Log. | closed |
| T-ISC-02 | Denial of Service | Notification bell live delivery post-migration | medium | mitigate | Mandatory columns (`user_id`, `id`) derived from `NOTIFICATION_SELECT` and documented; full live spec run 14/14 passed post-migration | closed |
| T-ISC-03 | Tampering | Phase 6 sign-off artifacts (06-VERIFICATION.md/06-UAT.md) | low | mitigate | WR-03/IN-01/IN-02 preserved byte-identical, verified in the updated files | closed |
| T-MN1-01 | Tampering | npm/pip/cargo installs (UI accent rollout) | high | mitigate | `lucide-react` pre-declared; zero package.json/lockfile changes | closed |
| T-MN1-02 | Info Disclosure | Status-badge accent bar exposing new information | low | accept | Color derives from status already rendered as visible text on the same badge — discloses nothing new | closed |
| T-MN1-03 | Elevation of Privilege | appointmentBadge() accent field touching eligibility | medium | mitigate | `accentClassName` purely additive; `labelKey`/`variant` unrenamed/unreordered; T-06-40 predicates re-verified intact | closed |
| T-MN1-04 | Tampering | Decorative icons on CTAs | low | mitigate | All glyphs are static imports, `aria-hidden="true"`, never from user data | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `high` (workflow.security_block_on) count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Note on completeness:** all 10 phase plans (06-01–06-10) and all 3 quick tasks that touched this
phase's surface area (`260817-fhm`, `260823-mn1`, `260827-isc`) authored `<threat_model>` blocks at
plan time — `register_authored_at_plan_time: true` for every source. No phase-6 `SUMMARY.md`
declared a `## Threat Flags` section, so there are no executor-detected threats outside this
register to reconcile.

**Two non-blocking accessibility observations surfaced during verification (not security
findings, not gating):** `components/logout-button.tsx:46` and `components/notification-bell.tsx:218`
render a lucide icon without `aria-hidden`, unlike the icons added by quick task `260823-mn1`
(which are consistently `aria-hidden`). Neither destabilizes a security-relevant accessible name —
both controls already carry an explicit accessible label/visible text — but worth a one-line fix
for consistency if another UI pass touches either file.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-06-01 | T-06-03 | Notification fixture rows on the shared dev DB are indistinguishable from real rows; test residue is an already-tracked, accepted project-wide condition (STATE.md) | User (project owner) | 2026-08-13 |
| AR-06-02 | T-06-08 | Unique constraint already bounds per-patient favorite rows; rate limiting is out of scope at ASVS L1 for a bounded academic-demo dataset | User (project owner) | 2026-08-13 |
| AR-06-03 | T-06-19 | Postgres cannot re-check RLS on a deleted row's DELETE event; the app structurally never deletes notification rows, so the gap has no reachable trigger | User (project owner) | 2026-08-13 |
| AR-06-04 | T-06-24 | Unauthenticated locale-cookie endpoint does zero DB work and writes one bounded cookie; rate limiting out of scope at ASVS L1 | User (project owner) | 2026-08-13 |
| AR-06-05 | T-FHM-03 | Specialty names are public reference data already served under `select using(true)` RLS and already rendered in English elsewhere; localizing them discloses nothing new | User (project owner) | 2026-08-17 |
| AR-06-06 | T-MN1-02 | A colored accent bar on an appointment-status badge only recolors information already rendered as plain text on the same badge | User (project owner) | 2026-08-23 |
| AR-06-07 | T-ISC-01 | Postgres publication catalog is correctly scoped (message column genuinely absent — the authoritative boundary Postgres itself enforces). A wire-level test found Supabase's managed Realtime service (wal2json CDC decoder) still delivering `message`, an infrastructure-layer gap with no CLI-available remedy short of a full project restart. `message` is short, server-generated, non-medical informational text, never rendered client-side by design (D-03) — practical exposure is minimal. Restart judged not worth the disruption for this risk level; worth revisiting before a production deploy with real user data. | User (project owner) | 2026-08-27 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-27 | 59 | 59 | 0 | Claude (gsd-security-auditor), retroactive verification against a completed, goal-backward-verified phase |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-27
