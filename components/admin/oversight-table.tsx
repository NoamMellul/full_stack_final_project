"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Read-only oversight table shared by /admin/users and /admin/appointments
// (ADMIN-07, ADMIN-08). No create/edit/delete affordance exists anywhere in
// this component by construction — it renders cells, nothing else.
export type OversightColumn = {
  /** Dot-path into the row object, e.g. "full_name" or "doctor.full_name". */
  key: string;
  header: string;
  format?: "text" | "badge" | "date" | "datetime-tz";
  /** Required when format is "date" or "datetime-tz". */
  timeZone?: string;
  className?: string;
};

type OversightTableProps = {
  /** Full request URL, including any query string — changing it re-fetches. */
  endpoint: string;
  /** Key inside the JSON response holding the row array, e.g. "users". */
  resourceKey: string;
  /** Used in "Could not load {resourceLabel}. Please refresh the page." */
  resourceLabel: string;
  countNounSingular: string;
  countNounPlural: string;
  columns: OversightColumn[];
  emptyHeading: string;
  emptyBody: string;
};

type Row = Record<string, unknown>;

function getPath(row: Row, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === "object") {
      return (acc as Row)[segment];
    }
    return undefined;
  }, row);
}

function formatCell(value: unknown, column: OversightColumn): React.ReactNode {
  if (value === null || value === undefined || value === "") return "";

  if (column.format === "badge") {
    return <Badge variant="outline">{String(value)}</Badge>;
  }

  if (column.format === "date" || column.format === "datetime-tz") {
    const date = new Date(value as string);
    if (Number.isNaN(date.getTime())) return "";
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: column.timeZone ?? "UTC",
      dateStyle: "medium",
      ...(column.format === "datetime-tz" ? { timeStyle: "short" } : {}),
    });
    return formatter.format(date);
  }

  return String(value);
}

export default function OversightTable({
  endpoint,
  resourceKey,
  resourceLabel,
  countNounSingular,
  countNounPlural,
  columns,
  emptyHeading,
  emptyBody,
}: OversightTableProps) {
  const [rows, setRows] = useState<Row[]>([]);
  // "loading" only covers the very first GET for this endpoint — later
  // refetches (filter changes, Retry) update the table in place without
  // re-showing the skeleton rows, matching the doctors list convention.
  const [listStatus, setListStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      const response = await fetch(endpoint);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? `Could not load ${resourceLabel}. Please refresh the page.`);
      }
      setRows((data[resourceKey] ?? []) as Row[]);
      setListStatus("ready");
    } catch {
      setListStatus("error");
    }
  }, [endpoint, resourceKey, resourceLabel]);

  useEffect(() => {
    async function initialLoad() {
      await load();
    }
    void initialLoad();
  }, [load]);

  function handleRetry() {
    setListStatus("loading");
    void load();
  }

  const columnCount = columns.length;

  return (
    <div className="flex flex-col gap-2">
      {listStatus === "ready" ? (
        <p className="text-sm text-muted-foreground">
          {rows.length === 1 ? `1 ${countNounSingular}` : `${rows.length} ${countNounPlural}`}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key}>{column.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          {listStatus === "loading" ? (
            <TableBody>
              {[0, 1, 2].map((row) => (
                <TableRow key={row}>
                  <TableCell colSpan={columnCount}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          ) : listStatus === "error" ? (
            <TableBody>
              <TableRow>
                <TableCell colSpan={columnCount}>
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <p className="text-sm text-destructive">
                      Could not load {resourceLabel}. Please refresh the page.
                    </p>
                    <Button type="button" variant="outline" onClick={handleRetry}>
                      Retry
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          ) : rows.length === 0 ? (
            <TableBody>
              <TableRow>
                <TableCell colSpan={columnCount}>
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <h2 className="text-lg font-semibold">{emptyHeading}</h2>
                    <p className="max-w-md text-sm text-muted-foreground">{emptyBody}</p>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          ) : (
            <TableBody>
              {rows.map((row) => (
                <TableRow key={String(getPath(row, "id"))}>
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.className}>
                      {formatCell(getPath(row, column.key), column)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          )}
        </Table>
      </div>
    </div>
  );
}
