# 콘텐츠 리퍼포징 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 원본 콘텐츠를 4가지 포맷(카드 뉴스, 숏폼, 트위터 스레드, 이메일 요약)으로 AI 변환하고 캔버스에서 시각적으로 관리

**Architecture:** 기존 `studio_contents` 테이블에 `derivedFromId`/`repurposeFormat` 컬럼 추가, 새 `StudioRepurposeService`에서 LLM 호출 후 파생 콘텐츠 생성, tRPC `repurpose` 네임스페이스로 API 노출, 프론트엔드에서 캔버스 노드/엣지 스타일링 + 리퍼포징 다이얼로그

**FRD:** `Product Builder/Features/콘텐츠 스튜디오/FRD-콘텐츠 리퍼포징.md` (Obsidian)

---

## Task 1: Schema — repurposeFormat enum + studioContents 컬럼 추가

**Files:**
- Modify: `packages/drizzle/src/schema/features/content-studio/index.ts`

**Changes:**

1. Enums 섹션에 `studioRepurposeFormatEnum` 추가:

```typescript
export const studioRepurposeFormatEnum = pgEnum("studio_repurpose_format", [
  "card_news",
  "short_form",
  "twitter_thread",
  "email_summary",
]);
```

2. `studioContents` 테이블에 2개 컬럼 추가:

```typescript
// studioContents 테이블 내부, slug 컬럼 다음에 추가:
derivedFromId: uuid("derived_from_id").references(() => studioContents.id, {
  onDelete: "cascade",
}),
repurposeFormat: studioRepurposeFormatEnum("repurpose_format"),
```

3. `studioContents` 인덱스에 추가:

```typescript
index("idx_studio_contents_derived_from").on(table.derivedFromId),
```

4. `studioContentsRelations`에 self-referential relation 추가:

```typescript
// 기존 relations 내부에 추가:
derivedFrom: one(studioContents, {
  fields: [studioContents.derivedFromId],
  references: [studioContents.id],
  relationName: "derivedContents",
}),
derivedContents: many(studioContents, {
  relationName: "derivedContents",
}),
```

5. Type Exports 섹션에 추가:

```typescript
export type StudioRepurposeFormat = "card_news" | "short_form" | "twitter_thread" | "email_summary";
```

**Verification:**
```bash
cd packages/drizzle && pnpm tsc --noEmit
```

---

## Task 2: Backend — StudioRepurposeService 생성

**Files:**
- Create: `packages/features/content-studio/service/studio-repurpose.service.ts`

**Dependencies:**
- `@Inject(DRIZZLE)` — DrizzleDB
- `LLMService` — AI 호출 (`@repo/features/ai`)
- `StudioBrandVoiceService` — Brand Context (`buildBrandContext()`)
- `ContentStudioService` — `assertStudioOwner()`, `createEdge()`

**주요 메서드:**

```typescript
@Injectable()
export class StudioRepurposeService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly llm: LLMService,
    private readonly brandVoice: StudioBrandVoiceService,
    private readonly studioService: ContentStudioService,
  ) {}

  /**
   * 단일 포맷 변환 (FRD-RP-001, FRD-RP-002)
   */
  async convert(input: {
    contentId: string;
    format: StudioRepurposeFormat;
    customInstruction?: string;
  }, userId: string): Promise<StudioContent> {
    // 1. 원본 콘텐츠 조회
    // 2. 검증: content가 비어있으면 BadRequestException
    // 3. 검증: derivedFromId !== null이면 BadRequestException ("파생 콘텐츠는 리퍼포징 불가")
    // 4. assertStudioOwner(studioId, userId)
    // 5. Brand Context 빌드 (있으면)
    // 6. 포맷별 프롬프트 구성 → buildPrompt(format, content, title, brandContext, customInstruction)
    // 7. llm.chatCompletion(messages, { jsonMode: true })
    // 8. JSON.parse(result)
    // 9. 기존 동일 포맷 파생물 조회 (있으면 update, 없으면 insert)
    // 10. 엣지 생성 (insert인 경우만)
    // 11. 파생 콘텐츠 반환
  }

  /**
   * 일괄 변환 (FRD-RP-003)
   */
  async convertBatch(input: {
    contentId: string;
    formats: StudioRepurposeFormat[];
    customInstruction?: string;
  }, userId: string): Promise<StudioContent[]> {
    // formats를 순차 실행 (Promise loop, 병렬 아님)
    const results: StudioContent[] = [];
    for (const format of input.formats) {
      const result = await this.convert({ contentId: input.contentId, format, customInstruction: input.customInstruction }, userId);
      results.push(result);
    }
    return results;
  }

  /**
   * 파생 콘텐츠 목록 (FRD-RP-004)
   */
  async listDerived(contentId: string, userId: string): Promise<StudioContent[]> {
    // 원본 조회 → assertStudioOwner → derivedFromId = contentId인 콘텐츠 목록 반환
  }

  /**
   * 포맷별 AI 프롬프트 빌드 (private)
   */
  private buildPrompt(
    format: StudioRepurposeFormat,
    content: string,
    title: string,
    brandContext: string | null,
    customInstruction?: string,
  ): Array<{ role: "system" | "user"; content: string }> {
    // 시스템 프롬프트: FRD 6.1 공통 + 6.2 포맷별 + brandContext + customInstruction
    // 유저 프롬프트: 원본 title + content (TipTap JSON → 텍스트 추출)
    // JSON 응답 포맷 지시 (FRD 3.3 구조)
  }

  /**
   * 파생 노드 위치 계산 (private)
   */
  private calculateDerivedPosition(
    originX: number,
    originY: number,
    format: StudioRepurposeFormat,
  ): { x: number; y: number } {
    const formatOrder = { card_news: 0, short_form: 1, twitter_thread: 2, email_summary: 3 };
    const idx = formatOrder[format];
    return {
      x: originX + (idx - 1.5) * 280,  // 원본 기준 좌우 분산
      y: originY + 250,                  // 원본 아래 250px
    };
  }
}
```

**포맷별 프롬프트 상수** (파일 하단 또는 별도 상수):
- `REPURPOSE_SYSTEM_PROMPT` — FRD 6.1 기반
- `FORMAT_PROMPTS` — FRD 6.2 기반 4가지 포맷별 지시문
- `FORMAT_TITLES` — `{ card_news: "카드 뉴스", short_form: "숏폼 스크립트", twitter_thread: "트위터 스레드", email_summary: "이메일 요약" }`

**참고 패턴:**
- `studio-ai-suggest.service.ts` — LLM 호출 + JSON 파싱 패턴
- `studio-brand-voice.service.ts` — `buildBrandContext()` 호출 패턴
- `content-studio.service.ts` — `assertStudioOwner()`, `createContent()`, `createEdge()` 패턴

**Verification:**
```bash
cd packages/features && pnpm tsc --noEmit
```

---

## Task 3: Backend — tRPC repurpose 네임스페이스 + Module 연결

**Files:**
- Modify: `packages/features/content-studio/trpc/content-studio.route.ts`
- Modify: `packages/features/content-studio/content-studio.module.ts`

**content-studio.route.ts 변경:**

1. Service Container 추가 (기존 seoServices 아래):

```typescript
import type { StudioRepurposeService } from "../service/studio-repurpose.service";

// Repurpose Service Container
const repurposeServices = createSingleServiceContainer<StudioRepurposeService>();
export const injectStudioRepurposeService = repurposeServices.inject;
```

2. Zod 스키마 추가 (기존 suggestAlternativesSchema 아래):

```typescript
// Repurpose
const convertSchema = z.object({
  contentId: z.string().uuid(),
  format: z.enum(["card_news", "short_form", "twitter_thread", "email_summary"]),
  customInstruction: z.string().max(500).optional(),
});

const convertBatchSchema = z.object({
  contentId: z.string().uuid(),
  formats: z.array(z.enum(["card_news", "short_form", "twitter_thread", "email_summary"])).min(1).max(4),
  customInstruction: z.string().max(500).optional(),
});
```

3. Router에 `repurpose` 네임스페이스 추가 (기존 `seo: router({...})` 다음):

```typescript
// Repurpose
repurpose: router({
  convert: authProcedure
    .input(convertSchema)
    .mutation(async ({ input, ctx }) => {
      return repurposeServices.service().convert(input, ctx.user!.id);
    }),

  convertBatch: authProcedure
    .input(convertBatchSchema)
    .mutation(async ({ input, ctx }) => {
      return repurposeServices.service().convertBatch(input, ctx.user!.id);
    }),

  listDerived: authProcedure
    .input(z.object({ contentId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return repurposeServices.service().listDerived(input.contentId, ctx.user!.id);
    }),
}),
```

**content-studio.module.ts 변경:**

1. Import 추가:

```typescript
import { StudioRepurposeService } from "./service/studio-repurpose.service";
import { injectStudioRepurposeService } from "./trpc";
```

2. `providers`와 `exports`에 `StudioRepurposeService` 추가
3. Constructor에 `private readonly repurposeService: StudioRepurposeService` 추가
4. `onModuleInit()`에 `injectStudioRepurposeService(this.repurposeService);` 추가

**주의:** `app-router.ts`와 `server/src/trpc/router.ts`는 수정 불필요 — `contentStudioRouter` 내부에 nested router를 추가하는 것이므로 상위 등록은 이미 되어 있음.

**Verification:**
```bash
cd packages/features && pnpm tsc --noEmit
cd apps/server && pnpm tsc --noEmit
```

---

## Task 4: Frontend — 리퍼포징 hooks 생성

**Files:**
- Create: `apps/app/src/features/content-studio/hooks/use-repurpose.ts`
- Modify: `apps/app/src/features/content-studio/hooks/index.ts` — re-export 추가

**use-repurpose.ts:**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";

/**
 * 단일 포맷 리퍼포징 mutation
 */
export function useRepurpose(studioId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const canvasKey = trpc.contentStudio.canvas.queryKey({ studioId });

  const convert = useMutation(
    trpc.contentStudio.repurpose.convert.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: canvasKey }),
    })
  );

  return { convert };
}

/**
 * 일괄 리퍼포징 mutation
 */
export function useRepurposeBatch(studioId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const canvasKey = trpc.contentStudio.canvas.queryKey({ studioId });

  const convertBatch = useMutation(
    trpc.contentStudio.repurpose.convertBatch.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: canvasKey }),
    })
  );

  return { convertBatch };
}

/**
 * 파생 콘텐츠 목록 query
 */
export function useDerivedContents(contentId: string) {
  const trpc = useTRPC();

  return useQuery(
    trpc.contentStudio.repurpose.listDerived.queryOptions({ contentId })
  );
}
```

**index.ts 추가:**

```typescript
export { useRepurpose, useRepurposeBatch, useDerivedContents } from "./use-repurpose";
```

**참고 패턴:** `use-ai-suggest.ts` — mutation + canvas invalidation 패턴

**Verification:**
```bash
cd apps/app && pnpm tsc --noEmit
```

---

## Task 5: Frontend — ContentCardNode 포맷 아이콘 + 캔버스 엣지 스타일링

**Files:**
- Modify: `apps/app/src/features/content-studio/components/canvas/content-card-node.tsx`
- Modify: `apps/app/src/features/content-studio/pages/canvas-page.tsx`

### content-card-node.tsx 변경:

1. `ContentCardNodeData` 인터페이스에 필드 추가:

```typescript
interface ContentCardNodeData {
  title: string;
  status: string;
  authorName?: string | null;
  viewCount?: number;
  topicLabel?: string | null;
  repurposeFormat?: string | null;
  derivedFromId?: string | null;
  [key: string]: unknown;
}
```

2. 포맷 아이콘 매핑 상수 추가 (Constants 섹션):

```typescript
import { LayoutGrid, Video, MessageSquare, Mail, type LucideIcon } from "lucide-react";

const FORMAT_ICON: Record<string, { icon: LucideIcon; label: string }> = {
  card_news: { icon: LayoutGrid, label: "카드 뉴스" },
  short_form: { icon: Video, label: "숏폼" },
  twitter_thread: { icon: MessageSquare, label: "스레드" },
  email_summary: { icon: Mail, label: "이메일" },
};
```

3. 컴포넌트 JSX에 포맷 아이콘 배지 추가 (상태 배지 행에):

```tsx
{/* 리퍼포징 포맷 아이콘 */}
{d.repurposeFormat && FORMAT_ICON[d.repurposeFormat] && (() => {
  const { icon: Icon, label } = FORMAT_ICON[d.repurposeFormat!];
  return (
    <span className="flex items-center gap-0.5 text-[10px] text-primary/70" title={label}>
      <Icon className="h-3 w-3" />
    </span>
  );
})()}
```

### canvas-page.tsx 변경:

1. 콘텐츠 노드 데이터 매핑에 `repurposeFormat`, `derivedFromId` 전달:

```typescript
// 기존 contentNode 데이터에 추가:
repurposeFormat: c.repurposeFormat ?? null,
derivedFromId: c.derivedFromId ?? null,
```

2. 엣지 스타일링 — 파생 엣지 감지 및 dashed 스타일 적용:

```typescript
// 파생 콘텐츠의 derivedFromId 기반 엣지 판별
const derivedContentIds = new Set(
  contents.filter((c) => c.derivedFromId).map((c) => c.id)
);

const flowEdgeList: Edge[] = edges.map((e) => {
  const isDerivedEdge = e.targetType === "content" && derivedContentIds.has(e.targetId);
  return {
    id: e.id,
    source: `${e.sourceType}-${e.sourceId}`,
    target: `${e.targetType}-${e.targetId}`,
    type: "default",
    ...(isDerivedEdge && {
      style: { strokeDasharray: "6 3", stroke: "hsl(var(--primary) / 0.5)" },
      animated: false,
    }),
  };
});
```

**Verification:**
```bash
cd apps/app && pnpm tsc --noEmit
```

---

## Task 6: Frontend — 리퍼포징 다이얼로그 (RepurposeDialog)

**Files:**
- Create: `apps/app/src/features/content-studio/components/canvas/repurpose-dialog.tsx`
- Modify: `apps/app/src/features/content-studio/components/canvas/content-card-node.tsx` — NodeToolbar 추가

### repurpose-dialog.tsx:

포맷 선택 + 커스텀 지시사항 입력 + 변환 실행 다이얼로그.

```typescript
interface Props {
  contentId: string;
  studioId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingFormats: string[];  // 이미 존재하는 파생 포맷 목록
}

export function RepurposeDialog({ contentId, studioId, open, onOpenChange, existingFormats }: Props) {
  // State: selectedFormats (string[]), customInstruction (string)
  // useRepurposeBatch(studioId) hook 사용
  // 포맷 체크박스 4개 (card_news, short_form, twitter_thread, email_summary)
  // 이미 존재하는 포맷에는 "덮어쓰기" 경고 표시
  // "변환" 버튼 → convertBatch.mutate()
  // 로딩 중 스피너 + "변환 중..." 텍스트
}
```

**UI 구성:**
- `Dialog` + `DialogContent` + `DialogHeader` (shadcn)
- 체크박스 그리드 (2x2): 각 포맷 아이콘 + 레이블
- `Textarea` for customInstruction (선택, placeholder: "추가 지시사항...")
- 하단: Cancel(ghost) + Convert(default) 버튼

### content-card-node.tsx NodeToolbar 추가:

```typescript
import { NodeToolbar, Position as ToolbarPosition } from "@xyflow/react";
import { Repeat } from "lucide-react";
import { Button } from "@repo/ui/shadcn/button";

// ContentCardNodeInner 내부에 추가 (파생 콘텐츠가 아닌 경우만):
{!d.derivedFromId && (
  <NodeToolbar position={ToolbarPosition.Right} offset={8}>
    <Button
      variant="outline"
      size="sm"
      className="h-7 gap-1 text-xs"
      onClick={() => onRepurposeClick?.(nodeId)}
    >
      <Repeat className="h-3.5 w-3.5" />
      리퍼포징
    </Button>
  </NodeToolbar>
)}
```

**주의:**
- NodeToolbar 클릭 이벤트는 canvas-page.tsx에서 상태 관리 (repurposeDialogContentId)
- `RepurposeDialog`는 canvas-page.tsx에서 렌더링
- `existingFormats`는 `useDerivedContents(contentId)` 또는 canvas 데이터에서 파생

**Verification:**
```bash
cd apps/app && pnpm tsc --noEmit
```

---

## Task 7: Frontend — canvas-page.tsx에 RepurposeDialog 연결

**Files:**
- Modify: `apps/app/src/features/content-studio/pages/canvas-page.tsx`

**Changes:**

1. 상태 추가:

```typescript
const [repurposeContentId, setRepurposeContentId] = useState<string | null>(null);
```

2. ContentCardNode에 onRepurposeClick 콜백 전달:
   - nodeTypes 또는 onNodeClick 이벤트에서 repurposeContentId 설정

3. RepurposeDialog 렌더링:

```tsx
{repurposeContentId && (
  <RepurposeDialog
    contentId={repurposeContentId}
    studioId={studioId}
    open={!!repurposeContentId}
    onOpenChange={(open) => !open && setRepurposeContentId(null)}
    existingFormats={
      contents
        .filter((c) => c.derivedFromId === repurposeContentId && c.repurposeFormat)
        .map((c) => c.repurposeFormat!)
    }
  />
)}
```

4. 원본 수정 시 갱신 제안 (FRD-RP-010):
   - `updateContent` mutation의 `onSuccess`에서 파생 콘텐츠 존재 여부 확인
   - 존재하면 toast 알림: "파생 콘텐츠를 갱신하시겠습니까?" + 갱신 버튼

**Verification:**
```bash
cd apps/app && pnpm tsc --noEmit
```

---

## Task 8: Backend — canvas 데이터에 derivedFromId/repurposeFormat 포함 확인

**Files:**
- Modify (필요시): `packages/features/content-studio/service/content-studio.service.ts`

**확인 사항:**
- `getCanvasData()` 메서드가 `studioContents`를 조회할 때 `derivedFromId`, `repurposeFormat` 필드가 자동으로 포함되는지 확인
- Drizzle `$inferSelect` 타입이므로 새 컬럼 추가 시 자동 반영됨
- 별도 수정이 필요 없을 가능성이 높지만, `select()` 대신 `findMany()`를 사용하는 경우 확인 필요

**Verification:**
```bash
cd packages/features && pnpm tsc --noEmit
cd apps/server && pnpm tsc --noEmit
```

---

## Task 9: 전체 빌드 검증 + 레퍼런스 문서 업데이트

**Verification:**
```bash
cd packages/drizzle && pnpm tsc --noEmit
cd packages/features && pnpm tsc --noEmit
cd apps/server && pnpm tsc --noEmit
cd apps/app && pnpm tsc --noEmit
```

**Files:**
- Modify: `docs/reference/features-backend.md` — contentStudio.repurpose 프로시저 추가
- Modify: `docs/reference/features-frontend.md` — repurpose hooks, RepurposeDialog 추가
- Modify: `docs/reference/database-schema.md` — studioContents.derivedFromId, repurposeFormat, studioRepurposeFormatEnum 추가

---

## 파일 변경 요약

| 파일 | 작업 |
|------|------|
| `packages/drizzle/src/schema/features/content-studio/index.ts` | enum + 컬럼 + 관계 + 타입 추가 |
| `packages/features/content-studio/service/studio-repurpose.service.ts` | **신규** — AI 리퍼포징 서비스 |
| `packages/features/content-studio/trpc/content-studio.route.ts` | repurpose 네임스페이스 + 서비스 컨테이너 |
| `packages/features/content-studio/content-studio.module.ts` | RepurposeService 등록 |
| `apps/app/src/features/content-studio/hooks/use-repurpose.ts` | **신규** — 리퍼포징 hooks |
| `apps/app/src/features/content-studio/hooks/index.ts` | re-export 추가 |
| `apps/app/src/features/content-studio/components/canvas/content-card-node.tsx` | 포맷 아이콘 + NodeToolbar |
| `apps/app/src/features/content-studio/components/canvas/repurpose-dialog.tsx` | **신규** — 포맷 선택 다이얼로그 |
| `apps/app/src/features/content-studio/pages/canvas-page.tsx` | 엣지 스타일 + 다이얼로그 연결 + 갱신 알림 |
| `packages/features/content-studio/service/content-studio.service.ts` | (확인만, 수정 불필요할 수 있음) |
| `docs/reference/features-backend.md` | repurpose 프로시저 문서화 |
| `docs/reference/features-frontend.md` | repurpose hooks/UI 문서화 |
| `docs/reference/database-schema.md` | 스키마 변경 문서화 |
