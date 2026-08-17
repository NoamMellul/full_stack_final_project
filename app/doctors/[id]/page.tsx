"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import FavoriteToggle from "@/components/favorite-toggle";
import InitialsAvatar from "@/components/initials-avatar";
import { useLocale, useT } from "@/lib/i18n/locale-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { specialtyLabel } from "@/lib/i18n/specialty";
import { createClient } from "@/lib/supabase/client";
import { formatJerusalemDayHeading, formatJerusalemTime, jerusalemDayKey } from "@/lib/timezone";

// Resolves a spoken-language badge from the shared languages.he/languages.en
// dictionary pair, falling back to the raw code for any value that is
// neither — completes the RESEARCH Pitfall 6 consolidation started in
// components/search/doctor-card.tsx (half 2 of 2).
const LANGUAGE_KEY_BY_CODE: Record<string, TranslationKey> = {
  he: "languages.he",
  en: "languages.en",
};

type DoctorProfile = {
  id: string;
  full_name: string;
  bio: string | null;
  photo_url: string | null;
  is_demo: boolean;
  specialty: { id: string; name_en: string; name_he: string } | null;
  location: { id: string; city: string; neighborhood: string; address: string | null } | null;
  languages: { id: string; code: string }[];
};

type UpcomingSlot = {
  id: string;
  start_at: string;
  end_at: string;
};

type SlotDayGroup = {
  dayKey: string;
  slots: UpcomingSlot[];
};

type FavoritesState = {
  role: "patient" | "anonymous" | "hidden";
  favoritedIds: Set<string>;
};

function groupSlotsByJerusalemDay(slots: UpcomingSlot[]): SlotDayGroup[] {
  const groups: SlotDayGroup[] = [];
  for (const slot of slots) {
    const dayKey = jerusalemDayKey(slot.start_at);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.dayKey === dayKey) {
      lastGroup.slots.push(slot);
    } else {
      groups.push({ dayKey, slots: [slot] });
    }
  }
  return groups;
}

function DoctorProfileSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-16 shrink-0 rounded-full" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
      </div>
    </div>
  );
}

function DoctorProfilePageInner() {
  const t = useT();
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [status, setStatus] = useState<"loading" | "notFound" | "error" | "ready">("loading");
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [upcomingSlots, setUpcomingSlots] = useState<UpcomingSlot[]>([]);
  const [photoFailed, setPhotoFailed] = useState(false);

  const [selectedSlot, setSelectedSlot] = useState<UpcomingSlot | null>(null);
  const [bookingApiError, setBookingApiError] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);

  // Resolved once on mount — no separate loading state, the toggle simply
  // renders unfavorited until this resolves. 200 means the viewer is a
  // patient (populate the set), 401 means anonymous, 403 means a doctor or
  // admin viewer (hidden entirely, per D-01's role-gating rule).
  const [favoritesState, setFavoritesState] = useState<FavoritesState>({
    role: "anonymous",
    favoritedIds: new Set(),
  });

  const loadDoctor = useCallback(async () => {
    setStatus("loading");
    try {
      const response = await fetch(`/api/doctors/${id}`);
      if (response.status === 404) {
        setStatus("notFound");
        return;
      }
      const data = await response.json();
      if (!response.ok) {
        setStatus("error");
        return;
      }
      setDoctor(data.doctor as DoctorProfile);
      setUpcomingSlots(data.upcomingSlots as UpcomingSlot[]);
      setPhotoFailed(false);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    async function runLoad() {
      await loadDoctor();
    }
    void runLoad();
  }, [loadDoctor]);

  useEffect(() => {
    async function loadFavoritesState() {
      try {
        const response = await fetch("/api/patient/favorites");
        if (response.status === 401) {
          setFavoritesState({ role: "anonymous", favoritedIds: new Set() });
          return;
        }
        if (response.status === 403) {
          setFavoritesState({ role: "hidden", favoritedIds: new Set() });
          return;
        }
        if (!response.ok) return;
        const data = await response.json();
        const favoritedIds = new Set<string>(
          (data.favorites as { doctor_id: string }[]).map((entry) => entry.doctor_id),
        );
        setFavoritesState({ role: "patient", favoritedIds });
      } catch {
        // Leave the default (anonymous, unfavorited) state on a network error.
      }
    }
    void loadFavoritesState();
  }, []);

  // Session check happens client-side because /doctors/[id] is a public
  // page that never passes through proxy.ts's request gate (D-04). An
  // unauthenticated visitor is sent straight to /login?from= with no dialog
  // ever opening.
  async function handleSelectSlot(slot: UpcomingSlot) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push(`/login?from=${encodeURIComponent(`/doctors/${id}`)}`);
      return;
    }

    setBookingApiError(null);
    setSelectedSlot(slot);
  }

  function closeBookingDialog() {
    setSelectedSlot(null);
    setBookingApiError(null);
  }

  async function handleConfirmBooking() {
    if (!selectedSlot) return;
    setIsBooking(true);
    setBookingApiError(null);
    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId: selectedSlot.id }),
      });
      const data = await response.json();

      if (!response.ok) {
        // data.error is the appointments route's own literal (unchanged by
        // this plan); the client renders it as-is. Only the fallback
        // default — used when the response body carries no error, or the
        // request itself throws — is routed through t().
        setBookingApiError(data.error ?? t("doctor_profile.booking_generic_error"));
        return;
      }

      router.push("/patient/appointments?booked=1");
    } catch {
      setBookingApiError(t("doctor_profile.booking_generic_error"));
    } finally {
      setIsBooking(false);
    }
  }

  if (status === "loading") {
    return (
      <main className="flex flex-1 flex-col gap-6 ps-4 pe-4 py-6">
        <DoctorProfileSkeleton />
      </main>
    );
  }

  if (status === "notFound") {
    return (
      <main className="flex flex-1 flex-col items-center gap-3 ps-4 pe-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-destructive">
          {t("doctor_profile.not_found_heading")}
        </h1>
        <p className="max-w-md text-sm text-destructive">
          {t("doctor_profile.not_found_body")}
        </p>
        <Button render={<Link href="/search" />}>{t("doctor_profile.back_to_search")}</Button>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flex flex-1 flex-col items-center gap-3 ps-4 pe-4 py-16 text-center">
        <p className="text-sm text-destructive">{t("doctor_profile.load_error")}</p>
        <Button variant="outline" onClick={() => void loadDoctor()}>
          {t("common.retry")}
        </Button>
      </main>
    );
  }

  if (!doctor) return null;

  const addressParts = [
    doctor.location?.address,
    doctor.location?.neighborhood,
    doctor.location?.city,
  ].filter((part): part is string => Boolean(part));

  const showPhoto = Boolean(doctor.photo_url) && !photoFailed;
  const bio = doctor.bio?.trim();
  const slotGroups = groupSlotsByJerusalemDay(upcomingSlots);

  return (
    <main className="flex flex-1 flex-col gap-6 ps-4 pe-4 py-6">
      <div className="flex items-center gap-3">
        {showPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element -- external, admin-pasted URL (D-01); no next/image domain config for arbitrary hosts.
          <img
            src={doctor.photo_url ?? undefined}
            alt=""
            className="size-16 shrink-0 rounded-full object-cover"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <InitialsAvatar name={doctor.full_name} size="default" className="size-16 text-base" />
        )}
        <h1 className="text-2xl font-semibold">{doctor.full_name}</h1>
        {doctor.is_demo ? (
          <Badge variant="secondary">{t("doctor_card.demo_profile")}</Badge>
        ) : null}
        {favoritesState.role !== "hidden" ? (
          <FavoriteToggle
            doctorId={doctor.id}
            initialFavorited={favoritesState.favoritedIds.has(doctor.id)}
            viewerRole={favoritesState.role}
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
        {doctor.specialty ? (
          <span>{specialtyLabel(locale, doctor.specialty.name_en, doctor.specialty.name_he)}</span>
        ) : null}
        {addressParts.length > 0 ? <span>{addressParts.join(", ")}</span> : null}
      </div>

      <div className="flex flex-wrap gap-1">
        {doctor.languages.map((language) => {
          const key = LANGUAGE_KEY_BY_CODE[language.code];
          return (
            <Badge key={language.id} variant="secondary">
              {key ? t(key) : language.code}
            </Badge>
          );
        })}
      </div>

      <Card>
        <CardContent>
          {bio ? (
            <p className="whitespace-pre-line">{bio}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("doctor_profile.no_description")}</p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("doctor_profile.availability_heading")}</h2>

        {slotGroups.length === 0 ? (
          <Badge variant="secondary">{t("doctor_card.no_availability")}</Badge>
        ) : (
          <div className="flex flex-col gap-4">
            {slotGroups.map((group) => (
              <div key={group.dayKey} className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">
                  {formatJerusalemDayHeading(group.slots[0].start_at)}
                </h3>
                <div className="flex flex-col gap-2">
                  {group.slots.map((slot) => (
                    <div key={slot.id} className="flex items-center gap-3">
                      <span className="text-sm">
                        {formatJerusalemTime(slot.start_at)} - {formatJerusalemTime(slot.end_at)}
                      </span>
                      <Button
                        className="min-h-11 px-4"
                        onClick={() => void handleSelectSlot(slot)}
                      >
                        {t("doctor_profile.select_slot")}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={selectedSlot !== null}
        onOpenChange={(open) => {
          if (!open) closeBookingDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("doctor_profile.booking_dialog_title")}</DialogTitle>
          </DialogHeader>
          {selectedSlot ? (
            <div className="flex flex-col gap-2 text-sm">
              <span className="font-semibold">{doctor.full_name}</span>
              {doctor.specialty ? (
                <span>{specialtyLabel(locale, doctor.specialty.name_en, doctor.specialty.name_he)}</span>
              ) : null}
              <span>
                {formatJerusalemDayHeading(selectedSlot.start_at)},{" "}
                {formatJerusalemTime(selectedSlot.start_at)}–
                {formatJerusalemTime(selectedSlot.end_at)}
              </span>
              {addressParts.length > 0 ? (
                <span className="break-words text-muted-foreground">
                  {addressParts.join(", ")}
                </span>
              ) : null}
            </div>
          ) : null}

          {bookingApiError ? (
            <Alert variant="destructive">
              <AlertDescription>{bookingApiError}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={closeBookingDialog}
              disabled={isBooking}
            >
              {t("doctor_profile.booking_dialog_cancel")}
            </Button>
            <Button
              type="button"
              className="min-h-11"
              onClick={() => void handleConfirmBooking()}
              disabled={isBooking}
            >
              {isBooking
                ? t("doctor_profile.booking_dialog_confirming")
                : t("doctor_profile.booking_dialog_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default function DoctorProfilePage() {
  return <DoctorProfilePageInner />;
}
