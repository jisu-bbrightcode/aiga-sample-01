/**
 * HueAvatar — circular avatar with optional hue background.
 *
 * Wraps shadcn Avatar. `hue` (0-360) maps to oklch fallback color per
 * design (saturated amber/teal/blue from `oklch(0.72 0.12 hue)`); `src`
 * overrides with a real image. Initials are derived from name/email.
 */
import { Avatar, AvatarFallback, AvatarImage } from "../_shadcn/avatar";
import { cn } from "../lib/utils";

interface Props {
  name?: string;
  email?: string;
  hue?: number;
  src?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASS = {
  xs: "size-5", // 20px
  sm: "size-6", // 24px
  md: "size-8", // 32px
  lg: "size-20", // 80px (design ≈ 72px, rounded to nearest token)
} as const;

const TEXT_SIZE = {
  xs: "text-xs",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-3xl",
} as const;

function initials(name?: string, email?: string) {
  const src = (name ?? email ?? "").trim();
  if (!src) return "?";
  return src.slice(0, 1).toUpperCase();
}

export function HueAvatar({
  name,
  email,
  hue,
  src,
  size = "md",
  className,
}: Props) {
  const fallbackStyle =
    typeof hue === "number"
      ? { background: `oklch(0.72 0.12 ${hue})`, color: "white" }
      : undefined;
  return (
    <Avatar className={cn(SIZE_CLASS[size], className)}>
      {src ? <AvatarImage src={src} alt={name ?? email ?? "avatar"} /> : null}
      <AvatarFallback
        className={cn(TEXT_SIZE[size], "font-semibold")}
        style={fallbackStyle}
      >
        {initials(name, email)}
      </AvatarFallback>
    </Avatar>
  );
}
