"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/lib/i18n/locale-provider";
import { PAGE_SIZE } from "@/lib/validation/search";
import DoctorCard, { type DoctorSearchResult } from "@/components/search/doctor-card";
import PaginationNav from "@/components/pagination-nav";

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
  const t = useT();

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
        <p className="text-sm text-destructive">{t("search.results.load_error")}</p>
        <Button variant="outline" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  if (doctors.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <h2 className="text-lg font-semibold">{t("search.results.no_results_heading")}</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {t("search.results.no_results_body")}
        </p>
      </div>
    );
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const controlsDisabled = status !== "ready";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {total} {t("search.results.count_label")}
        {total === 1 ? "" : t("search.results.count_plural_suffix")}
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
      <PaginationNav
        page={page}
        pageCount={pageCount}
        onPageChange={onPageChange}
        disabled={controlsDisabled}
        navLabel={t("search.results.pagination_nav_label")}
        previousLabel={t("search.results.previous_page_aria")}
        nextLabel={t("search.results.next_page_aria")}
        pageLabelPrefix={t("search.results.page_aria_prefix")}
      />
    </div>
  );
}
