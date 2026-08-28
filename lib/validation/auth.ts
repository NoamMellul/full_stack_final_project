// Manual TypeScript validation functions (D-02) — no schema library.
// Password minimum length mirrors supabase/config.toml `minimum_password_length = 6`.

export function validateEmail(email: string): string | null {
  // A non-string reaching .trim() would throw an unhandled exception (500),
  // not a validation error — guard it the same as any other missing value.
  if (typeof email !== "string") return "Email is required.";
  const trimmed = email.trim();
  if (!trimmed) return "Email is required.";
  // Simple RFC-5322-ish check; not exhaustive by design (server-side, not the security boundary).
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Invalid email format.";
  return null;
}

export function validatePassword(password: string): string | null {
  // Same non-string guard as validateEmail — a non-string would otherwise
  // reach .length below and throw instead of returning a validation error.
  if (typeof password !== "string") return "Password is required.";
  if (!password) return "Password is required.";
  if (password.length < 6) return "Password must be at least 6 characters.";
  return null;
}

export function validateFullName(fullName: string): string | null {
  // Same non-string guard as validateEmail/validatePassword — app/api/auth/signup/route.ts
  // passes body.fullName straight through, untyped.
  if (typeof fullName !== "string") return "Full name is required.";
  if (!fullName.trim()) return "Full name is required.";
  return null;
}
