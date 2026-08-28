"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/locale-provider";
import { translateValidationMessage } from "@/lib/i18n/validation-messages";
import { validatePassword } from "@/lib/validation/auth";

type FieldErrors = {
  password: string | null;
  confirmPassword: string | null;
};

export default function DoctorChangePasswordPage() {
  const t = useT();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({
    password: null,
    confirmPassword: null,
  });
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setApiError(null);

    const passwordError = validatePassword(password);
    const errors: FieldErrors = {
      password: passwordError ? translateValidationMessage(passwordError, t) : null,
      confirmPassword:
        password !== confirmPassword ? t("auth.change_password.mismatch_error") : null,
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
        setApiError(data.error ?? t("auth.change_password.generic_error"));
        return;
      }

      router.push("/doctor");
      router.refresh();
    } catch {
      setApiError(t("auth.change_password.generic_error"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center ps-4 pe-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">{t("auth.change_password.title")}</CardTitle>
          <CardDescription>{t("auth.change_password.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">{t("auth.change_password.new_password_label")}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={fieldErrors.password ? true : undefined}
              />
              {fieldErrors.password ? (
                <p className="text-sm font-normal text-destructive">{fieldErrors.password}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword">
                {t("auth.change_password.confirm_password_label")}
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
                ? t("auth.change_password.submitting")
                : t("auth.change_password.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
