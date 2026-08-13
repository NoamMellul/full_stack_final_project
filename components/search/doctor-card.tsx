"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import FavoriteToggle from "@/components/favorite-toggle";
import InitialsAvatar from "@/components/initials-avatar";
import { useT } from "@/lib/i18n/locale-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
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

// Resolves a spoken-language badge from the shared languages.he/languages.en
// dictionary pair, falling back to the raw code for any value that is
// neither — the same fallback the deleted per-file language-label map
// already had (RESEARCH Pitfall 6).
const LANGUAGE_KEY_BY_CODE: Record<string, TranslationKey> = {
  he: "languages.he",
  en: "languages.en",
};

type DoctorCardProps = {
  doctor: DoctorSearchResult;
  favoriteViewerRole?: "patient" | "anonymous" | "hidden";
  isFavorited?: boolean;
};

export default function DoctorCard({
  doctor,
  favoriteViewerRole = "hidden",
  isFavorited = false,
}: DoctorCardProps) {
  const t = useT();
  // Flips true if the external photo_url 404s/fails to load — falls back to
  // InitialsAvatar rather than a broken-image glyph (UI-SPEC partial state).
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = Boolean(doctor.photo_url) && !photoFailed;

  return (
    <Card className="relative">
      {favoriteViewerRole !== "hidden" ? (
        <FavoriteToggle
          doctorId={doctor.id}
          initialFavorited={isFavorited}
          viewerRole={favoriteViewerRole}
          className="absolute top-2 end-2"
        />
      ) : null}
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
          {doctor.language_codes.map((code) => {
            const key = LANGUAGE_KEY_BY_CODE[code];
            return (
              <Badge key={code} variant="secondary">
                {key ? t(key) : code}
              </Badge>
            );
          })}
          {doctor.is_demo ? <Badge variant="secondary">{t("doctor_card.demo_profile")}</Badge> : null}
        </div>

        {doctor.next_available_at ? (
          <p className="text-sm">
            {t("doctor_card.next_available_prefix")}{" "}
            {formatJerusalemDayHeading(doctor.next_available_at)}{" "}
            {formatJerusalemTime(doctor.next_available_at)}
          </p>
        ) : (
          <Badge variant="secondary">{t("doctor_card.no_availability")}</Badge>
        )}

        <Button
          className="w-fit min-h-11 px-4"
          render={<Link href={`/doctors/${doctor.id}`} />}
        >
          {t("doctor_card.view_profile")}
        </Button>
      </CardContent>
    </Card>
  );
}
