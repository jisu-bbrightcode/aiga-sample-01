# packages/widgets 설계

> 서버 데이터와 연결된 재사용 가능한 Connected 컴포넌트 패키지

## 배경

현재 Widget Feature(comment, reaction 등)가 `apps/app/src/features/`에 있어 앱에 종속되어 있다. `system-admin`이나 다른 앱에서 재사용하려면 코드를 복사해야 하는 상황.

| 패키지 | 역할 | 데이터 연결 |
|--------|------|------------|
| `packages/ui` | 순수 UI (Button, Card) | X |
| `packages/widgets` | Connected UI (tRPC + Auth + UI 결합) | O (NEW) |
| `packages/features` | 서버 코드 (Module, Service, Router) | 서버만 |

## 핵심 결정

### 1. Connected 컴포넌트 방식

Widget은 내부에서 tRPC를 직접 호출하는 Connected 컴포넌트. props로 `targetType + targetId`만 전달하면 동작한다.

```tsx
<ReactionSection targetType="blog_post" targetId={post.id} />
```

### 2. useTRPC() 공유 (WidgetProvider 불필요)

`createTRPCContext<AppRouter>()`를 `@repo/features/trpc-client`로 이동하여 모든 패키지에서 같은 `useTRPC()`를 사용한다. 별도의 `WidgetProvider`나 `useWidgetTRPC()` 불필요.

```
                    ┌──────────────────────┐
                    │ @repo/features       │
                    │  trpc-client.ts      │←── useTRPC() 정의
                    │  app-router.ts       │    (AppRouter 타입)
                    └──────┬───────────────┘
                           │ import useTRPC
              ┌────────────┼────────────────┐
              ▼            ▼                ▼
        apps/app    apps/system-admin   packages/widgets
        (TRPCProvider  (TRPCProvider      (useTRPC 직접 사용)
         + Link 설정)   + Link 설정)
```

### 3. Auth는 @repo/core/auth 직접 참조

인증 상태(`authenticatedAtom`, `profileAtom`)는 `@repo/core/auth`에서 직접 import. 별도 주입 불필요.

## 사전 작업: trpc-client.ts 공유

### packages/features/trpc-client.ts (NEW)

```typescript
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "./app-router";

export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCContext<AppRouter>();
```

### apps/app/src/lib/trpc.ts (간소화)

`createTRPCContext` 호출 제거, `@repo/features/trpc-client`에서 re-export.

```typescript
export { TRPCProvider, useTRPC, useTRPCClient } from "@repo/features/trpc-client";

// httpBatchLink 설정은 앱 로컬로 유지
export function createTRPCQueryClient() { ... }
```

`apps/system-admin/src/lib/trpc.ts`도 동일하게 변경.

## 패키지 구조

```
packages/widgets/
├── src/
│   ├── comment/
│   │   ├── comment-section.tsx       # Connected 메인 컴포넌트
│   │   ├── components/
│   │   │   ├── comment-form.tsx
│   │   │   ├── comment-item.tsx
│   │   │   └── comment-list.tsx
│   │   ├── hooks/
│   │   │   └── use-comments.ts       # tRPC Hook (내부용)
│   │   └── index.ts
│   ├── reaction/
│   │   ├── reaction-section.tsx
│   │   ├── components/
│   │   │   ├── reaction-bar.tsx
│   │   │   ├── reaction-button.tsx
│   │   │   └── reaction-count.tsx
│   │   ├── hooks/
│   │   │   └── use-reactions.ts
│   │   └── index.ts
│   └── index.ts
├── package.json
└── tsconfig.json
```

## 의존성

```json
{
  "name": "@repo/widgets",
  "dependencies": {
    "@repo/ui": "workspace:*",
    "@repo/core": "workspace:*",
    "@repo/features": "workspace:*"
  },
  "peerDependencies": {
    "react": "^19",
    "@tanstack/react-query": "^5",
    "jotai": "^2"
  }
}
```

## Widget 내부 코드 패턴

```tsx
// packages/widgets/src/reaction/reaction-section.tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useTRPC } from "@repo/features/trpc-client";
import { authenticatedAtom } from "@repo/core/auth";
import { ReactionBar } from "./components/reaction-bar";

interface ReactionSectionProps {
  targetType: string;
  targetId: string;
  className?: string;
}

export function ReactionSection({ targetType, targetId, className }: ReactionSectionProps) {
  const trpc = useTRPC();
  const isAuthenticated = useAtomValue(authenticatedAtom);

  const countsQuery = useQuery(
    trpc.reaction.getCounts.queryOptions({ targetType, targetId }),
  );
  // ... query/mutation 로직
}
```

## 사용하는 쪽 코드

```tsx
import { ReactionSection } from "@repo/widgets/reaction";
import { CommentSection } from "@repo/widgets/comment";

function BlogDetail({ post }) {
  return (
    <article>
      {post.content}
      <ReactionSection targetType="blog_post" targetId={post.id} />
      <CommentSection targetType="blog_post" targetId={post.id} />
    </article>
  );
}
```

## Widget 작성 규칙

| 규칙 | 설명 |
|------|------|
| tRPC 접근 | `useTRPC()` from `@repo/features/trpc-client` |
| Auth 접근 | `@repo/core/auth` 직접 import |
| UI 컴포넌트 | `@repo/ui` 사용 |
| 메인 export | `{Name}Section` — props는 `targetType + targetId`만 |
| 자기완결적 | Hook + 컴포넌트 모두 Widget 내부에 포함 |
| Provider 불필요 | 앱의 기존 `TRPCProvider` 안에서 동작 |
| 네이밍 | 파일: kebab-case, 컴포넌트: PascalCase |

## Import 패턴

```tsx
// 개별 import (tree-shaking, 권장)
import { CommentSection } from "@repo/widgets/comment";
import { ReactionSection } from "@repo/widgets/reaction";

// 전체 import
import { CommentSection, ReactionSection } from "@repo/widgets";
```

## 마이그레이션 범위

설계만 우선 진행. 기존 코드 이동은 별도 작업으로:

- [ ] comment 이동 (`apps/app/src/features/comment/` → `packages/widgets/src/comment/`)
- [ ] reaction 이동 (`apps/app/src/features/reaction/` → `packages/widgets/src/reaction/`)
- [ ] review 이동
- [ ] 기타 Widget Feature 이동
