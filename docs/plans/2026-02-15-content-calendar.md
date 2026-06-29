# Content Calendar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** content-studio feature를 확장하여 월간 캘린더 뷰, 예약 발행, 반복 주기 콘텐츠 자동 복제 기능을 구현한다.

**Architecture:** 별도 feature가 아닌 기존 content-studio feature 내부 확장. DB 스키마에 컬럼/테이블 추가, 기존 tRPC 라우터에 프로시저 추가, 사이드바 그룹화, 캘린더 페이지 추가.

**Tech Stack:** Drizzle ORM (PostgreSQL) + NestJS + tRPC v11 + React + TanStack Router + date-fns + shadcn/ui

**Design Doc:** `docs/plans/2026-02-15-content-calendar-design.md`

---

## Task 1: Schema — studio_contents 컬럼 추가 + studio_recurrences 테이블 생성

기존 `studio_contents` 테이블에 `scheduledAt`, `label` 컬럼을 추가하고, `studio_recurrences` 테이블을 새로 생성한다.

**Files:**
- Modify: `packages/drizzle/src/schema/features/content-studio/index.ts`

**Step 1: `studioContents` 테이블에 컬럼 추가**

`packages/drizzle/src/schema/features/content-studio/index.ts`의 `studioContents` pgTable 정의에 두 컬럼을 추가한다:

```typescript
// publishedAt 뒤에 추가 (line ~127 부근)
scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
label: varchar("label", { length: 50 }),
```

`studioContents`의 index 배열에 `scheduledAt` 인덱스를 추가한다:

```typescript
index("idx_studio_contents_scheduled_at").on(table.scheduledAt),
```

**Step 2: `studio_recurrences` 테이블 생성**

같은 파일 내 Tables 섹션 하단(`studioEdges` 앞)에 추가:

```typescript
/**
 * Studio Recurrences - 반복 콘텐츠 규칙
 */
export const studioRecurrences = pgTable(
  "studio_recurrences",
  {
    ...baseColumns(),

    studioId: uuid("studio_id")
      .notNull()
      .references(() => studioStudios.id, { onDelete: "cascade" }),

    title: varchar("title", { length: 200 }).notNull(),
    rule: varchar("rule", { length: 50 }).notNull(),

    templateContentId: uuid("template_content_id").references(
      () => studioContents.id,
      { onDelete: "set null" }
    ),

    label: varchar("label", { length: 50 }),
    isActive: boolean("is_active").notNull().default(true),

    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),

    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("idx_studio_recurrences_studio").on(table.studioId),
    index("idx_studio_recurrences_active").on(table.isActive),
    index("idx_studio_recurrences_next_run").on(table.nextRunAt),
  ],
);
```

`boolean` import를 파일 상단의 `drizzle-orm/pg-core` import에 추가 (이미 없는 경우).

**Step 3: Relations 추가**

기존 `studioStudiosRelations`에 `recurrences: many(studioRecurrences)` 추가.

`studioRecurrences` relations 정의를 추가:

```typescript
export const studioRecurrencesRelations = relations(
  studioRecurrences,
  ({ one }) => ({
    studio: one(studioStudios, {
      fields: [studioRecurrences.studioId],
      references: [studioStudios.id],
    }),
    templateContent: one(studioContents, {
      fields: [studioRecurrences.templateContentId],
      references: [studioContents.id],
    }),
    creator: one(profiles, {
      fields: [studioRecurrences.createdBy],
      references: [profiles.id],
    }),
  }),
);
```

**Step 4: Type Exports 추가**

같은 파일 하단 Type Exports 섹션에:

```typescript
export type StudioRecurrence = typeof studioRecurrences.$inferSelect;
export type NewStudioRecurrence = typeof studioRecurrences.$inferInsert;
```

**Step 5: 빌드 확인**

Run: `cd packages/drizzle && pnpm tsc --noEmit`
Expected: 성공 (에러 없음)

**Step 6: 커밋**

```bash
git add packages/drizzle/src/schema/features/content-studio/index.ts
git commit -m "feat(schema): studio_contents에 scheduledAt/label 추가, studio_recurrences 테이블 생성"
```

---

## Task 2: Server — 캘린더 서비스 메서드 추가

`ContentStudioService`에 캘린더 관련 메서드들을 추가한다.

**Files:**
- Modify: `packages/features/content-studio/service/content-studio.service.ts`

**Step 1: import 추가**

기존 import에 `gte`, `lte`, `between`을 drizzle-orm에서 추가:

```typescript
import { eq, and, desc, count, type SQL, sql, gte, lte } from "drizzle-orm";
```

`studioRecurrences`를 `@repo/drizzle` import에 추가:

```typescript
import {
  studioStudios,
  studioTopics,
  studioContents,
  studioContentSeo,
  studioEdges,
  studioRecurrences,
} from "@repo/drizzle";
```

**Step 2: 캘린더 조회 메서드**

Service 클래스 내 SEO History 섹션 앞에 Calendar 섹션 추가:

```typescript
// ========================================
// Calendar
// ========================================

/** 월별 콘텐츠 조회 (scheduledAt 또는 publishedAt 기준) */
async getCalendarContents(studioId: string, year: number, month: number, userId: string) {
  await this.assertStudioOwner(studioId, userId);

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  return this.db
    .select({
      id: studioContents.id,
      title: studioContents.title,
      status: studioContents.status,
      label: studioContents.label,
      scheduledAt: studioContents.scheduledAt,
      publishedAt: studioContents.publishedAt,
      createdAt: studioContents.createdAt,
    })
    .from(studioContents)
    .where(
      and(
        eq(studioContents.studioId, studioId),
        eq(studioContents.isDeleted, false),
        sql`(
          (${studioContents.scheduledAt} >= ${startDate} AND ${studioContents.scheduledAt} <= ${endDate})
          OR
          (${studioContents.scheduledAt} IS NULL AND ${studioContents.publishedAt} >= ${startDate} AND ${studioContents.publishedAt} <= ${endDate})
        )`
      )
    )
    .orderBy(studioContents.scheduledAt, studioContents.publishedAt);
}

/** 콘텐츠에 scheduledAt 설정 */
async scheduleContent(contentId: string, scheduledAt: Date, userId: string) {
  const content = await this.db.select().from(studioContents).where(eq(studioContents.id, contentId)).then((r) => r[0]);
  if (!content) throw new NotFoundException("콘텐츠를 찾을 수 없습니다");
  await this.assertStudioOwner(content.studioId, userId);

  const [updated] = await this.db
    .update(studioContents)
    .set({ scheduledAt })
    .where(eq(studioContents.id, contentId))
    .returning();
  return updated!;
}

/** scheduledAt 제거 */
async unscheduleContent(contentId: string, userId: string) {
  const content = await this.db.select().from(studioContents).where(eq(studioContents.id, contentId)).then((r) => r[0]);
  if (!content) throw new NotFoundException("콘텐츠를 찾을 수 없습니다");
  await this.assertStudioOwner(content.studioId, userId);

  const [updated] = await this.db
    .update(studioContents)
    .set({ scheduledAt: null })
    .where(eq(studioContents.id, contentId))
    .returning();
  return updated!;
}
```

**Step 3: 반복 규칙 CRUD 메서드**

Calendar 섹션 바로 뒤에 Recurrence 섹션 추가:

```typescript
// ========================================
// Recurrence
// ========================================

/** 반복 규칙 목록 */
async findRecurrences(studioId: string, userId: string) {
  await this.assertStudioOwner(studioId, userId);
  return this.db
    .select()
    .from(studioRecurrences)
    .where(eq(studioRecurrences.studioId, studioId))
    .orderBy(studioRecurrences.createdAt);
}

/** 반복 규칙 생성 */
async createRecurrence(
  input: {
    studioId: string;
    title: string;
    rule: string;
    templateContentId?: string;
    label?: string;
    nextRunAt?: Date;
  },
  userId: string
) {
  await this.assertStudioOwner(input.studioId, userId);
  const [recurrence] = await this.db
    .insert(studioRecurrences)
    .values({ ...input, createdBy: userId })
    .returning();
  return recurrence!;
}

/** 반복 규칙 수정 */
async updateRecurrence(
  recurrenceId: string,
  input: {
    title?: string;
    rule?: string;
    templateContentId?: string | null;
    label?: string | null;
    nextRunAt?: Date | null;
  },
  userId: string
) {
  const recurrence = await this.db.select().from(studioRecurrences).where(eq(studioRecurrences.id, recurrenceId)).then((r) => r[0]);
  if (!recurrence) throw new NotFoundException("반복 규칙을 찾을 수 없습니다");
  await this.assertStudioOwner(recurrence.studioId, userId);

  const [updated] = await this.db
    .update(studioRecurrences)
    .set(input)
    .where(eq(studioRecurrences.id, recurrenceId))
    .returning();
  return updated!;
}

/** 반복 규칙 삭제 */
async deleteRecurrence(recurrenceId: string, userId: string) {
  const recurrence = await this.db.select().from(studioRecurrences).where(eq(studioRecurrences.id, recurrenceId)).then((r) => r[0]);
  if (!recurrence) throw new NotFoundException("반복 규칙을 찾을 수 없습니다");
  await this.assertStudioOwner(recurrence.studioId, userId);

  await this.db.delete(studioRecurrences).where(eq(studioRecurrences.id, recurrenceId));
  return { success: true };
}

/** 반복 활성/비활성 토글 */
async toggleRecurrence(recurrenceId: string, userId: string) {
  const recurrence = await this.db.select().from(studioRecurrences).where(eq(studioRecurrences.id, recurrenceId)).then((r) => r[0]);
  if (!recurrence) throw new NotFoundException("반복 규칙을 찾을 수 없습니다");
  await this.assertStudioOwner(recurrence.studioId, userId);

  const [updated] = await this.db
    .update(studioRecurrences)
    .set({ isActive: !recurrence.isActive })
    .where(eq(studioRecurrences.id, recurrenceId))
    .returning();
  return updated!;
}

/** 반복 규칙 수동 실행 — 콘텐츠 복제 */
async executeRecurrence(recurrenceId: string, userId: string) {
  const recurrence = await this.db.select().from(studioRecurrences).where(eq(studioRecurrences.id, recurrenceId)).then((r) => r[0]);
  if (!recurrence) throw new NotFoundException("반복 규칙을 찾을 수 없습니다");
  await this.assertStudioOwner(recurrence.studioId, userId);

  // 템플릿 콘텐츠 복제 또는 빈 draft 생성
  let title = recurrence.title;
  let content: string | undefined;
  let summary: string | undefined;

  if (recurrence.templateContentId) {
    const template = await this.db
      .select()
      .from(studioContents)
      .where(eq(studioContents.id, recurrence.templateContentId))
      .then((r) => r[0]);
    if (template) {
      title = template.title;
      content = template.content ?? undefined;
      summary = template.summary ?? undefined;
    }
  }

  const [newContent] = await this.db
    .insert(studioContents)
    .values({
      studioId: recurrence.studioId,
      title,
      content,
      summary,
      label: recurrence.label,
      scheduledAt: recurrence.nextRunAt,
      authorId: userId,
      status: "draft",
    })
    .returning();

  // nextRunAt 갱신
  const nextRun = this.calculateNextRun(recurrence.rule, recurrence.nextRunAt ?? new Date());
  await this.db
    .update(studioRecurrences)
    .set({ lastRunAt: new Date(), nextRunAt: nextRun })
    .where(eq(studioRecurrences.id, recurrenceId));

  return newContent!;
}

/** 반복 규칙으로부터 다음 실행일 계산 */
private calculateNextRun(rule: string, fromDate: Date): Date {
  const [type, value] = rule.split(":");
  const next = new Date(fromDate);

  switch (type) {
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "biweekly":
      next.setDate(next.getDate() + 14);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      const dayNum = parseInt(value, 10);
      if (dayNum) next.setDate(dayNum);
      break;
    default:
      next.setDate(next.getDate() + 7);
  }

  return next;
}
```

**Step 4: updateContent에 scheduledAt/label 지원 추가**

기존 `updateContent` 메서드의 input 타입에 추가:

```typescript
async updateContent(
  contentId: string,
  input: {
    title?: string;
    content?: string;
    summary?: string;
    thumbnailUrl?: string | null;
    status?: "draft" | "writing" | "review" | "published" | "canceled";
    topicId?: string | null;
    positionX?: number;
    positionY?: number;
    scheduledAt?: Date | null;  // 추가
    label?: string | null;      // 추가
  },
  userId: string
)
```

**Step 5: 빌드 확인**

Run: `cd apps/server && pnpm tsc --noEmit`
Expected: 성공

**Step 6: 커밋**

```bash
git add packages/features/content-studio/service/content-studio.service.ts
git commit -m "feat(content-studio): 캘린더 조회, 예약, 반복 규칙 서비스 메서드 추가"
```

---

## Task 3: Server — tRPC 라우터에 캘린더/반복 프로시저 추가

기존 `contentStudioRouter`에 캘린더 및 반복 규칙 프로시저를 추가한다.

**Files:**
- Modify: `packages/features/content-studio/trpc/content-studio.route.ts`

**Step 1: Zod 스키마 추가**

기존 Zod Schemas 섹션 하단(`addSeoSchema` 뒤)에 추가:

```typescript
// Calendar
const calendarListSchema = z.object({
  studioId: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
});

const scheduleContentSchema = z.object({
  contentId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
});

// Recurrence
const createRecurrenceSchema = z.object({
  studioId: z.string().uuid(),
  title: z.string().min(1).max(200),
  rule: z.string().min(1).max(50),
  templateContentId: z.string().uuid().optional(),
  label: z.string().max(50).optional(),
  nextRunAt: z.string().datetime().optional(),
});

const updateRecurrenceSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  rule: z.string().min(1).max(50).optional(),
  templateContentId: z.string().uuid().nullable().optional(),
  label: z.string().max(50).nullable().optional(),
  nextRunAt: z.string().datetime().nullable().optional(),
});
```

**Step 2: 캘린더 프로시저 추가**

`contentStudioRouter`의 `router({})` 객체 내에 Admin 섹션 앞에 추가:

```typescript
// Calendar
calendarList: authProcedure
  .input(calendarListSchema)
  .query(async ({ input, ctx }) => {
    return services.service().getCalendarContents(input.studioId, input.year, input.month, ctx.user!.id);
  }),

scheduleContent: authProcedure
  .input(scheduleContentSchema)
  .mutation(async ({ input, ctx }) => {
    return services.service().scheduleContent(input.contentId, new Date(input.scheduledAt), ctx.user!.id);
  }),

unscheduleContent: authProcedure
  .input(z.object({ contentId: z.string().uuid() }))
  .mutation(async ({ input, ctx }) => {
    return services.service().unscheduleContent(input.contentId, ctx.user!.id);
  }),

// Recurrence
recurrenceList: authProcedure
  .input(z.object({ studioId: z.string().uuid() }))
  .query(async ({ input, ctx }) => {
    return services.service().findRecurrences(input.studioId, ctx.user!.id);
  }),

createRecurrence: authProcedure
  .input(createRecurrenceSchema)
  .mutation(async ({ input, ctx }) => {
    const data = {
      ...input,
      nextRunAt: input.nextRunAt ? new Date(input.nextRunAt) : undefined,
    };
    return services.service().createRecurrence(data, ctx.user!.id);
  }),

updateRecurrence: authProcedure
  .input(z.object({ id: z.string().uuid(), data: updateRecurrenceSchema }))
  .mutation(async ({ input, ctx }) => {
    const data = {
      ...input.data,
      nextRunAt: input.data.nextRunAt === null ? null : input.data.nextRunAt ? new Date(input.data.nextRunAt) : undefined,
    };
    return services.service().updateRecurrence(input.id, data, ctx.user!.id);
  }),

deleteRecurrence: authProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ input, ctx }) => {
    return services.service().deleteRecurrence(input.id, ctx.user!.id);
  }),

toggleRecurrence: authProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ input, ctx }) => {
    return services.service().toggleRecurrence(input.id, ctx.user!.id);
  }),

executeRecurrence: authProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ input, ctx }) => {
    return services.service().executeRecurrence(input.id, ctx.user!.id);
  }),
```

**Step 3: updateContentSchema에 scheduledAt/label 추가**

기존 `updateContentSchema`에 추가:

```typescript
const updateContentSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  content: z.string().optional(),
  summary: z.string().optional(),
  thumbnailUrl: z.string().optional().nullable(),
  status: z.enum(["draft", "writing", "review", "published", "canceled"]).optional(),
  topicId: z.string().uuid().nullable().optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),  // 추가
  label: z.string().max(50).nullable().optional(),            // 추가
});
```

`updateContent` 프로시저에서 `scheduledAt`을 Date로 변환:

```typescript
updateContent: authProcedure
  .input(z.object({ id: z.string().uuid(), data: updateContentSchema }))
  .mutation(async ({ input, ctx }) => {
    const data = {
      ...input.data,
      scheduledAt: input.data.scheduledAt === null ? null : input.data.scheduledAt ? new Date(input.data.scheduledAt) : undefined,
    };
    return services.service().updateContent(input.id, data, ctx.user!.id);
  }),
```

**Step 4: 빌드 확인**

Run: `cd apps/server && pnpm tsc --noEmit`
Expected: 성공

**Step 5: 커밋**

```bash
git add packages/features/content-studio/trpc/content-studio.route.ts
git commit -m "feat(content-studio): 캘린더/반복 tRPC 프로시저 추가"
```

---

## Task 4: Client — 캘린더 hooks 추가

캘린더 데이터 조회 및 mutation hooks를 추가한다.

**Files:**
- Create: `apps/app/src/features/content-studio/hooks/use-calendar.ts`
- Create: `apps/app/src/features/content-studio/hooks/use-recurrence.ts`
- Modify: `apps/app/src/features/content-studio/hooks/index.ts`

**Step 1: use-calendar.ts 생성**

```typescript
// apps/app/src/features/content-studio/hooks/use-calendar.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";

export function useCalendarContents(studioId: string, year: number, month: number) {
  const trpc = useTRPC();

  const { data, isLoading } = useQuery(
    trpc.contentStudio.calendarList.queryOptions(
      { studioId, year, month },
      { enabled: !!studioId },
    )
  );

  return { data: data ?? [], isLoading };
}

export function useCalendarMutations(studioId: string, year: number, month: number) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const calendarKey = trpc.contentStudio.calendarList.queryKey({ studioId, year, month });

  const invalidateCalendar = () => queryClient.invalidateQueries({ queryKey: calendarKey });

  const schedule = useMutation(
    trpc.contentStudio.scheduleContent.mutationOptions({ onSuccess: invalidateCalendar })
  );

  const unschedule = useMutation(
    trpc.contentStudio.unscheduleContent.mutationOptions({ onSuccess: invalidateCalendar })
  );

  return { schedule, unschedule };
}
```

**Step 2: use-recurrence.ts 생성**

```typescript
// apps/app/src/features/content-studio/hooks/use-recurrence.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";

export function useRecurrences(studioId: string) {
  const trpc = useTRPC();

  const { data, isLoading } = useQuery(
    trpc.contentStudio.recurrenceList.queryOptions(
      { studioId },
      { enabled: !!studioId },
    )
  );

  return { data: data ?? [], isLoading };
}

export function useRecurrenceMutations(studioId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const recurrenceKey = trpc.contentStudio.recurrenceList.queryKey({ studioId });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: recurrenceKey });

  const create = useMutation(
    trpc.contentStudio.createRecurrence.mutationOptions({ onSuccess: invalidate })
  );

  const update = useMutation(
    trpc.contentStudio.updateRecurrence.mutationOptions({ onSuccess: invalidate })
  );

  const remove = useMutation(
    trpc.contentStudio.deleteRecurrence.mutationOptions({ onSuccess: invalidate })
  );

  const toggle = useMutation(
    trpc.contentStudio.toggleRecurrence.mutationOptions({ onSuccess: invalidate })
  );

  const execute = useMutation(
    trpc.contentStudio.executeRecurrence.mutationOptions({ onSuccess: invalidate })
  );

  return { create, update, remove, toggle, execute };
}
```

**Step 3: hooks/index.ts 업데이트**

기존 `apps/app/src/features/content-studio/hooks/index.ts` 파일 읽고, 기존 export에 추가:

```typescript
export * from "./use-calendar";
export * from "./use-recurrence";
```

**Step 4: 빌드 확인**

Run: `cd apps/app && pnpm tsc --noEmit`
Expected: 성공

**Step 5: 커밋**

```bash
git add apps/app/src/features/content-studio/hooks/
git commit -m "feat(content-studio): 캘린더/반복 규칙 클라이언트 hooks 추가"
```

---

## Task 5: Client — 캘린더 페이지 UI 구현

월간 캘린더 뷰 페이지를 구현한다.

**Files:**
- Create: `apps/app/src/features/content-studio/pages/calendar-page.tsx`

**Step 1: CalendarPage 컴포넌트 생성**

`apps/app/src/features/content-studio/pages/calendar-page.tsx` 파일을 생성한다.

기존 마케팅 PublishCalendar(`apps/app/src/features/marketing/pages/publish-calendar.tsx`)를 참고하되, content-studio용으로 구현한다.

주요 구조:
- `<Feature>`, `<FeatureHeader>`, `<FeatureContents>` 레이아웃 사용
- FeatureHeader: title="콘텐츠 캘린더", actions에 스튜디오 선택 셀렉트 + "반복 관리" 버튼
- 스튜디오 선택: `useStudios()` hook으로 스튜디오 목록 조회, Select 컴포넌트로 선택
- 월간 그리드: 7열 그리드, 요일 헤더, 각 날짜 셀
- 각 셀: `scheduledAt` 기준으로 해당 날짜의 콘텐츠 표시
- 상태별 색상: draft=`bg-muted`, writing=`bg-blue-100 dark:bg-blue-900/30`, review=`bg-yellow-100 dark:bg-yellow-900/30`, published=`bg-green-100 dark:bg-green-900/30`, canceled=`bg-red-100 dark:bg-red-900/30`
- 날짜 클릭 시 `selectedDate` state 설정 → DayDetailSheet 열기
- DayDetailSheet: Sheet 컴포넌트, 해당일 콘텐츠 목록 + "새 콘텐츠" 버튼

사용 컴포넌트 (from `@repo/ui/shadcn/*`):
- Feature, FeatureHeader, FeatureContents (`@repo/ui`)
- Button, Badge, Select, Sheet, SheetContent, SheetHeader, SheetTitle, Skeleton
- lucide-react: ChevronLeft, ChevronRight, Calendar, Plus, Repeat

Hook 사용:
- `useStudios()` — 스튜디오 목록
- `useCalendarContents(studioId, year, month)` — 월별 콘텐츠
- `useCalendarMutations(studioId, year, month)` — 예약/해제

참고 패턴: `apps/app/src/features/marketing/pages/publish-calendar.tsx`의 calendarDays useMemo 패턴을 재사용.

**Step 2: 빌드 확인**

Run: `cd apps/app && pnpm tsc --noEmit`
Expected: 성공

**Step 3: 커밋**

```bash
git add apps/app/src/features/content-studio/pages/calendar-page.tsx
git commit -m "feat(content-studio): 월간 캘린더 페이지 UI 구현"
```

---

## Task 6: Client — 반복 관리 UI 구현

캘린더 페이지에서 열리는 반복 관리 Dialog를 구현한다.

**Files:**
- Create: `apps/app/src/features/content-studio/components/recurrence-manager.tsx`

**Step 1: RecurrenceManager 컴포넌트 생성**

`apps/app/src/features/content-studio/components/recurrence-manager.tsx`

주요 구조:
- Dialog 기반 (열기/닫기는 props로 제어)
- 반복 규칙 목록: 이름, 주기 텍스트, 활성 Switch, 다음 실행일, 액션(편집/삭제/수동실행)
- 생성/수정 폼: 이름(Input), 주기(Select: 주간/격주/월간 + 요일/날짜 Select), 템플릿(Select), label(Input)
- Switch로 활성/비활성 토글

사용 컴포넌트:
- Dialog, DialogContent, DialogHeader, DialogTitle (`@repo/ui/shadcn/dialog`)
- Button, Input, Select, Switch, Separator
- lucide-react: Plus, Pencil, Trash2, Play, Repeat

Hook 사용:
- `useRecurrences(studioId)` — 목록
- `useRecurrenceMutations(studioId)` — CRUD

주기 표시 헬퍼 함수:
```typescript
function formatRule(rule: string): string {
  const [type, value] = rule.split(":");
  const dayNames: Record<string, string> = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일" };
  switch (type) {
    case "weekly": return `매주 ${dayNames[value] ?? value}요일`;
    case "biweekly": return `격주 ${dayNames[value] ?? value}요일`;
    case "monthly": return `매월 ${value}일`;
    default: return rule;
  }
}
```

**Step 2: 빌드 확인**

Run: `cd apps/app && pnpm tsc --noEmit`
Expected: 성공

**Step 3: 커밋**

```bash
git add apps/app/src/features/content-studio/components/recurrence-manager.tsx
git commit -m "feat(content-studio): 반복 관리 Dialog UI 구현"
```

---

## Task 7: Client — 라우트 추가 + 사이드바 그룹화

캘린더 페이지 라우트를 등록하고, 사이드바에 콘텐츠 스튜디오 그룹을 추가한다.

**Files:**
- Modify: `apps/app/src/features/content-studio/routes/index.tsx`
- Modify: `apps/app/src/features/content-studio/index.ts`
- Modify: `apps/app/src/layouts/blocks/app-shell-01.tsx`

**Step 1: 캘린더 라우트 추가**

`apps/app/src/features/content-studio/routes/index.tsx`에 추가:

```typescript
import { CalendarPage } from "../pages/calendar-page";

export const CONTENT_STUDIO_CALENDAR_PATH = "/content-studio/calendar";

export const createCalendarRoute = <T extends AnyRoute>(parentRoute: T) =>
  createRoute({
    getParentRoute: () => parentRoute,
    path: "/content-studio/calendar",
    component: CalendarPage,
  });
```

`createContentStudioRoutes` 함수의 반환 배열에 추가:

```typescript
export function createContentStudioRoutes<T extends AnyRoute>(parentRoute: T) {
  return [
    createStudioListRoute(parentRoute),
    createCalendarRoute(parentRoute),     // 추가 (캔버스 라우트 앞에 배치)
    createCanvasRoute(parentRoute),
    createEditorRoute(parentRoute),
  ];
}
```

**주의:** `createCalendarRoute`는 `createCanvasRoute` 앞에 배치해야 한다. `/content-studio/calendar`이 `/content-studio/$studioId`보다 먼저 매칭되어야 "calendar"가 studioId 파라미터로 잡히지 않는다.

**Step 2: index.ts에 export 추가**

`apps/app/src/features/content-studio/index.ts`에 추가:

```typescript
export {
  CONTENT_STUDIO_PATH,
  CONTENT_STUDIO_CALENDAR_PATH,
  createContentStudioRoutes,
} from "./routes/index";
```

**Step 3: 사이드바 그룹화**

`apps/app/src/layouts/blocks/app-shell-01.tsx`의 `SidebarContent` 내부를 수정한다.

기존 단일 `SidebarGroup`에서, 콘텐츠 스튜디오 메뉴 항목들을 별도 `SidebarGroup`으로 분리한다.

import 추가:
```typescript
import { SidebarGroupLabel } from "@repo/ui/shadcn/sidebar";
import { Palette, CalendarDays } from "lucide-react";
```

기존 SidebarContent 내부의 SidebarGroup 뒤에 새 SidebarGroup 추가:

```typescript
<SidebarContent>
  <SidebarGroup>
    <SidebarGroupContent>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton render={<Link to="/" />}>
            <LayoutDashboard />
            <span>Dashboard</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton render={<Link to="/graph" />}>
            <Network />
            <span>그래프 콘텐츠</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton render={<Link to="/board" />}>
            <MessageSquare />
            <span>게시판</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton render={<Link to="/communities" />}>
            <Users />
            <span>커뮤니티</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
  <SidebarGroup>
    <SidebarGroupLabel>콘텐츠 스튜디오</SidebarGroupLabel>
    <SidebarGroupContent>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton render={<Link to="/content-studio" />}>
            <Palette />
            <span>스튜디오</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton render={<Link to="/content-studio/calendar" />}>
            <CalendarDays />
            <span>캘린더</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
</SidebarContent>
```

**Step 4: 빌드 확인**

Run: `cd apps/app && pnpm tsc --noEmit`
Expected: 성공

**Step 5: 커밋**

```bash
git add apps/app/src/features/content-studio/ apps/app/src/layouts/blocks/app-shell-01.tsx
git commit -m "feat(content-studio): 캘린더 라우트 추가 + 사이드바 그룹화"
```

---

## Task 8: DB Migration 생성 + 전체 빌드 검증

스키마 변경에 대한 DB 마이그레이션을 생성하고, 전체 프로젝트 빌드를 검증한다.

**Files:**
- Generated: `packages/drizzle/drizzle/` (migration 파일 — drizzle-kit이 자동 생성)

**Step 1: 마이그레이션 생성**

Run: `cd packages/drizzle && pnpm drizzle-kit generate`

생성된 SQL 파일을 확인하여 다음이 포함되어 있는지 검증:
- `ALTER TABLE studio_contents ADD COLUMN scheduled_at ...`
- `ALTER TABLE studio_contents ADD COLUMN label ...`
- `CREATE TABLE studio_recurrences ...`
- 적절한 인덱스 생성

**Step 2: 전체 빌드 확인**

Run: `cd packages/drizzle && pnpm tsc --noEmit`
Run: `cd apps/server && pnpm tsc --noEmit`
Run: `cd apps/app && pnpm tsc --noEmit`

Expected: 모두 성공

**Step 3: git status 확인**

Run: `git status`

다른 feature의 파일이 수정되지 않았는지 확인. 수정된 파일은 다음만 있어야 한다:
- `packages/drizzle/src/schema/features/content-studio/index.ts`
- `packages/drizzle/drizzle/` (migration 파일)
- `packages/features/content-studio/service/content-studio.service.ts`
- `packages/features/content-studio/trpc/content-studio.route.ts`
- `apps/app/src/features/content-studio/` (hooks, pages, components, routes)
- `apps/app/src/layouts/blocks/app-shell-01.tsx`

**Step 4: 커밋**

```bash
git add packages/drizzle/drizzle/
git commit -m "chore: content-calendar 마이그레이션 생성"
```

---

## Task 9: 레퍼런스 문서 업데이트

변경사항을 `docs/reference/` 레퍼런스 문서에 반영한다.

**Files:**
- Modify: `docs/reference/database-schema.md` — `studio_recurrences` 테이블, `studio_contents` 신규 컬럼 추가
- Modify: `docs/reference/features-backend.md` — 캘린더/반복 서비스 메서드, tRPC 프로시저 추가
- Modify: `docs/reference/features-frontend.md` — 캘린더 페이지, hooks, 컴포넌트 추가

**Step 1: database-schema.md 업데이트**

content-studio 섹션에 다음 추가:
- `studio_contents` 테이블에 `scheduledAt`, `label` 컬럼 설명
- `studio_recurrences` 테이블 전체 정의

**Step 2: features-backend.md 업데이트**

content-studio 섹션에 다음 추가:
- Calendar 서비스 메서드: `getCalendarContents`, `scheduleContent`, `unscheduleContent`
- Recurrence 서비스 메서드: `findRecurrences`, `createRecurrence`, `updateRecurrence`, `deleteRecurrence`, `toggleRecurrence`, `executeRecurrence`
- tRPC 프로시저: `calendarList`, `scheduleContent`, `unscheduleContent`, `recurrenceList`, `createRecurrence`, `updateRecurrence`, `deleteRecurrence`, `toggleRecurrence`, `executeRecurrence`

**Step 3: features-frontend.md 업데이트**

content-studio 섹션에 다음 추가:
- 페이지: `calendar-page.tsx` (CalendarPage — 월간 캘린더 뷰)
- 컴포넌트: `recurrence-manager.tsx` (RecurrenceManager — 반복 관리 Dialog)
- Hooks: `use-calendar.ts`, `use-recurrence.ts`
- 라우트: `/content-studio/calendar`

**Step 4: 커밋**

```bash
git add docs/reference/
git commit -m "docs: 콘텐츠 캘린더 레퍼런스 문서 업데이트"
```
