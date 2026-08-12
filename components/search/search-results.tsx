"use client";

import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PAGE_SIZE } from "@/lib/validation/search";
import DoctorCard, { type DoctorSearchResult } from "@/components/search/doctor-card";

type SearchResultsProps = {
  status: "loading" | "error" | "ready";
  doctors: DoctorSearchResult[];
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  favoriteViewerRole: "patient" | "anonymous" | "hidden";
  favoritedDoctorIds: Set<string>;
};

// Standard condensed pagination: always show page 1, page `pageCount`, the
// current page and one neighbour on each side; collapse any gap spanning
// more than one number into a single "ellipsis" entry. Returns a list of
// page numbers and the string "ellipsis" for gaps — pageCount <= 7 always
// renders every number, no condensation needed.
function buildPageItems(page: number, pageCount: number): Array<number | "ellipsis"> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const items: Array<number | "ellipsis"> = [1];

  const rangeStart = Math.max(2, page - 1);
  const rangeEnd = Math.min(pageCount - 1, page + 1);

  if (rangeStart > 2) {
    items.push("ellipsis");
  }
  for (let n = rangeStart; n <= rangeEnd; n++) {
    items.push(n);
  }
  if (rangeEnd < pageCount - 1) {
    items.push("ellipsis");
  }

  items.push(pageCount);
  return items;
}

export default function SearchResults({
  status,
  doctors,
  total,
  page,
  onPageChange,
  onRetry,
  favoriteViewerRole,
  favoritedDoctorIds,
}: SearchResultsProps) {
  if (status === "loading") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: PAGE_SIZE }).map((_, index) => (
          <Skeleton key={index} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-destructive">Could not load doctors. Please try again.</p>
        <Button variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  if (doctors.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <h2 className="text-lg font-semibold">No doctors found</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Try adjusting your filters — search a different name, specialty, language, or
          neighborhood.
        </p>
      </div>
    );
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageItems = buildPageItems(page, pageCount);
  const controlsDisabled = status !== "ready";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {total} result{total === 1 ? "" : "s"}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {doctors.map((doctor) => (
          <DoctorCard
            key={doctor.id}
            doctor={doctor}
            favoriteViewerRole={favoriteViewerRole}
            isFavorited={favoritedDoctorIds.has(doctor.id)}
          />
        ))}
      </div>
      {pageCount > 1 ? (
        <nav aria-label="Search results pagination" className="flex items-center justify-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="relative after:absolute after:-inset-2"
            aria-label="Previous page"
            disabled={page === 1 || controlsDisabled}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeftIcon />
          </Button>
          {pageItems.map((item, index) =>
            item === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                aria-hidden="true"
                className="flex size-7 items-center justify-center text-muted-foreground"
              >
                <MoreHorizontalIcon className="size-4" />
              </span>
            ) : item === page ? (
              <Button
                key={item}
                type="button"
                variant="default"
                size="icon-sm"
                aria-label={`Page ${item}`}
                aria-current="page"
                disabled={controlsDisabled}
                onClick={() => onPageChange(item)}
              >
                {item}
              </Button>
            ) : (
              <Button
                key={item}
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={`Page ${item}`}
                disabled={controlsDisabled}
                onClick={() => onPageChange(item)}
              >
                {item}
              </Button>
            ),
          )}
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="relative after:absolute after:-inset-2"
            aria-label="Next page"
            disabled={page === pageCount || controlsDisabled}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRightIcon />
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
