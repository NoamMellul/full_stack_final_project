import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { LOCALE_COOKIE_NAME } from "@/lib/i18n/dictionaries";
import { validateLocaleInput } from "@/lib/validation/locale";

// Requires no authentication: locale is a display preference for anonymous
// visitors too. A Route Handler is the only place `.set()` is legal outside
// a Server Function, which this project's REST-only constraint excludes —
// this endpoint exists specifically to satisfy the cookie-write requirement
// without one. Sets exactly one cookie and touches no session.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const validationError = validateLocaleInput(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { locale } = body as { locale: string };

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  return NextResponse.json({ ok: true });
}
