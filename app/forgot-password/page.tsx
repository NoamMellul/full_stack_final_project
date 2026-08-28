"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/locale-provider";
import { translateValidationMessage } from "@/lib/i18n/validation-messages";
import { createClient } from "@/lib/supabase/client";
import { validateEmail } from "@/lib/validation/auth";

export default function ForgotPasswordPage() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const error = validateEmail(email);
    setEmailError(error);
    if (error) {
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      // The path segment is a hardcoded literal, never read from a query
      // param or any other request-controlled input (T-EUO-03) — a crafted
      // /forgot-password?next=evil cannot divert the recovery token.
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      // Deliberately discarded without branching: an unknown address, a
      // rate-limited address and a healthy send must all produce the
      // byte-identical outcome below, or this page becomes a
      // user-enumeration oracle (T-EUO-01). Do not "fix" this by rendering
      // resetError — that is exactly the leak this guards against.
      void resetError;
      setHasSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center ps-4 pe-4">
      <Card className="w-full max-w-sm">
        {hasSubmitted ? (
          <>
            <CardHeader>
              <CardTitle className="text-2xl">{t("auth.forgot_password.sent_title")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm">{t("auth.forgot_password.sent_message")}</p>
              <p className="text-center text-sm">
                <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                  {t("auth.forgot_password.back_to_login")}
                </Link>
              </p>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle className="text-2xl">{t("auth.forgot_password.title")}</CardTitle>
              <CardDescription>{t("auth.forgot_password.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">{t("auth.forgot_password.email_label")}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={emailError ? true : undefined}
                    className="max-w-full overflow-x-auto"
                  />
                  {emailError ? (
                    <p className="text-sm font-normal text-destructive">
                      {translateValidationMessage(emailError, t)}
                    </p>
                  ) : null}
                </div>
                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting
                    ? t("auth.forgot_password.submitting")
                    : t("auth.forgot_password.submit")}
                </Button>
                <p className="text-center text-sm">
                  <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                    {t("auth.forgot_password.back_to_login")}
                  </Link>
                </p>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </main>
  );
}
