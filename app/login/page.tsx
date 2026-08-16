"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_HOME } from "@/lib/auth/role-home";
import { useT } from "@/lib/i18n/locale-provider";
import { translateValidationMessage } from "@/lib/i18n/validation-messages";
import { safeRedirectPath } from "@/lib/validation/redirect";
import { validateEmail } from "@/lib/validation/auth";

type FieldErrors = {
  email: string | null;
  password: string | null;
};

function LoginForm() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({ email: null, password: null });
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setApiError(null);

    // Deliberately no six-character minimum here — that's a signup-time
    // affordance; applying it at login would make an older short password
    // impossible to enter. Errors are stored untranslated and translated
    // only at the point they render (translateValidationMessage below).
    const errors: FieldErrors = {
      email: validateEmail(email),
      password: password ? null : "Password is required.",
    };
    setFieldErrors(errors);

    if (errors.email || errors.password) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        // data.error is the login route's own literal (unchanged by this
        // plan, T-06-37); the client renders it as-is. Only the fallback
        // default — used when the response body carries no error — is
        // routed through t().
        setApiError(data.error ?? t("auth.login.generic_error"));
        return;
      }

      const roleHome = ROLE_HOME[data.role as string] ?? "/";
      const target = safeRedirectPath(searchParams.get("from"), roleHome);
      router.push(target);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center ps-4 pe-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">{t("auth.login.title")}</CardTitle>
          <CardDescription>{t("auth.login.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">{t("auth.login.email_label")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={fieldErrors.email ? true : undefined}
                className="max-w-full overflow-x-auto"
              />
              {fieldErrors.email ? (
                <p className="text-sm font-normal text-destructive">
                  {translateValidationMessage(fieldErrors.email, t)}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">{t("auth.login.password_label")}</Label>
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
              {isSubmitting ? t("auth.login.submitting") : t("auth.login.submit")}
            </Button>
            <p className="text-center text-sm">
              {t("auth.login.no_account_prompt")}{" "}
              <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
                {t("auth.login.signup_link")}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
