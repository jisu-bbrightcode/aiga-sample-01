---
description: Frontend 컴포넌트, Hook, 상태관리 패턴. TSX/TS 파일 작업 시 적용.
activation: glob
glob: "**/*.tsx,**/*.ts"
---

# Frontend Patterns

## Component Rules

### File Section Order
1. Props interface + 메인 컴포넌트
2. `/* Constants */`
3. `/* Components */` — 하위 컴포넌트 (내부 정의 금지, 파일 하단에 분리)
4. `/* Hooks */`
5. `/* Helpers */`
6. `/* Types */`

### Rendering
- 조건부 렌더링: 삼항 연산자 사용 (`&&` 금지 — falsy 값 렌더링 방지)
- 리스트 key: `id` 등 안정적 식별자 (`index` 금지)
- `cn()` 유틸리티로 className 병합

## State Management

| 분류 | 도구 | 용도 |
|------|------|------|
| Server State | TanStack Query (tRPC) | 서버 데이터 캐시 |
| Client State | Jotai | 전역 UI 상태 (모달, 사이드바) |
| Form State | React Hook Form + Zod | 폼 입력/검증 |
| URL State | TanStack Router | search params |
| Local State | useState | 컴포넌트 한정 |

### 금지
- 서버 데이터를 Jotai에 저장 (→ TanStack Query)
- URL 상태를 Jotai에 저장 (→ Router search params)
- `useEffect`로 state 동기화 (→ 이벤트 핸들러에서 직접)

## tRPC Client Pattern

```tsx
// hooks/use-blog-queries.ts
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";

export function useBlogs() {
  const trpc = useTRPC();
  return useQuery(trpc.blog.list.queryOptions());
}
```

```tsx
// hooks/use-blog-mutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";

export function useCreateBlog() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.blog.create.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.blog.list.queryKey() });
    },
  });
}
```

**규칙**: 컴포넌트에서 `useTRPC()` 직접 호출 금지 → 커스텀 Hook으로 래핑 필수

## Route Creation Pattern

```tsx
// routes/blog-list.tsx
import { createRoute } from "@tanstack/react-router";
import type { AnyRoute } from "@tanstack/react-router";

export const createBlogListRoute = <T extends AnyRoute>(parentRoute: T) =>
  createRoute({
    getParentRoute: () => parentRoute,
    path: "/blog",
    component: BlogListPage,
  });

// routes/index.ts
export function createBlogRoutes<T extends AnyRoute>(parentRoute: T) {
  return [createBlogListRoute(parentRoute), createBlogDetailRoute(parentRoute)];
}
```

## Base-UI Pattern (중요!)

이 프로젝트는 Radix UI가 아닌 **Base-UI** 기반입니다.

```tsx
// ✅ Base-UI — render prop 사용
<SidebarMenuButton render={<Link to="/blog" />}>
  <FileText />
  <span>블로그</span>
</SidebarMenuButton>

// ❌ Radix — asChild 사용 안 함
<SidebarMenuButton asChild>
  <Link to="/blog">...</Link>
</SidebarMenuButton>
```

## Structure-First Loading (데이터 시각화 필수)

리스트, 보드, 테이블 등은 구조를 먼저 렌더링하고 데이터 영역만 로딩 표시:

```tsx
function TaskBoard() {
  const { data, isLoading } = useTasks();
  return (
    <div className="flex gap-3">
      {STATUS_ORDER.map((status) => (
        <BoardColumn key={status} status={status}
          tasks={isLoading ? [] : columns[status]}
          isLoading={isLoading} />
      ))}
    </div>
  );
}
```

## i18n Pattern

```tsx
import { useFeatureTranslation } from "@repo/core/i18n";

function Component() {
  const { t } = useFeatureTranslation("blog");
  return <h1>{t("blogListTitle")}</h1>;
}
```

번역 파일: `apps/app/src/features/{name}/locales/ko.json`, `en.json`
