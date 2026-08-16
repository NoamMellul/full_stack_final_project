import { redirect } from "next/navigation";

import { ROLE_HOME } from "@/lib/auth/role-home";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Deliberately falls back to /login, never a dashboard: an authenticated
  // session with no profile row or an unrecognized role has no home to go
  // to, and /login is the only route guaranteed to render without
  // redirecting, so it is the one destination that cannot start a loop.
  redirect(ROLE_HOME[profile?.role ?? ""] ?? "/login");
}
