import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function PatientHomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 ps-6 pe-6 text-center">
      <h1 className="text-2xl font-semibold">Nothing here yet</h1>
      <p className="max-w-md text-muted-foreground">
        This is your patient home base. Book a doctor to see your appointments here.
      </p>
      <Button className="min-h-11" render={<Link href="/patient/appointments" />}>
        My appointments
      </Button>
    </main>
  );
}
