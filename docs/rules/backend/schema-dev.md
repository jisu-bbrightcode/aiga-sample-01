---
description: Database Schema & Drizzle ORM Rules
globs: "**/schema/*.ts, drizzle.config.ts"
alwaysApply: false
---

# Database Schema Rules

> 스키마 코드 작성 규칙 (네이밍, 컬럼 헬퍼, Relations, JSONB 등)
>
> 스키마 위치·등록·import 패턴 → `../feature/schema.md` 참조

---

## 네이밍 컨벤션

| 항목              | 스타일                   | 예시                                    |
| :---------------- | :----------------------- | :-------------------------------------- |
| File              | `kebab-case`             | `index.ts` (feature 디렉토리)            |
| Table Variable    | `camelCase`              | `blogPosts`                             |
| DB Table Name     | `{prefix}_{entity}`      | `blog_posts`, `blog_blogs` (메인 테이블) |
| DB Enum Name      | `{prefix}_{name}`        | `blog_post_status`, `studio_visibility` |
| DB Column Name    | `snake_case`             | `created_at`, `is_published`            |
| Column Variable   | `camelCase`              | `createdAt`, `isPublished`              |
| Index Name        | `idx_{table}_{column}`   | `idx_blog_posts_author`                 |
| Relations Variable| `{table}Relations`       | `blogPostsRelations`, `commentsRelations` |

---

## Feature Prefix 규칙 (필수)

- Feature 스키마의 **모든** 테이블/enum은 prefix 필수
- 메인 테이블도 예외 없음: `board_boards` (O), `boards` (X)
- Core 스키마(`profiles`, `files`, `roles` 등)는 prefix 없음

### Prefix = Feature 이름 또는 도메인 약어

대부분 Feature 디렉토리명과 동일하지만, **긴 이름은 도메인 약어**를 사용할 수 있다.
한번 정한 prefix는 해당 Feature 내에서 **일관되게** 유지한다.

| Feature 디렉토리 | DB Prefix | 이유 |
|------------------|-----------|------|
| `blog` | `blog_` | 디렉토리명 = prefix |
| `board` | `board_` | 디렉토리명 = prefix |
| `community` | `community_` | 디렉토리명 = prefix |
| `content-studio` | `studio_` | 약어 사용 |
| `scheduled-job` | `system_` | 시스템 도메인 그룹 |
| `audit-log` | `system_` | 시스템 도메인 그룹 |
| `analytics` | `system_` | 시스템 도메인 그룹 |
| `agent-desk` | `agent_desk_` | 복합 도메인 |

---

## 컬럼 헬퍼 (`packages/drizzle/src/utils/columns.ts`)

| 헬퍼 | 제공 컬럼 | 용도 |
|------|----------|------|
| `baseColumns()` | `id` + `createdAt` + `updatedAt` | 모든 테이블 기본 |
| `baseColumnsWithSoftDelete()` | `baseColumns()` + `deletedAt` + `isDeleted` | Soft Delete가 필요한 테이블 |
| `id()` | `uuid("id").primaryKey().defaultRandom()` | ID만 필요할 때 |
| `timestamps()` | `createdAt` + `updatedAt` (withTimezone) | 타임스탬프만 필요할 때 |
| `softDelete()` | `deletedAt` + `isDeleted` | Soft Delete 컬럼만 추가할 때 |

```typescript
import { baseColumns, baseColumnsWithSoftDelete } from "../../utils/columns";

export const blogPosts = pgTable("blog_posts", {
  ...baseColumnsWithSoftDelete(),  // id, createdAt, updatedAt, deletedAt, isDeleted
  title: varchar("title", { length: 200 }).notNull(),
});
```

---

## Relations 정의

Drizzle의 `relations()`로 관계를 정의한다. **변수명은 `{table}Relations`**.

```typescript
import { relations } from "drizzle-orm";

export const commentsRelations = relations(comments, ({ one, many }) => ({
  author: one(profiles, {
    fields: [comments.authorId],
    references: [profiles.id],
  }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: "parentChild",
  }),
  children: many(comments, {
    relationName: "parentChild",
  }),
}));
```

| 패턴 | 사용 시점 |
|------|----------|
| `one()` | FK 관계 (N:1) |
| `many()` | 역참조 (1:N) |
| `relationName` | 자기 참조(self-referential) 또는 동일 테이블 간 복수 관계 시 필수 |

### Self-referential FK (AnyPgColumn)

테이블 정의 시점에 자기 자신을 참조하면 `AnyPgColumn`으로 래핑한다:

```typescript
import type { AnyPgColumn } from "drizzle-orm/pg-core";

export const studioContents = pgTable("studio_contents", {
  ...baseColumns(),
  derivedFromId: uuid("derived_from_id").references(
    (): AnyPgColumn => studioContents.id,
    { onDelete: "set null" },
  ),
});
```

---

## JSONB 컬럼

JSONB 컬럼은 `.$type<T>()`로 TypeScript 타입을 지정한다.

```typescript
// 배열 타입
mentions: jsonb("mentions").$type<string[]>().default([]),

// 객체 타입 — 파일 상단 Types 섹션에 타입 정의
export type AutomodConfig = {
  enabled: boolean;
  rules: string[];
};

automodConfig: jsonb("automod_config").$type<AutomodConfig>(),

// 타입 없는 범용 JSONB (비권장 — 가능하면 타입 지정)
metadata: jsonb("metadata"),
```

---

## 스키마 파일 작성 순서

각 Feature 스키마 파일은 다음 순서로 구성한다:

```typescript
// packages/drizzle/src/schema/features/{name}/index.ts

// ============================================================================
// Enums (pgEnum)
// ============================================================================
export const blogStatusEnum = pgEnum("blog_post_status", ["draft", "published"]);

// ============================================================================
// Types (TypeScript types for JSONB columns)
// ============================================================================
export type PostMetadata = { readingTime: number; };

// ============================================================================
// Tables (pgTable definitions)
// ============================================================================
export const blogPosts = pgTable("blog_posts", {
  ...baseColumnsWithSoftDelete(),
  title: varchar("title", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 300 }).notNull().unique(),
  isPublished: boolean("is_published").default(false),
  metadata: jsonb("metadata").$type<PostMetadata>(),
  authorId: uuid("author_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
});

// ============================================================================
// Relations (Drizzle relations)
// ============================================================================
export const blogPostsRelations = relations(blogPosts, ({ one }) => ({
  author: one(profiles, {
    fields: [blogPosts.authorId],
    references: [profiles.id],
  }),
}));

// ============================================================================
// Type Exports (Drizzle inferred types)
// ============================================================================
export type BlogPost = typeof blogPosts.$inferSelect;
export type NewBlogPost = typeof blogPosts.$inferInsert;
```

---

## FK 참조 규칙

| 대상 | import 위치 | onDelete |
|------|------------|----------|
| Core 테이블 (profiles, files) | `../../core/profiles` (상대 경로) | `cascade` 또는 `set null` |
| 같은 Feature 테이블 | 같은 파일 내 직접 참조 | `cascade` |
| 다른 Feature 테이블 | **가능하면 피한다** — 필요시 상대 경로 | `set null` |

```typescript
// Core 참조
import { profiles } from "../../core/profiles";

authorId: uuid("author_id")
  .notNull()
  .references(() => profiles.id, { onDelete: "cascade" }),
```
