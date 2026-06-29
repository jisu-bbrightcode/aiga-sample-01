# Agent Desk Pipeline Design

> 사용자가 채팅으로 요구사항을 논의하면, AI가 Feature를 분석하고 Claude Code SDK로 자동 구현하는 파이프라인.

## 목표

Agent Desk 채팅에서 수집된 요구사항을 기반으로 Feature를 자동 분석 → 스펙 생성 → Claude Code SDK 실행 → PR 생성까지 완전 자동화한다.

## 파이프라인 흐름

```
Chat (요구사항 수집)
  ↓ AI 응답에 [ANALYZE_REQUEST] 마커 감지
Analyze (LLM 분석)
  ↓ 구조화된 JSON 분석 결과
Spec Generate (구현 스펙 생성)
  ↓ steps.md 기반 구현 명세
Execute (Git Worktree + Claude Code SDK)
  ↓ 코드 구현 + 빌드 검증
PR Create (Pull Request 생성)
```

### 상태 전환

```
uploading → analyzing → analyzed → spec_generated → executing → executed
                ↓            ↓                          ↓
              failed       failed                     failed
```

### 트리거 방식: AI 마커 감지

시스템 프롬프트에 `[ANALYZE_REQUEST]` 마커 규칙을 추가한다. AI가 충분한 정보가 모였다고 판단하면 응답에 마커를 포함하고, 프론트엔드가 이를 감지하여 파이프라인을 시작한다.

---

## 백엔드 아키텍처

### 새 서비스

#### AnalyzerService (`analyzer.service.ts`)

LLM을 호출하여 요구사항을 구조화된 분석 결과로 변환한다.

- **입력**: 세션의 대화 이력 + 파일 컨텍스트
- **출력**: `AnalysisResult` (구조화된 JSON)
- 분석 완료 후 결과를 `analysis_result` 컬럼에 저장
- 분석 결과를 기반으로 steps.md 형식의 구현 스펙을 생성하여 `spec` 컬럼에 저장

#### ExecutorService (`executor.service.ts`)

Git Worktree를 생성하고 Claude Code SDK를 실행한다.

- **워크플로우**:
  1. `git worktree add` — 세션별 격리된 작업 디렉토리 생성
  2. Claude Code SDK 실행 — 스펙을 프롬프트로 전달, 기존 feature 개발 규칙(steps.md) 준수
  3. 빌드 검증 — `pnpm tsc --noEmit` 실행
  4. `git push` → `gh pr create` — PR 생성
  5. Worktree 정리 — 성공 시 삭제, 실패 시 유지(디버깅용)

### 동시성 관리

- `Map<sessionId, { worktreePath, abortController, status }>` 로 실행 상태 추적
- 최대 3개 동시 실행 (환경변수 `AGENT_DESK_MAX_CONCURRENT` 로 설정)
- 초과 시 즉시 거부 (큐잉 없음)
- `AbortController` 로 사용자 취소 지원

---

## DB Schema 변경

### `agent_desk_sessions` 테이블 — 컬럼 추가

| 컬럼 | 타입 | 용도 |
|------|------|------|
| `analysis_result` | `jsonb` | LLM 분석 결과 (구조화된 JSON) |
| `spec` | `text` | 생성된 구현 스펙 (steps.md 형식) |
| `error_message` | `text` | 실패 시 에러 메시지 |

### 새 테이블: `agent_desk_executions`

| 컬럼 | 타입 | 용도 |
|------|------|------|
| `id` | `uuid` PK | |
| `session_id` | `uuid` FK | 세션 참조 |
| `worktree_path` | `text` | Git worktree 경로 |
| `branch_name` | `varchar(200)` | 실행 브랜치명 |
| `pr_url` | `text` | 생성된 PR URL |
| `pr_number` | `integer` | PR 번호 |
| `status` | `enum` | `pending` / `running` / `completed` / `failed` / `cancelled` |
| `started_at` | `timestamp` | 실행 시작 시간 |
| `completed_at` | `timestamp` | 실행 완료 시간 |
| `log` | `text` | Claude Code 실행 로그 |
| `created_at` / `updated_at` | `timestamp` | 기본 타임스탬프 |

### `AnalysisResult` JSONB 구조

```typescript
interface AnalysisResult {
  features: Array<{
    name: string;
    description: string;
    priority: "high" | "medium" | "low";
    complexity: "simple" | "moderate" | "complex";
    existingFeatures: string[];
    gaps: string[];
  }>;
  summary: string;
  recommendation: string;
}
```

---

## Frontend 변경

### 파이프라인 진행 패널

채팅 영역 내에 인라인으로 표시되는 컴포넌트. `[ANALYZE_REQUEST]` 마커 감지 시 자동 표시.

**진행 단계 UI:**
1. 분석 중 → 프로그레스 바
2. 분석 완료 → Feature 목록 카드 + "스펙 생성 & 실행하기" CTA
3. 실행 중 → Claude Code 로그 스트리밍
4. 완료 → 결과 표시

### 모드별 완료 화면

**Customer 모드**: 서비스 생성 완료 메시지 + 구현된 기능 목록 (기술 상세 숨김)

**Operator 모드**: PR URL + 브랜치명 + 변경 파일 수 등 기술 상세 포함

### SSE 기반 실시간 업데이트

새 엔드포인트 `/api/agent-desk/executions/:id/stream` 으로 실행 진행 상황 스트리밍.

```typescript
type ExecutionEvent =
  | { type: "status"; status: SessionStatus }
  | { type: "log"; content: string }
  | { type: "progress"; step: string; total: number }
  | { type: "result"; prUrl: string; prNumber: number }
  | { type: "error"; message: string }
```

### 새 컴포넌트/훅

| 파일 | 역할 |
|------|------|
| `components/pipeline-panel.tsx` | 분석 결과 + 실행 진행 상태 표시 |
| `components/execution-log.tsx` | Claude Code 실행 로그 스트리밍 표시 |
| `hooks/use-execution-stream.ts` | SSE 연결 및 실시간 이벤트 수신 |
| `hooks/use-analyze.ts` | 분석 시작 mutation |
| `hooks/use-execute.ts` | 실행 시작/중지 mutation |

---

## 에러 처리 & 정리

### 실패 시나리오별 처리

| 시나리오 | 처리 | 상태 전환 |
|----------|------|-----------|
| LLM 분석 실패 | 에러 메시지 + 재시도 버튼 | `analyzing` → `failed` |
| 스펙 생성 실패 | 에러 메시지 + 재시도 버튼 | `analyzed` → `failed` |
| Worktree 생성 실패 | 에러 로그 + 재시도 | `executing` → `failed` |
| Claude Code 실행 실패 | 실행 로그 표시 + 재시도 | `executing` → `failed` |
| Build/TypeCheck 실패 | Claude Code에 자동 수정 요청 (1회) | `executing` 유지 |
| PR 생성 실패 | 에러 표시 + 수동 안내 | `executing` → `failed` |
| 사용자 취소 | AbortController 중단 + 정리 | 현재 → `failed` |

### Worktree 정리

- 성공: PR 생성 후 자동 삭제
- 실패: 유지 (디버깅용), executions 테이블에 경로 기록
- 서버 재시작: `status: running` → `failed` 전환 + orphan worktree 정리

### 재시도

- 자동 재시도 없음, 항상 사용자 액션으로만 재시도
- 분석 실패 → `analyzing` 부터 재시작
- 실행 실패 → 기존 worktree 재활용 또는 새로 생성

### 동시 실행 제한

- 최대 3개 (환경변수 설정 가능)
- 초과 시 즉시 거부 메시지
- 큐잉 없음 (MVP)
