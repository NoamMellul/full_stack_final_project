"use client";

import { useCallback, useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { validateDoctorInput } from "@/lib/validation/doctor";

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

  const loadDoctors = useCallback(async () => {
    const response = await fetch("/api/admin/doctors");
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "Could not load doctors. Please refresh the page.");
    }
    setDoctors(data.doctors as DoctorListRow[]);
  }, []);

  useEffect(() => {
    async function initialLoad() {
      await loadDoctors();
    }
    void initialLoad();
  }, [loadDoctors]);

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

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Specialty</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Link status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {doctors.map((doctor) => (
              <TableRow key={doctor.id}>
                <TableCell className="max-w-48 truncate">{doctor.full_name}</TableCell>
                <TableCell className="max-w-32 truncate">{doctor.specialty?.name_en ?? ""}</TableCell>
                <TableCell className="max-w-32 truncate">
                  {doctor.location ? `${doctor.location.neighborhood}, ${doctor.location.city}` : ""}
                </TableCell>
                <TableCell>{doctor.is_active ? "Active" : "Inactive"}</TableCell>
                <TableCell>{doctor.profile_id ? "Linked" : "Not linked"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
