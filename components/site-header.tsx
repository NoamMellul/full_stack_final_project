import Link from "next/link";

import LanguageSwitcher from "@/components/language-switcher";
import LogoutButton from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";

// D-06: renders for anonymous visitors too (logo + switcher only) — this is
// the only header instance, mounted once in the root layout (app/layout.tsx).
export default async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user
    ? (
        await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", user.id)
          .single()
      ).data
    : null;

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border bg-secondary px-4 py-3 sm:px-6">
      <Link href="/" className="text-lg font-semibold">
        MedRDV
      </Link>
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        {/* 06-06 mounts the notification bell here, gated to profile?.role !== "admin" */}
        {user ? (
          <>
            {profile?.full_name ? (
              <span className="hidden max-w-40 truncate text-sm sm:inline">
                {profile.full_name}
              </span>
            ) : null}
            <LogoutButton />
          </>
        ) : null}
      </div>
    </header>
  );
}
