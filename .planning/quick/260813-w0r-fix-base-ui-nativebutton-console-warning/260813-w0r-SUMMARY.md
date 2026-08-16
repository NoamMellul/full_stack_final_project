---
phase: quick-260813-w0r
plan: 01
subsystem: ui
tags: [base-ui, playwright, accessibility, button, testing]

# Dependency graph
requires: []
provides:
  - "components/ui/button.tsx derives nativeButton from render presence, closing the Base UI console warning for all 10 Button render={<Link/>} call sites centrally"
  - "tests/e2e/button-native-semantics.spec.ts: regression coverage proving both warning directions stay silent"
  - "10 existing Playwright selectors realigned to the new accessible role (link -> button) their target controls now carry"
affects: [tests/e2e]

# Actuals (#2632)
actuals:
  tokens: 2780
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Deriving a Base UI primitive's semantic-defaulting prop (nativeButton) from another prop's presence (render), rather than hardcoding a value, so a future caller with a real <button> target still gets the correct native semantics for free"

key-files:
  created:
    - tests/e2e/button-native-semantics.spec.ts
  modified:
    - components/ui/button.tsx
    - tests/e2e/patient-dashboard.spec.ts
    - tests/e2e/patient-favorites.spec.ts
    - tests/e2e/doctor-profile.spec.ts
    - tests/e2e/appointment-booking.spec.ts
    - tests/e2e/appointment-history.spec.ts

key-decisions:
  - "nativeButton pulled out of the destructured props parameter (alongside className/variant/size) so ...props cannot duplicate it; nativeButton={nativeButton ?? !props.render} passed to ButtonPrimitive, so an explicit caller value always wins and the derived default only applies when the caller omitted it"
  - "10 getByRole('link', ...) selectors across 5 spec files switched to getByRole('button', ...) as a direct mechanical consequence of Base UI now stamping role='button' on every render={<Link/>} control; the 3 negative/paired assertions (appointment-history.spec.ts:428/455, appointment-cancel.spec.ts:880) were left untouched since they remain correct under either role"

patterns-established: []

requirements-completed: [QUICK-260813-w0r]

coverage:
  - id: D1
    description: "Loading /patient as an authenticated patient in dev mode produces zero Base UI nativeButton console errors (forward direction: Button render={<Link/>})"
    requirement: "QUICK-260813-w0r"
    verification:
      - kind: e2e
        ref: "tests/e2e/button-native-semantics.spec.ts#forward: Button render={<Link/>} quick links on /patient render as real anchors with zero nativeButton warnings"
        status: pass
    human_judgment: false
  - id: D2
    description: "The reverse composition (a Base UI part with render={<Button/>}, e.g. DialogPrimitive.Close in dialog.tsx) still renders a real <button> element and emits zero inverse nativeButton console errors"
    requirement: "QUICK-260813-w0r"
    verification:
      - kind: e2e
        ref: "tests/e2e/button-native-semantics.spec.ts#reverse: DialogPrimitive.Close render={<Button/>} still renders a real <button> with zero nativeButton warnings"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every Button render={<Link/>} control still renders an <a> that carries its href and is still reachable/clickable by an end user, across all 10 call sites exercised by the existing Playwright suite"
    requirement: "QUICK-260813-w0r"
    verification:
      - kind: e2e
        ref: "tests/e2e/patient-dashboard.spec.ts, tests/e2e/patient-favorites.spec.ts, tests/e2e/doctor-profile.spec.ts, tests/e2e/appointment-booking.spec.ts, tests/e2e/appointment-history.spec.ts (all 6 target spec files, isolated re-runs)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Playwright suite shows no new failures attributable to this change beyond the shared-dev-DB/Supabase-rate-limit residue class already tracked in .planning/WINDOWS.md"
    requirement: "QUICK-260813-w0r"
    verification:
      - kind: e2e
        ref: "npx playwright test --reporter=list --workers=1 (full suite, 309 passed/19 failed/40.2min); all 19 failures classified against WINDOWS.md ids 1/2/4/9/11/12 and logged as new recurrence id 13"
        status: pass
    human_judgment: false

duration: ~2h10m (spans two sessions across 2026-08-13 and 2026-08-16; prior session stalled mid-Task-2 on a 600s watchdog, not a real failure)
completed: 2026-08-16
status: complete
---

# Quick Task 260813-w0r: Fix Base UI nativeButton console warning Summary

**`components/ui/button.tsx` now derives its `nativeButton` prop from `render` presence (`nativeButton ?? !props.render`), closing the Base UI console warning across all 10 `Button render={<Link/>}` call sites with zero call-site changes, proven silent in both directions by a new Playwright spec, with the 10 mechanically-required selector realignments this causes.**

## Performance

- **Duration:** ~2h10m total across two sessions (2026-08-13 23:15 Task 1 commits, 2026-08-16 09:51 Task 2 commit, plus this session's verification and closure). The prior executor run stalled mid-Task-2 on a 600s tool watchdog after completing all of Task 2's file edits but before running its `<verify>` or committing — resumed here, not restarted.
- **Tasks:** 3/3 complete
- **Files modified:** 6 (1 new spec, 1 production file, 5 existing spec files)

## Accomplishments
- `components/ui/button.tsx`'s `nativeButton` prop now defaults from `render` presence instead of Base UI's blanket `true`, closing a console warning that had been open since phase 06-10 and polluted `/search`, `/patient`, and every dashboard in dev mode
- New `tests/e2e/button-native-semantics.spec.ts` proves both warning directions stay silent: the forward direction (`Button render={<Link/>}` on `/patient`) and the reverse direction (`DialogPrimitive.Close render={<Button/>}` in the add-slot dialog on `/doctor/schedule`)
- RED was observed and recorded before the fix: pre-fix, the quick links resolved to accessible role `link` (not `button`), and the collected `nativeButton` console-error array was non-empty
- 10 existing `getByRole("link", ...)` selectors across 5 spec files realigned to `getByRole("button", ...)`, the direct mechanical consequence of Base UI now stamping `role="button"` on every `render={<Link/>}` control; the 3 negative/paired assertions that remain correct under either role were left untouched
- Full-suite closure run (309 passed/19 failed, 40.2min) confirmed zero regressions attributable to this change; all 19 failures independently re-verified as recurrences of the already-tracked shared-dev-DB/Supabase-Auth-rate-limiting flakiness class, logged as WINDOWS.md id 13

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end — the wrapper defaults nativeButton from render, proven silent in both directions** - `a99b227` (test, RED) + `4eadb2f` (feat, GREEN)
2. **Task 2: Realign the 10 existing role-based selectors the accessible-role flip invalidates** - `295d2aa` (test)
3. **Task 3: Full-suite regression sweep and closure** - no code changes (verification-only task); `.planning/WINDOWS.md` updated with recurrence entry id 13 (docs artifact, left for the orchestrator's docs commit)

_Note: TDD Task 1 used the test → feat commit pattern (RED → GREEN)._

## Files Created/Modified
- `tests/e2e/button-native-semantics.spec.ts` - New regression spec: forward direction (patient dashboard quick links render as real `<a>` with accessible role `button` and zero `nativeButton` warnings) and reverse direction (dialog Close control resolves to a real `<button>` DOM element)
- `components/ui/button.tsx` - `nativeButton` pulled out of the destructured props parameter; `nativeButton={nativeButton ?? !props.render}` passed to `ButtonPrimitive`, with an explanatory comment
- `tests/e2e/patient-dashboard.spec.ts` - 4 selectors realigned (`Find a doctor`, `Search doctors`, `My favorites`, `Appointment history`)
- `tests/e2e/patient-favorites.spec.ts` - 1 selector realigned (`Find a doctor`)
- `tests/e2e/doctor-profile.spec.ts` - 1 selector realigned (`Back to search`)
- `tests/e2e/appointment-booking.spec.ts` - 1 selector realigned (`Find a doctor`)
- `tests/e2e/appointment-history.spec.ts` - 3 selectors realigned (`Find a doctor`, `My appointments`, `Appointment history`)

## Decisions Made
- `nativeButton` derives from `!props.render` rather than being hardcoded `false`, so an explicit caller-supplied `nativeButton` value always wins and any future call site that passes a real `<button>`-shaped `render` target keeps correct native semantics automatically — this is what Task 1's reverse-direction test empirically confirms rather than just asserts by code inspection
- The 10 role-selector realignments in Task 2 changed nothing but the role string on each line (same accessible name, same matcher, same following assertion) — line numbers were matched by accessible-name string per the plan's instruction, since editing shifted them from the originally-cited numbers

## Deviations from Plan

None - plan executed exactly as written. All auto-fix rules (1-4) were not triggered; the wrapper change, selector realignment, and full-suite sweep proceeded exactly per the plan's `<action>` and `<critical_context>` sections.

### RED evidence (Task 1)

The RED observation was captured by the prior executor session (2026-08-13) and is recorded in commit `a99b227`'s message: pre-fix, the forward-direction test failed because the quick links resolved to accessible role `link` (not `button`), and separately because Base UI's `nativeButton` console-error collector was non-empty. The prior session's exact captured console-error string text is not independently recoverable in this session (git commit messages summarize but do not include the raw string); this is noted rather than invented per this session's continuation instructions. The GREEN state (both tests passing after the wrapper edit) was independently re-verified in this session's full-suite run (`button-native-semantics.spec.ts` — both tests passed, see full-suite output line 161-162).

## Issues Encountered

**Full-suite closure run required extensive isolation testing to classify failures confidently.** The Task 2 full-file-list run (`patient-dashboard`, `patient-favorites`, `doctor-profile`, `appointment-booking`, `appointment-history`, `appointment-cancel` specs) initially showed cascading failures in `appointment-cancel.spec.ts` (12 tests) and one `appointment-history.spec.ts` test ("Empty state, both pages") — none of these touch this task's modified lines (appointment-cancel.spec.ts was not modified by this task at all). Re-running each affected spec file in isolation (after a cooldown pause) confirmed 100% pass rates: `appointment-history.spec.ts` 11/11, `appointment-cancel.spec.ts` 18/18, `appointment-booking.spec.ts` 13/13 — establishing these were transient Supabase Auth/Admin-API rate-limiting artifacts from the shared dev database under this session's repeated test-suite load, consistent with the extensively pre-documented flakiness class in `.planning/WINDOWS.md` (ids 1-12) and `.planning/STATE.md`'s blockers section. The Task 3 full-suite sweep (309 passed/19 failed, 40.2min) showed a worse-than-usual admin-cluster cascade (`admin-doctor-crud`, `admin-doctor-link-account` x7, `admin-doctor-status` x3, `admin-oversight-views`, `admin-reference-data` x2, `admin-route-protection`) plus the byte-identical recurring `seed-availability.spec.ts:170` (doctor slot count 3<6) and `appointment-reschedule.spec.ts` (3 failures, already independently re-verified passing 10/10 in isolation earlier in this session). Every one of these 19 failures was individually classified against the exact symptom signatures already logged in WINDOWS.md ids 1, 2, 4, 9, and 11, and a new ledger entry (id 13) was recorded documenting the full triage. Zero failures touch a `Button`'s rendered role, accessible name, or activation.

**A prior executor run's external `timeout 170` wrapper produced a false-negative reading on `appointment-booking.spec.ts` test 1** early in this session — the wrapper killed the Playwright process mid-run after 170s, truncating output and showing a spurious failure on `APPT-01: a patient books one slot`. Re-running without an external kill-timeout (using proper background execution instead) showed this test passing cleanly (24.2s), confirming the original "failure" was an artifact of the harness-level timeout, not a real test failure — consistent with this quick task's premise that the prior stall was a 600s watchdog kill, not a real failure.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The Base UI `nativeButton` console warning is closed centrally; no further Button-related follow-up is needed for this deferred item (`.planning/phases/06-dashboards-notifications-localization/deferred-items.md:101`)
- `.planning/WINDOWS.md` now has 13 open entries (was 12), all pre-existing shared-dev-DB/Supabase-Auth-rate-limiting flakiness — none introduced by this task. A project reset or manual test-residue cleanup before final demo/grading (already flagged in STATE.md blockers since phase 02) would resolve the majority of these recurring failures; the admin cluster's rate-limiting symptoms specifically suggest spacing out full-suite runs against the shared dev Supabase project, or running against a dedicated/local instance for high-frequency test iteration
- No blockers for subsequent work

---
*Phase: quick-260813-w0r*
*Completed: 2026-08-16*

## Self-Check: PASSED

All 9 claimed files verified present on disk (components/ui/button.tsx, tests/e2e/button-native-semantics.spec.ts, tests/e2e/patient-dashboard.spec.ts, tests/e2e/patient-favorites.spec.ts, tests/e2e/doctor-profile.spec.ts, tests/e2e/appointment-booking.spec.ts, tests/e2e/appointment-history.spec.ts, this SUMMARY.md, .planning/WINDOWS.md). All 3 claimed commit hashes verified present in `git log --oneline --all` (a99b227, 4eadb2f, 295d2aa).
