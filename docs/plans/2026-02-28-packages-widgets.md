# packages/widgets 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 서버 데이터와 연결된 재사용 가능한 Connected 컴포넌트 패키지(`@repo/widgets`)를 생성하고, 이를 위한 공유 tRPC Context 인프라를 구축한다.

**Architecture:** `createTRPCContext<AppRouter>()`를 `packages/features/trpc-client.ts`로 공유하여 모든 패키지에서 동일한 `useTRPC()`를 사용. Widget은 별도 Provider 없이 앱의 기존 `TRPCProvider` 안에서 동작한다.

**Tech Stack:** tRPC v11, TanStack Query v5, React 19, Jotai, Turborepo workspace

**Design Doc:** `docs/plans/2026-02-28-packages-widgets-design.md`

---

### Task 1: 공유 tRPC Context 생성

**Files:**
- Create: `packages/features/trpc-client.ts`
- Modify: `packages/features/package.json` (exports 추가)

**Step 1: `packages/features/trpc-client.ts` 생성**

```typescript
// packages/features/trpc-client.ts
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "./app-router";

export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCContext<AppRouter>();
```

**Step 2: `packages/features/package.json`에 export 추가**

`exports` 객체에 추가:
```json
"./trpc-client": "./trpc-client.ts"
```

**Step 3: 타입 체크**

Run: `cd packages/features && pnpm tsc --noEmit`
Expected: 에러 없음

**Step 4: Commit**

```bash
git add packages/features/trpc-client.ts packages/features/package.json
git commit -m "feat: 공유 tRPC Context 생성 (packages/features/trpc-client)"
```

---

### Task 2: apps/app tRPC 클라이언트 마이그레이션

**Files:**
- Modify: `apps/app/src/lib/trpc.ts`

**Step 1: `apps/app/src/lib/trpc.ts` 수정**

`createTRPCContext` 호출을 제거하고 공유 모듈에서 re-export. `createTRPCClient`, `httpBatchLink`, `getAuthHeaders`, `createTRPCQueryClient`는 앱 로컬로 유지.

```typescript
// apps/app/src/lib/trpc.ts
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { TOKEN_STORAGE_KEY } from "@repo/core/auth";
import { getSessionHeaders } from "@repo/core/logger/client";
import type { AppRouter } from "@repo/features/app-router";

// 공유 tRPC Context에서 re-export
export { TRPCProvider, useTRPC, useTRPCClient } from "@repo/features/trpc-client";

import { env } from "./env";

export const API_URL = env.VITE_API_URL ?? "http://localhost:3002";
const TRPC_URL = `${API_URL}/trpc`;

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    const token = raw ? JSON.parse(raw) : null;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // ignore parse errors
  }

  Object.assign(headers, getSessionHeaders());

  return headers;
}

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: TRPC_URL,
      headers: getAuthHeaders,
    }),
  ],
});

export function createTRPCQueryClient() {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: TRPC_URL,
        headers: getAuthHeaders,
      }),
    ],
  });
}
```

**Step 2: 타입 체크**

Run: `cd apps/app && pnpm tsc --noEmit`
Expected: 에러 없음. `useTRPC`, `TRPCProvider`가 re-export로 동일한 타입 유지.

**Step 3: Commit**

```bash
git add apps/app/src/lib/trpc.ts
git commit -m "refactor(app): useTRPC를 공유 trpc-client에서 re-export"
```

---

### Task 3: apps/system-admin tRPC 클라이언트 마이그레이션

**Files:**
- Modify: `apps/system-admin/src/lib/trpc.ts`

**Step 1: `apps/system-admin/src/lib/trpc.ts` 수정**

Task 2와 동일한 패턴. `createTRPCContext` 제거, 공유 모듈에서 re-export.

```typescript
// apps/system-admin/src/lib/trpc.ts
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { TOKEN_STORAGE_KEY } from "@repo/core/auth";
import { getSessionHeaders } from "@repo/core/logger/client";
import type { AppRouter } from "@repo/features/app-router";

// 공유 tRPC Context에서 re-export
export { TRPCProvider, useTRPC, useTRPCClient } from "@repo/features/trpc-client";

import { env } from "./env";

export const API_URL = env.VITE_API_URL ?? "http://localhost:3002";
const TRPC_URL = `${API_URL}/trpc`;

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    const token = raw ? JSON.parse(raw) : null;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // ignore parse errors
  }

  Object.assign(headers, getSessionHeaders());

  return headers;
}

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: TRPC_URL,
      headers: getAuthHeaders,
    }),
  ],
});

export function createTRPCQueryClient() {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: TRPC_URL,
        headers: getAuthHeaders,
      }),
    ],
  });
}
```

**Step 2: 타입 체크**

Run: `cd apps/system-admin && pnpm tsc --noEmit`
Expected: 에러 없음

**Step 3: Commit**

```bash
git add apps/system-admin/src/lib/trpc.ts
git commit -m "refactor(system-admin): useTRPC를 공유 trpc-client에서 re-export"
```

---

### Task 4: packages/widgets 패키지 스캐폴드 생성

**Files:**
- Create: `packages/widgets/package.json`
- Create: `packages/widgets/tsconfig.json`
- Create: `packages/widgets/src/index.ts`

**Step 1: `packages/widgets/package.json` 생성**

```json
{
  "name": "@repo/widgets",
  "version": "0.0.0",
  "private": true,
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "eslint . --max-warnings 0",
    "check-types": "tsc --noEmit"
  },
  "dependencies": {
    "@repo/ui": "workspace:*",
    "@repo/core": "workspace:*",
    "@repo/features": "workspace:*"
  },
  "peerDependencies": {
    "@tanstack/react-query": "^5.0.0",
    "jotai": "^2.0.0",
    "react": "^19.0.0"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@types/react": "19.2.2",
    "eslint": "^9.39.1",
    "typescript": "5.9.2"
  }
}
```

**Step 2: `packages/widgets/tsconfig.json` 생성**

```json
{
  "extends": "@repo/typescript-config/react-library.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@repo/ui/shadcn/*": ["../ui/src/_shadcn/*"],
      "@repo/ui/components/*": ["../ui/src/components/*"],
      "@repo/ui/lib/*": ["../ui/src/lib/*"],
      "@repo/ui/hooks/*": ["../ui/src/hooks/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: `packages/widgets/src/index.ts` 생성**

```typescript
// @repo/widgets — Connected UI 컴포넌트
// Widget이 추가되면 여기서 re-export
```

**Step 4: pnpm install로 워크스페이스 링크**

Run: `pnpm install`
Expected: `@repo/widgets`가 워크스페이스에 등록됨

**Step 5: 타입 체크**

Run: `cd packages/widgets && pnpm tsc --noEmit`
Expected: 에러 없음

**Step 6: Commit**

```bash
git add packages/widgets/
git commit -m "feat: packages/widgets 패키지 스캐폴드 생성"
```

---

### Task 5: Widget 개발 규칙 문서 작성

**Files:**
- Create: `.claude/rules/frontend/widgets.md`

**Step 1: Widget 규칙 문서 작성**

```markdown
# Widget Rules

> `packages/widgets` — 서버 데이터와 연결된 재사용 가능한 Connected 컴포넌트

---

## 포지셔닝

| 패키지 | 역할 | 데이터 연결 |
|--------|------|------------|
| `packages/ui` | 순수 UI (Button, Card) | X |
| `packages/widgets` | Connected UI (tRPC + Auth + UI 결합) | O |
| `packages/features` | 서버 코드 (Module, Service, Router) | 서버만 |

---

## Widget 디렉토리 구조

```
packages/widgets/src/{widget-name}/
├── {widget-name}-section.tsx     # Connected 메인 컴포넌트
├── components/                   # 내부 presentational 컴포넌트
│   ├── {name}-form.tsx
│   ├── {name}-item.tsx
│   └── {name}-list.tsx
├── hooks/
│   └── use-{widget-name}.ts     # tRPC Hook (내부용)
└── index.ts                     # Public exports
```

---

## 의존성 접근 규칙

| 의존성 | 접근 방법 |
|--------|----------|
| tRPC | `useTRPC()` from `@repo/features/trpc-client` |
| Auth 상태 | `@repo/core/auth` 직접 import |
| UI 컴포넌트 | `@repo/ui` 사용 |

---

## Widget 작성 패턴

### 메인 컴포넌트 (Connected)

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useTRPC } from "@repo/features/trpc-client";
import { authenticatedAtom } from "@repo/core/auth";

interface {Name}SectionProps {
  targetType: string;
  targetId: string;
  className?: string;
}

export function {Name}Section({ targetType, targetId, className }: {Name}SectionProps) {
  const trpc = useTRPC();
  const isAuthenticated = useAtomValue(authenticatedAtom);

  // tRPC query/mutation 로직
  // 내부 presentational 컴포넌트 렌더링
}
```

### 규칙

| 규칙 | 설명 |
|------|------|
| 메인 export | `{Name}Section` — props는 `targetType + targetId` 최소 인터페이스 |
| 자기완결적 | Hook + 컴포넌트 모두 Widget 내부에 포함 |
| Provider 불필요 | 앱의 기존 `TRPCProvider` 안에서 동작 |
| 네이밍 | 파일: kebab-case, 컴포넌트: PascalCase |
| `@/lib/trpc` import 금지 | `@repo/features/trpc-client` 사용 |

---

## Import 패턴

```typescript
// 개별 import (tree-shaking, 권장)
import { CommentSection } from "@repo/widgets/comment";
import { ReactionSection } from "@repo/widgets/reaction";

// 전체 import
import { CommentSection, ReactionSection } from "@repo/widgets";
```

---

## 새 Widget 추가 절차

1. `packages/widgets/src/{name}/` 디렉토리 생성
2. 메인 Connected 컴포넌트 작성 (`{name}-section.tsx`)
3. 내부 presentational 컴포넌트 작성 (`components/`)
4. tRPC Hook 작성 (`hooks/use-{name}.ts`)
5. `index.ts`에서 public export
6. `packages/widgets/package.json`의 `exports`에 추가: `"./{name}": "./src/{name}/index.ts"`
7. `packages/widgets/src/index.ts`에서 re-export
```

**Step 2: Commit**

```bash
git add .claude/rules/frontend/widgets.md
git commit -m "docs: Widget 개발 규칙 문서 추가"
```

---

### Task 6: 전체 타입 체크 및 최종 검증

**Step 1: 전체 워크스페이스 타입 체크**

Run: `pnpm check-types` (루트)
또는 개별:
```bash
cd packages/features && pnpm tsc --noEmit
cd packages/widgets && pnpm tsc --noEmit
cd apps/app && pnpm tsc --noEmit
cd apps/system-admin && pnpm tsc --noEmit
```
Expected: 모든 패키지 에러 없음

**Step 2: 기존 앱 동작 확인**

- `apps/app`에서 `useTRPC()` import가 기존과 동일하게 동작하는지 확인
- re-export 경로 변경이 외부 API를 변경하지 않았는지 확인

**Step 3: 레퍼런스 문서 업데이트**

- `docs/reference/` 관련 문서에 `@repo/widgets` 패키지 추가
- `.claude/rules/architecture.md`의 Packages 테이블에 widgets 행 추가

**Step 4: 최종 Commit**

```bash
git add .
git commit -m "docs: 레퍼런스 문서에 @repo/widgets 패키지 반영"
```
