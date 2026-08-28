// Single source for the D-17 derived status label and the D-18
// upcoming/past split, shared by app/patient/appointments/page.tsx (this
// plan) and app/doctor/(gated)/appointments/page.tsx (plan 05-03), so the
// two history pages cannot drift apart on either rule.
//
// These derivations are presentation-only. Nothing in this project writes
// an attendance outcome ("completed"/"no_show") back to appointments.status
// — "Past" is a UI-computed label only, never a stored value (D-16, D-17).

import type { TranslationKey } from "@/lib/i18n/dictionaries";

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "cancelled_by_patient"
  | "cancelled_by_doctor"
  | "completed"
  | "no_show";

export type AppointmentLike = {
  status: AppointmentStatus;
  slot: { start_at: string; end_at: string } | null;
};

export function isCancelledStatus(status: AppointmentStatus): boolean {
  return status === "cancelled_by_patient" || status === "cancelled_by_doctor";
}

export type AppointmentBadge = {
  labelKey: TranslationKey;
  variant: "default" | "secondary" | "outline";
  // Presentation-only (06-UI-REVIEW.md fix 3): a status-colored inline-start
  // border, added here so the three consuming pages (patient dashboard,
  // patient appointments, doctor appointments) cannot drift on status color.
  // Deliberately additive — labelKey/variant are never renamed, reordered or
  // reshaped, since labelKey drives cancel/reschedule eligibility (T-06-40).
  // Expressed as an all-sides border color plus a per-side border width
  // (never a per-side border-color utility), because tailwind-merge does not
  // reliably model per-side border-color utilities and Badge's own base
  // class already sets an all-sides transparent border that must be beaten.
  accentClassName: string;
};

// A stored status of `scheduled` renders as `Confirmed` — the label is a
// display derivation and the stored status is never rewritten to match it
// (D-16, D-17). This divergence between UI-SPEC copy and RESEARCH.md's
// database status is deliberate, not a bug to "fix" by writing `confirmed`
// into the database.
export function appointmentBadge(
  status: AppointmentStatus,
  startAt: string,
  now: number = Date.now(),
): AppointmentBadge {
  if (status === "cancelled_by_patient") {
    return {
      labelKey: "appointment_status.cancelled_by_patient",
      variant: "outline",
      // Documented one-step extension of 06-UI-SPEC.md's destructive
      // reservation (previously "appointment-cancellation actions only"): a
      // red inline-start bar on the cancelled STATUS badge itself. Text
      // stays neutral and variant stays outline, so the badge never reads
      // as a clickable destructive affordance.
      accentClassName: "border-s-2 border-destructive/70",
    };
  }
  if (status === "cancelled_by_doctor") {
    return {
      labelKey: "appointment_status.cancelled_by_doctor",
      variant: "outline",
      accentClassName: "border-s-2 border-destructive/70",
    };
  }
  if (new Date(startAt).getTime() < now) {
    return {
      labelKey: "appointment_status.past",
      variant: "secondary",
      accentClassName: "border-s-2 border-muted-foreground/40",
    };
  }
  return {
    labelKey: "appointment_status.confirmed",
    variant: "default",
    accentClassName: "border-s-2 border-primary-foreground/60",
  };
}

export function splitAppointments<T extends AppointmentLike>(
  rows: T[],
  now: number = Date.now(),
): { upcoming: T[]; past: T[] } {
  const upcoming: T[] = [];
  const past: T[] = [];

  for (const row of rows) {
    if (!row.slot) {
      past.push(row);
      continue;
    }
    const startTime = new Date(row.slot.start_at).getTime();
    if (startTime >= now && !isCancelledStatus(row.status)) {
      upcoming.push(row);
    } else {
      past.push(row);
    }
  }

  upcoming.sort((a, b) => new Date(a.slot!.start_at).getTime() - new Date(b.slot!.start_at).getTime());
  past.sort((a, b) => new Date(b.slot?.start_at ?? 0).getTime() - new Date(a.slot?.start_at ?? 0).getTime());

  return { upcoming, past };
}
