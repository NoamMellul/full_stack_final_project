// Manual TypeScript same-origin redirect guard (D-02) — no schema library.
// Prevents an untrusted `?from=` query parameter from sending the browser
// off-site after login (T-01-02).

export function safeRedirectPath(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  // Must start with exactly one forward slash (relative path), never "//..."
  // (protocol-relative URL) and must not contain a colon anywhere (rules out
  // absolute URLs like "https://evil.example.com" and "javascript:" payloads).
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;
  if (raw.includes(":")) return fallback;
  return raw;
}
