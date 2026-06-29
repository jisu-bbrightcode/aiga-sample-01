# Agent Desk 프롬프트 UI 상품성 고도화 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** ChatGPT/Claude 수준으로 에이전트 데스크 채팅 UI의 상품성을 향상한다.

**Architecture:** 기존 코드 구조(pages/hooks/components)를 유지하면서 7가지 영역을 점진적으로 개선한다. 프론트엔드 중심이며 백엔드는 세션 제목 변경, 메시지 삭제(재생성용) 2가지만 추가한다.

**Tech Stack:** React 19, TanStack Router/Query, Jotai, Tailwind CSS 4.1, @repo/ui (shadcn Base-UI), sonner (toast), date-fns, lucide-react

---

## Task 1: 스트리밍 abort 시 partial 메시지 정리 + 에러 핸들링

**Files:**
- Modify: `apps/app/src/features/agent-desk/hooks/use-stream-chat.ts`
- Modify: `apps/app/src/features/agent-desk/pages/chat.tsx`

**Step 1: use-stream-chat.ts — abort 시 streamingContent 정리**

`use-stream-chat.ts`에서 abort를 래핑하여 streamingContent를 즉시 초기화한다.

```typescript
// use-stream-chat.ts — 전체 파일 교체
import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSseStream } from "@repo/ui/hooks/use-sse-stream";
import { useTRPC, getAuthHeaders, API_URL } from "../../../lib/trpc";
import { toast } from "sonner";

interface StreamEvent {
  type: "chunk" | "done" | "error";
  content?: string;
}

export function useStreamChat() {
  const [streamingContent, setStreamingContent] = useState("");
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  const { send: sseSend, abort: sseAbort, isStreaming } = useSseStream<StreamEvent>({
    url: `${API_URL}/api/agent-desk/chat/stream`,
    getHeaders: () => getAuthHeaders(),
  });

  const send = useCallback(
    async (sessionId: string, content: string, model?: string) => {
      setStreamingContent("");

      try {
        await sseSend({
          body: { sessionId, content, ...(model ? { model } : {}) },
          onEvent: (event) => {
            if (event.type === "chunk" && event.content) {
              setStreamingContent((prev) => prev + event.content);
            } else if (event.type === "error") {
              toast.error(event.content ?? "스트리밍 오류가 발생했습니다.");
            }
          },
          onComplete: () => {
            queryClient.invalidateQueries({
              queryKey: trpc.agentDesk.getSession.queryKey({ id: sessionId }),
            });
          },
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "메시지 전송에 실패했습니다.";
        toast.error(msg);
      }

      setStreamingContent("");
    },
    [sseSend, queryClient, trpc],
  );

  const abort = useCallback(() => {
    sseAbort();
    setStreamingContent("");
  }, [sseAbort]);

  return { send, abort, isStreaming, streamingContent };
}
```

핵심 변경:
- `abort` 래핑: `sseAbort()` + `setStreamingContent("")`
- `send`에 `try/catch` 추가 + `toast.error()`
- `onEvent`의 error type에서 throw 대신 `toast.error()`

**Step 2: chat.tsx — handleSend에 에러 처리 추가**

`chat.tsx:125-136`의 `handleSend`에서 에러 시 optimisticUserMessage를 정리한다.

```typescript
// chat.tsx handleSend 교체 (라인 125-136)
const handleSend = useCallback(async () => {
  if (!input.trim() || isStreaming) return;
  const content = input.trim();
  setInput("");
  setOptimisticUserMessage(content);

  try {
    await send(sessionId, content, selectedModel);
  } catch {
    // send 내부에서 toast 처리됨, optimistic 메시지만 정리
  } finally {
    setOptimisticUserMessage(null);
  }
}, [input, isStreaming, send, sessionId, selectedModel]);
```

**Step 3: 빌드 확인**

Run: `cd apps/app && pnpm tsc --noEmit`
Expected: 성공 (에러 없음)

**Step 4: Commit**

```bash
git add apps/app/src/features/agent-desk/hooks/use-stream-chat.ts apps/app/src/features/agent-desk/pages/chat.tsx
git commit -m "fix(agent-desk): handle streaming abort and errors with toast feedback"
```

---

## Task 2: 파일 업로드 에러 피드백 (toast)

**Files:**
- Modify: `apps/app/src/features/agent-desk/hooks/use-file-upload.ts`

**Step 1: 에러 피드백 추가**

`use-file-upload.ts`에서 잘못된 파일 타입/크기 초과 시 toast를 표시하고, 파싱 실패도 사용자에게 알린다.

```typescript
// use-file-upload.ts — 전체 파일 교체
import { useState, useCallback, useRef } from "react";
import { uploadFile } from "@/features/file-manager";
import { useConfirmUpload, useParseFile, useFiles } from "./use-agent-desk";
import { toast } from "sonner";

interface UploadingFile {
  id: string;
  name: string;
  progress: "uploading" | "confirming" | "parsing" | "done" | "error";
  error?: string;
}

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "text/markdown",
  "text/plain",
];

const ACCEPTED_EXTENSIONS = ".pdf,.pptx,.png,.jpg,.jpeg,.webp,.gif,.md,.txt";
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function useFileUpload(sessionId: string) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const confirmUpload = useConfirmUpload();
  const parseFile = useParseFile();
  const { refetch: refetchFiles } = useFiles(sessionId);

  const updateFile = useCallback((id: string, update: Partial<UploadingFile>) => {
    setUploadingFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...update } : f)),
    );
  }, []);

  const removeUploadingFile = useCallback((id: string) => {
    setUploadingFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const upload = useCallback(async (files: File[]) => {
    const validFiles: File[] = [];
    const rejectedFiles: { name: string; reason: string }[] = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        rejectedFiles.push({
          name: file.name,
          reason: `크기 초과 (${formatFileSize(file.size)} / 최대 50MB)`,
        });
        continue;
      }
      if (!ACCEPTED_TYPES.includes(file.type) && !file.name.match(/\.(md|txt)$/i)) {
        const ext = file.name.split(".").pop() ?? "알 수 없는 형식";
        rejectedFiles.push({
          name: file.name,
          reason: `지원하지 않는 형식 (.${ext})`,
        });
        continue;
      }
      validFiles.push(file);
    }

    // 거부된 파일 피드백
    for (const rejected of rejectedFiles) {
      toast.error(`${rejected.name}: ${rejected.reason}`);
    }

    if (validFiles.length === 0) return;

    const newUploading: UploadingFile[] = validFiles.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      progress: "uploading" as const,
    }));

    setUploadingFiles((prev) => [...prev, ...newUploading]);

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i]!;
      const trackingId = newUploading[i]!.id;

      try {
        updateFile(trackingId, { progress: "uploading" });

        const record = await uploadFile(file, {
          bucket: "files",
          folder: `agent-desk/${sessionId}`,
        });

        updateFile(trackingId, { progress: "confirming" });

        const confirmed = await confirmUpload.mutateAsync({
          sessionId,
          fileName: record.name,
          originalName: record.originalName,
          mimeType: record.mimeType,
          size: record.size,
          storageUrl: record.url,
        });

        updateFile(trackingId, { progress: "parsing" });

        try {
          await parseFile.mutateAsync({ fileId: confirmed.id });
        } catch {
          toast.warning(`${file.name}: 파일 파싱에 실패했습니다. 텍스트 추출 없이 계속됩니다.`);
        }

        updateFile(trackingId, { progress: "done" });
        await refetchFiles();

        setTimeout(() => removeUploadingFile(trackingId), 1000);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "업로드 실패";
        updateFile(trackingId, { progress: "error", error: msg });
        toast.error(`${file.name}: ${msg}`);
        setTimeout(() => removeUploadingFile(trackingId), 5000);
      }
    }
  }, [sessionId, confirmUpload, parseFile, refetchFiles, updateFile, removeUploadingFile]);

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      upload(Array.from(files));
    }
    if (e.target) e.target.value = "";
  }, [upload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      upload(Array.from(files));
    }
  }, [upload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return {
    uploadingFiles,
    upload,
    fileInputRef,
    openFileDialog,
    handleFileChange,
    handleDrop,
    handleDragOver,
    acceptedExtensions: ACCEPTED_EXTENSIONS,
  };
}
```

핵심 변경:
- 파일 유효성 검사에서 거부 사유를 수집하고 `toast.error()` 표시
- 파싱 실패 시 `toast.warning()` (silent catch 대신)
- 업로드 실패 시 `toast.error()` 추가
- `upload` 함수를 외부에서도 사용할 수 있도록 export (이미지 페이스트용)

**Step 2: 빌드 확인**

Run: `cd apps/app && pnpm tsc --noEmit`

**Step 3: Commit**

```bash
git add apps/app/src/features/agent-desk/hooks/use-file-upload.ts
git commit -m "fix(agent-desk): add toast feedback for file upload errors and parse failures"
```

---

## Task 3: 입력 영역 고도화 (자동 리사이즈, Esc 중지, 이미지 페이스트, 포커스)

**Files:**
- Modify: `apps/app/src/features/agent-desk/pages/chat.tsx`

**Step 1: Textarea 자동 리사이즈 + Esc 중지 + 이미지 페이스트 + 자동 포커스**

chat.tsx에서 입력 영역 관련 코드를 개선한다.

변경 1 — textarea ref 추가 + auto-resize:
```typescript
// chat.tsx 상단 state 선언부 근처에 추가 (line 60 근처)
const textareaRef = useRef<HTMLTextAreaElement>(null);
```

변경 2 — auto-resize 함수:
```typescript
// handleKeyDown 뒤에 추가
const adjustTextareaHeight = useCallback(() => {
  const textarea = textareaRef.current;
  if (!textarea) return;
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
}, []);
```

변경 3 — Esc 키로 생성 중지:
```typescript
// useEffect 추가 (sessionId ref reset 근처)
useEffect(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape" && isStreaming) {
      abort();
    }
  };
  document.addEventListener("keydown", handleEscape);
  return () => document.removeEventListener("keydown", handleEscape);
}, [isStreaming, abort]);
```

변경 4 — 이미지 페이스트:
```typescript
// handleKeyDown 뒤에 추가
const handlePaste = useCallback((e: React.ClipboardEvent) => {
  const items = e.clipboardData?.items;
  if (!items) return;

  const imageFiles: File[] = [];
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) imageFiles.push(file);
    }
  }

  if (imageFiles.length > 0) {
    e.preventDefault();
    upload(imageFiles);
  }
}, [upload]);
```

> 참고: `useFileUpload`에서 `upload` 함수를 destructure 해야 함.

변경 5 — 자동 포커스 (전송 완료 후):
```typescript
// handleSend finally 블록에 추가
} finally {
  setOptimisticUserMessage(null);
  textareaRef.current?.focus();
}
```

변경 6 — 페이지 로드 시 자동 포커스:
```typescript
// useEffect 추가
useEffect(() => {
  textareaRef.current?.focus();
}, [sessionId]);
```

변경 7 — Textarea JSX 업데이트 (chat.tsx line 305-312):
```tsx
<Textarea
  ref={textareaRef}
  value={input}
  onChange={(e) => {
    setInput(e.target.value);
    adjustTextareaHeight();
  }}
  onKeyDown={handleKeyDown}
  onPaste={handlePaste}
  placeholder={isStreaming ? "응답 대기 중..." : "메시지를 입력하세요..."}
  disabled={isStreaming}
  className="min-h-[44px] max-h-[200px] resize-none"
  rows={1}
/>
```

변경 8 — useFileUpload destructure 업데이트 (line 67-75):
```typescript
const {
  uploadingFiles,
  upload,
  fileInputRef,
  openFileDialog,
  handleFileChange,
  handleDrop,
  handleDragOver,
  acceptedExtensions,
} = useFileUpload(sessionId);
```

**Step 2: 빌드 확인**

Run: `cd apps/app && pnpm tsc --noEmit`

**Step 3: Commit**

```bash
git add apps/app/src/features/agent-desk/pages/chat.tsx
git commit -m "feat(agent-desk): auto-resize textarea, Esc abort, image paste, auto-focus"
```

---

## Task 4: 빈 화면 추천 프롬프트 카드

**Files:**
- Modify: `apps/app/src/features/agent-desk/pages/chat.tsx`

**Step 1: EmptyState 컴포넌트 교체**

chat.tsx의 `EmptyState` 컴포넌트(line 408-426)를 추천 프롬프트 카드가 포함된 버전으로 교체한다.

```typescript
// EmptyState 전체 교체
function EmptyState({
  sessionType,
  onSelectPrompt,
  onUpload,
}: {
  sessionType: "customer" | "operator";
  onSelectPrompt: (text: string) => void;
  onUpload: () => void;
}) {
  const prompts = sessionType === "customer" ? CUSTOMER_PROMPTS : OPERATOR_PROMPTS;

  return (
    <div className="flex flex-col items-center gap-6 py-12 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
        <Bot className="size-8 text-primary" />
      </div>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-semibold">
          {sessionType === "customer"
            ? "서비스를 만들어 보세요"
            : "Feature를 분석해 보세요"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {sessionType === "customer"
            ? "요구사항을 설명하면 서비스를 자동으로 생성해 드립니다"
            : "기획문서나 화면 캡처를 업로드하면 구현 분석을 시작합니다"}
        </p>
      </div>

      <div className="grid w-full max-w-lg grid-cols-2 gap-3">
        {prompts.map((prompt) => (
          <button
            key={prompt.label}
            type="button"
            onClick={() => onSelectPrompt(prompt.text)}
            className="flex items-start gap-3 rounded-xl border bg-background p-3.5 text-left transition-colors hover:bg-accent/50"
          >
            <span className="mt-0.5 text-lg">{prompt.icon}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{prompt.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                {prompt.description}
              </p>
            </div>
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        또는{" "}
        <button
          type="button"
          onClick={onUpload}
          className="text-primary hover:underline"
        >
          파일을 업로드
        </button>
        하여 시작하세요
      </p>
    </div>
  );
}
```

Constants 섹션에 추가:
```typescript
/* -------------------------------------------------------------------------------------------------
 * Constants
 * -----------------------------------------------------------------------------------------------*/

const CUSTOMER_PROMPTS = [
  {
    icon: "📄",
    label: "기획문서로 분석",
    description: "기획서나 PRD를 업로드하면 서비스를 설계해 드립니다",
    text: "기획문서를 준비했습니다. 파일을 업로드할게요. 문서를 분석해서 서비스 구현에 필요한 기능들을 정리해 주세요.",
  },
  {
    icon: "🖼️",
    label: "화면 캡처로 분석",
    description: "경쟁 서비스 캡처를 보고 유사 서비스를 설계합니다",
    text: "경쟁 서비스 화면을 캡처했습니다. 이 화면들을 분석해서 유사한 기능을 가진 서비스를 설계해 주세요.",
  },
  {
    icon: "📊",
    label: "PPT로 요구사항 전달",
    description: "발표자료에 정리된 요구사항으로 서비스를 설계합니다",
    text: "요구사항을 PPT로 정리했습니다. 파일을 분석해서 서비스로 구현할 수 있는 기능들을 제안해 주세요.",
  },
  {
    icon: "💡",
    label: "아이디어로 시작",
    description: "간단한 아이디어만으로도 서비스 설계가 가능합니다",
    text: "새로운 서비스 아이디어가 있습니다. ",
  },
];

const OPERATOR_PROMPTS = [
  {
    icon: "📋",
    label: "FRD로 Feature 구현",
    description: "FRD 문서를 기반으로 Feature를 자동 구현합니다",
    text: "FRD 문서를 준비했습니다. 파일을 업로드할게요. 이 기능 요구사항을 분석하고 Product Builder Feature로 구현해 주세요.",
  },
  {
    icon: "🖼️",
    label: "화면 디자인으로 구현",
    description: "UI 디자인/캡처를 보고 프론트엔드를 구현합니다",
    text: "화면 디자인을 준비했습니다. 이 디자인을 기반으로 React 컴포넌트와 페이지를 구현해 주세요.",
  },
  {
    icon: "🔧",
    label: "기존 Feature 개선",
    description: "현재 Feature를 분석하고 개선점을 제안합니다",
    text: "기존 Feature를 개선하고 싶습니다. 현재 구현 상태를 분석하고 개선할 수 있는 부분을 제안해 주세요.",
  },
  {
    icon: "🔍",
    label: "Gap 분석 요청",
    description: "요구사항 문서와 현재 시스템의 차이를 분석합니다",
    text: "요구사항 문서를 업로드할게요. 현재 시스템과 비교해서 Gap 분석을 해주세요.",
  },
];
```

호출부 변경 (chat.tsx line 211-213):
```tsx
{!hasMessages && !optimisticUserMessage && !isStreaming && (
  <EmptyState
    sessionType={session.type as "customer" | "operator"}
    onSelectPrompt={(text) => setInput(text)}
    onUpload={openFileDialog}
  />
)}
```

**Step 2: 빌드 확인**

Run: `cd apps/app && pnpm tsc --noEmit`

**Step 3: Commit**

```bash
git add apps/app/src/features/agent-desk/pages/chat.tsx
git commit -m "feat(agent-desk): add suggestion prompt cards to empty state"
```

---

## Task 5: 파일 아이콘 확장 + 인라인 이미지 썸네일

**Files:**
- Modify: `apps/app/src/features/agent-desk/pages/chat.tsx`

**Step 1: getFileIcon 확장 + FileCard 이미지 썸네일**

chat.tsx의 `getFileIcon` 함수(line 651-659)를 확장하고, FileCard에 이미지 썸네일을 추가한다.

```typescript
// getFileIcon 교체
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return <ImageIcon className="size-4 shrink-0 text-blue-500" />;
  }
  if (mimeType === "application/pdf") {
    return <FileText className="size-4 shrink-0 text-destructive" />;
  }
  if (mimeType.includes("presentationml") || mimeType.includes("powerpoint")) {
    return <FileText className="size-4 shrink-0 text-orange-500" />;
  }
  if (mimeType.includes("wordprocessingml") || mimeType.includes("msword")) {
    return <FileText className="size-4 shrink-0 text-blue-600" />;
  }
  if (mimeType.includes("spreadsheetml") || mimeType.includes("excel")) {
    return <FileText className="size-4 shrink-0 text-green-600" />;
  }
  if (mimeType === "text/markdown") {
    return <FileText className="size-4 shrink-0 text-muted-foreground" />;
  }
  return <FileIcon className="size-4 shrink-0 text-muted-foreground" />;
}
```

FileCard에 `storageUrl` prop 추가하여 이미지 썸네일을 표시:

```typescript
// FileCard interface + component 업데이트
function FileCard({
  name,
  mimeType,
  status,
  error,
  storageUrl,
  onRemove,
  onPreview,
}: {
  name: string;
  mimeType: string;
  status: string;
  error?: string;
  storageUrl?: string;
  onRemove?: () => void;
  onPreview?: () => void;
}) {
  const isImage = mimeType.startsWith("image/");
  const icon = getFileIcon(mimeType);
  const statusIcon = getStatusIcon(status);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            className={cn(
              "group relative flex shrink-0 items-center gap-2 rounded-lg bg-background px-3 py-2 shadow-sm",
              onPreview && "cursor-pointer hover:bg-accent/50 transition-colors",
            )}
            onClick={onPreview}
          />
        }
      >
        {isImage && storageUrl ? (
          <img
            src={storageUrl}
            alt={name}
            className="size-8 shrink-0 rounded object-cover"
          />
        ) : (
          icon
        )}
        <span className="max-w-[100px] truncate text-sm">{name}</span>
        {statusIcon}

        {onPreview && (
          <Eye className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        )}

        {onRemove && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute -right-1.5 -top-1.5 hidden size-5 items-center justify-center rounded-full bg-muted-foreground text-background transition-colors hover:bg-foreground group-hover:flex"
          >
            <X className="size-3" />
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent>
        {error ? `오류: ${error}` : onPreview ? `${name} — 클릭하여 내용 보기` : name}
      </TooltipContent>
    </Tooltip>
  );
}
```

FileArea에서 storageUrl 전달 (line 455-468 수정):
```tsx
{files.map((file) => (
  <FileCard
    key={file.id}
    name={file.originalName}
    mimeType={file.mimeType}
    status={file.parsedContent ? "parsed" : file.parsedAt ? "error" : "pending"}
    storageUrl={(file as any).storageUrl}
    onRemove={() => onRemove(file.id)}
    onPreview={file.parsedContent ? () => onPreview({
      name: file.originalName,
      mimeType: file.mimeType,
      parsedContent: file.parsedContent,
      size: file.size,
    }) : undefined}
  />
))}
```

> 참고: `files` 응답에 `storageUrl`이 포함되는지 확인 필요. 포함되지 않으면 `(file as any).storageUrl` → `undefined`로 fallback되어 아이콘 표시.

**Step 2: 빌드 확인**

Run: `cd apps/app && pnpm tsc --noEmit`

**Step 3: Commit**

```bash
git add apps/app/src/features/agent-desk/pages/chat.tsx
git commit -m "feat(agent-desk): expand file icons and add inline image thumbnails"
```

---

## Task 6: 메시지 액션 (복사, 재생성)

**Files:**
- Create: `apps/app/src/features/agent-desk/components/message-actions.tsx`
- Modify: `apps/app/src/features/agent-desk/pages/chat.tsx`

**Step 1: MessageActions 컴포넌트 생성**

```typescript
// apps/app/src/features/agent-desk/components/message-actions.tsx
import { useState, useCallback } from "react";
import { Button } from "@repo/ui/shadcn/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/shadcn/tooltip";
import { Copy, Check, RefreshCw, ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";

interface Props {
  content: string;
  variant: "user" | "assistant";
  isLastAssistant?: boolean;
  onRegenerate?: () => void;
}

export function MessageActions({ content, variant, isLastAssistant, onRegenerate }: Props) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success("복사되었습니다");
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  return (
    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/message:opacity-100">
      <ActionButton
        icon={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        tooltip="복사"
        onClick={handleCopy}
      />

      {variant === "assistant" && isLastAssistant && onRegenerate && (
        <ActionButton
          icon={<RefreshCw className="size-3.5" />}
          tooltip="재생성"
          onClick={onRegenerate}
        />
      )}

      {variant === "assistant" && (
        <>
          <ActionButton
            icon={<ThumbsUp className={`size-3.5 ${feedback === "up" ? "fill-current" : ""}`} />}
            tooltip="좋아요"
            onClick={() => setFeedback(feedback === "up" ? null : "up")}
          />
          <ActionButton
            icon={<ThumbsDown className={`size-3.5 ${feedback === "down" ? "fill-current" : ""}`} />}
            tooltip="싫어요"
            onClick={() => setFeedback(feedback === "down" ? null : "down")}
          />
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Components
 * -----------------------------------------------------------------------------------------------*/

function ActionButton({
  icon,
  tooltip,
  onClick,
}: {
  icon: React.ReactNode;
  tooltip: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-foreground"
            onClick={onClick}
          />
        }
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
```

**Step 2: chat.tsx에 MessageActions 통합**

chat.tsx의 메시지 렌더링 부분(line 215-222)을 수정하여 MessageActions를 포함한다.

메시지 렌더링 교체:
```tsx
{session.messages.map((msg, index) => {
  const isLastAssistant =
    msg.role === "agent" &&
    index === session.messages.length - 1 &&
    !isStreaming;

  return (
    <div key={msg.id} className="group/message">
      <ChatMessage
        content={msg.content.replace("[ANALYZE_REQUEST]", "").trim()}
        variant={msg.role === "user" ? "user" : "assistant"}
        showAvatar={msg.role !== "user"}
      />
      <div className="mt-1 flex justify-end">
        <MessageActions
          content={msg.content.replace("[ANALYZE_REQUEST]", "").trim()}
          variant={msg.role === "user" ? "user" : "assistant"}
          isLastAssistant={isLastAssistant}
          onRegenerate={isLastAssistant ? handleRegenerate : undefined}
        />
      </div>
    </div>
  );
})}
```

chat.tsx에 `handleRegenerate` 함수 추가 (handleSend 근처):
```typescript
const handleRegenerate = useCallback(async () => {
  if (isStreaming || !session?.messages) return;

  // 마지막 user 메시지 찾기
  const messages = [...session.messages].reverse();
  const lastUserMsg = messages.find((m) => m.role === "user");
  if (!lastUserMsg) return;

  // 마지막 user 메시지 내용으로 재전송
  try {
    await send(sessionId, lastUserMsg.content, selectedModel);
  } catch {
    // send 내부에서 toast 처리됨
  }
}, [isStreaming, session?.messages, send, sessionId, selectedModel]);
```

import 추가:
```typescript
import { MessageActions } from "../components/message-actions";
```

**Step 3: 빌드 확인**

Run: `cd apps/app && pnpm tsc --noEmit`

**Step 4: Commit**

```bash
git add apps/app/src/features/agent-desk/components/message-actions.tsx apps/app/src/features/agent-desk/pages/chat.tsx
git commit -m "feat(agent-desk): add message actions (copy, regenerate, thumbs)"
```

---

## Task 7: 세션 목록 개선 (미리보기, 상대시간, 검색, 시간그룹핑)

**Files:**
- Modify: `apps/app/src/features/agent-desk/pages/session-list.tsx`

**Step 1: session-list.tsx 전면 개선**

```typescript
// session-list.tsx — 전체 파일 교체
import { useState, useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@repo/ui/shadcn/button";
import { Input } from "@repo/ui/shadcn/input";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { Plus, MessageSquare, Trash2, Search } from "lucide-react";
import { formatDistanceToNow, isToday, isYesterday, isThisWeek } from "date-fns";
import { ko } from "date-fns/locale";
import { useSessions, useCreateSession, useDeleteSession } from "../hooks";
import { StatusBadge } from "../components/status-badge";
import type { SessionType } from "../types";

interface Props {
  type: SessionType;
}

export function SessionList({ type }: Props) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const { data: sessions, isLoading, error } = useSessions(type);
  const createSession = useCreateSession();
  const deleteSession = useDeleteSession();

  const handleCreate = async () => {
    const result = await createSession.mutateAsync({
      type,
      title: type === "customer" ? "새 서비스 상담" : "새 Feature 분석",
    });
    navigate({ to: "/agent-desk/$sessionId", params: { sessionId: result.session.id } });
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteSession.mutate({ id });
  };

  const filteredSessions = useMemo(() => {
    if (!sessions) return [];
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter((s) =>
      (s.title ?? "").toLowerCase().includes(q),
    );
  }, [sessions, searchQuery]);

  const groupedSessions = useMemo(() => {
    const groups: { label: string; sessions: typeof filteredSessions }[] = [];
    const today: typeof filteredSessions = [];
    const yesterday: typeof filteredSessions = [];
    const thisWeek: typeof filteredSessions = [];
    const older: typeof filteredSessions = [];

    for (const session of filteredSessions) {
      const date = new Date(session.createdAt);
      if (isToday(date)) today.push(session);
      else if (isYesterday(date)) yesterday.push(session);
      else if (isThisWeek(date)) thisWeek.push(session);
      else older.push(session);
    }

    if (today.length > 0) groups.push({ label: "오늘", sessions: today });
    if (yesterday.length > 0) groups.push({ label: "어제", sessions: yesterday });
    if (thisWeek.length > 0) groups.push({ label: "이번 주", sessions: thisWeek });
    if (older.length > 0) groups.push({ label: "이전", sessions: older });

    return groups;
  }, [filteredSessions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-destructive">오류가 발생했습니다.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          {type === "customer"
            ? "새로운 서비스를 만들어 보세요."
            : "새 Feature를 분석하고 구현해 보세요."}
        </p>
        <Button onClick={handleCreate} disabled={createSession.isPending}>
          <Plus className="mr-2 size-4" />
          새 세션
        </Button>
      </div>

      {/* 검색 */}
      {sessions && sessions.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="세션 검색..."
            className="pl-9"
          />
        </div>
      )}

      {!sessions || sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <MessageSquare className="text-muted-foreground size-12" />
          <p className="text-muted-foreground">아직 세션이 없습니다.</p>
          <Button onClick={handleCreate} disabled={createSession.isPending}>
            시작하기
          </Button>
        </div>
      ) : groupedSessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8">
          <Search className="text-muted-foreground size-8" />
          <p className="text-muted-foreground">검색 결과가 없습니다.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groupedSessions.map((group) => (
            <div key={group.label} className="flex flex-col gap-3">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {group.label}
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {group.sessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Components
 * -----------------------------------------------------------------------------------------------*/

function SessionCard({
  session,
  onDelete,
}: {
  session: {
    id: string;
    title: string | null;
    status: string;
    createdAt: string;
    messages?: Array<{ content: string; role: string }>;
  };
  onDelete: (id: string, e: React.MouseEvent) => void;
}) {
  const lastMessage = session.messages?.at(-1);
  const preview = lastMessage
    ? lastMessage.content
        .replace("[ANALYZE_REQUEST]", "")
        .trim()
        .slice(0, 100)
    : null;

  return (
    <Link
      to="/agent-desk/$sessionId"
      params={{ sessionId: session.id }}
    >
      <Card className="cursor-pointer transition-colors hover:bg-accent/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="truncate text-base">
            {session.title ?? "제목 없음"}
          </CardTitle>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge status={session.status} />
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={(e) => onDelete(session.id, e)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {preview && (
            <p className="mb-1.5 truncate text-sm text-muted-foreground">
              {preview}
            </p>
          )}
          <p className="text-xs text-muted-foreground/70">
            {formatDistanceToNow(new Date(session.createdAt), {
              addSuffix: true,
              locale: ko,
            })}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
```

> 참고: `session.messages`가 `listSessions` 응답에 포함되지 않을 수 있음. 이 경우 `preview`가 null이 되어 자연스럽게 숨겨짐. 최적의 UX를 위해선 백엔드에서 `lastMessagePreview` 필드를 추가하는 것이 좋지만, 프론트엔드만으로도 동작하는 구조.

**Step 2: date-fns 의존성 확인**

Run: `cd apps/app && grep "date-fns" package.json`

이미 설치되어 있으면 스킵. 없으면:
Run: `cd apps/app && pnpm add date-fns`

**Step 3: 빌드 확인**

Run: `cd apps/app && pnpm tsc --noEmit`

**Step 4: Commit**

```bash
git add apps/app/src/features/agent-desk/pages/session-list.tsx
git commit -m "feat(agent-desk): improve session list with search, time groups, message preview"
```

---

## Task 8: 시각적 폴리시 (모델 셀렉터, 전송 버튼, 파이프라인 패널, 모바일)

**Files:**
- Modify: `apps/app/src/features/agent-desk/pages/chat.tsx`
- Modify: `apps/app/src/features/agent-desk/components/pipeline-panel.tsx`

**Step 1: 입력 영역 레이아웃 통합 (파일 + 모델 + 입력)**

chat.tsx의 입력 영역 전체를 하나의 통합된 컴포지터로 재구성한다. 파일 영역을 입력 영역 안으로 이동.

```tsx
{/* Composer — 파일 + 모델 + 입력을 하나의 카드로 통합 */}
<div className="border-t bg-background px-4 py-3">
  <div className="mx-auto max-w-3xl">
    <div className="rounded-xl border bg-background shadow-sm">
      {/* 첨부 파일 (있을 때만) */}
      {hasFiles && (
        <div className="flex items-center gap-2 overflow-x-auto border-b px-3 py-2 scrollbar-hide">
          {files?.map((file) => (
            <FileCard
              key={file.id}
              name={file.originalName}
              mimeType={file.mimeType}
              status={file.parsedContent ? "parsed" : file.parsedAt ? "error" : "pending"}
              storageUrl={(file as any).storageUrl}
              onRemove={() => removeFile.mutate({ fileId: file.id })}
              onPreview={file.parsedContent ? () => setPreviewFile({
                name: file.originalName,
                mimeType: file.mimeType,
                parsedContent: file.parsedContent,
                size: file.size,
              }) : undefined}
            />
          ))}
          {uploadingFiles.map((file) => (
            <FileCard
              key={file.id}
              name={file.name}
              mimeType=""
              status={file.progress as any}
              error={file.error}
            />
          ))}
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  onClick={openFileDialog}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-foreground"
                />
              }
            >
              <Plus className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent>파일 추가</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* 입력 행 */}
      <div className="flex items-end gap-2 px-3 py-2">
        <Tooltip>
          <TooltipTrigger
            render={<Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={openFileDialog} />}
          >
            <Plus className="size-4" />
          </TooltipTrigger>
          <TooltipContent>파일 추가</TooltipContent>
        </Tooltip>

        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            adjustTextareaHeight();
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={isStreaming ? "응답 대기 중..." : "메시지를 입력하세요..."}
          disabled={isStreaming}
          className="min-h-[40px] max-h-[200px] resize-none border-none bg-transparent shadow-none focus-visible:ring-0"
          rows={1}
        />

        {isStreaming ? (
          <Button
            variant="outline"
            size="icon"
            className="size-8 shrink-0 animate-pulse"
            onClick={abort}
          >
            <Square className="size-3.5" />
          </Button>
        ) : (
          <Button
            size="icon"
            className={cn(
              "size-8 shrink-0 transition-colors",
              input.trim() ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
            onClick={handleSend}
            disabled={!input.trim()}
          >
            <Send className="size-3.5" />
          </Button>
        )}
      </div>

      {/* 하단 바: 모델 선택 + 단축키 힌트 */}
      <div className="flex items-center justify-between border-t px-3 py-1.5">
        <ModelSelector
          models={models ?? []}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
        />
        <span className="text-[11px] text-muted-foreground/50">
          {isStreaming ? "Esc로 중지" : "Enter로 전송 · Shift+Enter 줄바꿈"}
        </span>
      </div>
    </div>
  </div>
</div>
```

> 기존의 FileArea 컴포넌트와 별도 입력 영역을 하나의 통합 컴포지터로 병합. 기존 `FileArea` 함수는 제거 가능.

**Step 2: 파이프라인 패널 Priority/Complexity 한국어화**

pipeline-panel.tsx의 PriorityBadge와 ComplexityBadge를 한국어로 표시:

```typescript
// pipeline-panel.tsx — PriorityBadge 교체
function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, { label: string; color: string }> = {
    high: { label: "높음", color: "bg-destructive/10 text-destructive" },
    medium: { label: "보통", color: "bg-yellow-600/10 text-yellow-600" },
    low: { label: "낮음", color: "bg-muted text-muted-foreground" },
  };
  const { label, color } = config[priority] ?? config.low!;
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs ${color}`}>
      {label}
    </span>
  );
}

// pipeline-panel.tsx — ComplexityBadge 교체
function ComplexityBadge({ complexity }: { complexity: string }) {
  const config: Record<string, { label: string; color: string }> = {
    complex: { label: "복잡", color: "bg-destructive/10 text-destructive" },
    moderate: { label: "보통", color: "bg-yellow-600/10 text-yellow-600" },
    simple: { label: "간단", color: "bg-green-600/10 text-green-600" },
  };
  const { label, color } = config[complexity] ?? config.moderate!;
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs ${color}`}>
      {label}
    </span>
  );
}
```

**Step 3: 빌드 확인**

Run: `cd apps/app && pnpm tsc --noEmit`

**Step 4: Commit**

```bash
git add apps/app/src/features/agent-desk/pages/chat.tsx apps/app/src/features/agent-desk/components/pipeline-panel.tsx
git commit -m "feat(agent-desk): integrated composer UI, Korean labels, visual polish"
```

---

## Task 9: i18n 기반 작업 (번역 파일 + useFeatureTranslation)

**Files:**
- Create: `apps/app/src/features/agent-desk/locales/ko.json`
- Create: `apps/app/src/features/agent-desk/locales/en.json`
- Modify: `apps/app/src/i18n/resources.ts`
- Modify: `apps/app/src/features/agent-desk/pages/chat.tsx` (주요 문자열 t() 교체)
- Modify: `apps/app/src/features/agent-desk/pages/session-list.tsx`
- Modify: `apps/app/src/features/agent-desk/components/pipeline-panel.tsx`
- Modify: `apps/app/src/features/agent-desk/components/status-badge.tsx`

**Step 1: 번역 파일 생성**

```json
// apps/app/src/features/agent-desk/locales/ko.json
{
  "chatTitle": "에이전트 대화",
  "customerSubtitle": "서비스 생성 도우미",
  "operatorSubtitle": "Feature 개발 분석",
  "sessionNotFound": "세션을 찾을 수 없습니다.",
  "backToList": "목록으로 돌아가기",
  "startConversation": "대화를 시작해보세요",
  "uploadOrType": "파일을 업로드하거나 메시지를 입력하세요",
  "fileUpload": "파일 업로드",
  "addFile": "파일 추가",
  "waitingResponse": "응답 대기 중...",
  "inputPlaceholder": "메시지를 입력하세요...",
  "stopResponse": "응답 중지",
  "sendEnter": "전송 (Enter)",
  "escToStop": "Esc로 중지",
  "enterToSend": "Enter로 전송 · Shift+Enter 줄바꿈",
  "dropFiles": "파일을 놓아주세요",
  "analyzing": "Feature 분석 중...",
  "analyzingDesc": "요구사항을 분석하고 있습니다",
  "generatingSpec": "스펙 생성 중...",
  "generatingSpecDesc": "구현 스펙을 작성하고 있습니다",
  "analysisComplete": "Gap 분석 완료",
  "recommendedOrder": "권장 구현 순서",
  "generateSpec": "스펙 생성",
  "execute": "실행하기",
  "viewInTerminal": "터미널에서 보기",
  "implementing": "Feature 구현 중...",
  "stop": "중지",
  "executionInProgress": "실행이 진행 중입니다",
  "checkTerminal": "터미널에서 실행 상태를 확인하세요.",
  "retry": "재시도",
  "customerComplete": "서비스 생성 완료",
  "operatorComplete": "구현 완료",
  "customerCompleteDesc": "요청하신 서비스가 성공적으로 생성되었습니다.",
  "executionFailed": "실행 실패",
  "copied": "복사되었습니다",
  "copy": "복사",
  "regenerate": "재생성",
  "like": "좋아요",
  "dislike": "싫어요",
  "newSession": "새 세션",
  "noSessions": "아직 세션이 없습니다.",
  "startSession": "시작하기",
  "searchSessions": "세션 검색...",
  "noSearchResults": "검색 결과가 없습니다.",
  "today": "오늘",
  "yesterday": "어제",
  "thisWeek": "이번 주",
  "earlier": "이전",
  "untitled": "제목 없음",
  "loading": "로딩 중...",
  "errorOccurred": "오류가 발생했습니다.",
  "customerDescription": "새로운 서비스를 만들어 보세요.",
  "operatorDescription": "새 Feature를 분석하고 구현해 보세요.",
  "statusUploading": "업로드 중",
  "statusParsing": "파싱 중",
  "statusAnalyzing": "분석 중",
  "statusAnalyzed": "분석 완료",
  "statusReviewed": "검토 완료",
  "statusSpecGenerated": "스펙 생성됨",
  "statusProjectCreated": "프로젝트 생성됨",
  "statusExecuting": "실행 중",
  "statusExecuted": "완료",
  "statusFailed": "실패",
  "priorityHigh": "높음",
  "priorityMedium": "보통",
  "priorityLow": "낮음",
  "complexityComplex": "복잡",
  "complexityModerate": "보통",
  "complexitySimple": "간단",
  "existingFeatures": "재활용 가능한 기존 Feature",
  "gapsToImplement": "구현 필요 항목",
  "gapsCount": "{{count}}건",
  "noDetails": "상세 정보 없음",
  "specTitle": "구현 스펙",
  "specExpand": "전체 보기",
  "specCollapse": "접기",
  "streamError": "메시지 전송에 실패했습니다.",
  "fileSizeExceeded": "크기 초과",
  "fileTypeNotSupported": "지원하지 않는 형식",
  "fileParsingFailed": "파일 파싱에 실패했습니다. 텍스트 추출 없이 계속됩니다.",
  "fileParsed": "파싱 완료",
  "fileNoParsedContent": "파싱된 내용이 없습니다.",
  "fileClickToView": "클릭하여 내용 보기",
  "customerWelcomeTitle": "서비스를 만들어 보세요",
  "customerWelcomeDesc": "요구사항을 설명하면 서비스를 자동으로 생성해 드립니다",
  "operatorWelcomeTitle": "Feature를 분석해 보세요",
  "operatorWelcomeDesc": "기획문서나 화면 캡처를 업로드하면 구현 분석을 시작합니다",
  "orUploadFile": "파일을 업로드",
  "orUploadSuffix": "하여 시작하세요",
  "selectModel": "모델 선택"
}
```

```json
// apps/app/src/features/agent-desk/locales/en.json
{
  "chatTitle": "Agent Chat",
  "customerSubtitle": "Service Creation Assistant",
  "operatorSubtitle": "Feature Development Analysis",
  "sessionNotFound": "Session not found.",
  "backToList": "Back to list",
  "startConversation": "Start a conversation",
  "uploadOrType": "Upload files or type a message",
  "fileUpload": "Upload File",
  "addFile": "Add File",
  "waitingResponse": "Waiting for response...",
  "inputPlaceholder": "Type a message...",
  "stopResponse": "Stop",
  "sendEnter": "Send (Enter)",
  "escToStop": "Esc to stop",
  "enterToSend": "Enter to send · Shift+Enter for new line",
  "dropFiles": "Drop files here",
  "analyzing": "Analyzing Features...",
  "analyzingDesc": "Analyzing your requirements",
  "generatingSpec": "Generating Spec...",
  "generatingSpecDesc": "Writing implementation specification",
  "analysisComplete": "Gap Analysis Complete",
  "recommendedOrder": "Recommended Implementation Order",
  "generateSpec": "Generate Spec",
  "execute": "Execute",
  "viewInTerminal": "View in Terminal",
  "implementing": "Implementing Feature...",
  "stop": "Stop",
  "executionInProgress": "Execution in progress",
  "checkTerminal": "Check the terminal for execution status.",
  "retry": "Retry",
  "customerComplete": "Service Created",
  "operatorComplete": "Implementation Complete",
  "customerCompleteDesc": "Your service has been successfully created.",
  "executionFailed": "Execution Failed",
  "copied": "Copied",
  "copy": "Copy",
  "regenerate": "Regenerate",
  "like": "Like",
  "dislike": "Dislike",
  "newSession": "New Session",
  "noSessions": "No sessions yet.",
  "startSession": "Get Started",
  "searchSessions": "Search sessions...",
  "noSearchResults": "No results found.",
  "today": "Today",
  "yesterday": "Yesterday",
  "thisWeek": "This Week",
  "earlier": "Earlier",
  "untitled": "Untitled",
  "loading": "Loading...",
  "errorOccurred": "An error occurred.",
  "customerDescription": "Create a new service.",
  "operatorDescription": "Analyze and implement new Features.",
  "statusUploading": "Uploading",
  "statusParsing": "Parsing",
  "statusAnalyzing": "Analyzing",
  "statusAnalyzed": "Analyzed",
  "statusReviewed": "Reviewed",
  "statusSpecGenerated": "Spec Generated",
  "statusProjectCreated": "Project Created",
  "statusExecuting": "Executing",
  "statusExecuted": "Completed",
  "statusFailed": "Failed",
  "priorityHigh": "High",
  "priorityMedium": "Medium",
  "priorityLow": "Low",
  "complexityComplex": "Complex",
  "complexityModerate": "Moderate",
  "complexitySimple": "Simple",
  "existingFeatures": "Reusable Existing Features",
  "gapsToImplement": "Items to Implement",
  "gapsCount": "{{count}} items",
  "noDetails": "No details",
  "specTitle": "Implementation Spec",
  "specExpand": "Show All",
  "specCollapse": "Collapse",
  "streamError": "Failed to send message.",
  "fileSizeExceeded": "Size exceeded",
  "fileTypeNotSupported": "Unsupported format",
  "fileParsingFailed": "File parsing failed. Continuing without text extraction.",
  "fileParsed": "Parsed",
  "fileNoParsedContent": "No parsed content available.",
  "fileClickToView": "Click to view content",
  "customerWelcomeTitle": "Create a Service",
  "customerWelcomeDesc": "Describe your requirements and we'll generate a service for you",
  "operatorWelcomeTitle": "Analyze Features",
  "operatorWelcomeDesc": "Upload design documents or screenshots to start implementation analysis",
  "orUploadFile": "upload a file",
  "orUploadSuffix": " to get started",
  "selectModel": "Select Model"
}
```

**Step 2: i18n resources.ts에 등록**

`apps/app/src/i18n/resources.ts`에 import 추가:
```typescript
import agentDeskKo from "../features/agent-desk/locales/ko.json";
import agentDeskEn from "../features/agent-desk/locales/en.json";

// resources 객체에 추가
export const resources = {
  ko: { ..., "agent-desk": agentDeskKo },
  en: { ..., "agent-desk": agentDeskEn },
};
```

**Step 3: 컴포넌트에 useFeatureTranslation 적용**

각 컴포넌트 파일 상단에:
```typescript
import { useFeatureTranslation } from "@repo/core/i18n";

// 컴포넌트 내부
const { t } = useFeatureTranslation("agent-desk");

// 사용 예시
t("chatTitle") // "에이전트 대화"
t("gapsCount", { count: feature.gaps.length }) // "3건"
```

> 이 태스크는 양이 많으므로 주요 컴포넌트(chat.tsx, session-list.tsx, pipeline-panel.tsx, status-badge.tsx)에 우선 적용하고, 나머지는 이후 단계에서 점진적으로 진행.

**Step 4: 빌드 확인**

Run: `cd apps/app && pnpm tsc --noEmit`

**Step 5: Commit**

```bash
git add apps/app/src/features/agent-desk/locales/ apps/app/src/i18n/resources.ts apps/app/src/features/agent-desk/pages/ apps/app/src/features/agent-desk/components/
git commit -m "feat(agent-desk): add i18n support with ko/en translation files"
```

---

## Task 10: Reference 문서 업데이트

**Files:**
- Modify: `docs/reference/features-frontend.md`

**Step 1: features-frontend.md에 에이전트 데스크 UI 고도화 내용 반영**

- 추천 프롬프트 카드 추가 사항
- 메시지 액션 컴포넌트 추가
- 통합 컴포지터 UI
- i18n 등록
- 새로운 컴포넌트 목록 (MessageActions, 개선된 EmptyState 등)

**Step 2: Commit**

```bash
git add docs/reference/features-frontend.md
git commit -m "docs(agent-desk): update reference documentation for UI enhancement"
```

---

## 작업 순서 및 의존성

```
Task 1: 스트리밍/에러 처리 ───┐
Task 2: 파일 업로드 에러 ─────┤── 기반 품질 (독립적)
                              │
Task 3: 입력 영역 고도화 ─────┤── Task 2에 의존 (upload 함수 사용)
Task 4: 빈 화면 프롬프트 ─────┤── 독립적
Task 5: 파일 아이콘/썸네일 ───┤── 독립적
Task 6: 메시지 액션 ──────────┤── 독립적
Task 7: 세션 목록 개선 ───────┤── 독립적
Task 8: 시각적 폴리시 ────────┤── Task 3-5에 의존
Task 9: i18n ─────────────────┤── Task 1-8 이후
Task 10: Reference 업데이트 ──┘── 모든 Task 이후
```
