// Manual TypeScript validation (D-02) — no schema library. Reuses isLocale
// as the allow-list rather than restating the two literals.

import { isLocale } from "@/lib/i18n/dictionaries";

export function validateLocaleInput(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return "Invalid locale.";

  const { locale } = body as { locale?: unknown };
  if (typeof locale !== "string" || !isLocale(locale)) return "Invalid locale.";

  return null;
}
