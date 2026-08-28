import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

// Forced-first-login gate (D-04). This layout wraps only the gated doctor
// pages — app/doctor/change-password/ is a sibling of this route group, not
// inside it, so the gate never fires on the page meant to clear the flag
// (RESEARCH Pitfall 2: a redirect loop would result if this check lived in
// the parent app/doctor/layout.tsx instead, which wraps every /doctor route).
//
// The parent layout already ran the auth + role check; the shared site
// header is mounted once, in the root layout (app/layout.tsx), so this
// layout renders {children} only — rendering a header here would duplicate it.
export default async function DoctorGatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("must_change_password")
      .eq("id", user.id)
      .single();

    if (profile?.must_change_password) redirect("/doctor/change-password");
  }

  return <>{children}</>;
}
