import DoctorRequestsPageClient from "@/components/admin/doctor-requests-page-client";

export default function AdminDoctorRequestsPage() {
  return (
    <main className="flex flex-1 flex-col ps-6 pe-6 py-8">
      <h1 className="text-2xl font-semibold">Doctor requests</h1>
      <DoctorRequestsPageClient />
    </main>
  );
}
