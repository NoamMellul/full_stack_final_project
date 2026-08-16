import Link from "next/link";

import LanguageSwitcher from "@/components/language-switcher";
import LogoutButton from "@/components/logout-button";
import NotificationBell from "@/components/notification-bell";
import SiteNav from "@/components/site-nav";
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

  // Explicit narrowing, not `profile?.role ?? null`: `createServerClient()`
  // is called with no `Database` generic, so `profile` is effectively `any`
  // here and a stray string would index NAV_LINKS[role] straight into
  // undefined and crash SiteNav's .map() (T-g33-03). Anything outside the
  // three known literals fails closed to the anonymous Search-only list,
  // matching app/page.tsx's existing unrecognized-role posture.
  const role: "patient" | "doctor" | "admin" | null =
    profile?.role === "patient" || profile?.role === "doctor" || profile?.role === "admin"
      ? profile.role
      : null;

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border bg-secondary px-4 py-3 sm:px-6">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-lg font-semibold">
          MedRDV
        </Link>
        <SiteNav role={role} />
      </div>
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        {user ? (
          <>
            {profile?.full_name ? (
              <span className="hidden max-w-40 truncate text-sm sm:inline">
                {profile.full_name}
              </span>
            ) : null}
            {/* notifications.user_id is only ever written for patients and
                doctors — the bell is omitted entirely (not disabled) for an
                admin session, which has structurally nothing to show. */}
            {profile?.role === "patient" || profile?.role === "doctor" ? (
              <NotificationBell userId={user.id} viewerRole={profile.role} />
            ) : null}
            <LogoutButton />
          </>
        ) : null}
      </div>
    </header>
  );
}
