/**
 * Reusable Drafts.html index-card surface. Preview and editor variants share
 * the same paper, ruled background, red margin line, metadata row, and tag
 * treatment so the card shape stays consistent across draft flows.
 */
import { useFeatureTranslation } from "@repo/core/i18n";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/shadcn/dropdown-menu";
import { Input } from "@repo/ui/shadcn/input";
import { Textarea } from "@repo/ui/shadcn/textarea";
import { MoreHorizontal, Paperclip, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

export interface DraftIndexCardPreviewProps {
  id: string;
  title: string;
  text: string;
  tags: string[];
  metadata: ReactNode;
  isPinned?: boolean;
  isSelected?: boolean;
  isDisabled?: boolean;
  onSelect: () => void;
}

export function DraftIndexCardPreview({
  id,
  title,
  text,
  tags,
  metadata,
  isPinned = false,
  isSelected = false,
  isDisabled = false,
  onSelect,
}: DraftIndexCardPreviewProps) {
  const hoverTilt = isPinned ? "group-hover:-rotate-[0.6deg]" : "group-hover:-rotate-[0.3deg]";

  return (
    <Button
      data-el="draft-card"
      data-draft-id={id}
      type="button"
      variant="ghost"
      aria-current={isSelected ? "true" : undefined}
      aria-disabled={isDisabled}
      onClick={() => {
        if (!isDisabled) onSelect();
      }}
      className={cn(
        "group block h-auto w-full shrink whitespace-normal rounded-[10px] p-0 text-left hover:bg-transparent",
        isDisabled ? "cursor-progress" : "",
      )}
    >
      <span className="block">
        <DraftIndexCardPaper
          dataEl="draft-card.paper"
          isPinned={isPinned}
          variant="preview"
          className={cn(
            "transition-transform duration-200 group-hover:-translate-y-0.5",
            hoverTilt,
          )}
        >
          <DraftIndexCardBody dataEl="draft-card.body" variant="preview">
            <span className="relative z-10 block truncate text-base font-semibold leading-7">
              {title}
            </span>
            <span className="relative z-10 line-clamp-5 block whitespace-pre-wrap text-base font-normal leading-7 text-foreground">
              {text}
            </span>
          </DraftIndexCardBody>
        </DraftIndexCardPaper>
        <DraftIndexCardMeta dataEl="draft-card.meta" metadata={metadata} tags={tags} />
      </span>
    </Button>
  );
}

export interface DraftIndexCardEditorProps {
  title: string;
  description: string;
  tags: string[];
  metadata: ReactNode;
  isPinned?: boolean;
  hideMeta?: boolean;
  hideTitle?: boolean;
  size?: "default" | "compact";
  titlePlaceholder?: string;
  descriptionPlaceholder?: string;
  deleteLabel?: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onDelete?: () => void;
}

export function DraftIndexCardEditor({
  title,
  description,
  tags,
  metadata,
  isPinned = false,
  hideMeta = false,
  hideTitle = false,
  size = "default",
  titlePlaceholder,
  descriptionPlaceholder,
  deleteLabel,
  onTitleChange,
  onDescriptionChange,
  onDelete,
}: DraftIndexCardEditorProps) {
  const { t } = useFeatureTranslation("feature.story");
  const resolvedTitlePlaceholder = titlePlaceholder ?? t("draft.editor.titlePlaceholder");
  const resolvedDescriptionPlaceholder =
    descriptionPlaceholder ?? t("draft.editor.descriptionPlaceholder");
  const resolvedDeleteLabel = deleteLabel ?? t("draft.editor.deleteLabel");
  return (
    <div data-el="draft-detail.editor" className="flex min-h-0 flex-col gap-2">
      <DraftIndexCardPaper
        className="group/editor"
        dataEl="draft-expanded-card.paper"
        isPinned={isPinned}
        size={size}
        titleHidden={hideTitle}
        variant="editor"
      >
        <DraftIndexCardBody titleHidden={hideTitle} variant="editor">
          {onDelete ? (
            <span
              data-el="draft-detail.toolbar"
              className="relative z-20 flex h-7 items-center justify-end"
            >
              <DraftIndexCardActionMenu deleteLabel={resolvedDeleteLabel} onDelete={onDelete} />
            </span>
          ) : null}
          {hideTitle ? null : (
            <Input
              data-el="draft-detail.title"
              name="draft-title"
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder={resolvedTitlePlaceholder}
              className="relative z-10 h-7 border-0 bg-transparent px-0 py-0 text-lg font-semibold leading-7 shadow-none outline-none focus:bg-transparent focus-visible:border-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 active:bg-transparent"
            />
          )}
          <Textarea
            data-el="draft-detail.description"
            name="draft-description"
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder={resolvedDescriptionPlaceholder}
            rows={size === "compact" ? 6 : 14}
            className={cn(
              "relative z-10 flex-1 resize-none border-0 bg-transparent px-0 py-0 text-base leading-7 shadow-none outline-none focus:bg-transparent focus-visible:border-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 active:bg-transparent md:text-base",
              size === "compact" ? "min-h-[156px]" : "min-h-[420px]",
            )}
          />
        </DraftIndexCardBody>
      </DraftIndexCardPaper>

      {hideMeta ? null : (
        <DraftIndexCardMeta dataEl="draft-expanded-card.meta" metadata={metadata} tags={tags} />
      )}
    </div>
  );
}

interface DraftIndexCardActionMenuProps {
  deleteLabel: string;
  onDelete: () => void;
}

function DraftIndexCardActionMenu({ deleteLabel, onDelete }: DraftIndexCardActionMenuProps) {
  const { t } = useFeatureTranslation("feature.story");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("draft.editor.menuAria")}
        data-el="draft-detail.more"
        className="grid size-6 place-items-center rounded-md text-muted-foreground opacity-0 transition-[background-color,color,opacity] hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-open:opacity-100 group-hover/editor:opacity-100 group-focus-within/editor:opacity-100"
      >
        <MoreHorizontal className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem
          data-el="draft-detail.delete"
          variant="destructive"
          onSelect={onDelete}
          className="text-base"
        >
          <Trash2 className="size-3.5" />
          {deleteLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface DraftIndexCardPaperProps {
  children: ReactNode;
  dataEl: string;
  isPinned: boolean;
  size?: "default" | "compact";
  titleHidden?: boolean;
  variant: "preview" | "editor";
  className?: string;
}

function DraftIndexCardPaper({
  children,
  dataEl,
  isPinned,
  size = "default",
  titleHidden = false,
  variant,
  className,
}: DraftIndexCardPaperProps) {
  const pinnedRotation = getPinnedRotation(variant, isPinned);

  return (
    <span
      data-el={dataEl}
      className={cn(
        "relative flex w-full flex-col overflow-hidden rounded-lg border text-foreground",
        "border-[#ded6c6] bg-[#fbfaf6] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_1px_2px_rgba(40,28,12,0.06),0_4px_10px_-4px_rgba(40,28,12,0.08)]",
        titleHidden ? TITLELESS_INDEX_CARD_RULES_CLASS : INDEX_CARD_RULES_CLASS,
        getDraftIndexCardPaperSizeClass(variant, size),
        pinnedRotation,
        className,
      )}
    >
      {isPinned ? (
        <Paperclip
          aria-hidden
          className={cn(
            "absolute -top-0.5 h-5 w-3.5 text-[#a36550]",
            variant === "preview" ? "right-3" : "right-4",
          )}
        />
      ) : null}
      {children}
    </span>
  );
}

function getPinnedRotation(variant: "preview" | "editor", isPinned: boolean): string {
  if (!isPinned) return "";
  return variant === "preview" ? "-rotate-[0.4deg]" : "-rotate-[0.25deg]";
}

function getDraftIndexCardPaperSizeClass(
  variant: "preview" | "editor",
  size: "default" | "compact",
): string {
  if (variant === "preview") return "aspect-[5/3]";
  if (size === "compact") return "min-h-[190px]";
  return "min-h-[520px]";
}

interface DraftIndexCardBodyProps {
  children: ReactNode;
  variant: "preview" | "editor";
  dataEl?: string;
  titleHidden?: boolean;
}

function DraftIndexCardBody({
  children,
  variant,
  dataEl,
  titleHidden = false,
}: DraftIndexCardBodyProps) {
  return (
    <span
      data-el={dataEl}
      className={cn(
        "relative flex min-h-0 flex-1 flex-col before:absolute before:bottom-0 before:left-3.5 before:top-0 before:w-px before:bg-[#d9a5a0]",
        getDraftIndexCardBodySpacingClass(variant, titleHidden),
      )}
    >
      {children}
    </span>
  );
}

function getDraftIndexCardBodySpacingClass(
  variant: "preview" | "editor",
  titleHidden: boolean,
): string {
  if (variant === "preview") return "pb-0 pl-[22px] pr-4 pt-8";
  if (titleHidden) return "pb-6 pl-[22px] pr-5 pt-2";
  return "pb-6 pl-[22px] pr-5 pt-2";
}

const INDEX_CARD_RULES_CLASS =
  "bg-[linear-gradient(to_bottom,transparent_0,transparent_27px,#ece2d1_27px,#ece2d1_28px)] bg-[length:100%_28px] bg-repeat";

const TITLELESS_INDEX_CARD_RULES_CLASS =
  "bg-[linear-gradient(to_bottom,transparent_0,transparent_35px,#ece2d1_35px,#ece2d1_36px,transparent_36px,transparent_63px,#ece2d1_63px,#ece2d1_64px,transparent_64px,transparent_91px,#ece2d1_91px,#ece2d1_92px,transparent_92px,transparent_119px,#ece2d1_119px,#ece2d1_120px,transparent_120px,transparent_147px,#ece2d1_147px,#ece2d1_148px,transparent_148px,transparent_175px,#ece2d1_175px,#ece2d1_176px,transparent_176px)] bg-no-repeat";

interface DraftIndexCardMetaProps {
  dataEl: string;
  metadata: ReactNode;
  tags: string[];
}

function DraftIndexCardMeta({ dataEl, metadata, tags }: DraftIndexCardMetaProps) {
  return (
    <span data-el={dataEl} className="mt-2 flex min-h-4 items-start justify-between gap-2 px-1">
      <span className="font-mono text-2xs leading-4 text-muted-foreground">{metadata}</span>
      <span className="flex flex-wrap justify-end gap-x-2 gap-y-1">
        {tags.map((tag, index) => (
          <span key={tag} className="text-xs font-medium leading-4 text-muted-foreground">
            {index > 0 ? <span className="mr-2 opacity-60">•</span> : null}
            {tag}
          </span>
        ))}
      </span>
    </span>
  );
}
