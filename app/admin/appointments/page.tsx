"use client";

import { useEffect, useState } from "react";

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
import { createClient } from "@/lib/supabase/client";

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

const JERUSALEM_TIME_ZONE = "Asia/Jerusalem";

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

// Returns the UTC offset (ms) of `timeZone` at `date` — used to convert an
// admin-entered calendar date, which is meant as an Asia/Jerusalem local day
// per the project timezone constraint, into the correct UTC instant rather
// than assuming the browser's ambient zone.
function getTimeZoneOffsetMs(timeZone: string, date: Date): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

function jerusalemBoundaryToUtcIso(dateStr: string, boundary: "start" | "end"): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const naiveUtc =
    boundary === "start"
      ? Date.UTC(year, month - 1, day, 0, 0, 0, 0)
      : Date.UTC(year, month - 1, day, 23, 59, 59, 999);
  const guess = new Date(naiveUtc);
  const offsetMs = getTimeZoneOffsetMs(JERUSALEM_TIME_ZONE, guess);
  return new Date(naiveUtc - offsetMs).toISOString();
}

export default function AdminAppointmentsPage() {
  const [status, setStatus] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [doctorOptions, setDoctorOptions] = useState<DoctorOption[]>([]);

  useEffect(() => {
    async function loadDoctorOptions() {
      const supabase = createClient();
      const { data } = await supabase.from("doctors").select("id,full_name").order("full_name");
      setDoctorOptions((data ?? []).map((row) => ({ id: row.id, label: row.full_name })));
    }
    void loadDoctorOptions();
  }, []);

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
