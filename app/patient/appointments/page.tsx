"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { appointmentBadge, splitAppointments, type AppointmentStatus } from "@/lib/appointments";
import { formatJerusalemDayHeading, formatJerusalemTime } from "@/lib/timezone";

// Exported so plans 05-02 and 05-04 extend rather than redefine this shape.
export type PatientAppointment = {
  id: string;
  status: AppointmentStatus;
  cancelled_reason: string | null;
  created_at: string;
  slot: { id: string; start_at: string; end_at: string; status: string } | null;
  doctor: { id: string; full_name: string } | null;
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

function AppointmentRow({ appointment }: { appointment: PatientAppointment }) {
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
          with Dr. {appointment.doctor?.full_name ?? "Unknown"}
        </span>
      </div>
      {badge ? <Badge variant={badge.variant}>{badge.label}</Badge> : null}
    </div>
  );
}

function PatientAppointmentsPageInner() {
  const searchParams = useSearchParams();

  const [listStatus, setListStatus] = useState<"loading" | "error" | "ready">("loading");
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  // Lazy initializer: read the `booked` search param exactly once, as a seed
  // value for the mount-time render — not a continuously synced effect.
  const [statusMessage] = useState<string | null>(() =>
    searchParams.get("booked") === "1" ? "Your appointment has been booked successfully." : null,
  );

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

export default function PatientAppointmentsPage() {
  return (
    <Suspense>
      <PatientAppointmentsPageInner />
    </Suspense>
  );
}
