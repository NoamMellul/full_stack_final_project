"use client";

import { useCallback, useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import InitialsAvatar from "@/components/initials-avatar";
import { createClient } from "@/lib/supabase/client";
import { validateDoctorInput } from "@/lib/validation/doctor";

const TABLE_COLUMN_COUNT = 6;

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

export default function DoctorsPageClient() {
  const [doctors, setDoctors] = useState<DoctorListRow[]>([]);
  const [specialties, setSpecialties] = useState<OptionRow[]>([]);
  const [locations, setLocations] = useState<OptionRow[]>([]);
  const [languages, setLanguages] = useState<LanguageOption[]>([]);

  const [fullName, setFullName] = useState("");
  const [specialtyId, setSpecialtyId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [languageIds, setLanguageIds] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // "loading" only covers the very first GET — later refreshes (post-submit,
  // Retry) update `doctors` in place without re-showing the skeleton rows.
  const [listStatus, setListStatus] = useState<"loading" | "error" | "ready">("loading");

  const loadDoctors = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/doctors");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not load doctors. Please refresh the page.");
      }
      setDoctors(data.doctors as DoctorListRow[]);
      setListStatus("ready");
    } catch {
      setListStatus("error");
    }
  }, []);

  useEffect(() => {
    async function initialLoad() {
      await loadDoctors();
    }
    void initialLoad();
  }, [loadDoctors]);

  function handleRetry() {
    setListStatus("loading");
    void loadDoctors();
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

      resetForm();
      await loadDoctors();
    } catch {
      setApiError("Could not save doctor. Please try again.");
    } finally {
      setIsSubmitting(false);
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                name="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                aria-invalid={fieldErrors.fullName ? true : undefined}
              />
              {fieldErrors.fullName ? (
                <p className="text-sm font-normal text-destructive">{fieldErrors.fullName}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="specialtyId">Specialty</Label>
              <Select value={specialtyId} onValueChange={(value) => setSpecialtyId(value ?? "")}>
                <SelectTrigger id="specialtyId" aria-invalid={fieldErrors.specialtyId ? true : undefined}>
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
              <Label htmlFor="locationId">Location</Label>
              <Select value={locationId} onValueChange={(value) => setLocationId(value ?? "")}>
                <SelectTrigger id="locationId" aria-invalid={fieldErrors.locationId ? true : undefined}>
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
                      onChange={() => toggleLanguage(language.id)}
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
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" name="bio" value={bio} onChange={(e) => setBio(e.target.value)} />
              {fieldErrors.bio ? (
                <p className="text-sm font-normal text-destructive">{fieldErrors.bio}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="photoUrl">Photo URL</Label>
              <Input
                id="photoUrl"
                name="photoUrl"
                type="text"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                aria-invalid={fieldErrors.photoUrl ? true : undefined}
              />
              {fieldErrors.photoUrl ? (
                <p className="text-sm font-normal text-destructive">{fieldErrors.photoUrl}</p>
              ) : null}
            </div>

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

      <div className="flex flex-col gap-2">
        {listStatus === "ready" ? (
          <p className="text-sm text-muted-foreground">
            {doctors.length === 1 ? "1 doctor" : `${doctors.length} doctors`}
          </p>
        ) : null}

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
                      <Badge variant={doctor.is_active ? "default" : "secondary"}>
                        {doctor.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {doctor.profile_id ? (
                        <Badge variant="outline">Linked</Badge>
                      ) : (
                        <Badge variant="secondary">Not linked</Badge>
                      )}
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
