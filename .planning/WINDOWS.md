---
schema_version: 1
open_count: 10
waived_count: 0
fixed_count: 0
total_count: 10
last_updated: 2026-08-13T11:26:04.034Z
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
  }
]
````
