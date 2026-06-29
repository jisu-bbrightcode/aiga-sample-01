/**
 * Empty / no-results states matching `.proj-empty-page` pattern.
 * Centered glyph (56px rounded surface tile) → title → sub → single qtool action.
 */

import { Button } from "@repo/ui/shadcn/button";
import { Folder, Plus, Search, X } from "lucide-react";

interface EmptyProjectsProps {
  onCreateProject: () => void;
}

export function EmptyProjects({ onCreateProject }: EmptyProjectsProps) {
  return (
    <EmptyShell
      glyph={<Folder className="size-8 text-muted-foreground" strokeWidth={1.4} />}
      title="아직 프로젝트가 없어요"
      subtitle="이 워크스페이스에서 만들거나 참여한 프로젝트가 여기에 표시됩니다."
      action={
        <Button onClick={onCreateProject} size="sm" className="mt-3 h-8 gap-1.5 px-3 text-base" data-el="project-list.empty-create-btn">
          <Plus className="size-3.5" />첫 프로젝트 만들기
        </Button>
      }
    />
  );
}

interface NoResultsStateProps {
  query: string;
  onClear: () => void;
}

export function NoResultsState({ query, onClear }: NoResultsStateProps) {
  const hasQuery = query.trim().length > 0;
  return (
    <EmptyShell
      glyph={<Search className="size-7 text-muted-foreground" strokeWidth={1.4} />}
      title={
        hasQuery
          ? `"${query}" 와(과) 일치하는 프로젝트가 없어요`
          : "조건에 맞는 프로젝트가 없어요"
      }
      subtitle="철자를 확인하거나, 다른 키워드로 검색해 보세요."
      action={
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="mt-3 h-8 gap-1.5 px-3 text-base text-muted-foreground hover:text-foreground"
          data-el="project-list.no-results-clear-btn"
        >
          <X className="size-3.5" />검색 초기화
        </Button>
      }
    />
  );
}

interface EmptyShellProps {
  glyph: React.ReactNode;
  title: string;
  subtitle: string;
  action: React.ReactNode;
}

function EmptyShell({ glyph, title, subtitle, action }: EmptyShellProps) {
  return (
    <div data-el="project-list.empty-state" className="flex flex-col items-center justify-center gap-2.5 px-6 pb-16 pt-20 text-center">
      <div className="mb-1.5 grid size-14 place-items-center rounded-2xl border border-border-subtle bg-card">
        {glyph}
      </div>
      <h3 className="text-lg font-medium tracking-tight text-foreground">{title}</h3>
      <p className="max-w-[380px] text-base text-muted-foreground">{subtitle}</p>
      {action}
    </div>
  );
}
