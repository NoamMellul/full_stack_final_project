# Phase 2: Admin — Doctor & Reference Data Management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-04
**Phase:** 2-admin-doctor-reference-data-management
**Areas discussed:** Doctor photo handling, Temp password & account linking UX, Reference data deletion guard, Demo data seed script scope

---

## Doctor photo handling

| Option | Description | Selected |
|--------|-------------|----------|
| Real upload to Supabase Storage | New public 'doctor-photos' bucket, photo_url set to the public URL | |
| Paste external URL | Admin pastes an image URL into photo_url, no Storage bucket | ✓ (with modification) |
| Skip photos for v1 | No photo field; generic placeholder avatar everywhere | |

**User's choice:** Paste external URL, but explicitly optional — when absent, show an avatar with the doctor's initials (rather than a single generic placeholder).
**Notes:** User wants to avoid all Storage/bucket/permissions management for this phase; this is faster and defers file handling entirely. Combined the "paste URL" and "skip photos" options into a hybrid: URL is optional, initials avatar is the fallback.

---

## Temp password & account linking UX

| Option | Description | Selected |
|--------|-------------|----------|
| One-time modal/banner with copy button | Password shown once in a dismissible modal with a copy-to-clipboard button and a "won't be shown again" warning | ✓ |
| Plain inline text in the page | Password appears as text in the page after the action, no modal | |

**User's choice:** One-time modal with a "Copy password" button and warning, shown after doctor creation/linking.
**Notes:** User explicitly described the full flow: show once in modal → copy button → warning it won't be shown again → force password change on first login. Considered "clean, credible, and good for security."

## Force change on first login

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, force change on first login | Adds a must-change-password flag checked at login, redirecting to a change-password page first | ✓ |
| No, temp password works indefinitely | Simpler, no forced flow | |

**User's choice:** Yes, force change on first login.
**Notes:** Confirmed as part of the same answer as the temp-password modal flow above.

---

## Reference data deletion guard

| Option | Description | Selected |
|--------|-------------|----------|
| Blocked with clear error message | Delete button always enabled; clicking on an in-use item shows a toast/inline error | |
| Delete disabled/hidden when in use | Delete action disabled/greyed with a tooltip for in-use items | ✓ (with modification) |

**User's choice:** Don't hide the button — disable it, with visible inline text like "This specialty is used by 3 doctors and cannot be deleted."
**Notes:** User explicitly added that server-side protection must still exist regardless of the disabled client-side button, since disabling a UI element alone is not a real guard.

---

## Demo data seed script scope

| Option | Description | Selected |
|--------|-------------|----------|
| Moderate realistic set | ~10-15 doctors across all specialties/neighborhoods, no photo URLs | ✓ |
| Minimal set | 3-5 doctors, just enough to prove CRUD works | |
| Rich set with photo URLs | 10-15 doctors + real external stock-photo URLs | |

**User's choice:** Moderate realistic set — no photo URLs (relies on initials-avatar fallback, consistent with the photo-handling decision above).
**Notes:** —

## Seed availability_slots?

| Option | Description | Selected |
|--------|-------------|----------|
| No — doctors only, no slots yet | Keep seed script scoped to what Phase 2 needs | ✓ |
| Yes — seed some slots now | Add availability_slots now so Phase 3 has data immediately | |

**User's choice:** No — availability seeding deferred to Phase 4/5.
**Notes:** —

---

## Claude's Discretion

- Exact styling/implementation of the initials-avatar component.
- Exact modal component implementation for the one-time password display (any shadcn dialog primitive).
- Exact demo doctor names/bios/specialty distribution within the "10-15 doctors, all specialties, all neighborhoods" envelope.

## Deferred Ideas

None — discussion stayed within phase scope.
