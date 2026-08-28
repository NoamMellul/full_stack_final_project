---
phase: quick-260827-gy6
plan: 01
subsystem: ui-polish
tags: [tailwind, css, rtl, playwright, ui-review]
status: complete
dependency-graph:
  requires: [06-UI-REVIEW.md, quick-260823-mn1]
  provides: [card-elevation, dense-list-spacing, header-gradient]
  affects: [app/doctor, app/patient, components/site-header, components/notification-bell]
tech-stack:
  added: []
  patterns:
    - "Tailwind v4 bg-linear-to-* gradient utility (v4-canonical name, not the bg-gradient-to-* v3 alias)"
    - "Vertical-axis gradients as the RTL-safe default for any gradient that must look identical in both writing directions"
key-files:
  created:
    - tests/e2e/visual-polish.spec.ts
  modified:
    - "app/doctor/(gated)/page.tsx"
    - app/patient/favorites/page.tsx
    - components/notification-bell.tsx
    - app/patient/page.tsx
    - app/patient/appointments/page.tsx
    - "app/doctor/(gated)/appointments/page.tsx"
    - components/site-header.tsx
decisions:
  - "Header gradient axis: vertical (bg-linear-to-b), not the audit's suggested horizontal 'to right' axis, because CSS gradient stops are plain custom properties and do not mirror under dir=rtl — confirmed empirically before applying the real fix (see Step A finding below)"
  - "bg-linear-to-b (Tailwind v4-canonical name) shipped a real linear-gradient on the first attempt; the bg-gradient-to-b v3-alias fallback was not needed"
  - "Solid bg-secondary removed entirely (not layered under the gradient) so the fade composites against the body background instead of resolving back to flat"
metrics:
  duration: 105min
  completed: 2026-08-27
actuals:
  tokens: 46000
  tasks: 3
  commits: 3
---

# Phase quick-260827-gy6 Plan 01: Apply the 3 remaining polish-level fixes Summary

Closed the three remaining polish-level items from the re-audited `06-UI-REVIEW.md` (score 17/24, no blockers): card elevation on doctor-dashboard stat cards and favorites rows, 12px separation on ten dense list/section containers, and an RTL-safe vertical gradient replacing the flat header fill — proven at runtime by a new `tests/e2e/visual-polish.spec.ts` that reads live computed styles rather than source CSS.

## What Was Built

**Task 1 — Card elevation (GY6-01).** Appended Tailwind's `shadow-sm` utility to the end of both doctor-dashboard stat-card class literals (`DoctorDashboardStatsSkeleton` and `DoctorDashboardStats` in `app/doctor/(gated)/page.tsx`) — kept as the identical literal string at both call sites, per the existing quick-260823-mn1 convention, so skeleton and loaded states stay pixel-identical apart from the number. Appended the same utility to the favorites row `Card` in `app/patient/favorites/page.tsx` (`relative shadow-sm`, `relative` kept first so the absolutely-positioned `FavoriteToggle` heart is unaffected). New Playwright tests read the live computed `box-shadow` on both surfaces and assert it is neither empty nor `none`.

**Task 2 — 12px dense-list separation (GY6-02).** Converted exactly ten container/skeleton `gap-2` sites to `gap-3` across four files:
- `components/notification-bell.tsx`: the loading-skeleton column and the notification row `<ul>`
- `app/patient/page.tsx`: `UpcomingSummarySkeleton`'s column and the upcoming-heading section wrapper
- `app/patient/appointments/page.tsx`: `AppointmentListSkeleton`, the `upcoming-section` wrapper, the `past-section` wrapper
- `app/doctor/(gated)/appointments/page.tsx`: the same three sites as the patient appointments page

**Task 3 — RTL-investigated header gradient (GY6-03).** Investigated first (Step A), then replaced the header's flat `bg-secondary` fill with a vertical two-stop gradient `bg-linear-to-b from-secondary to-secondary/70` in `components/site-header.tsx`, removing the solid fill entirely rather than layering the gradient on top of it. Extended `tests/e2e/visual-polish.spec.ts` with a second describe block proving the real gradient, the transparent background-color, and dir=ltr/dir=rtl byte-identity at runtime.

## Step A: RTL Investigation (recorded finding)

Before applying any fix, a temporary horizontal gradient (`bg-linear-to-r from-secondary to-secondary/70`) was applied to the header and its live computed `background-image` was read under `dir=ltr` and then again after switching the interface to Hebrew (`dir=rtl`), using a throwaway Playwright spec deleted immediately after the observation.

**Observed LTR:**
```
linear-gradient(to right, lab(96.52 -0.0000596046 0) 0%, oklab(0.969998 -0.00000968575 0.0000226498 / 0.7) 100%)
```

**Observed RTL:**
```
linear-gradient(to right, lab(96.52 -0.0000596046 0) 0%, oklab(0.969998 -0.00000968575 0.0000226498 / 0.7) 100%)
```

**Conclusion:** byte-identical. The gradient stayed `to right` (physically left-to-right) under `dir=rtl` instead of flipping to fade from the reading origin — confirming Tailwind's `--tw-gradient-*` stops are plain CSS custom properties with no writing-direction awareness, and that a horizontal axis would have faded in a direction unrelated to Hebrew reading flow. This is why the shipped fix uses the vertical axis (`bg-linear-to-b`) instead, which is identical in both directions by construction. The temporary horizontal class was reverted before the real fix was applied.

## Which Gradient Utility Shipped

`bg-linear-to-b` — the Tailwind v4-canonical name. The live computed `background-image` came back as a real `linear-gradient(...)` on the first attempt (verified by `tests/e2e/visual-polish.spec.ts`'s "header computed background-image is a real linear-gradient" test), so the `bg-gradient-to-b` v3-alias fallback described in the plan's Step C was never needed.

## Stale-Audit Finding (corrected)

`06-UI-REVIEW.md`'s Closing Recommendation 2 names `AppointmentRow` (patient appointments) and `DashboardAppointmentRow` (patient dashboard) as the `gap-2` offenders. All three row components — `AppointmentRow` in `app/patient/appointments/page.tsx`, `DashboardAppointmentRow` in `app/patient/page.tsx`, and `AppointmentRow` in `app/doctor/(gated)/appointments/page.tsx` — already rendered their row contents at `gap-3` (12px) before this plan started; that part of the audit was stale and none of the three were re-edited. The real remaining 8px sites were the section/list **container** wrappers and their **loading skeletons**, which is exactly what Task 2 changed.

## Deliberate Non-Changes

- `components/notification-bell.tsx`'s `<li className="flex items-start gap-2 py-1">` — separates a `size-2` unread dot from its own row's text; widening it would visually detach the dot from the row it marks.
- `app/patient/favorites/page.tsx`'s avatar+name row `gap-2` — a within-row pairing, not a between-row separation; out of scope for this plan.
- The reschedule-dialog internals in `app/patient/appointments/page.tsx` (reason field, loading skeleton, error state).
- The cancel-dialog reason-field column in `app/doctor/(gated)/appointments/page.tsx`.
- `components/admin/admin-nav.tsx` — renders a second flat `bg-secondary` bar directly beneath the header on every `/admin` page. Gradienting the header alone leaves a subtle lightness step at that seam; left unchanged per the plan's explicit scope discipline (targets the site header only). Eyeballed on `/admin` during manual verification — the seam reads as acceptable, not as a mismatched step.

## Verification

- `npx tsc --noEmit` — clean across all three tasks.
- `npx eslint` — clean across all seven modified files plus the new spec.
- Per-file class-count gates: doctor-dashboard elevation literal count = 2, favorites elevation literal count = 1, both exact per the plan's grep gates.
- Dense-list gap counts, all four files exactly matched the plan's targets: `components/notification-bell.tsx` 2/2 (gap-2/gap-3), `app/patient/page.tsx` 1/6, `app/patient/appointments/page.tsx` 5/10, `app/doctor/(gated)/appointments/page.tsx` 1/8.
- `git diff --exit-code -- package.json package-lock.json` — clean, zero new dependencies.
- Physical-direction Tailwind utility grep across `app/` and `components/` (excluding `components/ui/`) — zero matches, five-phase RTL invariant still holds.
- `tests/e2e/visual-polish.spec.ts` (new, 5 tests) — all pass: elevation reads non-`none` on both surfaces, header `background-image` is a real `linear-gradient`, header `background-color` is transparent (`rgba(0, 0, 0, 0)`), gradient string byte-identical across `dir=ltr`/`dir=rtl`.

## Full Playwright Regression Sweep

**Result: 415 passed / 3 failed** (full unfiltered `npx playwright test` run, ~38 minutes).

| # | Failure | Classification |
|---|---------|-----------------|
| 1 | `appointment-reschedule.spec.ts:764` — `afterAll` hook 30s cleanup timeout | Pre-existing tracked class (WINDOWS.md shared-dev-DB residue pattern, recurring across nearly every Phase 06 plan). Surface (`/patient/appointments`) was touched by Task 2, so re-run in isolation: **11/11 passed cleanly**, confirming the timeout was a full-suite-session artifact, not caused by this plan. |
| 2 | `seed-availability.spec.ts:173` — doctor slot count 3 < 6 | Exact known WINDOWS.md tracked flaky baseline (ids 1/3/5/7/8/9/10/11/12/16). Pure database-query test, no `page.goto()`, no UI surface this plan touched — classified without isolation re-run, consistent with every prior Phase 06 plan's treatment of this same recurring finding. |
| 3 | `visual-polish.spec.ts:44` — card elevation, computed `box-shadow` came back empty | New test from this plan, on a styled surface (`/doctor`). Re-run in isolation: **5/5 passed cleanly** (including this exact test). Transient — consistent with the tracked Supabase-Auth-under-load flakiness class surfacing during a long, continuous 38-minute session creating many test accounts. |

No new failure was genuinely caused by this plan's class changes; all three were independently reconfirmed pre-existing/transient via isolated re-runs (or, for #2, via the established no-UI-surface exemption already used by every prior Phase 06 plan).

## Deviations from Plan

None — plan executed exactly as written, including the Step A empirical RTL investigation and the Step C gradient-naming guard (which resolved on the first attempt with no fallback needed).

## Self-Check: PASSED

- `app/doctor/(gated)/page.tsx` — FOUND, elevation literal present at both stat-card sites
- `app/patient/favorites/page.tsx` — FOUND, `relative shadow-sm` present
- `components/notification-bell.tsx` — FOUND, gap-3 conversions present
- `app/patient/page.tsx` — FOUND, gap-3 conversions present
- `app/patient/appointments/page.tsx` — FOUND, gap-3 conversions present
- `app/doctor/(gated)/appointments/page.tsx` — FOUND, gap-3 conversions present
- `components/site-header.tsx` — FOUND, vertical gradient present
- `tests/e2e/visual-polish.spec.ts` — FOUND, 5 tests across 2 describe blocks
- Commit `ce4142f` — FOUND in `git log`
- Commit `d7354ea` — FOUND in `git log`
- Commit `254ac57` — FOUND in `git log`
