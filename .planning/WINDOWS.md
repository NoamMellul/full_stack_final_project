---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-08-12T07:02:01.250Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 06 | deviation | tests/e2e/seed-availability.spec.ts | 170 | Pre-existing full-suite flakiness (3 failed, unrelated to 06-01's new fixme-only files): admin-doctor-crud.spec.ts:226, appointment-reschedule.spec.ts:764 (afterAll timeout), seed-availability.spec.ts:170 (doctor slot count 4 < 6). Likely shared-dev-DB test residue (known STATE.md blocker). See deferred-items.md. | open |  | 2026-08-12T07:02:01.250Z |  |

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
  }
]
````
