/**
 * SetListRow — one row in a list-style settings section.
 *
 * Plain markup + tailwind. Layout: leading slot (icon/avatar) + main
 * (title + sub) + trailing slot (badge/button). Borderless — separation
 * from sibling rows comes from vertical padding only.
 */
import type { ReactNode } from "react";
import { cn } from "../lib/utils";

interface Props {
  leading?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  trailing?: ReactNode;
  dim?: boolean;
}

export function SetListRow({ leading, title, sub, trailing, dim }: Props) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 py-2.5",
        dim && "opacity-60",
      )}
    >
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-medium text-foreground">{title}</div>
        {sub ? (
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</div>
        ) : null}
      </div>
      {trailing ? (
        <div className="flex shrink-0 items-center gap-2.5">{trailing}</div>
      ) : null}
    </div>
  );
}
