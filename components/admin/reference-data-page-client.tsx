"use client";

import { useCallback, useEffect, useState } from "react";
import { PencilIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  validateLocationInput,
  validateLocationPatch,
  validateSpecialtyInput,
  validateSpecialtyPatch,
} from "@/lib/validation/reference-data";

export type ReferenceDataResource = "specialties" | "locations";

type SpecialtyApiRow = { id: string; name_he: string; name_en: string; doctorCount: number };
type LocationApiRow = {
  id: string;
  city: string;
  neighborhood: string;
  address: string | null;
  doctorCount: number;
};

// A resource-neutral shape every row is normalised into once fetched, so
// every piece of shared UI below (table, dialogs, delete guard) only ever
// deals with this shape rather than branching per resource.
type ReferenceRow = {
  id: string;
  doctorCount: number;
  displayName: string;
  values: Record<string, string>;
  cells: { key: string; value: string }[];
};

type FieldDescriptor = { key: string; label: string; optional?: boolean };

const RESOURCE_CONFIG: Record<
  ReferenceDataResource,
  {
    endpointBase: string;
    listKey: "specialties" | "locations";
    itemLabel: string;
    itemLabelCapitalized: string;
    pluralLabel: string;
    emptyHeading: string;
    emptyBody: string;
    loadErrorMessage: string;
    fields: FieldDescriptor[];
    columns: { key: string; label: string }[];
  }
> = {
  specialties: {
    endpointBase: "/api/admin/specialties",
    listKey: "specialties",
    itemLabel: "specialty",
    itemLabelCapitalized: "Specialty",
    pluralLabel: "specialties",
    emptyHeading: "No specialties yet",
    emptyBody: "Add a specialty so it can be assigned to doctor profiles.",
    loadErrorMessage: "Could not load specialties. Please refresh the page.",
    fields: [
      { key: "nameEn", label: "Name (English)" },
      { key: "nameHe", label: "Name (Hebrew)" },
    ],
    columns: [
      { key: "nameEn", label: "Name (English)" },
      { key: "nameHe", label: "Name (Hebrew)" },
    ],
  },
  locations: {
    endpointBase: "/api/admin/locations",
    listKey: "locations",
    itemLabel: "location",
    itemLabelCapitalized: "Location",
    pluralLabel: "locations",
    emptyHeading: "No locations yet",
    emptyBody: "Add a neighborhood so it can be assigned to doctor profiles.",
    loadErrorMessage: "Could not load locations. Please refresh the page.",
    fields: [
      { key: "neighborhood", label: "Neighborhood" },
      { key: "city", label: "City" },
      { key: "address", label: "Address", optional: true },
    ],
    columns: [
      { key: "neighborhood", label: "Neighborhood" },
      { key: "city", label: "City" },
      { key: "address", label: "Address" },
    ],
  },
};

function mapApiRow(resource: ReferenceDataResource, row: SpecialtyApiRow | LocationApiRow): ReferenceRow {
  if (resource === "specialties") {
    const specialty = row as SpecialtyApiRow;
    return {
      id: specialty.id,
      doctorCount: specialty.doctorCount,
      displayName: specialty.name_en,
      values: { nameEn: specialty.name_en, nameHe: specialty.name_he },
      cells: [
        { key: "nameEn", value: specialty.name_en },
        { key: "nameHe", value: specialty.name_he },
      ],
    };
  }

  const location = row as LocationApiRow;
  return {
    id: location.id,
    doctorCount: location.doctorCount,
    displayName: `${location.neighborhood}, ${location.city}`,
    values: {
      neighborhood: location.neighborhood,
      city: location.city,
      address: location.address ?? "",
    },
    cells: [
      { key: "neighborhood", value: location.neighborhood },
      { key: "city", value: location.city },
      { key: "address", value: location.address ?? "" },
    ],
  };
}

function toRequestBody(resource: ReferenceDataResource, values: Record<string, string>) {
  if (resource === "specialties") {
    return { nameEn: values.nameEn, nameHe: values.nameHe };
  }
  return { city: values.city, neighborhood: values.neighborhood, address: values.address || undefined };
}

function validateInput(resource: ReferenceDataResource, body: Record<string, unknown>): string | null {
  return resource === "specialties" ? validateSpecialtyInput(body) : validateLocationInput(body);
}

function validatePatch(resource: ReferenceDataResource, body: Record<string, unknown>): string | null {
  return resource === "specialties" ? validateSpecialtyPatch(body) : validateLocationPatch(body);
}

// Determines which specific fields are blank, since the shared validators
// intentionally collapse every required-field failure into the single
// "Name is required." message (matching lib/validation/auth.ts's style) —
// the UI still needs to know *which* input to mark invalid.
function fieldErrorsFor(
  resource: ReferenceDataResource,
  values: Record<string, string>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const requiredKeys = RESOURCE_CONFIG[resource].fields.filter((field) => !field.optional);
  for (const field of requiredKeys) {
    if (!values[field.key]?.trim()) {
      errors[field.key] = "Name is required.";
    }
  }
  return errors;
}

function pluralizeDoctor(count: number): string {
  return count === 1 ? "doctor" : "doctors";
}

function ReferenceDataFormFields({
  idPrefix,
  resource,
  values,
  onChange,
  fieldErrors,
}: {
  idPrefix: string;
  resource: ReferenceDataResource;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  fieldErrors: Record<string, string>;
}) {
  const config = RESOURCE_CONFIG[resource];
  return (
    <>
      {config.fields.map((field) => (
        <div key={field.key} className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-${field.key}`}>{field.label}</Label>
          <Input
            id={`${idPrefix}-${field.key}`}
            name={field.key}
            type="text"
            value={values[field.key] ?? ""}
            onChange={(e) => onChange(field.key, e.target.value)}
            aria-invalid={fieldErrors[field.key] ? true : undefined}
          />
          {fieldErrors[field.key] ? (
            <p className="text-sm font-normal text-destructive">{fieldErrors[field.key]}</p>
          ) : null}
        </div>
      ))}
    </>
  );
}

export default function ReferenceDataPageClient({
  resource,
}: {
  resource: ReferenceDataResource;
}) {
  const config = RESOURCE_CONFIG[resource];
  const tableColumnCount = config.columns.length + 1; // +1 for the Actions column

  const [rows, setRows] = useState<ReferenceRow[]>([]);
  const [listStatus, setListStatus] = useState<"loading" | "error" | "ready">("loading");
  const [listMessage, setListMessage] = useState<string | null>(null);

  // Create dialog state.
  const [createOpen, setCreateOpen] = useState(false);
  const [createValues, setCreateValues] = useState<Record<string, string>>({});
  const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string>>({});
  const [createApiError, setCreateApiError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Edit dialog state.
  const [editingRow, setEditingRow] = useState<ReferenceRow | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({});
  const [editApiError, setEditApiError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Delete confirm dialog state.
  const [deletingRow, setDeletingRow] = useState<ReferenceRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadRows = useCallback(async () => {
    try {
      const response = await fetch(config.endpointBase);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? config.loadErrorMessage);
      }
      const rawRows = (data[config.listKey] ?? []) as (SpecialtyApiRow | LocationApiRow)[];
      setRows(rawRows.map((row) => mapApiRow(resource, row)));
      setListStatus("ready");
    } catch {
      setListStatus("error");
    }
  }, [config.endpointBase, config.listKey, config.loadErrorMessage, resource]);

  useEffect(() => {
    async function initialLoad() {
      await loadRows();
    }
    void initialLoad();
  }, [loadRows]);

  function handleRetry() {
    setListStatus("loading");
    void loadRows();
  }

  function openCreateDialog() {
    const initial: Record<string, string> = {};
    for (const field of config.fields) initial[field.key] = "";
    setCreateValues(initial);
    setCreateFieldErrors({});
    setCreateApiError(null);
    setCreateOpen(true);
  }

  function closeCreateDialog() {
    setCreateOpen(false);
  }

  async function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateApiError(null);

    const body = toRequestBody(resource, createValues);
    const validationError = validateInput(resource, body);
    if (validationError) {
      setCreateFieldErrors(fieldErrorsFor(resource, createValues));
      return;
    }
    setCreateFieldErrors({});

    setIsCreating(true);
    try {
      const response = await fetch(config.endpointBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok) {
        setCreateApiError(data.error ?? `Could not save ${config.itemLabel}. Please try again.`);
        return;
      }

      closeCreateDialog();
      await loadRows();
    } catch {
      setCreateApiError(`Could not save ${config.itemLabel}. Please try again.`);
    } finally {
      setIsCreating(false);
    }
  }

  function openEditDialog(row: ReferenceRow) {
    setEditingRow(row);
    setEditValues({ ...row.values });
    setEditFieldErrors({});
    setEditApiError(null);
  }

  function closeEditDialog() {
    setEditingRow(null);
  }

  function buildEditPayload(original: ReferenceRow): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const field of config.fields) {
      const current = editValues[field.key] ?? "";
      const originalValue = original.values[field.key] ?? "";
      if (current !== originalValue) {
        payload[field.key] = field.optional ? current || undefined : current;
      }
    }
    return payload;
  }

  async function handleEditSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingRow) return;
    setEditApiError(null);

    const payload = buildEditPayload(editingRow);
    if (Object.keys(payload).length === 0) {
      closeEditDialog();
      return;
    }

    const validationError = validatePatch(resource, payload);
    if (validationError && validationError !== "Nothing to update.") {
      setEditFieldErrors(fieldErrorsFor(resource, editValues));
      return;
    }
    setEditFieldErrors({});

    setIsEditing(true);
    try {
      const response = await fetch(`${config.endpointBase}/${editingRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setEditApiError(data.error ?? `Could not save ${config.itemLabel}. Please try again.`);
        return;
      }

      closeEditDialog();
      await loadRows();
    } catch {
      setEditApiError(`Could not save ${config.itemLabel}. Please try again.`);
    } finally {
      setIsEditing(false);
    }
  }

  function openDeleteDialog(row: ReferenceRow) {
    setDeletingRow(row);
  }

  function closeDeleteDialog() {
    setDeletingRow(null);
  }

  async function handleConfirmDelete() {
    if (!deletingRow) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`${config.endpointBase}/${deletingRow.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        // The row may have gained a doctor between the list load and this
        // click (D-06 backstop) — surface the server's message verbatim and
        // refresh so the disabled state catches up.
        setListMessage(data.error ?? `Could not delete ${config.itemLabel}. Please try again.`);
        closeDeleteDialog();
        await loadRows();
        return;
      }

      setListMessage(`${deletingRow.displayName} deleted.`);
      closeDeleteDialog();
      await loadRows();
    } catch {
      setListMessage(`Could not delete ${config.itemLabel}. Please try again.`);
      closeDeleteDialog();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div>
        <Button type="button" onClick={openCreateDialog} className="w-fit">
          Add {config.itemLabel}
        </Button>
      </div>

      <Dialog open={createOpen} onOpenChange={(open) => (!open ? closeCreateDialog() : undefined)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add {config.itemLabel}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} noValidate className="flex flex-col gap-4">
            <ReferenceDataFormFields
              idPrefix="create"
              resource={resource}
              values={createValues}
              onChange={(key, value) => setCreateValues((current) => ({ ...current, [key]: value }))}
              fieldErrors={createFieldErrors}
            />

            {createApiError ? (
              <Alert variant="destructive">
                <AlertDescription>{createApiError}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Adding…" : `Add ${config.itemLabel}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingRow !== null}
        onOpenChange={(open) => {
          if (!open) closeEditDialog();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit {config.itemLabel}</DialogTitle>
          </DialogHeader>
          {editingRow ? (
            <form onSubmit={handleEditSubmit} noValidate className="flex flex-col gap-4">
              <ReferenceDataFormFields
                idPrefix="edit"
                resource={resource}
                values={editValues}
                onChange={(key, value) => setEditValues((current) => ({ ...current, [key]: value }))}
                fieldErrors={editFieldErrors}
              />

              {editApiError ? (
                <Alert variant="destructive">
                  <AlertDescription>{editApiError}</AlertDescription>
                </Alert>
              ) : null}

              <DialogFooter>
                <Button type="submit" disabled={isEditing}>
                  {isEditing ? "Saving…" : `Save ${config.itemLabel}`}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={deletingRow !== null}
        onOpenChange={(open) => {
          if (!open) closeDeleteDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {deletingRow?.displayName}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This cannot be undone.</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDeleteDialog} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-2">
        {listStatus === "ready" ? (
          <p className="text-sm text-muted-foreground">
            {rows.length === 1 ? `1 ${config.itemLabel}` : `${rows.length} ${config.pluralLabel}`}
          </p>
        ) : null}

        <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
          {listMessage ?? ""}
        </p>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {config.columns.map((column) => (
                  <TableHead key={column.key}>{column.label}</TableHead>
                ))}
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            {listStatus === "loading" ? (
              <TableBody>
                {[0, 1, 2].map((row) => (
                  <TableRow key={row}>
                    <TableCell colSpan={tableColumnCount}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            ) : listStatus === "error" ? (
              <TableBody>
                <TableRow>
                  <TableCell colSpan={tableColumnCount}>
                    <div className="flex flex-col items-center gap-3 py-8 text-center">
                      <p className="text-sm text-destructive">{config.loadErrorMessage}</p>
                      <Button variant="outline" onClick={handleRetry}>
                        Retry
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : rows.length === 0 ? (
              <TableBody>
                <TableRow>
                  <TableCell colSpan={tableColumnCount}>
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                      <h2 className="text-lg font-semibold">{config.emptyHeading}</h2>
                      <p className="max-w-md text-sm text-muted-foreground">{config.emptyBody}</p>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : (
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.cells.map((cell) => (
                      <TableCell key={cell.key} className="max-w-48 truncate">
                        {cell.value}
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="relative after:absolute after:-inset-2"
                            aria-label={`Edit ${row.displayName}`}
                            onClick={() => openEditDialog(row)}
                          >
                            <PencilIcon />
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={row.doctorCount > 0}
                            onClick={() => openDeleteDialog(row)}
                          >
                            Delete
                          </Button>
                        </div>
                        {row.doctorCount > 0 ? (
                          <p className="text-sm font-normal text-destructive">
                            This {config.itemLabel} is used by {row.doctorCount}{" "}
                            {pluralizeDoctor(row.doctorCount)} and cannot be deleted.
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            )}
          </Table>
        </div>
      </div>
    </div>
  );
}
