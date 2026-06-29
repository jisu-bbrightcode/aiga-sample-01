/**
 *               /tmp/product-builder-design/EntityDetail.jsx (MentionMenuInline / SlashMenu)
 *
 * Relation Picker — v8 popover.
 *
 * Layout (디자인 mention-pop 그대로):
 *   ┌─────────────────────────────────────────┐
 *   │ 관계               @ 캐릭터    ?         │  head (label + hint + ?)
 *   ├─────────────────────────────────────────┤
 *   │ [## 세계] [@ 캐릭터] [@@ 장소] ...        │  type chip row (B 옵션)
 *   ├─────────────────────────────────────────┤
 *   │ Q 이름으로 검색...                        │  search
 *   ├─────────────────────────────────────────┤
 *   │ • 사라 케리건                       c60   │  list (virtualized)
 *   │ • 짐 레이너                         c0a   │
 *   └─────────────────────────────────────────┘
 *
 * 두 가지 사용처가 있다:
 *   1) `<RelationPicker>` — 사이드바 "+ 연결 추가" 버튼 트리거 popover.
 *   2) `<RelationPickerPanel>` — 본문 mention 시 caret 위치에 그대로 띄울 수 있는
 *      host renderer용 panel. 두 경우 같은 chrome.
 */

import { useFeatureTranslation } from "@repo/core/i18n";
import { useCreateRelation, useStoryLoreEntityList } from "@repo/data/hooks";
import type { EntityType } from "@repo/data/types";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/shadcn/button";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/shadcn/popover";
import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import {
  PICKER_POPOVER_CHROME,
  PICKER_POPOVER_WIDTH,
  PICKER_ROW_HEIGHT,
  PickerEmptyState,
  PickerPanelHead,
  PickerSearchField,
} from "./picker-popover-panel";

export type RelationEntityType = "world" | "character" | "location" | "faction" | "codex";

export const RELATION_ENTITY_TYPES: ReadonlyArray<{
  value: RelationEntityType;
  labelKey: string;
  trigger: string;
  cssVar: string;
}> = [
  {
    value: "world",
    labelKey: "entity.card.type.world",
    trigger: "##",
    cssVar: "var(--entity-world)",
  },
  {
    value: "character",
    labelKey: "entity.card.type.character",
    trigger: "@",
    cssVar: "var(--entity-character)",
  },
  {
    value: "location",
    labelKey: "entity.card.type.location",
    trigger: "@@",
    cssVar: "var(--entity-location)",
  },
  {
    value: "faction",
    labelKey: "entity.card.type.faction",
    trigger: "@@@",
    cssVar: "var(--entity-faction)",
  },
  {
    value: "codex",
    labelKey: "entity.card.type.codex",
    trigger: "$",
    cssVar: "var(--entity-codex)",
  },
];

const TYPE_CODE: Record<RelationEntityType, string> = {
  world: "w",
  character: "c",
  location: "l",
  faction: "f",
  codex: "x",
};

/* ═══════════════════════════════════════════════════════════════════
 *  Panel — popover content. 두 사용처에서 공유.
 * ═══════════════════════════════════════════════════════════════════ */

export interface RelationPickerPanelItem {
  id: string;
  name: string;
  type?: RelationEntityType;
}

interface RelationPickerPanelBaseProps {
  /** 본인(=source) 항목 — 자기 자신은 list 에서 제외 */
  excludeId?: string;
  /** 이미 연결된 항목 — 체크 표시 */
  existingTargetIds?: Set<string>;
  /** 헤더 좌측 라벨. 기본값은 사이드바/본문 mention 모두 같은 "관계" 패널이다. */
  headLabel?: string;
  /** 초기 type. 본문 mention 의 trigger 결정 시 사용. */
  initialType?: RelationEntityType;
  /** type chip row 표시 여부 (default true) */
  showTypeChips?: boolean;
  /** 외부 검색어 동기화 — controlled mode (mention 캐럿 query) */
  search?: string;
  onSearchChange?: (q: string) => void;
  /** 검색 input 표시 여부 (default true) */
  showSearchInput?: boolean;
  /** editor mention popover처럼 검색어 원천이 외부 텍스트일 때 input을 표시 전용으로 둔다. */
  readOnlySearch?: boolean;
  /** editor caret popover에서 input 클릭이 editor selection을 빼앗지 않도록 막는다. */
  preventSearchMouseDownDefault?: boolean;
  /** listbox/option contract가 필요한 host renderer용. */
  listboxLabel?: string;
  selectedIndex?: number;
  /** empty create row. Mention host create contract가 이 경로를 사용한다. */
  createLabel?: string;
  isCreating?: boolean;
  onCreate?: () => void;
  preventRowMouseDownDefault?: boolean;
  /** 항목 선택 콜백 */
  onSelect: (item: { id: string; name: string; type: RelationEntityType }) => void;
}

type RelationPickerPanelProps =
  | (RelationPickerPanelBaseProps & {
      projectId: string;
      items?: never;
    })
  | (RelationPickerPanelBaseProps & {
      projectId?: string;
      items: readonly RelationPickerPanelItem[];
    });

export function RelationPickerPanel(props: RelationPickerPanelProps) {
  if (props.items) {
    return <RelationPickerPanelStatic {...props} />;
  }
  return <RelationPickerPanelData {...props} />;
}

function RelationPickerPanelData({
  projectId,
  excludeId,
  existingTargetIds,
  headLabel,
  initialType = "world",
  showTypeChips = true,
  search: externalSearch,
  onSearchChange,
  showSearchInput = true,
  readOnlySearch,
  preventSearchMouseDownDefault,
  listboxLabel,
  selectedIndex,
  createLabel,
  isCreating,
  onCreate,
  preventRowMouseDownDefault,
  onSelect,
}: RelationPickerPanelBaseProps & { projectId: string }) {
  const [internalSearch, setInternalSearch] = useState("");
  const search = externalSearch ?? internalSearch;
  const querySearch = search.trim() || undefined;
  const [selectedType, setSelectedType] = useState<RelationEntityType>(initialType);

  const { data: rows } = useStoryLoreEntityList(selectedType, projectId, querySearch);

  const items = useMemo<RelationPickerPanelItem[]>(() => {
    const list = (rows ?? []).map((it) => ({
      id: it.id,
      name: it.name,
      type: selectedType,
    }));
    return excludeId ? list.filter((it) => it.id !== excludeId) : list;
  }, [rows, selectedType, excludeId]);

  return (
    <RelationPickerPanelContent
      items={items}
      existingTargetIds={existingTargetIds}
      headLabel={headLabel}
      selectedType={selectedType}
      onTypeChange={setSelectedType}
      showTypeChips={showTypeChips}
      search={search}
      onSearchChange={onSearchChange ?? setInternalSearch}
      showSearchInput={showSearchInput}
      readOnlySearch={readOnlySearch}
      preventSearchMouseDownDefault={preventSearchMouseDownDefault}
      listboxLabel={listboxLabel}
      selectedIndex={selectedIndex}
      createLabel={createLabel}
      isCreating={isCreating}
      onCreate={onCreate}
      preventRowMouseDownDefault={preventRowMouseDownDefault}
      onSelect={onSelect}
    />
  );
}

function RelationPickerPanelStatic({
  items,
  excludeId,
  initialType = "world",
  ...props
}: RelationPickerPanelBaseProps & { items: readonly RelationPickerPanelItem[] }) {
  const visibleItems = excludeId ? items.filter((it) => it.id !== excludeId) : items;
  return (
    <RelationPickerPanelContent
      {...props}
      items={visibleItems}
      selectedType={initialType}
      showTypeChips={props.showTypeChips}
    />
  );
}

function RelationPickerPanelContent({
  items,
  existingTargetIds,
  headLabel,
  selectedType,
  onTypeChange,
  showTypeChips = true,
  search: externalSearch,
  onSearchChange,
  showSearchInput = true,
  readOnlySearch = false,
  preventSearchMouseDownDefault = false,
  listboxLabel,
  selectedIndex,
  createLabel,
  isCreating = false,
  onCreate,
  preventRowMouseDownDefault = false,
  onSelect,
}: RelationPickerPanelBaseProps & {
  items: readonly RelationPickerPanelItem[];
  selectedType: RelationEntityType;
  onTypeChange?: (type: RelationEntityType) => void;
}) {
  const { t } = useFeatureTranslation("feature.story");
  const [internalSearch, setInternalSearch] = useState("");
  const search = externalSearch ?? internalSearch;
  const setSearch = onSearchChange ?? setInternalSearch;
  const linked = existingTargetIds ?? new Set<string>();
  const activeMeta = RELATION_ENTITY_TYPES.find((e) => e.value === selectedType);
  const showCreate = Boolean(createLabel && onCreate);

  function handlePick(it: RelationPickerPanelItem) {
    if (linked.has(it.id)) return;
    onSelect({ id: it.id, name: it.name, type: it.type ?? selectedType });
  }

  return (
    <>
      <PickerPanelHead
        label={headLabel ?? t("picker.relation.head")}
        hint={`${activeMeta?.trigger ?? ""} ${activeMeta ? t(activeMeta.labelKey) : ""}`}
      />

      {/* chip row */}
      {showTypeChips ? (
        <div className="flex flex-wrap items-center gap-1 px-2 pb-1">
          {RELATION_ENTITY_TYPES.map((et) => {
            const isActive = selectedType === et.value;
            return (
              <Button
                key={et.value}
                type="button"
                variant="ghost"
                size="xs"
                aria-label={`${et.trigger} ${t(et.labelKey)}`}
                aria-pressed={isActive}
                onClick={() => onTypeChange?.(et.value)}
                className={cn(
                  "h-auto gap-1 rounded-md px-2 py-0.5 font-mono text-xs",
                  isActive
                    ? "bg-[rgba(31,29,24,0.06)] text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span className="text-muted-foreground/80">{et.trigger}</span>
                <span>{t(et.labelKey)}</span>
              </Button>
            );
          })}
        </div>
      ) : null}

      {/* search */}
      {showSearchInput ? (
        <PickerSearchField
          value={search}
          onChange={setSearch}
          placeholder={t("picker.relation.searchPlaceholder")}
          readOnly={readOnlySearch}
          preventMouseDownDefault={preventSearchMouseDownDefault}
        />
      ) : null}

      <div {...(listboxLabel ? { role: "listbox", "aria-label": listboxLabel } : {})}>
        {items.length === 0 ? (
          <PickerEmptyState>{t("picker.relation.empty")}</PickerEmptyState>
        ) : (
          <div className="max-h-60 overflow-y-auto px-1.5 pb-1.5">
            {items.map((it, index) => {
              const isLinked = linked.has(it.id);
              const itemType = it.type ?? selectedType;
              const code = `${TYPE_CODE[itemType]}${it.id.slice(0, 2)}`;
              const isSelected = index === selectedIndex;
              return (
                <Button
                  key={it.id}
                  type="button"
                  variant="ghost"
                  role={listboxLabel ? "option" : undefined}
                  aria-selected={listboxLabel ? isSelected : undefined}
                  onMouseDown={
                    preventRowMouseDownDefault ? (event) => event.preventDefault() : undefined
                  }
                  onClick={() => handlePick(it)}
                  disabled={isLinked}
                  className={cn(
                    "h-auto w-full justify-start gap-2 rounded-[5px] px-2 text-left",
                    "hover:bg-muted focus-visible:bg-muted",
                    "outline-none disabled:opacity-50",
                    isSelected && "bg-[rgba(31,29,24,0.06)]",
                  )}
                  style={{ height: PICKER_ROW_HEIGHT }}
                >
                  <span className="min-w-0 flex-1 truncate text-base font-medium text-foreground">
                    {it.name}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                    {code}
                  </span>
                  <Check
                    className={cn(
                      "size-3.5 shrink-0 text-muted-foreground transition-opacity",
                      isLinked ? "opacity-100" : "opacity-0",
                    )}
                  />
                </Button>
              );
            })}
          </div>
        )}
      </div>

      {showCreate ? (
        <div className="border-t border-border/60 px-2 py-1.5">
          <Button
            type="button"
            variant="ghost"
            className="relation-picker-mention-popover__create h-auto w-full justify-start rounded-md px-2 py-1.5 text-left text-xs text-foreground disabled:opacity-50"
            onMouseDown={preventRowMouseDownDefault ? (event) => event.preventDefault() : undefined}
            onClick={onCreate}
            disabled={isCreating}
          >
            {createLabel}
          </Button>
        </div>
      ) : null}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  Wrapper — 사이드바 "+ 연결 추가" 트리거 popover
 * ═══════════════════════════════════════════════════════════════════ */

interface Props {
  projectId: string;
  sourceId: string;
  sourceType: EntityType;
  initialType?: RelationEntityType;
  existingTargetIds?: Set<string>;
  children: React.ReactNode;
}

export function RelationPicker({
  projectId,
  sourceId,
  sourceType,
  initialType,
  existingTargetIds,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const createRelation = useCreateRelation();
  const panelInitialType = initialType ?? (sourceType === "world" ? "character" : "world");

  useStoryLoreEntityList(panelInitialType, projectId, undefined);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger nativeButton={false} render={<span />}>
        {children}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        style={{ width: PICKER_POPOVER_WIDTH }}
        className={cn("gap-0 p-0", PICKER_POPOVER_CHROME)}
      >
        {open ? (
          <RelationPickerPanel
            projectId={projectId}
            excludeId={sourceId}
            existingTargetIds={existingTargetIds}
            initialType={panelInitialType}
            onSelect={(picked) => {
              setOpen(false);
              createRelation.mutate(
                {
                  sourceId,
                  sourceType,
                  targetId: picked.id,
                  targetType: picked.type,
                  targetName: picked.name,
                  projectId,
                },
                { onError: () => setOpen(true) },
              );
            }}
          />
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/* mention-pop chrome 만 — Panel 을 caret 위치에 직접 mount 할 때 사용 */
export const MENTION_POP_CHROME = PICKER_POPOVER_CHROME;
export const RELATION_PICKER_ROW_HEIGHT = PICKER_ROW_HEIGHT;
