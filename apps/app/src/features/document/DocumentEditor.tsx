import { TipTapEditor } from "@repo/ui/editor/tiptap-editor";
import { useEffect, useRef } from "react";
import type { DocumentContent, DocumentStats } from "./document-content";
import { createEmptyDocument, deriveDocumentStats } from "./document-content";

interface DocumentEditorProps {
  initialContent: DocumentContent | null;
  placeholder?: string;
  autosaveDebounceMs?: number;
  onChange: (content: DocumentContent) => void | Promise<void>;
  onStatsChange?: (stats: DocumentStats) => void;
  onPendingChange?: (pending: boolean) => void;
}

export function DocumentEditor({
  initialContent,
  placeholder,
  autosaveDebounceMs = 1200,
  onChange,
  onStatsChange,
  onPendingChange,
}: DocumentEditorProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<DocumentContent | null>(null);
  const dirtyRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const onPendingChangeRef = useRef(onPendingChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onPendingChangeRef.current = onPendingChange;
  }, [onPendingChange]);

  useEffect(() => {
    const flushLatest = () => {
      if (!dirtyRef.current || !latestRef.current) return;
      dirtyRef.current = false;
      onPendingChangeRef.current?.(false);
      void onChangeRef.current(latestRef.current);
    };

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      flushLatest();
    };
  }, []);

  return (
    <TipTapEditor
      content={initialContent ?? createEmptyDocument()}
      placeholder={placeholder}
      toolbar="compact"
      minHeight="100%"
      className="min-h-full border-0 px-10 py-6 shadow-none focus:ring-0"
      onChange={(content) => {
        const next = content as DocumentContent;
        latestRef.current = next;
        dirtyRef.current = true;
        onPendingChangeRef.current?.(true);
        onStatsChange?.(deriveDocumentStats(next));
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          if (!dirtyRef.current || !latestRef.current) return;
          dirtyRef.current = false;
          onPendingChangeRef.current?.(false);
          void onChangeRef.current(latestRef.current);
        }, autosaveDebounceMs);
      }}
    />
  );
}
