/**
 * useFileUpload — headless upload state machine (PB-FILE-UI-001 / BBR-554).
 *
 * Owns an immutable list of {@link UploadItem}s and drives each through
 * queued → uploading → success | error | canceled. Validation, preview URLs,
 * progress, cancel (AbortController) and retry all live here; the network work
 * is the injected {@link UploadTransport}. No JSX, so it can be unit-tested as
 * plain logic and reused by any presentational shell.
 *
 * Auth gate (acceptance criterion §2): when `isAuthenticated` is false, every
 * entry point that would START a protected upload calls `onRequireAuth()` and
 * refuses to proceed — the caller opens an auth modal instead of redirecting.
 *
 * (No useCallback/useMemo — this project compiles with React Compiler, which
 * memoizes automatically.)
 */

import { useEffect, useRef, useState } from "react";
import type {
  CompletedUpload,
  UploadItem,
  UploadPolicy,
  UploadTargetRef,
  UploadTransport,
} from "./types";
import { DEFAULT_MAX_FILES, validateFileAgainstPolicy } from "./validation";

export interface UseFileUploadOptions {
  /** Real upload implementation (injected). */
  transport: UploadTransport;
  /** Allowed-file policy from the domain form. */
  policy?: UploadPolicy;
  /** Resource the files attach to. */
  target?: UploadTargetRef;
  /** Start uploading as soon as a valid file is added. Default true. */
  autoStart?: boolean;
  /** Whether the user may perform the protected upload action. Default true. */
  isAuthenticated?: boolean;
  /** Called instead of uploading when an unauthenticated user tries to upload. */
  onRequireAuth?: () => void;
  /** Fired when one file finishes successfully. */
  onComplete?: (result: CompletedUpload, item: UploadItem) => void;
  /** Fired when every queued file has settled and at least one succeeded. */
  onAllComplete?: (results: CompletedUpload[]) => void;
}

export interface UseFileUploadResult {
  items: UploadItem[];
  /** Validate + enqueue files (and auto-start when configured). */
  addFiles: (files: File[]) => void;
  start: (id: string) => void;
  startAll: () => void;
  cancel: (id: string) => void;
  retry: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  /** True while any file is mid-flight. */
  isUploading: boolean;
  /** Free slots remain under the maxFiles ceiling. */
  canAddMore: boolean;
}

let localIdSeq = 0;
function nextLocalId(): string {
  localIdSeq += 1;
  return `upload-${localIdSeq}`;
}

function isImage(file: File): boolean {
  return file.type.startsWith("image/");
}

/** Replace one item by id with a patched copy (immutably). */
function patchItem(items: UploadItem[], id: string, patch: Partial<UploadItem>): UploadItem[] {
  return items.map((it) => (it.id === id ? { ...it, ...patch } : it));
}

export function useFileUpload(options: UseFileUploadOptions): UseFileUploadResult {
  const {
    transport,
    policy,
    target,
    autoStart = true,
    isAuthenticated = true,
    onRequireAuth,
    onComplete,
    onAllComplete,
  } = options;

  const [items, setItems] = useState<UploadItem[]>([]);

  // Per-item AbortControllers for cancellation. Kept in a ref so re-renders
  // never lose an in-flight controller.
  const controllers = useRef<Map<string, AbortController>>(new Map());

  const maxFiles = policy?.maxFiles ?? DEFAULT_MAX_FILES;

  // Revoke every preview object URL + abort everything on unmount.
  useEffect(() => {
    const map = controllers.current;
    return () => {
      for (const c of map.values()) c.abort();
      map.clear();
      setItems((prev) => {
        for (const it of prev) if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
        return prev;
      });
    };
  }, []);

  function runUpload(item: UploadItem) {
    const controller = new AbortController();
    controllers.current.set(item.id, controller);

    setItems((prev) =>
      patchItem(prev, item.id, { status: "uploading", progress: 0, serverError: undefined }),
    );

    transport({
      file: item.file,
      target: target ?? {},
      signal: controller.signal,
      onProgress: (percent) => {
        const clamped = Math.max(0, Math.min(100, Math.round(percent)));
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id && it.status === "uploading" ? { ...it, progress: clamped } : it,
          ),
        );
      },
    })
      .then((result) => {
        controllers.current.delete(item.id);
        setItems((prev) => {
          const next = patchItem(prev, item.id, {
            status: "success",
            progress: 100,
            result,
            serverError: undefined,
          });
          onComplete?.(result, { ...item, status: "success", result });
          const allSettled = next.every(
            (it) => it.status !== "uploading" && it.status !== "queued",
          );
          if (allSettled) {
            const ok = next.filter((it) => it.result).map((it) => it.result as CompletedUpload);
            if (ok.length > 0) onAllComplete?.(ok);
          }
          return next;
        });
      })
      .catch((error: unknown) => {
        controllers.current.delete(item.id);
        if (controller.signal.aborted) {
          // Cancellation is a user action, not a failure.
          setItems((prev) =>
            prev.map((it) =>
              it.id === item.id && it.status === "uploading" ? { ...it, status: "canceled" } : it,
            ),
          );
          return;
        }
        const message =
          error instanceof Error && error.message
            ? error.message
            : "파일 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.";
        setItems((prev) => patchItem(prev, item.id, { status: "error", serverError: message }));
      });
  }

  function start(id: string) {
    if (!isAuthenticated) {
      onRequireAuth?.();
      return;
    }
    const item = items.find((it) => it.id === id);
    if (!item || item.clientError) return;
    if (item.status === "uploading" || item.status === "success") return;
    runUpload(item);
  }

  function startAll() {
    if (!isAuthenticated) {
      onRequireAuth?.();
      return;
    }
    for (const it of items) {
      if (it.clientError) continue;
      if (it.status === "queued" || it.status === "canceled" || it.status === "error") {
        runUpload(it);
      }
    }
  }

  function addFiles(files: File[]) {
    if (files.length === 0) return;
    // Protected action: gate BEFORE accepting any file (acceptance §2).
    if (!isAuthenticated) {
      onRequireAuth?.();
      return;
    }

    const remaining = Math.max(0, maxFiles - items.length);
    const accepted = files.slice(0, remaining);
    const newItems: UploadItem[] = accepted.map((file) => {
      const clientError = validateFileAgainstPolicy(file, policy) ?? undefined;
      return {
        id: nextLocalId(),
        file,
        name: file.name,
        size: file.size,
        status: clientError ? "error" : "queued",
        progress: 0,
        clientError,
        previewUrl: !clientError && isImage(file) ? URL.createObjectURL(file) : undefined,
      };
    });

    setItems((prev) => [...prev, ...newItems]);

    if (autoStart) {
      for (const it of newItems) {
        if (!it.clientError) runUpload(it);
      }
    }
  }

  function cancel(id: string) {
    const controller = controllers.current.get(id);
    if (controller) controller.abort();
    controllers.current.delete(id);
    setItems((prev) =>
      prev.map((it) =>
        it.id === id && (it.status === "uploading" || it.status === "queued")
          ? { ...it, status: "canceled" }
          : it,
      ),
    );
  }

  function retry(id: string) {
    if (!isAuthenticated) {
      onRequireAuth?.();
      return;
    }
    const item = items.find((it) => it.id === id);
    if (!item || item.clientError) return;
    if (item.status !== "error" && item.status !== "canceled") return;
    runUpload(item);
  }

  function remove(id: string) {
    const controller = controllers.current.get(id);
    if (controller) controller.abort();
    controllers.current.delete(id);
    setItems((prev) => {
      const item = prev.find((it) => it.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((it) => it.id !== id);
    });
  }

  function clear() {
    for (const c of controllers.current.values()) c.abort();
    controllers.current.clear();
    setItems((prev) => {
      for (const it of prev) if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
      return [];
    });
  }

  const isUploading = items.some((it) => it.status === "uploading");
  const canAddMore = items.length < maxFiles;

  return {
    items,
    addFiles,
    start,
    startAll,
    cancel,
    retry,
    remove,
    clear,
    isUploading,
    canAddMore,
  };
}
