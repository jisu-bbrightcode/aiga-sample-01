/**
 * 공통 페이지 chrome.
 *   ┌────────────────────────────────────────────────────────────┐
 *   │ Aethys / 세계관 / 캐릭터 ⌄        (재)(민)(수)(현)  [+]   │   ← PageHeader
 *   ├────────────────────────────────────────────────────────────┤
 *   │  (subbar — 자식이 제공)                                    │
 *   ├────────────────────────────────────────────────────────────┤
 *   │  content (children)                                         │
 *   └────────────────────────────────────────────────────────────┘
 *
 * 프로젝트 멤버는 현재 서버 모델이 없으므로 디자인의 4인 고정 아바타를
 * 기본값으로 넣어둔다. 실제 멤버 API 연결 시 prop 으로 override.
 */

import { ChevronDown, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../_shadcn/button";
import { cn } from "../lib/utils";

export interface Crumb {
  label: string;
  onClick?: () => void;
}

export interface ProjectMember {
  initial: string;
  color: string;
  name: string;
}

export const DEFAULT_PROJECT_MEMBERS: ProjectMember[] = [
  { initial: "재", color: "#C9A861", name: "재민" },
  { initial: "민", color: "#8B5CF6", name: "민지" },
  { initial: "수", color: "#22C55E", name: "수진" },
  { initial: "현", color: "#F59E0B", name: "현우" },
];

interface PageLayoutProps {
  /** breadcrumb 항목들. 마지막이 현재 화면. */
  crumbs: Crumb[];
  /** 우측 상단 프로젝트 멤버 아바타 스택 (기본 디자인 4인). 빈 배열이면 숨김. */
  members?: ProjectMember[];
  /** 우측 상단 추가 액션 영역 (멤버 뒤, add 버튼 앞에 삽입). */
  actions?: ReactNode;
  /** 우측 상단 "+" 버튼 콜백. 생략시 버튼 미출력. */
  onAdd?: () => void;
  addLabel?: string;
  /** 뒤로가기 — 있으면 breadcrumb 앞에 chevron-left 버튼 출력. */
  onBack?: () => void;
  children: ReactNode;
  className?: string;
}

export function PageLayout({
  crumbs,
  members,
  actions,
  onAdd,
  addLabel,
  onBack,
  children,
  className,
}: PageLayoutProps) {
  return (
    <div className={cn("flex h-full flex-col bg-background", className)} data-el="page.root">
      <PageHeader
        crumbs={crumbs}
        members={members}
        actions={actions}
        onAdd={onAdd}
        addLabel={addLabel}
        onBack={onBack}
      />
      <div className="flex min-h-0 flex-1 flex-col" data-el="page.body">
        {children}
      </div>
    </div>
  );
}

interface PageHeaderProps {
  crumbs: Crumb[];
  members?: ProjectMember[];
  actions?: ReactNode;
  onAdd?: () => void;
  addLabel?: string;
  onBack?: () => void;
}

export function PageHeader({ crumbs, members, actions, onAdd, addLabel, onBack }: PageHeaderProps) {
  return (
    <header data-el="page.header" className="flex h-11 shrink-0 items-center gap-3 px-7">
      {onBack ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          aria-label="뒤로"
          className="mr-xs flex size-6 items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Button>
      ) : null}

      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 flex-1 items-center gap-xs text-base text-muted-foreground"
      >
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <span
              key={`${c.label}:${last ? "curr" : "crumb"}`}
              className="flex items-center gap-xs"
            >
              {i > 0 && <span className="text-muted-foreground/60">/</span>}
              {c.onClick && !last ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={c.onClick}
                  className="h-auto min-w-0 truncate rounded-none p-0 text-base text-foreground/80 hover:bg-transparent hover:text-foreground"
                >
                  {c.label}
                </Button>
              ) : (
                <span
                  className={cn(
                    "truncate",
                    last ? "font-medium text-foreground" : "text-foreground/80",
                  )}
                >
                  {c.label}
                </span>
              )}
            </span>
          );
        })}
        <ChevronDown className="ml-xs size-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
      </nav>

      <div className="flex items-center gap-sm" data-el="page.header.actions">
        {members && members.length > 0 ? <ProjectMembersStack members={members} /> : null}
        {actions}
        {onAdd ? (
          <Button
            size="icon"
            className="size-8 rounded-md"
            onClick={onAdd}
            title={addLabel ?? "추가"}
            aria-label={addLabel ?? "추가"}
          >
            <Plus className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </header>
  );
}

interface ProjectMembersStackProps {
  members: ProjectMember[];
}

export function ProjectMembersStack({ members }: ProjectMembersStackProps) {
  if (members.length === 0) return null;
  return (
    <div
      data-el="page.members"
      className="flex items-center pr-xs"
      title={`프로젝트 멤버 ${members.length}명`}
    >
      {members.map((m, i) => (
        <div
          key={m.name}
          className="-ml-1.5 flex size-6 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-background first:ml-0"
          style={{ background: m.color, zIndex: members.length - i }}
          title={m.name}
          aria-label={m.name}
        >
          {m.initial}
        </div>
      ))}
    </div>
  );
}
