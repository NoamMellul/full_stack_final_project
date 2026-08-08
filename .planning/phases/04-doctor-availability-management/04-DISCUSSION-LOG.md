# Phase 4: Doctor Availability Management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-08
**Phase:** 4-doctor-availability-management
**Areas discussed:** Un-blocking a period, Blocked-period shape, Admin's role in slots, Schedule page UX, Block reason, Past slots, Overlap message

---

## Un-blocking a period

| Option | Description | Selected |
|--------|-------------|----------|
| (free-text, no preset options — area selected via multiSelect, answered directly) | User wrote out the full DELETE business rule in one detailed reply | ✓ |

**User's choice:** DELETE must allow removing both `available` slots and `blocked` periods (deleting a blocked row IS how the doctor un-blocks it); only `booked`/appointment-tied slots are rejected. Corrects TASKS.md's literal "reject if status != available" wording.
**Notes:** Deleting a blocked period must NOT auto-recreate any availability that existed there before the block — it only lifts the restriction. → CONTEXT.md D-01, D-02.

---

## Blocked-period shape

| Option | Description | Selected |
|--------|-------------|----------|
| (free-text) | User specified single-row, continuous start/end range with worked examples | ✓ |

**User's choice:** One continuous `availability_slots` row (`status='blocked'`) per block, start date+time → end date+time, never split per-day. Add an optional `reason` text field.
**Notes:** Explicit examples given: Mon 14:00→18:00; Mon 09:00→Wed 18:00 (spans nights); Aug 20 00:00→Aug 27 23:59 (vacation). Explicit instruction to reuse the existing schema/exclusion-constraint mechanism, not redesign it. → CONTEXT.md D-03, D-04.

---

## Admin's role in slots

| Option | Description | Selected |
|--------|-------------|----------|
| (free-text) | User specified doctor-only scope for this phase | ✓ |

**User's choice:** Availability management is doctor-only in Phase 4 — no admin schedule UI, no `app/api/admin/.../slots` routes. Admin keeps its existing scope (accounts, profiles, reference data) only.
**Notes:** Explicit requirement that the DB/security model must not make an admin-managed-schedule feature impossible to add later — confirmed the existing `availability_slots_write_owner_or_admin` RLS policy already supports it without changes. → CONTEXT.md D-05, D-06.

---

## Schedule page UX

| Option | Description | Selected |
|--------|-------------|----------|
| (free-text) | User specified day-grouped list, explicitly rejecting a calendar grid | ✓ |

**User's choice:** Day-grouped list view (reusing the existing `groupSlotsByJerusalemDay` pattern from the public profile page), explicitly NOT a Google Calendar/Doctolib-style grid. Single-slot-per-submission add form; separate block-period form with optional reason. No recurring/bulk generation.
**Notes:** Worked example given: "Monday, August 17 / 09:00–09:30 Available / 10:00–10:30 Available / 14:00–18:00 Blocked". → CONTEXT.md D-13 through D-18.

---

## Block reason

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, optional reason (Recommended) | Add nullable `reason` text column, shown next to blocked entries | ✓ |
| No reason field | Blocked periods show only time range + "Blocked" label | |

**User's choice:** Yes, optional reason.
**Notes:** Consistent with the user's own free-text answer on Blocked-period shape, which already asked for an optional reason field. → CONTEXT.md D-04.

---

## Past slots

| Option | Description | Selected |
|--------|-------------|----------|
| Future only (Recommended) | Schedule page lists today-and-forward only | ✓ |
| Show past too | Include elapsed slots read-only alongside upcoming | |

**User's choice:** Future only.
**Notes:** Matches the public profile page's "upcoming" pattern; no AVAIL-* requirement asks for history. → CONTEXT.md D-15.

---

## Overlap message

| Option | Description | Selected |
|--------|-------------|----------|
| Generic message (Recommended) | One message for any conflict type | ✓ |
| Distinguish by status | Different wording per conflict type (available/booked/blocked) | |

**User's choice:** Generic message ("This time overlaps your existing schedule.").
**Notes:** Matches the user's explicit "keep it simple" guidance given throughout the discussion. → CONTEXT.md D-11.

---

## Claude's Discretion

- Exact styling/wording of the available-vs-blocked badge on the schedule list.
- Exact copy of the generic overlap-rejection and past-date-rejection error messages.
- Whether a "quick recurring slots" convenience is added on top of the single-slot form — only if trivial at planning time.
- Exact form/dialog layout for "Add slot" vs "Block period" on `/doctor/schedule`.

## Deferred Ideas

- Admin schedule management (admin manages a doctor's schedule on their behalf) — explicitly deferred to a future phase/need; RLS already supports adding it later without a migration.
- Recurring / bulk slot generation — deferred unless trivial; not a requirement for this phase.
- Past-slot history on the schedule page — explicitly out of scope for this phase.
