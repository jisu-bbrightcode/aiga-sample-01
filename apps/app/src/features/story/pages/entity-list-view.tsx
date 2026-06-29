/**
 * 공통 entity list 뷰. 세계/캐릭터/장소/세력/코덱스 페이지가 이 컴포넌트를
 * 얇은 래퍼로 감싸서 hook/라우트 세그먼트/라벨만 주입한다.
 *
 * - PageLayout: breadcrumb + 멤버 스택 + "+"
 * - EntitySubbar: 상태탭(전체/작성중/진행중/리뷰/완료) + count + query tools
 * - EntityTable: TanStack Table + react-virtual, 트리 확장 지원 (parentId)
 */

import { useFeatureTranslation } from "@repo/core/i18n";
import { EntitySubbar, type StatusTab, type ViewMode } from "@repo/ui/components/entity-subbar";
import {
  AssigneeStack,
  EntityTable,
  type EntityTag,
  NameCell,
  StatusPill,
  TagChip,
} from "@repo/ui/components/entity-table";
import { PageLayout } from "@repo/ui/components/page-layout";
import { Button } from "@repo/ui/shadcn/button";
import { useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { BookOpen, Calendar, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { CreateEntityDialog } from "../components/create-entity-dialog";
import { useStoryListViewSettings } from "../state/list-view-settings";
import {
  type StoryListSettingOption,
  type StoryListSettingProperty,
  StoryListSettingsPopover,
} from "./list-view-settings";

type TFn = (key: string, opts?: Record<string, unknown>) => string;

/* ═══════════════════════════════════════════════════════════════════
 * Entity config
 * ═══════════════════════════════════════════════════════════════════ */

export type EntityKind = "world" | "character" | "location" | "faction" | "codex";

interface EntityConfig {
  label: string;
  routeSegment: string;
  emptyTitle: string;
  emptyHint: string;
}

const ENTITY_ROUTE_SEGMENT: Record<EntityKind, string> = {
  world: "worlds",
  character: "characters",
  location: "locations",
  faction: "factions",
  codex: "codex",
};

function getEntityConfig(t: TFn, entity: EntityKind): EntityConfig {
  return {
    label: t(`entity.list.config.${entity}.label`),
    routeSegment: ENTITY_ROUTE_SEGMENT[entity],
    emptyTitle: t(`entity.list.config.${entity}.emptyTitle`),
    emptyHint: t(`entity.list.config.${entity}.emptyHint`),
  };
}

function getStatusTabs(t: TFn): StatusTab[] {
  return [
    { value: "all", label: t("entity.list.statusTabs.all") },
    { value: "draft", label: t("entity.list.statusTabs.draft") },
    { value: "progress", label: t("entity.list.statusTabs.progress") },
    { value: "review", label: t("entity.list.statusTabs.review") },
    { value: "done", label: t("entity.list.statusTabs.done") },
  ];
}

/* ═══════════════════════════════════════════════════════════════════
 * Row shape
 * ═══════════════════════════════════════════════════════════════════ */

interface EntityRow {
  id: string;
  num: number;
  name: string;
  status: string;
  updatedAt?: string | Date | null;
  due?: string | Date | null;
  tags?: EntityTag[];
  assignees?: Array<{ id: string; initial: string; color: string; name: string }>;
  parentId?: string | null;
  subRows?: EntityRow[];
}

type EntityPropertyId = "status" | "tags" | "due" | "updated" | "assignees";
type EntityColumnId = "name" | EntityPropertyId;

const ENTITY_LIST_PROPERTIES: StoryListSettingProperty<EntityPropertyId>[] = [
  { id: "status", labelKey: "list.settings.properties.status" },
  { id: "assignees", labelKey: "list.settings.properties.assignees" },
  { id: "due", labelKey: "list.settings.properties.due" },
  { id: "tags", labelKey: "list.settings.properties.tags" },
  { id: "updated", labelKey: "list.settings.properties.updated" },
];

const DEFAULT_VISIBLE_PROPERTIES: EntityPropertyId[] = [
  "status",
  "assignees",
  "due",
  "tags",
  "updated",
];

const ENTITY_COLUMN_WIDTH: Record<EntityColumnId, string> = {
  name: "minmax(360px,1fr)",
  status: "110px",
  assignees: "90px",
  due: "110px",
  tags: "200px",
  updated: "70px",
};

const GROUPING_OPTIONS: StoryListSettingOption[] = [
  { value: "none", labelKey: "list.settings.groupingOptions.none" },
  { value: "status", labelKey: "list.settings.groupingOptions.status" },
  { value: "assignees", labelKey: "list.settings.groupingOptions.assignees" },
];

const ORDERING_OPTIONS: StoryListSettingOption[] = [
  { value: "updated", labelKey: "list.settings.orderingOptions.updated" },
  { value: "due", labelKey: "list.settings.orderingOptions.due" },
  { value: "name", labelKey: "list.settings.orderingOptions.name" },
  { value: "status", labelKey: "list.settings.orderingOptions.status" },
];

const RECENT_OPTIONS: StoryListSettingOption[] = [
  { value: "1d", labelKey: "list.settings.recentOptions.1d" },
  { value: "7d", labelKey: "list.settings.recentOptions.7d" },
  { value: "30d", labelKey: "list.settings.recentOptions.30d" },
  { value: "all", labelKey: "list.settings.recentOptions.all" },
];

function normalizeRows(raw: unknown[], fallbackName: string): EntityRow[] {
  return raw.map((item, i) => {
    const it = item as Record<string, unknown>;
    return {
      id: String(it.id ?? ""),
      num: i + 1,
      name: String(it.name ?? it.title ?? fallbackName),
      status: String(it.status ?? "draft").toLowerCase(),
      updatedAt:
        (it.updatedAt as string | Date | null | undefined) ??
        (it.updated_at as string | Date | null | undefined) ??
        null,
      due: (it.dueAt as string | Date | null | undefined) ?? null,
      tags: [],
      assignees: [],
      parentId: (it.parentId as string | null | undefined) ?? null,
    };
  });
}

/* Relative time */
function relTime(value: string | Date | null | undefined, t: TFn): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return t("entity.list.relTime.justNow");
  if (diff < 3600) return t("entity.list.relTime.minutes", { count: Math.floor(diff / 60) });
  if (diff < 86_400) return t("entity.list.relTime.hours", { count: Math.floor(diff / 3600) });
  if (diff < 604_800) return t("entity.list.relTime.days", { count: Math.floor(diff / 86_400) });
  if (diff < 2_592_000) return t("entity.list.relTime.weeks", { count: Math.floor(diff / 604_800) });
  return t("entity.list.relTime.months", { count: Math.floor(diff / 2_592_000) });
}

function formatDue(due: string | Date | null | undefined, t: TFn): string {
  if (!due) return "—";
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return "—";
  return t("entity.list.formatDue", { month: d.getMonth() + 1, day: d.getDate() });
}

function daysSince(value: string | Date | null | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return Number.POSITIVE_INFINITY;
  return (Date.now() - d.getTime()) / 86_400_000;
}

function dueRank(value: string | Date | null | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? Number.POSITIVE_INFINITY : d.getTime();
}

function getRecentDays(recent: string): number {
  if (recent === "1d") return 1;
  if (recent === "7d") return 7;
  if (recent === "30d") return 30;
  return Number.POSITIVE_INFINITY;
}

function getConfiguredRows({
  rows,
  grouping,
  ordering,
  recent,
  showSubItems,
}: {
  rows: EntityRow[];
  grouping: string;
  ordering: string;
  recent: string;
  showSubItems: boolean;
}): EntityRow[] {
  const recentDays = getRecentDays(recent);
  return rows
    .filter((row) => daysSince(row.updatedAt) <= recentDays)
    .map((row) => ({
      ...row,
      subRows: showSubItems
        ? row.subRows?.filter((subRow) => daysSince(subRow.updatedAt) <= recentDays)
        : undefined,
    }))
    .sort((left, right) => {
      const groupCompare = compareByGrouping(left, right, grouping);
      if (groupCompare !== 0) return groupCompare;
      return compareByOrdering(left, right, ordering);
    });
}

function compareByGrouping(left: EntityRow, right: EntityRow, grouping: string) {
  if (grouping === "status") return left.status.localeCompare(right.status);
  if (grouping === "assignees") {
    const leftName = left.assignees?.[0]?.name ?? "";
    const rightName = right.assignees?.[0]?.name ?? "";
    return leftName.localeCompare(rightName);
  }
  return 0;
}

function compareByOrdering(left: EntityRow, right: EntityRow, ordering: string) {
  if (ordering === "updated") return daysSince(left.updatedAt) - daysSince(right.updatedAt);
  if (ordering === "due") return dueRank(left.due) - dueRank(right.due);
  if (ordering === "status") return left.status.localeCompare(right.status);
  return left.name.localeCompare(right.name);
}

function filterRowsByStatus(rows: EntityRow[], status: string): EntityRow[] {
  if (status === "all") return rows;
  if (status === "done") {
    return rows.filter((row) => row.status === "done" || row.status === "completed");
  }
  return rows.filter((row) => row.status === status);
}

/* ═══════════════════════════════════════════════════════════════════
 * Columns
 * ═══════════════════════════════════════════════════════════════════ */

function buildEntityColumnById(t: TFn): Record<EntityColumnId, ColumnDef<EntityRow>> {
  return {
    name: {
      id: "name",
      header: t("entity.list.columns.name"),
      cell: ({ row }) => (
        <NameCell
          num={row.original.num}
          title={row.original.name}
          depth={row.depth}
          canExpand={row.getCanExpand()}
          expanded={row.getIsExpanded()}
          onToggle={row.getToggleExpandedHandler()}
        />
      ),
    },
    status: {
      id: "status",
      header: t("entity.list.columns.status"),
      cell: ({ row }) => <StatusPill status={row.original.status} />,
    },
    tags: {
      id: "tags",
      header: t("entity.list.columns.tags"),
      cell: ({ row }) => {
        const tags = row.original.tags ?? [];
        if (tags.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <div className="flex items-center gap-1 overflow-hidden">
            {tags.map((tag) => (
              <TagChip key={tag.label} label={tag.label} color={tag.color} />
            ))}
          </div>
        );
      },
    },
    due: {
      id: "due",
      header: t("entity.list.columns.due"),
      cell: ({ row }) => {
        const due = row.original.due;
        if (!due) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <span className="inline-flex items-center gap-1 text-xs text-sidebar-foreground">
            <Calendar className="size-3.5 text-muted-foreground" />
            {formatDue(due, t)}
          </span>
        );
      },
    },
    updated: {
      id: "updated",
      header: t("entity.list.columns.updated"),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {relTime(row.original.updatedAt, t)}
        </span>
      ),
    },
    assignees: {
      id: "assignees",
      header: t("entity.list.columns.assignees"),
      cell: ({ row }) => <AssigneeStack assignees={row.original.assignees} />,
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════
 * View
 * ═══════════════════════════════════════════════════════════════════ */

export interface EntityListViewProps {
  entity: EntityKind;
  projectId: string;
  data: unknown[];
  isLoading: boolean;
  onCreate: (input: { name: string; description: string }) => void;
  isCreating: boolean;
}

export function EntityListView({
  entity,
  projectId,
  data,
  isLoading,
  onCreate,
  isCreating,
}: EntityListViewProps) {
  const { t } = useFeatureTranslation("feature.story");
  const config = useMemo(() => getEntityConfig(t, entity), [t, entity]);
  const statusTabs = useMemo(() => getStatusTabs(t), [t]);
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>("all");
  const [view, setView] = useState<ViewMode | null>("list");
  const [createOpen, setCreateOpen] = useState(false);
  const settings = useEntityListSettings(entity);

  const allRows = normalizeRows(data, t("entity.list.fallbackName"));
  const filtered = getConfiguredRows({
    rows: filterRowsByStatus(allRows, status),
    grouping: settings.grouping,
    ordering: settings.ordering,
    recent: settings.recent,
    showSubItems: settings.showSubItems,
  });
  const columnById = useMemo(() => buildEntityColumnById(t), [t]);
  const columns = [
    columnById.name,
    ...settings.visiblePropertyIds.map((propertyId) => columnById[propertyId]),
  ];
  const gridTemplate = [
    ENTITY_COLUMN_WIDTH.name,
    ...settings.visiblePropertyIds.map((propertyId) => ENTITY_COLUMN_WIDTH[propertyId]),
  ].join(" ");

  const handleCreate = (input: { name: string; description: string }) => {
    onCreate(input);
    setCreateOpen(false);
  };

  const handleRowClick = (row: EntityRow) => {
    navigate({ to: `/p/${projectId}/lore/${config.routeSegment}/${row.id}` });
  };

  return (
    <PageLayout
      crumbs={[{ label: t("entity.list.crumbs.lore") }, { label: config.label }]}
      onAdd={() => setCreateOpen(true)}
      addLabel={t("entity.list.add.new", { label: config.label })}
    >
      <EntityListSubbar
        count={filtered.length}
        settings={settings}
        statusTabs={statusTabs}
        status={status}
        onStatusChange={setStatus}
        viewMode={view}
        onViewModeChange={setView}
      />

      <EntityListBody
        allRows={allRows}
        filtered={filtered}
        columns={columns}
        config={config}
        gridTemplate={gridTemplate}
        isLoading={isLoading}
        onAdd={() => setCreateOpen(true)}
        onRowClick={handleRowClick}
        showSubItems={settings.showSubItems}
        addRowLabel={t("entity.list.add.row", { label: config.label })}
        emptyActionLabel={t("entity.list.empty.firstAction", { label: config.label })}
      />

      <CreateEntityDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        entityType={entity}
        onSubmit={handleCreate}
        isLoading={isCreating}
      />
    </PageLayout>
  );
}

function useEntityListSettings(entity: EntityKind) {
  const { settings, setGrouping, setOrdering, setRecent, setShowSubItems, setVisiblePropertyIds } =
    useStoryListViewSettings(`lore:${entity}`, {
      grouping: "status",
      ordering: "updated",
      recent: "all",
      showSubItems: true,
      visiblePropertyIds: DEFAULT_VISIBLE_PROPERTIES,
    });

  return {
    grouping: settings.grouping,
    ordering: settings.ordering,
    recent: settings.recent,
    setGrouping,
    setOrdering,
    setRecent,
    setShowSubItems,
    setVisiblePropertyIds: (next: EntityPropertyId[]) => setVisiblePropertyIds(next),
    showSubItems: settings.showSubItems,
    visiblePropertyIds: settings.visiblePropertyIds as EntityPropertyId[],
  };
}

function EntityListSubbar({
  count,
  settings,
  statusTabs,
  status,
  onStatusChange,
  viewMode,
  onViewModeChange,
}: {
  count: number;
  settings: ReturnType<typeof useEntityListSettings>;
  statusTabs: StatusTab[];
  status: string;
  onStatusChange: (value: string) => void;
  viewMode: ViewMode | null;
  onViewModeChange: (mode: ViewMode | null) => void;
}) {
  return (
    <EntitySubbar
      statusTabs={statusTabs}
      status={status}
      onStatusChange={onStatusChange}
      count={count}
      viewMode={viewMode}
      onViewModeChange={onViewModeChange}
      viewTabs={["list", "board"]}
      allowViewModeOff
      settingsSlot={
        <EntityListSettingsSlot
          grouping={settings.grouping}
          onGroupingChange={settings.setGrouping}
          ordering={settings.ordering}
          onOrderingChange={settings.setOrdering}
          recent={settings.recent}
          onRecentChange={settings.setRecent}
          visiblePropertyIds={settings.visiblePropertyIds}
          onVisiblePropertyIdsChange={settings.setVisiblePropertyIds}
          showSubItems={settings.showSubItems}
          onShowSubItemsChange={settings.setShowSubItems}
        />
      }
    />
  );
}

function EntityListSettingsSlot({
  grouping,
  onGroupingChange,
  ordering,
  onOrderingChange,
  recent,
  onRecentChange,
  visiblePropertyIds,
  onVisiblePropertyIdsChange,
  showSubItems,
  onShowSubItemsChange,
}: {
  grouping: string;
  onGroupingChange: (value: string) => void;
  ordering: string;
  onOrderingChange: (value: string) => void;
  recent: string;
  onRecentChange: (value: string) => void;
  visiblePropertyIds: EntityPropertyId[];
  onVisiblePropertyIdsChange: (next: EntityPropertyId[]) => void;
  showSubItems: boolean;
  onShowSubItemsChange: (checked: boolean) => void;
}) {
  return (
    <StoryListSettingsPopover
      groupingValue={grouping}
      groupingOptions={GROUPING_OPTIONS}
      onGroupingChange={onGroupingChange}
      orderingValue={ordering}
      orderingOptions={ORDERING_OPTIONS}
      onOrderingChange={onOrderingChange}
      recentValue={recent}
      recentOptions={RECENT_OPTIONS}
      onRecentChange={onRecentChange}
      properties={ENTITY_LIST_PROPERTIES}
      visiblePropertyIds={visiblePropertyIds}
      onVisiblePropertyIdsChange={onVisiblePropertyIdsChange}
      showSubItems={showSubItems}
      onShowSubItemsChange={onShowSubItemsChange}
    />
  );
}

function EntityListBody({
  allRows,
  filtered,
  columns,
  config,
  gridTemplate,
  isLoading,
  onAdd,
  onRowClick,
  showSubItems,
  addRowLabel,
  emptyActionLabel,
}: {
  allRows: EntityRow[];
  filtered: EntityRow[];
  columns: ColumnDef<EntityRow>[];
  config: EntityConfig;
  gridTemplate: string;
  isLoading: boolean;
  onAdd: () => void;
  onRowClick: (row: EntityRow) => void;
  showSubItems: boolean;
  addRowLabel: string;
  emptyActionLabel: string;
}) {
  if (isLoading) return null;
  if (allRows.length === 0) {
    return (
      <EmptyState
        title={config.emptyTitle}
        hint={config.emptyHint}
        label={emptyActionLabel}
        onAdd={onAdd}
      />
    );
  }
  return (
    <EntityTable<EntityRow>
      data={filtered}
      columns={columns}
      gridTemplate={gridTemplate}
      onRowClick={onRowClick}
      onAddRow={onAdd}
      addLabel={addRowLabel}
      getSubRows={(row) => (showSubItems ? row.subRows : undefined)}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * Empty state
 * ═══════════════════════════════════════════════════════════════════ */

interface EmptyStateProps {
  title: string;
  hint: string;
  label: string;
  onAdd: () => void;
}

function EmptyState({ title, hint, label, onAdd }: EmptyStateProps) {
  return (
    <div className="flex h-[300px] flex-col items-center justify-center gap-3">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
        <BookOpen className="size-6 text-muted-foreground" />
      </div>
      <div className="text-center">
        <p className="text-base font-medium text-sidebar-foreground">{title}</p>
        <p className="mt-1 text-base text-muted-foreground">{hint}</p>
      </div>
      <Button size="sm" className="mt-2 gap-1.5" onClick={onAdd}>
        <Plus className="size-3.5" /> {label}
      </Button>
    </div>
  );
}
