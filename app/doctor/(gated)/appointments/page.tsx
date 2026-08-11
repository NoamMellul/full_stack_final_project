"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { appointmentBadge, splitAppointments, type AppointmentStatus } from "@/lib/appointments";
import { formatJerusalemDayHeading, formatJerusalemTime } from "@/lib/timezone";

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

function AppointmentRow({ appointment }: { appointment: DoctorAppointment }) {
  const slot = appointment.slot;
  const badge = slot ? appointmentBadge(appointment.status, slot.start_at) : null;

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
          {appointment.patient?.full_name ?? "Unknown patient"}
        </span>
      </div>
      {badge ? <Badge variant={badge.variant}>{badge.label}</Badge> : null}
    </div>
  );
}

export default function DoctorAppointmentsPage() {
  const [listStatus, setListStatus] = useState<"loading" | "error" | "ready">("loading");
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  // Nothing sets this in this plan — it exists so plan 05-05 can announce a
  // cancellation without restructuring the page.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- setter is consumed by plan 05-05's cancellation flow, not this plan
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

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

  const { upcoming, past } = splitAppointments(appointments);
  const isEmpty = listStatus === "ready" && upcoming.length === 0 && past.length === 0;

  return (
    <main className="flex flex-1 flex-col gap-6 ps-4 pe-4 py-6">
      <h1 className="text-2xl font-semibold">My appointments</h1>

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
          <Button variant="outline" className="min-h-11" onClick={handleRetry}>
            Retry
          </Button>
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <h2 className="text-lg font-semibold">No appointments yet</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Appointments booked with you will show up here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {upcoming.length > 0 ? (
            <div className="flex flex-col gap-2" data-testid="upcoming-section">
              <h2 className="text-lg font-semibold">Upcoming</h2>
              <div className="flex flex-col gap-3">
                {upcoming.map((appointment) => (
                  <AppointmentRow key={appointment.id} appointment={appointment} />
                ))}
              </div>
            </div>
          ) : null}

          {past.length > 0 ? (
            <div className="flex flex-col gap-2" data-testid="past-section">
              <h2 className="text-lg font-semibold">Past</h2>
              <div className="flex flex-col gap-3">
                {past.map((appointment) => (
                  <AppointmentRow key={appointment.id} appointment={appointment} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </main>
  );
}
