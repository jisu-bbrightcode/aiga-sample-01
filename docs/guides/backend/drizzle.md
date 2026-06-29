---
description: Drizzle ORM rules, centralized schema management, and naming conventions
globs: "packages/drizzle/**/*.ts, **/schema/**/*.ts"
alwaysApply: false
---

# Drizzle ORM 규칙 & 스키마 패턴

> NestJS 11+ / Fastify 5+ / Drizzle ORM 1.0+ / tRPC 11+ / PostgreSQL

---

## SQL 사용 규칙

**직접 SQL 사용 금지** - 모든 쿼리는 Drizzle Query Builder 또는 Relational Query 사용

| 케이스          | 예시                           | 허용 여부       |
| --------------- | ------------------------------ | --------------- |
| 통계/집계 쿼리  | `sql<number>\`count(\*)\``     | O               |
| 복잡한 서브쿼리 | Window 함수, CTE               | O               |
| DB 전용 함수    | `gen_random_uuid()`, `now()`   | O               |
| 일반 CRUD       | select, insert, update, delete | X (Drizzle 사용) |

```typescript
// ✅ Drizzle Query Builder
const posts = await db.select().from(postsTable).where(eq(postsTable.authorId, userId));

// ✅ 집계 (sql 허용)
const stats = await db
  .select({ count: sql<number>`count(*)`.as("count") })
  .from(reactions)
  .groupBy(reactions.targetType);

// ❌ 금지 - sql`` 직접 사용
const posts = await db.execute(sql`SELECT * FROM posts WHERE author_id = ${userId}`);
```

---

## Schema Import 경로 (필수)

**`@repo/drizzle/schema` import 사용** - drizzle-kit 호환성을 위해 schema 전용 export path 사용

```typescript
// ✅ Schema 파일에서는 반드시 /schema 경로 사용 (NestJS 데코레이터 로딩 방지)
import { baseColumns, softDelete } from '@repo/drizzle/schema';

// ❌ 금지 - drizzle-kit에서 NestJS 데코레이터 파싱 오류 발생
import { baseColumns } from '@repo/drizzle';  // DatabaseModule 포함됨
```

> **중요**: `@repo/drizzle`의 메인 export(`index.ts`)는 NestJS `DatabaseModule`을 포함합니다.
> Schema 파일에서 이를 import하면 drizzle-kit이 NestJS 데코레이터를 파싱하다 오류가 발생합니다.

---

## PostgreSQL 타입 권장사항

| 권장                      | 비권장          | 이유                                            |
| ------------------------- | --------------- | ----------------------------------------------- |
| `text`                    | `varchar(n)`    | PostgreSQL에서 성능 차이 없음, 길이 제한 불필요 |
| `uuid`                    | `text` (for ID) | 타입 안정성, 인덱스 효율                        |
| `timestamp with timezone` | `timestamp`     | 시간대 처리 명확                                |

---

## Centralized Schema Management

**모든 DB 스키마는 `packages/drizzle/src/schema/`에서 중앙 관리됩니다.**

| 규칙                     | 설명                                              |
| :----------------------- | :------------------------------------------------ |
| **Schema 위치**          | `packages/drizzle/src/schema/{feature-name}.ts`   |
| **Feature에 schema 없음** | `packages/features/{name}/server/schema/` 사용 안 함 |
| **Import 패턴**          | 항상 `@repo/drizzle`에서 import                   |

### 네이밍 컨벤션

| 항목                  | 스타일                 | 예시                                          |
| :-------------------- | :--------------------- | :-------------------------------------------- |
| **테이블 변수명**     | `camelCase`            | `blogPosts`, `boards`                         |
| **테이블명 (DB)**     | `{feature}_{entity}`   | `blog_posts`, `board_boards` (메인 테이블 포함) |
| **Enum명 (DB)**       | `{feature}_{name}`     | `blog_post_status`, `community_type`          |
| **컬럼명 (DB)**       | `snake_case`           | `created_at`, `is_published`                  |
| **컬럼 변수명 (TS)**  | `camelCase`            | `createdAt`, `isPublished`                    |
| **인덱스명**          | `idx_{table}_{column}` | `idx_blog_posts_author`                       |

> **Feature Prefix 필수**: Feature 스키마의 모든 테이블/enum은 `{feature}_` prefix가 필수.
> 메인 테이블도 예외 없음: `board_boards` (O), `boards` (X).
> Core 스키마(`profiles`, `files`, `roles`)는 prefix 불요.

### Schema 파일 작성 (중앙 위치)

**중요**: Schema는 Feature 내부가 아닌 `packages/drizzle/src/schema/`에 작성합니다.

```typescript
// packages/drizzle/src/schema/blog.ts
import { pgTable, uuid, text, boolean, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { baseColumns } from "../utils";
import { profiles } from "@repo/core/schema";

// ============================================================================
// Enums
// ============================================================================
export const postStatusEnum = pgEnum("blog_post_status", ["draft", "published", "archived"]);

// ============================================================================
// Tables
// ============================================================================
export const blogPosts = pgTable("blog_posts", {
  ...baseColumns(),  // id, createdAt, updatedAt 자동 추가
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull(),
  status: postStatusEnum("status").notNull().default("draft"),
  isPublished: boolean("is_published").default(false),      // snake_case
  viewCount: integer("view_count").default(0),              // snake_case
  authorId: uuid("author_id")
    .references(() => profiles.id, { onDelete: "cascade" })   // snake_case
    .notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
});

// ============================================================================
// Type Exports
// ============================================================================
export type BlogPost = typeof blogPosts.$inferSelect;
export type NewBlogPost = typeof blogPosts.$inferInsert;
```

### Feature에서 Schema 사용

Feature Service에서는 중앙 스키마를 import하여 사용합니다:

```typescript
// packages/features/blog/server/service/blog.service.ts
import { Injectable } from "@nestjs/common";
import { InjectDrizzle } from "@repo/drizzle";
import type { DrizzleDB } from "@repo/drizzle/types";
import { blogPosts } from "@repo/drizzle";  // 중앙 스키마에서 import
import type { BlogPost, NewBlogPost } from "@repo/drizzle";  // 타입도 중앙에서
import { eq } from "drizzle-orm";

@Injectable()
export class BlogService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  async findAll(): Promise<BlogPost[]> {
    return this.db.select().from(blogPosts);
  }

  async create(data: NewBlogPost): Promise<BlogPost> {
    const [post] = await this.db.insert(blogPosts).values(data).returning();
    return post;
  }
}
```

### 관계 정의

```typescript
// packages/drizzle/src/schema/comment.ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { baseColumns } from "../utils";
import { profiles } from "@repo/core/schema";
import { blogPosts } from "./blog";  // 같은 중앙 위치에서 참조

export const blogComments = pgTable("blog_comments", {
  ...baseColumns(),
  postId: uuid("post_id")
    .references(() => blogPosts.id, { onDelete: "cascade" })  // FK도 snake_case
    .notNull(),
  userId: uuid("user_id")
    .references(() => profiles.id, { onDelete: "cascade" })
    .notNull(),
  content: text("content").notNull(),
});

export type BlogComment = typeof blogComments.$inferSelect;
export type NewBlogComment = typeof blogComments.$inferInsert;
```

### Schema Index 등록

새로운 Schema 파일을 생성한 후에는 반드시 index에 추가합니다:

```typescript
// packages/drizzle/src/schema/index.ts
export * from "./blog";
export * from "./comment";
export * from "./community";
// ... other schemas
```

---

## 인덱스 및 제약조건

```typescript
import { baseColumns } from "@repo/drizzle/schema";
import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const reactions = pgTable(
  "reaction_reactions",  // {feature}_{entity} prefix 필수
  {
    ...baseColumns(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    userId: uuid("user_id").notNull().references(() => profiles.id),
    type: text("type").notNull().default("like"),
  },
  (table) => [
    uniqueIndex("reaction_reactions_unique_idx").on(
      table.targetType, table.targetId, table.userId, table.type,
    ),
    index("reaction_reactions_target_idx").on(table.targetType, table.targetId),
  ],
);
```

---

## 공통 유틸리티 (`packages/drizzle/src/utils/columns.ts`)

| 함수 | 포함 컬럼 | 용도 |
|------|----------|------|
| `baseColumns()` | `id` + `createdAt` + `updatedAt` | 기본 테이블 |
| `softDelete()` | `deletedAt` + `isDeleted` | Soft Delete 추가 |
| `baseColumnsWithSoftDelete()` | `baseColumns()` + `softDelete()` | 조합 |

```typescript
// 기본 테이블
export const categories = pgTable("blog_categories", {
  ...baseColumns(),
  name: text("name").notNull(),
});

// Soft Delete 포함 테이블
export const posts = pgTable("blog_posts", {
  ...baseColumnsWithSoftDelete(),
  title: text("title").notNull(),
});
```

---

## 스키마 의존성 구조

```
                    ┌─────────────────┐
                    │   core/schema   │
                    │   (profiles)    │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  features/auth  │ │  features/blog  │ │features/payment │
└─────────────────┘ └─────────────────┘ └─────────────────┘

※ DB 스키마: Feature → Core만 FK 참조 (Feature 간 직접 FK 금지)
※ 코드 레벨: Feature 간 import 허용 (순환 금지)
```

| 레이어        | 규칙                     | 설명                                            |
| ------------- | ------------------------ | ----------------------------------------------- |
| **DB 스키마** | Feature → Core만 FK 참조 | `profiles`, `files` 등 Core 테이블만 FK 참조    |
| **DB 스키마** | Feature 간 FK 금지       | Blog가 Auth의 `sessions`를 직접 참조하지 않음   |
| **코드**      | Feature 간 import 허용   | `import { X } from '@repo/features/other'` 가능 |
| **공통**      | Core 승격                | 2개 이상 Feature가 참조하면 Core로 이동 검토    |

---

## Relations 통합

Drizzle 제약: **테이블당 하나의 relations()만 가능**

Core 테이블의 relations는 **중앙에서 병합**:

```typescript
// apps/server/src/database/relations.ts
export const profilesRelations = relations(profiles, ({ many }) => ({
  sessions: many(sessions),
  posts: many(posts),
  comments: many(comments),
  uploadedFiles: many(files),
}));
```

**권장**: Feature 5개 이하 → Relations 통합 사용 / Feature 많거나 자주 변경 → 수동 join 고려

---

## drizzle.config.ts 설정

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: [
    "./packages/core/schema/*.ts",
    "./apps/server/src/features/*/schema/*.ts",
  ],
  out: "./drizzle/migrations",
  dbCredentials: { url: process.env.DATABASE_URL! },
  tablesFilter: ["profiles", "files", "blog_*", "auth_*", "payment_*"],
});
```

---

## 관련 문서

- [naming-dto.md](./naming-dto.md) - Backend 네이밍 및 DTO 규칙
- [swagger.md](./swagger.md) - Swagger/OpenAPI 설정 및 데코레이터
- [schema-dev.md](./schema-dev.md) - Schema 네이밍 컨벤션
- [api-strategy.md](./api-strategy.md) - API Strategy: tRPC-first vs REST
