"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { PatientAppointment } from "@/app/patient/appointments/page";
import { appointmentBadge, splitAppointments } from "@/lib/appointments";
import { formatJerusalemDayHeading, formatJerusalemTime } from "@/lib/timezone";

// Same three-Skeleton treatment as app/patient/appointments/page.tsx's
// AppointmentListSkeleton (UI-SPEC loading) — a dedicated module-local copy
// rather than an import, since that file keeps its skeleton private.
function UpcomingSummarySkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} className="h-6 w-full" />
      ))}
    </div>
  );
}

// Summary-only row: same day/time + doctor-name + status-badge format as
// /patient/appointments's AppointmentRow, but with no Reschedule/Cancel
// controls — appointment management stays on /patient/appointments so this
// dashboard summary can never become a second mutation surface (T-06-*).
function DashboardAppointmentRow({ appointment }: { appointment: PatientAppointment }) {
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

export default function PatientDashboardPage() {
  const [listStatus, setListStatus] = useState<"loading" | "error" | "ready">("loading");
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);

  // Reuses the existing GET /api/patient/appointments endpoint — no new
  // route, no second upcoming/past derivation (RESEARCH Open Question 2).
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

  const { upcoming } = splitAppointments(appointments);
  const upcomingPreview = upcoming.slice(0, 3);

  return (
    <main className="flex flex-1 flex-col ps-6 pe-6 py-8">
      <h1 className="text-2xl font-semibold">My dashboard</h1>

      <div className="mt-8 flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Upcoming appointments</h2>

          {listStatus === "loading" ? (
            <UpcomingSummarySkeleton />
          ) : listStatus === "error" ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <p className="text-sm text-destructive">
                Could not load your appointments. Please try again.
              </p>
              <Button type="button" variant="outline" className="min-h-11" onClick={handleRetry}>
                Retry
              </Button>
            </div>
          ) : upcomingPreview.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <h3 className="text-lg font-semibold">No upcoming appointments</h3>
              <p className="max-w-md text-sm text-muted-foreground">
                Book a doctor to see your next appointment here.
              </p>
              <Button className="min-h-11" render={<Link href="/search" />}>
                Find a doctor
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {upcomingPreview.map((appointment) => (
                <DashboardAppointmentRow key={appointment.id} appointment={appointment} />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="min-h-11" render={<Link href="/search" />}>
            Search doctors
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            render={<Link href="/patient/favorites" />}
          >
            My favorites
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            render={<Link href="/patient/appointments" />}
          >
            Appointment history
          </Button>
        </div>
      </div>
    </main>
  );
}
