// Message-string -> dictionary-key bridge for lib/validation/*.ts's literal
// English error messages (RESEARCH.md Pitfall 4, Assumption A3, locked as
// option (a)). Mirrors the message-as-identifier idiom already established
// by components/admin/doctors-page-client.tsx's FIELD_BY_MESSAGE lookup —
// same pattern, different purpose (translation instead of field mapping).
//
// This module translates at the render boundary only. No lib/validation/*.ts
// function and no route handler that consumes one is modified by this
// module or by anything that imports it: a validator keeps returning the
// exact same English string it always has, and this module's job is purely
// to look that string up and hand back the matching dictionary value.
//
// Carries no client-only directive and no server-only import, in the same
// style as lib/timezone.ts — importable from Client Components, Server
// Components, and Node alike.

import type { TranslationKey } from "@/lib/i18n/dictionaries";

// One entry per distinct literal message returned by a lib/validation/*.ts
// function reachable from a non-admin page (lib/validation/auth.ts,
// lib/validation/appointments.ts, lib/validation/availability.ts,
// lib/validation/search.ts). lib/validation/doctor.ts and
// lib/validation/reference-data.ts surface only on /admin/*, which D-04
// excludes — their messages are deliberately absent here, so they fall
// through translateValidationMessage() unchanged (correct admin-only
// English behaviour).
export const VALIDATION_MESSAGE_KEYS: Record<string, TranslationKey> = {
  "Email is required.": "validation.email_required",
  "Invalid email format.": "validation.email_invalid",
  "Password is required.": "validation.password_required",
  "Password must be at least 6 characters.": "validation.password_too_short",
  "Full name is required.": "validation.full_name_required",
  "Slot is required.": "validation.slot_required",
  "A new slot is required.": "validation.new_slot_required",
  "Reason must be text.": "validation.reason_must_be_text",
  "Reason is too long.": "validation.reason_too_long",
  "Start and end time are required.": "validation.start_end_required",
  "Invalid date/time.": "validation.invalid_datetime",
  "Cannot add a slot in the past.": "validation.slot_in_past",
  "Start time must be before end time.": "validation.start_before_end",
  "Cannot block a period in the past.": "validation.block_in_past",
  "Page must be a whole number between 1 and 1000.": "validation.page_out_of_range",
  "Specialty filter is invalid.": "validation.specialty_filter_invalid",
  "Language filter must be Hebrew or English.": "validation.language_filter_invalid",
  "Neighborhood filter is invalid.": "validation.neighborhood_filter_invalid",
  "Dates must be in YYYY-MM-DD format.": "validation.date_format_invalid",
  "The end date must be on or after the start date.": "validation.date_range_invalid",
};

// Returns the translated message when `message` is a mapped validator
// literal, and `message` itself unchanged otherwise. The unchanged-fallback
// path is the correct degradation for an unmapped message (e.g. an
// admin-only validator string, or any future message this bridge hasn't
// been updated for yet): it renders as a readable English sentence, never a
// blank field error and never a raw dictionary key path.
export function translateValidationMessage(
  message: string,
  t: (key: TranslationKey) => string,
): string {
  const key = VALIDATION_MESSAGE_KEYS[message];
  return key ? t(key) : message;
}
