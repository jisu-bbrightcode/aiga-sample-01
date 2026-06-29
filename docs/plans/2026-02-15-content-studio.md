# Content Studio Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** React Flow 캔버스 + Novel 에디터 + AI 에이전트를 통합한 콘텐츠 스튜디오 feature 구현

**Architecture:** 새 `content-studio` feature를 `packages/features/`(서버)와 `apps/app/src/features/`(클라이언트)에 분리 생성. DB 5테이블, tRPC 라우터, React Flow 캔버스 뷰, Novel 에디터 뷰, system-admin 관리 페이지로 구성.

**Tech Stack:** Drizzle ORM, NestJS, tRPC v11, React Flow (`@xyflow/react`), Novel (TipTap 기반), Jotai, TanStack Router/Query

**Design Doc:** `docs/plans/2026-02-15-content-studio-design.md`

---

## Task 1: DB 스키마 정의

**Files:**
- Create: `packages/drizzle/src/schema/features/content-studio/index.ts`

**Context:** Content Studio의 5개 테이블과 enum을 정의합니다. 기존 `packages/drizzle/src/schema/features/graph-content/index.ts`를 참고하되, 완전히 독립된 스키마입니다.

**Step 1: 스키마 파일 생성**

```typescript
// packages/drizzle/src/schema/features/content-studio/index.ts
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { baseColumns, baseColumnsWithSoftDelete, timestamps } from "../../../utils";
import { profiles } from "../../core/profiles";

// ============================================================================
// Enums
// ============================================================================

export const studioVisibilityEnum = pgEnum("studio_visibility", [
  "public",
  "private",
]);

export const studioContentStatusEnum = pgEnum("studio_content_status", [
  "draft",
  "writing",
  "review",
  "published",
  "canceled",
]);

export const studioNodeTypeEnum = pgEnum("studio_node_type", [
  "topic",
  "content",
]);

// ============================================================================
// Tables
// ============================================================================

/** 스튜디오 (프로젝트/워크스페이스) */
export const studioStudios = pgTable(
  "studio_studios",
  {
    ...baseColumnsWithSoftDelete(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    visibility: studioVisibilityEnum("visibility").notNull().default("private"),
  },
  (table) => [
    index("idx_studio_studios_owner").on(table.ownerId),
  ]
);

/** 주제 노드 */
export const studioTopics = pgTable(
  "studio_topics",
  {
    ...baseColumns(),
    studioId: uuid("studio_id")
      .notNull()
      .references(() => studioStudios.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 100 }).notNull(),
    color: varchar("color", { length: 20 }),
    positionX: real("position_x").notNull().default(0),
    positionY: real("position_y").notNull().default(0),
  },
  (table) => [
    index("idx_studio_topics_studio").on(table.studioId),
  ]
);

/** 콘텐츠 노드 */
export const studioContents = pgTable(
  "studio_contents",
  {
    ...baseColumnsWithSoftDelete(),
    studioId: uuid("studio_id")
      .notNull()
      .references(() => studioStudios.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id").references(() => studioTopics.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 300 }).notNull(),
    content: text("content"), // Novel/TipTap JSON
    summary: text("summary"),
    thumbnailUrl: text("thumbnail_url"),
    status: studioContentStatusEnum("status").notNull().default("draft"),
    positionX: real("position_x").notNull().default(0),
    positionY: real("position_y").notNull().default(0),
    viewCount: integer("view_count").notNull().default(0),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_studio_contents_studio").on(table.studioId),
    index("idx_studio_contents_topic").on(table.topicId),
    index("idx_studio_contents_author").on(table.authorId),
    index("idx_studio_contents_status").on(table.status),
  ]
);

/** SEO 이력 */
export const studioContentSeo = pgTable(
  "studio_content_seo",
  {
    ...baseColumns(),
    contentId: uuid("content_id")
      .notNull()
      .references(() => studioContents.id, { onDelete: "cascade" }),
    seoTitle: varchar("seo_title", { length: 200 }),
    seoDescription: varchar("seo_description", { length: 500 }),
    seoKeywords: text("seo_keywords").array(),
    ogImageUrl: text("og_image_url"),
    pageViews: integer("page_views").default(0),
    uniqueVisitors: integer("unique_visitors").default(0),
    avgTimeOnPage: real("avg_time_on_page"),
    bounceRate: real("bounce_rate"),
    snapshotAt: timestamp("snapshot_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_studio_content_seo_content").on(table.contentId),
  ]
);

/** 엣지 (캔버스 연결선) */
export const studioEdges = pgTable(
  "studio_edges",
  {
    ...baseColumns(),
    studioId: uuid("studio_id")
      .notNull()
      .references(() => studioStudios.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").notNull(),
    sourceType: studioNodeTypeEnum("source_type").notNull(),
    targetId: uuid("target_id").notNull(),
    targetType: studioNodeTypeEnum("target_type").notNull(),
  },
  (table) => [
    index("idx_studio_edges_studio").on(table.studioId),
    index("idx_studio_edges_source").on(table.sourceId),
    index("idx_studio_edges_target").on(table.targetId),
  ]
);

// ============================================================================
// Relations
// ============================================================================

export const studioStudiosRelations = relations(studioStudios, ({ one, many }) => ({
  owner: one(profiles, {
    fields: [studioStudios.ownerId],
    references: [profiles.id],
  }),
  topics: many(studioTopics),
  contents: many(studioContents),
  edges: many(studioEdges),
}));

export const studioTopicsRelations = relations(studioTopics, ({ one, many }) => ({
  studio: one(studioStudios, {
    fields: [studioTopics.studioId],
    references: [studioStudios.id],
  }),
  contents: many(studioContents),
}));

export const studioContentsRelations = relations(studioContents, ({ one, many }) => ({
  studio: one(studioStudios, {
    fields: [studioContents.studioId],
    references: [studioStudios.id],
  }),
  topic: one(studioTopics, {
    fields: [studioContents.topicId],
    references: [studioTopics.id],
  }),
  author: one(profiles, {
    fields: [studioContents.authorId],
    references: [profiles.id],
  }),
  seoHistory: many(studioContentSeo),
}));

export const studioContentSeoRelations = relations(studioContentSeo, ({ one }) => ({
  content: one(studioContents, {
    fields: [studioContentSeo.contentId],
    references: [studioContents.id],
  }),
}));

export const studioEdgesRelations = relations(studioEdges, ({ one }) => ({
  studio: one(studioStudios, {
    fields: [studioEdges.studioId],
    references: [studioStudios.id],
  }),
}));

// ============================================================================
// Type Exports
// ============================================================================

export type StudioStudio = typeof studioStudios.$inferSelect;
export type NewStudioStudio = typeof studioStudios.$inferInsert;

export type StudioTopic = typeof studioTopics.$inferSelect;
export type NewStudioTopic = typeof studioTopics.$inferInsert;

export type StudioContent = typeof studioContents.$inferSelect;
export type NewStudioContent = typeof studioContents.$inferInsert;

export type StudioContentSeo = typeof studioContentSeo.$inferSelect;
export type NewStudioContentSeo = typeof studioContentSeo.$inferInsert;

export type StudioEdge = typeof studioEdges.$inferSelect;
export type NewStudioEdge = typeof studioEdges.$inferInsert;
```

**Step 2: 빌드 확인**

Run: `cd packages/drizzle && pnpm tsc --noEmit`
Expected: PASS (스키마 파일 자체의 타입 에러 없음)

**Step 3: 커밋**

```bash
git add packages/drizzle/src/schema/features/content-studio/index.ts
git commit -m "feat(content-studio): DB 스키마 정의 (5 테이블 + relations)"
```

---

## Task 2: 스키마 레지스트리 등록

**Files:**
- Modify: `packages/drizzle/src/schema/index.ts`
- Modify: `packages/drizzle/src/schema-registry.ts`

**Context:** 새 스키마를 중앙 레지스트리에 등록해야 Drizzle가 `db.query.*`로 접근할 수 있습니다. `schema/index.ts`(re-export)와 `schema-registry.ts`(drizzle 인스턴스 aggregation) 두 곳 모두 등록 필수.

**Step 1: schema/index.ts에 re-export 추가**

`packages/drizzle/src/schema/index.ts` 파일 하단에 추가:

```typescript
export * from "./features/content-studio";
```

**Step 2: schema-registry.ts에 import + spread 추가**

`packages/drizzle/src/schema-registry.ts` 파일에서:

import 섹션에 추가:
```typescript
import * as contentStudio from "./schema/features/content-studio";
```

schema 객체 spread에 추가:
```typescript
...contentStudio,
```

**Step 3: 빌드 확인**

Run: `cd packages/drizzle && pnpm tsc --noEmit`
Expected: PASS

**Step 4: 커밋**

```bash
git add packages/drizzle/src/schema/index.ts packages/drizzle/src/schema-registry.ts
git commit -m "feat(content-studio): 스키마 레지스트리 등록"
```

---

## Task 3: Server Feature 폴더 구조 + Types

**Files:**
- Create: `packages/features/content-studio/index.ts`
- Create: `packages/features/content-studio/types/index.ts`

**Context:** 서버 feature 폴더를 생성하고 API 입출력 타입을 정의합니다.

**Step 1: types/index.ts 생성**

```typescript
// packages/features/content-studio/types/index.ts
import type {
  StudioStudio,
  StudioTopic,
  StudioContent,
  StudioContentSeo,
  StudioEdge,
} from "@repo/drizzle";

/** 스튜디오 + 소유자 정보 */
export type StudioWithOwner = StudioStudio & {
  ownerName: string | null;
  ownerAvatar: string | null;
  topicCount: number;
  contentCount: number;
};

/** 콘텐츠 + 작성자 정보 */
export type ContentWithAuthor = StudioContent & {
  authorName: string | null;
  authorAvatar: string | null;
  topicLabel: string | null;
};

/** 캔버스 전체 데이터 (스튜디오 + 모든 노드/엣지) */
export type CanvasData = {
  studio: StudioStudio;
  topics: StudioTopic[];
  contents: ContentWithAuthor[];
  edges: StudioEdge[];
};

/** SEO 이력 */
export type SeoHistoryEntry = StudioContentSeo;
```

**Step 2: index.ts 생성 (빈 뼈대, 나중에 채움)**

```typescript
// packages/features/content-studio/index.ts
export * from "./types";
```

**Step 3: 커밋**

```bash
git add packages/features/content-studio/
git commit -m "feat(content-studio): Server feature 폴더 구조 + types"
```

---

## Task 4: Service 구현 — Studio CRUD

**Files:**
- Create: `packages/features/content-studio/service/content-studio.service.ts`

**Context:** 스튜디오(프로젝트) 생성/조회/수정/삭제 + 주제/콘텐츠/엣지/SEO 전체 서비스. 기존 `packages/features/graph-content/service/graph.service.ts` 패턴을 따릅니다.

**Step 1: Service 생성**

```typescript
// packages/features/content-studio/service/content-studio.service.ts
import { Injectable, Inject, NotFoundException, ForbiddenException } from "@nestjs/common";
import { DRIZZLE } from "@repo/drizzle";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  eq,
  and,
  desc,
  count,
  type SQL,
  sql,
} from "drizzle-orm";
import {
  studioStudios,
  studioTopics,
  studioContents,
  studioContentSeo,
  studioEdges,
} from "@repo/drizzle";
import { profiles } from "@repo/drizzle";

@Injectable()
export class ContentStudioService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<Record<string, never>>
  ) {}

  // ========================================
  // Studio CRUD
  // ========================================

  /** 스튜디오 목록 조회 */
  async findStudios(userId?: string) {
    const conditions: SQL[] = [eq(studioStudios.isDeleted, false)];

    if (userId) {
      conditions.push(eq(studioStudios.ownerId, userId));
    }

    const result = await this.db
      .select({
        id: studioStudios.id,
        title: studioStudios.title,
        description: studioStudios.description,
        ownerId: studioStudios.ownerId,
        visibility: studioStudios.visibility,
        createdAt: studioStudios.createdAt,
        updatedAt: studioStudios.updatedAt,
        isDeleted: studioStudios.isDeleted,
        deletedAt: studioStudios.deletedAt,
        ownerName: profiles.name,
        ownerAvatar: profiles.avatar,
      })
      .from(studioStudios)
      .leftJoin(profiles, eq(studioStudios.ownerId, profiles.id))
      .where(and(...conditions))
      .orderBy(desc(studioStudios.updatedAt));

    return result;
  }

  /** 스튜디오 상세 + 모든 노드/엣지 (캔버스 데이터) */
  async getCanvasData(studioId: string, userId?: string) {
    const studio = await this.db
      .select()
      .from(studioStudios)
      .where(and(eq(studioStudios.id, studioId), eq(studioStudios.isDeleted, false)))
      .then((rows) => rows[0]);

    if (!studio) throw new NotFoundException("스튜디오를 찾을 수 없습니다");

    // 권한 체크: private 스튜디오는 소유자만 접근
    if (studio.visibility === "private" && studio.ownerId !== userId) {
      throw new ForbiddenException("접근 권한이 없습니다");
    }

    const [topics, contents, edges] = await Promise.all([
      this.db
        .select()
        .from(studioTopics)
        .where(eq(studioTopics.studioId, studioId))
        .orderBy(studioTopics.createdAt),
      this.db
        .select({
          id: studioContents.id,
          studioId: studioContents.studioId,
          topicId: studioContents.topicId,
          title: studioContents.title,
          content: studioContents.content,
          summary: studioContents.summary,
          thumbnailUrl: studioContents.thumbnailUrl,
          status: studioContents.status,
          positionX: studioContents.positionX,
          positionY: studioContents.positionY,
          viewCount: studioContents.viewCount,
          authorId: studioContents.authorId,
          publishedAt: studioContents.publishedAt,
          createdAt: studioContents.createdAt,
          updatedAt: studioContents.updatedAt,
          isDeleted: studioContents.isDeleted,
          deletedAt: studioContents.deletedAt,
          authorName: profiles.name,
          authorAvatar: profiles.avatar,
          topicLabel: studioTopics.label,
        })
        .from(studioContents)
        .leftJoin(profiles, eq(studioContents.authorId, profiles.id))
        .leftJoin(studioTopics, eq(studioContents.topicId, studioTopics.id))
        .where(
          and(
            eq(studioContents.studioId, studioId),
            eq(studioContents.isDeleted, false)
          )
        )
        .orderBy(studioContents.createdAt),
      this.db
        .select()
        .from(studioEdges)
        .where(eq(studioEdges.studioId, studioId)),
    ]);

    return { studio, topics, contents, edges };
  }

  /** 스튜디오 생성 */
  async createStudio(
    input: { title: string; description?: string; visibility?: "public" | "private" },
    ownerId: string
  ) {
    const [studio] = await this.db
      .insert(studioStudios)
      .values({ ...input, ownerId })
      .returning();
    return studio!;
  }

  /** 스튜디오 수정 */
  async updateStudio(
    studioId: string,
    input: { title?: string; description?: string; visibility?: "public" | "private" },
    userId: string
  ) {
    await this.assertStudioOwner(studioId, userId);
    const [updated] = await this.db
      .update(studioStudios)
      .set(input)
      .where(eq(studioStudios.id, studioId))
      .returning();
    return updated!;
  }

  /** 스튜디오 삭제 (soft delete) */
  async deleteStudio(studioId: string, userId: string) {
    await this.assertStudioOwner(studioId, userId);
    await this.db
      .update(studioStudios)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(eq(studioStudios.id, studioId));
    return { success: true };
  }

  // ========================================
  // Topic CRUD
  // ========================================

  async createTopic(
    input: { studioId: string; label: string; color?: string; positionX?: number; positionY?: number },
    userId: string
  ) {
    await this.assertStudioOwner(input.studioId, userId);
    const [topic] = await this.db
      .insert(studioTopics)
      .values(input)
      .returning();
    return topic!;
  }

  async updateTopic(
    topicId: string,
    input: { label?: string; color?: string; positionX?: number; positionY?: number },
    userId: string
  ) {
    const topic = await this.db.select().from(studioTopics).where(eq(studioTopics.id, topicId)).then((r) => r[0]);
    if (!topic) throw new NotFoundException("주제를 찾을 수 없습니다");
    await this.assertStudioOwner(topic.studioId, userId);

    const [updated] = await this.db
      .update(studioTopics)
      .set(input)
      .where(eq(studioTopics.id, topicId))
      .returning();
    return updated!;
  }

  async deleteTopic(topicId: string, userId: string) {
    const topic = await this.db.select().from(studioTopics).where(eq(studioTopics.id, topicId)).then((r) => r[0]);
    if (!topic) throw new NotFoundException("주제를 찾을 수 없습니다");
    await this.assertStudioOwner(topic.studioId, userId);

    // 연결된 콘텐츠의 topicId를 null로 변경
    await this.db
      .update(studioContents)
      .set({ topicId: null })
      .where(eq(studioContents.topicId, topicId));

    // 관련 엣지 삭제
    await this.db
      .delete(studioEdges)
      .where(
        and(
          eq(studioEdges.studioId, topic.studioId),
          sql`(${studioEdges.sourceId} = ${topicId} OR ${studioEdges.targetId} = ${topicId})`
        )
      );

    await this.db.delete(studioTopics).where(eq(studioTopics.id, topicId));
    return { success: true };
  }

  // ========================================
  // Content CRUD
  // ========================================

  async createContent(
    input: {
      studioId: string;
      topicId?: string;
      title: string;
      content?: string;
      positionX?: number;
      positionY?: number;
    },
    authorId: string
  ) {
    await this.assertStudioOwner(input.studioId, authorId);
    const [content] = await this.db
      .insert(studioContents)
      .values({ ...input, authorId })
      .returning();
    return content!;
  }

  async getContent(contentId: string) {
    const result = await this.db
      .select({
        id: studioContents.id,
        studioId: studioContents.studioId,
        topicId: studioContents.topicId,
        title: studioContents.title,
        content: studioContents.content,
        summary: studioContents.summary,
        thumbnailUrl: studioContents.thumbnailUrl,
        status: studioContents.status,
        positionX: studioContents.positionX,
        positionY: studioContents.positionY,
        viewCount: studioContents.viewCount,
        authorId: studioContents.authorId,
        publishedAt: studioContents.publishedAt,
        createdAt: studioContents.createdAt,
        updatedAt: studioContents.updatedAt,
        isDeleted: studioContents.isDeleted,
        deletedAt: studioContents.deletedAt,
        authorName: profiles.name,
        authorAvatar: profiles.avatar,
        topicLabel: studioTopics.label,
      })
      .from(studioContents)
      .leftJoin(profiles, eq(studioContents.authorId, profiles.id))
      .leftJoin(studioTopics, eq(studioContents.topicId, studioTopics.id))
      .where(and(eq(studioContents.id, contentId), eq(studioContents.isDeleted, false)))
      .then((r) => r[0]);

    if (!result) throw new NotFoundException("콘텐츠를 찾을 수 없습니다");
    return result;
  }

  async updateContent(
    contentId: string,
    input: {
      title?: string;
      content?: string;
      summary?: string;
      thumbnailUrl?: string;
      status?: "draft" | "writing" | "review" | "published" | "canceled";
      topicId?: string | null;
      positionX?: number;
      positionY?: number;
    },
    userId: string
  ) {
    const content = await this.db.select().from(studioContents).where(eq(studioContents.id, contentId)).then((r) => r[0]);
    if (!content) throw new NotFoundException("콘텐츠를 찾을 수 없습니다");
    await this.assertStudioOwner(content.studioId, userId);

    const updateData: Record<string, unknown> = { ...input };
    if (input.status === "published" && content.status !== "published") {
      updateData.publishedAt = new Date();
    }

    const [updated] = await this.db
      .update(studioContents)
      .set(updateData)
      .where(eq(studioContents.id, contentId))
      .returning();
    return updated!;
  }

  async deleteContent(contentId: string, userId: string) {
    const content = await this.db.select().from(studioContents).where(eq(studioContents.id, contentId)).then((r) => r[0]);
    if (!content) throw new NotFoundException("콘텐츠를 찾을 수 없습니다");
    await this.assertStudioOwner(content.studioId, userId);

    // 관련 엣지 삭제
    await this.db
      .delete(studioEdges)
      .where(
        and(
          eq(studioEdges.studioId, content.studioId),
          sql`(${studioEdges.sourceId} = ${contentId} OR ${studioEdges.targetId} = ${contentId})`
        )
      );

    await this.db
      .update(studioContents)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(eq(studioContents.id, contentId));
    return { success: true };
  }

  /** 노드 위치 일괄 업데이트 (캔버스 드래그) */
  async updateNodePositions(
    updates: Array<{ id: string; type: "topic" | "content"; positionX: number; positionY: number }>,
    userId: string
  ) {
    for (const u of updates) {
      if (u.type === "topic") {
        await this.db.update(studioTopics).set({ positionX: u.positionX, positionY: u.positionY }).where(eq(studioTopics.id, u.id));
      } else {
        await this.db.update(studioContents).set({ positionX: u.positionX, positionY: u.positionY }).where(eq(studioContents.id, u.id));
      }
    }
    return { success: true };
  }

  // ========================================
  // Edge CRUD
  // ========================================

  async createEdge(
    input: {
      studioId: string;
      sourceId: string;
      sourceType: "topic" | "content";
      targetId: string;
      targetType: "topic" | "content";
    },
    userId: string
  ) {
    await this.assertStudioOwner(input.studioId, userId);
    const [edge] = await this.db.insert(studioEdges).values(input).returning();
    return edge!;
  }

  async deleteEdge(edgeId: string, userId: string) {
    const edge = await this.db.select().from(studioEdges).where(eq(studioEdges.id, edgeId)).then((r) => r[0]);
    if (!edge) throw new NotFoundException("엣지를 찾을 수 없습니다");
    await this.assertStudioOwner(edge.studioId, userId);
    await this.db.delete(studioEdges).where(eq(studioEdges.id, edgeId));
    return { success: true };
  }

  // ========================================
  // SEO History
  // ========================================

  async getSeoHistory(contentId: string) {
    return this.db
      .select()
      .from(studioContentSeo)
      .where(eq(studioContentSeo.contentId, contentId))
      .orderBy(desc(studioContentSeo.createdAt));
  }

  async addSeoSnapshot(
    contentId: string,
    input: {
      seoTitle?: string;
      seoDescription?: string;
      seoKeywords?: string[];
      ogImageUrl?: string;
      pageViews?: number;
      uniqueVisitors?: number;
      avgTimeOnPage?: number;
      bounceRate?: number;
    },
    userId: string
  ) {
    const content = await this.db.select().from(studioContents).where(eq(studioContents.id, contentId)).then((r) => r[0]);
    if (!content) throw new NotFoundException("콘텐츠를 찾을 수 없습니다");
    await this.assertStudioOwner(content.studioId, userId);

    const [seo] = await this.db
      .insert(studioContentSeo)
      .values({ contentId, ...input })
      .returning();
    return seo!;
  }

  // ========================================
  // Admin
  // ========================================

  /** 전체 스튜디오 목록 (Admin용, soft delete 포함) */
  async adminFindAll() {
    return this.db
      .select({
        id: studioStudios.id,
        title: studioStudios.title,
        visibility: studioStudios.visibility,
        isDeleted: studioStudios.isDeleted,
        createdAt: studioStudios.createdAt,
        ownerName: profiles.name,
        contentCount: count(studioContents.id),
      })
      .from(studioStudios)
      .leftJoin(profiles, eq(studioStudios.ownerId, profiles.id))
      .leftJoin(studioContents, eq(studioStudios.id, studioContents.studioId))
      .groupBy(studioStudios.id, profiles.name)
      .orderBy(desc(studioStudios.createdAt));
  }

  // ========================================
  // Helpers
  // ========================================

  private async assertStudioOwner(studioId: string, userId: string) {
    const studio = await this.db
      .select({ ownerId: studioStudios.ownerId })
      .from(studioStudios)
      .where(and(eq(studioStudios.id, studioId), eq(studioStudios.isDeleted, false)))
      .then((r) => r[0]);

    if (!studio) throw new NotFoundException("스튜디오를 찾을 수 없습니다");
    if (studio.ownerId !== userId) throw new ForbiddenException("소유자만 수정할 수 있습니다");
  }
}
```

**Step 2: 빌드 확인**

Run: `cd packages/features && pnpm tsc --noEmit`
Expected: PASS

**Step 3: 커밋**

```bash
git add packages/features/content-studio/service/
git commit -m "feat(content-studio): Service 구현 (Studio/Topic/Content/Edge/SEO CRUD)"
```

---

## Task 5: tRPC Router 구현

**Files:**
- Create: `packages/features/content-studio/trpc/content-studio.route.ts`
- Create: `packages/features/content-studio/trpc/index.ts`

**Context:** `packages/features/graph-content/trpc/graph-content.route.ts` 패턴을 따릅니다. `createServiceContainer`로 NestJS Service를 주입받습니다.

**Step 1: tRPC Router 생성**

```typescript
// packages/features/content-studio/trpc/content-studio.route.ts
import { z } from "zod";
import {
  router,
  publicProcedure,
  authProcedure,
  adminProcedure,
  createSingleServiceContainer,
} from "@repo/core/trpc";
import type { ContentStudioService } from "../service/content-studio.service";

// ============================================================================
// Service Container
// ============================================================================

const services = createSingleServiceContainer<ContentStudioService>();
export const injectContentStudioService = services.inject;

// ============================================================================
// Zod Schemas
// ============================================================================

const createStudioSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  visibility: z.enum(["public", "private"]).optional(),
});

const updateStudioSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  visibility: z.enum(["public", "private"]).optional(),
});

const createTopicSchema = z.object({
  studioId: z.string().uuid(),
  label: z.string().min(1).max(100),
  color: z.string().max(20).optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
});

const updateTopicSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  color: z.string().max(20).optional().nullable(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
});

const createContentSchema = z.object({
  studioId: z.string().uuid(),
  topicId: z.string().uuid().optional(),
  title: z.string().min(1).max(300),
  content: z.string().optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
});

const updateContentSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  content: z.string().optional(),
  summary: z.string().optional(),
  thumbnailUrl: z.string().optional().nullable(),
  status: z.enum(["draft", "writing", "review", "published", "canceled"]).optional(),
  topicId: z.string().uuid().nullable().optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
});

const createEdgeSchema = z.object({
  studioId: z.string().uuid(),
  sourceId: z.string().uuid(),
  sourceType: z.enum(["topic", "content"]),
  targetId: z.string().uuid(),
  targetType: z.enum(["topic", "content"]),
});

const nodePositionSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["topic", "content"]),
  positionX: z.number(),
  positionY: z.number(),
});

const addSeoSchema = z.object({
  seoTitle: z.string().max(200).optional(),
  seoDescription: z.string().max(500).optional(),
  seoKeywords: z.array(z.string()).optional(),
  ogImageUrl: z.string().optional(),
  pageViews: z.number().optional(),
  uniqueVisitors: z.number().optional(),
  avgTimeOnPage: z.number().optional(),
  bounceRate: z.number().optional(),
});

// ============================================================================
// Router
// ============================================================================

export const contentStudioRouter = router({
  // Studio
  studios: authProcedure.query(async ({ ctx }) => {
    return services.get().findStudios(ctx.user!.id);
  }),

  canvas: authProcedure
    .input(z.object({ studioId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return services.get().getCanvasData(input.studioId, ctx.user!.id);
    }),

  createStudio: authProcedure
    .input(createStudioSchema)
    .mutation(async ({ input, ctx }) => {
      return services.get().createStudio(input, ctx.user!.id);
    }),

  updateStudio: authProcedure
    .input(z.object({ id: z.string().uuid(), data: updateStudioSchema }))
    .mutation(async ({ input, ctx }) => {
      return services.get().updateStudio(input.id, input.data, ctx.user!.id);
    }),

  deleteStudio: authProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      return services.get().deleteStudio(input.id, ctx.user!.id);
    }),

  // Topic
  createTopic: authProcedure
    .input(createTopicSchema)
    .mutation(async ({ input, ctx }) => {
      return services.get().createTopic(input, ctx.user!.id);
    }),

  updateTopic: authProcedure
    .input(z.object({ id: z.string().uuid(), data: updateTopicSchema }))
    .mutation(async ({ input, ctx }) => {
      return services.get().updateTopic(input.id, input.data, ctx.user!.id);
    }),

  deleteTopic: authProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      return services.get().deleteTopic(input.id, ctx.user!.id);
    }),

  // Content
  getContent: authProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      return services.get().getContent(input.id);
    }),

  createContent: authProcedure
    .input(createContentSchema)
    .mutation(async ({ input, ctx }) => {
      return services.get().createContent(input, ctx.user!.id);
    }),

  updateContent: authProcedure
    .input(z.object({ id: z.string().uuid(), data: updateContentSchema }))
    .mutation(async ({ input, ctx }) => {
      return services.get().updateContent(input.id, input.data, ctx.user!.id);
    }),

  deleteContent: authProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      return services.get().deleteContent(input.id, ctx.user!.id);
    }),

  updateNodePositions: authProcedure
    .input(z.object({ updates: z.array(nodePositionSchema) }))
    .mutation(async ({ input, ctx }) => {
      return services.get().updateNodePositions(input.updates, ctx.user!.id);
    }),

  // Edge
  createEdge: authProcedure
    .input(createEdgeSchema)
    .mutation(async ({ input, ctx }) => {
      return services.get().createEdge(input, ctx.user!.id);
    }),

  deleteEdge: authProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      return services.get().deleteEdge(input.id, ctx.user!.id);
    }),

  // SEO
  seoHistory: authProcedure
    .input(z.object({ contentId: z.string().uuid() }))
    .query(async ({ input }) => {
      return services.get().getSeoHistory(input.contentId);
    }),

  addSeoSnapshot: authProcedure
    .input(z.object({ contentId: z.string().uuid(), data: addSeoSchema }))
    .mutation(async ({ input, ctx }) => {
      return services.get().addSeoSnapshot(input.contentId, input.data, ctx.user!.id);
    }),

  // Admin
  adminList: adminProcedure.query(async () => {
    return services.get().adminFindAll();
  }),
});

export type ContentStudioRouter = typeof contentStudioRouter;
```

**Step 2: trpc/index.ts 생성**

```typescript
// packages/features/content-studio/trpc/index.ts
export { contentStudioRouter, injectContentStudioService } from "./content-studio.route";
export type { ContentStudioRouter } from "./content-studio.route";
```

**Step 3: 커밋**

```bash
git add packages/features/content-studio/trpc/
git commit -m "feat(content-studio): tRPC Router 구현 (18 procedures)"
```

---

## Task 6: NestJS Module + Server 등록

**Files:**
- Create: `packages/features/content-studio/content-studio.module.ts`
- Modify: `packages/features/content-studio/index.ts`
- Modify: `packages/features/package.json` (exports 추가)
- Modify: `packages/features/app-router.ts` (타입 등록)
- Modify: `apps/server/src/trpc/router.ts` (런타임 등록)
- Modify: `apps/server/src/app.module.ts` (NestJS 모듈 등록)

**Context:** TS2742 방지 패턴에 따라 `app-router.ts`(타입)와 `router.ts`(런타임) 두 곳 모두 등록합니다.

**Step 1: Module 생성**

```typescript
// packages/features/content-studio/content-studio.module.ts
import { Module, type OnModuleInit } from "@nestjs/common";
import { ContentStudioService } from "./service/content-studio.service";
import { injectContentStudioService } from "./trpc";

@Module({
  providers: [ContentStudioService],
  exports: [ContentStudioService],
})
export class ContentStudioModule implements OnModuleInit {
  constructor(private readonly service: ContentStudioService) {}

  onModuleInit() {
    injectContentStudioService(this.service);
  }
}
```

**Step 2: index.ts 업데이트**

```typescript
// packages/features/content-studio/index.ts
export { ContentStudioModule } from "./content-studio.module";
export { contentStudioRouter, type ContentStudioRouter } from "./trpc";
export { ContentStudioService } from "./service/content-studio.service";
export * from "./types";
```

**Step 3: package.json exports 추가**

`packages/features/package.json`의 `"exports"` 객체에 추가:

```json
"./content-studio": "./content-studio/index.ts"
```

**Step 4: app-router.ts 등록 (타입)**

`packages/features/app-router.ts` 파일에서:

import 추가:
```typescript
import { contentStudioRouter } from "./content-studio";
```

`_appRouter`의 `router({})` 객체에 추가:
```typescript
contentStudio: contentStudioRouter,
```

**Step 5: router.ts 등록 (런타임)**

`apps/server/src/trpc/router.ts` 파일에서:

import 추가:
```typescript
import { contentStudioRouter } from "@repo/features/content-studio";
```

`trpcRouter`의 `router({})` 객체에 추가:
```typescript
contentStudio: contentStudioRouter,
```

**Step 6: app.module.ts 등록**

`apps/server/src/app.module.ts` 파일에서:

import 추가 (ATLAS:IMPORTS 블록 내):
```typescript
import { ContentStudioModule } from "@repo/features/content-studio";
```

`@Module.imports` 배열 (ATLAS:MODULES 블록 내)에 추가:
```typescript
ContentStudioModule,
```

**Step 7: 빌드 확인**

Run: `cd apps/server && pnpm tsc --noEmit`
Expected: PASS

**Step 8: 커밋**

```bash
git add packages/features/content-studio/ packages/features/package.json packages/features/app-router.ts apps/server/src/trpc/router.ts apps/server/src/app.module.ts
git commit -m "feat(content-studio): NestJS Module + Server 등록 (app-router, router, app.module)"
```

---

## Task 7: 프론트엔드 Feature 구조 + Hooks

**Files:**
- Create: `apps/app/src/features/content-studio/index.ts`
- Create: `apps/app/src/features/content-studio/hooks/index.ts`
- Create: `apps/app/src/features/content-studio/hooks/use-studios.ts`
- Create: `apps/app/src/features/content-studio/hooks/use-canvas.ts`
- Create: `apps/app/src/features/content-studio/hooks/use-content-mutations.ts`

**Context:** tRPC hooks를 커스텀 훅으로 래핑합니다. `apps/app/src/lib/trpc.ts`의 `useTRPC()`를 사용합니다.

**Step 1: hooks/use-studios.ts**

```typescript
// apps/app/src/features/content-studio/hooks/use-studios.ts
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";

export function useStudios() {
  const trpc = useTRPC();
  return useQuery(trpc.contentStudio.studios.queryOptions());
}
```

**Step 2: hooks/use-canvas.ts**

```typescript
// apps/app/src/features/content-studio/hooks/use-canvas.ts
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";

export function useCanvasData(studioId: string) {
  const trpc = useTRPC();
  return useQuery(
    trpc.contentStudio.canvas.queryOptions(
      { studioId },
      { enabled: !!studioId }
    )
  );
}

export function useContent(contentId: string) {
  const trpc = useTRPC();
  return useQuery(
    trpc.contentStudio.getContent.queryOptions(
      { id: contentId },
      { enabled: !!contentId }
    )
  );
}

export function useSeoHistory(contentId: string) {
  const trpc = useTRPC();
  return useQuery(
    trpc.contentStudio.seoHistory.queryOptions(
      { contentId },
      { enabled: !!contentId }
    )
  );
}
```

**Step 3: hooks/use-content-mutations.ts**

```typescript
// apps/app/src/features/content-studio/hooks/use-content-mutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";

export function useStudioMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const createStudio = useMutation(
    trpc.contentStudio.createStudio.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.contentStudio.studios.queryKey() });
      },
    })
  );

  const updateStudio = useMutation(
    trpc.contentStudio.updateStudio.mutationOptions()
  );

  const deleteStudio = useMutation(
    trpc.contentStudio.deleteStudio.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.contentStudio.studios.queryKey() });
      },
    })
  );

  return { createStudio, updateStudio, deleteStudio };
}

export function useCanvasMutations(studioId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const canvasKey = trpc.contentStudio.canvas.queryKey({ studioId });

  const invalidateCanvas = () => queryClient.invalidateQueries({ queryKey: canvasKey });

  const createTopic = useMutation(
    trpc.contentStudio.createTopic.mutationOptions({ onSuccess: invalidateCanvas })
  );

  const updateTopic = useMutation(
    trpc.contentStudio.updateTopic.mutationOptions({ onSuccess: invalidateCanvas })
  );

  const deleteTopic = useMutation(
    trpc.contentStudio.deleteTopic.mutationOptions({ onSuccess: invalidateCanvas })
  );

  const createContent = useMutation(
    trpc.contentStudio.createContent.mutationOptions({ onSuccess: invalidateCanvas })
  );

  const updateContent = useMutation(
    trpc.contentStudio.updateContent.mutationOptions()
  );

  const deleteContent = useMutation(
    trpc.contentStudio.deleteContent.mutationOptions({ onSuccess: invalidateCanvas })
  );

  const updateNodePositions = useMutation(
    trpc.contentStudio.updateNodePositions.mutationOptions()
  );

  const createEdge = useMutation(
    trpc.contentStudio.createEdge.mutationOptions({ onSuccess: invalidateCanvas })
  );

  const deleteEdge = useMutation(
    trpc.contentStudio.deleteEdge.mutationOptions({ onSuccess: invalidateCanvas })
  );

  const addSeoSnapshot = useMutation(
    trpc.contentStudio.addSeoSnapshot.mutationOptions()
  );

  return {
    createTopic, updateTopic, deleteTopic,
    createContent, updateContent, deleteContent,
    updateNodePositions,
    createEdge, deleteEdge,
    addSeoSnapshot,
  };
}
```

**Step 4: hooks/index.ts**

```typescript
// apps/app/src/features/content-studio/hooks/index.ts
export { useStudios } from "./use-studios";
export { useCanvasData, useContent, useSeoHistory } from "./use-canvas";
export { useStudioMutations, useCanvasMutations } from "./use-content-mutations";
```

**Step 5: index.ts**

```typescript
// apps/app/src/features/content-studio/index.ts
export * from "./hooks";
```

**Step 6: 커밋**

```bash
git add apps/app/src/features/content-studio/
git commit -m "feat(content-studio): 프론트엔드 hooks 구현"
```

---

## Task 8: 스튜디오 목록 페이지

**Files:**
- Create: `apps/app/src/features/content-studio/pages/studio-list-page.tsx`
- Create: `apps/app/src/features/content-studio/routes/index.ts`
- Modify: `apps/app/src/features/content-studio/index.ts`
- Modify: `apps/app/src/router.tsx`

**Context:** 스튜디오 목록(카드 그리드)과 라우트를 생성합니다. Feature/FeatureHeader/FeatureContents 패턴을 따릅니다.

**Step 1: 스튜디오 목록 페이지 생성**

```typescript
// apps/app/src/features/content-studio/pages/studio-list-page.tsx
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Feature, FeatureHeader, FeatureContents } from "@repo/ui";
import { Card, CardContent } from "@repo/ui/shadcn/card";
import { Button } from "@repo/ui/shadcn/button";
import { Skeleton } from "@repo/ui/shadcn/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/shadcn/dialog";
import { Input } from "@repo/ui/shadcn/input";
import { Textarea } from "@repo/ui/shadcn/textarea";
import { Plus, FolderOpen } from "lucide-react";
import { useStudios, useStudioMutations } from "../hooks";

interface Props {}

export function StudioListPage({}: Props) {
  const navigate = useNavigate();
  const { data: studios, isLoading } = useStudios();
  const { createStudio } = useStudioMutations();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = () => {
    if (!title.trim()) return;
    createStudio.mutate(
      { title: title.trim(), description: description.trim() || undefined },
      {
        onSuccess: (studio) => {
          setOpen(false);
          setTitle("");
          setDescription("");
          navigate({ to: "/content-studio/$studioId", params: { studioId: studio.id } });
        },
      }
    );
  };

  return (
    <Feature>
      <FeatureHeader
        title="콘텐츠 스튜디오"
        description="콘텐츠를 시각적으로 관리하세요"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button />}>
              <Plus className="size-4" />
              새 스튜디오
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>새 스튜디오 만들기</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <Input
                  placeholder="스튜디오 이름"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <Textarea
                  placeholder="설명 (선택)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
                <Button onClick={handleCreate} disabled={createStudio.isPending || !title.trim()}>
                  만들기
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />
      <FeatureContents>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-48" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : studios?.length === 0 ? (
          <EmptyState onCreateClick={() => setOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {studios?.map((studio) => (
              <StudioCard
                key={studio.id}
                studio={studio}
                onClick={() =>
                  navigate({ to: "/content-studio/$studioId", params: { studioId: studio.id } })
                }
              />
            ))}
          </div>
        )}
      </FeatureContents>
    </Feature>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Components
 * -----------------------------------------------------------------------------------------------*/

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <FolderOpen className="size-12 text-muted-foreground/50 mb-4" />
      <p className="text-lg font-medium">아직 스튜디오가 없습니다</p>
      <p className="text-sm text-muted-foreground mt-1">
        새 스튜디오를 만들어 콘텐츠를 관리해보세요
      </p>
      <Button className="mt-6" onClick={onCreateClick}>
        <Plus className="size-4" />
        첫 스튜디오 만들기
      </Button>
    </div>
  );
}

interface StudioCardProps {
  studio: {
    id: string;
    title: string;
    description: string | null;
    ownerName: string | null;
    visibility: string;
    createdAt: Date;
  };
  onClick: () => void;
}

function StudioCard({ studio, onClick }: StudioCardProps) {
  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-muted/30"
      onClick={onClick}
    >
      <CardContent className="p-6">
        <h3 className="text-lg font-medium">{studio.title}</h3>
        {studio.description && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {studio.description}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <span>{studio.ownerName}</span>
          <span className="text-muted-foreground/50">·</span>
          <span>
            {new Date(studio.createdAt).toLocaleDateString("ko-KR")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: routes/index.ts 생성**

```typescript
// apps/app/src/features/content-studio/routes/index.ts
import { createRoute, type AnyRoute } from "@tanstack/react-router";
import { StudioListPage } from "../pages/studio-list-page";

export const CONTENT_STUDIO_PATH = "/content-studio";

export const createStudioListRoute = <T extends AnyRoute>(parentRoute: T) =>
  createRoute({
    getParentRoute: () => parentRoute,
    path: "/content-studio",
    component: StudioListPage,
  });

// 캔버스, 에디터 라우트는 이후 Task에서 추가

export function createContentStudioRoutes<T extends AnyRoute>(parentRoute: T) {
  return [
    createStudioListRoute(parentRoute),
  ];
}
```

**Step 3: index.ts 업데이트**

```typescript
// apps/app/src/features/content-studio/index.ts
export {
  CONTENT_STUDIO_PATH,
  createContentStudioRoutes,
} from "./routes";
export * from "./hooks";
```

**Step 4: apps/app/src/router.tsx에 라우트 등록**

import 추가:
```typescript
import { createContentStudioRoutes } from "./features/content-studio";
```

`appLayoutRoute.addChildren([...])` 배열에 추가:
```typescript
...createContentStudioRoutes(appLayoutRoute),
```

**Step 5: 빌드 확인**

Run: `cd apps/app && pnpm tsc --noEmit`
Expected: PASS

**Step 6: 커밋**

```bash
git add apps/app/src/features/content-studio/ apps/app/src/router.tsx
git commit -m "feat(content-studio): 스튜디오 목록 페이지 + 라우트 등록"
```

---

## Task 9: 캔버스 뷰 — React Flow + 커스텀 노드

**Files:**
- Create: `apps/app/src/features/content-studio/pages/canvas-page.tsx`
- Create: `apps/app/src/features/content-studio/components/canvas/topic-node.tsx`
- Create: `apps/app/src/features/content-studio/components/canvas/content-card-node.tsx`
- Create: `apps/app/src/features/content-studio/components/canvas/agent-node.tsx`
- Create: `apps/app/src/features/content-studio/components/canvas/canvas-toolbar.tsx`
- Create: `apps/app/src/features/content-studio/store/canvas-store.ts`
- Modify: `apps/app/src/features/content-studio/routes/index.ts`

**Context:** React Flow(`@xyflow/react`)로 캔버스를 구현합니다. 3가지 커스텀 노드(TopicNode, ContentCardNode, AgentNode)와 글로벌 에이전트 툴바를 포함합니다. 기존 `apps/app/src/features/graph-content/` 패턴을 참고합니다.

**이 Task는 규모가 크므로 구현 시 각 컴포넌트를 순차적으로 작성합니다.**

**Step 1: Jotai store 생성**

```typescript
// apps/app/src/features/content-studio/store/canvas-store.ts
import { atom } from "jotai";

/** 현재 선택된 노드 ID + 타입 */
export const selectedNodeAtom = atom<{ id: string; type: "topic" | "content" } | null>(null);

/** 에이전트 프롬프트 표시 여부 */
export const agentVisibleAtom = atom((get) => get(selectedNodeAtom) !== null);
```

**Step 2: TopicNode 컴포넌트**

```typescript
// apps/app/src/features/content-studio/components/canvas/topic-node.tsx
import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

interface TopicNodeData {
  label: string;
  color?: string | null;
}

interface Props extends NodeProps {
  data: TopicNodeData;
}

export const TopicNode = memo(function TopicNode({ data, selected }: Props) {
  return (
    <div
      className={`flex items-center justify-center rounded-full border-2 px-4 py-2 text-sm font-medium transition-shadow ${
        selected ? "ring-2 ring-primary shadow-md" : ""
      }`}
      style={{
        borderColor: data.color ?? "hsl(var(--primary))",
        backgroundColor: data.color ? `${data.color}15` : "hsl(var(--primary) / 0.05)",
      }}
    >
      <span>{data.label}</span>
      <Handle type="source" position={Position.Right} className="!size-2 !bg-primary" />
      <Handle type="target" position={Position.Left} className="!size-2 !bg-primary" />
    </div>
  );
});
```

**Step 3: ContentCardNode 컴포넌트**

```typescript
// apps/app/src/features/content-studio/components/canvas/content-card-node.tsx
import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@repo/ui/shadcn/badge";
import { Eye, MessageSquare } from "lucide-react";

interface ContentCardData {
  title: string;
  status: string;
  authorName?: string | null;
  authorAvatar?: string | null;
  viewCount?: number;
  topicLabel?: string | null;
  createdAt?: string;
}

interface Props extends NodeProps {
  data: ContentCardData;
}

export const ContentCardNode = memo(function ContentCardNode({ data, selected }: Props) {
  return (
    <div
      className={`w-64 rounded-lg border bg-card p-4 transition-shadow ${
        selected ? "ring-2 ring-primary shadow-md" : "shadow-sm"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!size-2 !bg-primary" />
      <Handle type="source" position={Position.Right} className="!size-2 !bg-primary" />

      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium leading-tight line-clamp-2">{data.title}</h4>
        <StatusBadge status={data.status} />
      </div>

      {data.topicLabel && (
        <p className="mt-1 text-sm text-muted-foreground">{data.topicLabel}</p>
      )}

      <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
        {data.authorName && <span>{data.authorName}</span>}
        {typeof data.viewCount === "number" && (
          <span className="flex items-center gap-1">
            <Eye className="size-3" />
            {data.viewCount}
          </span>
        )}
      </div>
    </div>
  );
});

/* -------------------------------------------------------------------------------------------------
 * Components
 * -----------------------------------------------------------------------------------------------*/

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "초안", variant: "secondary" },
  writing: { label: "작성 중", variant: "outline" },
  review: { label: "검토", variant: "outline" },
  published: { label: "발행됨", variant: "default" },
  canceled: { label: "취소", variant: "destructive" },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
```

**Step 4: AgentNode 컴포넌트**

```typescript
// apps/app/src/features/content-studio/components/canvas/agent-node.tsx
import { memo, useState } from "react";
import { type NodeProps } from "@xyflow/react";
import { Button } from "@repo/ui/shadcn/button";
import { Input } from "@repo/ui/shadcn/input";
import { Bot, Send } from "lucide-react";

interface AgentNodeData {
  targetId: string;
  targetType: "topic" | "content";
  onSubmit: (prompt: string) => void;
  isLoading?: boolean;
}

interface Props extends NodeProps {
  data: AgentNodeData;
}

export const AgentNode = memo(function AgentNode({ data }: Props) {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = () => {
    if (!prompt.trim()) return;
    data.onSubmit(prompt.trim());
    setPrompt("");
  };

  return (
    <div className="w-72 rounded-lg border-2 border-dashed border-primary/30 bg-card p-3">
      <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
        <Bot className="size-4 text-primary" />
        <span>AI 에이전트</span>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder={
            data.targetType === "topic"
              ? "이 주제로 콘텐츠 생성..."
              : "이 콘텐츠를 수정..."
          }
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className="text-sm"
        />
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={data.isLoading || !prompt.trim()}
        >
          <Send className="size-3" />
        </Button>
      </div>
    </div>
  );
});
```

**Step 5: 글로벌 에이전트 툴바**

```typescript
// apps/app/src/features/content-studio/components/canvas/canvas-toolbar.tsx
import { useState } from "react";
import { Button } from "@repo/ui/shadcn/button";
import { Input } from "@repo/ui/shadcn/input";
import { Bot, Send } from "lucide-react";

interface Props {
  onSubmit: (prompt: string) => void;
  isLoading?: boolean;
}

export function CanvasToolbar({ onSubmit, isLoading }: Props) {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = () => {
    if (!prompt.trim()) return;
    onSubmit(prompt.trim());
    setPrompt("");
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-full max-w-xl">
      <div className="flex items-center gap-2 rounded-lg border bg-card p-2 shadow-md">
        <Bot className="size-5 text-primary shrink-0" />
        <Input
          placeholder="전체 스튜디오에 대한 명령을 입력하세요..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className="border-0 bg-transparent focus-visible:ring-0"
        />
        <Button size="sm" onClick={handleSubmit} disabled={isLoading || !prompt.trim()}>
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
```

**Step 6: 캔버스 페이지 구현**

```typescript
// apps/app/src/features/content-studio/pages/canvas-page.tsx
import { useCallback, useMemo } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnNodesChange,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useAtom } from "jotai";
import { PageHeader } from "@repo/ui/components/page-header";
import { Button } from "@repo/ui/shadcn/button";
import { Skeleton } from "@repo/ui/shadcn/skeleton";
import { ArrowLeft, Plus, Tag } from "lucide-react";
import { useCanvasData, useCanvasMutations } from "../hooks";
import { selectedNodeAtom } from "../store/canvas-store";
import { TopicNode } from "../components/canvas/topic-node";
import { ContentCardNode } from "../components/canvas/content-card-node";
import { AgentNode } from "../components/canvas/agent-node";
import { CanvasToolbar } from "../components/canvas/canvas-toolbar";

interface Props {}

export function CanvasPage({}: Props) {
  const { studioId } = useParams({ strict: false }) as { studioId: string };
  const navigate = useNavigate();
  const { data, isLoading } = useCanvasData(studioId);
  const mutations = useCanvasMutations(studioId);
  const [selectedNode, setSelectedNode] = useAtom(selectedNodeAtom);

  const nodeTypes: NodeTypes = useMemo(
    () => ({
      topic: TopicNode,
      contentCard: ContentCardNode,
      agent: AgentNode,
    }),
    []
  );

  // 캔버스 데이터 → React Flow 노드/엣지 변환
  const initialNodes = useMemo<Node[]>(() => {
    if (!data) return [];
    const nodes: Node[] = [];

    // 주제 노드
    data.topics.forEach((t) => {
      nodes.push({
        id: `topic-${t.id}`,
        type: "topic",
        position: { x: t.positionX, y: t.positionY },
        data: { label: t.label, color: t.color },
      });
    });

    // 콘텐츠 노드
    data.contents.forEach((c) => {
      nodes.push({
        id: `content-${c.id}`,
        type: "contentCard",
        position: { x: c.positionX, y: c.positionY },
        data: {
          title: c.title,
          status: c.status,
          authorName: c.authorName,
          viewCount: c.viewCount,
          topicLabel: c.topicLabel,
        },
      });
    });

    // 에이전트 노드 (선택된 노드가 있을 때만)
    if (selectedNode) {
      const parentNode = nodes.find((n) => n.id === `${selectedNode.type}-${selectedNode.id}`);
      if (parentNode) {
        nodes.push({
          id: "agent",
          type: "agent",
          position: { x: parentNode.position.x, y: parentNode.position.y + 120 },
          data: {
            targetId: selectedNode.id,
            targetType: selectedNode.type,
            onSubmit: (prompt: string) => handleAgentPrompt(prompt, selectedNode),
            isLoading: false,
          },
        });
      }
    }

    return nodes;
  }, [data, selectedNode]);

  const initialEdges = useMemo<Edge[]>(() => {
    if (!data) return [];
    const edges: Edge[] = [];

    data.edges.forEach((e) => {
      edges.push({
        id: `edge-${e.id}`,
        source: `${e.sourceType}-${e.sourceId}`,
        target: `${e.targetType}-${e.targetId}`,
      });
    });

    // 에이전트 노드 연결 엣지
    if (selectedNode) {
      edges.push({
        id: "agent-edge",
        source: `${selectedNode.type}-${selectedNode.id}`,
        target: "agent",
        animated: true,
        style: { strokeDasharray: "5 5", stroke: "hsl(var(--primary))" },
      });
    }

    return edges;
  }, [data, selectedNode]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.id === "agent") return;
    const [type, id] = node.id.split("-") as ["topic" | "content", string];
    if (type === "content") {
      // 콘텐츠 노드 더블클릭 감지를 위한 플래그는 별도 처리
    }
    setSelectedNode({ id, type });
  }, [setSelectedNode]);

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === "contentCard") {
        const contentId = node.id.replace("content-", "");
        navigate({
          to: "/content-studio/$studioId/$contentId/edit",
          params: { studioId, contentId },
        });
      }
    },
    [navigate, studioId]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  const handleAgentPrompt = (prompt: string, target: { id: string; type: "topic" | "content" }) => {
    // TODO: agent-server SSE 연동 (Task 11에서 구현)
    console.log("Agent prompt:", prompt, "Target:", target);
  };

  const handleGlobalPrompt = (prompt: string) => {
    // TODO: 글로벌 에이전트 명령 (Task 11에서 구현)
    console.log("Global prompt:", prompt);
  };

  const handleAddTopic = () => {
    mutations.createTopic.mutate({
      studioId,
      label: "새 주제",
      positionX: Math.random() * 500,
      positionY: Math.random() * 400,
    });
  };

  const handleAddContent = () => {
    mutations.createContent.mutate({
      studioId,
      title: "새 콘텐츠",
      positionX: Math.random() * 500 + 200,
      positionY: Math.random() * 400,
    });
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Skeleton className="h-[80vh] w-[90vw]" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <PageHeader
        title={data?.studio.title ?? "스튜디오"}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/content-studio" })}>
              <ArrowLeft className="size-4" />
              목록
            </Button>
            <Button variant="outline" size="sm" onClick={handleAddTopic}>
              <Tag className="size-4" />
              주제 추가
            </Button>
            <Button size="sm" onClick={handleAddContent}>
              <Plus className="size-4" />
              콘텐츠 추가
            </Button>
          </div>
        }
      />

      <div className="relative flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>

        <CanvasToolbar onSubmit={handleGlobalPrompt} />
      </div>
    </div>
  );
}
```

**Step 7: routes/index.ts에 캔버스 라우트 추가**

```typescript
// apps/app/src/features/content-studio/routes/index.ts 전체 교체
import { createRoute, type AnyRoute } from "@tanstack/react-router";
import { StudioListPage } from "../pages/studio-list-page";
import { CanvasPage } from "../pages/canvas-page";

export const CONTENT_STUDIO_PATH = "/content-studio";

export const createStudioListRoute = <T extends AnyRoute>(parentRoute: T) =>
  createRoute({
    getParentRoute: () => parentRoute,
    path: "/content-studio",
    component: StudioListPage,
  });

export const createCanvasRoute = <T extends AnyRoute>(parentRoute: T) =>
  createRoute({
    getParentRoute: () => parentRoute,
    path: "/content-studio/$studioId",
    component: CanvasPage,
  });

export function createContentStudioRoutes<T extends AnyRoute>(parentRoute: T) {
  return [
    createStudioListRoute(parentRoute),
    createCanvasRoute(parentRoute),
  ];
}
```

**Step 8: 빌드 확인**

Run: `cd apps/app && pnpm tsc --noEmit`
Expected: PASS

**Step 9: 커밋**

```bash
git add apps/app/src/features/content-studio/
git commit -m "feat(content-studio): 캔버스 뷰 구현 (React Flow + 커스텀 노드 + 에이전트 노드)"
```

---

## Task 10: 에디터 뷰 — Novel + 메타 패널

**Files:**
- Create: `apps/app/src/features/content-studio/pages/editor-page.tsx`
- Create: `apps/app/src/features/content-studio/components/editor/meta-panel.tsx`
- Modify: `apps/app/src/features/content-studio/routes/index.ts`

**Context:** Novel(TipTap 기반) 에디터와 우측 메타 패널을 구현합니다. Novel은 별도 패키지 설치가 필요합니다 (`novel`). AI 자동완성은 별도 Task에서 구현합니다.

**의존성 설치:**

```bash
cd apps/app && pnpm add novel
```

**Step 1: 메타 패널 컴포넌트**

```typescript
// apps/app/src/features/content-studio/components/editor/meta-panel.tsx
import { useState } from "react";
import { Button } from "@repo/ui/shadcn/button";
import { Input } from "@repo/ui/shadcn/input";
import { Textarea } from "@repo/ui/shadcn/textarea";
import { Label } from "@repo/ui/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/shadcn/select";
import { ExternalLink } from "lucide-react";

interface Props {
  content: {
    title: string;
    summary: string | null;
    thumbnailUrl: string | null;
    status: string;
    topicLabel: string | null;
  };
  studioId: string;
  contentId: string;
  onUpdate: (data: Record<string, unknown>) => void;
  onNavigateMarketing: () => void;
}

export function MetaPanel({ content, onUpdate, onNavigateMarketing }: Props) {
  return (
    <div className="flex h-full w-80 flex-col border-l bg-background p-4 gap-6 overflow-y-auto">
      <div>
        <Label className="text-sm text-muted-foreground">상태</Label>
        <Select
          value={content.status}
          onValueChange={(value) => onUpdate({ status: value })}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">초안</SelectItem>
            <SelectItem value="writing">작성 중</SelectItem>
            <SelectItem value="review">검토</SelectItem>
            <SelectItem value="published">발행</SelectItem>
            <SelectItem value="canceled">취소</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-sm text-muted-foreground">요약</Label>
        <Textarea
          className="mt-1"
          value={content.summary ?? ""}
          onChange={(e) => onUpdate({ summary: e.target.value })}
          rows={3}
          placeholder="콘텐츠 요약을 입력하세요"
        />
      </div>

      <div>
        <Label className="text-sm text-muted-foreground">썸네일 URL</Label>
        <Input
          className="mt-1"
          value={content.thumbnailUrl ?? ""}
          onChange={(e) => onUpdate({ thumbnailUrl: e.target.value || null })}
          placeholder="https://..."
        />
      </div>

      {content.topicLabel && (
        <div>
          <Label className="text-sm text-muted-foreground">연결된 주제</Label>
          <p className="mt-1 text-sm">{content.topicLabel}</p>
        </div>
      )}

      <div className="mt-auto pt-4 border-t">
        <Button
          variant="outline"
          className="w-full"
          onClick={onNavigateMarketing}
        >
          <ExternalLink className="size-4" />
          마케팅 배포
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: 에디터 페이지 구현**

```typescript
// apps/app/src/features/content-studio/pages/editor-page.tsx
import { useState, useCallback } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Button } from "@repo/ui/shadcn/button";
import { Input } from "@repo/ui/shadcn/input";
import { Skeleton } from "@repo/ui/shadcn/skeleton";
import { ArrowLeft, Save } from "lucide-react";
import { useContent, useCanvasMutations } from "../hooks";
import { MetaPanel } from "../components/editor/meta-panel";

interface Props {}

export function EditorPage({}: Props) {
  const { studioId, contentId } = useParams({ strict: false }) as {
    studioId: string;
    contentId: string;
  };
  const navigate = useNavigate();
  const { data: content, isLoading } = useContent(contentId);
  const { updateContent } = useCanvasMutations(studioId);

  const [title, setTitle] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  // 초기 데이터 로드
  useState(() => {
    if (content) {
      setTitle(content.title);
      setEditorContent(content.content ?? "");
    }
  });

  const handleSave = useCallback(() => {
    updateContent.mutate(
      { id: contentId, data: { title, content: editorContent } },
      { onSuccess: () => setIsDirty(false) }
    );
  }, [contentId, title, editorContent, updateContent]);

  const handleMetaUpdate = useCallback(
    (data: Record<string, unknown>) => {
      updateContent.mutate({ id: contentId, data });
    },
    [contentId, updateContent]
  );

  if (isLoading || !content) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Skeleton className="h-[80vh] w-[60vw]" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            navigate({
              to: "/content-studio/$studioId",
              params: { studioId },
            })
          }
        >
          <ArrowLeft className="size-4" />
          캔버스로 돌아가기
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={updateContent.isPending || !isDirty}
        >
          <Save className="size-4" />
          저장
        </Button>
      </div>

      {/* 본문 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 에디터 영역 */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-3xl">
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setIsDirty(true);
              }}
              placeholder="제목을 입력하세요"
              className="border-0 bg-transparent text-3xl font-bold focus-visible:ring-0 px-0"
            />

            {/* Novel 에디터 영역 — 별도 컴포넌트로 분리 예정 */}
            <div className="mt-6 prose prose-lg max-w-none">
              <textarea
                value={editorContent}
                onChange={(e) => {
                  setEditorContent(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full min-h-[60vh] resize-none border-0 bg-transparent focus:outline-none text-base leading-relaxed"
                placeholder="콘텐츠를 작성하세요... (Novel 에디터로 교체 예정)"
              />
            </div>
          </div>
        </div>

        {/* 메타 패널 */}
        <MetaPanel
          content={content}
          studioId={studioId}
          contentId={contentId}
          onUpdate={handleMetaUpdate}
          onNavigateMarketing={() => {
            // TODO: 마케팅 feature 페이지로 이동 (Task 12에서 구현)
            console.log("Navigate to marketing with sourceType: content_studio, sourceId:", contentId);
          }}
        />
      </div>
    </div>
  );
}
```

> **Note:** 이 Task에서는 `<textarea>`로 기본 에디터를 구현합니다. Novel 에디터 교체는 별도 고도화 Task에서 진행합니다. 이렇게 하면 전체 플로우를 먼저 완성하고, 에디터를 점진적으로 업그레이드할 수 있습니다.

**Step 3: routes/index.ts에 에디터 라우트 추가**

`apps/app/src/features/content-studio/routes/index.ts` 파일에서:

import 추가:
```typescript
import { EditorPage } from "../pages/editor-page";
```

라우트 추가:
```typescript
export const createEditorRoute = <T extends AnyRoute>(parentRoute: T) =>
  createRoute({
    getParentRoute: () => parentRoute,
    path: "/content-studio/$studioId/$contentId/edit",
    component: EditorPage,
  });
```

`createContentStudioRoutes` 함수에 추가:
```typescript
export function createContentStudioRoutes<T extends AnyRoute>(parentRoute: T) {
  return [
    createStudioListRoute(parentRoute),
    createCanvasRoute(parentRoute),
    createEditorRoute(parentRoute),
  ];
}
```

**Step 4: 빌드 확인**

Run: `cd apps/app && pnpm tsc --noEmit`
Expected: PASS

**Step 5: 커밋**

```bash
git add apps/app/src/features/content-studio/
git commit -m "feat(content-studio): 에디터 뷰 구현 (기본 textarea + 메타 패널)"
```

---

## Task 11: Admin 페이지 (system-admin)

**Files:**
- Create: `apps/system-admin/src/features/content-studio/index.ts`
- Create: `apps/system-admin/src/features/content-studio/routes.ts`
- Create: `apps/system-admin/src/features/content-studio/pages/content-studio-admin-page.tsx`
- Create: `apps/system-admin/src/features/content-studio/hooks/index.ts`
- Modify: `apps/system-admin/src/router.tsx`
- Modify: `apps/system-admin/src/feature-config.ts`

**Context:** system-admin에 관리 페이지를 추가합니다. 기존 analytics admin 패턴을 따릅니다.

**Step 1: Admin hooks**

```typescript
// apps/system-admin/src/features/content-studio/hooks/index.ts
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";

export function useAdminStudios() {
  const trpc = useTRPC();
  return useQuery(trpc.contentStudio.adminList.queryOptions());
}
```

**Step 2: Admin 페이지**

```typescript
// apps/system-admin/src/features/content-studio/pages/content-studio-admin-page.tsx
import { PageHeader } from "@repo/ui/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { Badge } from "@repo/ui/shadcn/badge";
import { Skeleton } from "@repo/ui/shadcn/skeleton";
import { useAdminStudios } from "../hooks";

interface Props {}

export function ContentStudioAdminPage({}: Props) {
  const { data: studios, isLoading } = useAdminStudios();

  return (
    <div className="container mx-auto py-8">
      <PageHeader
        title="콘텐츠 스튜디오 관리"
        description="전체 스튜디오를 관리합니다"
      />

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>스튜디오 목록</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <div className="divide-y">
                {studios?.map((studio) => (
                  <div key={studio.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">{studio.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {studio.ownerName} · 콘텐츠 {studio.contentCount}개
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={studio.visibility === "public" ? "default" : "secondary"}>
                        {studio.visibility === "public" ? "공개" : "비공개"}
                      </Badge>
                      {studio.isDeleted && (
                        <Badge variant="destructive">삭제됨</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

**Step 3: routes.ts**

```typescript
// apps/system-admin/src/features/content-studio/routes.ts
import { createRoute, type AnyRoute } from "@tanstack/react-router";
import { ContentStudioAdminPage } from "./pages/content-studio-admin-page";

export const CONTENT_STUDIO_ADMIN_PATH = "/admin/content-studio";

export function createContentStudioAdminRoutes<T extends AnyRoute>(parentRoute: T) {
  return [
    createRoute({
      getParentRoute: () => parentRoute,
      path: "/admin/content-studio",
      component: ContentStudioAdminPage,
    }),
  ];
}
```

**Step 4: index.ts**

```typescript
// apps/system-admin/src/features/content-studio/index.ts
export { CONTENT_STUDIO_ADMIN_PATH, createContentStudioAdminRoutes } from "./routes";
export * from "./hooks";
```

**Step 5: system-admin/src/router.tsx에 등록**

import 추가:
```typescript
import { createContentStudioAdminRoutes } from "./features/content-studio";
```

`adminLayoutRoute.addChildren([...])` 배열에 추가:
```typescript
...createContentStudioAdminRoutes(adminLayoutRoute),
```

타입 안전성을 위해 public 라우트도 등록 (있다면). content-studio는 auth 라우트만 있으므로 `createContentStudioRoutes`를 system-admin에도 복사하거나, 공통 라우트 함수를 만들어야 합니다. 간단히 admin 라우트만 등록해도 됩니다.

**Step 6: feature-config.ts에 메뉴 추가**

`apps/system-admin/src/feature-config.ts`에서:

import 추가:
```typescript
import { CONTENT_STUDIO_ADMIN_PATH } from "./features/content-studio";
import { Palette } from "lucide-react";
```

`featureAdminMenus` 배열에 추가:
```typescript
{
  id: "content-studio",
  label: "콘텐츠 스튜디오",
  path: CONTENT_STUDIO_ADMIN_PATH,
  icon: Palette,
  order: 7,
},
```

**Step 7: 빌드 확인**

Run: `cd apps/system-admin && pnpm tsc --noEmit`
Expected: PASS

**Step 8: 커밋**

```bash
git add apps/system-admin/src/features/content-studio/ apps/system-admin/src/router.tsx apps/system-admin/src/feature-config.ts
git commit -m "feat(content-studio): Admin 관리 페이지 (system-admin)"
```

---

## Task 12: 마케팅 연동 + 레퍼런스 문서 업데이트

**Files:**
- Modify: `packages/drizzle/src/schema/features/marketing/index.ts` (sourceType enum)
- Modify: `docs/reference/features-backend.md`
- Modify: `docs/reference/server-registry.md`
- Modify: `docs/reference/database-schema.md`
- Modify: `docs/reference/features-frontend.md`

**Step 1: 마케팅 sourceType enum에 'content_studio' 추가**

`packages/drizzle/src/schema/features/marketing/index.ts`에서:

```typescript
// Before
export const marketingContentSourceEnum = pgEnum("marketing_content_source", [
  "editor",
  "graph_content",
  "board_post",
  "community_post",
]);

// After
export const marketingContentSourceEnum = pgEnum("marketing_content_source", [
  "editor",
  "graph_content",
  "board_post",
  "community_post",
  "content_studio",
]);
```

**Step 2: 4개 레퍼런스 문서 업데이트**

각 문서에 content-studio feature 관련 내용을 추가합니다:

- `features-backend.md`: content-studio 모듈, 서비스, tRPC 라우터 섹션 추가
- `server-registry.md`: NestJS Module, tRPC Router 키 추가, Feature 수 업데이트
- `database-schema.md`: studio_studios, studio_topics, studio_contents, studio_content_seo, studio_edges 테이블 추가
- `features-frontend.md`: content-studio feature 섹션 추가 (목록, 캔버스, 에디터 페이지 + Admin)

**Step 3: 빌드 확인**

Run: `cd packages/drizzle && pnpm tsc --noEmit`
Expected: PASS

**Step 4: 커밋**

```bash
git add packages/drizzle/src/schema/features/marketing/index.ts docs/reference/
git commit -m "feat(content-studio): 마케팅 sourceType 추가 + 레퍼런스 문서 업데이트"
```

---

## Task 13: 전체 빌드 검증 + 마이그레이션

**Step 1: 전체 TypeScript 빌드 검증**

```bash
cd packages/drizzle && pnpm tsc --noEmit
cd packages/features && pnpm tsc --noEmit
cd apps/server && pnpm tsc --noEmit
cd apps/app && pnpm tsc --noEmit
cd apps/system-admin && pnpm tsc --noEmit
```
Expected: 모두 PASS

**Step 2: Drizzle 마이그레이션 생성**

```bash
cd packages/drizzle && pnpm drizzle-kit generate
```

**Step 3: git status로 다른 Feature 미수정 확인**

```bash
git status
```

변경된 파일이 content-studio 관련 파일과 등록 파일(app-router, router, app.module, feature-config, schema/index, schema-registry, marketing/index, docs/reference/)만인지 확인.

**Step 4: 커밋**

```bash
git add .
git commit -m "feat(content-studio): DB 마이그레이션 생성"
```

---

## 추후 고도화 (이번 계획 범위 밖)

이번 구현에서는 MVP로 기본 플로우를 완성합니다. 아래는 별도 계획으로 진행합니다:

1. **Novel 에디터 교체**: 현재 `<textarea>` → Novel 에디터로 교체, AI 자동완성 통합
2. **에이전트 SSE 연동**: 캔버스/에디터의 AI 프롬프트를 agent-server SSE와 연결
3. **컨텍스트 메뉴**: 캔버스 노드 우클릭 메뉴 (편집, 삭제, 복제, 배포)
4. **노드 위치 debounce 저장**: 드래그 종료 시 위치 자동 저장
5. **빈 캔버스 시작 화면**: Figma 디자인 기반 온보딩 UI
6. **SEO 대시보드**: SEO 이력 차트 + 트래픽 변화 분석
