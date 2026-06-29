/**
 * 세계관 엔티티(세계/캐릭터/장소/세력/코덱스) 번역 페이지.
 *
 * v8 layout
 *  ┌────────────────────────────────────────────────────────────┐
 *  │ Aethys / 현지화 / 세계관 번역                              │  PageHeader
 *  ├────────────────────────────────────────────────────────────┤
 *  │ EN · JA · ZH · ES · FR · DE  + 추가      ⊝ 전체 — 92% ──  │  LangBar
 *  ├────────────────────────────────────────────────────────────┤
 *  │ KO → English                            그룹 ▾ ◯ ◯       │  Subbar
 *  ├────────────────────────────────────────────────────────────┤
 *  │ ▾ 세계 (3)        ▭▭▭▭—  84%                              │
 *  │   이름  원문  진행률  상태  이슈  업데이트  담당             │
 *  │   …rows                                                    │
 *  └────────────────────────────────────────────────────────────┘
 *
 * 지원 언어는 loc_languages 테이블(useLanguages)이 프로젝트별 source-of-truth.
 * 새 언어 추가는 + 버튼 → AddLanguageDialog → useCreateLanguage 옵티미스틱 갱신.
 */

import {
  useCharacters,
  useCodexEntries,
  useFactions,
  useLocations,
  useWorlds,
} from "@repo/data/hooks";
import { PageLayout } from "@repo/ui/components/page-layout";
import { cn } from "@repo/ui/lib/utils";
import { Skeleton } from "@repo/ui/shadcn/skeleton";
import { useNavigate, useParams } from "@tanstack/react-router";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertTriangle, ChevronDown, Globe, Plus, Search, Settings2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { AddLanguageDialog } from "../components/add-language-dialog";
import { useCreateLanguage } from "../hooks/use-localization-mutations";
import { useLanguages, useTranslations } from "../hooks/use-localization-queries";

/* ── Types ── */

type LocStatus = "pending" | "translating" | "review" | "blocked" | "done";

const LORE_ENTITY_TYPES = ["world", "character", "location", "faction", "codex"] as const;
type LoreEntityType = (typeof LORE_ENTITY_TYPES)[number];

const LORE_GROUPS: Array<{ key: LoreEntityType; label: string; entityVar: string }> = [
  { key: "world", label: "세계", entityVar: "var(--entity-world)" },
  { key: "character", label: "캐릭터", entityVar: "var(--entity-character)" },
  { key: "location", label: "장소", entityVar: "var(--entity-location)" },
  { key: "faction", label: "세력", entityVar: "var(--entity-faction)" },
  { key: "codex", label: "코덱스", entityVar: "var(--entity-codex)" },
];

interface LoreItem {
  id: string;
  entityType: LoreEntityType;
  name: string;
  status: LocStatus;
  pct: number;
  issues: number;
  updated: string;
  translatedCount: number;
  totalFields: number;
}

interface LoreEntity {
  id: string;
  name?: string;
  title?: string;
  description?: string | null;
  body?: string | null;
  updatedAt?: string | null;
}

interface ExistingTranslation {
  id: string;
  entityId?: string;
  entityType?: string;
  fieldKey?: string;
  translatedText?: string | null;
  status?: string;
  updatedAt?: string | null;
}

interface ProjectLanguage {
  id: string;
  code: string;
  name: string;
  isSource?: boolean;
}

/* ── Page ── */

export function LoreTranslationPage() {
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const navigate = useNavigate();

  const [selectedLanguageId, setSelectedLanguageId] = useState("");
  const [groupBy, setGroupBy] = useState<"entity" | "status">("entity");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [addLangOpen, setAddLangOpen] = useState(false);

  /* ── Languages (source of truth = loc_languages) ── */
  const { data: languages } = useLanguages(projectId);
  // Filter to records that actually have a code — optimistic updates may flush
  // a partial row before the server response lands.
  const langList = ((languages ?? []) as ProjectLanguage[]).filter((l) => l && !!l.code);
  const sourceLang = langList.find((l) => l.isSource) ?? { code: "ko", name: "한국어" };
  const targetLanguages = langList.filter((l) => !l.isSource);
  const langId = selectedLanguageId || targetLanguages[0]?.id || "";
  const currentLang = targetLanguages.find((l) => l.id === langId);

  const createLang = useCreateLanguage(projectId);
  const addedCodes = langList.map((l) => l.code);
  function handleAddLanguage(code: string) {
    const known = LANGUAGE_NAMES[code];
    createLang.mutate({ code, name: known ?? code, isSource: false });
    setAddLangOpen(false);
  }

  /* ── Source data ── */
  const { data: worlds, isLoading: lW } = useWorlds(projectId);
  const { data: characters, isLoading: lC } = useCharacters(projectId);
  const { data: locations, isLoading: lL } = useLocations(projectId);
  const { data: factions, isLoading: lF } = useFactions(projectId);
  const { data: codexEntries, isLoading: lX } = useCodexEntries(projectId);

  const { data: rawTranslations, isLoading: lT } = useTranslations(projectId, langId);
  const isLoading = lW || lC || lL || lF || lX || lT;

  /* ── Build items ── */
  const loreItems = useMemo(
    () =>
      buildLoreItems(
        {
          world: (worlds ?? []) as LoreEntity[],
          character: (characters ?? []) as LoreEntity[],
          location: (locations ?? []) as LoreEntity[],
          faction: (factions ?? []) as LoreEntity[],
          codex: (codexEntries ?? []) as LoreEntity[],
        },
        (rawTranslations ?? []) as ExistingTranslation[],
      ),
    [worlds, characters, locations, factions, codexEntries, rawTranslations],
  );

  const filtered = search.trim()
    ? loreItems.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    : loreItems;

  const groups = useMemo(() => buildGroups(filtered, groupBy), [filtered, groupBy]);
  const overall = useMemo(() => rollup(filtered), [filtered]);

  /* ── Empty: no target languages ── */
  if (!isLoading && targetLanguages.length === 0) {
    return (
      <PageLayout
        crumbs={[{ label: "현지화" }, { label: "세계관 번역" }]}
        onAdd={() => setAddLangOpen(true)}
        addLabel="언어 추가"
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-md bg-background">
          <Globe className="size-8 text-muted-foreground/30" aria-hidden />
          <p className="text-base text-muted-foreground">대상 언어를 먼저 추가하세요</p>
          <button
            type="button"
            onClick={() => setAddLangOpen(true)}
            className="flex items-center gap-xs rounded-md bg-primary px-md py-xs text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="size-3.5" aria-hidden />
            언어 추가
          </button>
        </div>
        <AddLanguageDialog
          open={addLangOpen}
          onOpenChange={setAddLangOpen}
          addedLanguages={addedCodes}
          onAddLanguage={handleAddLanguage}
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      crumbs={[{ label: "현지화" }, { label: "세계관 번역" }]}
      onAdd={() => setAddLangOpen(true)}
      addLabel="언어 추가"
    >
      {/* ── Language tab bar ── */}
      <LangBar
        sourceLabel={sourceLang.code.toUpperCase()}
        languages={targetLanguages}
        selectedId={langId}
        onSelect={setSelectedLanguageId}
        overallPct={overall.pct}
        overallTarget={currentLang?.name ?? ""}
        overallDoneCount={overall.done}
        overallTotal={overall.total}
      />

      {/* ── Subbar ── 선 없이 여백만으로 구분 (테마별 자유) */}
      <div data-el="loc-lore.subbar" className="flex h-10 shrink-0 items-center gap-md px-7">
        <span className="text-base text-muted-foreground">
          {sourceLang.code.toUpperCase()} →{" "}
          <b className="font-semibold text-foreground">{currentLang?.name ?? "—"}</b>
        </span>

        <div className="ml-auto flex items-center gap-xs">
          <GroupByDropdown value={groupBy} onChange={setGroupBy} />
          {searchOpen ? (
            <input
              autoFocus
              type="text"
              value={search}
              placeholder="검색…"
              onChange={(e) => setSearch(e.target.value)}
              onBlur={() => !search && setSearchOpen(false)}
              className="h-7 w-44 rounded-md border border-border bg-background px-sm text-xs text-foreground outline-none transition-colors focus:border-primary"
            />
          ) : (
            <IconButton title="검색" onClick={() => setSearchOpen(true)}>
              <Search className="size-3.5" aria-hidden />
            </IconButton>
          )}
          <IconButton title="설정">
            <Settings2 className="size-3.5" aria-hidden />
          </IconButton>
        </div>
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-md">
          <LoadingSkeleton />
        </div>
      ) : filtered.length === 0 && loreItems.length > 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-md">
          <EmptyState message="검색 결과가 없습니다." />
        </div>
      ) : loreItems.length === 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-md">
          <EmptyState
            icon={<Globe className="size-8 text-muted-foreground/30" aria-hidden />}
            title="번역할 세계관 항목이 없습니다"
            message="세계관에 항목을 추가하면 여기에 표시됩니다."
          />
        </div>
      ) : (
        <VirtualizedLocTable
          groups={groups}
          onRowClick={(item) =>
            navigate({
              to: `/p/${projectId}/localization/editor/${item.id}`,
              search: { lang: langId },
            })
          }
        />
      )}

      <AddLanguageDialog
        open={addLangOpen}
        onOpenChange={setAddLangOpen}
        addedLanguages={addedCodes}
        onAddLanguage={handleAddLanguage}
      />
    </PageLayout>
  );
}

/* ── LangBar ── */

/* ── VirtualizedLocTable — TanStack Table + Virtual ──
 *  - 그룹 헤더(접기/펼치기) + 컬럼 헤더 + 데이터 행을 단일 flat 리스트로 평탄화.
 *  - useVirtualizer 가 항목 종류별 가변 높이로 가상화한다. 코덱스 1000+ 도 OK.
 *  - useReactTable 은 컬럼 정의/cell flex-rendering 용 (EntityTable 패턴).
 */

const ROW_H = 32;

type FlatRow =
  | {
      kind: "group";
      key: string;
      label: string;
      count: number;
      dotColor: string;
      pct: number;
      collapsed: boolean;
    }
  | { kind: "data"; key: string; item: LoreItem; entityVar?: string };

interface VirtualizedLocTableProps {
  groups: Array<{
    key: string;
    label: string;
    dotColor: string;
    items: LoreItem[];
  }>;
  onRowClick: (item: LoreItem) => void;
}

function VirtualizedLocTable({ groups, onRowClick }: VirtualizedLocTableProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const columns = useMemo<ColumnDef<LoreItem>[]>(
    () => [
      {
        id: "name",
        header: "이름",
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2">
            {/* 그룹 하위 한 단계 들여쓰기 (16px) */}
            <span aria-hidden className="inline-block w-4 shrink-0" />
            <span className="truncate font-medium">{row.original.name}</span>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
              {row.original.translatedCount}/{row.original.totalFields}
            </span>
          </div>
        ),
      },
      {
        id: "words",
        header: "원문",
        cell: () => <span className="text-xs text-muted-foreground">—</span>,
      },
      {
        id: "progress",
        header: "진행률",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <div className="h-1.5 min-w-20 flex-1 overflow-hidden rounded-full bg-[rgba(31,29,24,0.06)]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${row.original.pct}%`,
                  background: progressFillColor(row.original.status),
                }}
              />
            </div>
            <span className="min-w-8 text-right text-xs tabular-nums">
              {row.original.pct}%
            </span>
          </div>
        ),
      },
      {
        id: "status",
        header: "상태",
        cell: ({ row }) => <LocStatusPill status={row.original.status} />,
      },
      {
        id: "issues",
        header: "이슈",
        cell: ({ row }) =>
          row.original.issues > 0 ? (
            <span
              className="inline-flex h-5 items-center gap-1 rounded-md px-2 text-xs font-medium leading-none"
              style={{ background: "rgba(180,65,65,0.15)", color: "#7A2828" }}
              title={`${row.original.issues}개 이슈`}
            >
              <AlertTriangle className="size-3.5" aria-hidden />
              {row.original.issues}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: "updated",
        header: "업데이트",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.updated}</span>
        ),
      },
      {
        id: "assignee",
        header: "담당",
        cell: () => (
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-grid size-5 shrink-0 place-items-center rounded-full bg-[rgba(31,29,24,0.06)] text-2xs font-semibold text-muted-foreground">
              +
            </span>
            <span className="truncate text-xs text-muted-foreground">미배정</span>
          </div>
        ),
      },
    ],
    [],
  );

  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const table = useReactTable({
    data: allItems,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  const rowsById = useMemo(() => {
    const m = new Map<string, ReturnType<typeof table.getRowModel>["rows"][number]>();
    for (const r of table.getRowModel().rows) m.set(r.original.id, r);
    return m;
  }, [table]);

  /* Build flat list of rendered rows */
  const flat = useMemo<FlatRow[]>(() => {
    const list: FlatRow[] = [];
    for (const g of groups) {
      const isCollapsed = collapsed.has(g.key);
      const pct =
        g.items.length === 0
          ? 0
          : Math.round(g.items.reduce((s, it) => s + it.pct, 0) / g.items.length);
      list.push({
        kind: "group",
        key: g.key,
        label: g.label,
        count: g.items.length,
        dotColor: g.dotColor,
        pct,
        collapsed: isCollapsed,
      });
      if (!isCollapsed) {
        for (const it of g.items) {
          list.push({
            kind: "data",
            key: it.id,
            item: it,
            entityVar: LORE_GROUPS.find((lg) => lg.key === it.entityType)?.entityVar,
          });
        }
      }
    }
    return list;
  }, [groups, collapsed]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: flat.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_H,
    getItemKey: (i) => flat[i]?.key ?? `idx-${i}`,
    overscan: 10,
  });

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col px-7" data-el="loc-lore.virtual-shell">
      {/* 단일 col-head — scroll container 바깥에 두어 스크롤과 무관하게 최상단 고정. */}
      <div
        data-el="entity-table.col-head"
        style={{ gridTemplateColumns: GRID_COLS }}
        className="grid h-7 shrink-0 items-center gap-3 bg-background px-3 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        {table.getHeaderGroups()[0]?.headers.map((h) => (
          <span key={h.id} className="truncate">
            {flexRender(h.column.columnDef.header, h.getContext())}
          </span>
        ))}
      </div>

      <div
        ref={parentRef}
        data-el="loc-lore.virtual-table"
        className="min-h-0 flex-1 overflow-y-auto pb-md"
      >
        <div style={{ height: virtualizer.getTotalSize() }} className="relative">
          {virtualizer.getVirtualItems().map((vi) => {
            const r = flat[vi.index];
            if (!r) return null;
            const top = vi.start;
            if (r.kind === "group") {
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => toggleGroup(r.key)}
                  style={{ position: "absolute", top, left: 0, right: 0, height: ROW_H }}
                  className="flex items-center gap-2 rounded-md px-3 text-left transition-colors hover:bg-muted hover:text-foreground"
                >
                  <span
                    className={cn(
                      "inline-grid size-4 place-items-center text-muted-foreground transition-transform",
                      r.collapsed ? "-rotate-90" : "rotate-0",
                    )}
                  >
                    <ChevronDown className="size-3.5" aria-hidden />
                  </span>
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: r.dotColor }}
                    aria-hidden
                  />
                  <span className="text-base font-medium tracking-wide text-sidebar-foreground">
                    {r.label}
                  </span>
                  <span className="inline-grid h-[18px] min-w-5 place-items-center rounded-sm bg-[rgba(31,29,24,0.06)] px-1.5 text-xs font-medium text-muted-foreground">
                    {r.count}
                  </span>
                  <span className="ml-3 flex items-center gap-2">
                    <div className="h-1 w-28 overflow-hidden rounded-full bg-[rgba(31,29,24,0.06)]">
                      <div
                        className="h-full rounded-full bg-foreground/40"
                        style={{ width: `${r.pct}%` }}
                      />
                    </div>
                    <span className="min-w-9 text-xs text-muted-foreground tabular-nums">
                      {r.pct}%
                    </span>
                  </span>
                </button>
              );
            }
            // data
            const tRow = rowsById.get(r.item.id);
            if (!tRow) return null;
            return (
              <div
                key={r.key}
                data-el="entity-table.row"
                role="button"
                tabIndex={0}
                onClick={() => onRowClick(r.item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onRowClick(r.item);
                  }
                }}
                style={{
                  position: "absolute",
                  top,
                  left: 0,
                  right: 0,
                  height: ROW_H,
                  gridTemplateColumns: GRID_COLS,
                }}
                className="group/row grid cursor-pointer items-center gap-3 rounded-md px-3 text-base text-sidebar-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {tRow.getVisibleCells().map((cell) => (
                  <div key={cell.id} className="min-w-0 truncate">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface LangBarProps {
  sourceLabel: string;
  languages: ProjectLanguage[];
  selectedId: string;
  onSelect: (id: string) => void;
  overallPct: number;
  overallTarget: string;
  overallDoneCount: number;
  overallTotal: number;
}

function LangBar({
  languages,
  selectedId,
  onSelect,
  overallPct,
  overallTarget,
  overallDoneCount,
  overallTotal,
}: LangBarProps) {
  return (
    <div
      data-el="loc-lore.lang-bar"
      className="flex h-11 shrink-0 items-stretch justify-between gap-md px-7"
    >
      {/* Lang tabs */}
      <div className="flex items-stretch gap-2xs">
        {languages.map((l) => {
          const active = l.id === selectedId;
          return (
            <button
              key={l.id}
              type="button"
              data-el="loc-lore.lang-tab"
              data-active={active ? "true" : undefined}
              onClick={() => onSelect(l.id)}
              className={cn(
                "-mb-px flex items-center gap-sm whitespace-nowrap border-b-2 border-transparent px-sm text-base font-medium transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "inline-grid h-5 min-w-7 place-items-center rounded-md px-xs text-2xs font-semibold tracking-wider",
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {l.code.toUpperCase()}
              </span>
              <span>{l.name}</span>
            </button>
          );
        })}
      </div>

      {/* Overall progress */}
      {overallTarget ? (
        <div className="flex items-center gap-sm">
          <span className="text-xs text-muted-foreground">전체 진행률 · {overallTarget}</span>
          <div className="h-1.5 w-36 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.max(0, Math.min(100, overallPct))}%` }}
            />
          </div>
          <span className="min-w-9 text-right font-mono text-xs font-semibold tabular-nums text-foreground">
            {overallPct}%
          </span>
          <span className="pl-sm font-mono text-xs text-muted-foreground tabular-nums">
            {overallDoneCount}/{overallTotal} 완료
          </span>
        </div>
      ) : null}
    </div>
  );
}

/* ── GroupBy dropdown (Select-based) ── */

const GROUP_OPTIONS: Array<{ id: "entity" | "status"; label: string }> = [
  { id: "entity", label: "엔티티 종류" },
  { id: "status", label: "번역 상태" },
];

function GroupByDropdown({
  value,
  onChange,
}: {
  value: "entity" | "status";
  onChange: (v: "entity" | "status") => void;
}) {
  const [open, setOpen] = useState(false);
  const current = GROUP_OPTIONS.find((o) => o.id === value) ?? GROUP_OPTIONS[0]!;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex h-7 items-center gap-xs rounded-md border border-border bg-background px-sm text-xs text-foreground transition-colors hover:bg-muted"
      >
        <span className="text-muted-foreground">그룹</span>
        <span className="font-medium">{current.label}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="닫기"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-8 z-40 w-44 rounded-md border border-border bg-popover py-xs shadow-md">
            <div className="px-md pb-xs text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              Group by
            </div>
            {GROUP_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between px-md py-xs text-base transition-colors hover:bg-muted",
                  value === o.id ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span>{o.label}</span>
                {value === o.id ? <span className="text-primary">✓</span> : null}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ── IconButton (subbar) ── */

function IconButton({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

const GRID_COLS = "minmax(280px,1fr) 64px minmax(160px,220px) 76px 56px 72px 120px";

function LocStatusPill({ status }: { status: LocStatus }) {
  const meta = LOC_STATUS_META[status];
  return (
    <span
      data-el="status-pill"
      data-status={status}
      className="inline-flex h-5 items-center rounded-md px-2 text-xs font-medium leading-none"
      style={{ background: meta.bg, color: meta.fg }}
    >
      {meta.label}
    </span>
  );
}

// 색 팔레트는 @repo/ui entity-table StatusPill 과 동일 톤(셰어 가능 시 통합 권장).
const LOC_STATUS_META: Record<LocStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: "대기", bg: "rgba(142,136,118,0.15)", fg: "#6B6557" },
  translating: { label: "번역중", bg: "rgba(90,122,143,0.20)", fg: "#3E5868" },
  review: { label: "리뷰", bg: "rgba(139,92,246,0.15)", fg: "#6B4FC0" },
  done: { label: "완료", bg: "rgba(79,122,62,0.18)", fg: "#3E6030" },
  blocked: { label: "이슈", bg: "rgba(180,65,65,0.15)", fg: "#7A2828" },
};

function progressFillColor(status: LocStatus): string {
  switch (status) {
    case "done":
      return "#4F7A3E";
    case "review":
      return "#8B5CF6";
    case "blocked":
      return "#B44141";
    case "translating":
      return "#5A7A8F";
    default:
      return "rgba(142,136,118,0.45)";
  }
}

/* ── Empty / Loading ── */

function LoadingSkeleton() {
  return (
    <div className="space-y-xs">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full rounded-md" />
      ))}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  message,
}: {
  icon?: React.ReactNode;
  title?: string;
  message: string;
}) {
  return (
    <div className="flex h-[300px] flex-col items-center justify-center gap-sm">
      {icon}
      {title ? <p className="text-base font-medium text-foreground/80">{title}</p> : null}
      <p className="text-base text-muted-foreground">{message}</p>
    </div>
  );
}

/* ── Builders ── */

function buildLoreItems(
  byType: Record<LoreEntityType, LoreEntity[]>,
  rawTranslations: ExistingTranslation[],
): LoreItem[] {
  const tMap = new Map<string, ExistingTranslation>();
  for (const t of rawTranslations) {
    if (t.entityId && t.fieldKey) tMap.set(`${t.entityId}::${t.fieldKey}`, t);
  }

  const out: LoreItem[] = [];
  const fieldKeys = ["name", "description", "body"] as const;
  type FieldKey = (typeof fieldKeys)[number];
  const get: Record<FieldKey, (e: LoreEntity) => string | null | undefined> = {
    name: (e) => e.name ?? e.title,
    description: (e) => e.description,
    body: (e) => e.body,
  };

  for (const entityType of LORE_ENTITY_TYPES) {
    for (const entity of byType[entityType] ?? []) {
      let totalFields = 0;
      let translatedCount = 0;
      const statuses: string[] = [];
      let mostRecent = "";

      for (const fk of fieldKeys) {
        const v = get[fk](entity);
        if (!v || v.trim().length === 0) continue;
        totalFields++;
        const ex = tMap.get(`${entity.id}::${fk}`);
        if (ex?.translatedText) translatedCount++;
        statuses.push(ex?.status ?? "pending");
        if (ex?.updatedAt && ex.updatedAt > mostRecent) mostRecent = ex.updatedAt;
      }
      if (totalFields === 0) continue;

      const pct = totalFields === 0 ? 0 : Math.round((translatedCount / totalFields) * 100);
      const status: LocStatus =
        pct === 100
          ? statuses.every((s) => s === "approved" || s === "reviewed")
            ? "done"
            : "review"
          : pct === 0
            ? "pending"
            : "translating";

      out.push({
        id: entity.id,
        entityType,
        name: entity.name ?? entity.title ?? "이름 없음",
        status,
        pct,
        issues: 0,
        updated: relativeTime(mostRecent || entity.updatedAt || ""),
        translatedCount,
        totalFields,
      });
    }
  }
  return out;
}

function buildGroups(items: LoreItem[], groupBy: "entity" | "status") {
  if (groupBy === "status") {
    const order: LocStatus[] = ["translating", "review", "blocked", "pending", "done"];
    const labels: Record<LocStatus, string> = {
      translating: "번역중",
      review: "리뷰 필요",
      blocked: "이슈 있음",
      pending: "대기중",
      done: "완료",
    };
    const colors: Record<LocStatus, string> = {
      translating: "var(--primary)",
      review: "var(--accent-gold)",
      blocked: "var(--destructive)",
      pending: "var(--muted-foreground)",
      done: "var(--entity-location)",
    };
    return order
      .map((k) => ({
        key: k,
        label: labels[k],
        dotColor: colors[k],
        items: items.filter((it) => it.status === k),
      }))
      .filter((g) => g.items.length > 0);
  }

  return LORE_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    dotColor: g.entityVar,
    items: items.filter((it) => it.entityType === g.key),
  })).filter((g) => g.items.length > 0);
}

function rollup(items: LoreItem[]) {
  if (items.length === 0) return { pct: 0, done: 0, total: 0 };
  const total = items.length;
  const done = items.filter((it) => it.status === "done").length;
  const pct = Math.round(items.reduce((sum, it) => sum + it.pct, 0) / total);
  return { pct, done, total };
}

function relativeTime(iso: string): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.floor(d / 30);
  return `${mo}mo`;
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  ja: "日本語",
  "zh-CN": "中文 (简体)",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
  pt: "Português",
  ru: "Русский",
  th: "ภาษาไทย",
  id: "Bahasa Indonesia",
  ko: "한국어",
  vi: "Tiếng Việt",
  ar: "العربية",
  hi: "हिन्दी",
};
