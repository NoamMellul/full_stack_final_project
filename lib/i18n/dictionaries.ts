// Custom lightweight i18n runtime (PROJECT.md i18n constraint — no next-intl,
// no locale routing needed for 2 static languages).
//
// Carries no client-only directive and no `server-only` import: this module
// must be importable from Client Components (lib/i18n/locale-provider.tsx),
// Server Components (lib/i18n/server.ts), and Node scripts alike — the same
// rule lib/timezone.ts follows. The header-reading Next.js API is deliberately
// kept out of this file (see lib/i18n/server.ts) so Client Components can
// import the shared lookup without breaking the build.

import en from "@/dictionaries/en.json";
import he from "@/dictionaries/he.json";

export const SUPPORTED_LOCALES = ["en", "he"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_COOKIE_NAME = "locale";

export type TranslationKey = keyof typeof en;

// Typing the Hebrew dictionary as a complete Record over the English key
// union makes a missing Hebrew key a compile-time error, not a runtime blank.
const dictionaries: Record<Locale, Record<TranslationKey, string>> = {
  en,
  he: he as Record<TranslationKey, string>,
};

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function readLocale(value: string | undefined): Locale {
  return isLocale(value) ? value : "en";
}

export const FALLBACK_TRANSLATION = "Translation unavailable";

// Never returns the key path, `undefined`, or an empty string: locale value
// -> English value -> fixed fallback string. The fallback branches are
// statically unreachable given TranslationKey's exhaustive typing, but exist
// so a cast-through can never produce a blank UI.
export function translate(locale: Locale, key: TranslationKey): string {
  return dictionaries[locale]?.[key] ?? dictionaries.en[key] ?? FALLBACK_TRANSLATION;
}
