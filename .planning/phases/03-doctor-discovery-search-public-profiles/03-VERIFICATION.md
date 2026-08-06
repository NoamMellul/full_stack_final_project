---
phase: 03-doctor-discovery-search-public-profiles
verified: 2026-08-06T00:00:00Z
status: gaps_found
score: 5/6 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "A q value containing SQL LIKE metacharacters is stripped of them before the pattern is built, so a lone wildcard character cannot be used to match every row or to alter the predicate (SEARCH-01 encoding edge, T-03-01, locked in 03-03-PLAN.md must_haves)."
    status: failed
    reason: "parseSearchParams (lib/validation/search.ts) strips PostgREST/LIKE metacharacters (% _ * \\) from the trimmed q value. When the entire non-empty, non-whitespace input consists solely of those metacharacters (e.g. a literal '%'), the stripped result is an empty string, which the function maps to q = null. In app/api/doctors/route.ts, `if (q !== null) query = query.ilike(...)` means a null q applies NO name filter at all, so the endpoint returns the full unfiltered doctor list. This is the exact 'match every row' outcome the locked truth says must never happen — reached through a different mechanism (silent fallback to no-filter) than a literal SQL wildcard, but observably identical to a patient. Reproduced live against the running app: GET /api/doctors returns total 12 (12 seeded demo doctors); GET /api/doctors?q=%25 (a lone '%') also returns total 12 — identical to the unfiltered request. Independently flagged by the phase's own 03-REVIEW.md as WR-01 (a Warning-severity finding), which this verification confirms is a real, reproducible behavior, not a false positive."
    artifacts:
      - path: "lib/validation/search.ts"
        issue: "parseSearchParams collapses a non-empty q that strips down to an empty string to null ('no filter'), rather than to a value guaranteed not to match any doctor."
    missing:
      - "Distinguish 'q was not supplied / was whitespace-only' (apply no filter — current, correct behavior) from 'q was supplied but stripped to nothing because it was entirely LIKE metacharacters' (must apply a filter that matches nothing). Either force a sentinel non-matching value into the ilike predicate, or have GET /api/doctors short-circuit to { doctors: [], total: 0 } when trimmed q is non-empty but the stripped value is empty, mirroring the existing empty-match-list short circuit already used for the availability-range filter."
human_verification:
  - test: "Confirm the two verification: backstop must-haves that no automated test exercises: (1) 03-03-PLAN.md — 'the initial fetch and every subsequent query change render 6 Skeleton placeholder cards until the response resolves'; (2) 03-06-PLAN.md — 'Prev, Next and every numbered page button are disabled for the duration of an in-flight page-change fetch'. Throttle the network in devtools, load /search, and change a filter or click a pagination control while watching the results region."
    expected: "6 Skeleton cards render in the results grid between the request and the response on every query change (not only the first page load); every pagination control (Prev, Next, every numbered button) is visibly disabled for the duration of a page-change fetch."
    why_human: "Both are marked verification: backstop in their plan frontmatter — code inspection confirms the structural wiring is present (search-results.tsx renders 6 <Skeleton> cards in the loading branch; every pagination Button carries disabled={... || controlsDisabled} where controlsDisabled = status !== 'ready'), but no Playwright assertion in this phase's specs exercises either behavior under real network latency, so the actual runtime timing has not been behaviorally proven."
  - test: "Re-review the three judgment-tier prohibitions this phase locked, independent of this verification's own reading of the code: (1) 03-03 — search results must never be reordered by sponsorship/payment/engagement signals; (2) 03-04 — demo doctor data must always carry a visible, non-collapsed, non-low-contrast demo indicator; (3) 03-05 — no search filter may be pre-set from browser locale, IP geolocation, Accept-Language, or prior session."
    expected: "All three hold in the shipped code."
    why_human: "These are judgment-tier prohibitions (verification: judgment in the plan frontmatter), which this automated verification can inspect but not authoritatively certify. This pass's own reading found no violations — app/api/doctors/route.ts orders only by next_available_at then id with no other predicate; the 'Demo profile' Badge renders in the profile header beside the h1 with variant=\"secondary\" (same as every other badge, no hover/disclosure gating); grep across components/search/search-filters.tsx and app/search/page.tsx found zero references to navigator.language, localStorage, geolocation, or Accept-Language — but per this project's verification protocol, a judgment-tier prohibition is never silently passed by an automated agent and is flagged here as a non-authoritative LLM-judge verdict for human sign-off."
---

# Phase 3: Doctor Discovery — Search & Public Profiles Verification Report

**Phase Goal:** Patients can find a doctor matching their criteria and review enough public information to decide whether to book, entirely from patient-facing pages.
**Verified:** 2026-08-06
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Patient can search doctors by name and filter by specialty, spoken language, neighborhood, and availability, combining multiple filters in a single search | ✓ VERIFIED | Live: 16/16 `tests/e2e/search-filters.spec.ts` tests pass against the running app and remote DB, including name (Latin case-insensitive + Hebrew-script), specialty, language, neighborhood, availability-range (including the Pitfall-3 "earliest slot outside range, later slot inside" case), and AND-combination tests. `app/api/doctors/route.ts` applies each predicate conditionally with Supabase-JS implicit AND. |
| 2 | Search results page shows each doctor's next available slot and is sorted by soonest availability | ✓ VERIFIED | Live: `tests/e2e/search-view-visibility.spec.ts` (9/9) proves the view's `next_available_at`/sort semantics at the DB layer; `tests/e2e/search-filters.spec.ts` sort tests and `tests/e2e/search-sort-pagination.spec.ts` (10/10, including the 44-doctor cross-page sweep) prove `ASC NULLS LAST` + id tie-break holds within and across pages. `components/search/doctor-card.tsx` renders `formatJerusalemDayHeading`/`formatJerusalemTime` for `next_available_at` or the "No upcoming availability" badge. |
| 3 | An empty search shows a clear "no doctor found" message instead of a blank page | ✓ VERIFIED | `components/search/search-results.tsx` contains the literal "No doctors found" heading and adjust-filters body copy; `tests/e2e/search-filters.spec.ts` "no results" test and `tests/e2e/search-sort-pagination.spec.ts` "page 99" test both pass live, rendering the empty state rather than a blank grid or crash. |
| 4 | Patient can open a doctor's public profile page showing specialty, description, address, neighborhood, languages, photo, and a clear "demo profile" indicator | ✓ VERIFIED | Live: `tests/e2e/doctor-profile.spec.ts` (10/10) proves all PROFILE-01 fields render (including a Hebrew-script encoding test and a null-bio/null-photo empty-state test), and PROFILE-02 (Demo profile badge visible in the header with no interaction). Code confirms the badge sits beside the `<h1>` name, `variant="secondary"` (never hover-gated, never below the fold, never lower contrast). |
| 5 | Patient can view a doctor's upcoming available slots directly from their profile page | ✓ VERIFIED | `tests/e2e/doctor-profile.spec.ts` PROFILE-03 test (day-grouped, ascending, 24h format) and D-06 test (zero-slot doctor shows the exact indicator with literally no slot-selection control) both pass live. The "Select this slot" control is natively `disabled` with no `onClick`; a force-click test confirms zero `/api/` requests are issued. |
| 6 | A lone LIKE-wildcard search term cannot be used to match every row (T-03-01, locked SEARCH-01 encoding-edge must-have) | ✗ FAILED | See Gaps below. `GET /api/doctors?q=%25` returns the full unfiltered doctor list (total 12, same as no query at all) — reproduced live. Confirmed as WR-01 in the phase's own `03-REVIEW.md`. |

**Score:** 5/6 truths verified (0 present-but-behavior-unverified at the ROADMAP-SC level; 2 additional plan-level backstop truths and 3 judgment-tier prohibitions are flagged for human sign-off, see Human Verification Required)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260806120000_add_doctor_search_view.sql` | `doctor_search_view`, `security_invoker=true`, explicit grant | ✓ VERIFIED | 57 lines; contains `security_invoker = true`, two `left join lateral`, `coalesce(lang.codes, '{}')`, `where d.is_active = true`, `grant select ... to anon, authenticated`. Applied to remote DB — `tests/e2e/search-view-visibility.spec.ts` (9/9) proves it live via an anon client. |
| `lib/timezone.ts` | Single Asia/Jerusalem conversion module | ✓ VERIFIED | 139 lines, exports all 8 documented symbols; `app/admin/appointments/page.tsx` imports from it (no local redefinition). |
| `lib/validation/search.ts` | Manual validation of all search params | ✓ VERIFIED | 153 lines; `PAGE_SIZE`, `MAX_PAGE`, `UUID_PATTERN`, `LANGUAGE_CODES`, `CALENDAR_DAY_PATTERN`, `ParsedSearchParams`, `validateSearchParams`, `parseSearchParams` all present. One behavioral gap inside this file — see Gaps. |
| `app/api/doctors/route.ts` | Public paginated multi-filter search endpoint | ✓ VERIFIED (with 1 gap) | 132 lines; queries `doctor_search_view`, applies name/specialty/language/neighborhood/availability predicates with AND, `.order(next_available_at, nullsFirst:false)` + `.order(id)`, `.range()`. No `requireAdmin()` guard (intentionally public, confirmed via curl — 200 with no cookie). |
| `app/api/doctors/[id]/route.ts` | Public profile + upcoming-slots endpoint | ✓ VERIFIED | 97 lines; `UUID_PATTERN` guard, `PUBLIC_DOCTOR_SELECT` omits `profile_id`/`is_active`/`created_at`, slot select limited to `id, start_at, end_at`. Confirmed via `tests/e2e/doctor-profile.spec.ts` T-03-05 response-hygiene test. |
| `app/search/page.tsx` | `/search` page, URL-persisted state | ✓ VERIFIED | 159 lines; `Suspense`-wrapped, `useSearchParams`, `updateQuery`, debounced name input, `listStatus` machine. `npm run build` reports `/search` as `○` (statically prerendered). |
| `app/doctors/[id]/page.tsx` | Public profile page | ✓ VERIFIED | 233 lines; demo badge, day-grouped slots, disabled booking CTA with the locked caption, not-found/error/loading branches all present and grep-confirmed. |
| `components/search/doctor-card.tsx` | Result card | ✓ VERIFIED | 90 lines; photo/InitialsAvatar fallback with `onError`, truncated name, language badges, next-availability text or "No upcoming availability" badge, "Demo profile" badge, "View profile" link. |
| `components/search/search-results.tsx` | Result grid, all 4 states + pagination | ✓ VERIFIED | 167 lines; loading (6 Skeletons)/error+Retry/empty/populated branches; numbered pagination with ellipsis condensation, `aria-current="page"`, `aria-label` Prev/Next, total-count caption. |
| `components/search/search-filters.tsx` | Filter panel | ✓ VERIFIED | 245 lines; name/specialty/language/neighborhood/date-range/quick-select chips, all fields start unset, "Clear filters" button, no implicit-signal imports (grep-confirmed). |
| `tests/e2e/search-view-visibility.spec.ts` | View RLS/grant/semantics proof | ✓ VERIFIED | 9/9 tests pass live. |
| `tests/e2e/seed-availability.spec.ts` | Seed idempotency/shape proof | ✓ VERIFIED | 8/8 tests pass live; `npm run seed` run twice within the spec, identical slot counts. |
| `tests/e2e/search-filters.spec.ts` | Name/filter/sort/combination coverage | ✓ VERIFIED | 16/16 tests pass live. |
| `tests/e2e/doctor-profile.spec.ts` | Profile contract coverage | ✓ VERIFIED | 10/10 tests pass live. |
| `tests/e2e/search-sort-pagination.spec.ts` | Pagination + cross-page sort stability | ✓ VERIFIED | 10/10 tests pass live, including a 44-doctor 8-page sweep with zero duplicates/omissions. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `app/search/page.tsx` | `app/api/doctors/route.ts` | `fetch(\`/api/doctors...\`)` | ✓ WIRED | Confirmed by passing e2e tests exercising the full round trip. |
| `app/api/doctors/route.ts` | `public.doctor_search_view` | `.from("doctor_search_view")` | ✓ WIRED | Confirmed live; view exists on remote DB and returns rows. |
| `components/search/doctor-card.tsx` | `app/doctors/[id]/page.tsx` | "View profile" link to `/doctors/{id}` | ✓ WIRED | `Button render={<Link href="/doctors/...">}`, confirmed by code read. |
| `app/doctors/[id]/page.tsx` | `app/api/doctors/[id]/route.ts` | `fetch(\`/api/doctors/{id}\`)` | ✓ WIRED | Confirmed by passing `doctor-profile.spec.ts`. |
| `app/api/doctors/route.ts` | `public.availability_slots` | availability pre-query | ✓ WIRED | Confirmed live via the Pitfall-3 test (doctor with later, not earliest, matching slot still returned). |
| `components/search/search-filters.tsx` | `app/search/page.tsx` | `onFilterChange` → `updateQuery` | ✓ WIRED | Confirmed by passing filter/combination/reload-parity tests. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `doctor_search_view` RLS/grant/next-slot semantics | `npx playwright test tests/e2e/search-view-visibility.spec.ts` | 9/9 passed (11.2s) | ✓ PASS |
| Seed idempotency and D-01/D-02/D-03 shape rules | `npx playwright test tests/e2e/seed-availability.spec.ts` | 8/8 passed (20.3s) | ✓ PASS |
| Public doctor profile contract | `npx playwright test tests/e2e/doctor-profile.spec.ts` | 10/10 passed (27.2s) | ✓ PASS |
| Search by name, filters, sort, combination | `npx playwright test tests/e2e/search-filters.spec.ts` | 16/16 passed (48.3s) | ✓ PASS |
| Pagination correctness and cross-page sort stability | `npx playwright test tests/e2e/search-sort-pagination.spec.ts` | 10/10 passed (36.7s) | ✓ PASS |
| Type-check | `npx tsc --noEmit` | clean, no output | ✓ PASS |
| Lint | `npm run lint` | clean, no errors | ✓ PASS |
| Production build | `npm run build` | succeeds; `/search` prerendered (`○`) | ✓ PASS |
| Wildcard-only search does not fall back to "match everyone" | `curl /api/doctors` (total 12) vs `curl "/api/doctors?q=%25"` (total 12) | Identical totals — the fallback bug reproduces live | ✗ FAIL (see Gaps) |

**Total: 53/53 Playwright tests pass across all 5 phase-3 specs run live against the running app and the real remote Supabase database (not merely re-reported from SUMMARY.md).**

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SEARCH-01 | 03-03 | Search doctors by name | ✓ SATISFIED (with 1 known encoding-edge gap) | Core name search proven live; wildcard-only edge case fails, see Gaps |
| SEARCH-02 | 03-01, 03-05 | Filter by specialty | ✓ SATISFIED | Live test pass |
| SEARCH-03 | 03-01, 03-05 | Filter by spoken language | ✓ SATISFIED | Live test pass |
| SEARCH-04 | 03-01, 03-05 | Filter by neighborhood | ✓ SATISFIED | Live test pass |
| SEARCH-05 | 03-02, 03-05 | Filter by availability | ✓ SATISFIED | Live test pass, including Pitfall-3 proof |
| SEARCH-06 | 03-05 | Combine multiple filters | ✓ SATISFIED | Live test pass |
| SEARCH-07 | 03-01, 03-02, 03-03 | Results show next available slot | ✓ SATISFIED | Live test pass |
| SEARCH-08 | 03-01, 03-03, 03-06 | Sorted by soonest availability | ✓ SATISFIED | Live test pass, incl. 44-doctor cross-page sweep |
| SEARCH-09 | 03-03, 03-06 | Empty results show clear message | ✓ SATISFIED | Live test pass |
| PROFILE-01 | 03-04 | Public profile with full field set | ✓ SATISFIED | Live test pass, incl. Hebrew encoding + empty-state |
| PROFILE-02 | 03-04 | "Demo profile" indicator | ✓ SATISFIED | Live test pass |
| PROFILE-03 | 03-04 | Upcoming available slots on profile | ✓ SATISFIED | Live test pass |

No orphaned requirements: every SEARCH-01..09 and PROFILE-01..03 ID in `REQUIREMENTS.md`'s Phase 3 traceability row appears in at least one plan's frontmatter `requirements:` field, and every plan's declared requirements are covered above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `lib/validation/search.ts` | 120-129 (per 03-REVIEW.md WR-01) | Logic bug: non-empty q that strips to "" silently becomes "no filter" | 🛑 Blocker (contradicts a locked must-have truth) | A patient searching a lone `%`/`_`/`*`/`\` gets every doctor instead of "No doctors found" — reproduced live |
| `app/api/doctors/route.ts` | 104-124 (per 03-REVIEW.md WR-02) | Out-of-range page reports `total: 0` (fabricated, not the real count) | ⚠️ Warning | Deep-page URL that has shrunk strands the visitor with no visible total/way back to page 1; not a violation of a locked must-have as literally worded (D-12 only requires UI/API total consistency), so not blocking |
| `app/api/doctors/[id]/route.ts` | 78-91 (per 03-REVIEW.md WR-03) | Upcoming-slots query has no `.limit()` | ⚠️ Warning | Unbounded response size for a doctor with unusually many future slots; UI-SPEC explicitly allows "no pagination" on this list for the seeded envelope, so not blocking |
| Various (per 03-REVIEW.md IN-01–IN-06) | — | `UUID_PATTERN`/`LANGUAGE_LABELS` duplicated across files; demo patient password hardcoded (documented accepted risk); no `photo_url` scheme validation; two effects swallow Supabase errors silently; `q` has no max length | ℹ️ Info | Quality/consistency nits, no functional impact on phase goal |

No `TBD`/`FIXME`/`XXX` debt markers found in any file modified by this phase (grepped across all 9 key source files).

### Deferred Items

None — no gap identified here maps to a later phase's stated goal or success criteria. WR-01 is squarely inside Phase 3's own SEARCH-01/T-03-01 scope, not deferred work.

## Gaps Summary

One reproducible, locked-must-have-contradicting bug: `GET /api/doctors?q=%25` (and any q consisting solely of `%`, `_`, `*`, or `\`) silently degrades to "no name filter", returning the entire unfiltered doctor list instead of a guaranteed-empty result. This directly contradicts the `03-03-PLAN.md` must-have "a lone wildcard character cannot be used to match every row or to alter the predicate (T-03-01)" and is independently documented as WR-01 in the phase's own code review (`03-REVIEW.md`). It was reproduced live against the running application in this verification pass (unfiltered total 12 == `q=%25` total 12). The rest of the phase's core goal — name/specialty/language/neighborhood/availability search with AND-combination, soonest-availability sort with stable cross-page ordering, the four-state result grid, numbered pagination, and the full public doctor profile including the demo indicator and upcoming-slot list — is verified working end to end against the live application and the real remote Supabase database (53/53 Playwright tests passing, `tsc`/`lint`/`build` all clean).

Two plan-level `verification: backstop` must-haves (the loading-skeleton-on-every-query-change behavior, and pagination-controls-disabled-during-in-flight-fetch) have no automated test evidence — code inspection shows both are structurally wired, but neither is confirmed under real network timing. Three `verification: judgment` prohibitions (no non-sort-based result ordering, the demo indicator's always-visible placement, and no implicit filter defaults from browser/session signals) were reviewed by this pass and found to hold, but per this project's verification protocol a judgment-tier prohibition is never silently certified by an automated agent — both categories are flagged in Human Verification Required for explicit sign-off.

---

_Verified: 2026-08-06_
_Verifier: Claude (gsd-verifier)_
