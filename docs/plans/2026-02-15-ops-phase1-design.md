# Phase 1: 운영 안정 — 설계 문서

> Scheduled Job + Audit Log + Analytics Dashboard

## 개요

SaaS 서비스 운영에 필요한 기반 기능 3개를 구현합니다.
- **Scheduled Job**: 크레딧 월 갱신, 마케팅 예약 발행, 데이터 정리 자동화
- **Audit Log**: Admin 액션 기록 및 감사 추적
- **Analytics Dashboard**: 사용자 지표 수집 및 시각화

## Feature A: Scheduled Job (스케줄러)

### 아키텍처

NestJS `@nestjs/schedule` + 일반화된 Job 테이블. 기존 마케팅 `SchedulerService`에 `@Cron` 데코레이터를 연결하고, 크레딧 월 갱신 + 데이터 정리 Job을 추가합니다.

### DB 스키마

**`system_scheduled_jobs`** — 잡 정의

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| jobKey | text UNIQUE | 잡 식별자 (`credit_monthly_renewal`, `marketing_publish`, `data_cleanup`) |
| displayName | text | 표시명 |
| description | text | 설명 |
| cronExpression | text | Cron 표현식 |
| isActive | boolean | 활성 여부 (기본 true) |
| lastRunAt | timestamp | 마지막 실행 시각 |
| nextRunAt | timestamp | 다음 실행 예정 시각 |
| metadata | jsonb | 잡별 설정 |
| createdAt, updatedAt | timestamp | |

**`system_job_runs`** — 실행 이력

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| jobId | uuid FK → scheduled_jobs | |
| status | enum | `running`, `success`, `failed` |
| startedAt | timestamp | |
| completedAt | timestamp | |
| durationMs | integer | 실행 시간 (ms) |
| result | jsonb | 실행 결과 (처리 건수 등) |
| errorMessage | text | 에러 메시지 |
| createdAt | timestamp | |

### 구현할 Job 3개

1. **크레딧 월 갱신** (`credit_monthly_renewal`, 매일 00:00)
   - `currentPeriodEnd` 지난 사용자 조회
   - 플랜의 `monthlyCredits`로 잔액 리셋
   - `currentPeriodStart/End` 갱신
   - 트랜잭션 로그 (`allocation` 타입)

2. **마케팅 예약 발행** (`marketing_scheduled_publish`, 매분)
   - 기존 `SchedulerService.processScheduledPublications()` 연결
   - 실패 시 `retryFailedPublications()` (지수 백오프)

3. **데이터 정리** (`data_cleanup`, 매일 03:00)
   - 90일 이상 soft-deleted 레코드 물리 삭제
   - 대상: 게시글, 댓글, 에이전트, 그래프 등 `isDeleted=true` && `deletedAt < 90일전`

### Service

- `ScheduledJobService` — 잡 CRUD, 실행 이력 조회
- `CronRunnerService` — `@Cron` 데코레이터로 실제 잡 실행, 실행 전후 이력 기록

### tRPC (Admin)

| 프로시저 | 유형 | 설명 |
|----------|------|------|
| `listJobs` | Query | 잡 목록 |
| `getJobRuns` | Query | 특정 잡의 실행 이력 (페이지네이션) |
| `toggleJob` | Mutation | 잡 활성/비활성 토글 |
| `runJobNow` | Mutation | 수동 실행 트리거 |

### Admin UI

- 잡 목록 테이블 (이름, cron, 상태, 마지막 실행, 다음 실행)
- 실행 이력 모달 (시작/종료 시간, 소요시간, 결과/에러)
- 활성/비활성 Switch + 수동 실행 Button

---

## Feature B: Audit Log (감사 로그)

### 아키텍처

Core 스키마에 `system_audit_logs` 테이블. Admin 액션만 기록합니다. 기존 Admin 서비스에 `auditLogService.log()` 호출을 추가하는 방식입니다.

### DB 스키마

**`system_audit_logs`**

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| userId | uuid FK → profiles | 액션 수행자 |
| action | enum | `create`, `update`, `delete`, `assign`, `adjust`, `sync`, `config_change` |
| resourceType | text | `plan`, `credit`, `role`, `permission`, `agent`, `model_pricing` 등 |
| resourceId | text | 대상 리소스 ID |
| description | text | 사람이 읽을 수 있는 설명 |
| changes | jsonb | `{ before: {...}, after: {...} }` 변경 전/후 |
| metadata | jsonb | 추가 컨텍스트 (IP, User-Agent 등) |
| createdAt | timestamp | |

### 기록 대상 (초기 6곳)

| 서비스 | 액션 |
|--------|------|
| PlanService | 플랜 생성/수정, 사용자 플랜 할당 |
| CreditService | 크레딧 수동 조정 (`adjustBalance`) |
| RoleService | 역할 생성/수정/삭제, 권한 할당/제거 |
| ModelPricingService | 모델 가격 생성/수정 |
| AgentService (agent-server) | 에이전트 생성/수정/삭제 |

### Service

- `AuditLogService` — 로그 기록 (`log()`) + 조회 (필터: userId, action, resourceType, dateRange, 페이지네이션)

### tRPC (Admin)

| 프로시저 | 유형 | 설명 |
|----------|------|------|
| `listLogs` | Query | 필터+페이지네이션 로그 목록 |
| `getLog` | Query | 로그 상세 (변경 전/후 포함) |

### Admin UI

- 필터 바 (날짜 범위, 사용자, 액션 타입, 리소스 타입)
- 로그 테이블 (시간, 사용자, 액션, 리소스, 설명)
- 상세 모달 (변경 전/후 JSON diff 표시)

---

## Feature C: Analytics Dashboard (분석 대시보드)

### 아키텍처

이벤트 수집 → 일별 집계 → Recharts 시각화. Scheduled Job Feature의 일별 집계 Job을 활용합니다.

### DB 스키마

**`system_analytics_events`** — 원본 이벤트

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| eventType | text | `sign_up`, `sign_in`, `post_created`, `ai_chat`, `credit_purchase`, `subscription_started` |
| userId | uuid FK → profiles (nullable) | 비로그인 이벤트 허용 |
| resourceType | text (nullable) | 관련 리소스 타입 |
| resourceId | text (nullable) | 관련 리소스 ID |
| eventData | jsonb | 이벤트별 추가 데이터 |
| createdAt | timestamp | |

**`system_daily_metrics`** — 일별 집계

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| date | date UNIQUE with metricKey | 집계 날짜 |
| metricKey | text | `dau`, `mau`, `sign_ups`, `posts_created`, `ai_chats`, `credit_purchases` |
| value | integer | 집계 값 |
| metadata | jsonb | 추가 breakdown 데이터 |
| createdAt | timestamp | |

### 이벤트 수집 지점 (초기 6개)

| 서비스 | 이벤트 | eventType |
|--------|--------|-----------|
| Auth (Supabase webhook 또는 로그인 hook) | 가입 | `sign_up` |
| Auth | 로그인 | `sign_in` |
| BoardService / CommunityPostService | 게시글 작성 | `post_created` |
| agent-server chat route | AI 채팅 | `ai_chat` |
| CreditService | 크레딧 구매 | `credit_purchase` |
| PaymentService | 구독 시작 | `subscription_started` |

### 집계 Job

Scheduled Job Feature에 **analytics_daily_aggregate** Job 추가 (매일 01:00):
- 전일 이벤트를 eventType별로 COUNT → `system_daily_metrics` INSERT
- DAU 계산: 전일 `sign_in` 이벤트의 DISTINCT userId COUNT
- MAU 계산: 최근 30일 `sign_in` 이벤트의 DISTINCT userId COUNT

### Service

- `AnalyticsService` — 이벤트 기록 (`track()`) + 집계 쿼리 (KPI 카드, 트렌드, 분포)

### tRPC (Admin)

| 프로시저 | 유형 | 설명 |
|----------|------|------|
| `getOverview` | Query | KPI 카드 4개 (총 사용자, DAU, MAU, 신규 가입) |
| `getTrend` | Query | 기간별 트렌드 (metricKey + dateRange) |
| `getDistribution` | Query | 플랜별/기능별 분포 |

### Admin UI (Recharts)

```
┌──────────┬──────────┬──────────┬──────────┐
│ 총 사용자 │  DAU     │  MAU     │ 신규 가입 │  KPI 카드
├──────────┴──────────┴──────────┴──────────┤
│         가입 추이 (LineChart, 30일)        │  트렌드
├───────────────────────┬───────────────────┤
│  기능별 사용량 (Bar)   │  플랜별 분포 (Pie) │  분포
└───────────────────────┴───────────────────┘
```

- 날짜 범위 선택 (7일 / 30일 / 90일 / Custom)
- KPI 카드에 전기 대비 증감률(%) 표시

---

## 의존성 관계

```
Scheduled Job ──→ Audit Log (독립)
      │
      └──→ Analytics Dashboard (집계 Job이 Scheduler에 의존)
```

구현 순서: **Scheduled Job → Audit Log → Analytics Dashboard**

---

## 기술 스택 추가

| 패키지 | 용도 |
|--------|------|
| `@nestjs/schedule` | NestJS Cron 데코레이터 |
| `recharts` | React 차트 라이브러리 (Analytics Dashboard) |
