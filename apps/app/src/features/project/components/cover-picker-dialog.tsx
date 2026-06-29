/**
 * Cover Picker Dialog — "Change cover" UX. Upload first (primary, big
 * drop-or-click target), then a fallback grid of 16 built-in patterns.
 *
 * Persists via `useUpdateProject` → tRPC → drizzle `cover_image` column.
 * Patterns store as paths ("/patterns/pattern-04.jpg"). Direct uploads
 * are converted to `data:` URLs and stored as-is in the text column.
 * (When traffic warrants, swap the upload step to a real Blob storage
 * push and store only the resulting URL.)
 */

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
import { Trash2, UploadCloud } from "lucide-react";
import { type ChangeEvent, type DragEvent, useId, useRef, useState } from "react";
import { getAppErrorMessage } from "@/lib/user-facing-error";
import { useUpdateProject, useUploadProjectCover } from "../hooks/use-project-mutations";
import { PROJECT_PATTERNS } from "../patterns";

interface Props {
  projectId: string;
  currentCover: string | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// 4MB image → ~5.4MB once base64-encoded. Kept under the server's 6MB cap.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export function CoverPickerDialog({ projectId, currentCover, open, onOpenChange }: Props) {
  const { t } = useFeatureTranslation("app");
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const update = useUpdateProject();
  const upload = useUploadProjectCover();
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const applyPattern = (path: string | null) => {
    update.mutate({ id: projectId, data: { coverImage: path } });
    setUploadError(null);
    onOpenChange(false);
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setUploadError(t("errors.uploadImageOnly"));
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError(t("errors.uploadMax4Mb"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") return;
      upload.mutate(
        { id: projectId, dataUrl: result },
        {
          onSuccess: () => {
            setUploadError(null);
            onOpenChange(false);
          },
          onError: (err) => {
            setUploadError(getAppErrorMessage(t, err, "errors.coverUploadFailed"));
          },
        },
      );
    };
    reader.onerror = () => setUploadError(t("errors.uploadReadFailed"));
    reader.readAsDataURL(file);
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-lg">커버 이미지 변경</DialogTitle>
          <DialogDescription className="text-base">
            직접 업로드하거나, 빈티지 패턴에서 골라보세요.
          </DialogDescription>
        </DialogHeader>

        {/* Upload — primary action */}
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background-warm px-6 py-7 text-center transition-colors",
            "hover:border-primary/60 hover:bg-muted",
            dragOver && "border-primary/80 bg-card",
          )}
        >
          <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
            <UploadCloud className="size-5" />
          </span>
          <span className="text-base font-semibold text-foreground">이미지 업로드</span>
          <span className="text-xs text-muted-foreground">
            드래그 앤 드롭 또는 클릭 · jpg / png / webp · 최대 4MB
          </span>
          <input
            id={inputId}
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={onInputChange}
          />
        </label>

        {uploadError ? <p className="text-xs text-destructive">{uploadError}</p> : null}

        {/* Patterns — fallback grid */}
        <div className="mt-2 flex items-center justify-between">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            패턴에서 선택
          </h4>
          {currentCover ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => applyPattern(null)}
              className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
              현재 커버 제거
            </Button>
          ) : null}
        </div>

        <div className="grid max-h-[260px] grid-cols-6 gap-2 overflow-y-auto rounded-md">
          {PROJECT_PATTERNS.map((p) => {
            const selected = currentCover === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => applyPattern(p)}
                aria-label={`패턴 ${p}`}
                className={cn(
                  "aspect-[2/3] overflow-hidden rounded-md border bg-cover bg-center transition-all",
                  "hover:scale-[1.02] hover:shadow-md",
                  selected ? "border-primary ring-2 ring-primary/40" : "border-border-subtle",
                )}
                style={{ backgroundImage: `url(${p})` }}
              />
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
