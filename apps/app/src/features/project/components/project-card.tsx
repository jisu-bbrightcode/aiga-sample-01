/**
 * Project card — book-shaped (aspect 2:3): cover artwork on top, info strip
 * on bottom (name + meta). When the project has no `coverImage`, a deterministic
 * pattern placeholder is chosen from /public/patterns/* so every card has a
 * cover.
 */

import { StackedCard } from "@repo/ui/components/stacked-card";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/shadcn/dropdown-menu";
import {
  Archive,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  MoreHorizontal,
  Pencil,
  Star,
} from "lucide-react";
import { type KeyboardEvent, type ReactNode, useState } from "react";
import { defaultPatternFor } from "../patterns";
import { usePinnedProjects } from "../state/pinned-projects";
import { CoverPickerDialog } from "./cover-picker-dialog";

interface Props {
  id: string;
  name: string;
  description?: string | null;
  coverImage?: string | null;
  updatedAt: string;
  onOpen: (id: string) => void;
  onArchive: (id: string) => void;
}

export function ProjectCard({
  id,
  name,
  description,
  coverImage,
  updatedAt,
  onOpen,
  onArchive,
}: Props) {
  const { has: isPinned, toggle: togglePin } = usePinnedProjects();
  const pinned = isPinned(id);
  const cover = coverImage || defaultPatternFor(id);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const summary = description?.trim() || null;
  const timeAgo = formatRelativeTime(updatedAt);
  const ownerInitial = "Y";

  return (
    <>
      <ProjectCardSurface
        id={id}
        name={name}
        summary={summary}
        cover={cover}
        timeAgo={timeAgo}
        ownerInitial={ownerInitial}
        onOpen={onOpen}
        actions={
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => togglePin(id)}
              aria-label={pinned ? "즐겨찾기 해제" : "즐겨찾기"}
              data-el="project-card.pin-btn"
              className={cn(
                "size-7 rounded-md p-0 transition-opacity duration-150 ease-out",
                "bg-surface-elevated/75 text-foreground/70 backdrop-blur-md",
                "hover:bg-muted hover:text-foreground",
                pinned ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                pinned && "text-primary hover:bg-primary/10 hover:text-primary",
              )}
            >
              <Star className={cn("size-3.5", pinned && "fill-current")} />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger
                onClick={(e) => e.stopPropagation()}
                aria-label="더 보기"
                data-el="project-card.more-btn"
                className={cn(
                  "grid size-7 place-items-center rounded-md transition-opacity duration-150 ease-out",
                  "bg-surface-elevated/75 text-foreground/70 backdrop-blur-md",
                  "hover:bg-muted hover:text-foreground",
                  "opacity-0 group-hover:opacity-100 data-[popup-open]:opacity-100",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <MoreHorizontal className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuItem onClick={() => togglePin(id)}>
                  <Star className={cn("mr-2 size-3.5", pinned && "fill-current text-primary")} />
                  <span>{pinned ? "즐겨찾기 해제" : "즐겨찾기에 추가"}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onOpen(id)}>
                  <ExternalLink className="mr-2 size-3.5" />
                  <span>새 탭에서 열기</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setCoverPickerOpen(true);
                  }}
                >
                  <ImageIcon className="mr-2 size-3.5" />
                  <span>커버 변경</span>
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <Pencil className="mr-2 size-3.5" />
                  <span>이름 변경</span>
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <Copy className="mr-2 size-3.5" />
                  <span>복제</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onArchive(id)} data-el="project-card.archive-item">
                  <Archive className="mr-2 size-3.5" />
                  <span>보관</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      <CoverPickerDialog
        projectId={id}
        currentCover={coverImage ?? null}
        open={coverPickerOpen}
        onOpenChange={setCoverPickerOpen}
      />
    </>
  );
}

interface ProjectCardSurfaceProps {
  id: string;
  name: string;
  summary?: string | null;
  cover: string;
  timeAgo: string;
  ownerInitial?: string;
  onOpen?: (id: string) => void;
  actions?: ReactNode;
}

export function ProjectCardSurface({
  id,
  name,
  summary,
  cover,
  timeAgo,
  ownerInitial = "Y",
  onOpen,
  actions,
}: ProjectCardSurfaceProps) {
  const interactiveProps = onOpen
    ? {
        role: "button" as const,
        tabIndex: 0,
        onClick: () => onOpen(id),
        onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(id);
          }
        },
      }
    : {};

  return (
    <StackedCard
      layers={3}
      layerClassName="border-border-strong/30 bg-surface-elevated shadow-[0_1px_2px_rgba(31,29,24,0.04)]"
    >
      <div
        {...interactiveProps}
        data-el="project-card.surface"
        className={cn(
          "group relative flex aspect-[2/3] flex-col overflow-hidden rounded-lg",
          onOpen && "cursor-pointer",
          "border border-border-strong/30 bg-surface-elevated text-left shadow-sm",
          "transition-[border-color,box-shadow] duration-150 ease-out",
          "hover:border-border-strong hover:shadow-md",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
      >
        <div
          aria-hidden
          className="relative flex-1 bg-cover bg-center"
          style={{ backgroundImage: `url(${cover})` }}
        >
          {actions ? (
            <div
              className="absolute right-1.5 top-1.5 flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {actions}
            </div>
          ) : null}
        </div>

        <div className="flex flex-none flex-col gap-2 border-t border-border-strong/20 bg-surface-elevated px-3.5 py-5">
          <div
            className="line-clamp-2 text-lg font-semibold leading-[1.3] tracking-tight text-foreground"
            title={name}
          >
            {name}
          </div>
          {summary ? (
            <p className="line-clamp-2 text-xs leading-[1.45] text-muted-foreground">
              {summary}
            </p>
          ) : (
            <p className="line-clamp-2 text-xs italic leading-[1.45] text-muted-foreground/60">
              설명 없음
            </p>
          )}
          <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="flex-none tabular-nums">{timeAgo}</span>
            <div className="flex min-w-0 flex-none items-center gap-1.5 text-foreground/80">
              <span
                aria-hidden
                className="grid size-4 flex-none place-items-center rounded-full bg-primary text-2xs font-semibold uppercase text-primary-foreground"
              >
                {ownerInitial}
              </span>
              <span className="truncate">나</span>
            </div>
          </div>
        </div>
      </div>
    </StackedCard>
  );
}

// Pattern placeholders & default pattern resolver moved to ../patterns.ts so
// CoverPickerDialog can share the same list.

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "방금 전";
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;

  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
