"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import InitialsAvatar from "@/components/initials-avatar";
import { formatJerusalemDayHeading, formatJerusalemTime } from "@/lib/timezone";

// Shared by search-results.tsx and app/search/page.tsx — exported from here
// so both consume the same shape without redefining it.
export type DoctorSearchResult = {
  id: string;
  full_name: string;
  bio: string | null;
  photo_url: string | null;
  is_demo: boolean;
  specialty_id: string;
  specialty_name_en: string;
  specialty_name_he: string;
  location_id: string;
  city: string;
  neighborhood: string;
  language_codes: string[];
  next_available_at: string | null;
};

const LANGUAGE_LABELS: Record<string, string> = { he: "Hebrew", en: "English" };

export default function DoctorCard({ doctor }: { doctor: DoctorSearchResult }) {
  // Flips true if the external photo_url 404s/fails to load — falls back to
  // InitialsAvatar rather than a broken-image glyph (UI-SPEC partial state).
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = Boolean(doctor.photo_url) && !photoFailed;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {showPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- external, admin-pasted URL (D-01); no next/image domain config for arbitrary hosts.
            <img
              src={doctor.photo_url ?? undefined}
              alt=""
              className="size-12 shrink-0 rounded-full object-cover"
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            <InitialsAvatar name={doctor.full_name} />
          )}
          <span className="max-w-48 truncate font-medium">{doctor.full_name}</span>
        </div>

        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          <span className="truncate">{doctor.specialty_name_en}</span>
          <span className="truncate">
            {doctor.neighborhood}, {doctor.city}
          </span>
        </div>

        <div className="flex flex-wrap gap-1">
          {doctor.language_codes.map((code) => (
            <Badge key={code} variant="secondary">
              {LANGUAGE_LABELS[code] ?? code}
            </Badge>
          ))}
          {doctor.is_demo ? <Badge variant="secondary">Demo profile</Badge> : null}
        </div>

        {doctor.next_available_at ? (
          <p className="text-sm">
            Next available: {formatJerusalemDayHeading(doctor.next_available_at)}{" "}
            {formatJerusalemTime(doctor.next_available_at)}
          </p>
        ) : (
          <Badge variant="secondary">No upcoming availability</Badge>
        )}

        <Button
          className="w-fit min-h-11 px-4"
          render={<Link href={`/doctors/${doctor.id}`} />}
        >
          View profile
        </Button>
      </CardContent>
    </Card>
  );
}
