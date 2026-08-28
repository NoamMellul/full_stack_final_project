"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/locale-provider";
import { translateValidationMessage } from "@/lib/i18n/validation-messages";
import { createClient } from "@/lib/supabase/client";
import { validatePassword } from "@/lib/validation/auth";

type Status = "verifying" | "ready" | "invalid";

type FieldErrors = {
  password: string | null;
  confirmPassword: string | null;
};

export default function ResetPasswordPage() {
  const t = useT();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("verifying");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({
    password: null,
    confirmPassword: null,
  });
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // React Strict Mode double-invokes effects; without this guard two browser
  // clients could race to consume the same one-time PKCE code. Guard set on
  // first run, mirroring components/favorite-toggle.tsx's hasInteractedRef
  // idiom.
  const hasCheckedRef = useRef(false);
  useEffect(() => {
    if (hasCheckedRef.current) {
      return;
    }
    hasCheckedRef.current = true;

    async function checkSession() {
      const supabase = createClient();
      // app/auth/confirm/route.ts has already exchanged the recovery
      // token_hash for a session and set the cookie server-side by the time
      // this page loads (see that route's header comment for why: a
      // PKCE-only browser client cannot consume the implicit-hash links
      // Supabase's hosted verify endpoint or admin.generateLink() produce).
      // getSession() here simply reads that cookie-backed session back —
      // it awaits the client's internal initializePromise, which is also
      // still the correct/only mechanism for the case of a real user
      // revisiting this URL with an already-established session. No
      // onAuthStateChange listener: a listener attached after construction
      // can miss an event that already fired.
      const { data } = await supabase.auth.getSession();
      setStatus(data.session ? "ready" : "invalid");
    }

    void checkSession();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setApiError(null);

    const passwordError = validatePassword(password);
    const errors: FieldErrors = {
      password: passwordError ? translateValidationMessage(passwordError, t) : null,
      confirmPassword:
        password !== confirmPassword ? t("auth.reset_password.mismatch_error") : null,
    };
    setFieldErrors(errors);

    if (errors.password || errors.confirmPassword) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword }),
      });
      const data = await response.json();

      if (!response.ok) {
        setApiError(data.error ?? t("auth.reset_password.generic_error"));
        return;
      }

      // The root router (app/page.tsx) resolves the role server-side and
      // forwards to /patient, /doctor or /admin — this page never needs to
      // know the role itself.
      router.push("/");
      router.refresh();
    } catch {
      setApiError(t("auth.reset_password.generic_error"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center ps-4 pe-4">
      <Card className="w-full max-w-sm">
        {status === "verifying" ? (
          <CardHeader>
            <CardTitle className="text-2xl">{t("auth.reset_password.verifying")}</CardTitle>
          </CardHeader>
        ) : null}

        {status === "invalid" ? (
          <>
            <CardHeader>
              <CardTitle className="text-2xl">
                {t("auth.reset_password.invalid_link_title")}
              </CardTitle>
              <CardDescription>{t("auth.reset_password.invalid_link_message")}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-sm">
                <Link
                  href="/forgot-password"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {t("auth.reset_password.request_new_link")}
                </Link>
              </p>
            </CardContent>
          </>
        ) : null}

        {status === "ready" ? (
          <>
            <CardHeader>
              <CardTitle className="text-2xl">{t("auth.reset_password.title")}</CardTitle>
              <CardDescription>{t("auth.reset_password.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">
                    {t("auth.reset_password.new_password_label")}
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={fieldErrors.password ? true : undefined}
                  />
                  {fieldErrors.password ? (
                    <p className="text-sm font-normal text-destructive">
                      {fieldErrors.password}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="confirmPassword">
                    {t("auth.reset_password.confirm_password_label")}
                  </Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    aria-invalid={fieldErrors.confirmPassword ? true : undefined}
                  />
                  {fieldErrors.confirmPassword ? (
                    <p className="text-sm font-normal text-destructive">
                      {fieldErrors.confirmPassword}
                    </p>
                  ) : null}
                </div>
                {apiError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{apiError}</AlertDescription>
                  </Alert>
                ) : null}
                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting
                    ? t("auth.reset_password.submitting")
                    : t("auth.reset_password.submit")}
                </Button>
              </form>
            </CardContent>
          </>
        ) : null}
      </Card>
    </main>
  );
}
