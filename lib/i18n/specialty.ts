// Locale-aware specialty label resolution.
//
// Specialty names reach call sites in one of two shapes: flat on a search-view
// row (`specialty_name_en` / `specialty_name_he`, e.g. doctor-card.tsx) or
// nested and nullable on a join (`specialty.name_en` / `specialty.name_he`,
// e.g. app/doctors/[id]/page.tsx). This helper takes bare strings rather than
// a row object so both shapes can call it identically after their own
// existing null guard, without this module needing to know either row type.
//
// Fallback deliberately mirrors translate()'s locale -> English chain (locked
// in phase 06-05): a specialty must never render as an empty label.

import type { Locale } from "@/lib/i18n/dictionaries";

export function specialtyLabel(
  locale: Locale,
  nameEn: string,
  nameHe: string | null | undefined,
): string {
  if (locale === "he" && nameHe && nameHe.trim().length > 0) {
    return nameHe;
  }
  return nameEn;
}
