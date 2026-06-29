import { useFeatureTranslation } from "@repo/core/i18n";
import { EntityTable, NameCell } from "@repo/ui/components/entity-table";
import { useNavigate, useParams } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { QuietLoadingIndicator } from "@/components/app-loading";
import { CreateEntityDialog } from "../components/create-entity-dialog";
import { EntityDetailPage } from "./entity-detail-page";
import type { EntityKind } from "./entity-list-view";
import { StorySplitDetailShell, StorySplitRailSearch } from "./story-split-detail-shell";

interface EntitySplitListPageProps {
  entity: EntityKind;
  projectId: string;
  data: unknown[];
  isLoading: boolean;
  onCreate: (input: { name: string; description: string }) => void;
  isCreating: boolean;
}

interface EntitySplitRow {
  id: string;
  num: number;
  name: string;
  status: string;
}

interface NormalizedEntitySplitRow extends Omit<EntitySplitRow, "num"> {
  orderTime: number | null;
  originalIndex: number;
}

function buildRailColumns(headerName: string): ColumnDef<EntitySplitRow>[] {
  return [
    {
      id: "name",
      header: headerName,
      cell: ({ row }) => (
        <NameCell
          num={row.original.num}
          title={row.original.name}
          depth={row.depth}
          canExpand={false}
          expanded={false}
          onToggle={() => undefined}
          showSequence={false}
        />
      ),
    },
  ];
}

const ENTITY_DETAIL_PATHS: Record<EntityKind, (projectId: string, entityId: string) => string> = {
  world: (projectId, entityId) => `/p/${projectId}/lore/worlds/${entityId}`,
  character: (projectId, entityId) => `/p/${projectId}/lore/characters/${entityId}`,
  location: (projectId, entityId) => `/p/${projectId}/lore/locations/${entityId}`,
  faction: (projectId, entityId) => `/p/${projectId}/lore/factions/${entityId}`,
  codex: (projectId, entityId) => `/p/${projectId}/lore/codex/${entityId}`,
};

export function EntitySplitListPage({
  entity,
  projectId,
  data,
  isLoading,
  onCreate,
  isCreating,
}: EntitySplitListPageProps) {
  const { t } = useFeatureTranslation("feature.story");
  const navigate = useNavigate();
  const routeParams = useParams({ strict: false }) as { entityId?: string };
  const [search, setSearch] = useState("");
  const routeSelectedId = routeParams.entityId ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(routeSelectedId);
  const [createOpen, setCreateOpen] = useState(false);
  const rows = normalizeRows(data, t("entity.split.fallbackName"));
  const railColumns = useMemo(() => buildRailColumns(t("entity.split.rail.columnName")), [t]);
  const filteredRows = filterRowsBySearch(rows, search);
  const routeRow = routeSelectedId
    ? (filteredRows.find((row) => row.id === routeSelectedId) ??
      rows.find((row) => row.id === routeSelectedId))
    : null;
  const selectedRow =
    (routeSelectedId
      ? rows.find((row) => row.id === selectedId)
      : filteredRows.find((row) => row.id === selectedId)) ??
    filteredRows[0] ??
    null;

  useEffect(() => {
    if (!selectedRow) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (selectedRow.id !== selectedId) setSelectedId(selectedRow.id);
  }, [selectedId, selectedRow]);

  useEffect(() => {
    if (routeRow && routeSelectedId !== selectedId) {
      setSelectedId(routeSelectedId);
    }
  }, [routeRow, routeSelectedId, selectedId]);

  useEffect(() => {
    if (!selectedRow) return;
    if (!routeSelectedId) return;
    if (routeRow) return;
    if (selectedRow.id === routeSelectedId) return;
    void navigate({
      to: ENTITY_DETAIL_PATHS[entity](projectId, selectedRow.id),
      replace: true,
    });
  }, [entity, navigate, projectId, routeRow, routeSelectedId, selectedRow]);

  if (isLoading) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <StorySplitDetailShell
          rail={
            <>
              <StorySplitRailSearch value={search} onChange={setSearch} />
              <QuietLoadingIndicator
                className="px-7 py-3 text-xs"
                label={t("entity.split.rail.loading")}
              />
            </>
          }
          detail={null}
        />
      </div>
    );
  }

  const handleCreate = (input: { name: string; description: string }) => {
    onCreate(input);
    setCreateOpen(false);
  };

  const handleRowClick = (id: string) => {
    void navigate({ to: ENTITY_DETAIL_PATHS[entity](projectId, id) });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <StorySplitDetailShell
        rail={
          <>
            <StorySplitRailSearch value={search} onChange={setSearch} />
            <EntitySplitRail
              rows={filteredRows}
              columns={railColumns}
              onRowClick={handleRowClick}
              onAdd={() => setCreateOpen(true)}
              addLabel={t("entity.split.rail.add")}
            />
          </>
        }
        detail={
          selectedRow ? (
            <EntityDetailPage
              entityType={entity}
              projectId={projectId}
              entityId={selectedRow.id}
              embedded
            />
          ) : null
        }
      />
      <CreateEntityDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        entityType={entity}
        onSubmit={handleCreate}
        isLoading={isCreating}
      />
    </div>
  );
}

function EntitySplitRail({
  rows,
  columns,
  onRowClick,
  onAdd,
  addLabel,
}: {
  rows: EntitySplitRow[];
  columns: ColumnDef<EntitySplitRow>[];
  onRowClick: (id: string) => void;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <EntityTable<EntitySplitRow>
      data={rows}
      columns={columns}
      gridTemplate="minmax(0,1fr)"
      onRowClick={(row) => onRowClick(row.id)}
      onAddRow={onAdd}
      addLabel={addLabel}
      rowHeight={34}
      showHeader={false}
    />
  );
}

function normalizeRows(raw: unknown[], fallbackName: string): EntitySplitRow[] {
  return raw
    .map((item, index): NormalizedEntitySplitRow => {
      const it = item as Record<string, unknown>;
      return {
        id: String(it.id ?? ""),
        name: String(it.name ?? it.title ?? fallbackName),
        status: String(it.status ?? "draft").toLowerCase(),
        orderTime: getEntityOrderTime(it),
        originalIndex: index,
      };
    })
    .sort(compareStackedPageOrder)
    .map(({ id, name, status }, index) => ({
      id,
      num: index + 1,
      name,
      status,
    }));
}

function compareStackedPageOrder(a: NormalizedEntitySplitRow, b: NormalizedEntitySplitRow): number {
  if (a.orderTime !== null && b.orderTime !== null && a.orderTime !== b.orderTime) {
    return a.orderTime - b.orderTime;
  }
  if (a.orderTime !== null && b.orderTime === null) return -1;
  if (a.orderTime === null && b.orderTime !== null) return 1;
  return a.originalIndex - b.originalIndex;
}

function getEntityOrderTime(item: Record<string, unknown>): number | null {
  for (const key of ["createdAt", "updatedAt"]) {
    const value = item[key];
    if (typeof value !== "string") continue;
    const time = Date.parse(value);
    if (Number.isFinite(time)) return time;
  }
  return null;
}

function filterRowsBySearch(rows: EntitySplitRow[], search: string): EntitySplitRow[] {
  const query = search.trim().toLowerCase();
  if (!query) return rows;
  return rows.filter((row) => row.name.toLowerCase().includes(query));
}
