import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";

const STAT_CAPTIONS = ["Upcoming appointments", "Available slots"] as const;

// Same 32px/600 value + 14px/600 caption stat-card markup as
// app/admin/page.tsx, shown while both count queries resolve behind the
// Suspense boundary below (UI-SPEC loading).
function DoctorDashboardStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-8">
      {STAT_CAPTIONS.map((caption) => (
        <Card key={caption} className="bg-secondary">
          <CardContent className="flex flex-col gap-2">
            <Skeleton className="h-[32px] w-16" />
            <span className="text-sm leading-[1.4] font-semibold">{caption}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Async Server Component so both counts are computed server-side from a
// database query, never from a client-supplied value (T-06-12). Resolves
// doctors.id the same way requireDoctor() does (profile_id = auth.uid()),
// replicated here rather than calling the guard, which returns a
// NextResponse unusable in a page.
async function DoctorDashboardStats() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: doctor, error: doctorError } = await supabase
    .from("doctors")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  // Defensive branch only — app/doctor/layout.tsx already guarantees a
  // doctor session by the time this component renders.
  if (doctorError || !doctor) return null;

  const doctorId = doctor.id;
  // Both predicates share one instant so "upcoming" and "available" agree on
  // what "now" means for this single render.
  const nowIso = new Date().toISOString();

  const [upcomingResult, availableResult] = await Promise.all([
    // DOCTOR-01 — appointments joined to their slot's start_at via !inner so
    // the embedded .gt() filter narrows the parent count; never cancelled,
    // never .gte (a slot starting exactly now is not upcoming).
    supabase
      .from("appointments")
      .select("id, slot:availability_slots!inner(start_at)", { count: "exact", head: true })
      .eq("doctor_id", doctorId)
      .not("status", "in", "(cancelled_by_patient,cancelled_by_doctor)")
      .gt("slot.start_at", nowIso),
    // DOCTOR-02 — the exact predicate GET /api/doctor/slots already uses,
    // requesting a count instead of rows.
    supabase
      .from("availability_slots")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", doctorId)
      .eq("status", "available")
      .gt("start_at", nowIso),
  ]);

  // count ?? 0 so a null count from a driver error renders the literal
  // number 0 rather than an empty/missing-data card (a zero count is a
  // normal value, matching the admin dashboard's identical stat cards).
  const cards = [
    { caption: "Upcoming appointments", value: upcomingResult.count ?? 0 },
    { caption: "Available slots", value: availableResult.count ?? 0 },
  ];

  return (
    <div className="grid grid-cols-2 gap-8">
      {cards.map((card) => (
        <Card key={card.caption} className="bg-secondary">
          <CardContent className="flex flex-col gap-2">
            <span className="text-[32px] leading-[1.2] font-semibold">{card.value}</span>
            <span className="text-sm leading-[1.4] font-semibold">{card.caption}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function DoctorDashboardPage() {
  return (
    <main className="flex flex-1 flex-col ps-6 pe-6 py-8">
      <h1 className="text-2xl font-semibold">My dashboard</h1>

      <div className="mt-8 flex flex-col gap-8">
        <Suspense fallback={<DoctorDashboardStatsSkeleton />}>
          <DoctorDashboardStats />
        </Suspense>

        <div className="flex items-center gap-2">
          <Button render={<Link href="/doctor/schedule" />}>Manage my schedule</Button>
          <Button variant="outline" render={<Link href="/doctor/appointments" />}>
            My appointments
          </Button>
        </div>
      </div>
    </main>
  );
}
