import DoctorsPageClient from "@/components/admin/doctors-page-client";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function AdminDoctorsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Read once, server-side, and hand the prefill down as a plain prop —
  // this is deliberate: it keeps DoctorsPageClient free of useSearchParams()
  // (and therefore free of the Suspense-boundary requirement app/login/
  // page.tsx needed for the same reason), and it makes the prefilled values
  // present on the very first client render instead of arriving a tick
  // later.
  const params = await searchParams;
  const prefill = {
    fullName: firstValue(params.prefillName),
    specialtyId: firstValue(params.prefillSpecialtyId),
    email: firstValue(params.prefillEmail),
    requestId: firstValue(params.requestId),
  };

  return (
    <main className="flex flex-1 flex-col ps-6 pe-6 py-8">
      <h1 className="text-2xl font-semibold">Doctors</h1>
      <DoctorsPageClient prefill={prefill} />
    </main>
  );
}
