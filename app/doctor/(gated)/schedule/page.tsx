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
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/locale-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { translateValidationMessage } from "@/lib/i18n/validation-messages";
import { validateBlockedPeriodInput, validateSlotInput } from "@/lib/validation/availability";
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

function statusBadge(status: ScheduleEntry["status"], t: (key: TranslationKey) => string) {
  if (status === "available") {
    return <Badge variant="default">{t("doctor_schedule.status_available")}</Badge>;
  }
  if (status === "blocked") {
    return <Badge variant="secondary">{t("doctor_schedule.status_blocked")}</Badge>;
  }
  return <Badge variant="outline">{t("doctor_schedule.status_booked")}</Badge>;
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
  const t = useT();
  const [listStatus, setListStatus] = useState<"loading" | "error" | "ready">("loading");
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [addApiError, setAddApiError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const [blockOpen, setBlockOpen] = useState(false);
  const [blockStartDate, setBlockStartDate] = useState("");
  const [blockStartTime, setBlockStartTime] = useState("");
  const [blockEndDate, setBlockEndDate] = useState("");
  const [blockEndTime, setBlockEndTime] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [blockApiError, setBlockApiError] = useState<string | null>(null);
  const [isBlocking, setIsBlocking] = useState(false);

  const [deletingEntry, setDeletingEntry] = useState<ScheduleEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

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
      setAddApiError(t("validation.start_end_required"));
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
      setAddApiError(translateValidationMessage(validationError, t));
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
        setAddApiError(data.error ?? t("doctor_schedule.save_slot_generic_error"));
        return;
      }

      closeAddDialog();
      await loadEntries();
    } catch {
      setAddApiError(t("doctor_schedule.save_slot_generic_error"));
    } finally {
      setIsAdding(false);
    }
  }

  function openBlockDialog() {
    setBlockStartDate("");
    setBlockStartTime("");
    setBlockEndDate("");
    setBlockEndTime("");
    setBlockReason("");
    setBlockApiError(null);
    setBlockOpen(true);
  }

  function closeBlockDialog() {
    setBlockOpen(false);
  }

  async function handleBlockSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBlockApiError(null);

    if (!blockStartDate || !blockStartTime || !blockEndDate || !blockEndTime) {
      setBlockApiError(t("validation.start_end_required"));
      return;
    }

    const [startYear, startMonth, startDay] = blockStartDate.split("-").map(Number);
    const [startHour, startMinute] = blockStartTime.split(":").map(Number);
    const [endYear, endMonth, endDay] = blockEndDate.split("-").map(Number);
    const [endHour, endMinute] = blockEndTime.split(":").map(Number);

    // Four inputs producing one continuous range — this is what makes a
    // multi-day block a single row (D-03).
    const startAt = jerusalemWallClockToUtc(
      startYear,
      startMonth,
      startDay,
      startHour,
      startMinute,
    ).toISOString();
    const endAt = jerusalemWallClockToUtc(endYear, endMonth, endDay, endHour, endMinute).toISOString();
    // Sent verbatim (not trimmed) when non-blank, matching the route's own
    // trim-to-check-blankness-only behaviour (D-04) — the reason must round
    // trip byte-identical to what the doctor typed.
    const body = {
      startAt,
      endAt,
      reason: blockReason.trim().length > 0 ? blockReason : null,
    };

    const validationError = validateBlockedPeriodInput(body);
    if (validationError) {
      setBlockApiError(translateValidationMessage(validationError, t));
      return;
    }

    setIsBlocking(true);
    try {
      const response = await fetch("/api/doctor/blocked-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok) {
        setBlockApiError(data.error ?? t("doctor_schedule.save_slot_generic_error"));
        return;
      }

      closeBlockDialog();
      await loadEntries();
    } catch {
      setBlockApiError(t("doctor_schedule.save_slot_generic_error"));
    } finally {
      setIsBlocking(false);
    }
  }

  function openDeleteDialog(entry: ScheduleEntry) {
    setDeletingEntry(entry);
  }

  function closeDeleteDialog() {
    setDeletingEntry(null);
  }

  async function handleConfirmDelete() {
    if (!deletingEntry) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/doctor/slots/${deletingEntry.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        // The row's deletability may have changed between list-load and this
        // click (e.g. a patient just booked it) — surface the server's
        // message verbatim and refresh so the list catches up on screen.
        setStatusMessage(data.error ?? t("doctor_schedule.delete_entry_error"));
        closeDeleteDialog();
        await loadEntries();
        return;
      }

      setStatusMessage(
        deletingEntry.status === "blocked"
          ? t("doctor_schedule.block_removed_status")
          : t("doctor_schedule.slot_deleted_status"),
      );
      closeDeleteDialog();
      await loadEntries();
    } catch {
      setStatusMessage(t("doctor_schedule.delete_entry_error"));
      closeDeleteDialog();
    } finally {
      setIsDeleting(false);
    }
  }

  const groups = groupEntriesByJerusalemDay(entries);

  return (
    <main className="flex flex-1 flex-col gap-6 ps-4 pe-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("doctor_schedule.title")}</h1>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={openBlockDialog}>
            {t("doctor_schedule.block_period")}
          </Button>
          <Button type="button" onClick={openAddDialog}>
            {t("doctor_schedule.add_slot")}
          </Button>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={(open) => (!open ? closeAddDialog() : undefined)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("doctor_schedule.add_dialog_title")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-slot-date">{t("doctor_schedule.date_label")}</Label>
              <Input
                id="add-slot-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-slot-start-time">{t("doctor_schedule.start_time_label")}</Label>
              <Input
                id="add-slot-start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-slot-end-time">{t("doctor_schedule.end_time_label")}</Label>
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
                {isAdding ? t("doctor_schedule.adding") : t("doctor_schedule.add_slot")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={blockOpen} onOpenChange={(open) => (!open ? closeBlockDialog() : undefined)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("doctor_schedule.block_dialog_title")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBlockSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="block-start-date">{t("doctor_schedule.start_date_label")}</Label>
              <Input
                id="block-start-date"
                type="date"
                value={blockStartDate}
                onChange={(e) => setBlockStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="block-start-time">{t("doctor_schedule.start_time_label")}</Label>
              <Input
                id="block-start-time"
                type="time"
                value={blockStartTime}
                onChange={(e) => setBlockStartTime(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="block-end-date">{t("doctor_schedule.end_date_label")}</Label>
              <Input
                id="block-end-date"
                type="date"
                value={blockEndDate}
                onChange={(e) => setBlockEndDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="block-end-time">{t("doctor_schedule.end_time_label")}</Label>
              <Input
                id="block-end-time"
                type="time"
                value={blockEndTime}
                onChange={(e) => setBlockEndTime(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="block-reason">{t("doctor_schedule.block_reason_label")}</Label>
              <Textarea
                id="block-reason"
                placeholder={t("doctor_schedule.block_reason_placeholder")}
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
              />
            </div>

            {blockApiError ? (
              <Alert variant="destructive">
                <AlertDescription>{blockApiError}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter>
              <Button type="submit" disabled={isBlocking}>
                {isBlocking ? t("doctor_schedule.blocking") : t("doctor_schedule.block_period")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deletingEntry !== null}
        onOpenChange={(open) => {
          if (!open) closeDeleteDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {deletingEntry?.status === "blocked"
                ? t("doctor_schedule.remove_block_title")
                : t("doctor_schedule.delete_slot_title")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deletingEntry?.status === "blocked"
              ? t("doctor_schedule.remove_block_body")
              : t("doctor_schedule.delete_slot_body")}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDeleteDialog} disabled={isDeleting}>
              {t("doctor_schedule.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? t("doctor_schedule.deleting") : t("doctor_schedule.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
        {statusMessage}
      </p>

      {listStatus === "loading" ? (
        <ScheduleListSkeleton />
      ) : listStatus === "error" ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-destructive">{t("doctor_schedule.load_error")}</p>
          <Button variant="outline" onClick={handleRetry}>
            {t("common.retry")}
          </Button>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <h2 className="text-lg font-semibold">{t("doctor_schedule.empty_heading")}</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {t("doctor_schedule.empty_body")}
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
                    {statusBadge(entry.status, t)}
                    {entry.status === "blocked" && entry.reason ? (
                      <span className="min-w-0 flex-1 text-sm break-words text-muted-foreground">
                        {entry.reason}
                      </span>
                    ) : null}
                    {entry.status !== "booked" ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="min-h-11"
                        aria-label={`${t("doctor_schedule.delete")} ${formatJerusalemTime(entry.start_at)} – ${formatJerusalemTime(entry.end_at)}`}
                        onClick={() => openDeleteDialog(entry)}
                      >
                        {t("doctor_schedule.delete")}
                      </Button>
                    ) : null}
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
