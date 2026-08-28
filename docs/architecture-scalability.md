# MedRDV — Basic Scalability

> Interview-prep notes, not a deliverable from the assignment brief.

## What would happen with dozens/hundreds of users

The project would run unmodified up to a few hundred concurrent users, for several structural reasons already in place (detailed below): Postgres managed by Supabase with native connection pooling, pagination on lists that grow, and RLS that already filters queries at the database level rather than loading everything and filtering in the app.

The real breaking point would be the **single Postgres instance** (no read replica) if doctor search (`GET /api/doctors`) became a hot path under very heavy traffic — relevant at "thousands" of users, not at this project's scale (a university demo with a few dozen accounts).

## Which database queries could get heavy

1. **`GET /api/doctors` (public search)** — the most-hit query in the app. It can filter by specialty, neighborhood, language, availability, **and** free-text (doctor name) simultaneously. Without an index, a text search (`ILIKE '%name%'`) on `doctors.full_name` would do a full table scan on every keystroke.
2. **"Next available slot" computation** per doctor (used to sort search results) — needs to look at `availability_slots` for each candidate doctor, potentially thousands of rows if poorly indexed.
3. **Dashboard counters** (implicit `GET` in `app/doctor/(gated)/page.tsx` and `app/patient/page.tsx`) — two `count(*)` queries on every page load.
4. **The available-slots picker** on a doctor's profile page — filters `availability_slots` by `doctor_id` + `status = 'available'` + `start_at > now()`.

## The indexes already in place (and why each one exists)

| Index | Table | Serves |
|---|---|---|
| `doctors_specialty_id_idx` | `doctors(specialty_id)` | "By specialty" filter in search |
| `doctors_location_id_idx` | `doctors(location_id)` | "By neighborhood" filter |
| `doctors_is_active_idx` | `doctors(is_active)` | Every public query filters `is_active = true` |
| `doctors_full_name_trgm_idx` | `doctors` — **GIN** index with `gin_trgm_ops` (`pg_trgm` extension) | Fuzzy name search (`ILIKE`/similarity) without a full scan — a plain B-tree index can't speed up `LIKE '%text%'` (leading wildcard), so a trigram index was needed |
| `availability_slots_doctor_start_status_idx` | `availability_slots(doctor_id, start_at, status)` | Composite index — directly serves the "next available slot for a doctor" query (all 3 columns filtered together) |
| `availability_slots_available_idx` | `availability_slots(start_at) WHERE status = 'available'` | **Partial** index — contains ONLY available rows (not booked/blocked), so it's smaller and faster than indexing the whole table |
| `appointments_active_slot_unique_idx` | `appointments(slot_id) WHERE status NOT IN (...)` | **Unique partial** index — this is literally the anti-double-booking guarantee AND an index at the same time |
| `appointments_patient_id_idx` / `appointments_doctor_id_idx` | `appointments` | Fast loading of "my appointments" (patient or doctor) |
| `notifications_user_id_created_idx` | `notifications(user_id, created_at desc)` | The notification bell always loads "my notifications, most recent first" |

**What to say if the professor asks "how did you know which indexes to create"**: each index was added at the moment the corresponding query was written (not after the fact, from observed slowness) — anticipating each page's real access pattern. That's good practice, but it also means we **don't** have real load data to validate these choices (see limitations below).

## How we avoid over-fetching

- Every Supabase `select()` **explicitly** lists the needed columns — never `select("*")` on public routes. Example: `GET /api/notifications` has a `NOTIFICATION_SELECT` constant that deliberately excludes the `message` column (never rendered, so never transferred).
- Dashboard counters use `{ count: "exact", head: true }` — Postgres returns **only the number**, not the rows themselves (`HEAD` = no body).
- Server Components (Circuit 1, see `architecture-data-flow.md`) only send the browser already-computed HTML — no large JSON payload with unused client-side data.

## Pagination

Two separate, deliberately independent pagination systems (`lib/validation/search.ts` and `lib/validation/pagination.ts`):

- **Public search**: `PAGE_SIZE = 6` results per page, hardcoded server-side — **never read from the client request** (otherwise a malicious client could request `pageSize=100000` and turn the endpoint into a full database export). `MAX_PAGE = 1000` as a guard rail against an absurd numeric `OFFSET` forcing Postgres to scan needlessly far.
- **Admin lists** (`/admin/doctors`, `/admin/users`): `ADMIN_PAGE_SIZE = 25`, same server-constant logic.

**Honest limitation worth mentioning**: if the `page` parameter is absent from an admin request, the route returns **all rows unpaginated** (documented as `D-LAR-03` in the code) — a deliberate choice so the "doctor" filter on the admin appointments table doesn't break, since it needs the full doctor list. Harmless at the current scale (30 demo doctors) but would become a real problem with thousands of rows.

## Client/server separation

Already detailed in `architecture-data-flow.md` (the 3 circuits) — the guiding principle for scalability: **anything that can be computed server-side (counts, filters, sorting) is**, the client never receives more than what it actually renders.

## Current limitations (worth stating honestly)

- **No application-level rate limiting** — no API route limits requests per IP/user (only Supabase Auth has its own internal limits on authentication endpoints). Acceptable for a zero-traffic demo project, not for production.
- **No caching** (neither a CDN for dynamic data, nor an application cache like Redis) — every search request re-queries the database from scratch every time.
- **A single Postgres instance**, no read replica — all traffic (read AND write) goes through the same database.
- **`GET /api/admin/doctors` and `/api/admin/users` with no `page` param = full dump** (see above).
- **Text search limited to name trigrams** — no real full-text engine (no bio search, no advanced relevance scoring).

## What we'd improve for larger scale

1. **Rate limiting** (e.g. Upstash Redis + middleware, or Vercel's native protections) on public and authentication routes.
2. **Caching** for doctor search (results rarely change second-to-second) — via an application cache layer or Next.js `revalidate` on the read-side Server Components.
3. **Mandatory pagination by default** everywhere, even without an explicit parameter, with a separate mechanism for the one internal need (admin filter) that doesn't require a full dump.
4. **Observability** — slow-query logs / continuous `EXPLAIN ANALYZE` to validate (or correct) the current indexing choices against real load data, not just anticipation.
5. **Postgres read replica** (a feature available on paid Supabase plans) if reads became the bottleneck.
