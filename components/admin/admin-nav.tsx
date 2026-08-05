"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/doctors", label: "Doctors" },
  { href: "/admin/specialties", label: "Specialties" },
  { href: "/admin/locations", label: "Locations" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/appointments", label: "Appointments" },
] as const;

// Persistent section nav for the whole /admin subtree. Current-section
// indication uses aria-current plus underline + font-weight, never colour
// alone (UI-SPEC accessibility direction).
export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary px-4 sm:px-6"
    >
      {SECTIONS.map((section) => {
        const isCurrent =
          section.href === "/admin"
            ? pathname === "/admin"
            : (pathname?.startsWith(section.href) ?? false);

        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={isCurrent ? "page" : undefined}
            className={cn(
              "inline-flex h-11 items-center rounded-md px-3 text-sm font-medium transition-colors",
              isCurrent
                ? "font-semibold text-foreground underline underline-offset-4"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
