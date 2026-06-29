/**
 * 프로젝트 설정 좌측 네비게이션.
 */
import { useFeatureTranslation } from "@repo/core/i18n";
import { cn } from "@repo/ui/lib/utils";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { ArrowLeft, Bot, ClipboardList, Users } from "lucide-react";

interface ProjectSettingsNavProps {
  projectId: string;
}

export function ProjectSettingsNav({ projectId }: ProjectSettingsNavProps) {
  const matchRoute = useMatchRoute();
  const { t } = useFeatureTranslation("feature.story");

  const isGeneral = Boolean(
    matchRoute({
      to: "/p/$projectId/settings",
      params: { projectId },
    }),
  );
  return (
    <aside className="w-[220px] shrink-0 border-r p-4">
      <Link
        to="/p/$projectId/lore"
        params={{ projectId }}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-3.5" />
        <span>{t("project.settings.nav.back")}</span>
      </Link>

      <h2 className="text-2xs font-medium text-muted-foreground/60 uppercase tracking-[0.1em] px-2 mb-1">
        {t("project.settings.nav.heading")}
      </h2>
      <nav className="flex flex-col">
        <Link
          to="/p/$projectId/settings"
          params={{ projectId }}
          className={cn(
            "flex items-center gap-3 px-2 py-1.5 text-sm rounded-md transition-colors",
            isGeneral
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <ClipboardList className="size-3.5" />
          <span>{t("project.settings.nav.general")}</span>
        </Link>

        <span className="flex items-center gap-3 px-2 py-1.5 text-sm rounded-md cursor-not-allowed text-muted-foreground/40">
          <Bot className="size-3.5" />
          <span>{t("project.settings.nav.aiMode")}</span>
          <span className="ml-auto text-2xs bg-muted px-1.5 py-0.5 rounded">{t("project.settings.nav.phaseBadge")}</span>
        </span>

        <span className="flex items-center gap-3 px-2 py-1.5 text-sm rounded-md cursor-not-allowed text-muted-foreground/40">
          <Users className="size-3.5" />
          <span>{t("project.settings.nav.members")}</span>
          <span className="ml-auto text-2xs bg-muted px-1.5 py-0.5 rounded">{t("project.settings.nav.phaseBadge")}</span>
        </span>
      </nav>
    </aside>
  );
}
