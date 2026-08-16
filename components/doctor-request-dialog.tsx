"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/locale-provider";
import { translateValidationMessage } from "@/lib/i18n/validation-messages";
import { createClient } from "@/lib/supabase/client";
import { validateDoctorRequestInput } from "@/lib/validation/doctor-request";

type SpecialtyOption = { id: string; name_en: string; name_he: string };

// No props: owns its own Dialog root, trigger, and all state. Rendered as a
// sibling immediately after the login form's closing tag on /login.
export default function DoctorRequestDialog() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [specialties, setSpecialties] = useState<SpecialtyOption[]>([]);
  const specialtiesLoadedRef = useRef(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [specialtyId, setSpecialtyId] = useState("");
  const [message, setMessage] = useState("");

  const [fieldErrors, setFieldErrors] = useState<{
    fullName: string | null;
    email: string | null;
    specialtyId: string | null;
    message: string | null;
  }>({ fullName: null, email: null, specialtyId: null, message: null });
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function resetState() {
    setFullName("");
    setEmail("");
    setSpecialtyId("");
    setMessage("");
    setFieldErrors({ fullName: null, email: null, specialtyId: null, message: null });
    setApiError(null);
    setIsSubmitting(false);
    setSubmitted(false);
  }

  async function loadSpecialties() {
    if (specialtiesLoadedRef.current) return;
    specialtiesLoadedRef.current = true;

    const supabase = createClient();
    const { data } = await supabase.from("specialties").select("id,name_en,name_he");
    setSpecialties((data ?? []) as SpecialtyOption[]);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      void loadSpecialties();
    } else {
      resetState();
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApiError(null);

    const payload = { fullName, email, specialtyId, message };

    const validationError = validateDoctorRequestInput(payload);
    if (validationError) {
      const errors = { fullName: null, email: null, specialtyId: null, message: null } as typeof fieldErrors;
      if (validationError === "Full name is required." || validationError === "Full name is too long.") {
        errors.fullName = validationError;
      } else if (
        validationError === "Email is required." ||
        validationError === "Invalid email format."
      ) {
        errors.email = validationError;
      } else if (validationError === "Specialty is required.") {
        errors.specialtyId = validationError;
      } else if (
        validationError === "Message must be text." ||
        validationError === "Message is too long."
      ) {
        errors.message = validationError;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({ fullName: null, email: null, specialtyId: null, message: null });

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/doctor-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setApiError(data.error ?? t("doctor_request.generic_error"));
        return;
      }

      setSubmitted(true);
    } catch {
      setApiError(t("doctor_request.generic_error"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className="text-primary underline-offset-4 hover:underline">
        {t("doctor_request.cta")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("doctor_request.dialog_title")}</DialogTitle>
          <DialogDescription>{t("doctor_request.dialog_description")}</DialogDescription>
        </DialogHeader>
        {submitted ? (
          <p role="status">{t("doctor_request.success")}</p>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="doctor-request-fullName">{t("doctor_request.name_label")}</Label>
              <Input
                id="doctor-request-fullName"
                name="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                aria-invalid={fieldErrors.fullName ? true : undefined}
              />
              {fieldErrors.fullName ? (
                <p className="text-sm font-normal text-destructive">
                  {translateValidationMessage(fieldErrors.fullName, t)}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="doctor-request-email">{t("doctor_request.email_label")}</Label>
              <Input
                id="doctor-request-email"
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
              <Label htmlFor="doctor-request-specialtyId">{t("doctor_request.specialty_label")}</Label>
              <Select value={specialtyId} onValueChange={(value) => setSpecialtyId(value ?? "")}>
                <SelectTrigger
                  id="doctor-request-specialtyId"
                  aria-invalid={fieldErrors.specialtyId ? true : undefined}
                >
                  <SelectValue placeholder={t("doctor_request.specialty_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {specialties.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.specialtyId ? (
                <p className="text-sm font-normal text-destructive">
                  {translateValidationMessage(fieldErrors.specialtyId, t)}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="doctor-request-message">{t("doctor_request.message_label")}</Label>
              <Textarea
                id="doctor-request-message"
                name="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                aria-invalid={fieldErrors.message ? true : undefined}
              />
              {fieldErrors.message ? (
                <p className="text-sm font-normal text-destructive">
                  {translateValidationMessage(fieldErrors.message, t)}
                </p>
              ) : null}
            </div>

            {apiError ? <p className="text-sm font-normal text-destructive">{apiError}</p> : null}

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? t("doctor_request.submitting") : t("doctor_request.submit")}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
