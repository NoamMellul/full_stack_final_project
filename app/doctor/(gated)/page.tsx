import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function DoctorHomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 ps-6 pe-6 text-center">
      <h1 className="text-2xl font-semibold">Nothing here yet</h1>
      <p className="max-w-md text-muted-foreground">
        This is your doctor home base. Appointment details will appear here in a later phase.
      </p>
      <Button render={<Link href="/doctor/schedule" />}>Manage my schedule</Button>
    </main>
  );
}
