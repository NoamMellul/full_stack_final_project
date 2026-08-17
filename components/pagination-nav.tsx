"use client";

import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type PaginationNavProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  navLabel: string;
  previousLabel: string;
  nextLabel: string;
  pageLabelPrefix: string;
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

// The single condensed-pagination implementation in the codebase (D-LAR-05).
// Labels are always passed in — this component never imports useT or a
// dictionary — so /search can pass translated labels while the admin
// surfaces stay English-only (CLAUDE.md: admin is English-only by design).
export default function PaginationNav({
  page,
  pageCount,
  onPageChange,
  disabled,
  navLabel,
  previousLabel,
  nextLabel,
  pageLabelPrefix,
}: PaginationNavProps) {
  if (pageCount <= 1) {
    return null;
  }

  const pageItems = buildPageItems(page, pageCount);
  const controlsDisabled = Boolean(disabled);

  return (
    <nav aria-label={navLabel} className="flex items-center justify-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="relative after:absolute after:-inset-2"
        aria-label={previousLabel}
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
            aria-label={`${pageLabelPrefix} ${item}`}
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
            aria-label={`${pageLabelPrefix} ${item}`}
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
        aria-label={nextLabel}
        disabled={page === pageCount || controlsDisabled}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRightIcon />
      </Button>
    </nav>
  );
}
