---
description: Centralized Schema Management rules
globs: "packages/drizzle/src/schema/**/*.ts"
alwaysApply: false
---

# Centralized Schema Management

> 스키마 위치, 등록 절차, import 패턴 (Where & How to register)
>
> 네이밍 컨벤션, 컬럼 헬퍼, Relations, JSONB 등 코드 작성 규칙 → `../backend/schema-dev.md` 참조

Atlas는 **모든 DB 스키마를 `packages/drizzle/src/schema/`에서 중앙 관리**합니다.

## 왜 중앙 관리인가?

| 이유                | 설명                                                           |
| ------------------- | -------------------------------------------------------------- |
| **단일 진실 공급원** | 모든 테이블 정의가 한 곳에 위치하여 일관성 보장                |
| **쉬운 관계 관리**   | Feature 간 FK 참조가 명확하고 타입 안전함                      |
| **Migration 단순화** | 모든 스키마가 한 곳에 있어 마이그레이션 생성 및 관리가 용이    |
| **타입 공유 편리**   | 어디서든 `@repo/drizzle`로 import 가능                         |

## 핵심 원칙

| 원칙                  | 설명                                                     |
| --------------------- | -------------------------------------------------------- |
| **단일 진실 공급원**   | 모든 테이블 정의는 `packages/drizzle/src/schema/`에 위치 |
| **Feature에 schema 없음** | `packages/features/{name}/server/schema/` 폴더 사용 안 함 |
| **@repo/drizzle import** | 스키마는 항상 `@repo/drizzle`에서 import                |
| **타입도 중앙 관리**   | DB 타입도 `@repo/drizzle`에서 export됨                   |

## Schema 위치

```
packages/drizzle/src/
├── utils/
│   └── columns.ts           # baseColumns(), timestamps(), softDelete() 헬퍼
├── schema/
│   ├── core/                # Core 스키마
│   │   ├── auth.ts          #   Supabase auth.users 참조
│   │   ├── profiles.ts      #   사용자 프로필
│   │   ├── files.ts         #   파일 첨부
│   │   ├── reviews.ts       #   리뷰
│   │   ├── role-permission/ #   역할/권한 (roles, permissions, role_permissions, user_roles)
│   │   ├── rate-limits.ts   #   Rate Limiting
│   │   └── terms.ts         #   이용약관
│   ├── features/
│   │   ├── blog/
│   │   │   └── index.ts     # Blog Feature 스키마
│   │   ├── community/
│   │   │   └── index.ts     # Community Feature 스키마
│   │   └── {new-feature}/
│   │       └── index.ts     # 새 Feature 스키마
│   └── index.ts             # 모든 스키마 re-export ← 여기에 등록 필수
```

## Import 패턴

```typescript
// ✅ Service, Controller, Router 등에서 import
import { blogPosts, communities } from "@repo/drizzle";
import type { BlogPost, Community } from "@repo/drizzle";

// ✅ 스키마 파일 내부에서 Core 테이블 참조 (상대 경로)
import { profiles } from "../../core/profiles";

// ❌ Feature에서 schema import
import { blogPosts } from "../schema/posts.schema";
import { blogPosts } from "@repo/features/blog/server";

// ❌ 절대 상대 경로로 패키지 외부 접근
import { blogPosts } from "../../../../packages/drizzle/src/schema/blog";
```

## Schema 등록 (2곳 필수)

새 Feature Schema 생성 후 **두 곳** 모두 등록해야 합니다:

### 1. Schema Index re-export

`packages/drizzle/src/schema/index.ts`에 re-export 추가:

```typescript
export * from "./features/{new-feature}";
```

### 2. Drizzle Config tablesFilter

`packages/drizzle/drizzle.config.ts`의 `tablesFilter` 배열에 새 테이블의 **DB 테이블명**을 추가:

```typescript
// packages/drizzle/drizzle.config.ts
tablesFilter: [
  // ... 기존 테이블들 ...
  // features/{name}
  "{prefix}_{entity1}",
  "{prefix}_{entity2}",
]
```

> **주의**: `tablesFilter`에 등록하지 않으면 `drizzle-kit generate` 시 해당 테이블이 무시되어 마이그레이션 파일이 생성되지 않습니다. `pgTable("테이블명", ...)`에서 사용한 DB 테이블명(snake_case)을 정확히 입력해야 합니다.

> **Prefix**: Feature 디렉토리명 또는 도메인 약어. 상세는 `../backend/schema-dev.md`의 "Feature Prefix 규칙" 참조.

## DO / DON'T

```typescript
// ✅ 중앙 스키마 패키지에서 import
import { blogPosts, communities } from "@repo/drizzle";
import type { BlogPost, Community } from "@repo/drizzle";

// ✅ 모든 스키마는 packages/drizzle/src/schema/에 정의
packages/drizzle/src/schema/features/blog/index.ts

// ❌ Feature 내부에 schema/ 폴더 생성하지 않기
packages/features/blog/server/schema/  // 사용 금지

// ❌ Feature가 자체 스키마를 export 하지 않기
export * from "./schema";  // 삭제
```
