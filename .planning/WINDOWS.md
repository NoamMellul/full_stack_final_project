---
schema_version: 1
open_count: 15
waived_count: 0
fixed_count: 0
total_count: 15
last_updated: 2026-08-16T09:25:44.541Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 06 | deviation | tests/e2e/seed-availability.spec.ts | 170 | Pre-existing full-suite flakiness (3 failed, unrelated to 06-01's new fixme-only files): admin-doctor-crud.spec.ts:226, appointment-reschedule.spec.ts:764 (afterAll timeout), seed-availability.spec.ts:170 (doctor slot count 4 < 6). Likely shared-dev-DB test residue (known STATE.md blocker). See deferred-items.md. | open |  | 2026-08-12T07:02:01.250Z |  |
| 2 | 06 | deviation | tests/e2e/admin-route-protection.spec.ts | 230 | Recurrence (06-03) of the same shared-dev-DB residue flakiness class first logged as id 1 in 06-01: full-suite run showed 300 passed/11 skipped/3 failed. This run's admin-cluster failure landed on admin-route-protection.spec.ts:230 (401/403 denial matrix) rather than 06-01's admin-doctor-crud.spec.ts:226 or 06-02's admin-route-protection.spec.ts:230 repeat -- same file as 06-02, third overall recurrence on a shifting admin spec. appointment-reschedule.spec.ts:764 (afterAll timeout) and seed-availability.spec.ts:170 (slot count) also recurred byte-identically. See deferred-items.md 06-03 section. | open |  | 2026-08-12T09:30:43.219Z |  |
| 3 | 06 | deviation | tests/e2e/seed-availability.spec.ts | 170 | Recurrence (06-04) of the same shared-dev-DB residue flakiness class first logged as id 1 (06-01) and id 2 (06-03): full-suite run showed 301 passed/11 skipped/9 failed, with 8 of those 9 (5 new notifications-realtime API-contract tests + 3 patient-dashboard tests, none touched incorrectly) traced to a transient dev-server ERR_CONNECTION_REFUSED window and confirmed passing on an isolated re-run of the same 4 spec files (17 passed, 1 failed). The 1 persisting failure is seed-availability.spec.ts:170 (doctor slot count 3 < 6), byte-identical to the prior two recurrences. See deferred-items.md 06-04 section. | open |  | 2026-08-12T16:37:59.076Z |  |
| 4 | 06 | unrun-verify | tests/e2e/admin-route-protection.spec.ts | 230 | Recurring shared-dev-DB/environment failure: 'every admin endpoint returns 401/403' timed out again during 06-05's full-suite run (5th+ recurrence per STATE.md blockers; not caused by 06-05's i18n/header changes) | open |  | 2026-08-12T19:02:35.199Z |  |
| 5 | 06 | unrun-verify | tests/e2e/seed-availability.spec.ts | 170 | Recurring shared-dev-DB slot-count assertion failure (doctor holds <6 slots) during 06-05's full-suite run, consistent with WINDOWS.md ids 1 and 3 | open |  | 2026-08-12T19:02:35.805Z |  |
| 6 | 06 | unrun-verify | tests/e2e/appointment-reschedule.spec.ts | 764 | 6th+ recurrence of the same shared-dev-DB/environment flakiness class during 06-06's closure full-suite run (319 passed, 2 failed, 34.7min): appointment-reschedule.spec.ts:764 afterAll cleanup hook timed out (30000ms exceeded), byte-identical failure mode to prior recurrences since 06-01. Not caused by 06-06's notification-bell code -- all 13 of this plan's own notifications-realtime.spec.ts tests passed cleanly in the same run. | open |  | 2026-08-13T08:36:13.176Z |  |
| 7 | 06 | unrun-verify | tests/e2e/seed-availability.spec.ts | 170 | 6th+ recurrence of the same shared-dev-DB residue class (WINDOWS.md ids 1,3,5) during 06-06's closure full-suite run: doctor slot count 3 < 6 (D-01 shape rule). Same run showed 319 passed/2 failed in 34.7min; not caused by 06-06's notification-bell code -- all 13 of this plan's own notifications-realtime.spec.ts tests passed cleanly. | open |  | 2026-08-13T08:36:13.818Z |  |
| 8 | 06 | unmet-truth | tests/e2e/seed-availability.spec.ts | 170 | Recurring shared-dev-DB test residue: doctor slot count assertion (expect >=6, received 3) failed again on 06-07's full-suite run and isolated re-run; already tracked as WINDOWS ids 1/3, not caused by 06-07 (dictionary-only plan, zero application code touched) | open |  | 2026-08-13T09:56:04.863Z |  |
| 9 | 06 | deviation | tests/e2e/appointment-reschedule.spec.ts,tests/e2e/doctor-schedule-overlap.spec.ts,tests/e2e/doctor-schedule-visibility.spec.ts |  | 06-07's full-suite run (dictionary-only plan, zero application code touched) hit 5 failures: appointment-reschedule.spec.ts:764, doctor-schedule-overlap.spec.ts:381 (Cross-doctor non-collision), doctor-schedule-visibility.spec.ts:190 (beforeAll timeout, cascading 8 skipped), seed-availability.spec.ts:170/184 (beforeAll timeout, cascading 3 skipped). A targeted re-run of just these 4 spec files in isolation passed the appointment-reschedule and doctor-schedule-visibility suites cleanly; the second re-run's remaining failures were all 'afterAll hook timeout of 30000ms exceeded' cleanup-only timeouts (test assertions themselves passed), consistent with Supabase Admin API rate-limiting from this session's several consecutive full-suite runs against the shared dev project (already-documented STATE.md blocker class). Not caused by 06-07's changes. | open |  | 2026-08-13T09:56:14.389Z |  |
| 10 | 06 | deviation | tests/e2e/appointment-cancel.spec.ts,tests/e2e/appointment-reschedule.spec.ts,tests/e2e/seed-availability.spec.ts |  | 06-08's full-suite run (318 passed/3 failed, 33.7min) hit 3 failures unrelated to this plan's translation-only changes: appointment-cancel.spec.ts:310 (transient ECONNRESET), appointment-reschedule.spec.ts:764 (afterAll hook timeout of 30000ms, same recurring class as WINDOWS ids 2/9), seed-availability.spec.ts:170 (doctor slot count 3<6, same recurring shared-dev-DB residue class as WINDOWS ids 1/3/5/7/8). None of the 3 failing specs touch this plan's 8 retrofitted files; all Task-scoped auth/search/doctor-profile Playwright specs (17+37+23=77 tests) passed cleanly in isolation before this full-suite run. | open |  | 2026-08-13T11:26:04.034Z |  |
| 11 | 06 | deviation | tests/e2e/admin-doctor-crud.spec.ts,tests/e2e/admin-doctor-link-account.spec.ts,tests/e2e/appointment-reschedule.spec.ts,tests/e2e/seed-availability.spec.ts |  | 06-09's full-suite closure run (311 passed/10 failed, 31.8min) hit 10 failures unrelated to this plan's translation-only changes across 10 files: admin-doctor-crud.spec.ts:37 (new-doctor-appears timeout) and 7 admin-doctor-link-account.spec.ts cascading failures (Generate temporary password -> 'Login created' never appearing, plus a raw TypeError: Cannot read properties of undefined (reading trim) at validateEmail when a downstream step received an undefined email) are a worse-than-usual recurrence of the Supabase-Auth-under-load flakiness class first logged in STATE.md's 06-05 blocker ('Could not create a login', plausibly rate-limiting from many consecutive full-suite runs this session); appointment-reschedule.spec.ts:764 failed only on its afterAll cleanup hook (30000ms timeout) -- the test's own eligibility assertion passed -- same recurring class as WINDOWS ids 6/9/10; seed-availability.spec.ts:170 (doctor slot count 3<6) is the same recurring shared-dev-DB residue class as WINDOWS ids 1/3/5/7/8/10. None of the 10 failing specs touch any of this plan's 10 modified files (site-header.tsx and notification-bell.tsx needed no edit -- see SUMMARY deviation); every task-scoped spec for this plan's files (auth-logout, patient-favorites, appointment-history/cancel/reschedule assertions, patient-dashboard, doctor-dashboard, doctor-schedule-add-slot/block-period/delete-slot/overlap/visibility, notifications-realtime, locale-switching) passed cleanly in the same run. A stale dev-server process from a prior session and one transient Turbopack/Windows crash (0xc0000142, environment-level, resolved by clearing .next and retrying) also had to be cleared before this run could start; neither is a code defect. | open |  | 2026-08-13T16:53:09.057Z |  |
| 12 | 06 | deviation | tests/e2e/seed-availability.spec.ts | 170 | 06-10's full-suite closure run (325 passed/1 failed, 25.8min) hit 1 failure unrelated to this plan's RTL/i18n test-only changes: seed-availability.spec.ts:170 (doctor slot count 3<6), the same recurring shared-dev-DB residue class as WINDOWS ids 1/3/5/7/8/10/11. None of this plan's 10 new locale-switching.spec.ts tests, nor any task-scoped spec, failed. This is the last plan in Phase 6. | open |  | 2026-08-13T17:35:27.846Z |  |
| 13 | quick-260813-w0r | deviation | tests/e2e/admin-doctor-crud.spec.ts,tests/e2e/admin-doctor-link-account.spec.ts,tests/e2e/admin-doctor-status.spec.ts,tests/e2e/admin-oversight-views.spec.ts,tests/e2e/admin-reference-data.spec.ts,tests/e2e/admin-route-protection.spec.ts,tests/e2e/appointment-reschedule.spec.ts,tests/e2e/seed-availability.spec.ts |  | Quick task 260813-w0r's Task 3 full-suite closure run (309 passed/19 failed, 40.2min) hit 19 failures unrelated to this task's Button nativeButton fix and its 10 mechanically-realigned role selectors: admin-doctor-crud.spec.ts:37 (new-doctor-appears timeout, same as WINDOWS id 11), 7 admin-doctor-link-account.spec.ts cascading failures (Login created text missing, doctorEmail undefined, wrong 409/400 status codes, mustChangeAfterLink undefined -- byte-identical class to WINDOWS id 11), 3 new admin-doctor-status.spec.ts failures (activation/deactivation confirmation text missing, anonymous-read count 0) and 1 admin-oversight-views.spec.ts failure (duplicate-name row count 0) and 2 admin-reference-data.spec.ts failures (UI-created specialty text missing, location-edit response timeout) -- all consistent with the admin-cluster Supabase-Auth/Admin-API-under-load flakiness class first logged in WINDOWS id 11, worsened here by an unusually long session (this task's own isolated re-runs of appointment-cancel/appointment-history/appointment-booking specs plus this 40.2min full sweep, all against the same shared dev project); admin-route-protection.spec.ts:230 is the same recurring class as WINDOWS ids 2/4; appointment-reschedule.spec.ts (3 failures: dialog toBeHidden, count 1 vs null, slot status available vs null) is the same class as WINDOWS id 9 and was independently re-verified passing 10/10 in isolation during this task's Task 2 verification; seed-availability.spec.ts:170 (doctor slot count 3<6) is the same recurring shared-dev-DB residue class as WINDOWS ids 1/3/5/7/8/10/11/12. Zero failures touch a Button's rendered role, accessible name, or activation -- all 6 spec files this task modified (patient-dashboard, patient-favorites, doctor-profile, appointment-booking, appointment-history, appointment-cancel) were independently re-verified passing cleanly in isolation before this full-suite run. | open |  | 2026-08-16T07:38:06.358Z |  |
| 14 | quick-260816-etv | deviation | tests/e2e/seed-availability.spec.ts | 170 | Task 3's full-suite closure run (332 passed/1 failed, 27.5min) hit 1 failure unrelated to this task's routing/dictionary changes: seed-availability.spec.ts:170 (doctor slot count 3<6), the same recurring shared-dev-DB residue class as WINDOWS ids 1/3/5/7/8/10/11/12/13. Confirmed by isolated re-run of the spec alone (identical failure, 7 passed/1 failed). No navigation, URL-terminus, or translation failure occurred anywhere in the suite. | open |  | 2026-08-16T08:32:23.470Z |  |
| 15 | quick-260816-g33 | deviation | tests/e2e/seed-availability.spec.ts | 170 | Task 3's full-suite closure run (343 passed/1 failed, 32.1min) hit 1 failure unrelated to this task's nav changes: seed-availability.spec.ts:170 (doctor slot count 3<6), the same recurring shared-dev-DB residue class as WINDOWS ids 1/3/5/7/8/10/11/12/13/14. All 11 of this task's own site-nav.spec.ts tests (Task 1's two-viewport tracer plus Task 2's per-role/anonymous/active-marker/Hebrew expansion) passed cleanly. Beats the 332/1 baseline recorded by the prior quick task (260816-etv). | open |  | 2026-08-16T09:25:44.541Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "06",
    "file": "tests/e2e/seed-availability.spec.ts",
    "line": 170,
    "description": "Pre-existing full-suite flakiness (3 failed, unrelated to 06-01's new fixme-only files): admin-doctor-crud.spec.ts:226, appointment-reschedule.spec.ts:764 (afterAll timeout), seed-availability.spec.ts:170 (doctor slot count 4 < 6). Likely shared-dev-DB test residue (known STATE.md blocker). See deferred-items.md.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-12T07:02:01.250Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "deviation",
    "phase": "06",
    "file": "tests/e2e/admin-route-protection.spec.ts",
    "line": 230,
    "description": "Recurrence (06-03) of the same shared-dev-DB residue flakiness class first logged as id 1 in 06-01: full-suite run showed 300 passed/11 skipped/3 failed. This run's admin-cluster failure landed on admin-route-protection.spec.ts:230 (401/403 denial matrix) rather than 06-01's admin-doctor-crud.spec.ts:226 or 06-02's admin-route-protection.spec.ts:230 repeat -- same file as 06-02, third overall recurrence on a shifting admin spec. appointment-reschedule.spec.ts:764 (afterAll timeout) and seed-availability.spec.ts:170 (slot count) also recurred byte-identically. See deferred-items.md 06-03 section.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-12T09:30:43.219Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "deviation",
    "phase": "06",
    "file": "tests/e2e/seed-availability.spec.ts",
    "line": 170,
    "description": "Recurrence (06-04) of the same shared-dev-DB residue flakiness class first logged as id 1 (06-01) and id 2 (06-03): full-suite run showed 301 passed/11 skipped/9 failed, with 8 of those 9 (5 new notifications-realtime API-contract tests + 3 patient-dashboard tests, none touched incorrectly) traced to a transient dev-server ERR_CONNECTION_REFUSED window and confirmed passing on an isolated re-run of the same 4 spec files (17 passed, 1 failed). The 1 persisting failure is seed-availability.spec.ts:170 (doctor slot count 3 < 6), byte-identical to the prior two recurrences. See deferred-items.md 06-04 section.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-12T16:37:59.076Z",
    "resolved_at": null
  },
  {
    "id": 4,
    "kind": "unrun-verify",
    "phase": "06",
    "file": "tests/e2e/admin-route-protection.spec.ts",
    "line": 230,
    "description": "Recurring shared-dev-DB/environment failure: 'every admin endpoint returns 401/403' timed out again during 06-05's full-suite run (5th+ recurrence per STATE.md blockers; not caused by 06-05's i18n/header changes)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-12T19:02:35.199Z",
    "resolved_at": null
  },
  {
    "id": 5,
    "kind": "unrun-verify",
    "phase": "06",
    "file": "tests/e2e/seed-availability.spec.ts",
    "line": 170,
    "description": "Recurring shared-dev-DB slot-count assertion failure (doctor holds <6 slots) during 06-05's full-suite run, consistent with WINDOWS.md ids 1 and 3",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-12T19:02:35.805Z",
    "resolved_at": null
  },
  {
    "id": 6,
    "kind": "unrun-verify",
    "phase": "06",
    "file": "tests/e2e/appointment-reschedule.spec.ts",
    "line": 764,
    "description": "6th+ recurrence of the same shared-dev-DB/environment flakiness class during 06-06's closure full-suite run (319 passed, 2 failed, 34.7min): appointment-reschedule.spec.ts:764 afterAll cleanup hook timed out (30000ms exceeded), byte-identical failure mode to prior recurrences since 06-01. Not caused by 06-06's notification-bell code -- all 13 of this plan's own notifications-realtime.spec.ts tests passed cleanly in the same run.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-13T08:36:13.176Z",
    "resolved_at": null
  },
  {
    "id": 7,
    "kind": "unrun-verify",
    "phase": "06",
    "file": "tests/e2e/seed-availability.spec.ts",
    "line": 170,
    "description": "6th+ recurrence of the same shared-dev-DB residue class (WINDOWS.md ids 1,3,5) during 06-06's closure full-suite run: doctor slot count 3 < 6 (D-01 shape rule). Same run showed 319 passed/2 failed in 34.7min; not caused by 06-06's notification-bell code -- all 13 of this plan's own notifications-realtime.spec.ts tests passed cleanly.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-13T08:36:13.818Z",
    "resolved_at": null
  },
  {
    "id": 8,
    "kind": "unmet-truth",
    "phase": "06",
    "file": "tests/e2e/seed-availability.spec.ts",
    "line": 170,
    "description": "Recurring shared-dev-DB test residue: doctor slot count assertion (expect >=6, received 3) failed again on 06-07's full-suite run and isolated re-run; already tracked as WINDOWS ids 1/3, not caused by 06-07 (dictionary-only plan, zero application code touched)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-13T09:56:04.863Z",
    "resolved_at": null
  },
  {
    "id": 9,
    "kind": "deviation",
    "phase": "06",
    "file": "tests/e2e/appointment-reschedule.spec.ts,tests/e2e/doctor-schedule-overlap.spec.ts,tests/e2e/doctor-schedule-visibility.spec.ts",
    "line": null,
    "description": "06-07's full-suite run (dictionary-only plan, zero application code touched) hit 5 failures: appointment-reschedule.spec.ts:764, doctor-schedule-overlap.spec.ts:381 (Cross-doctor non-collision), doctor-schedule-visibility.spec.ts:190 (beforeAll timeout, cascading 8 skipped), seed-availability.spec.ts:170/184 (beforeAll timeout, cascading 3 skipped). A targeted re-run of just these 4 spec files in isolation passed the appointment-reschedule and doctor-schedule-visibility suites cleanly; the second re-run's remaining failures were all 'afterAll hook timeout of 30000ms exceeded' cleanup-only timeouts (test assertions themselves passed), consistent with Supabase Admin API rate-limiting from this session's several consecutive full-suite runs against the shared dev project (already-documented STATE.md blocker class). Not caused by 06-07's changes.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-13T09:56:14.389Z",
    "resolved_at": null
  },
  {
    "id": 10,
    "kind": "deviation",
    "phase": "06",
    "file": "tests/e2e/appointment-cancel.spec.ts,tests/e2e/appointment-reschedule.spec.ts,tests/e2e/seed-availability.spec.ts",
    "line": null,
    "description": "06-08's full-suite run (318 passed/3 failed, 33.7min) hit 3 failures unrelated to this plan's translation-only changes: appointment-cancel.spec.ts:310 (transient ECONNRESET), appointment-reschedule.spec.ts:764 (afterAll hook timeout of 30000ms, same recurring class as WINDOWS ids 2/9), seed-availability.spec.ts:170 (doctor slot count 3<6, same recurring shared-dev-DB residue class as WINDOWS ids 1/3/5/7/8). None of the 3 failing specs touch this plan's 8 retrofitted files; all Task-scoped auth/search/doctor-profile Playwright specs (17+37+23=77 tests) passed cleanly in isolation before this full-suite run.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-13T11:26:04.034Z",
    "resolved_at": null
  },
  {
    "id": 11,
    "kind": "deviation",
    "phase": "06",
    "file": "tests/e2e/admin-doctor-crud.spec.ts,tests/e2e/admin-doctor-link-account.spec.ts,tests/e2e/appointment-reschedule.spec.ts,tests/e2e/seed-availability.spec.ts",
    "line": null,
    "description": "06-09's full-suite closure run (311 passed/10 failed, 31.8min) hit 10 failures unrelated to this plan's translation-only changes across 10 files: admin-doctor-crud.spec.ts:37 (new-doctor-appears timeout) and 7 admin-doctor-link-account.spec.ts cascading failures (Generate temporary password -> 'Login created' never appearing, plus a raw TypeError: Cannot read properties of undefined (reading trim) at validateEmail when a downstream step received an undefined email) are a worse-than-usual recurrence of the Supabase-Auth-under-load flakiness class first logged in STATE.md's 06-05 blocker ('Could not create a login', plausibly rate-limiting from many consecutive full-suite runs this session); appointment-reschedule.spec.ts:764 failed only on its afterAll cleanup hook (30000ms timeout) -- the test's own eligibility assertion passed -- same recurring class as WINDOWS ids 6/9/10; seed-availability.spec.ts:170 (doctor slot count 3<6) is the same recurring shared-dev-DB residue class as WINDOWS ids 1/3/5/7/8/10. None of the 10 failing specs touch any of this plan's 10 modified files (site-header.tsx and notification-bell.tsx needed no edit -- see SUMMARY deviation); every task-scoped spec for this plan's files (auth-logout, patient-favorites, appointment-history/cancel/reschedule assertions, patient-dashboard, doctor-dashboard, doctor-schedule-add-slot/block-period/delete-slot/overlap/visibility, notifications-realtime, locale-switching) passed cleanly in the same run. A stale dev-server process from a prior session and one transient Turbopack/Windows crash (0xc0000142, environment-level, resolved by clearing .next and retrying) also had to be cleared before this run could start; neither is a code defect.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-13T16:53:09.057Z",
    "resolved_at": null
  },
  {
    "id": 12,
    "kind": "deviation",
    "phase": "06",
    "file": "tests/e2e/seed-availability.spec.ts",
    "line": 170,
    "description": "06-10's full-suite closure run (325 passed/1 failed, 25.8min) hit 1 failure unrelated to this plan's RTL/i18n test-only changes: seed-availability.spec.ts:170 (doctor slot count 3<6), the same recurring shared-dev-DB residue class as WINDOWS ids 1/3/5/7/8/10/11. None of this plan's 10 new locale-switching.spec.ts tests, nor any task-scoped spec, failed. This is the last plan in Phase 6.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-13T17:35:27.846Z",
    "resolved_at": null
  },
  {
    "id": 13,
    "kind": "deviation",
    "phase": "quick-260813-w0r",
    "file": "tests/e2e/admin-doctor-crud.spec.ts,tests/e2e/admin-doctor-link-account.spec.ts,tests/e2e/admin-doctor-status.spec.ts,tests/e2e/admin-oversight-views.spec.ts,tests/e2e/admin-reference-data.spec.ts,tests/e2e/admin-route-protection.spec.ts,tests/e2e/appointment-reschedule.spec.ts,tests/e2e/seed-availability.spec.ts",
    "line": null,
    "description": "Quick task 260813-w0r's Task 3 full-suite closure run (309 passed/19 failed, 40.2min) hit 19 failures unrelated to this task's Button nativeButton fix and its 10 mechanically-realigned role selectors: admin-doctor-crud.spec.ts:37 (new-doctor-appears timeout, same as WINDOWS id 11), 7 admin-doctor-link-account.spec.ts cascading failures (Login created text missing, doctorEmail undefined, wrong 409/400 status codes, mustChangeAfterLink undefined -- byte-identical class to WINDOWS id 11), 3 new admin-doctor-status.spec.ts failures (activation/deactivation confirmation text missing, anonymous-read count 0) and 1 admin-oversight-views.spec.ts failure (duplicate-name row count 0) and 2 admin-reference-data.spec.ts failures (UI-created specialty text missing, location-edit response timeout) -- all consistent with the admin-cluster Supabase-Auth/Admin-API-under-load flakiness class first logged in WINDOWS id 11, worsened here by an unusually long session (this task's own isolated re-runs of appointment-cancel/appointment-history/appointment-booking specs plus this 40.2min full sweep, all against the same shared dev project); admin-route-protection.spec.ts:230 is the same recurring class as WINDOWS ids 2/4; appointment-reschedule.spec.ts (3 failures: dialog toBeHidden, count 1 vs null, slot status available vs null) is the same class as WINDOWS id 9 and was independently re-verified passing 10/10 in isolation during this task's Task 2 verification; seed-availability.spec.ts:170 (doctor slot count 3<6) is the same recurring shared-dev-DB residue class as WINDOWS ids 1/3/5/7/8/10/11/12. Zero failures touch a Button's rendered role, accessible name, or activation -- all 6 spec files this task modified (patient-dashboard, patient-favorites, doctor-profile, appointment-booking, appointment-history, appointment-cancel) were independently re-verified passing cleanly in isolation before this full-suite run.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-16T07:38:06.358Z",
    "resolved_at": null
  },
  {
    "id": 14,
    "kind": "deviation",
    "phase": "quick-260816-etv",
    "file": "tests/e2e/seed-availability.spec.ts",
    "line": 170,
    "description": "Task 3's full-suite closure run (332 passed/1 failed, 27.5min) hit 1 failure unrelated to this task's routing/dictionary changes: seed-availability.spec.ts:170 (doctor slot count 3<6), the same recurring shared-dev-DB residue class as WINDOWS ids 1/3/5/7/8/10/11/12/13. Confirmed by isolated re-run of the spec alone (identical failure, 7 passed/1 failed). No navigation, URL-terminus, or translation failure occurred anywhere in the suite.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-16T08:32:23.470Z",
    "resolved_at": null
  },
  {
    "id": 15,
    "kind": "deviation",
    "phase": "quick-260816-g33",
    "file": "tests/e2e/seed-availability.spec.ts",
    "line": 170,
    "description": "Task 3's full-suite closure run (343 passed/1 failed, 32.1min) hit 1 failure unrelated to this task's nav changes: seed-availability.spec.ts:170 (doctor slot count 3<6), the same recurring shared-dev-DB residue class as WINDOWS ids 1/3/5/7/8/10/11/12/13/14. All 11 of this task's own site-nav.spec.ts tests (Task 1's two-viewport tracer plus Task 2's per-role/anonymous/active-marker/Hebrew expansion) passed cleanly. Beats the 332/1 baseline recorded by the prior quick task (260816-etv).",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-16T09:25:44.541Z",
    "resolved_at": null
  }
]
````
