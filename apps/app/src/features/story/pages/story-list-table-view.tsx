import { EntitySubbar, type StatusTab, type ViewMode } from "@repo/ui/components/entity-subbar";
import { EntityTable } from "@repo/ui/components/entity-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useStoryListViewSettings } from "../state/list-view-settings";
import {
  type StoryListSettingOption,
  type StoryListSettingProperty,
  StoryListSettingsPopover,
} from "./list-view-settings";

export interface StoryListColumn<Row, ColumnId extends string> {
  id: ColumnId;
  column: ColumnDef<Row>;
  width: string;
  labelKey: string;
  defaultVisible?: boolean;
  groupCompare?: (left: Row, right: Row) => number;
  groupLabelKey?: string;
  orderCompare?: (left: Row, right: Row) => number;
  orderLabelKey?: string;
}

type GroupingValue<ColumnId extends string> = ColumnId | "none";

export interface StoryListTableViewProps<Row, FilterValue extends string, ColumnId extends string> {
  statusTabs: StatusTab<FilterValue>[];
  status: FilterValue;
  onStatusChange: (value: FilterValue) => void;
  settingsId: string;
  rows: Row[];
  isLoading: boolean;
  isEmpty: boolean;
  emptyState: React.ReactNode;
  columns: StoryListColumn<Row, ColumnId>[];
  fixedColumnId: ColumnId;
  defaultGrouping?: GroupingValue<ColumnId>;
  defaultOrdering: ColumnId;
  recentAccessor?: (row: Row) => string | Date | null | undefined;
  onAddRow: () => void;
  addLabel: string;
  onRowClick?: (row: Row) => void;
  getSubRows?: (row: Row) => Row[] | undefined;
  rowClassName?: string;
  viewMode?: ViewMode | null;
  onViewModeChange?: (mode: ViewMode | null) => void;
  viewTabs?: readonly ViewMode[] | false;
  allowViewModeOff?: boolean;
}

const RECENT_OPTIONS: StoryListSettingOption[] = [
  { value: "1d", labelKey: "list.settings.recentOptions.1d" },
  { value: "7d", labelKey: "list.settings.recentOptions.7d" },
  { value: "30d", labelKey: "list.settings.recentOptions.30d" },
  { value: "all", labelKey: "list.settings.recentOptions.all" },
];

export function StoryListTableView<Row, FilterValue extends string, ColumnId extends string>({
  statusTabs,
  status,
  onStatusChange,
  settingsId,
  rows,
  isLoading,
  isEmpty,
  emptyState,
  columns,
  fixedColumnId,
  defaultGrouping,
  defaultOrdering,
  recentAccessor,
  onAddRow,
  addLabel,
  onRowClick,
  getSubRows,
  rowClassName,
  viewMode,
  onViewModeChange,
  viewTabs,
  allowViewModeOff,
}: StoryListTableViewProps<Row, FilterValue, ColumnId>) {
  const state = useStoryListTableState({
    rows,
    columns,
    fixedColumnId,
    defaultGrouping,
    defaultOrdering,
    settingsId,
    recentAccessor,
  });

  return (
    <>
      <EntitySubbar
        statusTabs={statusTabs}
        status={status}
        onStatusChange={onStatusChange}
        count={state.configuredRows.length}
        settingsSlot={
          <StoryListSettingsPopover
            groupingValue={state.grouping}
            groupingOptions={[
              { value: "none", labelKey: "list.settings.groupingOptions.none" },
              ...state.groupableColumns.map(toGroupOption),
            ]}
            onGroupingChange={(value) => state.setGrouping(value as GroupingValue<ColumnId>)}
            orderingValue={state.ordering}
            orderingOptions={state.orderableColumns.map(toOrderOption)}
            onOrderingChange={(value) => state.setOrdering(value as ColumnId)}
            recentValue={state.recent}
            recentOptions={RECENT_OPTIONS}
            onRecentChange={state.setRecent}
            properties={state.configurableColumns.map(toProperty)}
            visiblePropertyIds={state.visiblePropertyIds}
            onVisiblePropertyIdsChange={state.setVisiblePropertyIds}
          />
        }
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        viewTabs={viewTabs}
        allowViewModeOff={allowViewModeOff}
      />

      {renderContent({
        isLoading,
        isEmpty,
        emptyState,
        rows: state.configuredRows,
        columns: state.visibleColumns,
        gridTemplate: state.gridTemplate,
        onAddRow,
        addLabel,
        onRowClick,
        getSubRows,
        rowClassName,
      })}
    </>
  );
}

function renderContent<Row>({
  isLoading,
  isEmpty,
  emptyState,
  rows,
  columns,
  gridTemplate,
  onAddRow,
  addLabel,
  onRowClick,
  getSubRows,
  rowClassName,
}: {
  isLoading: boolean;
  isEmpty: boolean;
  emptyState: React.ReactNode;
  rows: Row[];
  columns: ColumnDef<Row>[];
  gridTemplate: string;
  onAddRow: () => void;
  addLabel: string;
  onRowClick?: (row: Row) => void;
  getSubRows?: (row: Row) => Row[] | undefined;
  rowClassName?: string;
}) {
  if (isLoading) return null;
  if (isEmpty) return emptyState;
  return (
    <EntityTable<Row>
      data={rows}
      columns={columns}
      gridTemplate={gridTemplate}
      onAddRow={onAddRow}
      addLabel={addLabel}
      onRowClick={onRowClick}
      getSubRows={getSubRows}
      rowClassName={rowClassName}
    />
  );
}

function useStoryListTableState<Row, ColumnId extends string>({
  rows,
  columns,
  fixedColumnId,
  defaultGrouping,
  defaultOrdering,
  settingsId,
  recentAccessor,
}: {
  rows: Row[];
  columns: StoryListColumn<Row, ColumnId>[];
  fixedColumnId: ColumnId;
  defaultGrouping?: GroupingValue<ColumnId>;
  defaultOrdering: ColumnId;
  settingsId: string;
  recentAccessor?: (row: Row) => string | Date | null | undefined;
}) {
  const fixedColumn = getFixedColumn(columns, fixedColumnId);
  const configurableColumns = columns.filter((column) => column.id !== fixedColumnId);
  const groupableColumns = configurableColumns.filter((column) => column.groupCompare);
  const orderableColumns = columns.filter((column) => column.orderCompare);
  const defaultVisiblePropertyIds = configurableColumns
    .filter((column) => column.defaultVisible !== false)
    .map((column) => column.id);
  const { settings, setGrouping, setOrdering, setRecent, setVisiblePropertyIds } =
    useStoryListViewSettings(settingsId, {
      grouping: defaultGrouping ?? groupableColumns[0]?.id ?? "none",
      ordering: defaultOrdering,
      visiblePropertyIds: defaultVisiblePropertyIds,
    });
  const grouping = settings.grouping as GroupingValue<ColumnId>;
  const ordering = settings.ordering as ColumnId;
  const recent = settings.recent;
  const visiblePropertyIds = settings.visiblePropertyIds as ColumnId[];
  const columnById = new Map(columns.map((column) => [column.id, column]));
  const visibleColumns = [
    fixedColumn.column,
    ...visiblePropertyIds.map((id) => columnById.get(id)?.column).filter(isColumnDef),
  ];
  const gridTemplate = [
    fixedColumn.width,
    ...visiblePropertyIds.map((id) => columnById.get(id)?.width).filter(isString),
  ].join(" ");
  const configuredRows = configureRows({
    rows,
    grouping,
    groupingColumn: grouping === "none" ? undefined : columnById.get(grouping),
    orderingColumn: columnById.get(ordering),
    recent,
    recentAccessor,
  });

  return {
    configurableColumns,
    configuredRows,
    gridTemplate,
    groupableColumns,
    grouping,
    orderableColumns,
    ordering,
    recent,
    setGrouping,
    setOrdering,
    setRecent,
    setVisiblePropertyIds,
    visibleColumns,
    visiblePropertyIds,
  };
}

function getFixedColumn<Row, ColumnId extends string>(
  columns: StoryListColumn<Row, ColumnId>[],
  fixedColumnId: ColumnId,
) {
  const fixedColumn = columns.find((column) => column.id === fixedColumnId);
  if (!fixedColumn) {
    throw new Error(`StoryListTableView fixed column not found: ${fixedColumnId}`);
  }
  return fixedColumn;
}

function configureRows<Row, ColumnId extends string>({
  rows,
  grouping,
  groupingColumn,
  orderingColumn,
  recent,
  recentAccessor,
}: {
  rows: Row[];
  grouping: GroupingValue<ColumnId>;
  groupingColumn?: StoryListColumn<Row, ColumnId>;
  orderingColumn?: StoryListColumn<Row, ColumnId>;
  recent: string;
  recentAccessor?: (row: Row) => string | Date | null | undefined;
}) {
  const recentDays = getRecentDays(recent);
  return [...rows]
    .filter((row) => (recentAccessor ? daysSince(recentAccessor(row)) <= recentDays : true))
    .sort((left, right) => {
      const groupCompare =
        grouping === "none" ? 0 : (groupingColumn?.groupCompare?.(left, right) ?? 0);
      if (groupCompare !== 0) return groupCompare;
      return orderingColumn?.orderCompare?.(left, right) ?? 0;
    });
}

function toProperty<Row, ColumnId extends string>(
  column: StoryListColumn<Row, ColumnId>,
): StoryListSettingProperty<ColumnId> {
  return {
    id: column.id,
    labelKey: column.labelKey,
  };
}

function toGroupOption<Row, ColumnId extends string>(
  column: StoryListColumn<Row, ColumnId>,
): StoryListSettingOption {
  return {
    value: column.id,
    labelKey: column.groupLabelKey ?? column.labelKey,
  };
}

function toOrderOption<Row, ColumnId extends string>(
  column: StoryListColumn<Row, ColumnId>,
): StoryListSettingOption {
  return {
    value: column.id,
    labelKey: column.orderLabelKey ?? column.labelKey,
  };
}

function getRecentDays(recent: string): number {
  if (recent === "1d") return 1;
  if (recent === "7d") return 7;
  if (recent === "30d") return 30;
  return Number.POSITIVE_INFINITY;
}

function daysSince(value: string | Date | null | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  return (Date.now() - date.getTime()) / 86_400_000;
}

function isColumnDef<Row>(value: ColumnDef<Row> | undefined): value is ColumnDef<Row> {
  return Boolean(value);
}

function isString(value: string | undefined): value is string {
  return typeof value === "string";
}
