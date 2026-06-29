/**
 * SetSection — vertically stacked section in settings pages.
 *
 * Plain semantic markup + tailwind utilities (no shadcn primitive needed
 * — Card adds borders/shadows we don't want here). Inside `.settings-screen`
 * the muted/foreground utilities resolve to design v8 colors via the
 * shadcn token aliases declared in settings-design.css.
 *
 * Design spec:
 *   margin-bottom: 36px        → mb-9
 *   head margin-bottom: 14px   → mb-3.5
 *   h2: 14px / 600 / -0.005em  → text-sm font-semibold tracking-tight
 *   p:  12.5px / 400           → mt-1 text-xs
 */
import type { ReactNode } from "react";

interface Props {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function SetSection({ title, description, action, children }: Props) {
  return (
    <section className="mb-9">
      <header className="mb-3.5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ?? null}
      </header>
      <div>{children}</div>
    </section>
  );
}
