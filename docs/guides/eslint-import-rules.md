---
description: ESLint import path rules and module boundary enforcement
globs: "**/*.ts, **/*.tsx"
alwaysApply: false
---

# ESLint Import 규칙

> Feature의 Server/Client 코드 분리를 강제하는 ESLint 설정

---

## 개요

Server Feature와 Client Feature가 **각각의 App에 분리**되어 있으므로, 기본적으로 빌드 시점에서 격리됩니다.

| 구조                                      | 설명                   |
| ----------------------------------------- | ---------------------- |
| `apps/server/src/features/{name}/`  | Server Feature (NestJS) |
| `apps/app/src/features/{name}/`           | Client Feature (React)  |

단, **같은 App 내 Feature 간 import**는 허용되며, **다른 App의 Feature import는 물리적으로 불가능**합니다.

---

## 필수 패키지

```bash
pnpm add -D eslint-plugin-import eslint-plugin-boundaries
```

---

## apps/server ESLint 설정

Server에서는 React 관련 패키지와 Client 코드를 금지합니다.

```javascript
// apps/server/eslint.config.js
import boundaries from "eslint-plugin-boundaries";

export default [
  {
    plugins: {
      boundaries,
    },
    settings: {
      "boundaries/elements": [
        { type: "server-feature", pattern: "src/features/**" },
        { type: "core", pattern: "@repo/core/**" },
        { type: "drizzle", pattern: "@repo/drizzle/**" },
      ],
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react-dom", "@tanstack/react-*", "jotai"],
              message: "Server에서 React 관련 패키지 import 금지",
            },
            {
              group: ["@repo/ui", "@repo/ui/**"],
              message: "Server에서 UI 패키지 import 금지",
            },
          ],
        },
      ],

      // Server Feature 간 import 허용
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            {
              from: "server-feature",
              allow: ["server-feature", "core", "drizzle"],
            },
          ],
        },
      ],
    },
  },
];
```

---

## apps/app ESLint 설정

Client에서는 NestJS, Drizzle 등 Server 전용 패키지를 금지합니다.

```javascript
// apps/app/eslint.config.js
import boundaries from "eslint-plugin-boundaries";

export default [
  {
    plugins: {
      boundaries,
    },
    settings: {
      "boundaries/elements": [
        { type: "client-feature", pattern: "src/features/**" },
        { type: "ui", pattern: "@repo/ui/**" },
        { type: "core", pattern: "@repo/core/**" },
      ],
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@nestjs/*", "@nestjs/**"],
              message: "Client에서 NestJS 패키지 import 금지",
            },
            {
              group: ["drizzle-orm", "drizzle-orm/**", "@repo/drizzle", "@repo/drizzle/**"],
              message: "Client에서 Drizzle 패키지 import 금지",
            },
            {
              group: ["@trpc/server", "@trpc/server/**"],
              message: "Client에서 tRPC Server 패키지 import 금지 (@trpc/client 사용)",
            },
          ],
        },
      ],

      // Client Feature 간 import 허용
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            {
              from: "client-feature",
              allow: ["client-feature", "ui", "core"],
            },
          ],
        },
      ],
    },
  },
];
```

---

## 간단한 대안: no-restricted-imports만 사용

`eslint-plugin-boundaries` 없이 기본 ESLint만으로도 가능:

```javascript
// apps/server/eslint.config.js
export default [
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react-dom", "@tanstack/react-*"],
              message: "Server에서 React 관련 패키지 import 금지",
            },
          ],
        },
      ],
    },
  },
];
```

```javascript
// apps/app/eslint.config.js
export default [
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@nestjs/*", "drizzle-orm", "@trpc/server"],
              message: "Client에서 Server 전용 패키지 import 금지",
            },
          ],
        },
      ],
    },
  },
];
```

---

## Feature 간 Import 규칙

### 같은 App 내 Feature Import

`@features/{name}` alias를 사용하여 같은 App 내 다른 Feature를 import 합니다.

```typescript
// apps/app/src/features/blog/pages/blog-detail.tsx
import { ReactionButton } from "@features/reaction";
import { CommentSection } from "@features/comment";
```

```typescript
// apps/server/src/features/comment/service/comment.service.ts
import { ProfilesService } from "@features/profiles";
```

### Core 패키지 Import

모든 Feature에서 Core 패키지를 import 할 수 있습니다.

```typescript
// Server Feature
import { profiles } from "@repo/core/schema";
import { AdminGuard } from "@repo/core/auth";
import { router, publicProcedure } from "@repo/core/trpc";

// Client Feature
import { sessionAtom, profileAtom } from "@repo/core/auth";
import { useFeatureTranslation } from "@repo/core/i18n";
```

---

## TypeScript 타입 전용 Import

`import type`은 런타임에 제거되므로 허용됩니다:

```typescript
// apps/app에서 Server 타입만 import (빌드 시 제거됨)
import type { Post, Comment } from "@repo/shared/types";

// 타입 안전한 tRPC 호출을 위한 타입 import
import type { TrpcRouter } from "../../server/src/trpc";
```

ESLint로 타입 import 일관성 강제:

```javascript
// eslint.config.js
{
  rules: {
    '@typescript-eslint/consistent-type-imports': ['error', {
      prefer: 'type-imports',
      fixStyle: 'separate-type-imports',
    }],
  },
}
```

---

## CI에서 검증

```yaml
# .github/workflows/lint.yml
name: Lint

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4

      - run: pnpm install
      - run: pnpm lint

      # Import 규칙 위반 시 실패
      - name: Check import boundaries
        run: |
          pnpm --filter server lint
          pnpm --filter app lint
```

---

## 에러 메시지 예시

```
error  'Server에서 React 관련 패키지 import 금지'
       no-restricted-imports

  1 | import { useState } from 'react';
    |          ^^^^^^^^

error  'Client에서 NestJS 패키지 import 금지'
       no-restricted-imports

  1 | import { Injectable } from '@nestjs/common';
    |          ^^^^^^^^^^
```

---

## 권장 설정 요약

| 위치                                     | 허용 import                         | 금지 import                           |
| ---------------------------------------- | ----------------------------------- | ------------------------------------- |
| `apps/server/src/features/`        | `@features/*`, `@repo/core`, `@repo/drizzle` | `react`, `@repo/ui`                   |
| `apps/app/src/features/`                 | `@features/*`, `@repo/core`, `@repo/ui`      | `@nestjs/*`, `drizzle-orm`            |

---

## 의존성 계층 구조

```
┌─────────────────────────────────────────────────────────────┐
│                        apps/                                │
│   apps/app (Frontend)          apps/server (Backend)  │
│   └── src/features/            └── imports @repo/features   │
└─────────────┬───────────────────────────┬──────────────────┘
              │                           │
              │                           ▼
              │                ┌──────────────────────┐
              │                │   packages/features   │
              │                └──────────┬────────────┘
              ▼                           ▼
┌──────────────────────────────────────────────────────┐
│                    packages/core                      │
└─────────────────────────┬────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────┐
│   packages/shared    packages/ui    packages/drizzle  │
└──────────────────────────────────────────────────────┘
```

### 패키지별 규칙 요약

| 패키지 | 허용 | 금지 |
|--------|------|------|
| `apps/app` | `@features/*`, `@repo/core`, `@repo/ui`, `@repo/shared` | `apps/server`, `@repo/features` |
| `apps/server` | `@repo/features/*`, `@repo/core`, `@repo/drizzle` | `apps/app`, Client Feature 코드 |
| `packages/features` | `@repo/core`, `@repo/drizzle`, `@repo/shared`, 다른 Server Feature | `apps/*`, Client Feature |
| `packages/core` | `@repo/shared`, 외부 라이브러리 | `apps/*`, Feature 코드 |
| `packages/shared`, `packages/ui` | 외부 라이브러리만 | `@repo/core`, `apps/*` |

### tRPC type-only Import 규칙

tRPC 타입 안전성을 위해 Server Router 타입을 Client에서 참조하는 것이 유일한 예외:

```typescript
// ✅ 타입만 import (빌드에 포함 안됨)
import type { TrpcRouter } from "../../../server/src/trpc";

// ❌ 금지 - 런타임 코드 import
import { trpcRouter } from "../../../server/src/trpc";
```

---

## 의존성 검증 명령어

```bash
# Server 빌드 (React 관련 에러 없어야 함)
pnpm --filter server build

# Client 빌드 (NestJS 관련 에러 없어야 함)
pnpm --filter app build

# 전체 타입 체크
pnpm typecheck
```

---

## 관련 문서

- [feature/dependencies.md](./feature/dependencies.md) - Feature Import/Export 규칙
- [backend/naming-dto.md](./backend/naming-dto.md) - Backend 네이밍 & DTO 규칙
- [backend/swagger.md](./backend/swagger.md) - Swagger/OpenAPI & 모듈 규칙
- [backend/drizzle.md](./backend/drizzle.md) - Drizzle ORM 규칙 & 스키마 패턴
- [backend/naming-dto.md](./backend/naming-dto.md) - 네이밍 컨벤션 (Frontend & Backend)
