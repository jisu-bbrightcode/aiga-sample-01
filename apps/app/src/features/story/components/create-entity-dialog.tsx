/**
 * 통합 생성 모달 — 모든 페이지에서 동일한 다이얼로그.
 * 타입 칩(캐릭터/장소/세력/세계/코덱스/자유 글) + 제목 + 한 줄 소개.
 */

import { ANALYTICS_EVENTS, captureEvent } from "@repo/core/analytics/client";
import { useFeatureTranslation } from "@repo/core/i18n";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/shadcn/dialog";
import { Input } from "@repo/ui/shadcn/input";
import { Textarea } from "@repo/ui/shadcn/textarea";
import { useEffect, useState } from "react";

export type StoryEntityType =
  | "character"
  | "location"
  | "faction"
  | "world"
  | "draft"
  | "codex";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 초기 선택 타입. 없으면 "draft" (자유 글). */
  entityType?: StoryEntityType;
  allowedTypes?: StoryEntityType[];
  onSubmit: (data: { name: string; description: string; entityType: string }) => void;
  isLoading?: boolean;
}

const TYPE_CHIPS: { value: StoryEntityType; labelKey: string }[] = [
  { value: "character", labelKey: "entity.dialog.create.types.character" },
  { value: "location", labelKey: "entity.dialog.create.types.location" },
  { value: "faction", labelKey: "entity.dialog.create.types.faction" },
  { value: "world", labelKey: "entity.dialog.create.types.world" },
  { value: "codex", labelKey: "entity.dialog.create.types.codex" },
  { value: "draft", labelKey: "entity.dialog.create.types.draft" },
];

export function CreateEntityDialog({
  open,
  onOpenChange,
  entityType,
  allowedTypes,
  onSubmit,
  isLoading = false,
}: Props) {
  const { t } = useFeatureTranslation("feature.story");
  const visibleTypes = allowedTypes?.length
    ? TYPE_CHIPS.filter((chip) => allowedTypes.includes(chip.value))
    : TYPE_CHIPS;
  const fallbackType = visibleTypes[0]?.value ?? "draft";
  const [selectedType, setSelectedType] = useState<StoryEntityType>(entityType ?? fallbackType);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Reset on open
  useEffect(() => {
    if (open) {
      setSelectedType(
        entityType && visibleTypes.some((chip) => chip.value === entityType)
          ? entityType
          : fallbackType,
      );
      setName("");
      setDescription("");
    }
  }, [open, entityType, fallbackType, visibleTypes]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    captureCreateEvent(selectedType);
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      entityType: selectedType,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-[560px]">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="text-base font-semibold">
              {t("entity.dialog.create.title")}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t("entity.dialog.create.description")}
            </DialogDescription>
          </DialogHeader>

          {/* Body */}
          <div className="flex flex-col gap-4 px-6 py-5">
            {/* Type chips */}
            <div>
              <div className="mb-2 text-base font-medium text-muted-foreground">
                {t("entity.dialog.create.typePrompt")}
              </div>
              <div className="flex flex-wrap gap-1">
                {visibleTypes.map((chip) => (
                  <TypeChip
                    key={chip.value}
                    label={t(chip.labelKey)}
                    active={selectedType === chip.value}
                    onClick={() => setSelectedType(chip.value)}
                  />
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <div className="mb-1 text-base font-medium text-muted-foreground">
                {t("entity.dialog.create.titleLabel")}
              </div>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("entity.dialog.create.titlePlaceholder")}
                autoFocus
                className="text-base"
              />
            </div>

            {/* Description */}
            <div>
              <div className="mb-1 text-base font-medium text-muted-foreground">
                {t("entity.dialog.create.descriptionLabel")}{" "}
                <span className="font-normal text-muted-foreground/60">
                  {t("entity.dialog.create.optional")}
                </span>
              </div>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("entity.dialog.create.descriptionPlaceholder")}
                rows={2}
                className="resize-y text-base"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t px-6 py-4" data-el="entity-dialog.footer">
            <Button
              type="button"
              variant="ghost"
              className="text-base"
              onClick={() => onOpenChange(false)}
            >
              {t("entity.dialog.create.cancel")}
            </Button>
            <Button type="submit" disabled={!name.trim() || isLoading} className="text-base">
              {isLoading ? t("entity.dialog.create.submitting") : t("entity.dialog.create.submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* Components */

/** 생성 타입 → 행동 이벤트 매핑. 서버 write 성공 후 호출된다. */
function captureCreateEvent(type: StoryEntityType): void {
  if (type === "draft") {
    captureEvent(ANALYTICS_EVENTS.DRAFT_CREATED);
    return;
  }
  captureEvent(ANALYTICS_EVENTS.ENTITY_CREATED, { entity_type: type });
}

function TypeChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        "h-auto rounded-full border px-3 py-1 text-base font-normal",
        active
          ? "border-foreground/30 bg-foreground/10 font-medium text-foreground"
          : "border-transparent bg-muted text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </Button>
  );
}
