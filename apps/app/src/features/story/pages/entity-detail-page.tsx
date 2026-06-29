"use no memo";

import { ANALYTICS_EVENTS, captureEvent, setProjectGroup } from "@repo/core/analytics/client";
import { useFeatureTranslation } from "@repo/core/i18n";
import {
  useAllDomainDeletes,
  useAllDomainUpdates,
  useCharacter,
  useCharacters,
  useCodexEntry,
  useDeleteRelation,
  useEntityProperties,
  useEntityTags,
  useFaction,
  useFactions,
  useLocation,
  useLocations,
  useRelations,
  useRemoveEntityTag,
  useUploadEntityImageSmall,
  useWorld,
  useWorlds,
} from "@repo/data/hooks";
import type { EntityType } from "@repo/data/types";
import { cn } from "@repo/ui/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/shadcn/avatar";
import { Button } from "@repo/ui/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@repo/ui/shadcn/dropdown-menu";
import { Input } from "@repo/ui/shadcn/input";
import { useSidebar } from "@repo/ui/shadcn/sidebar";
import { Textarea } from "@repo/ui/shadcn/textarea";
import { useNavigate, useParams } from "@tanstack/react-router";
import { BookMarked, Link2, Plus, Tag, Trash2, Users, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  deriveDocumentStats,
  type DocumentContent,
  DocumentEditor,
  parseStoredDocument,
  stringifyDocumentContent,
} from "@/features/document";
import { authClient } from "@/lib/auth-client";
import { ActorManageButton } from "../components/actor-manage-button";
import { RelationPicker } from "../components/relation-picker";
import { TagPicker } from "../components/tag-picker";
import { MetaSection, SidebarItem } from "../layouts/detail-layout";
import { DetailPageShell } from "../layouts/detail-page-shell";

interface Props {
  entityType: "world" | "character" | "location" | "faction" | "codex";
  projectId?: string;
  entityId?: string;
  embedded?: boolean;
  topbarAddon?: ReactNode;
}

type TFn = (key: string, opts?: Record<string, unknown>) => string;

type LoreEntityType = "world" | "character" | "location" | "faction" | "codex";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Existing detail surface owns editor and sidebar metadata in one route component.
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Existing route component is intentionally not split during FLT-394 error-message i18n cleanup.
export function EntityDetailPage({
  entityType,
  projectId: projectIdProp,
  entityId: entityIdProp,
  embedded = false,
  topbarAddon,
}: Props) {
  const { t, i18n } = useFeatureTranslation("feature.story");
  const params = useParams({ strict: false }) as {
    projectId?: string;
    entityId?: string;
  };
  const projectId = projectIdProp ?? params.projectId ?? "";
  const entityId = entityIdProp ?? params.entityId ?? "";
  const navigate = useNavigate();

  const loreEntityType: LoreEntityType = entityType;
  const metadataEntityType: EntityType = entityType;

  const { data: entity, isLoading } = useEntityQuery(entityType, entityId, projectId);
  const { data: entityTags } = useEntityTags(entityId, metadataEntityType);
  const { data: entityProperties } = useEntityProperties(entityId, loreEntityType);
  const { data: relations } = useRelations(entityId, metadataEntityType);
  void authClient.useSession();

  // ─── Sibling pager — 같은 entityType 내에서 1/N + ↑/↓ 이동
  const siblingWorlds = useWorlds(entityType === "world" ? projectId : "");
  const siblingChars = useCharacters(entityType === "character" ? projectId : "");
  const siblingLocs = useLocations(entityType === "location" ? projectId : "");
  const siblingFacs = useFactions(entityType === "faction" ? projectId : "");
  const siblingList = (() => {
    const map: Record<string, { data?: unknown }> = {
      world: siblingWorlds,
      character: siblingChars,
      location: siblingLocs,
      faction: siblingFacs,
    };
    const arr = (map[entityType]?.data as Array<{ id: string }> | undefined) ?? [];
    return arr.map((e) => String(e.id));
  })();
  const siblingIdx = siblingList.indexOf(entityId);
  const siblingTotal = siblingList.length;
  const _goSibling = (dir: -1 | 1) => {
    if (siblingTotal === 0) return;
    const i = siblingIdx < 0 ? 0 : siblingIdx;
    const j = (i + dir + siblingTotal) % siblingTotal;
    const targetId = siblingList[j];
    if (!targetId || targetId === entityId) return;
    const segment = ENTITY_TYPE_TO_ROUTE[entityType] ?? entityType;
    navigate({ to: `/p/${projectId}/lore/${segment}/${targetId}` });
  };

  const updateMutation = useUpdateMutation(entityType, projectId);
  const uploadImageSmall = useUploadEntityImageSmall();
  const deleteMutation = useDeleteMutation(entityType, projectId);
  const deleteRelation = useDeleteRelation();
  const removeEntityTag = useRemoveEntityTag();

  // entity 진입 — User Paths(세계관 영역 동선) 측정 + project group set.
  useEffect(() => {
    captureEvent(ANALYTICS_EVENTS.ENTITY_VIEWED, { entity_type: entityType });
    if (projectId) setProjectGroup(projectId);
  }, [entityType, entityId, projectId]);

  const bodyPendingSaveRef = useRef(false);
  const titleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const descriptionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPendingSave = useRef(false);
  const pendingSaveCount = useRef(0);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (
        hasPendingSave.current ||
        bodyPendingSaveRef.current ||
        titleDebounceRef.current ||
        descriptionDebounceRef.current
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const appSidebar = useSidebar();
  const containerRef = useRef<HTMLDivElement>(null);

  const entityName = String(entity?.name ?? "");
  const entityBody = (entity as Record<string, unknown>)?.body ?? "";
  const characterBio =
    entityType === "character"
      ? String((entity as { description?: unknown })?.description ?? "")
      : "";
  const characterRoles =
    entityType === "character"
      ? normalizeCharacterRoles((entity as { roles?: unknown })?.roles)
      : [];

  // ─── Title input state ───
  const [titleDraft, setTitleDraft] = useState(entityName ?? "");
  useEffect(() => {
    // Sync from server when entity loads/changes
    setTitleDraft(entityName ?? "");
  }, [entityName]);

  const [characterBioDraft, setCharacterBioDraft] = useState(characterBio);
  useEffect(() => {
    setCharacterBioDraft(characterBio);
  }, [characterBio]);

  const handleTitleChange = (next: string) => {
    setTitleDraft(next);
    hasPendingSave.current = true;
    if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
    titleDebounceRef.current = setTimeout(() => {
      const input = { id: entityId, name: next.trim() };
      titleDebounceRef.current = null;
      pendingSaveCount.current += 1;
      hasPendingSave.current = true;
      void updateMutation
        .mutateAsync(input as never)
        .catch((error) => {
          console.error("title update failed", error);
        })
        .finally(() => {
          pendingSaveCount.current = Math.max(0, pendingSaveCount.current - 1);
          hasPendingSave.current =
            pendingSaveCount.current > 0 ||
            Boolean(bodyPendingSaveRef.current) ||
            Boolean(titleDebounceRef.current) ||
            Boolean(descriptionDebounceRef.current);
        });
    }, 2000);
  };

  const handleCharacterRolesChange = (nextRoles: string[]) => {
    if (entityType !== "character") return;
    pendingSaveCount.current += 1;
    hasPendingSave.current = true;
    void updateMutation
      .mutateAsync({ id: entityId, roles: nextRoles } as never)
      .catch((error) => {
        console.error("character roles update failed", error);
        toast.error(t("entity.detail.errors.rolesSave"));
      })
      .finally(() => {
        pendingSaveCount.current = Math.max(0, pendingSaveCount.current - 1);
        hasPendingSave.current =
          pendingSaveCount.current > 0 ||
          Boolean(bodyPendingSaveRef.current) ||
          Boolean(titleDebounceRef.current) ||
          Boolean(descriptionDebounceRef.current);
      });
  };

  const handleCharacterBioChange = (next: string) => {
    if (entityType !== "character") return;
    const limited = next.slice(0, CHARACTER_BIO_MAX_LENGTH);
    setCharacterBioDraft(limited);
    hasPendingSave.current = true;
    if (descriptionDebounceRef.current) clearTimeout(descriptionDebounceRef.current);
    descriptionDebounceRef.current = setTimeout(() => {
      descriptionDebounceRef.current = null;
      pendingSaveCount.current += 1;
      hasPendingSave.current = true;
      void updateMutation
        .mutateAsync({ id: entityId, description: limited } as never)
        .catch((error) => {
          console.error("character bio update failed", error);
          toast.error(t("entity.detail.errors.bioSave"));
        })
        .finally(() => {
          pendingSaveCount.current = Math.max(0, pendingSaveCount.current - 1);
          hasPendingSave.current =
            pendingSaveCount.current > 0 ||
            Boolean(bodyPendingSaveRef.current) ||
            Boolean(titleDebounceRef.current) ||
            Boolean(descriptionDebounceRef.current);
        });
    }, 1200);
  };

  const titlePlaceholder = t(getTitlePlaceholderKey(entityType));
  const imageSmallUrl =
    entityType === "character"
      ? entityProperties?.properties?.find((property) => property.key === "imageSmallUrl")?.value
      : undefined;
  const [optimisticImageSmallUrl, setOptimisticImageSmallUrl] = useState<string | undefined>();
  useEffect(() => {
    void entityId;
    setOptimisticImageSmallUrl(undefined);
  }, [entityId]);

  const handleImageSmallSelect = async (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setOptimisticImageSmallUrl(previewUrl);
    try {
      const bytesBase64 = await fileToBase64(file);
      const result = await uploadImageSmall.mutateAsync({
        projectId,
        entityId,
        entityType: loreEntityType,
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        bytesBase64,
      });
      setOptimisticImageSmallUrl(result.imageSmallUrl);
    } catch {
      setOptimisticImageSmallUrl(undefined);
      toast.error(t("entity.detail.imageUploadError"));
    } finally {
      URL.revokeObjectURL(previewUrl);
    }
  };

  // ─── Body doc state ───
  // 본문 hydrate sticky — 첫 nonempty body 받은 시점만 key bump 후 stable.
  // 사용자가 본문 모두 지워도 key 유지 (입력 lost 방지).
  // initialDoc 이 빈 → 채워지는 transition 만 capture.
  const bodyReadyRef = useRef(false);
  if (typeof entityBody === "string" && entityBody.length > 0) {
    bodyReadyRef.current = true;
  }
  const bodyState = bodyReadyRef.current ? "ready" : "loading";

  const initialDoc: DocumentContent | null = entity ? parseStoredDocument(entityBody) : null;

  const initialStats = deriveDocumentStats(initialDoc);
  const [mentionCounts, setMentionCounts] = useState<Map<string, number>>(
    initialStats.mentionCounts,
  );
  const [bodyCharCount, setBodyCharCount] = useState<number>(initialStats.bodyCharCount);

  useEffect(() => {
    const nextDoc = entity ? parseStoredDocument(entityBody) : null;
    const nextStats = deriveDocumentStats(nextDoc);
    setMentionCounts(nextStats.mentionCounts);
    setBodyCharCount(nextStats.bodyCharCount);
  }, [entity, entityBody]);

  const handleBodyChange = async (doc: DocumentContent) => {
    pendingSaveCount.current += 1;
    hasPendingSave.current = true;
    const stats = deriveDocumentStats(doc);
    setMentionCounts(stats.mentionCounts);
    setBodyCharCount(stats.bodyCharCount);
    try {
      const input = { id: entityId, body: stringifyDocumentContent(doc) };
      await updateMutation.mutateAsync(input as never);
      // Retention return 신호 — autosave flush 1회당 1건 (instance debounce 2000ms).
      captureEvent(ANALYTICS_EVENTS.ENTITY_UPDATED, { entity_type: entityType });
    } finally {
      pendingSaveCount.current = Math.max(0, pendingSaveCount.current - 1);
      hasPendingSave.current =
        pendingSaveCount.current > 0 ||
        Boolean(bodyPendingSaveRef.current) ||
        Boolean(titleDebounceRef.current) ||
        Boolean(descriptionDebounceRef.current);
    }
  };

  const handleDelete = () => {
    deleteMutation.mutate(entityId as never, {
      onSuccess: () => {
        if (embedded) return;
        navigate({ to: `/p/${projectId}/lore` });
      },
    });
  };

  const handleRelationNavigate = (targetType: string, targetId: string) => {
    const routeSegment = ENTITY_TYPE_TO_ROUTE[targetType] ?? targetType;
    navigate({ to: `/p/${projectId}/lore/${routeSegment}/${targetId}` });
  };

  const config = getEntityDetailConfig(t, entityType);
  const backRoute = `/p/${projectId}/lore`;
  const handleBack = () => {
    if (embedded) return;
    navigate({ to: backRoute });
  };
  const detailBreadcrumbs = [
    {
      label: t("entity.detail.crumbs.lore"),
      onClick: embedded ? undefined : () => navigate({ to: backRoute }),
    },
    {
      label: config.label,
      onClick: embedded ? undefined : () => navigate({ to: backRoute }),
    },
  ];
  const detailSidebar = entity ? (
    <>
      <RelationSection
        title={t("entity.detail.sidebar.people")}
        icon={<Users className="size-3.5 text-muted-foreground" />}
        relations={
          (relations as Record<string, unknown>[] | undefined)?.filter(
            (r) => String(r.targetEntityType) === "character",
          ) ?? []
        }
        mentionCounts={mentionCounts}
        onNavigate={handleRelationNavigate}
        onDelete={(id) => deleteRelation.mutate(id)}
        t={t}
        addButton={
          <RelationPicker
            projectId={projectId}
            sourceId={entityId}
            sourceType={metadataEntityType}
            initialType="character"
            existingTargetIds={
              new Set(
                (relations as Record<string, unknown>[] | undefined)?.map((r) =>
                  String(r.targetEntityId),
                ) ?? [],
              )
            }
          >
            <span className="cursor-pointer text-base text-muted-foreground/60 hover:text-muted-foreground">
              {t("entity.detail.sidebar.peopleAdd")}
            </span>
          </RelationPicker>
        }
      />

      <RelationSection
        title={t("entity.detail.sidebar.links")}
        icon={<Link2 className="size-3.5 text-muted-foreground" />}
        relations={
          (relations as Record<string, unknown>[] | undefined)?.filter(
            (r) => String(r.targetEntityType) !== "character",
          ) ?? []
        }
        mentionCounts={mentionCounts}
        onNavigate={handleRelationNavigate}
        onDelete={(id) => deleteRelation.mutate(id)}
        showTypeBadge
        t={t}
        addButton={
          <RelationPicker
            projectId={projectId}
            sourceId={entityId}
            sourceType={metadataEntityType}
            existingTargetIds={
              new Set(
                (relations as Record<string, unknown>[] | undefined)?.map((r) =>
                  String(r.targetEntityId),
                ) ?? [],
              )
            }
          >
            <span className="cursor-pointer text-base text-muted-foreground/60 hover:text-muted-foreground">
              {t("entity.detail.sidebar.linksAdd")}
            </span>
          </RelationPicker>
        }
      />

      <MetaSection
        title={t("entity.detail.sidebar.tags")}
        icon={<Tag className="size-3.5 text-muted-foreground" />}
        count={(entityTags as Array<{ id: string }> | undefined)?.length ?? 0}
      >
        <div className="flex flex-wrap gap-1.5 px-2 py-1">
          {(
            entityTags as
              | Array<{ id: string; tag?: { name: string }; tagName?: string }>
              | undefined
          )?.map(
            // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Inline tag row handles pending/remove keyboard state in one compact renderer.
            (et) => {
              const isPending = et.id.startsWith("temp-");
              return (
                <span
                  key={et.id}
                  data-pending={isPending ? "" : undefined}
                  className={`group inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-base text-foreground/70 transition-all ${
                    isPending ? "cursor-progress opacity-60" : "cursor-pointer hover:bg-muted"
                  }`}
                  onClick={() => {
                    if (isPending) return;
                    removeEntityTag.mutate(et.id);
                  }}
                  role={isPending ? undefined : "button"}
                  tabIndex={isPending ? -1 : 0}
                  aria-disabled={isPending || undefined}
                  onKeyDown={(e) => {
                    if (isPending) return;
                    if (e.key === "Enter" || e.key === " ") removeEntityTag.mutate(et.id);
                  }}
                  title={
                    isPending
                      ? t("entity.detail.sidebar.tagAdding")
                      : t("entity.detail.sidebar.tagRemove")
                  }
                >
                  {et.tag?.name ?? et.tagName ?? t("entity.detail.sidebar.tagFallback")}
                  <Trash2 className="size-3.5 opacity-0 transition-opacity group-hover:opacity-60" />
                </span>
              );
            },
          )}
        </div>
        <TagPicker projectId={projectId} entityId={entityId} entityType={metadataEntityType}>
          <span className="flex w-full cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground">
            {t("entity.detail.sidebar.tagsAdd")}
          </span>
        </TagPicker>
      </MetaSection>

      <MetaSection className="mt-auto">
        <SidebarItem
          primary={t("entity.detail.sidebar.stats.chars")}
          secondary={t("entity.detail.sidebar.stats.charsValue", { count: bodyCharCount })}
        />
        <SidebarItem
          primary={t("entity.detail.sidebar.stats.mentions")}
          secondary={t("entity.detail.sidebar.stats.mentionsValue", { count: mentionCounts.size })}
        />
        <SidebarItem
          primary={t("entity.detail.sidebar.stats.updated")}
          secondary={
            entity.updatedAt
              ? formatTimeAgo(String(entity.updatedAt), t)
              : t("entity.detail.sidebar.stats.empty")
          }
        />
        <SidebarItem
          primary={t("entity.detail.sidebar.stats.created")}
          secondary={
            entity.createdAt
              ? formatTimeAgo(String(entity.createdAt), t)
              : t("entity.detail.sidebar.stats.empty")
          }
        />
        <button
          type="button"
          onClick={handleDelete}
          className="flex w-full items-center rounded-lg px-2 py-1.5 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
        >
          {t("entity.detail.sidebar.delete")}
        </button>
      </MetaSection>
    </>
  ) : null;

  return (
    <DetailPageShell
      breadcrumbs={detailBreadcrumbs}
      currentLabel={entityName || t("entity.detail.fallbackLabel")}
      onBack={handleBack}
      isLoading={isLoading}
      sidebar={detailSidebar}
      focusAside={<FocusModeSide charCount={bodyCharCount} t={t} />}
      topbarAddon={topbarAddon}
      onFocusModeChange={(next) => appSidebar.setOpen(!next)}
      editor={
        // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Existing editor render branch owns autosave and document body props.
        // biome-ignore lint/complexity/noExcessiveLinesPerFunction: Existing editor render branch is not split during FLT-394 error-message i18n cleanup.
        ({ isFocusMode }) => {
          if (isLoading) return null;
          if (!entity) return <NotFoundState onBack={handleBack} t={t} />;

          return (
            <div ref={containerRef} className="relative flex h-full min-h-0 flex-1 flex-col">
              <div
                className={cn(
                  "flex w-full items-start",
                  entityType === "character" ? "gap-5 px-10 pt-8 pb-2" : "",
                )}
              >
                {entityType === "character" ? (
                  <EntitySmallImageField
                    imageSmallUrl={optimisticImageSmallUrl ?? imageSmallUrl}
                    fallbackLabel={entityName}
                    isPending={uploadImageSmall.isPending}
                    onFileSelect={handleImageSmallSelect}
                  />
                ) : null}
                <div
                  className={cn(
                    "min-w-0",
                    entityType === "character" ? "flex flex-1 flex-col gap-2 pt-0.5" : "w-full",
                  )}
                >
                  <Input
                    type="text"
                    value={titleDraft}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder={titlePlaceholder}
                    className={cn(
                      "h-auto w-full border-0 bg-transparent px-0 py-0 shadow-none outline-none focus-visible:ring-0",
                      "text-foreground placeholder:text-muted-foreground/40",
                      isFocusMode
                        ? "!text-3xl font-semibold md:!text-3xl"
                        : "!text-2xl font-semibold md:!text-2xl",
                      entityType === "character" ? "mt-0" : "px-10 pt-8 pb-2",
                    )}
                    data-el="ed-title"
                  />
                  {entityType === "character" ? (
                    <>
                      <CharacterRoleEditor
                        roles={characterRoles}
                        disabled={updateMutation.isPending}
                        onChange={handleCharacterRolesChange}
                      />
                      <ActorManageButton characterId={entityId} projectId={projectId} />
                      <CharacterBioEditor
                        value={characterBioDraft}
                        disabled={updateMutation.isPending}
                        onChange={handleCharacterBioChange}
                      />
                    </>
                  ) : null}
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-auto">
                <DocumentEditor
                  key={`${projectId ?? "no-project"}:${entityId}:${bodyState}:${i18n.language}`}
                  initialContent={initialDoc}
                  placeholder={t(getEmptyHintKey(entityType))}
                  onChange={handleBodyChange}
                  onStatsChange={(stats) => {
                    setMentionCounts(stats.mentionCounts);
                    setBodyCharCount(stats.bodyCharCount);
                  }}
                  onPendingChange={(pending) => {
                    bodyPendingSaveRef.current = pending;
                    hasPendingSave.current =
                      pending ||
                      pendingSaveCount.current > 0 ||
                      Boolean(titleDebounceRef.current) ||
                      Boolean(descriptionDebounceRef.current);
                  }}
                  autosaveDebounceMs={2000}
                />
              </div>
            </div>
          );
        }
      }
    />
  );
}

function normalizeCharacterRoles(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === "string") {
    try {
      return normalizeCharacterRoles(JSON.parse(value) as unknown);
    } catch {
      return value.trim() ? [value.trim()] : [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((role) => (typeof role === "string" ? role.trim() : ""))
    .filter((role) => role.length > 0);
}

/* ── Components ── */

function FocusModeSide({ charCount, t }: { charCount: number; t: TFn }) {
  return (
    <div className="pt-[72px] opacity-[0.15] transition-opacity duration-300 hover:opacity-60">
      <div className="space-y-3 text-sm text-foreground">
        <div>
          <div className="text-xs text-muted-foreground">
            {t("entity.detail.focus.charCount")}
          </div>
          <div className="font-medium">
            {t("entity.detail.focus.charCountValue", { count: charCount.toLocaleString() })}
          </div>
        </div>
      </div>
    </div>
  );
}

function NotFoundState({ onBack, t }: { onBack: () => void; t: TFn }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <p className="text-sm text-muted-foreground">{t("entity.detail.notFound")}</p>
      <Button variant="outline" size="sm" onClick={onBack}>
        {t("entity.detail.backToList")}
      </Button>
    </div>
  );
}

function CharacterRoleEditor({
  roles,
  disabled,
  onChange,
}: {
  roles: string[];
  disabled: boolean;
  onChange: (roles: string[]) => void;
}) {
  const { t } = useFeatureTranslation("feature.story");
  const roleLabels = getCharacterRoleLabels(t);
  const roleOptions = CHARACTER_ROLE_KEYS.map((value) => ({
    value,
    label: roleLabels[value] ?? value,
  }));
  const availableRoleOptions = roleOptions.filter((option) => !roles.includes(option.value));

  const handleRoleAdd = (role: string) => {
    onChange(orderCharacterRoles([...roles, role]));
  };

  const handleRoleRemove = (role: string) => {
    onChange(roles.filter((selectedRole) => selectedRole !== role));
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      aria-label={t("entity.detail.character.rolesAria")}
    >
      {roles.length > 0
        ? roles.map((role) => (
            <span
              key={role}
              className="group/role relative inline-flex h-6 items-center rounded-md border border-border/70 bg-muted/45 px-2 text-xs font-medium text-muted-foreground"
            >
              {roleLabels[role] ?? role}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={disabled}
                aria-label={t("entity.detail.character.removeRoleAria", {
                  label: roleLabels[role] ?? role,
                })}
                className="absolute -top-1.5 -right-1.5 size-4 rounded-full border border-border bg-background p-0 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover/role:opacity-100"
                onClick={() => handleRoleRemove(role)}
              >
                <X className="size-3.5" />
              </Button>
            </span>
          ))
        : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              disabled={disabled}
              aria-label={t("entity.detail.character.addRoleAria")}
            />
          }
        >
          <Plus className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-36">
          <DropdownMenuGroup>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                {t("entity.detail.character.rolesMenu.label")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-44">
                {availableRoleOptions.length > 0 ? (
                  availableRoleOptions.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      disabled={disabled}
                      onClick={() => handleRoleAdd(option.value)}
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled>
                    {t("entity.detail.character.rolesMenu.empty")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function orderCharacterRoles(roles: string[]) {
  const knownRoles = CHARACTER_ROLE_KEYS as readonly string[];
  const uniqueRoles = Array.from(new Set(roles));
  return [
    ...uniqueRoles.filter((role) => !knownRoles.includes(role)),
    ...knownRoles.filter((role) => uniqueRoles.includes(role)),
  ];
}

function CharacterBioEditor({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const { t } = useFeatureTranslation("feature.story");
  const characterCount = value.length;
  return (
    <div className="flex max-w-xl flex-col gap-1">
      <Textarea
        value={value}
        maxLength={CHARACTER_BIO_MAX_LENGTH}
        disabled={disabled}
        aria-label={t("entity.detail.character.bioAria")}
        name="character-bio"
        placeholder={t("entity.detail.character.bioPlaceholder")}
        rows={3}
        className="min-h-[72px] resize-none border-0 bg-transparent px-2 py-0 text-sm leading-6 text-muted-foreground shadow-none focus-visible:ring-0"
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="text-right text-xs leading-none text-muted-foreground/60">
        {characterCount}/{CHARACTER_BIO_MAX_LENGTH}
      </div>
    </div>
  );
}

/* ── Constants ── */

const ENTITY_TYPE_TO_ROUTE: Record<string, string> = {
  world: "worlds",
  character: "characters",
  location: "locations",
  faction: "factions",
  codex: "codex",
};

const EMPTY_HINT_KEYS: Record<string, string> = {
  character: "entity.detail.emptyHint.character",
  location: "entity.detail.emptyHint.location",
  faction: "entity.detail.emptyHint.faction",
  world: "entity.detail.emptyHint.world",
  codex: "entity.detail.emptyHint.codex",
};

function getEmptyHintKey(entityType: string): string {
  return EMPTY_HINT_KEYS[entityType] ?? "entity.detail.emptyHint.fallback";
}

const TITLE_PLACEHOLDER_KEYS: Record<string, string> = {
  world: "entity.detail.titlePlaceholder.world",
  character: "entity.detail.titlePlaceholder.character",
  location: "entity.detail.titlePlaceholder.location",
  faction: "entity.detail.titlePlaceholder.faction",
  codex: "entity.detail.titlePlaceholder.codex",
};

function getTitlePlaceholderKey(entityType: string): string {
  return TITLE_PLACEHOLDER_KEYS[entityType] ?? "entity.detail.titlePlaceholder.fallback";
}

const DETAIL_CONFIG_LABEL_KEYS: Record<string, string> = {
  world: "entity.detail.config.world.label",
  character: "entity.detail.config.character.label",
  location: "entity.detail.config.location.label",
  faction: "entity.detail.config.faction.label",
  codex: "entity.detail.config.codex.label",
};

function getEntityDetailConfig(t: TFn, entityType: string): { label: string } {
  const key = DETAIL_CONFIG_LABEL_KEYS[entityType];
  return { label: key ? t(key) : t("entity.detail.fallbackConfigLabel") };
}

const ENTITY_COLORS: Record<string, string> = {
  world: "#3D8B6E",
  character: "#D4675A",
  location: "#5A9E6B",
  faction: "#D4944A",
  codex: "#7E6B9E",
};

const ENTITY_LABEL_KEYS: Record<string, string> = {
  world: "entity.detail.config.world.label",
  character: "entity.detail.config.character.label",
  location: "entity.detail.config.location.label",
  faction: "entity.detail.config.faction.label",
  codex: "entity.detail.config.codex.label",
};

const CHARACTER_BIO_MAX_LENGTH = 120;

const CHARACTER_ROLE_KEYS = [
  "playable",
  "npc",
  "companion",
  "enemy",
  "boss",
  "merchant",
  "quest_giver",
] as const;

const CHARACTER_ROLE_LABEL_KEYS: Record<string, string> = {
  playable: "entity.detail.character.role.playable",
  npc: "entity.detail.character.role.npc",
  companion: "entity.detail.character.role.companion",
  enemy: "entity.detail.character.role.enemy",
  boss: "entity.detail.character.role.boss",
  merchant: "entity.detail.character.role.merchant",
  quest_giver: "entity.detail.character.role.questGiver",
};

function getCharacterRoleLabels(t: TFn): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, labelKey] of Object.entries(CHARACTER_ROLE_LABEL_KEYS)) {
    out[key] = t(labelKey);
  }
  return out;
}

/* ── RelationSection ── */

interface RelationSectionProps {
  title: string;
  icon: ReactNode;
  relations: Record<string, unknown>[];
  mentionCounts?: Map<string, number>;
  onNavigate: (type: string, id: string) => void;
  onDelete: (id: string) => void;
  addButton: ReactNode;
  showTypeBadge?: boolean;
  t: TFn;
}

function RelationSection({
  title,
  icon,
  relations,
  mentionCounts,
  onNavigate,
  onDelete,
  addButton,
  showTypeBadge,
  t,
}: RelationSectionProps) {
  return (
    <MetaSection title={title} icon={icon} count={relations.length}>
      {relations.map((r) => {
        const targetType = String(r.targetEntityType);
        const targetId = String(r.targetEntityId);
        const name = r.targetEntityName
          ? String(r.targetEntityName)
          : String(r.targetEntityId ?? "").slice(0, 8);
        const count = mentionCounts?.get(targetId);
        const labelKey = ENTITY_LABEL_KEYS[targetType];
        return (
          <SidebarItem
            key={String(r.id)}
            leading={
              showTypeBadge ? (
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-2xs font-medium"
                  style={{
                    backgroundColor: `${ENTITY_COLORS[targetType] ?? "#6B635A"}20`,
                    color: ENTITY_COLORS[targetType] ?? "#6B635A",
                  }}
                >
                  {labelKey ? t(labelKey) : targetType}
                </span>
              ) : (
                <span
                  className="inline-block size-2 rounded-full"
                  style={{ backgroundColor: ENTITY_COLORS[targetType] ?? "#6B635A" }}
                />
              )
            }
            primary={name}
            secondary={count ? t("entity.detail.relation.mentionCount", { count }) : undefined}
            ariaLabel={t("entity.detail.relation.openAria", { name })}
            onClick={() => onNavigate(targetType, targetId)}
            trailing={
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(String(r.id));
                }}
                aria-label={t("entity.detail.relation.removeAria", { name })}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Trash2 className="size-3.5" />
              </button>
            }
          />
        );
      })}
      {addButton}
    </MetaSection>
  );
}

function EntitySmallImageField({
  imageSmallUrl,
  fallbackLabel,
  isPending,
  onFileSelect,
}: {
  imageSmallUrl?: string;
  fallbackLabel: string;
  isPending: boolean;
  onFileSelect: (file: File) => Promise<void>;
}) {
  const { t } = useFeatureTranslation("feature.story");
  const inputRef = useRef<HTMLInputElement>(null);
  const fallback = fallbackLabel.trim().slice(0, 1).toUpperCase() || "?";

  return (
    <div className="relative size-24 shrink-0">
      <Button
        type="button"
        variant="ghost"
        aria-label={t("entity.detail.imageUpload.ariaLabel")}
        className="size-24 overflow-hidden rounded-xl border border-border/70 bg-muted p-0 hover:bg-muted/80"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
      >
        <Avatar className="size-full rounded-xl">
          {imageSmallUrl ? (
            <AvatarImage src={imageSmallUrl} alt={fallbackLabel} crossOrigin="anonymous" />
          ) : null}
          <AvatarFallback className="rounded-xl text-2xl font-semibold text-muted-foreground">
            {fallback}
          </AvatarFallback>
        </Avatar>
      </Button>
      <Input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label={t("entity.detail.imageUpload.fileAria")}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          onFileSelect(file).catch((error) => {
            console.error("imageSmallUrl upload failed", error);
          });
        }}
      />
    </div>
  );
}

/* ── Hooks ── */

function useEntityQuery(entityType: string, entityId: string, _projectId: string) {
  const world = useWorld(entityType === "world" ? entityId : "");
  const character = useCharacter(entityType === "character" ? entityId : "");
  const location = useLocation(entityType === "location" ? entityId : "");
  const faction = useFaction(entityType === "faction" ? entityId : "");
  const codex = useCodexEntry(entityType === "codex" ? entityId : "");
  interface EQ {
    data: Record<string, unknown> | undefined;
    isLoading: boolean;
  }
  const m: Record<string, EQ> = {
    world: world as unknown as EQ,
    character: character as unknown as EQ,
    location: location as unknown as EQ,
    faction: faction as unknown as EQ,
    codex: codex as unknown as EQ,
  };
  return m[entityType] ?? (world as unknown as EQ);
}

interface AnyMut {
  mutate: (i: never, o?: Record<string, unknown>) => void;
  mutateAsync: (i: never) => Promise<unknown>;
  isPending: boolean;
}

function useUpdateMutation(t: string, _projectId: string): AnyMut {
  const lore = useAllDomainUpdates();
  const m: Record<string, AnyMut> = {
    world: lore.worlds as unknown as AnyMut,
    character: lore.characters as unknown as AnyMut,
    location: lore.locations as unknown as AnyMut,
    faction: lore.factions as unknown as AnyMut,
    codex: lore.codex as unknown as AnyMut,
  };
  return m[t] ?? (lore.worlds as unknown as AnyMut);
}

function useDeleteMutation(t: string, projectId: string): AnyMut {
  const lore = useAllDomainDeletes(projectId);
  const m: Record<string, AnyMut> = {
    world: lore.worlds as unknown as AnyMut,
    character: lore.characters as unknown as AnyMut,
    location: lore.locations as unknown as AnyMut,
    faction: lore.factions as unknown as AnyMut,
    codex: lore.codex as unknown as AnyMut,
  };
  return m[t] ?? (lore.worlds as unknown as AnyMut);
}

/* ── Helpers ── */

function formatTimeAgo(dateStr: string, t: TFn): string {
  const d = new Date(dateStr);
  const now = new Date();
  const ms = now.getTime() - d.getTime();
  const min = Math.floor(ms / 60000);
  const hr = Math.floor(ms / 3600000);
  const day = Math.floor(ms / 86400000);
  if (min < 1) return t("entity.detail.time.justNow");
  if (min < 60) return t("entity.detail.time.minutesAgo", { count: min });
  if (hr < 24) return t("entity.detail.time.hoursAgo", { count: hr });
  if (day < 7) return t("entity.detail.time.daysAgo", { count: day });
  return d.toLocaleDateString("ko-KR");
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}
