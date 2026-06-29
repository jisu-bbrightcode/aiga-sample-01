---
description: REST/OpenAPI 클라이언트 사용 규칙 (Query, Mutation, 캐시 무효화)
globs: "apps/app/**/*.ts, apps/app/**/*.tsx, apps/admin/**/*.ts, apps/admin/**/*.tsx"
alwaysApply: false
---

# REST Client Rules

> OpenAPI generated client + TanStack Query v5 기반 클라이언트 데이터 관리 규칙

## 1. 클라이언트 설정

| 항목 | 설명 |
|------|------|
| 타입 소스 | `packages/api-client/src/schema.d.ts` |
| 런타임 client | `packages/api-client`의 `apiClient` / app-local wrapper |
| Query | `useQuery` / generated query options |
| Mutation | `useMutation` / generated mutation function |
| 인증 헤더 | app/admin의 auth header helper를 통해 주입 |

## 2. Query

```ts
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/projects");
      if (error) throw error;
      return data;
    },
  });
}
```

규칙:

- Query 로직은 `use-{feature}-queries.ts`에 래핑한다.
- 컴포넌트에서 REST 호출을 직접 만들지 않는다.
- 조건부 쿼리는 `enabled`로 제어한다.
- `useEffect` 데이터 fetching은 금지한다.

## 3. Mutation

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateProjectInput) => {
      const { data, error } = await apiClient.POST("/api/projects", { body });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
```

규칙:

- Mutation 로직은 `use-{feature}-mutations.ts`에 래핑한다.
- 변경 성공 후 관련 queryKey를 명시적으로 invalidate 한다.
- raw server/provider error message를 UI에 직접 표시하지 않는다.
- 사용자 노출 에러는 app/widget error helper의 code mapping을 사용한다.

## 4. Hook 파일 구조

```
features/{name}/hooks/
├── use-{name}-queries.ts
├── use-{name}-mutations.ts
└── use-{name}.ts
```

## 5. 금지 사항

| 금지 | 대안 |
|------|------|
| 컴포넌트에서 직접 API 호출 | 커스텀 Hook으로 래핑 |
| `useEffect`로 데이터 fetching | `useQuery` / `useMutation` |
| raw `fetch` string literal 난립 | generated REST client |
| raw `error.message` 렌더링 | stable error code mapping |
| Mutation 후 캐시 무효화 누락 | `onSuccess`에서 query invalidation |
