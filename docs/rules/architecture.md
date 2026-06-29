---
description: System Architecture and Documentation Guide
globs: "**/*.md"
alwaysApply: true
---

# Architecture & Documentation

## Directory Map

### Apps

| App | 설명 | 기술 스택 | 포트 |
|-----|------|----------|------|
| `apps/app` | Frontend — 일반 유저용 | Vite + React + TanStack Router | 3000 |
| `apps/admin` | Frontend — Admin 전용 | Vite + React + TanStack Router | 3001 |
| `apps/server` | Backend API 서버 | NestJS + Fastify | 3002 |
| `apps/agent-server` | AI Agent 서버 | Hono + tsx | - |

### Packages

| Package | 설명 |
|---------|------|
| `packages/features` | Server Feature 코드 (NestJS Module, REST Controller, Service, DTO) |
| `packages/core` | Shared infrastructure (Auth, Logger, i18n) |
| `packages/drizzle` | DB 스키마 중앙 관리 (Drizzle ORM) |
| `packages/ui` | 공유 UI 컴포넌트 (shadcn/Base-UI) |

## Rules Structure (`docs/rules/`)

- `feature/`: Feature 구현 규칙 (정의, 격리, 의존성, 스키마, 단계, 체크리스트, 레지스트리).
- `agent/`: Agent Feature 규칙 (Hono 서버, SSE 스트리밍, AI SDK, Tool 정의).
- `backend/`: 백엔드 코딩 규칙 (NestJS, Drizzle, Swagger/OpenAPI, REST, Auth, Service).
- `frontend/`: 프론트엔드 코딩 규칙 (네이밍, 컴포넌트, Base-UI, Admin, i18n, 라우팅).
- `shared/`: 에러 핸들링, 환경 설정.
- `reference/`: 코드베이스 인덱스 (작업 전 참조, 작업 후 업데이트 필수).

## Supplementary Docs (`docs/`)

- `docs/templates/`: Issue/README 템플릿.
- `docs/guides/`: Step-by-step 가이드 (설치, 테스트, Agent 체크리스트).
- `docs/reference/`: 코드베이스 인덱스.

## Rules

Always refer to `docs/rules/backend/naming-dto.md` for naming conventions (Frontend & Backend).
