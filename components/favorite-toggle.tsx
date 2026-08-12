"use client";

import { Heart } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type FavoriteToggleProps = {
  doctorId: string;
  initialFavorited: boolean;
  viewerRole: "patient" | "anonymous";
  onRemoved?: () => void;
  className?: string;
};

const FAILURE_MESSAGE = "Could not update your favorites. Please try again.";

// Single shared component rendered at three call sites (app/doctors/[id]/
// page.tsx, components/search/doctor-card.tsx, app/patient/favorites/
// page.tsx) — one implementation, one visual contract (D-01). The parent
// omits this component entirely for doctor/admin viewers; it only ever
// receives "patient" or "anonymous".
export default function FavoriteToggle({
  doctorId,
  initialFavorited,
  viewerRole,
  onRemoved,
  className,
}: FavoriteToggleProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [isFavorited, setIsFavorited] = useState(initialFavorited);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleClick() {
    // Auth-on-click, not auth-on-mount (mirrors the booking CTA's D-04
    // pattern): an anonymous visitor is redirected to /login before any
    // favorites request is attempted — no toggle state ever renders "as if
    // favorited" for a logged-out click.
    if (viewerRole === "anonymous") {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push(`/login?from=${encodeURIComponent(pathname)}`);
        return;
      }
    }

    const nextFavorited = !isFavorited;
    setIsFavorited(nextFavorited);
    setErrorMessage(null);
    setIsPending(true);

    try {
      const response = nextFavorited
        ? await fetch("/api/patient/favorites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ doctorId }),
          })
        : await fetch(`/api/patient/favorites/${doctorId}`, { method: "DELETE" });

      // 409 on POST ("already favorited") and 404 on DELETE ("already not
      // favorited") both mean the desired end state already holds — treated
      // as success, not reverted.
      const alreadyDesiredState =
        (nextFavorited && response.status === 409) ||
        (!nextFavorited && response.status === 404);

      if (!response.ok && !alreadyDesiredState) {
        setIsFavorited(!nextFavorited);
        setErrorMessage(FAILURE_MESSAGE);
        return;
      }

      if (!nextFavorited) {
        onRemoved?.();
      }
    } catch {
      setIsFavorited(!nextFavorited);
      setErrorMessage(FAILURE_MESSAGE);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        className={cn("size-11 sm:size-8", className)}
        disabled={isPending}
        aria-pressed={isFavorited}
        aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
        onClick={() => void handleClick()}
      >
        <Heart
          className={cn(
            isFavorited ? "fill-current text-primary" : "text-muted-foreground",
          )}
        />
      </Button>
      {errorMessage ? (
        <span role="status" aria-live="polite" className="text-sm text-destructive">
          {errorMessage}
        </span>
      ) : null}
    </span>
  );
}
