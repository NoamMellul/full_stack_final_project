# MedRDV — Technical Choices Q&A

> Interview-prep notes, not a deliverable from the assignment brief.

---

## Why Tailwind CSS + shadcn/ui instead of something else

The choice was compared against three serious alternatives:

| Option | Why it was ruled out |
|---|---|
| **Material UI / Ant Design** | "Batteries-included" component libraries with their own JS-in-CSS theming system (styled-components under the hood) — heavier, and less idiomatic with Next.js **Server Components** (many of their components require `"use client"` by default, which breaks the server-rendering benefit for pages like dashboards) |
| **CSS Modules / styled-components** | No ready-made coherent design system — everything (spacing, colors, sizes) would have had to be built by hand, for a project already loaded with features |
| **Bootstrap** | Built for classic HTML, poor native RTL support (Hebrew was a hard requirement from day one), and visually dated without heavy customization |

**Why Tailwind + shadcn/ui won:**
1. **Tailwind = utility classes**, so zero separate CSS files to maintain, and above all: **RTL support via "logical properties"** (`ps-`/`pe-`/`ms-`/`me-`/`start-`/`end-` instead of `pl-`/`pr-`/`left-`/`right-`) — a single class automatically flips direction depending on `dir="ltr"` or `dir="rtl"`, which is *exactly* what we need (bilingual Hebrew/English interface). This is mechanically verified in the project: a grep across all of `app/`+`components/` confirms zero physical-direction classes.
2. **shadcn/ui is not a classic npm dependency** — it's a generator that *copies the component's source code straight into our repo* (`npx shadcn add ...`). Result: we own and can modify every component directly, no black box, and it stays 100% compatible with Server Components (components are only `"use client"` when actually needed, e.g. `Popover`, `Select`).
3. Lightweight — no large JS bundle of components we never use.

---

## Is Postgres "the default" for Supabase?

A framing to correct if the professor asks it that way: **Supabase isn't "a database with Postgres as the default option" — Supabase IS literally built on top of Postgres, it isn't a choice among several engines Supabase offers.** Unlike Firebase (NoSQL, proprietary) or PlanetScale (MySQL), Supabase = managed Postgres + an Auth/Realtime/Storage layer on top. There's no "MongoDB mode" toggle inside Supabase.

**Why this is a real technical advantage we actively exploit, not just "it was imposed on us":**
- **Row Level Security (RLS)** — a native Postgres feature (not a Supabase invention) that we use as the primary authorization layer across all 11 tables.
- **Exclusion constraint (`EXCLUDE USING gist`)** on `availability_slots` (lines 73-76 of the initial migration) — an advanced SQL mechanism specific to Postgres that prevents two overlapping slots for the same doctor at the database level itself. Impossible to replicate as cleanly with a NoSQL engine.
- **`SECURITY DEFINER` functions** (`book_appointment`, `reschedule_appointment`, `cancel_appointment`) — real business logic executed *inside* the database, with guaranteed ACID transactions, instead of being rebuilt (and potentially race-condition-prone) at the application layer.
- **`pg_trgm` extension** used for fuzzy doctor-name search (a GIN index on `doctors.full_name`).

So the real answer if asked "why Postgres": *"Because Supabase = Postgres, it wasn't really a separate choice — but more importantly, we exploit advanced Postgres features (RLS, exclusion constraints, SECURITY DEFINER functions) that would be either impossible or far more fragile to replicate with a NoSQL database."*

---

## Why not Server Actions — REST was simpler

**What Server Actions are** (to be precise if the professor asks): a Next.js feature that lets you call a server function directly from a React component via `"use server"`, without writing an explicit HTTP route — the framework handles the transport internally (a hidden internal `fetch`).

**We deliberately avoided them, for several concrete reasons, not just "out of habit":**

1. **Universal standard vs. framework-specific.** An API route (`app/api/x/route.ts`) is a classic HTTP endpoint — `GET`/`POST`/`PATCH`/`DELETE` with a status code and JSON. Any developer (or any professor in an interview) immediately understands what `POST /api/patient/favorites` does. A Server Action is a mechanism specific to Next.js — less transferable as knowledge, and harder to explain/defend out loud without going into the framework's internal details (progressive-enhancement forms, automatic serialization, etc.).

2. **Testability with Playwright.** Our ~50 E2E tests exercise a lot of behavior **directly at the HTTP level** (`page.request.post("/api/...")`, checking a 403/404 status code, sending an invalid token) — trivial with a real REST route, and noticeably more indirect with Server Actions (no stable URL to call directly in a test, you have to simulate the full UI interaction).

3. **Clear client/server separation.** With API routes, the boundary is explicit in the code: "this is a `fetch()`, so this goes to the server." With Server Actions, that boundary is more implicit (a normal-looking JS function, called as if it were local, but actually executing elsewhere) — for a project where we ourselves have to understand and explain every flow in depth (an explicit requirement of the assignment brief), keeping that separation visible in the code makes it easier to reason about.

4. **It wasn't harder to do in REST.** The project never had a use case that *truly required* a Server Action (no form needing progressive enhancement without JS, no need for the framework's fine-grained built-in optimistic mutation) — so there was no real benefit to paying the extra complexity cost. **REST did exactly the job, more simply and more readably.**

**What NOT to say** (avoid this in the interview): "Server Actions don't work with Supabase" or "it's technically impossible" — that's false, it would have worked perfectly well. The real answer is a **deliberate choice of simplicity and architectural/pedagogical clarity**, not a technical constraint.
