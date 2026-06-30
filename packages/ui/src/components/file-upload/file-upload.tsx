/**
 * FileUpload — reusable drag/drop uploader UI (PB-FILE-UI-001 / BBR-554).
 *
 * Presentational shell over {@link useFileUpload}. Drag/drop + click picker,
 * per-file preview, progress, cancel/retry, and BOTH client- and server-side
 * validation errors (acceptance §1). Transport, allowed-file policy and the
 * target resource are injected via props (acceptance §4), and a protected
 * upload by a signed-out visitor calls `onRequireAuth` instead of redirecting
 * (acceptance §2).
 *
 * Layout stability (acceptance §3): the dropzone keeps a fixed footprint (only
 * its border/background react to dragging) and every row reserves a constant
 * height with a single always-present status line, so progress / cancel /
 * error / retry / success never reflow the surrounding form.
 */

import { CheckCircle2, FileIcon, RotateCw, Upload, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "../../_shadcn/button";
import { Progress } from "../../_shadcn/progress";
import { cn } from "../../lib/utils";
import type {
  CompletedUpload,
  UploadItem,
  UploadPolicy,
  UploadTargetRef,
  UploadTransport,
} from "./types";
import { useFileUpload } from "./use-file-upload";
import { DEFAULT_MAX_FILES, DEFAULT_MAX_UPLOAD_BYTES, formatBytes } from "./validation";

export interface FileUploadProps {
  /** Real upload implementation (injected). */
  transport: UploadTransport;
  /** Allowed-file policy injected by the domain form. */
  policy?: UploadPolicy;
  /** Resource the files attach to. */
  target?: UploadTargetRef;
  /** Whether the user is allowed to perform the protected upload action. */
  isAuthenticated?: boolean;
  /** Opens the auth modal when a signed-out visitor tries to upload. */
  onRequireAuth?: () => void;
  /** Start uploading as soon as a valid file is added. Default true. */
  autoStart?: boolean;
  onComplete?: (result: CompletedUpload, item: UploadItem) => void;
  onAllComplete?: (results: CompletedUpload[]) => void;
  /** Headline shown inside the dropzone. */
  label?: string;
  /** Secondary hint shown inside the dropzone. */
  description?: string;
  disabled?: boolean;
  className?: string;
}

function statusLabel(item: UploadItem): string {
  switch (item.status) {
    case "queued":
      return "대기 중";
    case "uploading":
      return `${item.progress}%`;
    case "success":
      return "업로드 완료";
    case "canceled":
      return "취소됨";
    case "error":
      return item.clientError ?? item.serverError ?? "업로드 실패";
  }
}

/** The single, always-present status line. One element per state, fixed height. */
function StatusLine({ item }: { item: UploadItem }) {
  if (item.status === "error") {
    return (
      <span role="alert" className="text-destructive truncate text-xs">
        {statusLabel(item)}
      </span>
    );
  }
  if (item.status === "success") {
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-600">
        <CheckCircle2 className="size-3.5" />
        {statusLabel(item)}
      </span>
    );
  }
  if (item.status === "canceled") {
    return <span className="text-muted-foreground text-xs">{statusLabel(item)}</span>;
  }
  return (
    <>
      <Progress
        value={item.progress}
        aria-label={`${item.name} 업로드 진행률`}
        className="flex-1"
      />
      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
        {statusLabel(item)}
      </span>
    </>
  );
}

function ItemRow({
  item,
  onCancel,
  onRetry,
  onRemove,
}: {
  item: UploadItem;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const isUploading = item.status === "uploading";
  const isError = item.status === "error";
  const isCanceled = item.status === "canceled";

  return (
    <li
      data-testid="file-upload-item"
      data-status={item.status}
      // Fixed row height keeps every state on the same footprint (acceptance §3).
      className="bg-muted/40 flex min-h-16 items-center gap-3 rounded-md border p-2"
    >
      {/* Preview / icon — fixed 40x40 box */}
      <div className="bg-background flex size-10 shrink-0 items-center justify-center overflow-hidden rounded">
        {item.previewUrl ? (
          // biome-ignore lint/performance/noImgElement: object URL preview, not a remote asset
          <img src={item.previewUrl} alt="" className="size-full object-cover" />
        ) : (
          <FileIcon className="text-muted-foreground size-5" />
        )}
      </div>

      {/* Name + always-present status line */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium" title={item.name}>
            {item.name}
          </span>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {formatBytes(item.size)}
          </span>
        </div>

        {/* Reserved-height status region — exactly one line, never collapses */}
        <div className="mt-1 flex h-5 items-center gap-2">
          <StatusLine item={item} />
        </div>
      </div>

      {/* Actions — width reserved so swapping buttons doesn't shift the row */}
      <div className="flex shrink-0 items-center gap-1">
        {isUploading ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="업로드 취소"
            onClick={() => onCancel(item.id)}
          >
            <X className="size-4" />
          </Button>
        ) : (
          <>
            {(isError || isCanceled) && !item.clientError && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="다시 시도"
                onClick={() => onRetry(item.id)}
              >
                <RotateCw className="size-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="제거"
              onClick={() => onRemove(item.id)}
            >
              <X className="size-4" />
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

export function FileUpload({
  transport,
  policy,
  target,
  isAuthenticated = true,
  onRequireAuth,
  autoStart = true,
  onComplete,
  onAllComplete,
  label = "파일을 드래그하거나 클릭하여 업로드",
  description,
  disabled = false,
  className,
}: FileUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { items, addFiles, cancel, retry, remove, canAddMore } = useFileUpload({
    transport,
    policy,
    target,
    autoStart,
    isAuthenticated,
    onRequireAuth,
    onComplete,
    onAllComplete,
  });

  const maxSize = policy?.maxSize ?? DEFAULT_MAX_UPLOAD_BYTES;
  const maxFiles = policy?.maxFiles ?? DEFAULT_MAX_FILES;
  const hint =
    description ?? `최대 ${formatBytes(maxSize)}${maxFiles > 1 ? `, ${maxFiles}개 파일` : ""}`;

  function openPicker() {
    // The picker IS the protected action when signed out: gate before opening.
    if (!isAuthenticated) {
      onRequireAuth?.();
      return;
    }
    inputRef.current?.click();
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div
        data-testid="file-upload-dropzone"
        onDragOver={(e) => {
          if (disabled) return;
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          if (disabled) return;
          e.preventDefault();
          setIsDragging(false);
          addFiles(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <Upload className="text-muted-foreground mb-3 size-8" />
        <p className="text-muted-foreground mb-1 text-sm">{label}</p>
        <p className="text-muted-foreground text-xs">{hint}</p>

        <Button
          type="button"
          variant="outline"
          className="mt-4"
          disabled={disabled || !canAddMore}
          onClick={openPicker}
        >
          파일 선택
        </Button>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={policy?.accept}
          multiple={maxFiles > 1}
          disabled={disabled}
          className="sr-only"
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <ul className="space-y-2" data-testid="file-upload-list">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onCancel={cancel}
              onRetry={retry}
              onRemove={remove}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
