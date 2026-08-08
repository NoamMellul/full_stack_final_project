// lib/supabase/proxy.ts — session refresh + coarse route protection.
// Structure per official Vercel/Next.js "with-supabase" example; role-gate
// prefixes verified against supabase/migrations/20260803230000_initial_schema.sql:18
// (`role text not null check (role in ('patient', 'doctor', 'admin'))`).
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ROLE_PREFIXES: Record<string, "patient" | "doctor" | "admin"> = {
  "/patient": "patient",
  "/doctor": "doctor",
  "/admin": "admin",
};

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run other code between createServerClient and getUser() — both
  // official examples warn this can cause users to be randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  // Path-segment boundary match, not a raw string prefix: a naive
  // `pathname.startsWith(p)` would match the public "/doctors" (plural,
  // patient-facing search/profile pages added in Phase 3) against the
  // "/doctor" (singular, doctor-role-gated) prefix, wrongly redirecting
  // anonymous visitors to /login on a route that must stay public.
  const matchedPrefix = Object.keys(ROLE_PREFIXES).find(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (matchedPrefix && !user) {
    const loginUrl = new URL("/login", request.url);
    // Relative pathname only — never a full URL — so the consumer in
    // lib/validation/redirect.ts (safeRedirectPath) always accepts it.
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role mismatch is deliberately NOT checked here (see 01-RESEARCH.md
  // assumption A4) — it's enforced in the role-scoped layouts instead, to
  // avoid a profiles lookup on every single request.

  return response;
}
