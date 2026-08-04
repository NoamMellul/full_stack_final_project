import Link from "next/link";

import LogoutButton from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";

export default async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border bg-secondary px-4 py-3 sm:px-6">
      <Link href="/" className="text-lg font-semibold">
        MedRDV
      </Link>
      <div className="flex items-center gap-2">
        {profile?.full_name ? (
          <span className="hidden max-w-40 truncate text-sm sm:inline">
            {profile.full_name}
          </span>
        ) : null}
        <LogoutButton />
      </div>
    </header>
  );
}
