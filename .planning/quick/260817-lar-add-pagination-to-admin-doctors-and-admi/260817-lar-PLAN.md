---
phase: quick-260817-lar
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/validation/pagination.ts
  - app/api/admin/doctors/route.ts
  - app/api/admin/users/route.ts
  - components/pagination-nav.tsx
  - components/search/search-results.tsx
  - components/admin/doctors-page-client.tsx
  - components/admin/oversight-table.tsx
  - app/admin/users/page.tsx
  - tests/e2e/admin-doctor-crud.spec.ts
  - tests/e2e/admin-pagination.spec.ts
autonomous: true
requirements: [LAR-01, LAR-02, LAR-03, LAR-04, LAR-05, LAR-06]

estimate:
  tokens: 80000
  raw_tokens: 80000
  tasks: 6
  confidence: low

must_haves:
  truths:
    - "GET /api/admin/doctors?page=N returns at most ADMIN_PAGE_SIZE doctor rows plus the true total row count, in the same {rows, total, page, pageSize} shape GET /api/doctors already uses for /search."
    - "GET /api/admin/users?page=N behaves identically for profiles."
    - "A plain unparameterized GET /api/admin/doctors still returns EVERY doctor row, so the /admin/appointments doctor-filter dropdown keeps listing the full catalog after this change."
    - "/admin/doctors renders at most ADMIN_PAGE_SIZE table rows at a time and a pagination nav that moves between pages without a full page reload."
    - "/admin/users renders at most ADMIN_PAGE_SIZE table rows at a time with the same nav."
    - "/admin/appointments is visually and behaviourally unchanged — it shares OversightTable but opts out of pagination, and its own list endpoint is untouched."
    - "/search pagination behaves byte-identically after the shared pagination component extraction: same DOM, same aria labels, same Hebrew labels."
    - "A client can never widen its own page size: page size is a server-side constant, only the page NUMBER travels in the query string."
  artifacts:
    - lib/validation/pagination.ts
    - components/pagination-nav.tsx
    - tests/e2e/admin-pagination.spec.ts
  key_links:
    - "lib/validation/pagination.ts (ADMIN_PAGE_SIZE + page validation) -> app/api/admin/doctors/route.ts + app/api/admin/users/route.ts -> .range(offset, offset+size-1) with count:'exact'"
    - "components/pagination-nav.tsx -> components/search/search-results.tsx (i18n labels) AND components/admin/doctors-page-client.tsx + components/admin/oversight-table.tsx (English literals)"
    - "doctors-page-client loadDoctors(targetPage) -> GET /api/admin/doctors?page=N -> {doctors,total,page,pageSize} -> table rows + count caption + pageCount"
    - "app/admin/users/page.tsx pageSize prop -> OversightTable paginated mode -> /api/admin/users?page=N (appointments passes no pageSize -> unchanged unparameterized behaviour)"
    - "app/admin/appointments/page.tsx loadDoctorOptions() -> unparameterized GET /api/admin/doctors -> full doctor list (contract protected by a dedicated Playwright test)"
---

<objective>
Add page-based pagination to the two unbounded admin list surfaces — `/admin/doctors` and `/admin/users` — replicating the pagination pattern the public `/search` flow already ships, without breaking the one consumer that legitimately needs the full unpaginated doctor list.

Purpose: confirmed by live visual audit, `/admin/doctors` currently renders every doctor row in one table (~19500px tall against the dev catalog) and `/admin/users` does the same (~10300px). Neither `GET /api/admin/doctors` nor `GET /api/admin/users` accepts any pagination parameter — both fetch the entire table unconditionally, serialize it, and hand it to the browser. This is a real scalability gap independent of the pending data-cleanup quick task: a realistic production catalog re-creates it immediately.

Output: one shared server-side pagination validation module, two paginated admin GET handlers, one shared `PaginationNav` component extracted from the existing `/search` implementation (so there is exactly ONE condensed-pagination algorithm in the codebase, not three), both admin tables wired to it, and Playwright coverage for the new controls plus a dedicated regression test pinning the `/admin/appointments` doctor-filter dropdown to the full catalog.

**Task shape note (quick-mode batch):** the standard tracer-first / 2-3-tasks-per-plan shape does not apply. This is one focused change replicated across two symmetric endpoints and two symmetric UI surfaces, plus a pure refactor and a test task. Each task is an independently committable, independently verifiable slice; splitting into multiple plans would add orchestration overhead with zero information gain. The requester set a ~30-35% context target for the whole batch — keep every file read targeted (the exact line ranges are named per task) and do not re-read a file already in context.
</objective>

<execution_context>
@C:/Users/mellu/Desktop/full_stack_final_project/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/mellu/Desktop/full_stack_final_project/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/CLAUDE.md

Project constraints that bind every task below (from CLAUDE.md, non-negotiable):
- REST Route Handlers only — no Server Actions.
- Manual TypeScript validation — no Zod or any schema library.
- Playwright end-to-end tests only — no Vitest, no React Testing Library.
- Admin surfaces are English-only by design (established in Phase 06: `lib/i18n/specialty.ts` localizes patient/doctor-facing surfaces; admin stays English). Do NOT add dictionary keys for the admin pagination labels.

Reference implementation to replicate (read these first, they are the pattern of record):
@app/api/doctors/route.ts
@lib/validation/search.ts
@components/search/search-results.tsx
@tests/e2e/search-sort-pagination.spec.ts

Files being changed:
@app/api/admin/doctors/route.ts
@app/api/admin/users/route.ts
@components/admin/doctors-page-client.tsx
@components/admin/oversight-table.tsx
@app/admin/users/page.tsx

Consumers that must NOT regress:
@app/admin/appointments/page.tsx
@tests/e2e/admin-oversight-views.spec.ts
@tests/e2e/admin-doctor-crud.spec.ts

## Decisions locked before execution (do not re-litigate mid-task)

**D-LAR-01 — Param contract: page number only, page size is a server constant.**
The client sends `page` and nothing else. `ADMIN_PAGE_SIZE` lives server-side in `lib/validation/pagination.ts`. This mirrors the existing `PAGE_SIZE` decision in `lib/validation/search.ts` line 6-7 and its recorded threat rationale (T-03-04: a client-supplied page size is a full-table-dump primitive). Do NOT accept `pageSize`, `limit` or `offset` from the request.

**D-LAR-02 — Admin page size is 25.**
Denser than the 6-per-page consumer search grid because these are data tables, not cards. One constant shared by both admin routes.

**D-LAR-03 — Pagination is opt-in per request; an unparameterized GET still returns everything.**
This is the resolution of the `/admin/appointments` doctor-filter hazard called out in the task brief. `app/admin/appointments/page.tsx` `loadDoctorOptions()` (lines 55-77) calls a plain `fetch("/api/admin/doctors")` and needs the complete list to populate its filter Select. If pagination became the DEFAULT, that dropdown would silently shrink to the 25 most recently created doctors.

Resolution = option (b) from the brief:
- `page` param ABSENT -> current behaviour exactly: every row, response `{doctors: [...], total: n}` (users: `{users: [...], total: n}`). `total` is newly added and additive; every existing consumer reads only `data.doctors` / `data.users` and is unaffected.
- `page` param PRESENT and valid -> `{doctors: [...], total, page, pageSize}` — the exact shape `GET /api/doctors` returns for `/search`.
- `page` param PRESENT and invalid -> 400.

Option (a) (dropdown passes a large pageSize) was rejected because it requires accepting a client-supplied page size, which contradicts D-LAR-01 and re-opens T-03-04. The presence of the `page` key is the mode discriminator — the response documents its own mode.

**D-LAR-04 — Admin table page lives in component state, not the URL.**
`/search` carries `page` in the URL (Phase 03 D-14) because search results are shareable links. Admin table pages are not shared or bookmarked; local `useState` is simpler and adds no router coupling. Conscious divergence from the reference pattern — do not add `useSearchParams` to the admin clients.

**D-LAR-05 — Extract the condensed-pagination algorithm, do not copy it.**
`components/search/search-results.tsx` lines 22-49 (`buildPageItems`) and lines 115-179 (the nav JSX) are the only implementation in the repo — there is no shared pagination component in `components/search/` (verified). Copying it into two admin clients would create three divergent copies. Task 3 extracts it verbatim into `components/pagination-nav.tsx` with labels as props (search passes `t()` values, admin passes English literals), then tasks 4 and 5 consume it.
</context>

<tasks>

<task type="auto">
  <name>Task 1: page-param validation module + paginated GET /api/admin/doctors</name>
  <files>lib/validation/pagination.ts, app/api/admin/doctors/route.ts</files>
  <read_first>
    - `lib/validation/search.ts` lines 1-16 and 73-84 — the exact manual-validation house style to mirror (one exported function per concern, plain `if` chains, `string | null` return where null means valid) and the exact page-bounds error message wording.
    - `app/api/doctors/route.ts` lines 33-56 and 117-145 — the reference `.range()` + `count: "exact"` + PGRST103 handling and the exact response-key ordering.
    - `app/api/admin/doctors/route.ts` in full (it is 141 lines; the GET handler is lines 42-62). The POST handler at lines 64-140 is NOT in scope and must not be touched.
  </read_first>
  <action>
Create `lib/validation/pagination.ts` as the single source for admin list pagination bounds. Export a numeric constant `ADMIN_PAGE_SIZE` set to 25 (per D-LAR-02) with a comment recording that it is server-side only and never read from the request, mirroring the rationale already documented above `PAGE_SIZE` in `lib/validation/search.ts`. Export `MAX_ADMIN_PAGE` set to 1000, the same upper clamp `lib/validation/search.ts` uses, so an absurd page number cannot force a huge OFFSET scan. Export `validateAdminPageParam(params: URLSearchParams): string | null` returning null when the `page` key is absent (that is the valid unpaginated mode, per D-LAR-03) and otherwise returning the message "Page must be a whole number between 1 and 1000." when the raw value fails the digits-only test or falls outside 1..MAX_ADMIN_PAGE. Reuse that message string verbatim from `lib/validation/search.ts` so both surfaces speak identically, but declare it as its own literal in this module rather than importing from the search module — these are independent surfaces and search's module is about search filters. Export `parseAdminPageParam(params: URLSearchParams): number | null` returning null when `page` is absent and the parsed number otherwise; it may assume `validateAdminPageParam` already ran.

Rewrite the GET handler in `app/api/admin/doctors/route.ts`. Change its signature to take `request: Request` (it currently takes no argument). Keep `requireAdmin()` as the first statement and keep the early `if (!guard.ok) return guard.response;` return — pagination must never move ahead of the authorization guard. Read `searchParams` from the request URL, run `validateAdminPageParam`, and return a 400 `{ error: message }` when it fails, before any database call. Build the query as today — same `DOCTOR_LIST_SELECT`, same `.order("created_at", { ascending: false })` then `.order("id", { ascending: false })` ordering, unchanged — but add `{ count: "exact" }` as the second argument to `.select()` so the true total travels with every response in both modes. When the parsed page is not null, apply `.range(offset, offset + ADMIN_PAGE_SIZE - 1)` where offset is `(page - 1) * ADMIN_PAGE_SIZE`.

Error handling: keep the existing generic 500 body "Could not load doctors. Please refresh the page." unchanged for the general error case. Add one branch ahead of it for PostgREST code PGRST103, the 416 "requested range not satisfiable" that fires when the offset lands past the last row (a stale deep page after rows were deleted). In that branch, re-issue a head-only count query against `doctors` using `{ count: "exact", head: true }` and return an empty page carrying the REAL total, so the client can clamp back to a valid page. This deliberately improves on `app/api/doctors/route.ts`, which returns a fabricated `total: 0` in the same branch — a known open warning recorded in STATE.md (Phase 3 WR-02). Note the divergence in a code comment so the difference reads as intentional rather than as drift.

Responses: paginated mode returns `{ doctors: rows.map(toListRow), total: count ?? 0, page, pageSize: ADMIN_PAGE_SIZE }`; unparameterized mode returns `{ doctors: rows.map(toListRow), total: count ?? rows.length }` with no `page` or `pageSize` key, because there is no page (D-LAR-03). `toListRow` is unchanged and still shapes every row in both modes.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run lint && npx playwright test tests/e2e/admin-oversight-views.spec.ts --reporter=line</automated>
  </verify>
  <done>`GET /api/admin/doctors` with no query string returns every doctor plus a `total` and no `page`/`pageSize` keys; with `?page=2` returns at most 25 rows plus `total`, `page`, `pageSize`; with `?page=0`, `?page=abc` or `?page=1001` returns 400 carrying the bounds message; `requireAdmin()` still runs before any parameter handling; the POST handler and `toListRow` are byte-unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: paginated GET /api/admin/users</name>
  <files>app/api/admin/users/route.ts</files>
  <read_first>
    - `app/api/admin/users/route.ts` in full (27 lines).
    - `tests/e2e/admin-oversight-views.spec.ts` lines 100-124 — the existing ordering test issues an UNPARAMETERIZED `page.request.get("/api/admin/users")` and reads `data.users`; it must keep passing untouched, which D-LAR-03 guarantees.
  </read_first>
  <action>
Apply the Task 1 treatment to `app/api/admin/users/route.ts`, importing `ADMIN_PAGE_SIZE`, `validateAdminPageParam` and `parseAdminPageParam` from the module Task 1 created — do not re-declare the constant or the message here.

Change the GET signature to take `request: Request`. Keep `requireAdmin()` first and keep the existing comment block above the handler explaining that `profiles_select_own_or_admin` RLS is the independent second layer (T-02-02) — that reasoning is unchanged by pagination and should survive the edit. Validate `page` and return 400 before touching the database. Keep the select column list `"id, role, full_name, email, created_at"` exactly as it is (do not widen it) and add `{ count: "exact" }`. Keep both `.order()` calls unchanged. Apply `.range()` only in paginated mode. Mirror the PGRST103 branch with a head-only count against `profiles`. Keep the generic 500 body "Could not load users. Please refresh the page." unchanged.

Response keys mirror Task 1 with `users` as the row key: unparameterized `{ users, total }`; paginated `{ users, total, page, pageSize }`.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run lint && npx playwright test tests/e2e/admin-oversight-views.spec.ts tests/e2e/admin-route-protection.spec.ts --reporter=line</automated>
  </verify>
  <done>`GET /api/admin/users` unparameterized returns every profile row plus `total` and the pre-existing ordering test passes unmodified; `?page=N` returns at most 25 rows with `total`/`page`/`pageSize`; invalid page values return 400; a non-admin session still receives 401/403 for both modes.</done>
</task>

<task type="auto">
  <name>Task 3: extract the shared PaginationNav component (pure refactor, zero behaviour change)</name>
  <files>components/pagination-nav.tsx, components/search/search-results.tsx</files>
  <read_first>
    - `components/search/search-results.tsx` in full (182 lines) — lines 22-49 hold `buildPageItems`, lines 115-179 hold the nav JSX being moved.
    - `dictionaries/en.json` lines 203-208 — the English values behind `search.results.pagination_nav_label` ("Search results pagination"), `previous_page_aria` ("Previous page"), `next_page_aria` ("Next page") and `page_aria_prefix` ("Page"). The extraction must not change which string reaches which attribute in either locale.
  </read_first>
  <action>
Create `components/pagination-nav.tsx` as a `"use client"` component that owns the condensed-pagination algorithm and its markup for the whole codebase. Move `buildPageItems` into it verbatim, comment included, and delete it from `search-results.tsx`. Props: `page`, `pageCount`, `onPageChange`, an optional `disabled` boolean, and four label strings — `navLabel`, `previousLabel`, `nextLabel`, `pageLabelPrefix`. The component must NOT import `useT` or any dictionary: labels are always passed in, which is what lets the admin surfaces stay English-only per the CLAUDE.md constraint while `/search` stays translated.

Move the guard inside: return null when `pageCount` is 1 or less, which renders exactly what the current `pageCount > 1 ? ... : null` ternary renders. Reproduce the existing markup EXACTLY — the same `nav` with `aria-label={navLabel}` and `className="flex items-center justify-center gap-1"`, the same three Button shapes with their `variant`/`size="icon-sm"`/`className="relative after:absolute after:-inset-2"` values, the same `ChevronLeftIcon`/`ChevronRightIcon`/`MoreHorizontalIcon` usage, the same `aria-hidden` ellipsis span with `className="flex size-7 items-center justify-center text-muted-foreground"`, the same dedicated current-page branch carrying `variant="default"` plus a literal `aria-current="page"` (that dedicated branch is a recorded Phase 03 decision — keep it a distinct JSX branch, do not collapse it into a conditional attribute), and the same per-button `aria-label` composition of prefix plus a space plus the number. Prev is disabled when `page` is 1 or `disabled` is set; Next is disabled when `page` equals `pageCount` or `disabled` is set; the numbered buttons are disabled when `disabled` is set.

Then edit `components/search/search-results.tsx` to import and render it, passing `page`, the locally computed `pageCount`, `onPageChange`, `disabled={status !== "ready"}` (the existing `controlsDisabled` value), and the four labels resolved through the existing `t()` calls with the identical keys. Everything else in that file — the loading skeleton grid, the error state, the empty state, the count caption, the card grid, and the `PAGE_SIZE` import used by the skeleton — stays untouched. This task changes no rendered output; it is a pure move.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run lint && npx playwright test tests/e2e/search-sort-pagination.spec.ts tests/e2e/search-filters.spec.ts --reporter=line</automated>
  </verify>
  <done>All 11 tests in `search-sort-pagination.spec.ts` pass unmodified, including the ellipsis-condensation + `aria-current` assertion, the Prev/Next enablement assertions, the deep-page reload assertion and the "6 or fewer results renders no pagination nav" assertion; `search-results.tsx` no longer declares `buildPageItems` and no longer imports the three lucide icons; `components/pagination-nav.tsx` contains the only copy of the algorithm.</done>
</task>

<task type="auto">
  <name>Task 4: paginate the /admin/doctors table</name>
  <files>components/admin/doctors-page-client.tsx</files>
  <read_first>
    - `components/admin/doctors-page-client.tsx` lines 217-292 (state block, `loadDoctors`, mount effect, `handleRetry`) and lines 679-816 (the count caption, the status region and the table block). The form/dialog sections in between are out of scope.
    - `tests/e2e/admin-doctor-crud.spec.ts` lines 353-372 and 405-438 — two tests stub `GET /api/admin/doctors` with a body that has `doctors` but NO `total`. The client must tolerate that (see the fallback below) so both keep passing on their assertions.
  </read_first>
  <action>
Wire the doctors table to the paginated endpoint. Add three pieces of state next to the existing `listStatus`: the current page number initialised to 1, the total row count initialised to 0, and a boolean that is true only while a page fetch is in flight.

Rework `loadDoctors` to take a `targetPage: number` argument and fetch `/api/admin/doctors?page=` plus that number — the admin table always requests a page, which is what makes the endpoint's paginated mode engage (D-LAR-03). On success, set the rows, set the page state to `targetPage`, and set the total from `data.total` when it is a number, otherwise fall back to the returned row array's length. That fallback is load-bearing: the two Playwright stubs named above return a body with no `total`, and without the fallback the count caption would read 0 and those tests would fail. Keep the existing try/catch shape and the existing "loading covers only the very first GET" convention: later page changes update the rows in place rather than flashing the skeleton back. Set the in-flight boolean true at the start and false in a `finally`.

Update the call sites. The mount effect requests page 1. `handleRetry` re-requests the CURRENT page. The create-doctor success path requests page 1 explicitly, because a new doctor sorts to the top under `created_at` descending and would otherwise be invisible to an admin who submitted the form while on a later page. The edit and link-account success paths re-request the current page so the admin stays where they were.

Change the count caption to read from the total rather than the rendered row count, preserving the exact existing wording and pluralisation: the singular form for a total of 1 and the plural form otherwise. Render `PaginationNav` from Task 3 immediately after the table's `overflow-x-auto` wrapper, still inside the surrounding column flex container, only when `listStatus` is ready. Pass `page`, a `pageCount` computed as the ceiling of total divided by `ADMIN_PAGE_SIZE` imported from `lib/validation/pagination.ts` with a floor of 1, an `onPageChange` that calls `loadDoctors` with the requested page, `disabled` bound to the in-flight boolean (this is what prevents two overlapping page fetches resolving out of order), and the English labels: nav label "Doctors pagination", previous "Previous page", next "Next page", prefix "Page". No dictionary keys — admin is English-only.

Do not touch the create form, the edit dialog, the link-account dialog, the temp-password dialog, the status Switch handler, or the table's column set and cell markup.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run lint && npx playwright test tests/e2e/admin-doctor-status.spec.ts tests/e2e/admin-doctor-link-account.spec.ts --reporter=line</automated>
  </verify>
  <done>`/admin/doctors` renders at most 25 body rows with a "Doctors pagination" nav below the table when the catalog exceeds one page; the count caption reports the full total, not the page length; creating a doctor returns the admin to page 1 with the new row visible; editing, linking and toggling status leave the admin on the page they were on; the two admin-doctor specs above pass unmodified.</done>
</task>

<task type="auto">
  <name>Task 5: paginate /admin/users through an opt-in OversightTable mode</name>
  <files>components/admin/oversight-table.tsx, app/admin/users/page.tsx</files>
  <read_first>
    - `components/admin/oversight-table.tsx` in full (190 lines) — note it is SHARED by `/admin/users` and `/admin/appointments`, and that its `endpoint` prop is documented as a full request URL that may already carry a query string.
    - `app/admin/appointments/page.tsx` lines 91-120 or wherever it builds the `endpoint` string it passes to `OversightTable` — it appends `status`/`doctorId`/`from`/`to` params, so the endpoint it passes ALREADY contains a `?`.
  </read_first>
  <action>
Make pagination an opt-in capability of `OversightTable` so `/admin/users` gains it and `/admin/appointments` is untouched. Add two optional props: a numeric `pageSize` whose presence is what enables paginated mode, and a `paginationNavLabel` string used only in that mode. `/admin/appointments` passes neither and therefore keeps its exact current behaviour — no `page` param appended to its request, no nav rendered, no change to `GET /api/admin/appointments` (which this plan does not touch at all).

Add the same three state pieces as Task 4: current page (initialised to 1), total (initialised to null so a response without a `total` key falls back cleanly), and an in-flight boolean. Rework `load` to take a `targetPage` argument. In paginated mode it appends the page param to `endpoint`, choosing the separator by whether `endpoint` already contains a question mark — this is what keeps the appointments-style filtered endpoints correct if that page ever opts in later. In unpaginated mode it requests `endpoint` verbatim. On success read the row array from `data[resourceKey]` as today, set the page, and set total from `data.total` when it is a number and null otherwise. Keep `load` a `useCallback` and keep `endpoint` in its dependency list, so an endpoint change still re-fetches; the effect should request page 1 on every endpoint change, which is the correct reset semantics when a filter narrows the result set.

Change the count caption to prefer the total when it is a number and fall back to the rendered row count otherwise, keeping the existing `countNounSingular`/`countNounPlural` wording and the existing "only shown when ready" condition. Render `PaginationNav` after the table wrapper when paginated mode is on and status is ready, with `pageCount` computed from total and the `pageSize` prop (floor of 1), `disabled` bound to the in-flight boolean, `navLabel` from the new prop, and the English literals "Previous page", "Next page" and "Page" for the remaining labels. Leave the loading skeleton, the error state with its Retry button, the empty state, the column rendering and `formatCell` untouched.

Then edit `app/admin/users/page.tsx` to import `ADMIN_PAGE_SIZE` from `lib/validation/pagination.ts` and pass it as `pageSize`, together with `paginationNavLabel` set to "Users pagination". The page stays a Server Component — it only passes two more literal-valued props; do not convert it to a Client Component and do not touch its `COLUMNS` array or its empty-state copy.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run lint && npx playwright test tests/e2e/admin-oversight-views.spec.ts --reporter=line</automated>
  </verify>
  <done>`/admin/users` renders at most 25 rows plus a "Users pagination" nav and a caption reporting the full total; `/admin/appointments` renders exactly as before with no nav and no `page` param on its request (its filter tests in `admin-oversight-views.spec.ts` pass unmodified, including the two-rows-for-one-name assertion and the doctor-filter error-state assertion).</done>
</task>

<task type="auto">
  <name>Task 6: Playwright coverage for the new controls and the doctor-filter regression</name>
  <files>tests/e2e/admin-pagination.spec.ts, tests/e2e/admin-doctor-crud.spec.ts</files>
  <read_first>
    - `tests/e2e/search-sort-pagination.spec.ts` in full (268 lines) — reuse its idioms: the bulk fixture insert with an `afterAll` cleanup, the `getByRole("navigation", { name: ... })` nav locator, the `getByRole("button", { name: "Next page" })` control locators, and the page-sweep assertion that proves no duplication and no omission across pages.
    - `tests/e2e/admin-oversight-views.spec.ts` lines 1-130 — the admin login idiom, the helper imports actually available under `tests/e2e/helpers/`, and the existing `/api/admin/users` ordering test.
    - `tests/e2e/admin-doctor-crud.spec.ts` lines 330-360 — its local admin-login helper and the fixture-doctor creation/cleanup helpers.
  </read_first>
  <action>
First, repair two existing stubs that this change silently breaks. `tests/e2e/admin-doctor-crud.spec.ts` lines 356 and 408 intercept with the glob `"**/api/admin/doctors"`. Playwright matches the FULL url including its query string, and in Playwright's glob dialect a question mark is a single-character wildcard rather than a literal — so after Task 4 the doctors client requests a url carrying a page param and neither stub matches any more, silently letting both tests hit the real database instead of the intended fixture. Replace both string patterns with a regular expression that matches the path with or without a query string, anchored on the `/api/admin/doctors` path segment so it cannot also swallow requests to the `[id]` sub-routes. Change nothing else in that file — both tests keep their existing bodies and assertions, including the "1 doctor" caption assertion, which is exactly what proves Task 4's missing-`total` fallback works. Leave the `"**/api/admin/doctors"` stub at `tests/e2e/admin-oversight-views.spec.ts` line 144 ALONE: it targets the appointments page's unparameterized dropdown request, which still matches that glob and must keep matching it.

Then create `tests/e2e/admin-pagination.spec.ts` covering, as an admin session unless stated otherwise:

Endpoint contract, via `page.request` with no UI involved:
1. `GET /api/admin/doctors?page=1` returns `pageSize` equal to 25, a `doctors` array no longer than `pageSize`, and a `total` at least as large as that array.
2. An unparameterized `GET /api/admin/doctors` returns a body whose `total` equals its own `doctors` array length and which carries no `page` key — the machine-checkable statement of D-LAR-03, and the contract the appointments dropdown depends on.
3. The id sets of `?page=1` and `?page=2` are disjoint, and every id on both pages appears in the unparameterized list — no overlap, no omission, consistent with the unchanged `created_at` descending ordering.
4. `?page=0`, `?page=abc` and `?page=1001` each return 400 carrying the bounds message.
5. The same four shapes for `/api/admin/users`, at minimum: paginated shape, unparameterized totality, disjoint consecutive pages, and 400 on an invalid page.
6. A patient session receives the same 401/403 from `/api/admin/doctors?page=1` and `/api/admin/users?page=1` that it already receives unparameterized — pagination is not an authorization bypass.

UI behaviour:
7. `/admin/doctors`: bulk-insert 26 fixture doctors in `beforeAll` (one more than a full page) using the same bulk-insert-plus-`afterAll`-cleanup idiom `search-sort-pagination.spec.ts` uses, so this test is deterministic regardless of how many rows the shared dev database happens to hold and survives the pending data-cleanup quick task. Assert the table renders at most 25 body rows, that the "Doctors pagination" nav is visible with Previous disabled and Next enabled, that clicking Next changes the first data row's name and enables Previous, and that the count caption reports a total larger than the number of rendered rows.
8. `/admin/users`: do NOT bulk-create auth users — creating profiles requires real auth signups, which is a tracked rate-limiting flakiness source in this project (STATE.md, WINDOWS.md ids 8-11). Instead read the true total from `GET /api/admin/users?page=1` first, then assert the rendered body-row count never exceeds 25, and branch the nav assertion on that total: when it exceeds 25 assert the "Users pagination" nav is visible and that clicking Next changes the first row, and when it does not assert the nav is absent. Record the reason for the conditional shape in a comment so it does not read as an accident.

Regression pin for the doctor-filter dropdown (the hazard D-LAR-03 exists to prevent):
9. On `/admin/appointments`, read the unparameterized `GET /api/admin/doctors` list first and take its LAST entry — the oldest by `created_at`, therefore the one guaranteed to fall off page 1 if this route ever silently becomes paginated by default. Open the doctor filter Select and assert an option carrying that doctor's full name is present, and that the option count is at least the reported total. Add a comment naming `loadDoctorOptions()` in `app/admin/appointments/page.tsx` as the code this test pins, so a future edit to that function finds the test.

Use the existing helper modules under `tests/e2e/helpers/` for admin login, doctor fixtures and cleanup — do not add new helper files, and do not leave fixture rows behind.
  </action>
  <verify>
    <automated>npx playwright test tests/e2e/admin-pagination.spec.ts tests/e2e/admin-doctor-crud.spec.ts tests/e2e/admin-oversight-views.spec.ts --reporter=line</automated>
  </verify>
  <done>Every new test in `admin-pagination.spec.ts` passes, both repaired stubs in `admin-doctor-crud.spec.ts` intercept again (verifiable because the "1 doctor" and "No doctors yet" tests pass against their fixture bodies rather than the live catalog), and no fixture rows remain in the database after the run.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser -> `GET /api/admin/{doctors,users}` | Admin-authenticated but still untrusted input: the new `page` query parameter crosses here |
| route handler -> Postgres | `.range()` offset derived from that parameter reaches the query planner |
| `OversightTable` -> two different admin pages | One shared component now has two behavioural modes; a mistake here changes `/admin/appointments` |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-LAR-01 | Denial of Service | `page` param -> `.range()` offset on both admin GETs | medium | mitigate | `validateAdminPageParam` clamps to 1..1000 (`MAX_ADMIN_PAGE`) and returns 400 before any DB call, mirroring the recorded T-03-04 clamp in `lib/validation/search.ts` |
| T-LAR-02 | Information disclosure | client-controlled page size | high | mitigate | D-LAR-01: `ADMIN_PAGE_SIZE` is a server constant; `pageSize`/`limit`/`offset` are never read from the request, so a caller cannot turn the endpoint into a full-table dump primitive |
| T-LAR-03 | Elevation of privilege | new param handling ahead of the auth guard | high | mitigate | `requireAdmin()` stays the first statement in both handlers with its early return intact; Task 6 test 6 proves a patient session still gets 401/403 on the paginated form of both endpoints |
| T-LAR-04 | Tampering | `endpoint` string concatenation in `OversightTable` | low | mitigate | the page number is a validated integer from component state, never user text; the separator is chosen by inspecting the existing endpoint rather than assuming |
| T-LAR-05 | Denial of Service | unparameterized full-list mode remains available | low | accept | admin-gated behind `requireAdmin()` plus RLS, bounded by the doctor catalog, and required by `loadDoctorOptions()`; the paginated path is what the two heavy table surfaces now use |
| T-LAR-SC | Tampering | npm/pip/cargo installs | n/a | accept | this plan installs zero packages and does not modify `package.json`; no legitimacy gate applies |
</threat_model>

<verification>
Run after all six tasks are committed:

1. `npx tsc --noEmit` — clean.
2. `npm run lint` — clean.
3. `npx playwright test tests/e2e/admin-pagination.spec.ts tests/e2e/admin-doctor-crud.spec.ts tests/e2e/admin-doctor-status.spec.ts tests/e2e/admin-doctor-link-account.spec.ts tests/e2e/admin-oversight-views.spec.ts tests/e2e/admin-route-protection.spec.ts tests/e2e/search-sort-pagination.spec.ts tests/e2e/search-filters.spec.ts --reporter=line` — all pass.
4. Full suite `npx playwright test` — compare failures against the recurring shared-dev-DB residue class already tracked in STATE.md and WINDOWS.md (ids 1-12). Any NEW failure touching `/admin/doctors`, `/admin/users`, `/admin/appointments` or `/search` is a real regression and must be fixed, not attributed to the tracked class.
5. Manual spot check on a running dev server: `/admin/doctors` and `/admin/users` each fit a normal viewport scroll rather than a five-figure pixel height, and the `/admin/appointments` doctor filter still lists the whole catalog.
</verification>

<success_criteria>
- Both admin list endpoints accept `page`, return `total`, and reject out-of-range or non-numeric page values with a 400.
- Neither endpoint accepts a client-supplied page size in any spelling.
- An unparameterized request to either endpoint still returns every row, and the `/admin/appointments` doctor filter still lists every doctor — proven by a dedicated test, not by inspection.
- `/admin/doctors` and `/admin/users` each render at most 25 rows with working pagination controls.
- `/admin/appointments` and `/search` are behaviourally unchanged.
- Exactly one condensed-pagination implementation exists in the repo.
- Six atomic commits, one per task, each independently buildable.
</success_criteria>

<source_coverage_audit>
| # | Source item | Type | Covered by |
|---|-------------|------|------------|
| 1 | limit/offset support on `GET /api/admin/doctors` | brief task 1 | Task 1 |
| 2 | limit/offset support on `GET /api/admin/users` | brief task 2 | Task 2 |
| 3 | pagination controls on `/admin/doctors` reusing the search component if one exists | brief task 3 | Tasks 3 + 4 (no shared component existed; Task 3 creates it by extraction) |
| 4 | pagination controls on the admin users page | brief task 4 | Task 5 (the users page is a Server Component delegating to the shared `OversightTable`, so the change lands there, opt-in so `/admin/appointments` is unaffected) |
| 5 | decide + document the doctor-filter dropdown fix | brief constraint | D-LAR-03 (option b), with Task 6 test 9 as the regression pin |
| 6 | new Playwright coverage for the pagination controls themselves | brief constraint | Task 6 tests 1-8 |
| 7 | match the existing `/search` pagination pattern | brief constraint | D-LAR-01/D-LAR-05; divergences (page size 25, state-not-URL, real total on PGRST103) are each recorded with a rationale |
| 8 | pick a sensible admin page size (25-50) | brief constraint | D-LAR-02 (25) |
| 9 | note existing coverage for the affected pages | brief constraint | `read_first` blocks in Tasks 4, 5 and 6 name the exact specs and line ranges; Task 6 repairs the two stubs the change would otherwise break |

No unplanned items.
</source_coverage_audit>

<output>
Create `.planning/quick/260817-lar-add-pagination-to-admin-doctors-and-admi/260817-lar-SUMMARY.md` when done.
</output>
