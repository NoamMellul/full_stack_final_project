---
schema_version: 1
open_count: 5
waived_count: 0
fixed_count: 0
total_count: 5
last_updated: 2026-08-12T19:02:35.805Z
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
  }
]
````
