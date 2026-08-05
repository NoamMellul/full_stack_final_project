import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

// Server Component behind the admin layout's role guard — reads through the
// session-bound client so the RLS policies that already grant an admin these
// reads are the authority (T-02-19); a Server Component read is not a Server
// Action, so this stays inside the project's REST-only convention.
export default async function AdminHomePage() {
  const supabase = await createClient();

  const [doctorsResult, activeDoctorsResult, usersResult, appointmentsResult] =
    await Promise.all([
      supabase.from("doctors").select("*", { count: "exact", head: true }),
      supabase
        .from("doctors")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("appointments").select("*", { count: "exact", head: true }),
    ]);

  const cards = [
    { caption: "Doctors", value: doctorsResult.count ?? 0 },
    { caption: "Active doctors", value: activeDoctorsResult.count ?? 0 },
    { caption: "Registered users", value: usersResult.count ?? 0 },
    { caption: "Appointments", value: appointmentsResult.count ?? 0 },
  ];

  return (
    <main className="flex flex-1 flex-col ps-6 pe-6 py-8">
      <h1 className="text-2xl font-semibold">Admin dashboard</h1>

      <div className="mt-8 grid grid-cols-2 gap-8 md:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.caption} className="bg-secondary">
            <CardContent className="flex flex-col gap-2">
              <span className="text-[32px] leading-[1.2] font-semibold">{card.value}</span>
              <span className="text-sm leading-[1.4] font-semibold">{card.caption}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
