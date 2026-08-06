// Shared Asia/Jerusalem conversion and display helpers.
//
// The project stores every timestamp as `timestamptz` UTC in Postgres and
// converts to Asia/Jerusalem only at the UI boundary (PROJECT.md timezone
// constraint). This module is the single place that conversion logic lives —
// no Client Component, Server Component, or Node script should redefine it.
//
// No "use client" directive and no `server-only` import: this file must be
// importable from Client Components (app/admin/appointments/page.tsx) and
// from the Node-run seed script (scripts/seed.ts) alike.

export const JERUSALEM_TIME_ZONE = "Asia/Jerusalem";

// Returns the UTC offset (ms) of `timeZone` at `date` — used to convert a
// calendar date/time that is meant as an Asia/Jerusalem local value, per the
// project timezone constraint, into the correct UTC instant rather than
// assuming the browser's (or the script runner's) ambient zone.
export function getTimeZoneOffsetMs(timeZone: string, date: Date): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

export function jerusalemBoundaryToUtcIso(dateStr: string, boundary: "start" | "end"): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const naiveUtc =
    boundary === "start"
      ? Date.UTC(year, month - 1, day, 0, 0, 0, 0)
      : Date.UTC(year, month - 1, day, 23, 59, 59, 999);
  const guess = new Date(naiveUtc);
  const offsetMs = getTimeZoneOffsetMs(JERUSALEM_TIME_ZONE, guess);
  return new Date(naiveUtc - offsetMs).toISOString();
}

// Builds the UTC instant for an Asia/Jerusalem wall-clock date/time. `month`
// is 1-based to match `jerusalemBoundaryToUtcIso`'s input convention. Used
// by the seed script to author slot times as "09:00 Israel time" and store
// the correct UTC instant across a DST boundary (offset is resolved at the
// target instant, never assumed constant).
export function jerusalemWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const guess = new Date(naiveUtc);
  const offsetMs = getTimeZoneOffsetMs(JERUSALEM_TIME_ZONE, guess);
  return new Date(naiveUtc - offsetMs);
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

// Returns 0 (Sunday) through 6 (Saturday) for `date` as observed in
// Asia/Jerusalem. Never use `Date.prototype.getDay()`, which reports the
// runner's local zone.
export function jerusalemWeekday(date: Date): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: JERUSALEM_TIME_ZONE,
    weekday: "short",
  });
  const short = formatter.format(date);
  const index = WEEKDAY_INDEX[short];
  if (index === undefined) {
    throw new Error(`Unrecognized weekday abbreviation "${short}" for date ${date.toISOString()}`);
  }
  return index;
}

// Returns the `YYYY-MM-DD` calendar day of an ISO instant in Asia/Jerusalem
// — the grouping key the profile page uses to bucket slots by day.
export function jerusalemDayKey(iso: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: JERUSALEM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date(iso)).reduce<Record<string, string>>(
    (acc, part) => {
      acc[part.type] = part.value;
      return acc;
    },
    {},
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// Returns a heading such as "Monday, August 10" for an ISO instant in
// Asia/Jerusalem.
export function formatJerusalemDayHeading(iso: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: JERUSALEM_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return formatter.format(new Date(iso));
}

// Returns a 24-hour "HH:MM" string for an ISO instant in Asia/Jerusalem.
export function formatJerusalemTime(iso: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: JERUSALEM_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return formatter.format(new Date(iso));
}
