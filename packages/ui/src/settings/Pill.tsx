/**
 * Pill — small inline status label.
 * Design v8 cream/ink-navy palette: minimal tone variation, primary tint
 * for positive states, amber for warnings, destructive for errors.
 */
import type { ReactNode } from "react";
import { Badge } from "../_shadcn/badge";
import { cn } from "../lib/utils";

type Tone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "destructive"
  | "error";

interface Props {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}

const TONE_MAP: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-primary/10 text-primary",
  success: "bg-primary/10 text-primary",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  destructive: "bg-destructive/10 text-destructive",
  error: "bg-destructive/10 text-destructive",
};

export function Pill({ tone = "neutral", children, className }: Props) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-5 rounded-md border-0 px-2 text-xs font-medium tracking-wide",
        TONE_MAP[tone],
        className,
      )}
    >
      {children}
    </Badge>
  );
}
