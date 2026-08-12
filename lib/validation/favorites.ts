// Manual TypeScript validation (D-02) — mirrors lib/validation/auth.ts's
// single-string-or-null return contract, no schema library.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateFavoriteInput(body: unknown): string | null {
  if (typeof body !== "object" || body === null) {
    return "Doctor is required.";
  }

  const { doctorId } = body as Record<string, unknown>;

  if (typeof doctorId !== "string" || doctorId.length === 0) {
    return "Doctor is required.";
  }

  if (!UUID_RE.test(doctorId)) {
    return "Invalid doctor.";
  }

  return null;
}
