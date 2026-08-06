"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import InitialsAvatar from "@/components/initials-avatar";
import { formatJerusalemDayHeading, formatJerusalemTime, jerusalemDayKey } from "@/lib/timezone";

const LANGUAGE_LABELS: Record<string, string> = { he: "Hebrew", en: "English" };

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
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [status, setStatus] = useState<"loading" | "notFound" | "error" | "ready">("loading");
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [upcomingSlots, setUpcomingSlots] = useState<UpcomingSlot[]>([]);
  const [photoFailed, setPhotoFailed] = useState(false);

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
        <h1 className="text-2xl font-semibold text-destructive">Doctor not found</h1>
        <p className="max-w-md text-sm text-destructive">
          This doctor profile doesn&apos;t exist or is no longer active.
        </p>
        <Button render={<Link href="/search" />}>Back to search</Button>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flex flex-1 flex-col items-center gap-3 ps-4 pe-4 py-16 text-center">
        <p className="text-sm text-destructive">Could not load this doctor. Please try again.</p>
        <Button variant="outline" onClick={() => void loadDoctor()}>
          Retry
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
        {doctor.is_demo ? <Badge variant="secondary">Demo profile</Badge> : null}
      </div>

      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
        {doctor.specialty ? <span>{doctor.specialty.name_en}</span> : null}
        {addressParts.length > 0 ? <span>{addressParts.join(", ")}</span> : null}
      </div>

      <div className="flex flex-wrap gap-1">
        {doctor.languages.map((language) => (
          <Badge key={language.id} variant="secondary">
            {LANGUAGE_LABELS[language.code] ?? language.code}
          </Badge>
        ))}
      </div>

      <Card>
        <CardContent>
          {bio ? (
            <p className="whitespace-pre-line">{bio}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No description provided.</p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Upcoming availability</h2>

        {slotGroups.length === 0 ? (
          <Badge variant="secondary">No upcoming availability</Badge>
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
                      <Button className="min-h-11 px-4" disabled>
                        Select this slot
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-sm text-muted-foreground">
              Online booking isn&apos;t available yet in this demo — it arrives in a later phase of
              the project.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

export default function DoctorProfilePage() {
  return <DoctorProfilePageInner />;
}
