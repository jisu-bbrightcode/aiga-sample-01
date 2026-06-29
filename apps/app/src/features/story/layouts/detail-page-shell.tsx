"use no memo";

import { useFeatureTranslation } from "@repo/core/i18n";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/shadcn/button";
import {
  ArrowLeft,
  ChevronDown,
  Maximize,
  Minimize,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Share2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

interface DetailPageShellBreadcrumb {
  label: ReactNode;
  onClick?: () => void;
}

interface DetailPageShellRenderState {
  isFocusMode: boolean;
}

interface DetailPageShellProps {
  breadcrumbs: DetailPageShellBreadcrumb[];
  currentLabel: ReactNode;
  onBack: () => void;
  editor: ReactNode | ((state: DetailPageShellRenderState) => ReactNode);
  sidebar?: ReactNode;
  focusAside?: ReactNode;
  topbarAddon?: ReactNode;
  contentWidth?: "body" | "wide";
  isLoading?: boolean;
  dataEl?: string;
  onFocusModeChange?: (isFocusMode: boolean) => void;
}

interface TopbarProps {
  breadcrumbs: DetailPageShellBreadcrumb[];
  currentLabel: ReactNode;
  onBack: () => void;
  topbarAddon?: ReactNode;
  showSidebar: boolean;
  hasSidebar: boolean;
  onFocusModeEnter: () => void;
  onSidebarToggle: () => void;
}

interface CanvasProps {
  isFocusMode: boolean;
  showSidebar: boolean;
  hasSidebar: boolean;
  contentWidth: "body" | "wide";
  isLoading: boolean;
  editor: ReactNode;
  sidebar?: ReactNode;
  focusAside?: ReactNode;
}

interface CanvasColumnsOptions {
  isFocusMode: boolean;
  showSidebar: boolean;
  hasSidebar: boolean;
  hasFocusAside: boolean;
  contentWidth: "body" | "wide";
}

export function DetailPageShell({
  breadcrumbs,
  currentLabel,
  onBack,
  editor,
  sidebar,
  focusAside,
  topbarAddon,
  contentWidth = "body",
  isLoading = false,
  dataEl = "ed-page",
  onFocusModeChange,
}: DetailPageShellProps) {
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const hasSidebar = Boolean(sidebar);
  const renderedEditor = typeof editor === "function" ? editor({ isFocusMode }) : editor;

  function enterFocusMode() {
    setIsFocusMode(true);
    onFocusModeChange?.(true);
  }

  function exitFocusMode() {
    setIsFocusMode(false);
    onFocusModeChange?.(false);
  }

  return (
    <div className="flex h-full flex-col bg-background" data-el={dataEl}>
      {isFocusMode ? null : (
        <DetailTopbar
          breadcrumbs={breadcrumbs}
          currentLabel={currentLabel}
          onBack={onBack}
          topbarAddon={topbarAddon}
          showSidebar={showSidebar}
          hasSidebar={hasSidebar}
          onFocusModeEnter={enterFocusMode}
          onSidebarToggle={() => setShowSidebar(!showSidebar)}
        />
      )}
      {isFocusMode ? <FocusExitButton onClick={exitFocusMode} /> : null}
      <DetailCanvas
        isFocusMode={isFocusMode}
        showSidebar={showSidebar}
        hasSidebar={hasSidebar}
        contentWidth={contentWidth}
        isLoading={isLoading}
        editor={renderedEditor}
        sidebar={sidebar}
        focusAside={focusAside}
      />
    </div>
  );
}

function DetailTopbar({
  breadcrumbs,
  currentLabel,
  onBack,
  topbarAddon,
  showSidebar,
  hasSidebar,
  onFocusModeEnter,
  onSidebarToggle,
}: TopbarProps) {
  const { t } = useFeatureTranslation("feature.story");
  return (
    <header data-el="ed-topbar" className="flex h-11 shrink-0 items-center gap-3 px-7">
      <IconButton label={t("shell.detail.back")} className="size-6" onClick={onBack}>
        <ArrowLeft className="size-3.5" />
      </IconButton>
      <DetailBreadcrumbs breadcrumbs={breadcrumbs} currentLabel={currentLabel} />
      <DetailTopbarActions
        topbarAddon={topbarAddon}
        showSidebar={showSidebar}
        hasSidebar={hasSidebar}
        onFocusModeEnter={onFocusModeEnter}
        onSidebarToggle={onSidebarToggle}
      />
    </header>
  );
}

function DetailBreadcrumbs({
  breadcrumbs,
  currentLabel,
}: {
  breadcrumbs: DetailPageShellBreadcrumb[];
  currentLabel: ReactNode;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 flex-1 items-center gap-xs text-base text-muted-foreground"
    >
      {breadcrumbs.map((crumb) => (
        <span
          key={`${String(crumb.label)}:${crumb.onClick ? "link" : "text"}`}
          className="contents"
        >
          {crumb.onClick ? (
            <button
              type="button"
              onClick={crumb.onClick}
              className="truncate text-foreground/80 hover:text-foreground"
            >
              {crumb.label}
            </button>
          ) : (
            <span className="truncate text-foreground/80">{crumb.label}</span>
          )}
          <span className="text-muted-foreground/60">/</span>
        </span>
      ))}
      <span className="truncate font-medium text-foreground">{currentLabel}</span>
      <ChevronDown className="ml-xs size-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
    </nav>
  );
}

function DetailTopbarActions({
  topbarAddon,
  showSidebar,
  hasSidebar,
  onFocusModeEnter,
  onSidebarToggle,
}: Omit<TopbarProps, "breadcrumbs" | "currentLabel" | "onBack">) {
  const { t } = useFeatureTranslation("feature.story");
  return (
    <div className="flex items-center gap-1" data-el="ed-topbar.actions">
      {topbarAddon}
      <IconButton label={t("shell.detail.focusMode")} onClick={onFocusModeEnter}>
        <Maximize className="size-3.5" />
      </IconButton>
      {hasSidebar ? (
        <IconButton
          label={showSidebar ? t("shell.detail.sidebarClose") : t("shell.detail.sidebarOpen")}
          onClick={onSidebarToggle}
        >
          {showSidebar ? (
            <PanelRightClose className="size-3.5" />
          ) : (
            <PanelRightOpen className="size-3.5" />
          )}
        </IconButton>
      ) : null}
      <IconButton label={t("shell.detail.share")}>
        <Share2 className="size-3.5" />
      </IconButton>
      <IconButton label={t("shell.detail.more")}>
        <MoreHorizontal className="size-3.5" />
      </IconButton>
    </div>
  );
}

function IconButton({
  label,
  title,
  className,
  onClick,
  children,
}: {
  label: string;
  title?: string;
  className?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      aria-label={label}
      title={title ?? label}
      className={cn(
        "size-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {children}
    </Button>
  );
}

function FocusExitButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className="fixed right-4 top-4 z-50 size-10 rounded-full bg-muted hover:bg-muted"
    >
      <Minimize className="size-3.5 text-foreground/40" />
    </Button>
  );
}

function DetailCanvas({
  isFocusMode,
  showSidebar,
  hasSidebar,
  contentWidth,
  isLoading,
  editor,
  sidebar,
  focusAside,
}: CanvasProps) {
  return (
    <div
      data-el="ed-document-surface"
      className={cn(
        "mx-auto mt-2 grid w-full min-h-0 flex-1 gap-6 px-7 pb-7",
        getCanvasColumns({
          isFocusMode,
          showSidebar,
          hasSidebar,
          hasFocusAside: Boolean(focusAside),
          contentWidth,
        }),
      )}
    >
      <article
        data-el="ed-card"
        className={cn(
          "flex min-h-0 flex-col overflow-hidden",
          isFocusMode
            ? null
            : "rounded-[14px] border border-border-subtle bg-card shadow-[0_1px_0_rgba(31,29,24,0.02)]",
        )}
      >
        {editor}
      </article>
      {isFocusMode ? focusAside : null}
      {showSidebar && !isFocusMode && !isLoading && hasSidebar ? (
        <aside data-el="ed-rail" className="flex flex-col gap-4 overflow-y-auto py-2">
          {sidebar}
        </aside>
      ) : null}
    </div>
  );
}

function getCanvasColumns({
  isFocusMode,
  showSidebar,
  hasSidebar,
  hasFocusAside,
  contentWidth,
}: CanvasColumnsOptions) {
  if (contentWidth === "wide") {
    if (isFocusMode && hasFocusAside) return "max-w-[960px] grid-cols-[minmax(0,1fr)_120px]";
    if (isFocusMode) return "max-w-[960px] grid-cols-1";
    if (showSidebar && hasSidebar) return "max-w-[1120px] grid-cols-[minmax(0,1fr)_280px]";
    return "max-w-[1120px] grid-cols-1";
  }

  if (isFocusMode && hasFocusAside) return "max-w-[920px] grid-cols-[minmax(0,720px)_120px]";
  if (isFocusMode) return "max-w-[776px] grid-cols-1";
  if (showSidebar && hasSidebar) return "max-w-[1080px] grid-cols-[minmax(0,720px)_280px]";
  return "max-w-[776px] grid-cols-1";
}
