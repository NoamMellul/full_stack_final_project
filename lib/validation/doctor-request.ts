// Manual TypeScript validation for the public "request to join" dialog
// (no schema library). Surfaces on /login — the only /login-adjacent
// validator not admin-only — so its messages ARE included in
// lib/i18n/validation-messages.ts (unlike lib/validation/doctor.ts).

import { validateEmail, validateFullName } from "@/lib/validation/auth";

export function validateSpecialtyId(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return "Specialty is required.";
  }
  return null;
}

export function validateDoctorRequestInput(body: Record<string, unknown>): string | null {
  const fullName = body.fullName;
  if (typeof fullName !== "string") {
    return validateFullName("");
  }
  const fullNameError = validateFullName(fullName);
  if (fullNameError) {
    return fullNameError;
  }
  if (fullName.trim().length > 200) {
    return "Full name is too long.";
  }

  const email = body.email;
  if (typeof email !== "string") {
    return validateEmail("");
  }
  const emailError = validateEmail(email);
  if (emailError) {
    return emailError;
  }
  if (email.trim().length > 254) {
    return "Invalid email format.";
  }

  const specialtyError = validateSpecialtyId(body.specialtyId);
  if (specialtyError) {
    return specialtyError;
  }

  const message = body.message;
  if (message !== undefined && message !== null && typeof message !== "string") {
    return "Message must be text.";
  }
  if (typeof message === "string" && message.length > 2000) {
    return "Message is too long.";
  }

  return null;
}
