"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/locale-provider";

export default function LogoutButton() {
  const t = useT();
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleLogout() {
    setIsPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });

      if (!response.ok) {
        setErrorMessage(t("header.log_out_error"));
        setIsPending(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setErrorMessage(t("header.log_out_error"));
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
        <span className="hidden sm:inline">{t("header.log_out")}</span>
      </Button>
      {errorMessage ? (
        <span className="text-sm font-normal text-destructive">{errorMessage}</span>
      ) : null}
    </span>
  );
}
