"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export default function LogoutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleLogout() {
    setIsPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });

      if (!response.ok) {
        setErrorMessage("Could not log out. Please try again.");
        setIsPending(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setErrorMessage("Could not log out. Please try again.");
      setIsPending(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={handleLogout}
        disabled={isPending}
        className="h-11 w-11 justify-center gap-1 px-0 sm:h-8 sm:w-auto sm:justify-center sm:px-2.5"
      >
        <LogOut />
        <span className="hidden sm:inline">Log out</span>
      </Button>
      {errorMessage ? (
        <span className="text-sm font-normal text-destructive">{errorMessage}</span>
      ) : null}
    </span>
  );
}
