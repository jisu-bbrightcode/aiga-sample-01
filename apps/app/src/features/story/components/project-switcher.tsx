import { useFeatureTranslation } from "@repo/core/i18n";
import { Button } from "@repo/ui/shadcn/button";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/shadcn/popover";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ChevronDown, PenLine, Search, Settings } from "lucide-react";
import { useState } from "react";
import { useProject } from "@/features/project/hooks/use-project-queries";

/**
 * Project initial avatar — 프로젝트명 첫 글자(한글/영문/이모지 모두 지원).
 */
function projectInitial(name: string | undefined | null): string {
  if (!name) return "?";
  const first = Array.from(name.trim())[0];
  return first ? first.toUpperCase() : "?";
}

interface ProjectSwitcherProps {
  onCreateNew?: () => void;
}

export function ProjectSwitcher({ onCreateNew }: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useFeatureTranslation("feature.story");
  const { projectId } = useParams({ strict: false }) as {
    projectId?: string;
  };

  const { data: currentProject } = useProject(projectId ?? "");

  return (
    <div data-el="shell.project-selector" className="mb-2.5 flex items-center gap-1.5">
      {/* Project selector */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="min-w-0 flex-1 justify-start gap-2.5 rounded-lg px-2.5 py-2 text-base font-semibold text-sidebar-foreground hover:bg-muted hover:text-foreground"
            />
          }
        >
          <span
            aria-hidden
            className="flex size-6.5 shrink-0 items-center justify-center rounded-md bg-sidebar-primary font-display text-base font-bold text-sidebar-primary-foreground"
          >
            {projectInitial(currentProject?.name)}
          </span>
          <span className="min-w-0 flex-1 truncate">
            {currentProject?.name ?? t("project.switcher.selectProject")}
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </PopoverTrigger>

        <PopoverContent align="start" className="w-64 p-1">
          <ProjectSwitcherFooterActions
            onOpenSettings={() => {
              navigate({
                to: "/settings",
                search: projectId ? { projectId } : undefined,
              });
              setOpen(false);
            }}
            onViewAllProjects={() => {
              navigate({ to: "/" });
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>

      {/* Search button */}
      <ProjectSearchButton
        disabled={!projectId}
        onSearch={() => {
          if (!projectId) return;
          navigate({ to: `/p/${projectId}/search` });
        }}
      />

      {/* New story button */}
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 rounded-full border"
        onClick={onCreateNew}
      >
        <PenLine className="size-3.5" />
      </Button>
    </div>
  );
}

function ProjectSwitcherFooterActions({
  onOpenSettings,
  onViewAllProjects,
}: {
  onOpenSettings: () => void;
  onViewAllProjects: () => void;
}) {
  const { t } = useFeatureTranslation("feature.story");
  return (
    <div className="border-t px-1 py-1">
      <Button
        type="button"
        variant="ghost"
        size="default"
        className="h-8 w-full justify-start gap-2 rounded-md px-2 py-1.5 text-sm font-normal text-foreground hover:bg-muted"
        onClick={onOpenSettings}
      >
        <Settings className="size-3.5" />
        {t("project.switcher.settings")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="default"
        className="h-8 w-full justify-start rounded-md px-2 py-1.5 text-sm font-normal text-foreground hover:bg-muted"
        onClick={onViewAllProjects}
      >
        {t("project.switcher.viewAll")}
      </Button>
    </div>
  );
}

function ProjectSearchButton({ disabled, onSearch }: { disabled: boolean; onSearch: () => void }) {
  const { t } = useFeatureTranslation("feature.story");
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-7 shrink-0"
      aria-label={t("project.switcher.searchAria")}
      title={t("project.switcher.searchAria")}
      disabled={disabled}
      onClick={onSearch}
    >
      <Search className="size-3.5" />
    </Button>
  );
}
