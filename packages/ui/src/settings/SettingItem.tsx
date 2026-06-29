import type { ReactNode } from "react";
import { cn } from "../lib/utils";

interface Props {
  title: ReactNode;
  description?: string;
  eyebrow?: ReactNode;
  leading?: ReactNode;
  control?: ReactNode;
  footer?: ReactNode;
  tone?: "default" | "danger";
  layout?: "stack" | "inline";
  className?: string;
  children?: ReactNode;
}

export function SettingItem({
  title,
  description,
  eyebrow,
  leading,
  control,
  footer,
  tone = "default",
  layout = "stack",
  className,
  children,
}: Props) {
  return (
    <section
      data-slot="setting-item"
      data-tone={tone}
      data-layout={layout}
      className={cn(
        "flex w-full gap-3",
        layout === "inline" ? "items-start justify-between" : "flex-col",
        tone === "danger" && "rounded-lg bg-destructive/10 p-4 ring-1 ring-destructive/25",
        className,
      )}
    >
      <div className={cn("flex min-w-0 gap-3", layout === "inline" && "flex-1")}>
        {leading ? <div className="shrink-0 pt-0.5">{leading}</div> : null}
        <div className="min-w-0">
          {eyebrow ? (
            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {eyebrow}
            </div>
          ) : null}
          <div className="text-sm font-medium text-foreground">{title}</div>
          {description ? (
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>

      {control ? (
        <div className={cn("shrink-0", layout === "inline" ? "pt-0.5" : undefined)}>{control}</div>
      ) : null}

      {children ? (
        <div className={cn(layout === "inline" ? "min-w-[16rem] max-w-xl flex-1" : undefined)}>
          {children}
        </div>
      ) : null}

      {footer ? (
        <div className="text-xs text-muted-foreground">{footer}</div>
      ) : null}
    </section>
  );
}
