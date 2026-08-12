// Notification type + viewer-role -> dictionary key resolution (D-03).
//
// `notifications.type` is one of exactly three literal strings, but the
// patient-facing and doctor-facing copy for the SAME `type` differ — that
// difference is not encoded on the row at all, it is implicit in which
// `user_id` the row belongs to. `viewerRole` below is always the CURRENT
// user's own `profiles.role`, never a field read off the notification row
// itself: RLS (`notifications_select_own`) already scopes every readable row
// to `user_id = auth.uid()`, so the viewer's own role is definitionally the
// recipient role for every row they can see. Both recipients of one event
// (e.g. a booking) share an identical `type` value with no role
// discriminator, so deriving copy from the row alone is silently wrong for
// exactly one of the two recipients.
//
// `type` is a plain `text` column with no check constraint, so an
// unrecognised value is reachable in principle — it must resolve to the
// generic fallback key, never a blank row or a raw key path.
//
// This file carries no client-only directive, no server-restricted import
// guard, and does no I/O: it is a pure lookup module in the style of
// lib/timezone.ts, importable from both Client and Server Components.

import type { TranslationKey } from "@/lib/i18n/dictionaries";

export type NotificationViewerRole = "patient" | "doctor";

export const NOTIFICATION_COPY_KEYS = {
  appointment_booked: {
    patient: "notifications.appointment_booked.patient",
    doctor: "notifications.appointment_booked.doctor",
  },
  appointment_rescheduled: {
    patient: "notifications.appointment_rescheduled.patient",
    doctor: "notifications.appointment_rescheduled.doctor",
  },
  appointment_cancelled: {
    patient: "notifications.appointment_cancelled.patient",
    doctor: "notifications.appointment_cancelled.doctor",
  },
} as const satisfies Record<string, Record<NotificationViewerRole, TranslationKey>>;

export type KnownNotificationType = keyof typeof NOTIFICATION_COPY_KEYS;

export const KNOWN_NOTIFICATION_TYPES = Object.keys(
  NOTIFICATION_COPY_KEYS,
) as KnownNotificationType[];

function isKnownNotificationType(type: string): type is KnownNotificationType {
  return (KNOWN_NOTIFICATION_TYPES as string[]).includes(type);
}

export function notificationCopyKey(
  type: string,
  viewerRole: NotificationViewerRole,
): TranslationKey {
  if (isKnownNotificationType(type)) {
    return NOTIFICATION_COPY_KEYS[type][viewerRole];
  }
  return "notifications.generic";
}
