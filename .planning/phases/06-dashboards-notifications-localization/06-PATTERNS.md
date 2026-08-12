# Phase 6: Dashboards, Notifications & Localization - Pattern Map

**Mapped:** 2026-08-11
**Files analyzed:** 20
**Analogs found:** 17 / 20

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `app/api/patient/favorites/route.ts` (GET, POST) | route | CRUD | `app/api/patient/appointments/route.ts` (GET) + `app/api/doctor/slots/route.ts` (POST) | role-match (composite) |
| `app/api/patient/favorites/[id]/route.ts` (DELETE) | route | CRUD | `app/api/doctor/slots/[id]/route.ts` (DELETE) | exact (ownership-restated delete-by-composite-key) |
| `app/api/notifications/route.ts` (GET) | route | request-response | `app/api/patient/appointments/route.ts` | exact |
| `app/api/notifications/[id]/read/route.ts` (PATCH) | route | CRUD | `app/api/doctor/slots/[id]/route.ts` (DELETE, ownership pattern) | role-match |
| `app/api/locale/route.ts` (POST) | route | request-response | `app/api/auth/logout/route.ts` | role-match (simple POST, cookie/session side effect) |
| `app/api/doctor/dashboard-summary/route.ts` (GET, optional) | route | request-response | `app/api/doctor/slots/route.ts` (GET, head-only count variant) | role-match |
| `lib/auth/require-patient.ts` | middleware/utility | request-response | itself (already exists, reused as-is) | exact — no changes needed |
| `lib/auth/require-doctor.ts` | middleware/utility | request-response | itself (already exists, reused as-is) | exact — no changes needed |
| `lib/i18n/locale-provider.tsx` | provider | event-driven | none in codebase (new pattern) | no analog |
| `lib/i18n/dictionaries.ts` | utility | transform | none in codebase (new pattern) | no analog |
| `lib/i18n/notification-copy.ts` | utility | transform | `lib/timezone.ts` (pure lookup/format helper style) | role-match |
| `dictionaries/en.json`, `dictionaries/he.json` | config | — | none | no analog (new data files) |
| `components/site-header.tsx` (modified, D-06) | component | request-response | itself, current version | exact (modify in place) |
| `components/logout-button.tsx` (unchanged, reused as pattern) | component | event-driven | — | source pattern for language-switcher & favorite-toggle |
| `components/language-switcher.tsx` | component | event-driven | `components/logout-button.tsx` | exact |
| `components/notification-bell.tsx` | component | streaming (Realtime) | `components/logout-button.tsx` (fetch+client state shape) + RESEARCH.md Pattern 3 (Realtime hook) | role-match |
| `components/favorite-toggle.tsx` | component | event-driven | `components/logout-button.tsx` (optimistic client action + fetch pattern) | role-match |
| `app/patient/page.tsx` (dashboard content) | component/page | CRUD (read aggregate) | `app/patient/page.tsx` (current placeholder) + `app/api/patient/appointments/route.ts` for data shape | exact (modify in place) |
| `app/doctor/(gated)/page.tsx` (dashboard content) | component/page | CRUD (read aggregate) | `app/doctor/(gated)/page.tsx` (current placeholder) + `app/api/doctor/slots/route.ts` (count pattern) | exact (modify in place) |
| `app/patient/favorites/page.tsx` | page | CRUD | `app/patient/appointments/page.tsx` (list page reading a REST GET, rendering cards) | role-match |
| `app/doctors/[id]/page.tsx` (add favorite toggle) | page | request-response | itself, current version | exact (modify in place) |
| `components/search/doctor-card.tsx` (add favorite toggle) | component | request-response | itself, current version | exact (modify in place) |
| `app/layout.tsx` (locale cookie read, D-05) | config/layout | request-response | itself, current version | exact (modify in place) |
| `supabase/migrations/<ts>_enable_notifications_realtime.sql` | migration | event-driven | `supabase/migrations/20260803230000_initial_schema.sql` (RLS/table conventions) | role-match |

## Pattern Assignments

### `app/api/patient/favorites/[id]/route.ts` (route, CRUD)

**Analog:** `app/api/doctor/slots/[id]/route.ts` (DELETE handler)

**Imports pattern** (lines 1-3):
```typescript
import { NextResponse } from "next/server";
import { requireDoctor } from "@/lib/auth/require-doctor"; // swap for requirePatient
```

**Core delete-by-composite-key pattern** (lines 37-64, adapt `doctor_id`/`status` conditions to `favorites`):
```typescript
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePatient();
  if (!guard.ok) return guard.response;

  const { id: doctorId } = await params; // [id] = doctors.id, per RESEARCH.md D-01 UX

  const { error, count } = await guard.supabase
    .from("favorites")
    .delete({ count: "exact" })
    .eq("patient_id", guard.userId)
    .eq("doctor_id", doctorId);

  if (error) {
    return NextResponse.json({ error: "Could not remove this favorite. Please try again." }, { status: 500 });
  }
  if (count === 0) {
    return NextResponse.json({ error: "This doctor is not in your favorites." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
```

**404-not-403 IDOR discipline** (lines 5-23, doctrine to copy verbatim as inline comment): a foreign/nonexistent id must produce the identical response — never confirm existence of another user's row. This is the established codebase convention (T-04-03 precedent) and applies to both `favorites/[id]` DELETE and `notifications/[id]/read` PATCH.

---

### `app/api/patient/favorites/route.ts` (route, CRUD — GET list, POST add)

**Analog for GET:** `app/api/patient/appointments/route.ts`
**Analog for POST:** `app/api/doctor/slots/route.ts` (POST handler, lines 33-92)

**GET pattern** (full file, 1-33):
```typescript
import { NextResponse } from "next/server";
import { requirePatient } from "@/lib/auth/require-patient";

export async function GET() {
  const guard = await requirePatient();
  if (!guard.ok) return guard.response;

  // .eq("patient_id", guard.userId) restates favorites_all_own RLS.
  const { data, error } = await guard.supabase
    .from("favorites")
    .select("id, doctor_id, created_at, doctors(id, full_name, photo_url, ...)") // join shape TBD by planner
    .eq("patient_id", guard.userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Could not load your favorites. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ favorites: data });
}
```

**POST error-mapping pattern** (lines 65-92 of `app/api/doctor/slots/route.ts` — branch strictly on `error.code`, never `error.message`):
```typescript
if (error?.code === "23505") { // unique constraint on (patient_id, doctor_id)
  return NextResponse.json({ error: "This doctor is already in your favorites." }, { status: 409 });
}
```

---

### `app/api/notifications/route.ts` (route, request-response)

**Analog:** `app/api/patient/appointments/route.ts` (same shape — RLS-scoped read, ownership restated, `.order()`, deliberate `select()` field allowlist)

**Full pattern (verbatim from RESEARCH.md Code Examples, verified against `app/api/patient/appointments/route.ts` shape):**
```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  // .eq("user_id", user.id) restates notifications_select_own RLS.
  // `message` is deliberately NOT selected — D-03 requires it never render.
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, related_appointment_id, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Could not load notifications. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ notifications: data });
}
```
Note: this uses the bare `createClient()` + `auth.getUser()` shape (both patient and doctor roles read the same table) rather than `requirePatient()`/`requireDoctor()`, since notifications are role-agnostic — mirror `app/api/patient/appointments/route.ts`'s import/error style, not its role guard.

---

### `app/api/notifications/[id]/read/route.ts` (route, CRUD)

**Analog:** `app/api/doctor/slots/[id]/route.ts` (ownership-restated mutation + 404-not-403 discipline)

```typescript
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { id } = await params;

  // .eq("user_id", user.id) restates notifications_update_own RLS.
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Could not update this notification." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "This notification no longer exists." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
```

---

### `app/api/locale/route.ts` (route, request-response)

**Analog:** `app/api/auth/logout/route.ts` (simple POST Route Handler with a session/cookie side effect, no DB row mutation)

**Pattern (verbatim from RESEARCH.md, matches the project's Route-Handler-not-Server-Action constraint):**
```typescript
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const { locale } = await request.json();
  if (locale !== "en" && locale !== "he") {
    return NextResponse.json({ error: "Invalid locale." }, { status: 400 });
  }
  const cookieStore = await cookies();
  cookieStore.set("locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return NextResponse.json({ ok: true });
}
```

---

### `components/language-switcher.tsx` (component, event-driven)

**Analog:** `components/logout-button.tsx` (full file, 52 lines) — exact structural match: `"use client"`, `useRouter`, `fetch` a Route Handler, then `router.refresh()` (or `router.push` + `router.refresh()`), pending/error state via `useState`.

**Pattern to copy directly:**
```typescript
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function LanguageSwitcher({ current }: { current: "en" | "he" }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function switchTo(locale: "en" | "he") {
    setIsPending(true);
    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    });
    router.refresh();
    setIsPending(false);
  }
  // render two toggle buttons calling switchTo("en") / switchTo("he"),
  // disabled while isPending — same disabled-during-fetch pattern as LogoutButton
}
```

---

### `components/favorite-toggle.tsx` (component, event-driven)

**Analog:** `components/logout-button.tsx` (client action + fetch + error state shape) combined with `components/search/doctor-card.tsx` (`"use client"`, local `useState` for a boolean UI flag like `photoFailed`)

**Pattern:**
```typescript
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function FavoriteToggle({ doctorId, initialFavorited }: { doctorId: string; initialFavorited: boolean }) {
  const [isFavorited, setIsFavorited] = useState(initialFavorited);
  const [isPending, setIsPending] = useState(false);

  async function toggle() {
    setIsPending(true);
    const method = isFavorited ? "DELETE" : "POST";
    const url = isFavorited ? `/api/patient/favorites/${doctorId}` : "/api/patient/favorites";
    const response = await fetch(url, {
      method,
      headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
      body: method === "POST" ? JSON.stringify({ doctorId }) : undefined,
    });
    if (response.ok) setIsFavorited(!isFavorited);
    setIsPending(false);
  }
  // heart icon Button, aria-pressed={isFavorited}, disabled={isPending}
}
```
Note D-01: both entry points (search card + doctor profile page) render this same component with `initialFavorited` sourced from the server (doctor profile page fetches via `requirePatient`-guarded server query; search results would need a bulk-favorited-lookup or fall back to client-fetch-on-mount — planner's call).

---

### `components/notification-bell.tsx` (component, streaming/Realtime)

**Analog:** RESEARCH.md Pattern 3 (Realtime subscription hook), structurally similar to `components/logout-button.tsx`'s `"use client"` + fetch + state shape, but adds a `useEffect` subscription lifecycle absent from any existing component in this codebase (no analog for the Realtime part itself).

**Realtime hook pattern (verbatim from RESEARCH.md, CITED against supabase docs):**
```typescript
"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useNotificationRealtime(userId: string | null, onInsert: (row: NotificationRow) => void) {
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => onInsert(payload.new as NotificationRow),
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, onInsert]);
}
```
Initial load: `GET /api/notifications` on mount (fetch pattern from `components/logout-button.tsx`), then increment/prepend on Realtime INSERT events. Uses `lib/supabase/client.ts`'s `createClient()` (browser client), not the server client — confirmed 8-line file, no changes needed there.

---

### `components/site-header.tsx` (component, modify in place — D-06)

**Current file (full, 35 lines) is the analog for itself** — remove line 12 (`if (!user) return null;`), keep the rest, add `LanguageSwitcher` (always) and `NotificationBell` (only when `user` present) inside the existing `<div className="flex items-center gap-2">` alongside `LogoutButton`.

```typescript
// current structure to preserve:
import Link from "next/link";
import LogoutButton from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";

export default async function SiteHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // REMOVE: if (!user) return null;

  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name, role").eq("id", user.id).single()
    : { data: null };

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border bg-secondary px-4 py-3 sm:px-6">
      <Link href="/" className="text-lg font-semibold">MedRDV</Link>
      <div className="flex items-center gap-2">
        <LanguageSwitcher current={/* from cookie, passed down or read via LocaleProvider */} />
        {user ? (
          <>
            {profile?.full_name ? <span className="hidden max-w-40 truncate text-sm sm:inline">{profile.full_name}</span> : null}
            <NotificationBell userId={user.id} />
            <LogoutButton />
          </>
        ) : null}
      </div>
    </header>
  );
}
```

---

### `app/patient/page.tsx` and `app/doctor/(gated)/page.tsx` (dashboard content, modify in place)

**Analog:** current placeholder files themselves (both fully read, 17-21 lines each) — same layout shell (`main` with `flex flex-1 flex-col items-center justify-center gap-4`) is replaced with real dashboard cards, not a from-scratch page. Data fetched server-side via the same guard pattern already established (`requirePatient()`/`requireDoctor()` for the read, or direct `createClient()` + `auth.getUser()` matching `SiteHeader`'s server-component shape).

**Count-query pattern for doctor dashboard (DOCTOR-01/02), analog `app/api/doctor/slots/route.ts` GET filter shape:**
```typescript
const { count: upcomingCount } = await guard.supabase
  .from("appointments")
  .select("*", { count: "exact", head: true })
  .eq("doctor_id", guard.doctorId)
  .eq("status", "confirmed") // exact status value per schema — verify at plan time
  .gt("start_at", new Date().toISOString());

const { count: availableSlotsCount } = await guard.supabase
  .from("availability_slots")
  .select("*", { count: "exact", head: true })
  .eq("doctor_id", guard.doctorId)
  .eq("status", "available")
  .gt("start_at", new Date().toISOString());
```

**Patient dashboard (PATIENT-04):** reuse `GET /api/patient/appointments` + `lib/appointments.ts`'s `splitAppointments()` client-side (already-established D-18 precedent per RESEARCH.md) rather than a new endpoint — render `upcoming.slice(0, N)` as the summary.

Use `Card`/`CardContent` (`components/ui/card.tsx`) for the summary blocks, `Badge` (`components/ui/badge.tsx`) for counts — both already used in `components/search/doctor-card.tsx` and directly reusable.

---

### `app/layout.tsx` (modify in place, D-05)

**Analog:** current file itself (33 lines, fully read) — add `cookies()` read, `dir`/`lang` computation, wrap children in `LocaleProvider`.

```typescript
import { cookies } from "next/headers";
// ...existing font imports...
import LocaleProvider from "@/lib/i18n/locale-provider";

const SUPPORTED_LOCALES = ["en", "he"] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];
function readLocale(value: string | undefined): Locale {
  return SUPPORTED_LOCALES.includes(value as Locale) ? (value as Locale) : "en";
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const locale = readLocale(cookieStore.get("locale")?.value);
  const dir = locale === "he" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
```
Note (Pitfall 3 from RESEARCH.md): this opts the entire app into dynamic rendering — an accepted, unavoidable D-05 tradeoff, not a defect.

## Shared Patterns

### Ownership restatement behind RLS (defense-in-depth)
**Source:** `app/api/doctor/slots/[id]/route.ts` (lines 5-23, 58-64), `app/api/patient/appointments/route.ts` (lines 14-22)
**Apply to:** every new mutating/reading route (`favorites` GET/POST/DELETE, `notifications` GET/PATCH) — always `.eq(ownership_column, guard.userId)` even though RLS (`favorites_all_own`, `notifications_select_own`/`update_own`) already enforces it server-side.

### 404-not-403 for foreign ids
**Source:** `app/api/doctor/slots/[id]/route.ts` lines 5-23
**Apply to:** `DELETE /api/patient/favorites/[id]`, `PATCH /api/notifications/[id]/read` — never let a response distinguish "belongs to someone else" from "doesn't exist."

### Error-code branching, never error.message
**Source:** `app/api/doctor/slots/route.ts` lines 65-89 (`error?.code === "23P01"`, `"23514"`)
**Apply to:** `POST /api/patient/favorites` (branch on `23505` unique-violation for "already favorited").

### Client action fetch+state shape (`"use client"`, `useState` pending/error, `fetch` a Route Handler, `router.refresh()`)
**Source:** `components/logout-button.tsx` (full file)
**Apply to:** `components/language-switcher.tsx`, `components/favorite-toggle.tsx`, `components/notification-bell.tsx`'s initial fetch.

### Guard pattern (`requirePatient()`/`requireDoctor()`)
**Source:** `lib/auth/require-patient.ts`, `lib/auth/require-doctor.ts` (both unchanged, reused as-is)
**Apply to:** any new route scoped to one role (`favorites/*`); routes serving both roles (`notifications/*`) instead use the bare `createClient()` + `auth.getUser()` shape from `app/api/patient/appointments/route.ts`/`SiteHeader`.

### Head-only count query for dashboard aggregates
**Source:** `app/api/doctor/slots/route.ts` GET filter shape (lines 16-21); STATE.md Plan 02-07 admin-dashboard four-count precedent
**Apply to:** DOCTOR-01/02 dashboard summary counts.

### Tailwind logical properties only
**Source:** standing invariant since Phase 1, visible in every read file (`app/patient/page.tsx` `ps-6 pe-6`, etc.)
**Apply to:** every new/modified component and page this phase — critical now that RTL is actually exercised (RESEARCH.md Pitfall 7). Run a `pl-|pr-|ml-|mr-|text-left|text-right` grep audit before closing the phase.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/i18n/locale-provider.tsx` | provider | event-driven | First React Context provider in the codebase — no prior provider pattern exists to copy; build per RESEARCH.md Architecture Patterns / Pattern 4 |
| `lib/i18n/dictionaries.ts` | utility | transform | First dictionary/translation lookup utility — no prior i18n code exists |
| `dictionaries/en.json`, `dictionaries/he.json` | config | — | New data files, no prior JSON dictionary in the repo |
| `supabase/migrations/<ts>_enable_notifications_realtime.sql` | migration | event-driven | First Realtime-publication migration; existing migrations only cover schema/RLS/functions — use RESEARCH.md Pattern 3's `ALTER PUBLICATION` SQL verbatim, follow existing migration file naming/header-comment conventions from `supabase/migrations/20260810120000_add_appointment_booking_functions.sql` |
| `lib/i18n/notification-copy.ts` | utility | transform | Novel viewer-role + type → dictionary-key resolver (D-03/Pitfall 1); no prior resolver of this shape, though it follows the general "pure lookup function" style of `lib/timezone.ts` |

## Metadata

**Analog search scope:** `app/api/**`, `components/**`, `lib/auth/**`, `lib/supabase/**`, `app/patient/**`, `app/doctor/**`, `app/layout.tsx`, `supabase/migrations/**`
**Files scanned:** 14 read directly this session (site-header.tsx, logout-button.tsx, require-patient.ts, require-doctor.ts, patient/page.tsx, doctor/(gated)/page.tsx, api/patient/appointments/route.ts, api/doctor/slots/route.ts, api/doctor/slots/[id]/route.ts, doctor-card.tsx, layout.tsx, lib/supabase/client.ts) plus prior RESEARCH.md/CONTEXT.md-cited reads (lib/timezone.ts, api/patient/appointments contents, api/auth/logout/route.ts path confirmed)
**Pattern extraction date:** 2026-08-11
