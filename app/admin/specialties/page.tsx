import ReferenceDataPageClient from "@/components/admin/reference-data-page-client";

export default function AdminSpecialtiesPage() {
  return (
    <main className="flex flex-1 flex-col ps-6 pe-6 py-8">
      <h1 className="text-2xl font-semibold">Specialties</h1>
      <ReferenceDataPageClient resource="specialties" />
    </main>
  );
}
