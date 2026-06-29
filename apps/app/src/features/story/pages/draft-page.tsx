/**
 * Drafts.html implements a lightweight idea-capture page:
 * quick capture, status tabs, note-style index cards, and metadata outside
 * each card. The React page recreates that visual/interaction surface while
 * preserving the existing /drafts/$draftId detail editor route.
 */
import { useFeatureTranslation } from "@repo/core/i18n";
import {
  useCreateDraft,
  useDeleteDraft,
  useDraft,
  useDrafts,
  useUpdateDraft,
} from "@repo/data/hooks";
import { PageLayout } from "@repo/ui/components/page-layout";
import { Button } from "@repo/ui/shadcn/button";
import { Input } from "@repo/ui/shadcn/input";
import { Skeleton } from "@repo/ui/shadcn/skeleton";
import { Textarea } from "@repo/ui/shadcn/textarea";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowDownUp, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DraftIndexCardEditor, DraftIndexCardPreview } from "../components/draft-index-card";

type TFn = (key: string, options?: Record<string, unknown>) => string;

type FilterValue = "all" | "pinned" | "tagged";
type SortValue = "latest" | "oldest";

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Route-level data wiring is explicit; visual pieces are split below.
export function DraftPage() {
  const { t } = useFeatureTranslation("feature.story");
  const { projectId, draftId } = useParams({ strict: false }) as {
    projectId: string;
    draftId?: string;
  };
  const navigate = useNavigate();

  const [filter, setFilter] = useState<FilterValue>("all");
  const [sort, setSort] = useState<SortValue>("latest");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");

  const detailQueryId = draftId && isUuid(draftId) ? draftId : "";
  const { data: drafts, isLoading } = useDrafts(projectId);
  const selectedDraftQuery = useDraft(detailQueryId);
  const createDraft = useCreateDraft();
  const updateDraft = useUpdateDraft();
  const deleteDraft = useDeleteDraft();

  const draftList = (drafts ?? []) as DraftItem[];
  const selectedDraftFromList = draftId
    ? (draftList.find((draft) => draft.id === draftId) ?? null)
    : null;
  const selectedDraft = draftId
    ? (((selectedDraftQuery.data as DraftItem | null | undefined) ??
        selectedDraftFromList) as DraftItem | null)
    : null;
  const counts = getDraftCounts(draftList);
  const visibleDrafts = sortDrafts(filterDrafts(searchDrafts(draftList, search), filter), sort);

  const handleCreate = () => {
    createDraft.mutate(
      { projectId, title: t("draft.defaults.newDraft") },
      {
        onSuccess: (data: unknown) => {
          const result = data as { id: string } | undefined;
          if (result?.id) {
            navigate({ to: `/p/${projectId}/drafts/${result.id}` });
          }
        },
      },
    );
  };

  const handleQuickCapture = (content: string, onCreated: () => void) => {
    createDraft.mutate(
      {
        projectId,
        title: deriveDraftTitle(content, t),
        description: content,
      },
      { onSuccess: onCreated },
    );
  };

  const handleSelect = (id: string) => {
    if (isOptimisticDraftId(id)) return;
    navigate({ to: `/p/${projectId}/drafts/${id}` });
  };

  const handleBack = () => {
    navigate({ to: `/p/${projectId}/drafts` });
  };

  const handleSave = (id: string, patch: DraftPatch) => {
    updateDraft.mutate({ id, ...patch });
  };

  const handleDelete = (id: string) => {
    deleteDraft.mutate(id, {
      onSuccess: () => {
        navigate({ to: `/p/${projectId}/drafts` });
      },
    });
  };

  return (
    <DraftPageFrame
      counts={counts}
      drafts={visibleDrafts}
      filter={filter}
      isCreating={createDraft.isPending}
      isDetailLoading={Boolean(detailQueryId && selectedDraftQuery.isLoading && !selectedDraft)}
      isLoading={isLoading}
      search={search}
      searchOpen={searchOpen}
      selectedDraft={selectedDraft}
      selectedId={draftId}
      sort={sort}
      t={t}
      onAdd={handleCreate}
      onBack={handleBack}
      onCapture={handleQuickCapture}
      onDelete={handleDelete}
      onFilterChange={setFilter}
      onSave={handleSave}
      onSearchChange={setSearch}
      onSearchToggle={() => setSearchOpen((open) => !open)}
      onSelect={handleSelect}
      onSortToggle={() => setSort((value) => (value === "latest" ? "oldest" : "latest"))}
    />
  );
}

/* Components */

interface DraftPageFrameProps {
  counts: DraftCounts;
  drafts: DraftItem[];
  filter: FilterValue;
  isCreating: boolean;
  isDetailLoading: boolean;
  isLoading: boolean;
  search: string;
  searchOpen: boolean;
  selectedDraft?: DraftItem | null;
  selectedId?: string;
  sort: SortValue;
  t: TFn;
  onAdd: () => void;
  onBack: () => void;
  onCapture: (content: string, onCreated: () => void) => void;
  onDelete: (id: string) => void;
  onFilterChange: (value: FilterValue) => void;
  onSave: (id: string, patch: DraftPatch) => void;
  onSearchChange: (value: string) => void;
  onSearchToggle: () => void;
  onSelect: (id: string) => void;
  onSortToggle: () => void;
}

function DraftPageFrame({
  counts,
  drafts,
  filter,
  isCreating,
  isDetailLoading,
  isLoading,
  search,
  searchOpen,
  selectedDraft,
  selectedId,
  sort,
  t,
  onAdd,
  onBack,
  onCapture,
  onDelete,
  onFilterChange,
  onSave,
  onSearchChange,
  onSearchToggle,
  onSelect,
  onSortToggle,
}: DraftPageFrameProps) {
  return (
    <PageLayout
      crumbs={[{ label: t("draft.crumbs.write") }, { label: t("draft.crumbs.draft") }]}
      onAdd={selectedId ? undefined : onAdd}
      addLabel={t("draft.list.add")}
      onBack={selectedId ? onBack : undefined}
    >
      {selectedId ? null : (
        <DraftSubbar
          counts={counts}
          filter={filter}
          onFilterChange={onFilterChange}
          search={search}
          searchOpen={searchOpen}
          sort={sort}
          t={t}
          onSearchChange={onSearchChange}
          onSearchToggle={onSearchToggle}
          onSortToggle={onSortToggle}
        />
      )}

      <DraftContent
        isLoading={isLoading}
        isDetailLoading={isDetailLoading}
        drafts={drafts}
        selectedId={selectedId}
        selectedDraft={selectedDraft}
        isCreating={isCreating}
        t={t}
        onSelect={onSelect}
        onCapture={onCapture}
        onSave={onSave}
        onDelete={onDelete}
      />
    </PageLayout>
  );
}

interface DraftItem {
  id: string;
  title?: string | null;
  description?: string | null;
  body?: string | null;
  updatedAt?: string | Date | null;
  createdAt?: string | Date | null;
}

interface DraftCounts {
  all: number;
  pinned: number;
  tagged: number;
}

interface DraftSubbarProps {
  counts: DraftCounts;
  filter: FilterValue;
  onFilterChange: (value: FilterValue) => void;
  search: string;
  searchOpen: boolean;
  sort: SortValue;
  t: TFn;
  onSearchChange: (value: string) => void;
  onSearchToggle: () => void;
  onSortToggle: () => void;
}

function DraftSubbar({
  counts,
  filter,
  onFilterChange,
  search,
  searchOpen,
  sort,
  t,
  onSearchChange,
  onSearchToggle,
  onSortToggle,
}: DraftSubbarProps) {
  const statusTabs = getStatusTabs(t);
  return (
    <div
      data-el="draft-subbar"
      className="flex h-11 shrink-0 items-center justify-between gap-3 px-7 text-base"
    >
      <div className="flex min-w-0 items-center gap-1" data-el="draft-subbar.status-tabs">
        {statusTabs.map((tab) => {
          const active = filter === tab.value;
          return (
            <Button
              key={tab.value}
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`${tab.label} ${counts[tab.value]}`}
              aria-pressed={active}
              onClick={() => onFilterChange(tab.value)}
              className={`h-7 rounded-md px-2.5 text-xs font-medium ${
                active
                  ? "bg-[color-mix(in_srgb,var(--foreground)_9%,transparent)] text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              <span className="ml-1.5 font-mono text-2xs opacity-70">{counts[tab.value]}</span>
            </Button>
          );
        })}
      </div>

      <div className="flex min-w-0 items-center justify-end gap-1.5" data-el="draft-subbar.tools">
        {searchOpen ? (
          <Input
            data-el="draft-subbar.search-input"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("draft.subbar.searchPlaceholder")}
            className="h-7 w-[min(210px,42vw)] rounded-md border-border bg-card px-2 text-xs shadow-none focus-visible:ring-1"
            autoFocus
          />
        ) : null}
        <Button
          data-el="draft-subbar.search"
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("draft.subbar.searchAria")}
          aria-pressed={searchOpen}
          onClick={onSearchToggle}
          className="size-7 rounded-md text-muted-foreground hover:text-foreground"
        >
          <Search className="size-3.5" />
        </Button>
        <Button
          data-el="draft-subbar.sort"
          type="button"
          variant="ghost"
          size="icon"
          aria-label={sort === "latest" ? t("draft.subbar.sortLatest") : t("draft.subbar.sortOldest")}
          onClick={onSortToggle}
          className="size-7 rounded-md text-muted-foreground hover:text-foreground"
        >
          <ArrowDownUp className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

interface DraftContentProps {
  isLoading: boolean;
  isDetailLoading: boolean;
  drafts: DraftItem[];
  selectedId?: string;
  selectedDraft?: DraftItem | null;
  isCreating: boolean;
  t: TFn;
  onSelect: (id: string) => void;
  onCapture: (content: string, onCreated: () => void) => void;
  onSave: (id: string, patch: DraftPatch) => void;
  onDelete: (id: string) => void;
}

interface DraftPatch {
  title?: string;
  description?: string;
  body?: string;
}

function DraftContent({
  isLoading,
  isDetailLoading,
  drafts,
  selectedId,
  selectedDraft,
  isCreating,
  t,
  onSelect,
  onCapture,
  onSave,
  onDelete,
}: DraftContentProps) {
  if (selectedId) {
    return (
      <div className="flex min-h-0 flex-1 overflow-auto px-7 pb-10 pt-2">
        <div className="mx-auto w-full max-w-[680px]">
          <DraftDetailPane
            draft={selectedDraft}
            isLoading={isDetailLoading}
            t={t}
            onSave={onSave}
            onDelete={onDelete}
          />
        </div>
      </div>
    );
  }

  const board = (
    <DraftBoard
      isLoading={isLoading}
      drafts={drafts}
      selectedId={selectedId}
      isCreating={isCreating}
      t={t}
      onSelect={onSelect}
      onCapture={onCapture}
    />
  );

  return board;
}

interface DraftBoardProps {
  isLoading: boolean;
  drafts: DraftItem[];
  selectedId?: string;
  isCreating: boolean;
  t: TFn;
  onSelect: (id: string) => void;
  onCapture: (content: string, onCreated: () => void) => void;
}

function DraftBoard({
  isLoading,
  drafts,
  selectedId,
  isCreating,
  t,
  onSelect,
  onCapture,
}: DraftBoardProps) {
  const pinnedDrafts = drafts.filter(isPinnedDraft);
  const regularDrafts = drafts.filter((draft) => !isPinnedDraft(draft));

  return (
    <div
      data-el="drafts.content"
      className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto px-7 pb-10 pt-2"
    >
      <DraftQuickCapture isPending={isCreating} t={t} onCapture={onCapture} />

      <DraftBoardBody
        isLoading={isLoading}
        pinnedDrafts={pinnedDrafts}
        regularDrafts={regularDrafts}
        selectedId={selectedId}
        t={t}
        onSelect={onSelect}
      />
    </div>
  );
}

interface DraftBoardBodyProps {
  isLoading: boolean;
  pinnedDrafts: DraftItem[];
  regularDrafts: DraftItem[];
  selectedId?: string;
  t: TFn;
  onSelect: (id: string) => void;
}

function DraftBoardBody({
  isLoading,
  pinnedDrafts,
  regularDrafts,
  selectedId,
  t,
  onSelect,
}: DraftBoardBodyProps) {
  if (isLoading) return <DraftCardSkeleton />;
  if (pinnedDrafts.length === 0 && regularDrafts.length === 0) return <DraftEmptyState t={t} />;

  return (
    <>
      {pinnedDrafts.length > 0 ? (
        <DraftSection
          label={t("draft.section.pinned")}
          drafts={pinnedDrafts}
          selectedId={selectedId}
          t={t}
          onSelect={onSelect}
        />
      ) : null}
      {regularDrafts.length > 0 ? (
        <DraftSection
          label={pinnedDrafts.length > 0 ? t("draft.section.other") : null}
          drafts={regularDrafts}
          selectedId={selectedId}
          t={t}
          onSelect={onSelect}
        />
      ) : null}
    </>
  );
}

interface DraftQuickCaptureProps {
  isPending: boolean;
  t: TFn;
  onCapture: (content: string, onCreated: () => void) => void;
}

function DraftQuickCapture({ isPending, t, onCapture }: DraftQuickCaptureProps) {
  const [value, setValue] = useState("");
  const canSave = value.trim().length > 0 && !isPending;

  const submit = () => {
    const content = value.trim();
    if (!content || isPending) return;
    onCapture(content, () => setValue(""));
  };

  return (
    <form
      data-el="draft-capture"
      className="flex flex-col gap-2 rounded-[10px] border border-border bg-card px-3.5 py-3 shadow-[0_1px_2px_rgba(31,29,24,0.03)]"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Textarea
        data-el="draft-capture.input"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        }}
        placeholder={t("draft.capture.placeholder")}
        rows={2}
        className="min-h-11 resize-none border-0 bg-transparent px-0 py-0 text-base leading-[1.55] shadow-none focus-visible:ring-0 md:text-base"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-border-subtle pt-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <kbd className="rounded-[3px] border border-border bg-muted px-1.5 py-px font-mono text-2xs leading-none">
            @
          </kbd>
          <span>{t("draft.capture.hint.mention")}</span>
          <kbd className="rounded-[3px] border border-border bg-muted px-1.5 py-px font-mono text-2xs leading-none">
            #
          </kbd>
          <span>{t("draft.capture.hint.tag")}</span>
          <kbd className="rounded-[3px] border border-border bg-muted px-1.5 py-px font-mono text-2xs leading-none">
            ⌘V
          </kbd>
          <span>{t("draft.capture.hint.pasteImage")}</span>
          <kbd className="rounded-[3px] border border-border bg-muted px-1.5 py-px font-mono text-2xs leading-none">
            ⌘↵
          </kbd>
          <span>{t("draft.capture.hint.save")}</span>
        </div>
        <Button
          data-el="draft-capture.save"
          type="submit"
          disabled={!canSave}
          className="h-[30px] rounded-md bg-primary px-3.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t("draft.capture.save")}
        </Button>
      </div>
    </form>
  );
}

interface DraftSectionProps {
  label: string | null;
  drafts: DraftItem[];
  selectedId?: string;
  t: TFn;
  onSelect: (id: string) => void;
}

function DraftSection({ label, drafts, selectedId, t, onSelect }: DraftSectionProps) {
  return (
    <section className="flex flex-col gap-2.5" data-el="draft-section">
      {label ? (
        <div className="pl-0.5 font-mono text-2xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
          {label}
        </div>
      ) : null}
      <div
        data-el="draft-grid"
        className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-[18px]"
      >
        {drafts.map((draft) => (
          <DraftCard
            key={draft.id}
            draft={draft}
            selected={selectedId === draft.id}
            t={t}
            onSelect={() => onSelect(draft.id)}
          />
        ))}
      </div>
    </section>
  );
}

interface DraftCardProps {
  draft: DraftItem;
  selected: boolean;
  t: TFn;
  onSelect: () => void;
}

function DraftCard({ draft, selected, t, onSelect }: DraftCardProps) {
  const title = draft.title?.trim() || t("draft.card.untitled");
  const text = getDraftPreviewText(draft);
  const tags = extractDraftTags(draft);
  const pinned = isPinnedDraft(draft);
  const optimistic = isOptimisticDraftId(draft.id);

  return (
    <DraftIndexCardPreview
      id={draft.id}
      isDisabled={optimistic}
      isPinned={pinned}
      isSelected={selected}
      metadata={formatRelativeTime(draft.updatedAt ?? draft.createdAt, t)}
      tags={tags}
      text={text}
      title={title}
      onSelect={onSelect}
    />
  );
}

interface DraftDetailPaneProps {
  draft?: DraftItem | null;
  isLoading: boolean;
  t: TFn;
  onSave: (id: string, patch: DraftPatch) => void;
  onDelete: (id: string) => void;
}

function DraftDetailPane({ draft, isLoading, t, onSave, onDelete }: DraftDetailPaneProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2" data-el="draft-detail.skeleton">
        <Skeleton className="h-4 w-24 rounded-sm" />
        <Skeleton className="min-h-[520px] rounded-lg" />
        <div className="flex items-center justify-between px-1">
          <Skeleton className="h-3 w-14 rounded-sm" />
          <Skeleton className="h-3 w-20 rounded-sm" />
        </div>
      </div>
    );
  }
  if (!draft) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-border bg-card">
        <div className="text-base text-muted-foreground">{t("draft.detail.notFound")}</div>
      </div>
    );
  }

  return <DraftExpandedCardEditor draft={draft} t={t} onSave={onSave} onDelete={onDelete} />;
}

interface DraftEditorProps {
  draft: DraftItem;
  t: TFn;
  onSave: (id: string, patch: DraftPatch) => void;
  onDelete: (id: string) => void;
}

function DraftExpandedCardEditor({ draft, t, onSave, onDelete }: DraftEditorProps) {
  const draftTitle = draft.title ?? "";
  const draftDescription = getEditableDraftTextFromFields(draft.description, draft.title);
  const syncedDraftId = useRef<string | null>(null);
  const lastSavedRef = useRef({
    title: draftTitle,
    description: draftDescription,
  });
  const [title, setTitle] = useState(draftTitle);
  const [description, setDescription] = useState(() => draftDescription);

  useEffect(() => {
    if (syncedDraftId.current === draft.id) return;
    syncedDraftId.current = draft.id;
    const nextDescription = draftDescription;
    lastSavedRef.current = { title: draftTitle, description: nextDescription };
    setTitle(draftTitle);
    setDescription(nextDescription);
  }, [draft.id, draftDescription, draftTitle]);

  useEffect(() => {
    const saved = lastSavedRef.current;
    const normalizedTitle = title.trim();
    const patch: DraftPatch = {};
    if (normalizedTitle && normalizedTitle !== saved.title) patch.title = normalizedTitle;
    if (description !== saved.description) patch.description = description;
    if (!patch.title && patch.description === undefined) return;

    const timer = window.setTimeout(() => {
      onSave(draft.id, patch);
      lastSavedRef.current = {
        title: patch.title ?? saved.title,
        description: patch.description ?? saved.description,
      };
    }, AUTO_SAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [description, draft.id, onSave, title]);

  const tags = extractDraftTags({ ...draft, description });
  const pinned = isPinnedDraft({ ...draft, description, title });

  return (
    <DraftIndexCardEditor
      description={description}
      isPinned={pinned}
      metadata={formatRelativeTime(draft.updatedAt ?? draft.createdAt, t)}
      tags={tags}
      title={title}
      onDelete={() => onDelete(draft.id)}
      onDescriptionChange={setDescription}
      onTitleChange={setTitle}
    />
  );
}

function DraftCardSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-[18px]">
      {CARD_SKELETON_KEYS.map((key) => (
        <div key={key} className="space-y-2" data-el="draft-card.skeleton">
          <Skeleton className="aspect-[5/3] rounded-lg" />
          <div className="flex items-center justify-between gap-3 px-1">
            <Skeleton className="h-3 w-14 rounded-sm" />
            <Skeleton className="h-3 w-20 rounded-sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DraftEmptyState({ t }: { t: TFn }) {
  return (
    <div
      data-el="draft-empty"
      className="flex min-h-[280px] flex-col items-center justify-center rounded-lg border border-dashed border-border-subtle bg-card/45 px-6 text-center"
    >
      <div className="mb-3 text-3xl leading-none text-muted-foreground">✱</div>
      <p className="whitespace-pre-line text-base leading-6 text-muted-foreground">
        {t("draft.empty.message")}
      </p>
    </div>
  );
}

/* Constants */

function getStatusTabs(t: TFn): Array<{ label: string; value: FilterValue }> {
  return [
    { label: t("draft.statusTabs.all"), value: "all" },
    { label: t("draft.statusTabs.pinned"), value: "pinned" },
    { label: t("draft.statusTabs.tagged"), value: "tagged" },
  ];
}

const CARD_SKELETON_KEYS = [
  "draft-card-skeleton-1",
  "draft-card-skeleton-2",
  "draft-card-skeleton-3",
  "draft-card-skeleton-4",
  "draft-card-skeleton-5",
  "draft-card-skeleton-6",
];

const AUTO_SAVE_DELAY_MS = 450;

/* Helpers */

function getDraftCounts(drafts: DraftItem[]): DraftCounts {
  return {
    all: drafts.length,
    pinned: drafts.filter(isPinnedDraft).length,
    tagged: drafts.filter((draft) => extractDraftTags(draft).length > 0).length,
  };
}

function searchDrafts(drafts: DraftItem[], search: string): DraftItem[] {
  const query = search.trim().toLowerCase();
  if (!query) return drafts;
  return drafts.filter((draft) => {
    const haystack = [draft.title, draft.description, draft.body].filter(Boolean).join("\n");
    return haystack.toLowerCase().includes(query);
  });
}

function filterDrafts(drafts: DraftItem[], filter: FilterValue): DraftItem[] {
  if (filter === "all") return drafts;
  if (filter === "pinned") return drafts.filter(isPinnedDraft);
  return drafts.filter((draft) => extractDraftTags(draft).length > 0);
}

function sortDrafts(drafts: DraftItem[], sort: SortValue): DraftItem[] {
  return [...drafts].sort((a, b) => {
    const aTime = getDraftTime(a);
    const bTime = getDraftTime(b);
    return sort === "latest" ? bTime - aTime : aTime - bTime;
  });
}

function getDraftTime(draft: DraftItem): number {
  const value = draft.updatedAt ?? draft.createdAt;
  if (!value) return 0;
  const date = typeof value === "string" ? new Date(value) : value;
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function deriveDraftTitle(content: string, t: TFn): string {
  const firstLine = content
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) return t("draft.defaults.quickMemo");
  return firstLine.replace(/^#+\s*/, "").slice(0, 80);
}

function getDraftPreviewText(draft: DraftItem): string {
  const description = getEditableDraftText(draft);
  if (description) return description;

  const body = draft.body?.trim();
  if (!body) return "";

  const storyDocText = extractStoryDocText(body);
  return storyDocText || body;
}

function getEditableDraftText(draft: DraftItem): string {
  return getEditableDraftTextFromFields(draft.description, draft.title);
}

function getEditableDraftTextFromFields(
  descriptionValue: string | null | undefined,
  titleValue: string | null | undefined,
): string {
  const description = descriptionValue?.trim();
  if (!description) return "";
  return removeDuplicatedTitleLine(description, titleValue);
}

function extractStoryDocText(body: string): string {
  try {
    const parsed = JSON.parse(body);
    const text = collectText(parsed).trim();
    return text;
  } catch {
    return "";
  }
}

function collectText(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(collectText).filter(Boolean).join("\n");
  if (typeof value !== "object") return "";

  const record = value as Record<string, unknown>;
  const ownText = typeof record.text === "string" ? record.text : "";
  const children = collectText(record.content ?? record.children);
  return [ownText, children].filter(Boolean).join("\n");
}

function extractDraftTags(draft: DraftItem): string[] {
  const text = [draft.title, draft.description, draft.body].filter(Boolean).join("\n");
  const matches = text.match(/#[\p{L}\p{N}_-]+/gu) ?? [];
  return Array.from(new Set(matches.map((tag) => tag.slice(1)))).slice(0, 4);
}

function removeDuplicatedTitleLine(text: string, title: string | null | undefined): string {
  const normalizedTitle = title?.trim();
  if (!normalizedTitle) return text;
  const lines = text.split("\n");
  const firstTextLineIndex = lines.findIndex((line) => line.trim().length > 0);
  if (firstTextLineIndex < 0) return text;
  if (lines[firstTextLineIndex]?.trim() !== normalizedTitle) return text;
  return lines
    .slice(firstTextLineIndex + 1)
    .join("\n")
    .trim();
}

function isPinnedDraft(draft: DraftItem): boolean {
  const text = [draft.title, draft.description].filter(Boolean).join("\n").toLowerCase();
  // 한글 hashtag — user-input 매칭 (i18n 예외: 사용자가 직접 "#고정"을 입력해야 함)
  return text.includes("#고정") || text.includes("#pinned") || text.startsWith("📌");
}

function isOptimisticDraftId(id: string): boolean {
  return id.startsWith("temp-");
}

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function formatRelativeTime(value: string | Date | null | undefined, t: TFn): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  const time = date.getTime();
  if (Number.isNaN(time)) return "—";
  const diff = (Date.now() - time) / 1000;
  if (diff < 60) return t("draft.card.timeAgo.justNow");
  if (diff < 3600) return t("draft.card.timeAgo.minutes", { count: Math.floor(diff / 60) });
  if (diff < 86_400) return t("draft.card.timeAgo.hours", { count: Math.floor(diff / 3600) });
  if (diff < 604_800) return t("draft.card.timeAgo.days", { count: Math.floor(diff / 86_400) });
  if (diff < 2_592_000) return t("draft.card.timeAgo.weeks", { count: Math.floor(diff / 604_800) });
  return t("draft.card.timeAgo.months", { count: Math.floor(diff / 2_592_000) });
}
