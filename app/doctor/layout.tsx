import { redirect } from "next/navigation";

import SiteHeader from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";

export default async function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  if (profile?.role !== "doctor") redirect("/");

  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
