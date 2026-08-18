"use client";

import { useCallback, useEffect, useState } from "react";
import { PencilIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import InitialsAvatar from "@/components/initials-avatar";
import PaginationNav from "@/components/pagination-nav";
import TempPasswordDialog from "@/components/admin/temp-password-dialog";
import { createClient } from "@/lib/supabase/client";
import { validateEmail } from "@/lib/validation/auth";
import { validateDoctorInput, validateDoctorPatch } from "@/lib/validation/doctor";
import { ADMIN_PAGE_SIZE } from "@/lib/validation/pagination";

const TABLE_COLUMN_COUNT = 7;

type DoctorListRow = {
  id: string;
  full_name: string;
  bio: string | null;
  photo_url: string | null;
  is_active: boolean;
  is_demo: boolean;
  profile_id: string | null;
  created_at: string;
  specialty: { id: string; name_en: string; name_he: string } | null;
  location: { id: string; city: string; neighborhood: string } | null;
  languages: { id: string; code: string }[];
};

type OptionRow = { id: string; label: string };
type LanguageOption = { id: string; code: string };

type FieldName = "fullName" | "specialtyId" | "locationId" | "photoUrl" | "bio" | "languageIds";
type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_BY_MESSAGE: Record<string, FieldName> = {
  "Full name is required.": "fullName",
  "Specialty is required.": "specialtyId",
  "Location is required.": "locationId",
  "Photo URL must be a valid http(s) URL.": "photoUrl",
  "Bio must be text.": "bio",
  "Languages must be a list of language ids.": "languageIds",
};

// Shared field markup for the create form and the edit dialog — one
// component driven by props rather than two copies of the same JSX.
function DoctorFormFields({
  idPrefix,
  fullName,
  onFullNameChange,
  specialtyId,
  onSpecialtyIdChange,
  locationId,
  onLocationIdChange,
  languageIds,
  onToggleLanguage,
  bio,
  onBioChange,
  photoUrl,
  onPhotoUrlChange,
  fieldErrors,
  specialties,
  locations,
  languages,
}: {
  idPrefix: string;
  fullName: string;
  onFullNameChange: (value: string) => void;
  specialtyId: string;
  onSpecialtyIdChange: (value: string) => void;
  locationId: string;
  onLocationIdChange: (value: string) => void;
  languageIds: string[];
  onToggleLanguage: (id: string) => void;
  bio: string;
  onBioChange: (value: string) => void;
  photoUrl: string;
  onPhotoUrlChange: (value: string) => void;
  fieldErrors: FieldErrors;
  specialties: OptionRow[];
  locations: OptionRow[];
  languages: LanguageOption[];
}) {
  // `items` maps handed to each Select so Select.Value can resolve the
  // trigger's display label from a value that was set programmatically
  // (the Approve prefill) without the popup ever having opened. Without
  // this, a prefilled specialty renders as a raw uuid in the trigger until
  // the popup is opened — mirrors components/search/search-filters.tsx's
  // specialtyItems/neighborhoodItems pattern. Also fixes the same latent
  // issue in the edit dialog.
  const specialtyItems: Record<string, string> = Object.fromEntries(
    specialties.map((option) => [option.id, option.label]),
  );
  const locationItems: Record<string, string> = Object.fromEntries(
    locations.map((option) => [option.id, option.label]),
  );

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-fullName`}>Full name</Label>
        <Input
          id={`${idPrefix}-fullName`}
          name="fullName"
          type="text"
          value={fullName}
          onChange={(e) => onFullNameChange(e.target.value)}
          aria-invalid={fieldErrors.fullName ? true : undefined}
        />
        {fieldErrors.fullName ? (
          <p className="text-sm font-normal text-destructive">{fieldErrors.fullName}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-specialtyId`}>Specialty</Label>
        <Select
          items={specialtyItems}
          value={specialtyId}
          onValueChange={(value) => onSpecialtyIdChange(value ?? "")}
        >
          <SelectTrigger
            id={`${idPrefix}-specialtyId`}
            aria-invalid={fieldErrors.specialtyId ? true : undefined}
          >
            <SelectValue placeholder="Select a specialty" />
          </SelectTrigger>
          <SelectContent>
            {specialties.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fieldErrors.specialtyId ? (
          <p className="text-sm font-normal text-destructive">{fieldErrors.specialtyId}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-locationId`}>Location</Label>
        <Select
          items={locationItems}
          value={locationId}
          onValueChange={(value) => onLocationIdChange(value ?? "")}
        >
          <SelectTrigger
            id={`${idPrefix}-locationId`}
            aria-invalid={fieldErrors.locationId ? true : undefined}
          >
            <SelectValue placeholder="Select a location" />
          </SelectTrigger>
          <SelectContent>
            {locations.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fieldErrors.locationId ? (
          <p className="text-sm font-normal text-destructive">{fieldErrors.locationId}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label>Languages</Label>
        <div className="flex flex-wrap gap-4">
          {languages.map((language) => (
            <label key={language.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={languageIds.includes(language.id)}
                onChange={() => onToggleLanguage(language.id)}
              />
              {language.code === "he" ? "Hebrew" : language.code === "en" ? "English" : language.code}
            </label>
          ))}
        </div>
        {fieldErrors.languageIds ? (
          <p className="text-sm font-normal text-destructive">{fieldErrors.languageIds}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-bio`}>Bio</Label>
        <Textarea
          id={`${idPrefix}-bio`}
          name="bio"
          value={bio}
          onChange={(e) => onBioChange(e.target.value)}
        />
        {fieldErrors.bio ? (
          <p className="text-sm font-normal text-destructive">{fieldErrors.bio}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-photoUrl`}>Photo URL</Label>
        <Input
          id={`${idPrefix}-photoUrl`}
          name="photoUrl"
          type="text"
          value={photoUrl}
          onChange={(e) => onPhotoUrlChange(e.target.value)}
          aria-invalid={fieldErrors.photoUrl ? true : undefined}
        />
        {fieldErrors.photoUrl ? (
          <p className="text-sm font-normal text-destructive">{fieldErrors.photoUrl}</p>
        ) : null}
      </div>
    </>
  );
}

type Prefill = { fullName: string; specialtyId: string; email: string; requestId: string };

export default function DoctorsPageClient({ prefill }: { prefill?: Prefill }) {
  const [doctors, setDoctors] = useState<DoctorListRow[]>([]);
  const [specialties, setSpecialties] = useState<OptionRow[]>([]);
  const [locations, setLocations] = useState<OptionRow[]>([]);
  const [languages, setLanguages] = useState<LanguageOption[]>([]);

  // Seeded once from `prefill` at mount via the useState initializer — never
  // re-synced by an effect, so nothing can clobber a later in-page edit.
  // locationId is deliberately left empty: doctors.location_id is NOT NULL
  // and a doctor_requests row carries no location, so the admin must pick
  // one.
  const [fullName, setFullName] = useState(() => prefill?.fullName ?? "");
  const [specialtyId, setSpecialtyId] = useState(() => prefill?.specialtyId ?? "");
  const [locationId, setLocationId] = useState("");
  const [languageIds, setLanguageIds] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  // Non-null only when the create form was entered via Approve — makes
  // every downstream behaviour (auto-open Link account, auto-PATCH the
  // request) conditional on having entered through that path.
  const [approveContext, setApproveContext] = useState<{ requestId: string; email: string } | null>(
    () => (prefill?.requestId ? { requestId: prefill.requestId, email: prefill.email } : null),
  );

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit dialog state — pre-populated from the row being edited.
  const [editingDoctor, setEditingDoctor] = useState<DoctorListRow | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editSpecialtyId, setEditSpecialtyId] = useState("");
  const [editLocationId, setEditLocationId] = useState("");
  const [editLanguageIds, setEditLanguageIds] = useState<string[]>([]);
  const [editBio, setEditBio] = useState("");
  const [editPhotoUrl, setEditPhotoUrl] = useState("");
  const [editFieldErrors, setEditFieldErrors] = useState<FieldErrors>({});
  const [editApiError, setEditApiError] = useState<string | null>(null);
  const [editIsSubmitting, setEditIsSubmitting] = useState(false);

  // Activate/deactivate switch — disables itself only for the row in flight.
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Link-account dialog state — the small email-entry form (ADMIN-04).
  const [linkingDoctor, setLinkingDoctor] = useState<DoctorListRow | null>(null);
  const [linkEmail, setLinkEmail] = useState("");
  const [linkFieldError, setLinkFieldError] = useState<string | null>(null);
  const [linkApiError, setLinkApiError] = useState<string | null>(null);
  const [linkIsSubmitting, setLinkIsSubmitting] = useState(false);

  // The one-time temporary password dialog (D-03). Cleared on close so the
  // password never lingers in memory after the admin has dismissed it.
  const [tempPasswordInfo, setTempPasswordInfo] = useState<{
    password: string;
    doctorName: string;
  } | null>(null);

  // "loading" only covers the very first GET — later refreshes (post-submit,
  // Retry) update `doctors` in place without re-showing the skeleton rows.
  const [listStatus, setListStatus] = useState<"loading" | "error" | "ready">("loading");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isPageFetching, setIsPageFetching] = useState(false);

  const loadDoctors = useCallback(async (targetPage: number) => {
    setIsPageFetching(true);
    try {
      const response = await fetch(`/api/admin/doctors?page=${targetPage}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not load doctors. Please refresh the page.");
      }
      const rows = data.doctors as DoctorListRow[];
      setDoctors(rows);
      setPage(targetPage);
      // Two admin-doctor-crud.spec.ts tests stub this endpoint with a body
      // that has `doctors` but no `total` — this fallback keeps the count
      // caption accurate for those fixtures.
      setTotal(typeof data.total === "number" ? data.total : rows.length);
      setListStatus("ready");
    } catch {
      setListStatus("error");
    } finally {
      setIsPageFetching(false);
    }
  }, []);

  useEffect(() => {
    async function initialLoad() {
      await loadDoctors(1);
    }
    void initialLoad();
  }, [loadDoctors]);

  function handleRetry() {
    setListStatus("loading");
    void loadDoctors(page);
  }

  useEffect(() => {
    async function loadOptions() {
      const supabase = createClient();
      const [specialtiesRes, locationsRes, languagesRes] = await Promise.all([
        supabase.from("specialties").select("id,name_en,name_he"),
        supabase.from("locations").select("id,city,neighborhood"),
        supabase.from("languages").select("id,code"),
      ]);

      setSpecialties(
        (specialtiesRes.data ?? []).map((row) => ({ id: row.id, label: row.name_en })),
      );
      setLocations(
        (locationsRes.data ?? []).map((row) => ({
          id: row.id,
          label: `${row.neighborhood}, ${row.city}`,
        })),
      );
      setLanguages((languagesRes.data ?? []) as LanguageOption[]);
    }
    void loadOptions();
  }, []);

  function toggleLanguage(id: string) {
    setLanguageIds((current) =>
      current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id],
    );
  }

  function resetForm() {
    setFullName("");
    setSpecialtyId("");
    setLocationId("");
    setLanguageIds([]);
    setBio("");
    setPhotoUrl("");
    setFieldErrors({});
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApiError(null);

    const payload = {
      fullName,
      specialtyId,
      locationId,
      bio,
      photoUrl,
      languageIds,
    };

    const validationError = validateDoctorInput(payload);
    if (validationError) {
      const field = FIELD_BY_MESSAGE[validationError];
      setFieldErrors(field ? { [field]: validationError } : {});
      return;
    }
    setFieldErrors({});

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/doctors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setApiError(data.error ?? "Could not save doctor. Please try again.");
        return;
      }

      // Full DoctorListRow, same shape as the list endpoint — the exact row
      // to hand the Link account dialog rather than searching for it in the
      // freshly reloaded (and paginated) table.
      const createdDoctor = data.doctor as DoctorListRow;
      resetForm();

      // Open the dialog before awaiting the list refresh so the admin isn't
      // left staring at a fetch.
      if (approveContext) {
        openLinkDialog(createdDoctor, approveContext.email);
      }

      // A new doctor sorts to the top under created_at descending — return
      // to page 1 so it's visible even if the admin submitted from a later
      // page.
      await loadDoctors(1);
    } catch {
      setApiError("Could not save doctor. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function openEditDialog(doctor: DoctorListRow) {
    setEditingDoctor(doctor);
    setEditFullName(doctor.full_name);
    setEditSpecialtyId(doctor.specialty?.id ?? "");
    setEditLocationId(doctor.location?.id ?? "");
    setEditLanguageIds(doctor.languages.map((language) => language.id));
    setEditBio(doctor.bio ?? "");
    setEditPhotoUrl(doctor.photo_url ?? "");
    setEditFieldErrors({});
    setEditApiError(null);
  }

  function closeEditDialog() {
    setEditingDoctor(null);
  }

  function toggleEditLanguage(id: string) {
    setEditLanguageIds((current) =>
      current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id],
    );
  }

  // Only the keys that actually changed from the doctor's current values are
  // sent — matches validateDoctorPatch's partial-update contract server-side.
  function buildEditPayload(original: DoctorListRow): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    if (editFullName !== original.full_name) payload.fullName = editFullName;
    if (editSpecialtyId !== (original.specialty?.id ?? "")) payload.specialtyId = editSpecialtyId;
    if (editLocationId !== (original.location?.id ?? "")) payload.locationId = editLocationId;
    if (editBio !== (original.bio ?? "")) payload.bio = editBio;
    if (editPhotoUrl !== (original.photo_url ?? "")) payload.photoUrl = editPhotoUrl;

    const originalLanguageIds = [...original.languages.map((language) => language.id)].sort();
    const currentLanguageIds = [...editLanguageIds].sort();
    if (JSON.stringify(originalLanguageIds) !== JSON.stringify(currentLanguageIds)) {
      payload.languageIds = editLanguageIds;
    }

    return payload;
  }

  async function handleEditSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingDoctor) return;
    setEditApiError(null);

    const payload = buildEditPayload(editingDoctor);
    if (Object.keys(payload).length === 0) {
      closeEditDialog();
      return;
    }

    const validationError = validateDoctorPatch(payload);
    if (validationError) {
      const field = FIELD_BY_MESSAGE[validationError];
      setEditFieldErrors(field ? { [field]: validationError } : {});
      return;
    }
    setEditFieldErrors({});

    setEditIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/doctors/${editingDoctor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setEditApiError(data.error ?? "Could not save doctor. Please try again.");
        return;
      }

      closeEditDialog();
      // Stay on the page the admin was on.
      await loadDoctors(page);
    } catch {
      setEditApiError("Could not save doctor. Please try again.");
    } finally {
      setEditIsSubmitting(false);
    }
  }

  async function handleStatusToggle(doctor: DoctorListRow, nextActive: boolean) {
    setStatusUpdatingId(doctor.id);
    try {
      const response = await fetch(`/api/admin/doctors/${doctor.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });
      const data = await response.json();

      if (!response.ok) {
        setStatusMessage(data.error ?? "Could not save doctor. Please try again.");
        return;
      }

      const updated = data.doctor as DoctorListRow;
      setDoctors((current) => current.map((row) => (row.id === doctor.id ? updated : row)));
      setStatusMessage(
        nextActive
          ? `${doctor.full_name} activated — visible in public search.`
          : `${doctor.full_name} deactivated — hidden from public search.`,
      );
    } catch {
      setStatusMessage("Could not save doctor. Please try again.");
    } finally {
      setStatusUpdatingId(null);
    }
  }

  function openLinkDialog(doctor: DoctorListRow, presetEmail?: string) {
    setLinkingDoctor(doctor);
    setLinkEmail(presetEmail ?? "");
    setLinkFieldError(null);
    setLinkApiError(null);
  }

  function closeLinkDialog() {
    setLinkingDoctor(null);
  }

  async function handleLinkSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!linkingDoctor) return;
    setLinkApiError(null);

    const emailError = validateEmail(linkEmail);
    if (emailError) {
      setLinkFieldError(emailError);
      return;
    }
    setLinkFieldError(null);

    setLinkIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/doctors/${linkingDoctor.id}/link-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: linkEmail }),
      });
      const data = await response.json();

      if (!response.ok) {
        setLinkApiError(
          data.error ?? "Could not create a login for this doctor. Please try again.",
        );
        return;
      }

      const doctorName = linkingDoctor.full_name;
      closeLinkDialog();
      // The temporary password is one-time and unrecoverable — it must
      // already be on screen before the auto-PATCH below can possibly fail,
      // so a failing PATCH can never take the password off screen with it.
      setTempPasswordInfo({ password: data.tempPassword, doctorName });

      if (approveContext) {
        const { requestId } = approveContext;
        // Null out before firing so this can only ever fire once per
        // approve, even if something re-renders this handler.
        setApproveContext(null);
        try {
          const patchResponse = await fetch(`/api/admin/doctor-requests/${requestId}`, {
            method: "PATCH",
          });
          setStatusMessage(
            patchResponse.ok
              ? "Doctor request marked reviewed."
              : "Doctor created and linked, but the request was not marked reviewed. Mark it reviewed manually on the Doctor requests page.",
          );
        } catch {
          setStatusMessage(
            "Doctor created and linked, but the request was not marked reviewed. Mark it reviewed manually on the Doctor requests page.",
          );
        }
      }

      // Stay on the page the admin was on.
      await loadDoctors(page);
    } catch {
      setLinkApiError("Could not create a login for this doctor. Please try again.");
    } finally {
      setLinkIsSubmitting(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Add doctor</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <DoctorFormFields
              idPrefix="create"
              fullName={fullName}
              onFullNameChange={setFullName}
              specialtyId={specialtyId}
              onSpecialtyIdChange={setSpecialtyId}
              locationId={locationId}
              onLocationIdChange={setLocationId}
              languageIds={languageIds}
              onToggleLanguage={toggleLanguage}
              bio={bio}
              onBioChange={setBio}
              photoUrl={photoUrl}
              onPhotoUrlChange={setPhotoUrl}
              fieldErrors={fieldErrors}
              specialties={specialties}
              locations={locations}
              languages={languages}
            />

            {apiError ? (
              <Alert variant="destructive">
                <AlertDescription>{apiError}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" disabled={isSubmitting} className="w-fit">
              {isSubmitting ? "Saving…" : "Save doctor"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog
        open={editingDoctor !== null}
        onOpenChange={(open) => {
          if (!open) closeEditDialog();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit doctor</DialogTitle>
          </DialogHeader>
          {editingDoctor ? (
            <form onSubmit={handleEditSubmit} noValidate className="flex flex-col gap-4">
              <DoctorFormFields
                idPrefix="edit"
                fullName={editFullName}
                onFullNameChange={setEditFullName}
                specialtyId={editSpecialtyId}
                onSpecialtyIdChange={setEditSpecialtyId}
                locationId={editLocationId}
                onLocationIdChange={setEditLocationId}
                languageIds={editLanguageIds}
                onToggleLanguage={toggleEditLanguage}
                bio={editBio}
                onBioChange={setEditBio}
                photoUrl={editPhotoUrl}
                onPhotoUrlChange={setEditPhotoUrl}
                fieldErrors={editFieldErrors}
                specialties={specialties}
                locations={locations}
                languages={languages}
              />

              {editApiError ? (
                <Alert variant="destructive">
                  <AlertDescription>{editApiError}</AlertDescription>
                </Alert>
              ) : null}

              <DialogFooter>
                <Button type="submit" disabled={editIsSubmitting}>
                  {editIsSubmitting ? "Saving…" : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={linkingDoctor !== null}
        onOpenChange={(open) => {
          if (!open) closeLinkDialog();
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Link account</DialogTitle>
          </DialogHeader>
          {linkingDoctor ? (
            <form onSubmit={handleLinkSubmit} noValidate className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="link-email">Email</Label>
                <Input
                  id="link-email"
                  name="email"
                  type="email"
                  value={linkEmail}
                  onChange={(e) => setLinkEmail(e.target.value)}
                  aria-invalid={linkFieldError ? true : undefined}
                />
                {linkFieldError ? (
                  <p className="text-sm font-normal text-destructive">{linkFieldError}</p>
                ) : null}
              </div>

              {linkApiError ? (
                <Alert variant="destructive">
                  <AlertDescription>{linkApiError}</AlertDescription>
                </Alert>
              ) : null}

              <DialogFooter>
                <Button type="submit" disabled={linkIsSubmitting}>
                  {linkIsSubmitting ? "Generating…" : "Generate temporary password"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <TempPasswordDialog
        open={tempPasswordInfo !== null}
        password={tempPasswordInfo?.password ?? ""}
        doctorName={tempPasswordInfo?.doctorName ?? ""}
        onClose={() => setTempPasswordInfo(null)}
      />

      <div className="flex flex-col gap-2">
        {listStatus === "ready" ? (
          <p className="text-sm text-muted-foreground">
            {total === 1 ? "1 doctor" : `${total} doctors`}
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
                <TableHead>Specialty</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Bio</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Link status</TableHead>
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
                        Could not load doctors. Please refresh the page.
                      </p>
                      <Button variant="outline" onClick={handleRetry}>
                        Retry
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : doctors.length === 0 ? (
              <TableBody>
                <TableRow>
                  <TableCell colSpan={TABLE_COLUMN_COUNT}>
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                      <h2 className="text-lg font-semibold">No doctors yet</h2>
                      <p className="max-w-md text-sm text-muted-foreground">
                        Add your first doctor profile, or run the demo data seed script, to start
                        populating the platform catalog.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : (
              <TableBody>
                {doctors.map((doctor) => (
                  <TableRow key={doctor.id}>
                    <TableCell className="max-w-48">
                      <div className="flex items-center gap-2">
                        {doctor.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element -- external, admin-pasted URL (D-01); no next/image domain config for arbitrary hosts.
                          <img
                            src={doctor.photo_url}
                            alt=""
                            className="size-8 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <InitialsAvatar name={doctor.full_name} />
                        )}
                        <span className="truncate">{doctor.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-32 truncate">{doctor.specialty?.name_en ?? ""}</TableCell>
                    <TableCell className="max-w-32 truncate">
                      {doctor.location ? `${doctor.location.neighborhood}, ${doctor.location.city}` : ""}
                    </TableCell>
                    <TableCell className="max-w-48 truncate">{doctor.bio ?? ""}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={doctor.is_active}
                          disabled={statusUpdatingId === doctor.id}
                          onCheckedChange={(checked) => void handleStatusToggle(doctor, checked)}
                          aria-label={`Toggle active status for ${doctor.full_name}`}
                        />
                        <Badge variant={doctor.is_active ? "default" : "secondary"}>
                          {doctor.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {doctor.profile_id ? (
                        <Badge variant="outline">Linked</Badge>
                      ) : (
                        <Badge variant="secondary">Not linked</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="relative after:absolute after:-inset-2"
                          aria-label={`Edit ${doctor.full_name}`}
                          onClick={() => openEditDialog(doctor)}
                        >
                          <PencilIcon />
                        </Button>
                        {!doctor.profile_id ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openLinkDialog(doctor)}
                          >
                            Link account
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            )}
          </Table>
        </div>

        {listStatus === "ready" ? (
          <PaginationNav
            page={page}
            pageCount={Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE))}
            onPageChange={(targetPage) => void loadDoctors(targetPage)}
            disabled={isPageFetching}
            navLabel="Doctors pagination"
            previousLabel="Previous page"
            nextLabel="Next page"
            pageLabelPrefix="Page"
          />
        ) : null}
      </div>
    </div>
  );
}
