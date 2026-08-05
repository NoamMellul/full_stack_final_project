import { cn } from "@/lib/utils";

type InitialsAvatarProps = {
  name: string;
  size?: "sm" | "default";
  className?: string;
};

const FALLBACK_GLYPH = "•";

function deriveInitials(name: string): string {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return FALLBACK_GLYPH;

  const first = tokens[0]?.[0] ?? "";
  const last = tokens.length > 1 ? tokens[tokens.length - 1]?.[0] ?? "" : "";
  const initials = `${first}${last}`.toUpperCase();

  return initials || FALLBACK_GLYPH;
}

// Decorative avatar fallback (D-02): the full name is exposed to assistive
// tech by the adjacent cell text, so this glyph is purely visual.
export default function InitialsAvatar({ name, size = "default", className }: InitialsAvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground select-none",
        size === "sm" ? "size-6 text-[10px] font-semibold" : "size-8 text-xs font-semibold",
        className,
      )}
    >
      {deriveInitials(name)}
    </span>
  );
}
