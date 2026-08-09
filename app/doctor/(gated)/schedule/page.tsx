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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { validateSlotInput } from "@/lib/validation/availability";
import {
  formatJerusalemDayHeading,
  formatJerusalemTime,
  jerusalemDayKey,
  jerusalemWallClockToUtc,
} from "@/lib/timezone";

// Exported so plans 04-02 and 04-03 extend rather than redefine this shape.
export type ScheduleEntry = {
  id: string;
  start_at: string;
  end_at: string;
  status: "available" | "booked" | "blocked";
  reason: string | null;
};

type EntryDayGroup = {
  dayKey: string;
  entries: ScheduleEntry[];
};

export function groupEntriesByJerusalemDay(entries: ScheduleEntry[]): EntryDayGroup[] {
  const groups: EntryDayGroup[] = [];
  for (const entry of entries) {
    const dayKey = jerusalemDayKey(entry.start_at);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.dayKey === dayKey) {
      lastGroup.entries.push(entry);
    } else {
      groups.push({ dayKey, entries: [entry] });
    }
  }
  return groups;
}

function statusBadge(status: ScheduleEntry["status"]) {
  if (status === "available") return <Badge variant="default">Available</Badge>;
  if (status === "blocked") return <Badge variant="secondary">Blocked</Badge>;
  return <Badge variant="outline">Booked</Badge>;
}

function ScheduleListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} className="h-6 w-full" />
      ))}
    </div>
  );
}

export default function DoctorSchedulePage() {
  const [listStatus, setListStatus] = useState<"loading" | "error" | "ready">("loading");
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [addApiError, setAddApiError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const loadEntries = useCallback(async () => {
    try {
      const response = await fetch("/api/doctor/slots");
      const data = await response.json();
      if (!response.ok) {
        setListStatus("error");
        return;
      }
      setEntries(data.slots as ScheduleEntry[]);
      setListStatus("ready");
    } catch {
      setListStatus("error");
    }
  }, []);

  useEffect(() => {
    async function initialLoad() {
      await loadEntries();
    }
    void initialLoad();
  }, [loadEntries]);

  function handleRetry() {
    setListStatus("loading");
    void loadEntries();
  }

  function openAddDialog() {
    setDate("");
    setStartTime("");
    setEndTime("");
    setAddApiError(null);
    setAddOpen(true);
  }

  function closeAddDialog() {
    setAddOpen(false);
  }

  async function handleAddSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAddApiError(null);

    if (!date || !startTime || !endTime) {
      setAddApiError("Start and end time are required.");
      return;
    }

    const [year, month, day] = date.split("-").map(Number);
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);

    const startAt = jerusalemWallClockToUtc(year, month, day, startHour, startMinute).toISOString();
    const endAt = jerusalemWallClockToUtc(year, month, day, endHour, endMinute).toISOString();
    const body = { startAt, endAt };

    const validationError = validateSlotInput(body);
    if (validationError) {
      setAddApiError(validationError);
      return;
    }

    setIsAdding(true);
    try {
      const response = await fetch("/api/doctor/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok) {
        setAddApiError(data.error ?? "Could not save this time slot. Please try again.");
        return;
      }

      closeAddDialog();
      await loadEntries();
    } catch {
      setAddApiError("Could not save this time slot. Please try again.");
    } finally {
      setIsAdding(false);
    }
  }

  const groups = groupEntriesByJerusalemDay(entries);

  return (
    <main className="flex flex-1 flex-col gap-6 ps-4 pe-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My schedule</h1>
        <Button type="button" onClick={openAddDialog}>
          Add slot
        </Button>
      </div>

      <Dialog open={addOpen} onOpenChange={(open) => (!open ? closeAddDialog() : undefined)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add a slot</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-slot-date">Date</Label>
              <Input
                id="add-slot-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-slot-start-time">Start time</Label>
              <Input
                id="add-slot-start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-slot-end-time">End time</Label>
              <Input
                id="add-slot-end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>

            {addApiError ? (
              <Alert variant="destructive">
                <AlertDescription>{addApiError}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter>
              <Button type="submit" disabled={isAdding}>
                {isAdding ? "Adding…" : "Add slot"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {listStatus === "loading" ? (
        <ScheduleListSkeleton />
      ) : listStatus === "error" ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-destructive">
            Could not load your schedule. Please try again.
          </p>
          <Button variant="outline" onClick={handleRetry}>
            Retry
          </Button>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <h2 className="text-lg font-semibold">No upcoming availability</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Add a slot or block a period to build out your schedule.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <div key={group.dayKey} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">
                {formatJerusalemDayHeading(group.entries[0].start_at)}
              </h3>
              <div className="flex flex-col gap-2">
                {group.entries.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3">
                    <span className="text-sm">
                      {formatJerusalemTime(entry.start_at)} – {formatJerusalemTime(entry.end_at)}
                    </span>
                    {statusBadge(entry.status)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
