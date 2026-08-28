# MedRDV — Data Flow: Frontend ↔ Backend ↔ Database

> Interview-prep notes, not a deliverable from the assignment brief. Every claim below is verified directly in the code (file paths and line numbers cited) — nothing guessed.

There are **3 distinct circuits** in the application, not just one. Knowing which one applies where is the key to explaining the architecture.

---

## Circuit 1 — Direct read (Server Component → Supabase, no API route)

**Principle**: a page that only displays data (dashboard, search page) doesn't need any API at all. The React component itself runs on the server (Server Component by default in the Next.js App Router) and queries Supabase directly.

**Key file**: `lib/supabase/server.ts`

```ts
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() {...}, setAll() {...} } },
  );
}
```

This Supabase client is built **server-side on every request**, from the httpOnly session cookie the browser sends automatically. In other words: it's not a "generic" account or the service-role key — it's literally the JWT of the signed-in patient/doctor/admin, carried via the cookie. Result: when this client queries Postgres, **Row Level Security (RLS) applies THIS exact user's rules**, exactly as if the user had typed the SQL query themselves.

**Concrete example**: `app/doctor/(gated)/page.tsx:52-73` (the doctor dashboard)

```ts
async function DoctorDashboardStats() {
  const t = await getT();
  const supabase = await createClient();          // session-bound client
  const { data: { user } } = await supabase.auth.getUser();
  // ... resolves doctors.id via profile_id = user.id
  // ... two count("exact", head:true) queries directly on availability_slots/appointments
}
```

No `fetch()`, no `/api/...` route is called here. The component is `async`, runs on the Vercel server, and the final HTML (already filled with the real numbers) is sent to the browser. The browser never sees the SQL query or the Supabase key.

**Why this is safe without an explicit check in the code**: even if we "forgot" to filter by `doctor_id`, the RLS policy `availability_slots_select_available_or_owner_or_admin` (migration `20260803230000_initial_schema.sql:232-238`) physically prevents Postgres from returning another doctor's rows. The application-level filter (`is_doctor_owner()`) is therefore a clarity/performance layer, not the only security barrier.

**Other examples of this circuit**: `app/patient/page.tsx`, `app/search/page.tsx`, `app/doctors/[id]/page.tsx`, `app/admin/page.tsx`.

---

## Circuit 2 — Write / mutation (Client Component → API Route → Supabase → Postgres)

**Principle**: as soon as a user clicks something that **changes** data (book, cancel, add a favorite, change a password), a Server Component (which only runs once, at page load) is no longer enough — a browser-triggered interaction is needed.

**Step by step** (real example: adding a doctor to favorites):

1. **Client Component** — `components/favorite-toggle.tsx` (`"use client"` on line 1). The user clicks the heart icon.
2. `fetch("/api/patient/favorites", { method: "POST", body: JSON.stringify({ doctorId }) })` is sent by the browser, with the session cookie automatically attached.
3. **API Route** — `app/api/patient/favorites/route.ts`. The handler first calls an **authorization guard**:
   ```ts
   // lib/auth/require-patient.ts (same pattern as require-admin.ts below)
   const guard = await requirePatient();
   if (!guard.ok) return guard.response;   // clean 401/403, before touching the DB
   ```
   This guard re-reads `profiles.role` for the current user and rejects (401 if not signed in, 403 if wrong role) *before* any business query — explicit purpose (comment in `require-admin.ts:9`): *"give the caller a clean 401/403 instead of an opaque database rejection"*. **The real safety net is still the RLS layer behind it** — this guard is only a clarity/defense-in-depth layer.
4. The route inserts the row:
   ```ts
   .insert({ patient_id: guard.userId, doctor_id: doctorId })
   ```
   Crucial detail: `patient_id` comes **exclusively** from `guard.userId` (resolved server-side from the session), **never** from a field sent by the client — even if someone tampered with the network request trying to insert on behalf of another patient, that field would simply be ignored.
5. This query goes through the **session-bound** Supabase client (the same `createClient()` from `lib/supabase/server.ts`) — so RLS applies a second time, silently: the `favorites_all_own` policy (`for all using (patient_id = auth.uid())`) would validate the insert anyway even if step 3 had a bug.
6. The route responds in JSON (`201` + the created row, or an error).
7. The Client Component receives the response and updates its React state (`setIsFavorited(true)`) → the heart fills in visually, without a page reload.

**When the service-role client (`lib/supabase/admin.ts`) is used instead**: only when an operation must structurally bypass RLS — for example `POST /api/admin/doctors/[id]/link-account`, which creates a real Supabase Auth account for a doctor (`admin.auth.admin.createUser(...)`), an operation no "normal" role can perform even with RLS. This client ignores RLS entirely — so it's only called from a very small number of routes, all already protected by `requireAdmin()`.

**A special case worth knowing well — booking an appointment doesn't even go through a plain `insert()`:**

To guarantee no double-booking is ever possible, `POST /api/appointments` doesn't insert directly — it calls a **SQL function** (`book_appointment(p_slot_id)`, defined in `supabase/migrations/20260810120000_add_appointment_booking_functions.sql:37`) via `supabase.rpc("book_appointment", { p_slot_id })`. This function:
- is marked `security definer` (it runs with elevated privileges, bypassing RLS *only inside the function body*)
- resolves the patient via `auth.uid()` internally — never as a parameter (so it can never be spoofed)
- performs a **single `UPDATE ... WHERE status = 'available' AND start_at > now()`** that acts as both the check and the claim in one atomic operation — this is what makes the "two patients never book the same slot" guarantee real even under a simultaneous double-click
- and critically: direct `INSERT` on `public.appointments` is **revoked** for everyone (`revoke insert on public.appointments from anon, authenticated;`, line 315 of the same migration) — so this function is literally **the only possible entry point** to create an appointment, no matter what a client tries to send.

**Other examples of this circuit**: cancelling/rescheduling appointments, a doctor managing their schedule, admin CRUD (doctors/specialties/locations), changing a password.

---

## Circuit 3 — Realtime (browser ↔ Supabase directly, bypassing our backend entirely)

**Principle**: for live notifications (a badge that updates without a page reload), the browser opens a **websocket directly to Supabase**, completely bypassing Vercel/our API routes.

**Key file**: `components/notification-bell.tsx`, function `useNotificationRealtime()` (lines 47-104).

```ts
const channel = supabase
  .channel(`notifications-${userId}`)
  .on("postgres_changes",
    { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
    (payload) => {
      const row = payload.new;
      if (row.user_id !== userId) return;   // client-side double-check
      onInsert(row);
    })
  .subscribe();
```

What actually happens:
1. A server-side function (e.g. `book_appointment()`) inserts a row into `notifications`.
2. Postgres replicates this `INSERT` through its logical replication mechanism (WAL).
3. Supabase's Realtime service catches this event and pushes it **directly** to every websocket subscribed to that channel — without a single line of our Next.js/Vercel code involved.
4. The browser receives the event within a few hundred ms, and `useNotificationRealtime` fires `onInsert(row)` → the badge updates with no reload.

**Why this isn't a security hole** (the client supplies its own `filter: user_id=eq.${userId}`, which looks like it "trusts" the client): the RLS policy `notifications_select_own` (`for select using (user_id = auth.uid())`, `20260803230000_initial_schema.sql:271`) is **re-evaluated server-side by Supabase Realtime for every subscriber, on every event** — so even if a malicious user edited their client-side filter to try to spy on another user's notifications, Postgres would refuse to forward rows that don't belong to them. The client filter is an optimization (avoids receiving noise), not the security boundary.

A real technical gotcha we ran into: `.subscribe()` must `await supabase.auth.getSession()` before opening the channel (`notification-bell.tsx:74`), otherwise the websocket can connect authenticated only as the `anon` key, and Postgres then silently blocks every event for that connection (the channel still reports "connected" — a trap discovered only under real-world testing).
