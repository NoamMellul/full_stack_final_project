"use client";

import { createContext, useCallback, useContext } from "react";

import { translate, type Locale, type TranslationKey } from "@/lib/i18n/dictionaries";

// The provider holds the locale as a plain value, never mutable state: the
// switcher changes the active locale by writing the `locale` cookie and
// triggering a server re-render (components/language-switcher.tsx), never by
// calling a setter here. That keeps exactly one source of truth for which
// locale is active — the cookie, read server-side in app/layout.tsx.
const LocaleContext = createContext<Locale | null>(null);

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={initialLocale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  const locale = useContext(LocaleContext);
  if (locale === null) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return locale;
}

export function useT(): (key: TranslationKey) => string {
  const locale = useLocale();
  return useCallback((key: TranslationKey) => translate(locale, key), [locale]);
}
