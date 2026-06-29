/**
 * 앱 사이드바 콘텐츠. 로고, 검색, 프로젝트 목록, 유저 정보 표시.
 * AppShellLayout의 sidebar slot에 사용.
 */

import { cn } from "@repo/ui/lib/utils";
import { FileText, FolderOpen, Search } from "lucide-react";
import { Avatar } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";

interface Props {
  projects: { name: string; isActive?: boolean }[];
  userName: string;
  draftCount?: number;
  onProjectClick?: (index: number) => void;
  className?: string;
}

export function AppSidebar({
  projects,
  userName,
  draftCount = 0,
  onProjectClick,
  className,
}: Props) {
  return (
    <div className={cn("flex h-full flex-col", className)} data-testid="app-sidebar">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="text-lg font-semibold tracking-tight">
          <span className="text-primary">F</span>lotter
        </span>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-muted-foreground"
          data-testid="app-sidebar.search"
        >
          <Search className="size-3.5" />
          <span className="flex-1 text-left text-sm">검색...</span>
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">⌘K</kbd>
        </Button>
      </div>

      {/* Draft quick link */}
      <div className="px-3 pb-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          data-testid="app-sidebar.drafts"
        >
          <FileText className="size-3.5 text-muted-foreground" />
          <span className="flex-1 text-left text-sm">초안</span>
          {draftCount > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {draftCount}
            </span>
          )}
        </Button>
      </div>

      <Separator className="mx-3" />

      {/* Project section */}
      <div className="flex-1 overflow-y-auto px-3 pt-3">
        <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          프로젝트
        </p>
        <div className="flex flex-col gap-0.5">
          {projects.map((project, index) => (
            <ProjectItem
              key={project.name}
              name={project.name}
              isActive={project.isActive}
              onClick={() => onProjectClick?.(index)}
            />
          ))}
        </div>
      </div>

      {/* User */}
      <div className="border-t border-border px-3 py-3">
        <div
          className="flex items-center gap-2 rounded-md px-2 py-1.5"
          data-testid="app-sidebar.user"
        >
          <Avatar className="size-7">
            <div className="flex size-full items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              {userName.charAt(0)}
            </div>
          </Avatar>
          <span className="text-sm font-medium">{userName}</span>
        </div>
      </div>
    </div>
  );
}

/* Components */

interface ProjectItemProps {
  name: string;
  isActive?: boolean;
  onClick?: () => void;
}

function ProjectItem({ name, isActive, onClick }: ProjectItemProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted hover:text-foreground",
        isActive && "bg-accent font-medium",
      )}
      onClick={onClick}
      data-testid="app-sidebar.project-item"
    >
      <FolderOpen className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{name}</span>
    </button>
  );
}
