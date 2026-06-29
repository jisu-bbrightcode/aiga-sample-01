/**
 * TanStack Table (headless) + react-virtual 기반 공통 EntityTable.
 * 트리 (parentId 기반) 확장 지원, flat 데이터도 수용.
 * 각 페이지(world/character/location/faction)가 domain-specific columns 만
 * 주입하고 데이터 hook 결과를 그대로 넘기면 됨.
 */

import {
  type ColumnDef,
  type ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  type Row,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronRight, Copy, Plus } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { Button } from "../_shadcn/button";
import { LIST_ROW_HEIGHT } from "../lib/list-row";
import { cn } from "../lib/utils";

/* ═══════════════════════════════════════════════════════════════════
 * Status pill
 * ═══════════════════════════════════════════════════════════════════ */

export type EntityStatus =
  | "draft"
  | "writing"
  | "progress"
  | "review"
  | "done"
  | "blocked"
  | "completed";

const STATUS_META: Record<EntityStatus, { label: string; bg: string; fg: string; dot: string }> = {
  draft: { label: "초안", bg: "rgba(142,136,118,0.15)", fg: "#6B6557", dot: "#8E8876" },
  writing: { label: "작성중", bg: "rgba(201,168,97,0.18)", fg: "#8A6F2E", dot: "#C9A861" },
  progress: { label: "진행중", bg: "rgba(90,122,143,0.20)", fg: "#3E5868", dot: "#5A7A8F" },
  review: { label: "리뷰", bg: "rgba(139,92,246,0.15)", fg: "#6B4FC0", dot: "#8B5CF6" },
  done: { label: "완료", bg: "rgba(79,122,62,0.18)", fg: "#3E6030", dot: "#4F7A3E" },
  completed: { label: "완료", bg: "rgba(79,122,62,0.18)", fg: "#3E6030", dot: "#4F7A3E" },
  blocked: { label: "보류", bg: "rgba(180,65,65,0.15)", fg: "#7A2828", dot: "#B44141" },
};

export function StatusPill({ status }: { status: string | null | undefined }) {
  const key = (status ?? "draft") as EntityStatus;
  const meta = STATUS_META[key] ?? STATUS_META.draft;
  return (
    <span
      data-el="status-pill"
      className="inline-flex h-5 items-center rounded-md px-2 text-sm font-medium leading-none"
      style={{ background: meta.bg, color: meta.fg }}
    >
      {meta.label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * Tag chip
 * ═══════════════════════════════════════════════════════════════════ */

export interface EntityTag {
  label: string;
  color?: string;
}

export function TagChip({ label, color }: EntityTag) {
  return (
    <span
      data-el="tag-chip"
      className="inline-flex h-5 items-center gap-1.5 rounded-md bg-[color:var(--surface-active,rgba(31,29,24,0.06))] px-2 text-sm font-medium leading-none text-sidebar-foreground/75"
      style={color ? { background: `${color}22`, color } : undefined}
    >
      {label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * Assignee avatar stack
 * ═══════════════════════════════════════════════════════════════════ */

export interface Assignee {
  id: string;
  initial: string;
  color: string;
  name: string;
}

export function AssigneeStack({ assignees }: { assignees: Assignee[] | undefined }) {
  if (!assignees || assignees.length === 0) {
    return (
      <div className="flex size-5 items-center justify-center rounded-full border border-dashed border-border text-sm text-muted-foreground">
        +
      </div>
    );
  }
  const shown = assignees.slice(0, 3);
  const more = assignees.length - shown.length;
  return (
    <div data-el="ava-stack" className="flex">
      {shown.map((a, i) => (
        <div
          key={a.id}
          title={a.name}
          className="-ml-1.5 flex size-5 items-center justify-center rounded-full border-[1.5px] border-background text-xs font-semibold text-white first:ml-0"
          style={{ background: a.color, zIndex: shown.length - i }}
          aria-label={a.name}
        >
          {a.initial}
        </div>
      ))}
      {more > 0 ? (
        <div className="-ml-1.5 flex size-5 items-center justify-center rounded-full border-[1.5px] border-background bg-muted text-xs font-semibold text-muted-foreground">
          +{more}
        </div>
      ) : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * Id badge + caret + indent
 * ═══════════════════════════════════════════════════════════════════ */

interface NameCellProps {
  num: number;
  code?: string;
  title: string;
  depth: number;
  canExpand: boolean;
  expanded: boolean;
  onToggle: () => void;
  onCopyId?: (code: string) => void;
  showSequence?: boolean;
}

export function NameCell({
  num,
  code,
  title,
  depth,
  canExpand,
  expanded,
  onToggle,
  onCopyId,
  showSequence = true,
}: NameCellProps) {
  const titleStartsWithHash = title.trimStart().startsWith("#");

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {/* indent guides — depth 가 0 이면 0px */}
      {depth > 0 ? (
        <div style={{ width: `${depth * 16}px` }} className="shrink-0 self-stretch" />
      ) : null}

      {/* caret — 펼칠 수 있는 row 에만 노출. 단순 row 는 자리 자체 없음 */}
      {canExpand ? (
        <Button
          type="button"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="grid size-4.5 shrink-0 place-items-center rounded p-0 text-muted-foreground transition-colors hover:bg-[rgba(31,29,24,0.06)]"
          aria-label={expanded ? "접기" : "펼치기"}
        >
          <ChevronRight
            className={cn("size-3.5 transition-transform", expanded && "rotate-90")}
            strokeWidth={2}
          />
        </Button>
      ) : null}

      {showSequence || (code && onCopyId) ? (
        <span
          className="inline-flex shrink-0 items-center gap-1 font-mono text-sm tracking-[0.02em] text-muted-foreground"
          title={code}
        >
          {showSequence ? <span>#{num}</span> : null}
          {code && onCopyId ? (
            <Button
              type="button"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onCopyId(code);
              }}
              className="grid size-3.5 place-items-center rounded p-0 text-muted-foreground opacity-0 transition-opacity hover:bg-[rgba(31,29,24,0.06)] group-hover/row:opacity-100"
              aria-label="ID 복사"
            >
              <Copy className="size-2.5" />
            </Button>
          ) : null}
        </span>
      ) : null}

      {/* title */}
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sidebar-foreground",
          titleStartsWithHash ? "text-lg font-medium" : "text-base font-normal",
        )}
      >
        {title}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * EntityTable
 * ═══════════════════════════════════════════════════════════════════ */

export interface EntityTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  /** grid-template-columns for col-head + row */
  gridTemplate?: string;
  onRowClick?: (row: T) => void;
  onAddRow?: () => void;
  addLabel?: string;
  /** tree children accessor. 없으면 flat 렌더. */
  getSubRows?: (row: T) => T[] | undefined;
  rowHeight?: number;
  emptyState?: ReactNode;
  rowClassName?: string;
  showHeader?: boolean;
  /** 현재 행 개수를 context 로 넘겨 NameCell 에서 #N 번호 부여. */
}

interface RenderedVirtualRow {
  index: number;
  start: number;
}

function getRenderedVirtualRows(
  virtualItems: RenderedVirtualRow[],
  rowCount: number,
  rowHeight: number,
): RenderedVirtualRow[] {
  if (virtualItems.length > 0) return virtualItems;
  return Array.from({ length: rowCount }, (_, index) => ({
    index,
    start: index * rowHeight,
  }));
}

export function EntityTable<T>({
  data,
  columns,
  gridTemplate = "minmax(360px,1fr) 110px 200px 110px 70px 90px",
  onRowClick,
  onAddRow,
  addLabel = "새 항목 추가",
  getSubRows,
  rowHeight = LIST_ROW_HEIGHT,
  emptyState,
  rowClassName,
  showHeader = true,
}: EntityTableProps<T>) {
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const table = useReactTable<T>({
    data,
    columns,
    state: { expanded },
    onExpandedChange: setExpanded,
    getSubRows,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });
  const renderedItems = getRenderedVirtualRows(
    virtualizer.getVirtualItems(),
    rows.length,
    rowHeight,
  );
  const totalRowHeight = Math.max(virtualizer.getTotalSize(), rows.length * rowHeight);

  const cssVar = { "--cols": gridTemplate } as React.CSSProperties;

  if (data.length === 0 && emptyState) {
    return <div className="min-h-0 flex-1 overflow-y-auto">{emptyState}</div>;
  }

  return (
    // 좌우 padding 8px(=px-2) — split rail에서 제목 목록이 더 넓게 보이도록 맞춘다.
    <div className="flex min-h-0 flex-1 flex-col px-2" data-el="entity-table">
      {showHeader ? (
        <div
          data-el="entity-table.col-head"
          style={{ gridTemplateColumns: "var(--cols)", ...cssVar }}
          className="sticky top-0 z-10 grid h-7 items-center gap-3 bg-background px-3 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground"
        >
          {table.getHeaderGroups()[0]?.headers.map((h, idx) => (
            <div key={h.id} className={cn("truncate", idx === columns.length - 1 && "text-right")}>
              {flexRender(h.column.columnDef.header, h.getContext())}
            </div>
          ))}
        </div>
      ) : null}

      {/* Virtualized rows */}
      <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto">
        <div style={{ height: totalRowHeight }} className="relative">
          {renderedItems.map((vi) => {
            const row = rows[vi.index];
            if (!row) return null;
            return (
              <EntityRow
                key={row.id}
                row={row}
                cssVar={cssVar}
                height={rowHeight}
                top={vi.start}
                onRowClick={onRowClick}
                lastColIndex={columns.length - 1}
                rowClassName={rowClassName}
              />
            );
          })}
        </div>

        {/* Add row */}
        {onAddRow ? <EntityAddRowButton label={addLabel} onClick={onAddRow} /> : null}
      </div>
    </div>
  );
}

function EntityAddRowButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      data-el="entity-table.add-row"
      className="flex h-8 w-full items-center justify-start gap-1.5 px-3 text-base text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Plus className="size-3.5" /> {label}
    </Button>
  );
}

interface EntityRowProps<T> {
  row: Row<T>;
  cssVar: React.CSSProperties;
  height: number;
  top: number;
  onRowClick?: (row: T) => void;
  lastColIndex: number;
  rowClassName?: string;
}

function EntityRow<T>({
  row,
  cssVar,
  height,
  top,
  onRowClick,
  lastColIndex,
  rowClassName,
}: EntityRowProps<T>) {
  return (
    <div
      data-el="entity-table.row"
      style={{
        gridTemplateColumns: "var(--cols)",
        ...cssVar,
        position: "absolute",
        top,
        height,
        left: 0,
        right: 0,
      }}
      className={cn(
        "group/row grid cursor-pointer items-center gap-3 rounded-md px-3 text-base text-sidebar-foreground transition-colors hover:bg-muted hover:text-foreground",
        rowClassName,
      )}
      onClick={() => onRowClick?.(row.original)}
    >
      {row.getVisibleCells().map((cell, i) => (
        <div
          key={cell.id}
          className={cn("min-w-0 truncate", i === lastColIndex && "justify-self-end")}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </div>
      ))}
    </div>
  );
}
