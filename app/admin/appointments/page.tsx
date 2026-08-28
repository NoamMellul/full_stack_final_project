"use client";

import { useCallback, useEffect, useState } from "react";

import OversightTable, { type OversightColumn } from "@/components/admin/oversight-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JERUSALEM_TIME_ZONE, jerusalemBoundaryToUtcIso } from "@/lib/timezone";

// Mirrors the appointments check constraint
// (supabase/migrations/20260803230000_initial_schema.sql).
const STATUS_OPTIONS = [
  "scheduled",
  "confirmed",
  "cancelled_by_patient",
  "cancelled_by_doctor",
  "completed",
  "no_show",
];

const COLUMNS: OversightColumn[] = [
  {
    key: "slot.start_at",
    header: "Date & time",
    format: "datetime-tz",
    timeZone: JERUSALEM_TIME_ZONE,
    className: "max-w-48",
  },
  { key: "doctor.full_name", header: "Doctor", format: "text", className: "max-w-40 truncate" },
  { key: "patient.full_name", header: "Patient", format: "text", className: "max-w-40 truncate" },
  { key: "status", header: "Status", format: "badge" },
  { key: "created_at", header: "Booked on", format: "date", timeZone: JERUSALEM_TIME_ZONE },
];

type DoctorOption = { id: string; label: string };

type DoctorOptionsStatus = "loading" | "error" | "ready";

export default function AdminAppointmentsPage() {
  const [status, setStatus] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [doctorOptions, setDoctorOptions] = useState<DoctorOption[]>([]);
  const [doctorOptionsStatus, setDoctorOptionsStatus] = useState<DoctorOptionsStatus>("loading");

  // Routed through the admin-gated GET /api/admin/doctors (not a direct
  // browser-client table query) — this adds a route-level authorization
  // check in front of the RLS layer that was previously the only gate
  // (T-FHM-01). That route orders by created_at, not by name, so the
  // alphabetical dropdown order the page has always had is reproduced here
  // via an explicit client-side localeCompare sort.
  const loadDoctorOptions = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/doctors");
      if (!response.ok) {
        setDoctorOptionsStatus("error");
        return;
      }
      const data = await response.json();
      const options = (data.doctors as { id: string; full_name: string }[])
        .map((row) => ({ id: row.id, label: row.full_name }))
        .sort((a, b) => a.label.localeCompare(b.label));
      setDoctorOptions(options);
      setDoctorOptionsStatus("ready");
    } catch {
      setDoctorOptionsStatus("error");
    }
  }, []);

  useEffect(() => {
    async function initialLoad() {
      await loadDoctorOptions();
    }
    void initialLoad();
  }, [loadDoctorOptions]);

  function handleRetryDoctorOptions() {
    setDoctorOptionsStatus("loading");
    void loadDoctorOptions();
  }

  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (doctorId) params.set("doctorId", doctorId);
  if (from) params.set("from", jerusalemBoundaryToUtcIso(from, "start"));
  if (to) params.set("to", jerusalemBoundaryToUtcIso(to, "end"));
  const query = params.toString();
  const endpoint = query ? `/api/admin/appointments?${query}` : "/api/admin/appointments";

  function handleClear() {
    setStatus("");
    setDoctorId("");
    setFrom("");
    setTo("");
  }

  const hasActiveFilter = Boolean(status || doctorId || from || to);

  return (
    <main className="flex flex-1 flex-col ps-6 pe-6 py-8">
      <h1 className="text-2xl font-semibold">Appointments</h1>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="appointments-status-filter">Status</Label>
          <Select value={status} onValueChange={(value) => setStatus(value ?? "")}>
            <SelectTrigger id="appointments-status-filter">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="appointments-doctor-filter">Doctor</Label>
          <Select value={doctorId} onValueChange={(value) => setDoctorId(value ?? "")}>
            <SelectTrigger id="appointments-doctor-filter">
              <SelectValue placeholder="All doctors" />
            </SelectTrigger>
            <SelectContent>
              {doctorOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {doctorOptionsStatus === "error" ? (
            <>
              <p className="text-sm text-destructive">
                Could not load doctors. Please refresh the page.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRetryDoctorOptions}
              >
                Retry
              </Button>
            </>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="appointments-from-filter">From</Label>
          <Input
            id="appointments-from-filter"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="appointments-to-filter">To</Label>
          <Input
            id="appointments-to-filter"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>

        <Button type="button" variant="outline" disabled={!hasActiveFilter} onClick={handleClear}>
          Clear filters
        </Button>
      </div>

      <div className="mt-6">
        <OversightTable
          endpoint={endpoint}
          resourceKey="appointments"
          resourceLabel="appointments"
          countNounSingular="appointment"
          countNounPlural="appointments"
          columns={COLUMNS}
          emptyHeading="No appointments yet"
          emptyBody="Appointments will appear here once patients start booking."
        />
      </div>
    </main>
  );
}
