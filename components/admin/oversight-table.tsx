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
import PaginationNav from "@/components/pagination-nav";

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
  /**
   * Presence enables paginated mode: a `page` param is appended to
   * `endpoint` and a PaginationNav is rendered below the table. Absent by
   * default so consumers (e.g. /admin/appointments) keep their exact
   * current unpaginated behaviour.
   */
  pageSize?: number;
  /** Required in paginated mode — the PaginationNav's aria-label. */
  paginationNavLabel?: string;
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
  pageSize,
  paginationNavLabel,
}: OversightTableProps) {
  const [rows, setRows] = useState<Row[]>([]);
  // "loading" only covers the very first GET for this endpoint — later
  // refetches (filter changes, Retry) update the table in place without
  // re-showing the skeleton rows, matching the doctors list convention.
  const [listStatus, setListStatus] = useState<"loading" | "error" | "ready">("loading");
  const [page, setPage] = useState(1);
  // null (not 0) so a response with no `total` key falls back cleanly to the
  // rendered row count rather than reading as "zero rows".
  const [total, setTotal] = useState<number | null>(null);
  const [isPageFetching, setIsPageFetching] = useState(false);

  const paginated = typeof pageSize === "number";

  const load = useCallback(
    async (targetPage: number) => {
      setIsPageFetching(true);
      try {
        const url = paginated
          ? `${endpoint}${endpoint.includes("?") ? "&" : "?"}page=${targetPage}`
          : endpoint;
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            data.error ?? `Could not load ${resourceLabel}. Please refresh the page.`,
          );
        }
        setRows((data[resourceKey] ?? []) as Row[]);
        setPage(targetPage);
        setTotal(typeof data.total === "number" ? data.total : null);
        setListStatus("ready");
      } catch {
        setListStatus("error");
      } finally {
        setIsPageFetching(false);
      }
    },
    [endpoint, resourceKey, resourceLabel, paginated],
  );

  useEffect(() => {
    async function initialLoad() {
      await load(1);
    }
    void initialLoad();
  }, [load]);

  function handleRetry() {
    setListStatus("loading");
    void load(page);
  }

  const columnCount = columns.length;
  const displayCount = total ?? rows.length;

  return (
    <div className="flex flex-col gap-2">
      {listStatus === "ready" ? (
        <p className="text-sm text-muted-foreground">
          {displayCount === 1 ? `1 ${countNounSingular}` : `${displayCount} ${countNounPlural}`}
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

      {paginated && listStatus === "ready" ? (
        <PaginationNav
          page={page}
          pageCount={Math.max(1, Math.ceil((total ?? 0) / (pageSize as number)))}
          onPageChange={(targetPage) => void load(targetPage)}
          disabled={isPageFetching}
          navLabel={paginationNavLabel as string}
          previousLabel="Previous page"
          nextLabel="Next page"
          pageLabelPrefix="Page"
        />
      ) : null}
    </div>
  );
}
