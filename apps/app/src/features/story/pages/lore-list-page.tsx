/**
 * Lore list page: type tabs + search + clean list rows.
 * Paperclip reference: routines list — minimal, scannable rows.
 */

import { useFeatureTranslation } from "@repo/core/i18n";
import {
  useAllDomainCreates,
  useCharacters,
  useCodexEntries,
  useFactions,
  useLocations,
  useWorlds,
} from "@repo/data/hooks";
import { PageLayout } from "@repo/ui/components/page-layout";
import { Badge } from "@repo/ui/shadcn/badge";
import { Button } from "@repo/ui/shadcn/button";
import { Input } from "@repo/ui/shadcn/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/shadcn/select";
import { useNavigate, useParams } from "@tanstack/react-router";
import { BookOpen, Plus, Search } from "lucide-react";
import { useState } from "react";
import { CreateEntityDialog } from "../components/create-entity-dialog";

type TFn = (key: string, options?: Record<string, unknown>) => string;

type EntityType = "all" | "world" | "character" | "location" | "faction" | "codex";
type SortBy = "latest" | "name" | "modified";

export function LoreListPage() {
  const { t } = useFeatureTranslation("feature.story");
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const navigate = useNavigate();

  const [filterType, setFilterType] = useState<EntityType>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("latest");
  const [createDialogType, setCreateDialogType] = useState<EntityType | null>(null);

  const worldsQuery = useWorlds(projectId, search || undefined, sortBy);
  const charactersQuery = useCharacters(projectId, search || undefined, sortBy);
  const locationsQuery = useLocations(projectId, search || undefined, sortBy);
  const factionsQuery = useFactions(projectId, search || undefined, sortBy);
  const codexQuery = useCodexEntries(projectId, search || undefined, sortBy);

  const creates = useAllDomainCreates();

  const isLoading =
    worldsQuery.isLoading ||
    charactersQuery.isLoading ||
    locationsQuery.isLoading ||
    factionsQuery.isLoading ||
    codexQuery.isLoading;

  const allEntities = buildEntityList(
    filterType,
    worldsQuery.data,
    charactersQuery.data,
    locationsQuery.data,
    factionsQuery.data,
    codexQuery.data,
  );

  const handleEntityClick = (entityType: string, entityId: string) => {
    const routeSegment = ENTITY_TYPE_TO_ROUTE[entityType] ?? entityType;
    navigate({ to: `/p/${projectId}/lore/${routeSegment}/${entityId}` });
  };

  const handleCreate = (data: { name: string; description: string }) => {
    if (!createDialogType || createDialogType === "all") return;
    const input = {
      projectId,
      name: data.name,
      description: data.description,
    };
    const mutationMap = {
      world: creates.worlds,
      character: creates.characters,
      location: creates.locations,
      faction: creates.factions,
      codex: creates.codex,
    };
    mutationMap[createDialogType].mutate(input as never, {
      onSuccess: () => setCreateDialogType(null),
    });
  };

  const activeCreateType = createDialogType === "all" ? "world" : createDialogType;
  const isCreating = Object.values(creates).some((m) => m.isPending);

  const entityLabels = getEntityLabels(t);
  const filterTabs = getFilterTabs(t);

  return (
    <PageLayout
      crumbs={[
        { label: t("lore.crumbs.world") },
        { label: entityLabels[filterType] ?? t("lore.filter.all") },
      ]}
      onAdd={() => setCreateDialogType(filterType === "all" ? "world" : filterType)}
      addLabel={t("lore.list.addNew")}
      actions={
        <span className="text-xs tabular-nums text-muted-foreground">
          {t("lore.list.count", { count: allEntities.length })}
        </span>
      }
    >
      {/* Filter + Search subbar */}
      <div className="flex h-10 shrink-0 items-center gap-sm border-b border-border-subtle px-7">
        <div data-el="lore.type-tabs" className="flex items-center gap-0.5">
          {filterTabs.map((tab) => (
            <Button
              key={tab.value}
              variant="ghost"
              size="sm"
              onClick={() => setFilterType(tab.value)}
              className={
                filterType === tab.value
                  ? "h-7 rounded-md bg-secondary px-2.5 text-sm font-medium text-foreground"
                  : "h-7 rounded-md px-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              }
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-sm">
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              data-el="lore.search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("lore.search.placeholder")}
              className="h-7 w-48 pl-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Escape") setSearch("");
              }}
            />
          </div>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger data-el="lore.sort-select" className="h-7 w-24 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">{t("lore.sort.latest")}</SelectItem>
              <SelectItem value="name">{t("lore.sort.name")}</SelectItem>
              <SelectItem value="modified">{t("lore.sort.modified")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Entity List */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? null : allEntities.length > 0 ? (
          <div className="flex flex-col">
            {allEntities.map((entity) => (
              <EntityRow
                key={entity.id}
                entity={entity}
                entityLabels={entityLabels}
                onClick={() => handleEntityClick(entity.entityType, entity.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            filterType={filterType}
            entityLabels={entityLabels}
            t={t}
            onCreateClick={() => setCreateDialogType(filterType === "all" ? "world" : filterType)}
          />
        )}
      </div>

      {/* Create Dialog */}
      {activeCreateType ? (
        <CreateEntityDialog
          open={!!createDialogType}
          onOpenChange={(open) => {
            if (!open) setCreateDialogType(null);
          }}
          entityType={activeCreateType}
          onSubmit={handleCreate}
          isLoading={isCreating}
        />
      ) : null}
    </PageLayout>
  );
}

/* Components */

interface EntityRowProps {
  entity: EntityListItem;
  entityLabels: Record<string, string>;
  onClick: () => void;
}

function EntityRow({ entity, entityLabels, onClick }: EntityRowProps) {
  return (
    <div
      data-el="lore.item-card"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      className="flex cursor-pointer items-center gap-3 border-b border-border px-6 py-3 transition-colors hover:bg-muted"
    >
      {/* Color dot */}
      <span
        className="inline-block size-2 shrink-0 rounded-full"
        style={{
          background: ENTITY_DOT_COLORS[entity.entityType] ?? "var(--muted-foreground)",
        }}
      />

      {/* Name */}
      <span className="min-w-0 truncate text-sm font-medium text-foreground">{entity.name}</span>

      {/* Type badge */}
      <Badge variant="secondary" className="shrink-0 text-xs font-normal">
        {entityLabels[entity.entityType]}
      </Badge>

      {/* Description (truncated) */}
      {entity.description ? (
        <span className="hidden min-w-0 flex-1 truncate text-sm text-muted-foreground md:block">
          {entity.description}
        </span>
      ) : (
        <span className="flex-1" />
      )}

      {/* Date */}
      {entity.updatedAt ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatDate(entity.updatedAt)}
        </span>
      ) : null}
    </div>
  );
}

interface EmptyStateProps {
  filterType: EntityType;
  entityLabels: Record<string, string>;
  t: TFn;
  onCreateClick: () => void;
}

function EmptyState({ filterType, entityLabels, t, onCreateClick }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20">
      <div className="flex size-12 items-center justify-center rounded-full bg-secondary">
        <BookOpen size={20} className="text-muted-foreground" />
      </div>
      <div className="text-center">
        <h3 className="text-sm font-medium text-foreground">
          {filterType === "all"
            ? t("lore.empty.title.all")
            : t("lore.empty.title.type", { label: entityLabels[filterType] ?? "" })}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("lore.empty.hint")}</p>
      </div>
      <Button size="sm" className="mt-2" onClick={onCreateClick}>
        <Plus size={14} className="mr-1" />
        {t("lore.empty.cta", {
          label: filterType === "all" ? t("lore.empty.itemFallback") : (entityLabels[filterType] ?? ""),
        })}
      </Button>
    </div>
  );
}

/* Constants */

function getFilterTabs(t: TFn): { value: EntityType; label: string }[] {
  return [
    { value: "all", label: t("lore.filter.all") },
    { value: "world", label: t("lore.filter.world") },
    { value: "character", label: t("lore.filter.character") },
    { value: "location", label: t("lore.filter.location") },
    { value: "faction", label: t("lore.filter.faction") },
    { value: "codex", label: t("lore.filter.codex") },
  ];
}

function getEntityLabels(t: TFn): Record<string, string> {
  return {
    world: t("entity.card.type.world"),
    character: t("entity.card.type.character"),
    location: t("entity.card.type.location"),
    faction: t("entity.card.type.faction"),
    codex: t("entity.card.type.codex"),
  };
}

const ENTITY_TYPE_TO_ROUTE: Record<string, string> = {
  world: "worlds",
  character: "characters",
  location: "locations",
  faction: "factions",
  codex: "codex",
};

const ENTITY_DOT_COLORS: Record<string, string> = {
  world: "var(--entity-world)",
  character: "var(--entity-character)",
  location: "var(--entity-location)",
  faction: "var(--entity-faction)",
  codex: "var(--entity-codex)",
};

/* Types */

interface EntityListItem {
  id: string;
  name: string;
  description?: string | null;
  entityType: "world" | "character" | "location" | "faction" | "codex";
  updatedAt?: string | null;
}

/* Helpers */

function buildEntityList(
  filterType: EntityType,
  worlds?: Array<{
    id: string;
    name: string;
    description?: string | null;
    updatedAt?: string | Date | null;
  }>,
  characters?: Array<{
    id: string;
    name: string;
    description?: string | null;
    updatedAt?: string | Date | null;
  }>,
  locations?: Array<{
    id: string;
    name: string;
    description?: string | null;
    updatedAt?: string | Date | null;
  }>,
  factions?: Array<{
    id: string;
    name: string;
    description?: string | null;
    updatedAt?: string | Date | null;
  }>,
  codex?: Array<{
    id: string;
    name: string;
    description?: string | null;
    updatedAt?: string | Date | null;
  }>,
): EntityListItem[] {
  const result: EntityListItem[] = [];

  const mapItems = (
    items:
      | Array<{
          id: string;
          name: string;
          description?: string | null;
          updatedAt?: string | Date | null;
        }>
      | undefined,
    type: EntityListItem["entityType"],
  ) => {
    if (!items) return;
    for (const item of items) {
      result.push({
        id: item.id,
        name: item.name,
        description: item.description,
        entityType: type,
        updatedAt: item.updatedAt ? String(item.updatedAt) : null,
      });
    }
  };

  if (filterType === "all" || filterType === "world") mapItems(worlds, "world");
  if (filterType === "all" || filterType === "character") mapItems(characters, "character");
  if (filterType === "all" || filterType === "location") mapItems(locations, "location");
  if (filterType === "all" || filterType === "faction") mapItems(factions, "faction");
  if (filterType === "all" || filterType === "codex") mapItems(codex, "codex");

  return result;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}
