---
description: Feature Implementation & Modification Guide
globs: "apps/*/src/features/**/*, packages/features/**/*"
alwaysApply: false
---

# Feature Development Rules

Feature를 생성하거나 수정할 때 이 파일을 먼저 읽고, 해당 단계의 상세 규칙 파일을 참조합니다.

## 조건부 참조 문서 (필요 시 읽기)

| 문서 | 위치 | 사용 시점 |
|------|------|----------|
| Agent Feature 규칙 | `.claude/docs/agent/` | Agent Feature 작업 시 |
| 모바일 프로세스 가이드 | `.claude/docs/feature/mobile-process-guide.md` | 모바일 wizard flow 작업 시 |
| Unit Test 규칙 | `.claude/docs/testing.md` | 테스트 작성 시 |

## 관련 Rule 파일

| 파일 | 주제 |
|------|------|
| `definition.md` | Feature 유형 (Page/Widget/Agent) 및 디렉토리 구조 |
| `widget.md` | Widget Feature 규칙 — `packages/widgets` Connected Component 패턴 |
| `isolation.md` | 다른 Feature 수정 금지 원칙 |
| `dependencies.md` | Import/Export 규칙, 의존성 해결 |
| `schema.md` | 중앙 집중 스키마 관리 |
| `provider-env.md` | Product Builder 템플릿용 optional provider env/route gating |
| `steps.md` | 구현 단계별 워크플로우 + 체크리스트 |

## Agent Feature 규칙

Agent Feature(LLM 스트리밍, Tool 호출)는 추가 규칙을 따릅니다:

| 파일 | 주제 |
|------|------|
| `../../docs/agent/README.md` | Agent Feature 개요, 표준 Feature와의 구분 |
| `../../docs/agent/agent-server.md` | Hono 서버 패턴 (라우트, 서비스, 미들웨어) |
| `../../docs/agent/streaming.md` | SSE 스트리밍 (서버 + 클라이언트 Hook) |
| `../../docs/agent/ai-sdk.md` | Vercel AI SDK (streamText, Model Registry) |
| `../../docs/agent/tool-definition.md` | AI Tool 정의 (네이밍, 레지스트리) |

## 관련 코딩 규칙

| 영역 | 파일 |
|------|------|
| Backend | `../backend/naming-dto.md`, `../backend/api-strategy.md`, `../backend/swagger.md` |
| Frontend | `../frontend/react-component.md`, `../frontend/rest-client.md`, `../frontend/state-management.md` |

## Workflow

> **유형 판별**: `definition.md`의 "Feature Types > 유형 판별 기준"에서 Page / Widget / Agent 유형을 먼저 결정한다.

| 유형 | 규칙 참조 | 구현 단계 |
|------|----------|----------|
| **Page Feature** | `definition.md` → `isolation.md` | `steps.md` Phase 1~4 |
| **Widget Feature** | `definition.md` → `widget.md` | `steps.md` Phase 1~1.5 + 2W~2.5W |
| **Agent Feature** | `definition.md` → `../../docs/agent/README.md` | `steps.md` Phase 1~4 + 1.5A/2A |

## Critical Rules

- **Client/Server 분리**: Client는 `apps/app/` (Page) 또는 `packages/widgets/` (Widget), Server는 `packages/features/`
- **Schema 위치**: `packages/drizzle/src/schema/features/{name}/`
- **Import (Page)**: `@features/{name}` (Client), `@repo/features/{name}` (Server)
- **Import (Widget)**: `@repo/widgets/{name}` (Client), `@repo/features/{name}` (Server)
- **Export**: `index.ts`에서 필요한 것만 export
- **Optional Provider**: 새 프로젝트 복제 시 기본 disabled. `{FEATURE}_ENABLED=true` + placeholder 없는 strict env일 때만 route/module 등록

## Agent Automation Rules

"Install a feature", "Create a feature", "Connect a feature" 요청 시:

1. **Read Rules**: `docs/rules/feature/README.md` → 관련 규칙 참조
2. **Reference Check**: `docs/reference/`에서 기존 모듈/서비스 확인
3. **Provider Check**: 외부 provider/env feature면 `docs/rules/feature/provider-env.md` 적용
4. **Implement**: `docs/rules/feature/steps.md` 순서대로 실행
5. **Verify**: `docs/rules/feature/steps.md` (Phase 3~4 체크리스트) + `docs/rules/runtime-verification.md`
6. **Update Docs**: `docs/reference/` 관련 문서 갱신
