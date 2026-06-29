/**
 * Detail page toolbar: 44px height.
 * Structure: [ArrowLeft ghost btn] [title 13px/600] [type 13px muted] [spacer] [MoreHorizontal ghost btn]
 */

import { useFeatureTranslation } from "@repo/core/i18n";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/shadcn/button";
import { ArrowLeft, MoreHorizontal } from "lucide-react";

interface Props {
  title: string;
  entityType: string;
  onBack: () => void;
  onMore?: () => void;
  className?: string;
  dataEl?: string;
}

export function DetailToolbar({ title, entityType, onBack, onMore, className, dataEl }: Props) {
  const { t } = useFeatureTranslation("feature.story");
  return (
    <div data-el={dataEl} className={cn("flex h-11 shrink-0 items-center gap-xs px-md", className)}>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={onBack}
        aria-label={t("shell.detail.back")}
        data-el={dataEl ? `${dataEl}.back-btn` : undefined}
      >
        <ArrowLeft className="size-3.5" />
      </Button>

      <span
        className="text-base font-semibold text-foreground"
        data-el={dataEl ? `${dataEl}.title` : undefined}
      >
        {title}
      </span>

      <span className="text-base text-muted-foreground">{entityType}</span>

      <span className="flex-1" />

      {onMore ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onMore}
          aria-label={t("shell.detail.more")}
        >
          <MoreHorizontal className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}
