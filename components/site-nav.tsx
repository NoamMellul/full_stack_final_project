"use client";

// The mobile branch reuses the existing Popover primitive (components/ui/
// popover.tsx, a hand-wrapped @base-ui/react component) rather than
// introducing a Sheet/Drawer dependency — there are no Radix packages in
// this project and every overlay is hand-wrapped the same way.
//
// This link table is presentational only: every destination re-enforces
// its own authorization in its route layout and behind
// lib/supabase/proxy.ts, so rendering a link here grants nothing.
//
// Admin navigation lives solely in components/admin/admin-nav.tsx, mounted
// by app/admin/layout.tsx for the whole /admin subtree. This file used to
// render the same set of seven admin links a second time in the header —
// quick 260818-q5a removed that duplication.

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { useT } from "@/lib/i18n/locale-provider";

type NavLink = { href: string; labelKey: TranslationKey };

const NAV_LINKS: Record<"patient" | "doctor", NavLink[]> = {
  patient: [
    { href: "/patient", labelKey: "nav.dashboard" },
    { href: "/search", labelKey: "nav.search" },
    { href: "/patient/appointments", labelKey: "nav.appointments" },
    { href: "/patient/favorites", labelKey: "nav.favorites" },
  ],
  doctor: [
    { href: "/doctor", labelKey: "nav.dashboard" },
    { href: "/doctor/appointments", labelKey: "nav.appointments" },
    { href: "/doctor/schedule", labelKey: "nav.schedule" },
  ],
};

const ANON_LINKS: NavLink[] = [{ href: "/search", labelKey: "nav.search" }];

export default function SiteNav({ role }: { role: "patient" | "doctor" | "admin" | null }) {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // An admin resolves to an empty array — admin navigation lives solely in
  // components/admin/admin-nav.tsx (see header comment).
  const links = role === "admin" ? [] : role ? NAV_LINKS[role] : ANON_LINKS;

  // Render nothing at all rather than an empty nav landmark or a hamburger
  // that opens an empty popover — both read worse than the duplication
  // being removed.
  if (links.length === 0) {
    return null;
  }

  return (
    <>
      <nav aria-label={t("nav.aria_label")} className="hidden items-center gap-4 sm:flex">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "text-sm font-semibold"
                  : "text-sm text-muted-foreground hover:text-foreground"
              }
            >
              {t(link.labelKey)}
            </Link>
          );
        })}
      </nav>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-11 sm:hidden"
              aria-label={t("nav.menu_label")}
            />
          }
        >
          <Menu />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56">
          <nav data-testid="site-nav-menu" className="flex flex-col gap-1">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={
                    active
                      ? "rounded-md px-2 py-1.5 text-sm font-semibold"
                      : "rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                  }
                >
                  {t(link.labelKey)}
                </Link>
              );
            })}
          </nav>
        </PopoverContent>
      </Popover>
    </>
  );
}
