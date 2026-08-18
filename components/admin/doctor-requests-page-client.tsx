"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { JERUSALEM_TIME_ZONE } from "@/lib/timezone";

const TABLE_COLUMN_COUNT = 7;

type DoctorRequestRow = {
  id: string;
  full_name: string;
  email: string;
  message: string | null;
  status: "pending" | "reviewed";
  created_at: string;
  specialty: { id: string; name_en: string; name_he: string } | null;
};

const submittedFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: JERUSALEM_TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "short",
});

export default function DoctorRequestsPageClient() {
  const router = useRouter();
  const [requests, setRequests] = useState<DoctorRequestRow[]>([]);
  // "loading" only covers the very first GET — later refreshes (post-mark-
  // reviewed, Retry) update `requests` in place without re-showing the
  // skeleton rows.
  const [listStatus, setListStatus] = useState<"loading" | "error" | "ready">("loading");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/doctor-requests");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not load doctor requests. Please refresh the page.");
      }
      setRequests(data.requests as DoctorRequestRow[]);
      setListStatus("ready");
    } catch {
      setListStatus("error");
    }
  }, []);

  useEffect(() => {
    async function initialLoad() {
      await loadRequests();
    }
    void initialLoad();
  }, [loadRequests]);

  function handleRetry() {
    setListStatus("loading");
    void loadRequests();
  }

  // Builds the prefill hop for the /admin/doctors create form. Uses
  // URLSearchParams (never manual string concatenation) since names carry
  // spaces and emails carry `@`. specialtyId is omitted entirely when the
  // request has no specialty, never emitted as an empty string.
  function handleApprove(request: DoctorRequestRow) {
    const params = new URLSearchParams();
    params.set("prefillName", request.full_name);
    params.set("prefillEmail", request.email);
    params.set("requestId", request.id);
    if (request.specialty) {
      params.set("prefillSpecialtyId", request.specialty.id);
    }
    router.push(`/admin/doctors?${params.toString()}`);
  }

  async function handleMarkReviewed(request: DoctorRequestRow) {
    setMarkingId(request.id);
    try {
      const response = await fetch(`/api/admin/doctor-requests/${request.id}`, {
        method: "PATCH",
      });
      const data = await response.json();

      if (!response.ok) {
        setStatusMessage(data.error ?? "Could not update this request. Please try again.");
        return;
      }

      setStatusMessage(`${request.full_name}'s request marked reviewed.`);
      await loadRequests();
    } catch {
      setStatusMessage("Could not update this request. Please try again.");
    } finally {
      setMarkingId(null);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-2">
      {listStatus === "ready" ? (
        <p className="text-sm text-muted-foreground">
          {requests.length === 1 ? "1 request" : `${requests.length} requests`}
        </p>
      ) : null}

      <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
        {statusMessage ?? ""}
      </p>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Specialty</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          {listStatus === "loading" ? (
            <TableBody>
              {[0, 1, 2].map((row) => (
                <TableRow key={row}>
                  <TableCell colSpan={TABLE_COLUMN_COUNT}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          ) : listStatus === "error" ? (
            <TableBody>
              <TableRow>
                <TableCell colSpan={TABLE_COLUMN_COUNT}>
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <p className="text-sm text-destructive">
                      Could not load doctor requests. Please refresh the page.
                    </p>
                    <Button type="button" variant="outline" onClick={handleRetry}>
                      Retry
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          ) : requests.length === 0 ? (
            <TableBody>
              <TableRow>
                <TableCell colSpan={TABLE_COLUMN_COUNT}>
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <h2 className="text-lg font-semibold">No doctor requests yet</h2>
                    <p className="max-w-md text-sm text-muted-foreground">
                      Requests submitted from the /login page will appear here.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          ) : (
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="max-w-48 truncate">{request.full_name}</TableCell>
                  <TableCell className="max-w-48 truncate">{request.email}</TableCell>
                  <TableCell className="max-w-32 truncate">
                    {request.specialty?.name_en ?? ""}
                  </TableCell>
                  <TableCell className="max-w-48 truncate">{request.message ?? ""}</TableCell>
                  <TableCell>{submittedFormatter.format(new Date(request.created_at))}</TableCell>
                  <TableCell>
                    <Badge variant={request.status === "pending" ? "secondary" : "default"}>
                      {request.status === "pending" ? "Pending" : "Reviewed"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {request.status === "pending" ? (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          aria-label={`Approve request for ${request.full_name}`}
                          onClick={() => handleApprove(request)}
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={markingId === request.id}
                          aria-label={`Mark reviewed for ${request.full_name}`}
                          onClick={() => void handleMarkReviewed(request)}
                        >
                          Mark reviewed
                        </Button>
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          )}
        </Table>
      </div>
    </div>
  );
}
