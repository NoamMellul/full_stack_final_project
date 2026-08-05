import DoctorsPageClient from "@/components/admin/doctors-page-client";

export default function AdminDoctorsPage() {
  return (
    <main className="flex flex-1 flex-col ps-6 pe-6 py-8">
      <h1 className="text-2xl font-semibold">Doctors</h1>
      <DoctorsPageClient />
    </main>
  );
}
