---
description: "Core schema definitions (profiles, files, roles), Auth store (Jotai atoms), Guard patterns"
globs: "packages/drizzle/**/*.ts, packages/core/**/*.ts"
alwaysApply: false
---

# Core Schema Definitions

## 디렉토리 구조

### @repo/core/auth (인증 전용)

```
packages/core/auth/
├── index.ts              # 메인 export
├── store.ts              # Jotai atoms (session, profile 등)
├── schema/
│   ├── auth.ts           # Supabase auth.users 참조
│   ├── profiles.ts       # 사용자 프로필
│   └── index.ts
├── hooks/
│   ├── use-auth-state-sync.ts
│   ├── use-profile-sync.ts
│   └── index.ts
└── guards/
    ├── auth-guard.tsx
    ├── admin-guard.tsx
    └── index.ts
```

### @repo/core/schema (시스템 공통)

```
packages/core/schema/
├── files.ts      # 파일 첨부 (여러 Feature가 참조)
└── index.ts      # core/auth/schema도 re-export (하위 호환)
```

---

## profiles 테이블

거의 모든 Feature가 참조하는 핵심 테이블입니다.

```typescript
export const roles = pgEnum("roles", ["owner", "admin", "editor", "guest"]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").unique().notNull(),
  avatar: text("avatar"),
  role: roles("role").default("editor"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
```

### roles enum

| 값       | 설명          | Admin 접근 |
| -------- | ------------- | ---------- |
| `owner`  | 시스템 소유자 | O          |
| `admin`  | 관리자        | O          |
| `editor` | 일반 사용자   | X          |
| `guest`  | 게스트        | X          |

### Auth 옵션에 따른 profiles.id 처리

- **Better Auth**: `profiles.id` → `users.id` (FK 참조)

---

## files 테이블

여러 Feature에서 첨부파일로 참조할 수 있는 공통 파일 테이블입니다.

```typescript
export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  url: text("url").notNull(),
  uploadedById: uuid("uploaded_by_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type File = typeof files.$inferSelect;
export type NewFile = typeof files.$inferInsert;
```

---

## Import 패턴

```typescript
// Feature에서 Core Auth 스키마 import (권장)
import { profiles, users, roles } from '@repo/core/auth';
import type { Profile, NewProfile, Role } from '@repo/core/auth';

// 또는 core/schema에서 re-export된 버전 (하위 호환)
import { profiles, files } from '@repo/core/schema';

// FK 참조
export const posts = pgTable('blog_posts', {
  authorId: uuid('author_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
});
```



---

Auth 상태 관리 (Jotai atoms, Guard 등)는 `reference/core-modules.md`의 Auth 섹션 참조.

