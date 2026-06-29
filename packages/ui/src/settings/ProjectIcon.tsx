import { cn } from "../lib/utils";

interface Props {
  name?: string;
  src?: string | null;
  hue?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASS = {
  sm: "size-6 rounded-sm text-xs",
  md: "size-8 rounded-md text-sm",
  lg: "size-12 rounded-md text-base",
} as const;

function initial(name?: string) {
  const s = (name ?? "").trim();
  return s ? s.slice(0, 1).toUpperCase() : "?";
}

export function ProjectIcon({ name, src, hue, size = "lg", className }: Props) {
  const bg =
    typeof hue === "number"
      ? { background: `oklch(0.72 0.12 ${hue})`, color: "white" }
      : undefined;

  if (src) {
    return (
      <img
        src={src}
        alt={name ?? "project"}
        className={cn(SIZE_CLASS[size], "object-cover", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        SIZE_CLASS[size],
        "flex items-center justify-center bg-muted font-semibold text-foreground",
        className,
      )}
      style={bg}
    >
      {initial(name)}
    </div>
  );
}
