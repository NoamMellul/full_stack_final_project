"use client";

import { useCallback, useEffect, useState } from "react";

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
import {
  appointmentBadge,
  isCancelledStatus,
  splitAppointments,
  type AppointmentStatus,
} from "@/lib/appointments";
import { useT } from "@/lib/i18n/locale-provider";
import { translateValidationMessage } from "@/lib/i18n/validation-messages";
import { formatJerusalemDayHeading, formatJerusalemTime } from "@/lib/timezone";
import { validateCancelInput } from "@/lib/validation/appointments";

// Exported so plan 05-05 extends rather than redefines this shape.
export type DoctorAppointment = {
  id: string;
  status: AppointmentStatus;
  cancelled_reason: string | null;
  created_at: string;
  slot: { id: string; start_at: string; end_at: string; status: string } | null;
  patient: { id: string; full_name: string } | null;
};

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
  onCancel,
}: {
  appointment: DoctorAppointment;
  onCancel: (appointment: DoctorAppointment) => void;
}) {
  const t = useT();
  const slot = appointment.slot;
  const badge = slot ? appointmentBadge(appointment.status, slot.start_at) : null;

  // Eligible for cancellation only while the slot has not yet started and
  // the appointment is not already cancelled — same "start_at >= now and not
  // cancelled" test as the patient page's canManage, read from the
  // already-computed badge's stable labelKey rather than a second impure
  // Date.now() call in this render body (react-hooks/purity), and never from
  // the rendered, translatable label text, so eligibility cannot vary with
  // the interface language (T-06-40). No reschedule control exists on this
  // page by design (D-06, D-07); ineligible rows omit the control entirely
  // rather than rendering it disabled.
  const canCancel =
    slot !== null &&
    badge?.labelKey === "appointment_status.confirmed" &&
    !isCancelledStatus(appointment.status);

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
          {appointment.patient?.full_name ?? t("doctor_appointments.unknown_patient")}
        </span>
      </div>
      {badge ? (
        <Badge variant={badge.variant} className={badge.accentClassName}>
          {t(badge.labelKey)}
        </Badge>
      ) : null}
      {canCancel && slot ? (
        <Button
          type="button"
          variant="destructive"
          className="min-h-11"
          aria-label={`${t("doctor_appointments.cancel_appointment")} ${formatJerusalemDayHeading(slot.start_at)}, ${formatJerusalemTime(slot.start_at)}–${formatJerusalemTime(slot.end_at)}`}
          onClick={() => onCancel(appointment)}
        >
          {t("doctor_appointments.cancel_appointment")}
        </Button>
      ) : null}
    </div>
  );
}

export default function DoctorAppointmentsPage() {
  const t = useT();
  const [listStatus, setListStatus] = useState<"loading" | "error" | "ready">("loading");
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Mirrors app/patient/appointments/page.tsx's cancellation dialog state
  // exactly, down to the variable names, so the two implementations read as
  // one pattern (05-02-SUMMARY.md).
  const [cancellingAppointment, setCancellingAppointment] = useState<DoctorAppointment | null>(
    null,
  );
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const loadAppointments = useCallback(async () => {
    try {
      const response = await fetch("/api/doctor/appointments");
      const data = await response.json();
      if (!response.ok) {
        setListStatus("error");
        return;
      }
      setAppointments(data.appointments as DoctorAppointment[]);
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

  function openCancelDialog(appointment: DoctorAppointment) {
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
    // only to test blankness, matching the patient page's D-13 reason
    // round-trip rule. This is the same PATCH /api/appointments/[id]/cancel
    // route the patient page calls — no doctor-specific cancel endpoint
    // exists. The client sends no field naming the acting party;
    // cancel_appointment() derives cancelled_by_doctor from auth.uid()
    // compared against the appointment's patient_id.
    const body = {
      reason: cancelReason.trim().length > 0 ? cancelReason : null,
    };

    const validationError = validateCancelInput(body);
    if (validationError) {
      setCancelError(translateValidationMessage(validationError, t));
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
        // Leave the dialog open so the doctor can read the rejection and
        // dismiss deliberately — no list refresh from inside this path.
        setCancelError(data.error ?? t("doctor_appointments.cancel_generic_error"));
        return;
      }

      closeCancelDialog();
      setStatusMessage(t("doctor_appointments.cancelled_status_message"));
      await loadAppointments();
    } catch {
      setCancelError(t("doctor_appointments.cancel_generic_error"));
    } finally {
      setIsCancelling(false);
    }
  }

  const { upcoming, past } = splitAppointments(appointments);
  const isEmpty = listStatus === "ready" && upcoming.length === 0 && past.length === 0;

  return (
    <main className="flex flex-1 flex-col gap-6 ps-4 pe-4 py-6">
      <h1 className="text-2xl font-semibold">{t("doctor_appointments.title")}</h1>

      <Dialog
        open={cancellingAppointment !== null}
        onOpenChange={(open) => {
          if (!open) closeCancelDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("doctor_appointments.cancel_dialog_title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("doctor_appointments.cancel_dialog_body")}
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cancel-reason">{t("doctor_appointments.reason_label")}</Label>
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
              {t("doctor_appointments.keep_appointment")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={isCancelling}
              className="min-h-11"
            >
              {isCancelling
                ? t("doctor_appointments.cancelling")
                : t("doctor_appointments.cancel_appointment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
        {statusMessage}
      </p>

      {listStatus === "loading" ? (
        <AppointmentListSkeleton />
      ) : listStatus === "error" ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-destructive">{t("doctor_appointments.load_error")}</p>
          <Button variant="outline" className="min-h-11" onClick={handleRetry}>
            {t("common.retry")}
          </Button>
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <h2 className="text-lg font-semibold">{t("doctor_appointments.empty_heading")}</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {t("doctor_appointments.empty_body")}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {upcoming.length > 0 ? (
            <div className="flex flex-col gap-2" data-testid="upcoming-section">
              <h2 className="text-lg font-semibold">
                {t("doctor_appointments.upcoming_heading")}
              </h2>
              <div className="flex flex-col gap-3">
                {upcoming.map((appointment) => (
                  <AppointmentRow
                    key={appointment.id}
                    appointment={appointment}
                    onCancel={openCancelDialog}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {past.length > 0 ? (
            <div className="flex flex-col gap-2" data-testid="past-section">
              <h2 className="text-lg font-semibold">{t("doctor_appointments.past_heading")}</h2>
              <div className="flex flex-col gap-3">
                {past.map((appointment) => (
                  <AppointmentRow
                    key={appointment.id}
                    appointment={appointment}
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
