"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { jerusalemDayKey } from "@/lib/timezone";

type OptionRow = { id: string; label: string };

type SearchFiltersProps = {
  nameValue: string;
  onNameChange: (value: string) => void;
  specialty: string | null;
  language: string | null;
  neighborhood: string | null;
  availableFrom: string | null;
  availableTo: string | null;
  onFilterChange: (next: Record<string, string | null>) => void;
};

// Adds `days` to an Asia/Jerusalem YYYY-MM-DD calendar day using UTC-part
// arithmetic on the parsed components (never a naive Date-object add, which
// would drift across a DST boundary if it re-entered local-time math).
function addCalendarDays(dayKey: string, days: number): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1, day + days));
  const y = target.getUTCFullYear();
  const m = String(target.getUTCMonth() + 1).padStart(2, "0");
  const d = String(target.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// D-07/RESEARCH.md Open Question 1: "Today" is [now, end of today], not
// [start of today, end of today] — the always-applied future-only predicate
// in the route's pre-query trims the lower bound to the present instant, so
// no special-casing is needed here beyond the end-day offset.
const QUICK_SELECTS: Array<{ label: string; endOffsetDays: number }> = [
  { label: "Today", endOffsetDays: 0 },
  { label: "Next 7 days", endOffsetDays: 6 },
  { label: "Next 30 days", endOffsetDays: 29 },
];

// Static value->label map for the language Select's `items` prop (see
// below) — Base UI's `Select.Value` only resolves a label from `items` (or
// from a currently-mounted `Select.Item`), so without this a page loaded
// directly on a `?language=he` URL would render the raw code instead of
// "Hebrew" until the popup was opened once.
const LANGUAGE_ITEMS: Record<string, string> = { he: "Hebrew", en: "English" };

// Filter panel for /search: name, specialty, spoken language, neighborhood
// and an availability date range with quick-select shortcuts. `nameValue`/
// `onNameChange` stay owned by the page (the 300ms debounce established in
// 03-03 lives there, untouched); every other filter round-trips through the
// page's `updateQuery` via the single `onFilterChange` callback.
export default function SearchFilters({
  nameValue,
  onNameChange,
  specialty,
  language,
  neighborhood,
  availableFrom,
  availableTo,
  onFilterChange,
}: SearchFiltersProps) {
  const [specialties, setSpecialties] = useState<OptionRow[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);

  // Loaded once from the browser client — specialties/locations are public
  // reference data under `select using (true)` RLS (mirrors
  // components/admin/doctors-page-client.tsx's option-loading effect).
  useEffect(() => {
    async function loadOptions() {
      const supabase = createClient();
      const [specialtiesRes, locationsRes] = await Promise.all([
        supabase.from("specialties").select("id,name_en").order("name_en"),
        supabase.from("locations").select("neighborhood").order("neighborhood"),
      ]);

      setSpecialties(
        (specialtiesRes.data ?? []).map((row) => ({ id: row.id, label: row.name_en })),
      );

      const uniqueNeighborhoods = Array.from(
        new Set((locationsRes.data ?? []).map((row) => row.neighborhood as string)),
      ).sort((a, b) => a.localeCompare(b));
      setNeighborhoods(uniqueNeighborhoods);
    }
    void loadOptions();
  }, []);

  // "Today" resolved in Asia/Jerusalem, never the browser's local date or
  // any other implicit visitor signal — used only to compute the quick-select
  // chip targets, never applied as a default filter value on load (D-07).
  const todayKey = jerusalemDayKey(new Date().toISOString());

  // `items` maps handed to each Select so `Select.Value` can resolve the
  // trigger's display label from a URL-derived value on first render,
  // without ever having opened the popup (required for D-13's reload/share
  // parity — otherwise the trigger briefly/permanently shows the raw id).
  const specialtyItems: Record<string, string> = Object.fromEntries(
    specialties.map((option) => [option.id, option.label]),
  );
  const neighborhoodItems: Record<string, string> = Object.fromEntries(
    neighborhoods.map((option) => [option, option]),
  );

  const hasActiveFilter = Boolean(
    nameValue || specialty || language || neighborhood || availableFrom || availableTo,
  );

  function handleClear() {
    onNameChange("");
    onFilterChange({
      specialty: null,
      language: null,
      neighborhood: null,
      availableFrom: null,
      availableTo: null,
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg bg-secondary p-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="search-name">Doctor name</Label>
        <Input
          id="search-name"
          name="q"
          type="text"
          value={nameValue}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="search-specialty">Specialty</Label>
        <Select
          value={specialty ?? ""}
          onValueChange={(value) => onFilterChange({ specialty: value || null })}
          items={specialtyItems}
        >
          <SelectTrigger id="search-specialty">
            <SelectValue placeholder="All specialties" />
          </SelectTrigger>
          <SelectContent>
            {specialties.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="search-language">Spoken language</Label>
        <Select
          value={language ?? ""}
          onValueChange={(value) => onFilterChange({ language: value || null })}
          items={LANGUAGE_ITEMS}
        >
          <SelectTrigger id="search-language">
            <SelectValue placeholder="All languages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="he">Hebrew</SelectItem>
            <SelectItem value="en">English</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="search-neighborhood">Neighborhood</Label>
        <Select
          value={neighborhood ?? ""}
          onValueChange={(value) => onFilterChange({ neighborhood: value || null })}
          items={neighborhoodItems}
        >
          <SelectTrigger id="search-neighborhood">
            <SelectValue placeholder="All neighborhoods" />
          </SelectTrigger>
          <SelectContent>
            {neighborhoods.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="search-available-from">Available from</Label>
        <Input
          id="search-available-from"
          type="date"
          value={availableFrom ?? ""}
          onChange={(e) => onFilterChange({ availableFrom: e.target.value || null })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="search-available-to">Available to</Label>
        <Input
          id="search-available-to"
          type="date"
          value={availableTo ?? ""}
          onChange={(e) => onFilterChange({ availableTo: e.target.value || null })}
        />
      </div>

      <div className="flex gap-2">
        {QUICK_SELECTS.map((quick) => {
          const endKey = addCalendarDays(todayKey, quick.endOffsetDays);
          const isSelected = availableFrom === todayKey && availableTo === endKey;
          return (
            <Button
              key={quick.label}
              type="button"
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => onFilterChange({ availableFrom: todayKey, availableTo: endKey })}
            >
              {quick.label}
            </Button>
          );
        })}
      </div>

      <Button type="button" variant="outline" disabled={!hasActiveFilter} onClick={handleClear}>
        Clear filters
      </Button>
    </div>
  );
}
