"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/locale-provider";
import { translateValidationMessage } from "@/lib/i18n/validation-messages";
import { validateEmail, validateFullName, validatePassword } from "@/lib/validation/auth";

type FieldErrors = {
  fullName: string | null;
  email: string | null;
  password: string | null;
};

export default function SignupPage() {
  const t = useT();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({
    fullName: null,
    email: null,
    password: null,
  });
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setApiError(null);

    // Errors are stored untranslated and translated only at the point they
    // render, via translateValidationMessage below.
    const errors: FieldErrors = {
      fullName: validateFullName(fullName),
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setFieldErrors(errors);

    if (errors.fullName || errors.email || errors.password) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName }),
      });
      const data = await response.json();

      if (!response.ok) {
        // data.error is the signup route's own literal (unchanged by this
        // plan); the client renders it as-is. Only the fallback default —
        // used when the response body carries no error — is routed
        // through t().
        setApiError(data.error ?? t("auth.signup.generic_error"));
        return;
      }

      router.push("/patient");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center ps-4 pe-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">{t("auth.signup.title")}</CardTitle>
          <CardDescription>{t("auth.signup.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="fullName">{t("auth.signup.full_name_label")}</Label>
              <Input
                id="fullName"
                name="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                aria-invalid={fieldErrors.fullName ? true : undefined}
                className="max-w-full overflow-x-auto"
              />
              {fieldErrors.fullName ? (
                <p className="text-sm font-normal text-destructive">
                  {translateValidationMessage(fieldErrors.fullName, t)}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">{t("auth.signup.email_label")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={fieldErrors.email ? true : undefined}
              />
              {fieldErrors.email ? (
                <p className="text-sm font-normal text-destructive">
                  {translateValidationMessage(fieldErrors.email, t)}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">{t("auth.signup.password_label")}</Label>
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
                  {translateValidationMessage(fieldErrors.password, t)}
                </p>
              ) : null}
            </div>
            {apiError ? (
              <Alert variant="destructive">
                <AlertDescription>{apiError}</AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? t("auth.signup.submitting") : t("auth.signup.submit")}
            </Button>
            <p className="text-center text-sm">
              {t("auth.signup.have_account_prompt")}{" "}
              <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                {t("auth.signup.login_link")}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
