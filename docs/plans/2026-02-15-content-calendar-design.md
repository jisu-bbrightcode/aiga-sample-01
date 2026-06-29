# Content Calendar Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** content-studio 기능을 확장하여 콘텐츠 캘린더(월간 뷰)를 추가하고, 예약 발행 및 반복 주기 콘텐츠 생성 기능을 구현한다.

**Architecture:** content-studio feature 내부 확장. 별도 feature가 아닌 기존 feature에 캘린더 라우트, 스키마 컬럼, 반복 테이블을 추가한다. 사이드바에서 "콘텐츠 스튜디오" 그룹 아래 "스튜디오"와 "캘린더"를 묶는다.

**Tech Stack:** React + TanStack Router + date-fns + Drizzle ORM + tRPC

---

## 1. 범위

### In-Scope

- `studio_contents` 테이블에 `scheduledAt`, `label` 컬럼 추가
- `studio_recurrences` 테이블 신규 생성 (반복 규칙)
- 월간 캘린더 뷰 (`/content-studio/calendar`)
- 날짜 클릭 → 콘텐츠 예약 (scheduledAt 설정)
- 반복 규칙 생성/수정/삭제 (주간, 격주, 월간)
- 반복 실행 시 draft 상태의 콘텐츠 자동 복제
- 사이드바 "콘텐츠 스튜디오" 그룹화

### Out-of-Scope

- SNS 자동 발행 (마케팅 feature 별도)
- 주간/일간 캘린더 뷰 (월간만)
- 콘텐츠 자동 생성 (AI 연동)
- 드래그 앤 드롭으로 일정 변경 (v2)

---

## 2. 데이터 모델

### 2.1 `studio_contents` 컬럼 추가

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `scheduledAt` | `timestamp with timezone` | 예약 발행 일시 (null = 즉시 발행) |
| `label` | `varchar(50)` | 사용자 지정 레이블 (콘텐츠 그룹핑용, null 가능) |

- `label`은 자유 텍스트 — 사용자가 "주간 뉴스레터", "월간 리포트" 등으로 의미를 부여
- 같은 label을 가진 콘텐츠들이 논리적 그룹을 형성 (시리즈 대체)

### 2.2 `studio_recurrences` 테이블 (신규)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid PK | |
| `studioId` | uuid FK → studio_studios | 소속 스튜디오 |
| `title` | varchar(200) | 반복 규칙 이름 (예: "주간 뉴스레터") |
| `rule` | varchar(50) | 반복 주기 (`weekly:mon`, `biweekly:fri`, `monthly:1`) |
| `templateContentId` | uuid FK → studio_contents | 복제 원본 콘텐츠 (null 가능) |
| `label` | varchar(50) | 자동 복제 시 콘텐츠에 부여할 label |
| `isActive` | boolean | 활성 여부 (default: true) |
| `nextRunAt` | timestamp | 다음 실행 예정일 |
| `lastRunAt` | timestamp | 마지막 실행일 |
| `createdBy` | uuid FK → profiles | 생성자 |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### 2.3 반복 규칙 포맷 (`rule` 컬럼)

| 패턴 | 형식 | 예시 | 설명 |
|------|------|------|------|
| 주간 | `weekly:{day}` | `weekly:mon` | 매주 월요일 |
| 격주 | `biweekly:{day}` | `biweekly:fri` | 격주 금요일 |
| 월간 | `monthly:{date}` | `monthly:1` | 매월 1일 |

---

## 3. 발행 방식

- **발행 = 상태 변경만**: `status: "draft" → "published"`, `publishedAt` 기록
- scheduledAt이 도래하면 status를 published로 변경
- SNS 발행은 별도 마케팅 feature에서 처리 (out-of-scope)

---

## 4. 반복 동작

- **반복 실행 = 콘텐츠 자동 복제**
- `nextRunAt` 도래 시:
  1. `templateContentId`의 콘텐츠를 복제 (title, content, summary 등)
  2. 복제된 콘텐츠는 `status: "draft"`, `scheduledAt: nextRunAt`
  3. 복제 시 `label` 자동 부여 (recurrence의 label 값)
  4. `nextRunAt`을 다음 주기로 갱신, `lastRunAt` 업데이트
- templateContentId가 null이면 빈 draft 생성 (title만 recurrence.title 사용)
- 사용자가 복제된 콘텐츠를 자유롭게 편집 후 발행

---

## 5. UI 구성

### 5.1 사이드바 그룹

```
콘텐츠 스튜디오          ← SidebarGroup
├── 스튜디오             ← /content-studio (기존)
└── 캘린더               ← /content-studio/calendar (신규)
```

### 5.2 월간 캘린더 뷰

- 7열 x 5~6행 그리드 (일~토)
- 각 날짜 셀에 해당일의 콘텐츠 표시
  - 상태별 색상 Badge: draft(회색), writing(파랑), review(노랑), published(초록), canceled(빨강)
  - 최대 3개 표시, 초과 시 "+N" 링크
- 월 이동: 이전/다음 월 네비게이션
- 반복 아이콘: 반복 규칙에 의해 생성된 콘텐츠는 반복 아이콘 표시

### 5.3 일별 상세 패널

- 날짜 셀 클릭 시 슬라이드오버 또는 모달
- 해당일의 콘텐츠 목록 (제목, 상태, label)
- "콘텐츠 예약" 버튼 — 기존 draft 콘텐츠 선택 + scheduledAt 설정
- "새 콘텐츠" 버튼 — 해당일로 scheduledAt이 설정된 새 draft 생성

### 5.4 반복 관리 UI

- 캘린더 페이지 상단 "반복 관리" 버튼
- 반복 규칙 목록: 이름, 주기, 활성 여부, 다음 실행일
- 생성/수정 폼: 이름, 주기 선택, 템플릿 콘텐츠 선택, label 입력
- 활성/비활성 토글

---

## 6. API (tRPC)

### 6.1 기존 라우터 확장 (`contentStudio` router)

| Procedure | 타입 | 설명 |
|-----------|------|------|
| `calendar.list` | query | 월별 콘텐츠 조회 (year, month, studioId) |
| `calendar.schedule` | mutation | 콘텐츠에 scheduledAt 설정 |
| `calendar.unschedule` | mutation | scheduledAt 제거 |

### 6.2 반복 라우터 (contentStudio 하위)

| Procedure | 타입 | 설명 |
|-----------|------|------|
| `recurrence.list` | query | 반복 규칙 목록 |
| `recurrence.create` | mutation | 반복 규칙 생성 |
| `recurrence.update` | mutation | 반복 규칙 수정 |
| `recurrence.delete` | mutation | 반복 규칙 삭제 |
| `recurrence.toggle` | mutation | 활성/비활성 토글 |
| `recurrence.execute` | mutation | 수동 실행 (테스트용) |

---

## 7. 라우팅

| 경로 | 컴포넌트 | 설명 |
|------|----------|------|
| `/content-studio` | StudioListPage | 기존 스튜디오 목록 |
| `/content-studio/calendar` | CalendarPage | 월간 캘린더 (신규) |
| `/content-studio/$studioId` | CanvasPage | 기존 캔버스 |
| `/content-studio/$studioId/$contentId/edit` | EditorPage | 기존 에디터 |

---

## 8. 주요 결정사항

| 항목 | 결정 | 이유 |
|------|------|------|
| Feature 분리 | content-studio 내부 확장 | 데이터 모델 공유, 캘린더는 스튜디오의 뷰 |
| 시리즈 | 사용하지 않음 | label 필드로 사용자가 자유롭게 그룹핑 |
| 발행 범위 | 상태 변경만 | SNS는 마케팅 feature 별도 |
| 반복 방식 | 콘텐츠 자동 복제 | 복제 후 편집 가능, 유연성 확보 |
| 캘린더 뷰 | 월간만 | YAGNI, 주간/일간은 필요 시 추가 |
| 반복 규칙 | 문자열 포맷 | 간단한 주기만 지원, rrule 과잉 |
