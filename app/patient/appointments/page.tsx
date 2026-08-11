"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { appointmentBadge, isCancelledStatus, splitAppointments, type AppointmentStatus } from "@/lib/appointments";
import {
  formatJerusalemDayHeading,
  formatJerusalemTime,
  jerusalemDayKey,
} from "@/lib/timezone";
import { validateCancelInput } from "@/lib/validation/appointments";

// Exported so plans 05-02 and 05-04 extend rather than redefine this shape.
export type PatientAppointment = {
  id: string;
  status: AppointmentStatus;
  cancelled_reason: string | null;
  created_at: string;
  slot: { id: string; start_at: string; end_at: string; status: string } | null;
  doctor: { id: string; full_name: string } | null;
};

// Reschedule picker's slot list shape — matches GET /api/doctors/{id}'s
// `upcomingSlots` entries exactly (id, start_at, end_at only).
type PickerSlot = {
  id: string;
  start_at: string;
  end_at: string;
};

type PickerSlotDayGroup = {
  dayKey: string;
  slots: PickerSlot[];
};

// Exact same day-grouping algorithm as app/doctors/[id]/page.tsx's
// groupSlotsByJerusalemDay, reused here rather than imported since that file
// keeps it module-private — duplicated intentionally, not imported across a
// page boundary.
function groupSlotsByJerusalemDay(slots: PickerSlot[]): PickerSlotDayGroup[] {
  const groups: PickerSlotDayGroup[] = [];
  for (const slot of slots) {
    const dayKey = jerusalemDayKey(slot.start_at);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.dayKey === dayKey) {
      lastGroup.slots.push(slot);
    } else {
      groups.push({ dayKey, slots: [slot] });
    }
  }
  return groups;
}

function AppointmentListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} className="h-6 w-full" />
      ))}
    </div>
  );
}

function AppointmentRow({
  appointment,
  onReschedule,
  onCancel,
}: {
  appointment: PatientAppointment;
  onReschedule: (appointment: PatientAppointment) => void;
  onCancel: (appointment: PatientAppointment) => void;
}) {
  const slot = appointment.slot;
  const badge = slot ? appointmentBadge(appointment.status, slot.start_at) : null;

  // Eligible for reschedule/cancel only while the slot has not yet started
  // and the appointment is not already cancelled. `badge.label ===
  // "Confirmed"` already encodes exactly that "start_at >= now and not
  // cancelled" test (appointmentBadge()'s own derivation), so eligibility is
  // read from the already-computed badge rather than a second, impure
  // `Date.now()` call in this render body; isCancelledStatus() is applied
  // directly too, so eligibility is decided by the shared helper, never a
  // locally reimplemented status list. Reschedule and cancel share the exact
  // same eligibility predicate. Ineligible rows omit both controls entirely
  // rather than rendering them disabled (Phase 3's established "omit rather
  // than disable" precedent).
  const canManage =
    slot !== null && badge?.label === "Confirmed" && !isCancelledStatus(appointment.status);

  return (
    <div className="flex items-center gap-3">
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold">
          {slot ? (
            <>
              {formatJerusalemDayHeading(slot.start_at)}, {formatJerusalemTime(slot.start_at)}–
              {formatJerusalemTime(slot.end_at)}
            </>
          ) : null}
        </span>
        <span className="text-sm text-muted-foreground">
          with Dr. {appointment.doctor?.full_name ?? "Unknown"}
        </span>
      </div>
      {badge ? <Badge variant={badge.variant}>{badge.label}</Badge> : null}
      {canManage && slot ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          aria-label={`Reschedule appointment ${formatJerusalemDayHeading(slot.start_at)}, ${formatJerusalemTime(slot.start_at)}–${formatJerusalemTime(slot.end_at)}`}
          onClick={() => onReschedule(appointment)}
        >
          Reschedule
        </Button>
      ) : null}
      {canManage && slot ? (
        <Button
          type="button"
          variant="destructive"
          className="min-h-11"
          aria-label={`Cancel appointment ${formatJerusalemDayHeading(slot.start_at)}, ${formatJerusalemTime(slot.start_at)}–${formatJerusalemTime(slot.end_at)}`}
          onClick={() => onCancel(appointment)}
        >
          Cancel appointment
        </Button>
      ) : null}
    </div>
  );
}

function PatientAppointmentsPageInner() {
  const searchParams = useSearchParams();

  const [listStatus, setListStatus] = useState<"loading" | "error" | "ready">("loading");
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  // Lazy initializer: read the `booked` search param exactly once, as a seed
  // value for the mount-time render — not a continuously synced effect. The
  // setter is also used by the cancellation and reschedule success paths
  // below.
  const [statusMessage, setStatusMessage] = useState<string | null>(() =>
    searchParams.get("booked") === "1" ? "Your appointment has been booked successfully." : null,
  );

  const [cancellingAppointment, setCancellingAppointment] = useState<PatientAppointment | null>(
    null,
  );
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // reschedulingAppointment doubles as the picker dialog's open
  // discriminator. reschedulingSlotId being non-null is what disables every
  // other slot button and drives the in-flight "Rescheduling…" label — one
  // piece of state for both effects.
  const [reschedulingAppointment, setReschedulingAppointment] = useState<PatientAppointment | null>(
    null,
  );
  const [pickerStatus, setPickerStatus] = useState<"loading" | "error" | "ready">("loading");
  const [pickerSlots, setPickerSlots] = useState<PickerSlot[]>([]);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [reschedulingSlotId, setReschedulingSlotId] = useState<string | null>(null);

  const loadAppointments = useCallback(async () => {
    try {
      const response = await fetch("/api/patient/appointments");
      const data = await response.json();
      if (!response.ok) {
        setListStatus("error");
        return;
      }
      setAppointments(data.appointments as PatientAppointment[]);
      setListStatus("ready");
    } catch {
      setListStatus("error");
    }
  }, []);

  useEffect(() => {
    async function initialLoad() {
      await loadAppointments();
    }
    void initialLoad();
  }, [loadAppointments]);

  function handleRetry() {
    setListStatus("loading");
    void loadAppointments();
  }

  function openCancelDialog(appointment: PatientAppointment) {
    setCancelReason("");
    setCancelError(null);
    setCancellingAppointment(appointment);
  }

  function closeCancelDialog() {
    setCancellingAppointment(null);
  }

  async function handleConfirmCancel() {
    if (!cancellingAppointment) return;
    setCancelError(null);

    // Untrimmed original when non-blank, null otherwise — trim() is used
    // only to test blankness, matching Phase 4's D-04 reason round-trip rule.
    const body = {
      reason: cancelReason.trim().length > 0 ? cancelReason : null,
    };

    const validationError = validateCancelInput(body);
    if (validationError) {
      setCancelError(validationError);
      return;
    }

    setIsCancelling(true);
    try {
      const response = await fetch(`/api/appointments/${cancellingAppointment.id}/cancel`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok) {
        // Leave the dialog open so the patient can read the rejection and
        // dismiss deliberately — no list refresh from inside this path.
        setCancelError(data.error ?? "Could not cancel this appointment. Please try again.");
        return;
      }

      closeCancelDialog();
      setStatusMessage("Appointment cancelled.");
      await loadAppointments();
    } catch {
      setCancelError("Could not cancel this appointment. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  }

  // Fetched at open time rather than reusing a cached list, so the picker
  // always reflects current availability (D-05). GET /api/doctors/{id}
  // already restricts to `status = 'available'` future slots for that one
  // doctor, which is what enforces D-06 on the client side while
  // reschedule_appointment() enforces it authoritatively server-side.
  const loadPickerSlots = useCallback(async (appointment: PatientAppointment) => {
    setPickerStatus("loading");
    const doctorId = appointment.doctor?.id;
    if (!doctorId) {
      setPickerStatus("error");
      return;
    }
    try {
      const response = await fetch(`/api/doctors/${doctorId}`);
      const data = await response.json();
      if (!response.ok) {
        setPickerStatus("error");
        return;
      }
      // Excludes the appointment's own current slot id, so the patient is
      // never offered the slot they already hold. That slot is `booked` and
      // so will normally be absent already; this filter is a cheap guard
      // against an inconsistent state rather than the primary mechanism.
      const slots = (data.upcomingSlots as PickerSlot[]).filter(
        (slot) => slot.id !== appointment.slot?.id,
      );
      setPickerSlots(slots);
      setPickerStatus("ready");
    } catch {
      setPickerStatus("error");
    }
  }, []);

  function openRescheduleDialog(appointment: PatientAppointment) {
    setReschedulingAppointment(appointment);
    setRescheduleError(null);
    setReschedulingSlotId(null);
    void loadPickerSlots(appointment);
  }

  function closeRescheduleDialog() {
    setReschedulingAppointment(null);
    setPickerSlots([]);
    setRescheduleError(null);
    setReschedulingSlotId(null);
  }

  // Clicking a slot's button commits immediately — no second confirmation
  // step inside this dialog. The explicit "Reschedule" click that opened it
  // is the confirmation gate.
  async function handleSelectRescheduleSlot(slot: PickerSlot) {
    if (!reschedulingAppointment) return;
    setReschedulingSlotId(slot.id);
    setRescheduleError(null);
    try {
      const response = await fetch(`/api/appointments/${reschedulingAppointment.id}/reschedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newSlotId: slot.id }),
      });
      const data = await response.json();

      if (!response.ok) {
        // Leave the dialog open with the list intact so the patient can
        // pick a different slot.
        setRescheduleError(
          data.error ?? "Could not reschedule this appointment. Please try again.",
        );
        return;
      }

      closeRescheduleDialog();
      setStatusMessage("Your appointment has been rescheduled.");
      await loadAppointments();
    } catch {
      setRescheduleError("Could not reschedule this appointment. Please try again.");
    } finally {
      setReschedulingSlotId(null);
    }
  }

  const { upcoming, past } = splitAppointments(appointments);
  const isEmpty = listStatus === "ready" && upcoming.length === 0 && past.length === 0;
  const pickerSlotGroups = groupSlotsByJerusalemDay(pickerSlots);

  return (
    <main className="flex flex-1 flex-col gap-6 ps-4 pe-4 py-6">
      <h1 className="text-2xl font-semibold">My appointments</h1>

      <Dialog
        open={cancellingAppointment !== null}
        onOpenChange={(open) => {
          if (!open) closeCancelDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this appointment?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will cancel the appointment for both you and the other party. This cannot be undone.
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cancel-reason">Reason (optional)</Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>

          {cancelError ? (
            <Alert variant="destructive">
              <AlertDescription>{cancelError}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeCancelDialog}
              disabled={isCancelling}
              className="min-h-11"
            >
              Keep appointment
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={isCancelling}
              className="min-h-11"
            >
              {isCancelling ? "Cancelling…" : "Cancel appointment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={reschedulingAppointment !== null}
        onOpenChange={(open) => {
          if (!open) closeRescheduleDialog();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reschedule your appointment</DialogTitle>
          </DialogHeader>

          {rescheduleError ? (
            <Alert variant="destructive">
              <AlertDescription>{rescheduleError}</AlertDescription>
            </Alert>
          ) : null}

          {pickerStatus === "loading" ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : pickerStatus === "error" ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <p className="text-sm text-destructive">
                Could not load this doctor. Please try again.
              </p>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => {
                  if (reschedulingAppointment) void loadPickerSlots(reschedulingAppointment);
                }}
              >
                Retry
              </Button>
            </div>
          ) : pickerSlotGroups.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <h3 className="text-lg font-semibold">No other upcoming availability</h3>
              <p className="text-sm text-muted-foreground">
                This doctor has no other available slots right now.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {pickerSlotGroups.map((group) => (
                <div key={group.dayKey} className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">
                    {formatJerusalemDayHeading(group.slots[0].start_at)}
                  </h3>
                  <div className="flex flex-col gap-2">
                    {group.slots.map((slot) => (
                      <div key={slot.id} className="flex items-center gap-3">
                        <span className="text-sm">
                          {formatJerusalemTime(slot.start_at)} - {formatJerusalemTime(slot.end_at)}
                        </span>
                        <Button
                          type="button"
                          variant="default"
                          className="min-h-11 px-4"
                          disabled={reschedulingSlotId !== null}
                          onClick={() => void handleSelectRescheduleSlot(slot)}
                        >
                          {reschedulingSlotId === slot.id ? "Rescheduling…" : "Select this slot"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
        {statusMessage}
      </p>

      {listStatus === "loading" ? (
        <AppointmentListSkeleton />
      ) : listStatus === "error" ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-destructive">
            Could not load your appointments. Please try again.
          </p>
          <Button variant="outline" onClick={handleRetry}>
            Retry
          </Button>
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <h2 className="text-lg font-semibold">No appointments yet</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Book an appointment with a doctor to see it here.
          </p>
          <Button className="min-h-11" render={<Link href="/search" />}>
            Find a doctor
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {upcoming.length > 0 ? (
            <div className="flex flex-col gap-2" data-testid="upcoming-section">
              <h2 className="text-lg font-semibold">Upcoming</h2>
              <div className="flex flex-col gap-3">
                {upcoming.map((appointment) => (
                  <AppointmentRow
                    key={appointment.id}
                    appointment={appointment}
                    onReschedule={openRescheduleDialog}
                    onCancel={openCancelDialog}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {past.length > 0 ? (
            <div className="flex flex-col gap-2" data-testid="past-section">
              <h2 className="text-lg font-semibold">Past</h2>
              <div className="flex flex-col gap-3">
                {past.map((appointment) => (
                  <AppointmentRow
                    key={appointment.id}
                    appointment={appointment}
                    onReschedule={openRescheduleDialog}
                    onCancel={openCancelDialog}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </main>
  );
}

export default function PatientAppointmentsPage() {
  return (
    <Suspense>
      <PatientAppointmentsPageInner />
    </Suspense>
  );
}
