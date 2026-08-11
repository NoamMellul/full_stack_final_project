// Single source for the D-17 derived status label and the D-18
// upcoming/past split, shared by app/patient/appointments/page.tsx (this
// plan) and app/doctor/(gated)/appointments/page.tsx (plan 05-03), so the
// two history pages cannot drift apart on either rule.
//
// These derivations are presentation-only. Nothing in this project writes
// an attendance outcome ("completed"/"no_show") back to appointments.status
// — "Past" is a UI-computed label only, never a stored value (D-16, D-17).

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
  label: string;
  variant: "default" | "secondary" | "outline";
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
    return { label: "Cancelled by patient", variant: "outline" };
  }
  if (status === "cancelled_by_doctor") {
    return { label: "Cancelled by doctor", variant: "outline" };
  }
  if (new Date(startAt).getTime() < now) {
    return { label: "Past", variant: "secondary" };
  }
  return { label: "Confirmed", variant: "default" };
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
