"use client";

import { Bell } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/lib/i18n/locale-provider";
import { notificationCopyKey, type NotificationViewerRole } from "@/lib/i18n/notification-copy";
import { formatJerusalemDayHeading, formatJerusalemTime } from "@/lib/timezone";

// Payload shape matches GET /api/notifications's NOTIFICATION_SELECT
// allowlist exactly (app/api/notifications/route.ts). There is no `message`
// field, and none may be added — the stored English text must never be
// rendered (D-03); displayed copy comes exclusively from
// notificationCopyKey() + the dictionary.
export type NotificationRow = {
  id: string;
  type: string;
  related_appointment_id: string | null;
  read_at: string | null;
  created_at: string;
};

type LoadStatus = "loading" | "error" | "ready";

const BADGE_OVERFLOW_LABEL = "9+";

export default function NotificationBell({
  userId,
  viewerRole,
}: {
  userId: string;
  viewerRole: NotificationViewerRole;
}) {
  const t = useT();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const response = await fetch("/api/notifications");
      if (!response.ok) {
        setStatus("error");
        return;
      }
      const body = await response.json();
      setRows(body.notifications as NotificationRow[]);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    async function runLoad() {
      await load();
    }
    void runLoad();
  }, [load]);

  const unreadCount = rows.filter((row) => row.read_at === null).length;
  const badgeLabel = unreadCount > 9 ? BADGE_OVERFLOW_LABEL : String(unreadCount);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (nextOpen) {
      // Snapshot the currently-listed unread ids at open time, fire one
      // fire-and-forget PATCH per id (idempotent endpoint), and do not
      // block the render. A notification arriving live while the dropdown
      // is already open is deliberately excluded from this snapshot — it
      // stays visually unread until the next open.
      const unreadIds = rows.filter((row) => row.read_at === null).map((row) => row.id);
      for (const id of unreadIds) {
        void fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      }
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative size-11 sm:size-8"
            aria-label={t("notifications.title")}
          />
        }
      >
        <span className="relative inline-flex">
          <Bell />
          {unreadCount > 0 ? (
            <span
              data-testid="notification-badge"
              className="absolute -top-1 end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[0.65rem] leading-none font-medium text-primary-foreground"
            >
              {badgeLabel}
            </span>
          ) : null}
        </span>
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" className="w-80">
        <PopoverHeader>
          <PopoverTitle>{t("notifications.title")}</PopoverTitle>
        </PopoverHeader>
        <div className="max-h-96 overflow-y-auto">
          {status === "loading" ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : status === "error" ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <p className="text-sm text-destructive">{t("notifications.load_error")}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                {t("common.retry")}
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("notifications.empty")}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((row) => {
                const unread = row.read_at === null;
                return (
                  <li key={row.id} className="flex items-start gap-2 py-1">
                    <span
                      className={
                        unread
                          ? "mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                          : "mt-1.5 size-2 shrink-0"
                      }
                    />
                    <div className="flex flex-col gap-0.5">
                      <span className={unread ? "text-sm font-semibold" : "text-sm"}>
                        {t(notificationCopyKey(row.type, viewerRole))}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatJerusalemDayHeading(row.created_at)}{" "}
                        {formatJerusalemTime(row.created_at)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
