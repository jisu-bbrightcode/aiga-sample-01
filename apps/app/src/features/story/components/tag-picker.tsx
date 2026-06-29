/**
 * Tag Picker — v8 popover (RelationPicker 와 동일 chrome).
 *
 * Layout:
 *   ┌─────────────────────────────────────────┐
 *   │ 태그            엔터로 새 태그 추가     ?│  head
 *   ├─────────────────────────────────────────┤
 *   │ Q 태그 검색...                          │  search
 *   ├─────────────────────────────────────────┤
 *   │ • 태그A                            ✓   │  list (virtualized)
 *   │ • 태그B                                │
 *   │ + "<query>" 태그 만들기                  │  inline create
 *   └─────────────────────────────────────────┘
 */

import { useAddEntityTag, useEntityTags, useRemoveEntityTag, useTags } from "@repo/data/hooks";
import { useDataBackend } from "@repo/data/provider";
import { useFeatureTranslation } from "@repo/core/i18n";
import { cn } from "@repo/ui/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/shadcn/popover";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Check, Plus, Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";

type EntityType = "world" | "character" | "location" | "faction" | "codex" | "draft";

const ROW_H = 32;
const LIST_MAX_H = 240;

interface Props {
  projectId: string;
  entityId: string;
  entityType: EntityType;
  children: React.ReactNode;
}

export function TagPicker({ projectId, entityId, entityType, children }: Props) {
  const { t } = useFeatureTranslation("feature.story");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const enabledProjectId = open ? projectId : "";
  const enabledEntityId = open ? entityId : "";

  const { data: allTags } = useTags(enabledProjectId);
  const { data: entityTags } = useEntityTags(enabledEntityId, entityType as never);
  const addEntityTag = useAddEntityTag();
  const removeEntityTag = useRemoveEntityTag();
  const backend = useDataBackend();
  const qc = useQueryClient();

  const entityTagIds = useMemo(
    () =>
      new Set(
        (entityTags as Array<{ tagId?: string; id?: string }> | undefined)?.map(
          (et) => et.tagId ?? et.id,
        ) ?? [],
      ),
    [entityTags],
  );

  type Tag = { id: string; name: string; color?: string | null };
  const tags = useMemo<Tag[]>(() => (allTags as Tag[] | undefined) ?? [], [allTags]);

  const filtered = useMemo<Tag[]>(() => {
    const q = search.trim().toLowerCase();
    return q ? tags.filter((t) => t.name.toLowerCase().includes(q)) : tags;
  }, [tags, search]);

  const exactMatch = useMemo(
    () => tags.some((t) => t.name.toLowerCase() === search.trim().toLowerCase()),
    [tags, search],
  );

  const showCreate = search.trim().length > 0 && !exactMatch;

  /* virtualization */
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_H,
    overscan: 8,
  });

  function handleToggle(tagId: string) {
    if (entityTagIds.has(tagId)) {
      const entityTag = (entityTags as Array<{ id: string; tagId?: string }> | undefined)?.find(
        (et) => (et.tagId ?? et.id) === tagId,
      );
      if (entityTag) removeEntityTag.mutate(entityTag.id);
    } else {
      const tagItem = tags.find((t) => t.id === tagId);
      addEntityTag.mutate({ entityId, entityType, tagId, tagName: tagItem?.name ?? "" });
    }
  }

  async function handleCreate() {
    const tagName = search.trim();
    if (!tagName) return;
    setSearch("");
    try {
      await backend.entityTags.addWithCreatedTag({
        projectId,
        entityId,
        entityType: entityType as never,
        tagName,
      });
      qc.invalidateQueries({ queryKey: ["story", "tags"] });
      qc.invalidateQueries({ queryKey: ["story", "entityTags", entityId] });
    } catch (err) {
      console.warn("[tag-picker] addWithCreatedTag failed:", err);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (showCreate) handleCreate();
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger nativeButton={false} render={<span />}>
        {children}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        style={{ width: 320 }}
        className={cn(
          "gap-0 overflow-hidden p-0",
          // 디자인 mention-pop — bg #FAF8F2 (cream surface), border #DED8C6
          "rounded-lg border border-border bg-[#faf8f2] shadow-md",
        )}
      >
        {/* head */}
        <div className="flex items-center gap-2 whitespace-nowrap px-3 py-2 text-xs">
          <span className="font-medium text-foreground">{t("picker.tag.head")}</span>
          <span className="ml-auto truncate font-mono text-xs text-muted-foreground/80">
            {t("picker.tag.enterToCreate")}
          </span>
          <span className="text-muted-foreground/50">?</span>
        </div>

        {/* search */}
        <div className="flex items-center gap-2 px-3 pb-1">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("picker.tag.searchPlaceholder")}
            className="h-7 w-full border-0 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground focus:outline-none focus:ring-0"
          />
        </div>

        {/* list */}
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            {search.trim() ? t("picker.tag.noMatch") : t("picker.tag.empty")}
          </div>
        ) : (
          <div ref={parentRef} className="overflow-y-auto px-1.5" style={{ maxHeight: LIST_MAX_H }}>
            <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((vi) => {
                const tag = filtered[vi.index];
                if (!tag) return null;
                const isLinked = entityTagIds.has(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleToggle(tag.id)}
                    className={cn(
                      "absolute left-0 right-0 flex items-center gap-2 rounded-[5px] px-2 text-left",
                      "hover:bg-muted focus-visible:bg-muted",
                      "outline-none",
                    )}
                    style={{ height: ROW_H, transform: `translateY(${vi.start}px)` }}
                  >
                    <span className="min-w-0 flex-1 truncate text-base font-medium text-foreground">
                      {tag.name}
                    </span>
                    <Check
                      className={cn(
                        "size-3.5 shrink-0 text-muted-foreground transition-opacity",
                        isLinked ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* inline create */}
        {showCreate ? (
          <div className="border-t border-border-subtle px-1.5 py-1">
            <button
              type="button"
              onClick={handleCreate}
              className={cn(
                "flex h-7 w-full items-center gap-2 rounded-[5px] px-2 text-left",
                "hover:bg-muted focus-visible:bg-muted",
                "outline-none",
              )}
            >
              <Plus className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate text-base text-foreground">
                {t("picker.tag.createNamed", { name: search.trim() })}
              </span>
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
