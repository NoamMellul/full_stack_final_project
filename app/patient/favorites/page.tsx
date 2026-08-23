"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import FavoriteToggle from "@/components/favorite-toggle";
import InitialsAvatar from "@/components/initials-avatar";
import type { DoctorSearchResult } from "@/components/search/doctor-card";
import { useLocale, useT } from "@/lib/i18n/locale-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { specialtyLabel } from "@/lib/i18n/specialty";
import { formatJerusalemDayHeading, formatJerusalemTime } from "@/lib/timezone";

// Matches GET /api/patient/favorites's response entries. `doctor` reuses
// DoctorSearchResult (components/search/doctor-card.tsx) rather than
// redefining its 13 fields — same shape doctor_search_view exposes
// everywhere else.
export type FavoriteEntry = {
  id: string;
  doctor_id: string;
  created_at: string;
  doctor: DoctorSearchResult | null;
};

function FavoritesSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} className="h-32 w-full rounded-xl" />
      ))}
    </div>
  );
}

// Resolves a spoken-language badge from the shared languages.he/languages.en
// dictionary pair, falling back to the raw code for any value that is
// neither — same fallback as components/search/doctor-card.tsx's identical
// lookup (RESEARCH Pitfall 6, closed for the third and final LANGUAGE_LABELS
// instance by this plan).
const LANGUAGE_KEY_BY_CODE: Record<string, TranslationKey> = {
  he: "languages.he",
  en: "languages.en",
};

function FavoriteRow({
  entry,
  onRemoved,
}: {
  entry: FavoriteEntry & { doctor: DoctorSearchResult };
  onRemoved: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [photoFailed, setPhotoFailed] = useState(false);
  const doctor = entry.doctor;
  const showPhoto = Boolean(doctor.photo_url) && !photoFailed;

  return (
    <Card className="relative">
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
          <span className="truncate font-medium text-primary">
            {specialtyLabel(locale, doctor.specialty_name_en, doctor.specialty_name_he)}
          </span>
          <span className="truncate">
            {doctor.neighborhood}, {doctor.city}
          </span>
        </div>

        <div className="flex flex-wrap gap-1">
          {doctor.language_codes.map((code) => {
            const key = LANGUAGE_KEY_BY_CODE[code];
            return (
              <Badge key={code} variant="secondary" className="bg-primary/10 text-primary">
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

        <FavoriteToggle
          doctorId={entry.doctor_id}
          initialFavorited
          viewerRole="patient"
          onRemoved={onRemoved}
          className="absolute top-2 end-2"
        />
      </CardContent>
    </Card>
  );
}

export default function PatientFavoritesPage() {
  const t = useT();
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);

  const loadFavorites = useCallback(async () => {
    try {
      const response = await fetch("/api/patient/favorites");
      const data = await response.json();
      if (!response.ok) {
        setStatus("error");
        return;
      }
      setFavorites(data.favorites as FavoriteEntry[]);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    async function runLoad() {
      setStatus("loading");
      await loadFavorites();
    }
    void runLoad();
  }, [loadFavorites]);

  function handleRetry() {
    setStatus("loading");
    void loadFavorites();
  }

  function handleRemoved(favoriteId: string) {
    setFavorites((current) => current.filter((entry) => entry.id !== favoriteId));
  }

  // A deactivated doctor's row is filtered out here (its `favorites` row is
  // left untouched server-side) — the empty-state branch keys off this
  // filtered length, so a patient whose only favorite points at a
  // deactivated doctor sees the empty state.
  const renderableFavorites = favorites.filter(
    (entry): entry is FavoriteEntry & { doctor: DoctorSearchResult } => entry.doctor !== null,
  );

  return (
    <main className="flex flex-1 flex-col ps-6 pe-6 py-8">
      <h1 className="text-2xl font-semibold">{t("patient_favorites.title")}</h1>

      <div className="mt-8">
        {status === "loading" ? (
          <FavoritesSkeleton />
        ) : status === "error" ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-destructive">{t("patient_favorites.load_error")}</p>
            <Button variant="outline" onClick={handleRetry}>
              {t("common.retry")}
            </Button>
          </div>
        ) : renderableFavorites.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <h2 className="text-lg font-semibold">{t("patient_favorites.empty_heading")}</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              {t("patient_favorites.empty_body")}
            </p>
            <Button className="min-h-11" render={<Link href="/search" />}>
              <Search aria-hidden="true" />
              {t("patient_favorites.find_doctor_cta")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {renderableFavorites.map((entry) => (
              <FavoriteRow
                key={entry.id}
                entry={entry}
                onRemoved={() => handleRemoved(entry.id)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
