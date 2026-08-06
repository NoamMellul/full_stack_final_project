"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PAGE_SIZE } from "@/lib/validation/search";
import DoctorCard, { type DoctorSearchResult } from "@/components/search/doctor-card";

type SearchResultsProps = {
  status: "loading" | "error" | "ready";
  doctors: DoctorSearchResult[];
  total: number;
  onRetry: () => void;
};

export default function SearchResults({ status, doctors, total, onRetry }: SearchResultsProps) {
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

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {total} result{total === 1 ? "" : "s"}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {doctors.map((doctor) => (
          <DoctorCard key={doctor.id} doctor={doctor} />
        ))}
      </div>
      {/* Pagination controls added by plan 03-06 */}
    </div>
  );
}
