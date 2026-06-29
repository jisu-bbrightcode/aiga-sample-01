/**
 * SetDangerZone — destructive action card (account/org/project delete).
 *
 * Plain markup + tailwind, using shadcn `destructive` token aliases that
 * resolve to design v8 error colors inside .settings-screen.
 *
 * Design spec:
 *   padding: 16px 18px                      → px-[18px] py-4 (close enough)
 *   bg: error-muted, border: 1px error/25   → bg-destructive/10 ring-destructive/25
 *   title: 13px / 500 / error               → text-sm font-medium text-destructive
 *   sub:   12px / 400 / muted               → text-xs text-muted-foreground
 */
import type { ReactNode } from "react";

interface Props {
  title: string;
  description?: string;
  children: ReactNode;
}

export function SetDangerZone({ title, description, children }: Props) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-destructive/10 px-4 py-4 ring-1 ring-destructive/25">
      <div>
        <div className="text-sm font-medium text-destructive">{title}</div>
        {description ? (
          <div className="mt-0.5 text-xs text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
      <div>{children}</div>
    </div>
  );
}
