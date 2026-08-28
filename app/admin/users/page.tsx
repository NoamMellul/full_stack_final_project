import OversightTable, { type OversightColumn } from "@/components/admin/oversight-table";
import { ADMIN_PAGE_SIZE } from "@/lib/validation/pagination";

// Rows are keyed on the profile id inside OversightTable — two profiles
// sharing an identical full_name still render as two distinct rows.
const COLUMNS: OversightColumn[] = [
  { key: "full_name", header: "Full name", format: "text", className: "max-w-48 truncate" },
  { key: "email", header: "Email", format: "text", className: "max-w-56 truncate" },
  { key: "role", header: "Role", format: "badge" },
  { key: "created_at", header: "Signup date", format: "date", timeZone: "Asia/Jerusalem" },
];

export default function AdminUsersPage() {
  return (
    <main className="flex flex-1 flex-col ps-6 pe-6 py-8">
      <h1 className="text-2xl font-semibold">Users</h1>

      <div className="mt-6">
        <OversightTable
          endpoint="/api/admin/users"
          resourceKey="users"
          resourceLabel="users"
          countNounSingular="user"
          countNounPlural="users"
          columns={COLUMNS}
          emptyHeading="No registered users yet"
          emptyBody="Patients and doctors will appear here once they sign up or are linked to an account."
          pageSize={ADMIN_PAGE_SIZE}
          paginationNavLabel="Users pagination"
        />
      </div>
    </main>
  );
}
