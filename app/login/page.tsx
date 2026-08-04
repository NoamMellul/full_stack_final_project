"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeRedirectPath } from "@/lib/validation/redirect";
import { validateEmail } from "@/lib/validation/auth";

type FieldErrors = {
  email: string | null;
  password: string | null;
};

const ROLE_HOME: Record<string, string> = {
  patient: "/patient",
  doctor: "/doctor",
  admin: "/admin",
};

function LoginForm() {
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
    // impossible to enter.
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
        setApiError(data.error ?? "Incorrect email or password. Please try again.");
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
          <CardTitle className="text-2xl">Log in</CardTitle>
          <CardDescription>Log in to book and manage your appointments.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
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
                <p className="text-sm font-normal text-destructive">{fieldErrors.email}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
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
            {apiError ? (
              <Alert variant="destructive">
                <AlertDescription>{apiError}</AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Logging in…" : "Log in"}
            </Button>
            <p className="text-center text-sm">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
                Sign up
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
