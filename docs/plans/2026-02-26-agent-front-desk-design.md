# Agent Front Desk (에이전트 프론트 데스크) — 설계 문서

> **작성일**: 2026-02-26
> **상태**: 승인됨
> **접근법**: 단일 Feature + 모드 전환 (접근법 A)

---

## 1. 개요

### 목적

Product Builder의 기존 features를 활용하여 새 서비스를 생성하고, 부족한 기능을 식별/구현하는 메타 도구.

### 두 가지 사용자

| 구분 | 고객(Customer) | 운영자(Operator) |
|------|---------------|-----------------|
| **입력** | 파일(PPTX, PDF, 이미지, MD, TXT) + 에이전트 대화 | 동일 |
| **분석** | LLMService로 요구사항 추출 → Feature 매칭 | LLMService로 gap 분석 |
| **리포트** | 있는 기능 / 없는 기능 분류 | 없는 기능 + 구현 프롬프트 정리 |
| **출력** | 스펙 파일(JSON) → `apps/projects/{서비스명}` 앱 생성 | Claude Code CLI 실행으로 코드 구현 |
| **관계** | 독립 운영 | 독립 운영 |
| **위치** | 둘 다 `apps/app` | |

### 미래 비전

- 현재: 기존 features 조합 → 설정/구성 파일로 서비스 생성
- 미래: features/UI 충분히 축적 → Product Builder 복제한 독립 앱 생성

---

## 2. 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    apps/app (port 3000)                      │
│  ┌──────────────────────┐  ┌──────────────────────────────┐ │
│  │   고객용 화면         │  │   운영자용 화면               │ │
│  │  /agent-desk          │  │  /agent-desk/operator         │ │
│  │                       │  │                               │ │
│  │ 에이전트 대화 + 파일  │  │ 에이전트 대화 + 파일          │ │
│  │ 분석 리포트 확인      │  │ Gap 분석 리포트               │ │
│  │ 스펙 조정/확정        │  │ 구현 프롬프트 편집            │ │
│  │ 프로젝트 생성         │  │ Claude Code 실행/모니터링     │ │
│  └──────────┬───────────┘  └──────────────┬───────────────┘ │
│             │ tRPC                         │ tRPC            │
└─────────────┼─────────────────────────────┼─────────────────┘
              │                             │
┌─────────────┼─────────────────────────────┼─────────────────┐
│             ▼     server (port 3002) ▼                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              AgentDeskModule                             ││
│  │                                                         ││
│  │  FileParserService      ─── 파일 파싱 (PPTX/PDF/IMG/…) ││
│  │  FeatureAnalyzerService ─── Feature 레지스트리 매칭      ││
│  │  SpecGeneratorService   ─── 프로젝트 스펙 JSON 생성     ││
│  │  ProjectScaffoldService ─── apps/projects/ 앱 생성      ││
│  │  ClaudeExecutorService  ─── Claude Code CLI subprocess  ││
│  │  AnalysisSessionService ─── 분석 세션/대화/상태 관리    ││
│  └─────────────────────────────────────────────────────────┘│
│                        │                                     │
│                  LLMService (기존 AI feature, 고도화)        │
└──────────────────────────────────────────────────────────────┘
              │
              ▼
    apps/projects/{서비스명}/   ← 생성된 프로젝트
```

### 핵심 서비스 역할

| Service | 역할 | 공유 |
|---------|------|------|
| `FileParserService` | PPTX, PDF, 이미지, MD, TXT → 구조화된 텍스트 추출 | 고객+운영자 |
| `FeatureAnalyzerService` | 추출된 텍스트 + Feature 레지스트리 → 매칭/gap 분석 | 고객+운영자 |
| `SpecGeneratorService` | 분석 결과 → 프로젝트 스펙 JSON 생성 | 고객 전용 |
| `ProjectScaffoldService` | 스펙 JSON → `apps/projects/{name}` 앱 scaffold | 고객 전용 |
| `ClaudeExecutorService` | 구현 프롬프트 → Claude Code CLI subprocess 실행 | 운영자 전용 |
| `AnalysisSessionService` | 세션/대화/파일 CRUD, 상태 머신 관리 | 고객+운영자 |

### 라우트 구조

```
/agent-desk                        → 고객: 에이전트 대화 + 파일 업로드
/agent-desk/analysis/:sessionId    → 고객: 분석 리포트
/agent-desk/spec/:sessionId        → 고객: 스펙 조정/확정
/agent-desk/project/:sessionId     → 고객: 프로젝트 생성 결과

/agent-desk/operator               → 운영자: 에이전트 대화 + 파일 업로드
/agent-desk/operator/analysis/:id  → 운영자: Gap 분석 리포트
/agent-desk/operator/execute/:id   → 운영자: 구현 실행/모니터링
```

---

## 3. 데이터 모델

### 테이블 구조

#### agent_desk_sessions (분석 세션)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| type | ENUM('customer', 'operator') | 세션 유형 |
| status | ENUM | 상태 머신 |
| title | VARCHAR(200) | 세션 제목 |
| prompt | TEXT | 초기 프롬프트 (대화 시작 시 참고용) |
| created_by_id | UUID FK→profiles | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### agent_desk_files (업로드된 파일)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| session_id | UUID FK→sessions | |
| file_name | VARCHAR(500) | 저장 파일명 |
| original_name | VARCHAR(500) | 원본 파일명 |
| mime_type | VARCHAR(100) | |
| size | INTEGER | |
| storage_url | TEXT | Supabase Storage URL |
| parsed_content | TEXT | 파싱된 텍스트 내용 |
| parsed_at | TIMESTAMP | 파싱 완료 시각 |
| created_at | TIMESTAMP | |

#### agent_desk_messages (에이전트 대화)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| session_id | UUID FK→sessions | |
| role | ENUM('agent', 'user') | 발신자 |
| content | TEXT | 메시지 내용 |
| created_at | TIMESTAMP | |

#### agent_desk_analyses (분석 결과)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| session_id | UUID FK→sessions | |
| requirements | JSONB | AI가 추출한 요구사항 목록 |
| matched_features | JSONB | 매칭된 기존 features |
| missing_features | JSONB | 없는 기능 |
| summary | TEXT | AI 분석 요약 |
| llm_model | VARCHAR(50) | 사용된 LLM 모델 |
| llm_tokens_used | INTEGER | 토큰 사용량 |
| created_at | TIMESTAMP | |

#### agent_desk_specs (프로젝트 스펙 — 고객 전용)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| session_id | UUID FK→sessions | |
| project_name | VARCHAR(100) | 서비스명 (kebab-case) |
| spec_data | JSONB | 프로젝트 스펙 JSON |
| version | INTEGER | 스펙 버전 |
| is_finalized | BOOLEAN | 확정 여부 |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### agent_desk_projects (생성된 프로젝트 — 고객 전용)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| session_id | UUID FK→sessions | |
| spec_id | UUID FK→specs | |
| project_name | VARCHAR(100) | |
| project_path | TEXT | apps/projects/{name} |
| status | ENUM('generating', 'ready', 'error') | |
| error_message | TEXT | |
| created_at | TIMESTAMP | |

#### agent_desk_executions (Claude Code 실행 — 운영자 전용)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| session_id | UUID FK→sessions | |
| implementation_prompt | TEXT | Claude에 전달할 프롬프트 |
| status | ENUM('pending', 'running', 'completed', 'failed') | |
| process_id | INTEGER | subprocess PID |
| stdout_log | TEXT | 실행 로그 |
| stderr_log | TEXT | |
| exit_code | INTEGER | |
| started_at | TIMESTAMP | |
| completed_at | TIMESTAMP | |
| created_at | TIMESTAMP | |

### 세션 상태 머신

```
고객 플로우:
  uploading → parsing → analyzing → analyzed → reviewed → spec_generated → project_created

운영자 플로우:
  uploading → parsing → analyzing → analyzed → reviewed → executing → executed
```

### 스펙 JSON 구조

```json
{
  "projectName": "my-shopping-mall",
  "displayName": "마이 쇼핑몰",
  "description": "소규모 온라인 쇼핑몰",
  "features": [
    { "id": "auth", "config": { "providers": ["email", "google"] } },
    { "id": "payment", "config": { "provider": "stripe" } },
    { "id": "board", "config": { "categories": ["공지사항", "FAQ"] } },
    { "id": "notification", "config": { "channels": ["in-app"] } }
  ],
  "routes": [
    { "path": "/", "feature": "landing", "label": "홈" },
    { "path": "/products", "feature": "board", "label": "상품" },
    { "path": "/cart", "feature": "payment", "label": "장바구니" }
  ],
  "theme": {
    "primaryColor": "blue",
    "logo": null
  },
  "i18n": { "defaultLanguage": "ko", "languages": ["ko"] }
}
```

---

## 4. 서비스 계층 상세

### 4-1. FileParserService

| 파일 유형 | 파싱 전략 | 라이브러리 |
|-----------|----------|-----------|
| PDF | 텍스트 추출 → LLM 보강 | `pdf-parse` |
| PPTX | 슬라이드별 텍스트+노트 추출 | `pptx2json` |
| 이미지 | LLMService 멀티모달 (vision) | LLMService `describeImage()` |
| Markdown | 그대로 사용 | 내장 파싱 |
| TXT | 그대로 사용 | 내장 파싱 |

```typescript
interface ParsedFile {
  fileId: string;
  fileName: string;
  mimeType: string;
  content: string;
  metadata: {
    pageCount?: number;
    slideCount?: number;
    imageDescription?: string;
  };
}
```

### 4-2. FeatureAnalyzerService

2단계 파이프라인:

1. **요구사항 추출** — 파싱된 텍스트 + 프롬프트 → LLM → 구조화된 요구사항 목록
2. **Feature 매칭** — 요구사항 + Feature Registry + Reference 문서 → LLM → matched/missing

```typescript
interface AnalysisResult {
  requirements: Requirement[];
  matchedFeatures: MatchedFeature[];
  missingFeatures: MissingFeature[];
  summary: string;
}

interface Requirement {
  id: string;
  category: string;
  description: string;
  priority: "high" | "medium" | "low";
}

interface MatchedFeature {
  requirementId: string;
  featureId: string;
  featureName: string;
  confidence: number;       // 0~1
  configSuggestion: Record<string, unknown>;
}

interface MissingFeature {
  requirementId: string;
  name: string;
  description: string;
  complexity: "simple" | "medium" | "complex";
  suggestedApproach: string;
}
```

### 4-3. SpecGeneratorService (고객 전용)

분석 결과(matched features) + 사용자 조정 → 프로젝트 스펙 JSON 생성. LLMService로 라우트/메뉴/테마 자동 제안. 버전 관리.

### 4-4. ProjectScaffoldService (고객 전용)

확정된 스펙 JSON → `apps/projects/{name}/` 디렉토리에 실행 가능한 앱 생성.

```
apps/projects/{서비스명}/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── project.spec.json         ← 원본 스펙
└── src/
    ├── main.tsx
    ├── router.tsx            ← 스펙 기반 라우트
    ├── feature-config.ts     ← 활성 features
    ├── theme.ts
    ├── i18n/resources.ts
    └── layouts/app-layout.tsx
```

### 4-5. ClaudeExecutorService (운영자 전용)

Claude Code CLI를 subprocess로 실행. stdout/stderr 스트리밍 → DB 저장 + SSE 전달. 프로세스 관리(cancel, timeout 30분).

### 4-6. AnalysisSessionService

세션/대화/파일 CRUD + 상태 전이 관리.

---

## 5. 에이전트 대화 설계

### 대화 기반 첫 화면

- 에이전트가 대화를 **먼저 시작** (시스템 메시지)
- 파일 업로드 영역은 채팅 하단에 **항상 표시**
- 에이전트가 파일 내용을 읽고 **질문/제안/확인** 주도
- "분석해줘" 또는 에이전트 제안 → 분석 시작

### 시스템 프롬프트 구조

```
[역할 정의] — 고객/운영자에 따라 다른 프롬프트
[현재 Product Builder Features] — registry/features.json 요약
[업로드된 파일 내용] — parsed_content (토큰 제한 적용)
[대화 히스토리] — 이전 메시지들
```

### sendMessage 흐름

1. 사용자 메시지 DB 저장
2. 컨텍스트 수집 (세션, 파일, 히스토리)
3. LLMService 호출 (스트리밍 → SSE)
4. 에이전트 응답 DB 저장

---

## 6. API 설계

### tRPC Router

```
세션: createSession, getSession, listSessions, deleteSession
파일: getUploadUrl, confirmUpload, removeFile
대화: sendMessage, getMessages
분석: startAnalysis, getAnalysis
스펙: generateSpec, updateSpec, finalizeSpec
프로젝트: scaffoldProject, getProject
실행: buildPrompt, startExecution, getExecution, cancelExecution
```

### SSE 엔드포인트 (REST)

- `GET /agent-desk/sessions/:id/chat/stream` — 대화 응답 스트리밍
- `GET /agent-desk/executions/:id/log/stream` — 실행 로그 스트리밍

### 권한 매핑

| 기능 | tRPC | REST Guard |
|------|------|-----------|
| 세션/파일/대화/분석 | `protectedProcedure` | `JwtAuthGuard` |
| 스펙/프로젝트 | `protectedProcedure` | `JwtAuthGuard` |
| Claude 실행 | `adminProcedure` | `JwtAuthGuard + NestAdminGuard` |

---

## 7. LLMService 고도화

| 추가 기능 | 설명 |
|-----------|------|
| `describeImage()` | 이미지 → 텍스트 설명 (멀티모달) |
| `structuredCompletion<T>()` | Zod 스키마 기반 JSON 출력 강제 |
| `summarizeDocument()` | 긴 문서 토큰 압축 |

### 추가 의존성

```
pdf-parse, pptx2json (또는 mammoth), sharp
```

---

## 8. 에러 핸들링 & 보안

### 에러 처리

| 시나리오 | 처리 |
|----------|------|
| 파일 파싱 실패 | 해당 파일 null, 에이전트가 대화로 안내 |
| LLM API 오류 | fallback 체인 활용, 전부 실패 시 `failed` |
| 토큰 초과 | summarizeDocument로 압축 후 재시도 |
| scaffold 실패 | 디렉토리 롤백 + 에러 로그 |
| CLI 타임아웃 | 30분 초과 시 kill + `failed` |
| 동시 실행 | 운영자당 1개 제한 |

### 보안

| 항목 | 대책 |
|------|------|
| 파일 크기 | 단일 50MB, 세션당 200MB |
| 파일 유형 | mimeType + magic bytes 이중 검증 |
| CLI 실행 | admin 권한만 |
| 경로 | apps/projects/ 하위만, path traversal 방지 |
| 프롬프트 인젝션 | 파일 내용 별도 컨텍스트 블록 격리 |

---

## 9. 클라이언트 구조

```
apps/app/src/features/agent-desk/
├── pages/
│   ├── customer/
│   │   ├── agent-desk-upload.tsx          # 에이전트 대화 + 파일 업로드
│   │   ├── agent-desk-analysis.tsx        # 분석 리포트
│   │   ├── agent-desk-spec.tsx            # 스펙 조정/확정
│   │   └── agent-desk-project.tsx         # 프로젝트 생성 결과
│   └── operator/
│       ├── operator-upload.tsx             # 에이전트 대화 + 파일 업로드
│       ├── operator-analysis.tsx           # Gap 분석 리포트
│       └── operator-execute.tsx            # 실행/모니터링
├── components/
│   ├── file-upload-zone.tsx
│   ├── chat-message.tsx
│   ├── chat-input.tsx
│   ├── analysis-summary.tsx
│   ├── matched-feature-list.tsx
│   ├── missing-feature-list.tsx
│   ├── session-history-list.tsx
│   ├── spec-editor.tsx
│   ├── prompt-editor.tsx
│   └── execution-log-viewer.tsx
├── hooks/
│   ├── use-agent-desk-sessions.ts
│   ├── use-file-upload.ts
│   ├── use-chat.ts
│   ├── use-analysis.ts
│   ├── use-spec.ts
│   ├── use-project-scaffold.ts
│   └── use-execution.ts
├── store/
│   └── agent-desk.store.ts
├── routes/
│   ├── index.ts
│   ├── customer/
│   └── operator/
├── locales/
│   ├── ko.json
│   └── en.json
└── index.ts
```

---

## 10. 구현 로드맵

### Phase 1: 인프라 + 대화 기반 (MVP) — 고객용 우선

1-1. DB 스키마 (sessions, files, messages)
1-2. LLMService 고도화 (describeImage, structuredCompletion, summarizeDocument)
1-3. FileParserService (PDF, PPTX, 이미지, MD, TXT)
1-4. AnalysisSessionService (세션/메시지 CRUD)
1-5. 에이전트 대화 엔진 (시스템 프롬프트 + 대화 + 파일 컨텍스트)
1-6. SSE 스트리밍 (대화 응답)
1-7. tRPC + REST (세션/파일/메시지)
1-8. Module 등록 (NestJS, tRPC, Schema Index)
1-9. 클라이언트 채팅 UI
1-10. 라우트 등록

### Phase 2: Feature 분석 리포트 (고객용)

2-1. FeatureAnalyzerService
2-2. analyses 테이블
2-3. 분석 tRPC/REST
2-4. 분석 리포트 UI
2-5. 대화 → 분석 전환

### Phase 3: 스펙 생성 + 프로젝트 scaffold (고객용)

3-1. specs, projects 테이블
3-2. SpecGeneratorService
3-3. ProjectScaffoldService
3-4. 프로젝트 템플릿
3-5. 스펙/프로젝트 tRPC/REST
3-6. 스펙 편집 UI
3-7. 프로젝트 결과 UI

### Phase 4: 운영자 도구

4-1. executions 테이블
4-2. ClaudeExecutorService
4-3. 구현 프롬프트 생성
4-4. 실행 SSE 스트리밍
4-5. 실행 tRPC/REST
4-6. 운영자 대화 UI
4-7. Gap 분석 리포트 UI
4-8. 실행 모니터링 UI

### Phase 5: 고도화 + Admin

5-1. Admin 대시보드 (system-admin)
5-2. 사용 통계
5-3. 프로젝트 재생성
5-4. 프롬프트 템플릿 관리
5-5. 레퍼런스/인덱스 업데이트

### Phase 의존성

```
Phase 1 → Phase 2 → Phase 3
Phase 1 → Phase 4 (Phase 2와 병렬 가능)
Phase 3, 4 → Phase 5
```

### 예상 산출물

| Phase | 서버 파일 | 클라이언트 파일 | DB 테이블 |
|-------|----------|---------------|----------|
| 1 | ~15 | ~12 | 3 |
| 2 | ~5 | ~4 | 1 |
| 3 | ~8 | ~6 | 2 |
| 4 | ~6 | ~6 | 1 |
| 5 | ~4 | ~5 | 0 |
| **합계** | **~38** | **~33** | **7** |
