import ReferenceDataPageClient from "@/components/admin/reference-data-page-client";

export default function AdminLocationsPage() {
  return (
    <main className="flex flex-1 flex-col ps-6 pe-6 py-8">
      <h1 className="text-2xl font-semibold">Locations</h1>
      <ReferenceDataPageClient resource="locations" />
    </main>
  );
}
