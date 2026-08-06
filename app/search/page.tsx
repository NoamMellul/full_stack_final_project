"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import SearchFilters from "@/components/search/search-filters";
import SearchResults from "@/components/search/search-results";
import type { DoctorSearchResult } from "@/components/search/doctor-card";

// Small custom debounce hook (no library — RESEARCH.md Pattern 4). Kept at
// this page level and passed down as props by plan 03-05; do not move.
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function SearchPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [nameInput, setNameInput] = useState(searchParams.get("q") ?? "");
  const debouncedName = useDebouncedValue(nameInput, 300);

  const [listStatus, setListStatus] = useState<"loading" | "error" | "ready">("loading");
  const [doctors, setDoctors] = useState<DoctorSearchResult[]>([]);
  const [total, setTotal] = useState(0);

  // Clones the current URL query, applies `next`, and resets `page` to "1"
  // unless the caller's own object already sets `page` — D-14's
  // reset-on-filter-change rule, established here once for every future
  // filter this phase's later plans add.
  const updateQuery = useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      if (!("page" in next)) {
        params.set("page", "1");
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const currentQ = searchParams.get("q") ?? "";
    if (debouncedName !== currentQ) {
      updateQuery({ q: debouncedName || null });
    }
    // Only re-run when the debounced name value changes — updateQuery and
    // searchParams intentionally excluded to avoid loops on every URL write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedName]);

  const loadDoctors = useCallback(async () => {
    try {
      const response = await fetch(`/api/doctors?${searchParams.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not load doctors. Please try again.");
      }
      setDoctors(data.doctors as DoctorSearchResult[]);
      setTotal(data.total as number);
      setListStatus("ready");
    } catch {
      setListStatus("error");
    }
  }, [searchParams]);

  // Every query change (not just the very first mount) re-shows the
  // skeleton grid until the response resolves — the initial fetch and every
  // subsequent query change render 6 Skeleton placeholder cards.
  useEffect(() => {
    async function runLoad() {
      setListStatus("loading");
      await loadDoctors();
    }
    void runLoad();
  }, [loadDoctors]);

  function handleRetry() {
    setListStatus("loading");
    void loadDoctors();
  }

  return (
    <main className="flex flex-1 flex-col gap-6 ps-4 pe-4 py-6">
      <h1 className="text-2xl font-semibold">Find a doctor</h1>

      <SearchFilters
        nameValue={nameInput}
        onNameChange={setNameInput}
        specialty={searchParams.get("specialty")}
        language={searchParams.get("language")}
        neighborhood={searchParams.get("neighborhood")}
        availableFrom={searchParams.get("availableFrom")}
        availableTo={searchParams.get("availableTo")}
        onFilterChange={updateQuery}
      />

      <SearchResults
        status={listStatus}
        doctors={doctors}
        total={total}
        onRetry={handleRetry}
      />
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageInner />
    </Suspense>
  );
}
