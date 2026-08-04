// Manual TypeScript validation functions (D-02) — no schema library.
// Password minimum length mirrors supabase/config.toml `minimum_password_length = 6`.

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Email is required.";
  // Simple RFC-5322-ish check; not exhaustive by design (server-side, not the security boundary).
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Invalid email format.";
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "Password is required.";
  if (password.length < 6) return "Password must be at least 6 characters.";
  return null;
}

export function validateFullName(fullName: string): string | null {
  if (!fullName.trim()) return "Full name is required.";
  return null;
}
