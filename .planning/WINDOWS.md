---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 0
total_count: 2
last_updated: 2026-08-12T09:30:43.219Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 06 | deviation | tests/e2e/seed-availability.spec.ts | 170 | Pre-existing full-suite flakiness (3 failed, unrelated to 06-01's new fixme-only files): admin-doctor-crud.spec.ts:226, appointment-reschedule.spec.ts:764 (afterAll timeout), seed-availability.spec.ts:170 (doctor slot count 4 < 6). Likely shared-dev-DB test residue (known STATE.md blocker). See deferred-items.md. | open |  | 2026-08-12T07:02:01.250Z |  |
| 2 | 06 | deviation | tests/e2e/admin-route-protection.spec.ts | 230 | Recurrence (06-03) of the same shared-dev-DB residue flakiness class first logged as id 1 in 06-01: full-suite run showed 300 passed/11 skipped/3 failed. This run's admin-cluster failure landed on admin-route-protection.spec.ts:230 (401/403 denial matrix) rather than 06-01's admin-doctor-crud.spec.ts:226 or 06-02's admin-route-protection.spec.ts:230 repeat -- same file as 06-02, third overall recurrence on a shifting admin spec. appointment-reschedule.spec.ts:764 (afterAll timeout) and seed-availability.spec.ts:170 (slot count) also recurred byte-identically. See deferred-items.md 06-03 section. | open |  | 2026-08-12T09:30:43.219Z |  |

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
  }
]
````
