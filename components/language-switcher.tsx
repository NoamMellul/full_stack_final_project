"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { Locale } from "@/lib/i18n/dictionaries";

// The "EN" / "עב" labels and their aria-labels are hard-coded literals, never
// routed through t() — a Hebrew reader must be able to find "עב" while the
// UI is in English, and vice versa (Copywriting Contract).
export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function switchTo(next: Locale) {
    if (next === locale || isPending) return;

    setIsPending(true);
    try {
      const response = await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });

      if (response.ok) {
        router.refresh();
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        size="sm"
        variant={locale === "en" ? "secondary" : "ghost"}
        aria-label="English"
        disabled={isPending}
        onClick={() => switchTo("en")}
      >
        EN
      </Button>
      <Button
        type="button"
        size="sm"
        variant={locale === "he" ? "secondary" : "ghost"}
        aria-label="עברית"
        disabled={isPending}
        onClick={() => switchTo("he")}
      >
        עב
      </Button>
    </div>
  );
}
