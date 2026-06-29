# Data Tracker Feature Design

> 사용자 도메인 데이터 수집 및 차트 조회 기능

## 개요

Admin이 트래커 템플릿(컬럼 구조 + 차트 설정)을 정의하면, 사용자가 데이터를 등록하고 차트로 조회하는 분석형 관리 기능.

### 핵심 요구사항

- Admin이 트래커 구조 정의 (컬럼명, 타입, 차트 종류)
- 사용자가 데이터 입력 (수동 폼 + CSV 벌크 + 외부 API)
- 사용자 화면에서 차트 조회 (개인 뷰 ↔ 조직 뷰 전환)
- 필수 컬럼: 날짜 (고정), 나머지: 텍스트/숫자 (추상화)

### Feature 정보

- **Feature 이름**: `data-tracker`
- **Feature 유형**: Page Feature
- **기존 analytics와 별개**: analytics = 시스템 이벤트 자동 추적, data-tracker = 사용자 도메인 데이터 수동/벌크 등록

---

## 설계 결정

### 접근 방식: JSONB 플랫 패턴

| 대안 | 채택 여부 | 이유 |
|------|----------|------|
| EAV (Entity-Attribute-Value) | X | 타입 2종(텍스트/숫자)뿐이라 과도한 복잡성 |
| **JSONB 플랫** | **O** | 한 행 = 한 레코드, CSV/API 매핑 자연스러움, 차트 고정이라 피벗 불필요 |
| 하이브리드 (고정 + JSONB) | X | 타입 2종이라 분리할 이점 부족 |

---

## 데이터 모델

### 1. `data_tracker_trackers` (트래커 정의)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | baseColumns |
| name | varchar(200) NOT NULL | 트래커 이름 |
| description | text, nullable | 설명 |
| slug | varchar(200) UNIQUE NOT NULL | URL용 슬러그 |
| chartType | enum (`line`/`bar`/`pie`) | 차트 종류 |
| chartConfig | jsonb NOT NULL | 차트 설정 |
| scope | enum (`personal`/`organization`/`all`) | 조회 범위 |
| isActive | boolean, default true | 활성 여부 |
| isDeleted | boolean, default false | soft delete |
| deletedAt | timestamp, nullable | 삭제 시각 |
| createdById | uuid FK→profiles | 생성 Admin |
| createdAt, updatedAt | timestamp | baseColumns |

### 2. `data_tracker_columns` (컬럼 정의)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | baseColumns |
| trackerId | uuid FK→trackers ON DELETE CASCADE | 소속 트래커 |
| key | varchar(100) NOT NULL | JSON key |
| label | varchar(200) NOT NULL | 표시 라벨 |
| dataType | enum (`text`/`number`) | 데이터 타입 |
| isRequired | boolean, default false | 필수 여부 |
| sortOrder | integer NOT NULL | 표시 순서 |
| createdAt, updatedAt | timestamp | baseColumns |

### 3. `data_tracker_entries` (데이터 행)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | baseColumns |
| trackerId | uuid FK→trackers ON DELETE CASCADE | 소속 트래커 |
| date | date NOT NULL | 필수 날짜 |
| data | jsonb NOT NULL | `{ "key": value, ... }` |
| source | enum (`manual`/`csv_import`/`api`) | 입력 출처 |
| isDeleted | boolean, default false | soft delete |
| deletedAt | timestamp, nullable | 삭제 시각 |
| createdById | uuid FK→profiles | 입력 사용자 |
| createdAt, updatedAt | timestamp | baseColumns |

### 인덱스

- `idx_data_tracker_entries_tracker_date` → `(trackerId, date)`
- `idx_data_tracker_entries_tracker_user` → `(trackerId, createdById)`
- `idx_data_tracker_columns_tracker_order` → `(trackerId, sortOrder)`

### chartConfig 구조

```json
// line / bar
{
  "yAxisKey": "count",
  "groupByKey": "session_name",
  "aggregation": "sum"
}

// pie
{
  "categoryKey": "step",
  "valueKey": "count",
  "aggregation": "sum"
}
```

- `xAxis`는 항상 `date`이므로 생략
- `aggregation`: `sum` / `avg` / `count` / `min` / `max`

---

## API 설계

### tRPC Router: `dataTracker`

#### Admin 프로시저

| Procedure | 타입 | 설명 |
|-----------|------|------|
| `adminList` | query | 트래커 목록 |
| `adminGetById` | query | 트래커 상세 + 컬럼 |
| `adminCreate` | mutation | 트래커 생성 (컬럼 포함) |
| `adminUpdate` | mutation | 트래커 수정 (컬럼 포함) |
| `adminDelete` | mutation | soft delete |
| `adminToggleActive` | mutation | 활성/비활성 토글 |

#### Protected 프로시저 (로그인 사용자)

| Procedure | 타입 | 설명 |
|-----------|------|------|
| `list` | query | 활성 트래커 목록 |
| `getBySlug` | query | 트래커 상세 + 컬럼 |
| `addEntry` | mutation | 데이터 1건 입력 |
| `updateEntry` | mutation | 데이터 수정 |
| `deleteEntry` | mutation | soft delete |
| `importCsv` | mutation | CSV 벌크 입력 |
| `getEntries` | query | 데이터 목록 (페이지네이션) |
| `getChartData` | query | 차트용 집계 데이터 |

#### Public 프로시저 (외부 API)

| Procedure | 타입 | 설명 |
|-----------|------|------|
| `pushEntry` | mutation | 외부 시스템 데이터 푸시 |

### REST Controller

tRPC와 동일 엔드포인트 미러링. Swagger 데코레이터 필수.

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/admin/data-tracker` | 트래커 목록 (Admin) |
| GET | `/api/admin/data-tracker/:id` | 트래커 상세 (Admin) |
| POST | `/api/admin/data-tracker` | 트래커 생성 |
| PATCH | `/api/admin/data-tracker/:id` | 트래커 수정 |
| DELETE | `/api/admin/data-tracker/:id` | 트래커 삭제 |
| PATCH | `/api/admin/data-tracker/:id/toggle` | 활성 토글 |
| GET | `/api/data-tracker` | 활성 트래커 목록 |
| GET | `/api/data-tracker/:slug` | 트래커 상세 |
| POST | `/api/data-tracker/:slug/entries` | 데이터 입력 |
| PATCH | `/api/data-tracker/:slug/entries/:entryId` | 데이터 수정 |
| DELETE | `/api/data-tracker/:slug/entries/:entryId` | 데이터 삭제 |
| POST | `/api/data-tracker/:slug/import` | CSV 벌크 입력 |
| GET | `/api/data-tracker/:slug/entries` | 데이터 목록 |
| GET | `/api/data-tracker/:slug/chart` | 차트 집계 데이터 |
| POST | `/api/data-tracker/:slug/push` | 외부 API 푸시 |

---

## 화면 설계

### 사용자 화면 (apps/app)

#### 트래커 목록 (`/data-tracker`)

- 활성 트래커 카드 목록
- 카드: 트래커명, 설명, 차트 타입 아이콘, 최근 입력일

#### 트래커 상세 (`/data-tracker/:slug`)

- 상단: 트래커명 + 설명
- 탭 2개: 차트 뷰 / 데이터 뷰
- **차트 뷰**:
  - Admin 지정 차트 (Recharts)
  - 기간 필터: 7일 / 30일 / 90일 / 전체
  - scope가 `all`이면: 개인 ↔ 조직 토글
- **데이터 뷰**:
  - 테이블 목록 (페이지네이션)
  - 입력 버튼 → 동적 폼 Dialog
  - CSV import 버튼

### Admin 화면 (apps/system-admin)

#### 트래커 관리 (`/admin/data-tracker`)

- 트래커 목록 테이블 (이름, 차트타입, scope, 활성, 엔트리 수)
- 생성 / 수정 / 삭제 / 토글

#### 트래커 생성/수정 (`/admin/data-tracker/new`, `/admin/data-tracker/:id/edit`)

- 기본 정보: 이름, 설명, slug (자동 생성)
- 컬럼 정의: 동적 추가/삭제/순서변경
- 차트 설정: chartType → chartConfig
- 범위: scope
- 미리보기: 샘플 데이터 차트 프리뷰

---

## 에러 처리

| 상황 | 처리 |
|------|------|
| 필수 컬럼 값 누락 | Zod 검증 → 400 |
| number 타입에 문자열 | Zod 검증 → 400 |
| CSV 포맷 불일치 | 파싱 실패 행 스킵 + 결과 요약 반환 |
| 비활성 트래커에 입력 시도 | 403 Forbidden |
| 존재하지 않는 slug | 404 Not Found |
| scope `personal`인데 조직 뷰 요청 | 403 Forbidden |
| slug 중복 | 409 Conflict |

---

## 기술 스택

- **차트**: Recharts (프로젝트에서 이미 사용 중)
- **DB**: Drizzle ORM + PostgreSQL JSONB
- **검증**: Zod (DTO + 동적 컬럼 검증)
- **파일 파싱**: papaparse (CSV)
