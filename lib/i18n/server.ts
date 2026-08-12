// The only i18n module that imports `next/headers` — keeping that import out
// of lib/i18n/dictionaries.ts is what allows Client Components to import the
// shared translation lookup without breaking the build.

import { cookies } from "next/headers";

import {
  LOCALE_COOKIE_NAME,
  readLocale,
  translate,
  type Locale,
  type TranslationKey,
} from "@/lib/i18n/dictionaries";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return readLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
}

export async function getT(): Promise<(key: TranslationKey) => string> {
  const locale = await getLocale();
  return (key: TranslationKey) => translate(locale, key);
}
