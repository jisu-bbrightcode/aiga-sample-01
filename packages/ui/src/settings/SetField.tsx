/**
 * SetField — labeled form field wrapper inside a SetSection.
 *
 * Renders an optional label + hint head and the control body underneath.
 * Plain markup + tailwind. `full` keeps the body full-width (default);
 * pass `full={false}` to constrain via parent.
 *
 * Design spec:
 *   gap: 6px                    → gap-1.5
 *   label: 12.5px / 500         → text-xs font-medium
 *   hint:  11px / 400 muted     → text-xs (token = base − 2px)
 */
import type { ReactNode } from "react";

interface Props {
  label?: string;
  description?: string;
  hint?: ReactNode;
  htmlFor?: string;
  full?: boolean;
  children: ReactNode;
}

export function SetField({
  label,
  description,
  hint,
  htmlFor,
  children,
}: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      {label || hint ? (
        <div className="flex items-baseline justify-between gap-3">
          {label ? (
            <label
              htmlFor={htmlFor}
              className="text-xs font-medium text-foreground"
            >
              {label}
            </label>
          ) : null}
          {hint ? (
            <span className="text-xs text-muted-foreground">{hint}</span>
          ) : null}
        </div>
      ) : null}
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
      <div className="max-w-xl">{children}</div>
    </div>
  );
}
