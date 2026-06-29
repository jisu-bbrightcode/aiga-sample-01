/**
 * ProjectHeader — top hero row of the project detail page.
 */
import { useFeatureTranslation } from "@repo/core/i18n";
import { Pill, ProjectIcon } from "@repo/ui/settings";
import { Star } from "lucide-react";

interface Props {
  name: string;
  handle: string | null;
  visibility: "private" | "org" | "public";
  orgSlug: string;
  starred: boolean;
  updatedAt: string | Date | null;
}

const VIS_LABEL = { private: "Private", org: "Org", public: "Public" } as const;
const VIS_TONE: Record<Props["visibility"], "neutral" | "info" | "success"> = {
  private: "neutral",
  org: "info",
  public: "success",
};

type TranslateFn = (key: string, opts?: Record<string, unknown>) => string;

function relative(d: string | Date | null, t: TranslateFn): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const ms = Date.now() - date.getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return t("projects.card.relative.min", { count: Math.max(0, min) });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t("projects.card.relative.hour", { count: hr });
  const day = Math.floor(hr / 24);
  return day < 7
    ? t("projects.card.relative.day", { count: day })
    : date.toISOString().slice(0, 10);
}

export function ProjectHeader({ name, handle, visibility, orgSlug, starred, updatedAt }: Props) {
  const { t } = useFeatureTranslation("page.settings");
  return (
    <div className="flex items-center gap-4">
      <ProjectIcon name={name} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {starred ? <Star className="size-3.5 fill-primary text-primary" /> : null}
          <h1 className="truncate text-xl font-semibold">{name}</h1>
          <Pill tone={VIS_TONE[visibility]}>{VIS_LABEL[visibility]}</Pill>
        </div>
        <div className="mt-1 truncate font-mono text-sm text-muted-foreground">
          product-builder.app/{orgSlug}/{handle ?? "—"}
          <span className="mx-2">·</span>
          {t("projects.detail.header.updated", { relative: relative(updatedAt, t) })}
        </div>
      </div>
    </div>
  );
}
