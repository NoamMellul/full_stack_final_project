# Phase 3: Doctor Discovery — Search & Public Profiles - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-06
**Phase:** 3-doctor-discovery-search-public-profiles
**Areas discussed:** Demo availability data, Doctors with no upcoming slots, Availability filter semantics, Pagination of results, Route naming clarification

---

## Demo availability data

| Option | Description | Selected |
|--------|-------------|----------|
| Free-text | Comprehensive rules given directly by the user in one reply | ✓ |

**User's choice:** Phase 3 extends `scripts/seed.ts` with demo `availability_slots`. Rules: future slots only; spread over the next 21 days; ~6-10 slots per doctor that gets availability; realistic consultation hours; no overlaps per doctor; zero `appointments` created; slots exist only for search/display; not all doctors get slots — 1-2 active doctors deliberately left with none to test the "no availability" state; seeding must be idempotent (no duplicates on re-run).
**Notes:** Directly resolves Phase 2's D-09, which explicitly deferred slot seeding to "whichever phase needs them."

---

## Doctors with no upcoming slots

| Option | Description | Selected |
|--------|-------------|----------|
| Exclude from results | Doctors with zero future slots don't appear in search | |
| Include, sorted last, with indicator | Free-text answer from the user | ✓ |

**User's choice:** An active doctor with no future slot stays visible: appears after doctors with availability, displays "No upcoming availability" clearly, keeps a browsable public profile, and shows no slot-selection action. Inactive/deactivated doctors never appear in public results (already enforced by existing RLS). Default sort: soonest-next-slot first, then no-availability doctors last.
**Notes:** None.

---

## Availability filter semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Preset toggle only | e.g. single "available this week" checkbox | |
| Full date-range picker | Free-text answer from the user | ✓ |

**User's choice:** Simple date-range picker (start + end date) plus quick-select shortcuts: Today / Next 7 days / Next 30 days. Filter is optional. A doctor matches when they have at least one `availability_slots` row in the selected range, in the future, `status = 'available'`, not blocked/deleted/disabled. No range selected → all active doctors eligible. Combines with name/specialty/language/neighborhood via AND. Sort by soonest genuinely-available first slot.
**Notes:** None.

---

## Pagination of results

| Option | Description | Selected |
|--------|-------------|----------|
| Infinite scroll | Load more on scroll | |
| Classic numbered pagination | Free-text answer from the user | ✓ |

**User's choice:** Numbered pagination (Prev/Next + page numbers), 6 doctors per page, total result count shown, filters + page persisted in the URL query string, filter changes reset to page 1, pagination done server-side / at the Supabase query level (never load everything then slice client-side).
**Notes:** Example URL given: `/doctors?specialty=dermatology&language=en&location=tel-aviv&page=1` — later clarified as illustrative of query-param shape only, not a route rename (see Route naming below).

---

## Route naming clarification

| Option | Description | Selected |
|--------|-------------|----------|
| Keep `/search` (TASKS.md) | Search page stays at `/search`, profile at `/doctors/[id]`; the earlier URL example was illustrative only | ✓ |
| Rename to `/doctors` (list) | Search page becomes `/doctors`, detail stays `/doctors/[id]` | |

**User's choice:** Keep `/search` (TASKS.md).
**Notes:** Resolved a potential ambiguity from the pagination answer's example URL before it could propagate into planning.

---

## Phase boundary / booking CTA (volunteered alongside the four selected areas)

The user also proactively restated the phase boundary and a UX rule for the profile page, without a formal AskUserQuestion round: this phase covers only search/filter/sort/pagination/profile-viewing/read-only slot display — no booking, appointment creation, doctor-side availability editing, cancellation, or rescheduling (Phases 4/5). On the profile page, slots may show a call-to-action (e.g. "Select this slot") but it must be disabled/non-functional with a clear "available in a future phase" indication — never a control that looks functional but silently does nothing.

---

## Claude's Discretion

- Exact slot duration and business-hour window for the seed script (within "realistic consultation hours").
- Exact styling/wording of the "No upcoming availability" indicator and the disabled "Select this slot" CTA copy.
- Exact wording/styling of the "demo profile" indicator (PROFILE-02), reusing the existing `components/ui/badge.tsx` pattern.
- Exact URL query-param names (`q`, `specialty`, `language`, `neighborhood`, `availableFrom`, `availableTo`, `page`, etc.).

## Deferred Ideas

None — discussion stayed within phase scope.
