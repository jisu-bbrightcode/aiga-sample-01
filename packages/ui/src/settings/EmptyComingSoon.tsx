import type { ReactNode } from "react";

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
}

export function EmptyComingSoon({ icon, title, description }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      {icon ? (
        <div className="text-muted-foreground/60 [&_svg]:size-8">{icon}</div>
      ) : null}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
