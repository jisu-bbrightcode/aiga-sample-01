/**
 * 공용 TipTap 에디터 모듈
 *
 * 사용:
 * import { TipTapEditor } from "@repo/ui/editor/tiptap-editor";
 * import { TipTapViewer } from "@repo/ui/editor/tiptap-viewer";
 * import { EditorToolbar } from "@repo/ui/editor/editor-toolbar";
 */

export { createEditorExtensions, createViewerExtensions } from "./editor-extensions";
export { EditorToolbar } from "./editor-toolbar";
export { TipTapEditor } from "./tiptap-editor";
export { TipTapViewer } from "./tiptap-viewer";
export type { EditorExtensionOptions, TipTapContent, ToolbarVariant } from "./types";
