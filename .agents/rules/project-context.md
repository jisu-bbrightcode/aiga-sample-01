---
description: Product Builder 프로젝트 아키텍처와 핵심 컨벤션. 모든 작업에 적용.
activation: always_on
---

# Product Builder — Project Context

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + React Compiler + Vite + TanStack Router + TanStack Query |
| UI | Tailwind CSS + shadcn/ui (Base-UI 기반, Radix 아님) + Jotai |
| Backend | NestJS 11 + Fastify 5 + Drizzle ORM + tRPC 11 |
| DB | PostgreSQL |
| Auth | Better Auth + JWT |
| Monorepo | Turborepo + pnpm |

## Directory Map

| Path | Description | Port |
|------|------------|------|
| `apps/app` | 일반 유저용 Frontend | 3000 |
| `apps/admin` | Admin 전용 Frontend | 3001 |
| `apps/server` | Backend API Server | 3002 |
| `packages/features` | Server Feature 코드 (NestJS Module, tRPC, Service) |
| `packages/core` | Shared infrastructure (Auth, tRPC, Logger, i18n) |
| `packages/drizzle` | DB 스키마 중앙 관리 |
| `packages/ui` | 공유 UI 컴포넌트 (shadcn/Base-UI) |
| `packages/widgets` | Connected UI 컴포넌트 (tRPC + Auth + UI) |

## Key Conventions

### Naming
- **Files/Directories**: kebab-case (`use-blog-list.ts`, `blog-card.tsx`)
- **Components**: PascalCase Named Export (`export function BlogList()`)
- **Hooks**: camelCase (`export function useBlogList()`)

### Feature Structure
- **Client Feature**: `apps/app/src/features/{name}/` (routes, pages, components, hooks)
- **Server Feature**: `packages/features/{name}/` (module, service, router, controller, dto)
- **Schema**: `packages/drizzle/src/schema/features/{name}/`

### Import Patterns
- Client: `@features/{name}` (path alias)
- Server: `@repo/features/{name}` (workspace)
- UI: `@repo/ui` / `@repo/ui/shadcn/*`
- Core: `@repo/core/auth`, `@repo/core/trpc`

## Rules Reference

상세 규칙은 `docs/rules/` 디렉토리에 있습니다:
- Frontend: `docs/rules/frontend/`
- Backend: `docs/rules/backend/`
- Feature: `docs/rules/feature/`
- Routing: `docs/rules/frontend/client-routing.md`

## Page Layout Pattern

모든 페이지는 Feature → FeatureHeader → FeatureContents 3단 구조:

```tsx
import { Feature, FeatureHeader, FeatureContents } from "@repo/ui";

function SomePage() {
  return (
    <Feature>
      <FeatureHeader title="제목" actions={<Button>액션</Button>} />
      <FeatureContents>
        {/* 메인 콘텐츠 */}
      </FeatureContents>
    </Feature>
  );
}
```

## Critical Rules
- `useMemo`, `useCallback`, `React.memo` 사용 금지 (React Compiler가 자동 처리)
- `useEffect`로 데이터 fetching 금지 (TanStack Query/tRPC 사용)
- 하드코딩 색상 금지 (Semantic Token 사용)
- default export 금지 (Named Export만)
- Base-UI `render` prop 사용 (`asChild` 아님)
