# Planning Rules 개선 — 기획↔개발 갭 축소

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** planning 룰 문서를 개선하여 기획 산출물이 개발로 직접 이어지도록 갭을 줄인다.

**Architecture:** 기존 `planning/rules/` 8개 파일 + `.claude/rules/` 관련 파일을 수정/추가. 코드 변경 없이 문서만 작업.

**Scope:** planning 룰 문서 (.md 파일)만 수정. 코드, 스키마, 컴포넌트 변경 없음.

---

## 분석 결과: 7개 핵심 갭

| # | 갭 | 현재 | 목표 |
|---|-----|------|------|
| G1 | FRD API 계약 → 코드 매핑 부재 | FRD 테이블이 개발 네이밍/패턴과 불일치 | FRD가 코드 패턴 그대로 반영 |
| G2 | Pen 리뷰 상태 → QA TC 미연결 | 5가지 상태 검토하지만 QA에서 강제 안 됨 | 상태별 P0 TC 필수화 |
| G3 | FRD 요구사항 ↔ QA 커버리지 비강제 | 수동 체크리스트뿐 | 커버리지 검증 규칙 명시 |
| G4 | Phase gate 기준 모호 | "핵심 플로우", "최소 정의" 등 주관적 | 정량적 Go/No-Go 기준 |
| G5 | 구현 → 기획 피드백 루프 없음 | 구현 중 발견한 기획 갭 기록 프로세스 없음 | 피드백 루프 문서화 |
| G6 | Phase/Step 용어 혼동 | 6단계(기획) vs 11 Step(구현) 혼재 | 용어 정리 + 매핑 테이블 |
| G7 | Runtime 검증 ↔ QA TC 미연결 | 각각 독립 프로세스 | QA TC를 런타임 검증 기준으로 연결 |

---

## Task 1: FRD 작성 가이드 — API 계약 섹션을 코드 패턴과 정렬

**Files:**
- Modify: `planning/rules/frd-writing-guide.md` (Section 5: API 계약)

**Why:** 현재 FRD API 계약 테이블이 `{ page, limit }` 같은 추상적 형식. 개발자가 이걸 보고 Zod 스키마, tRPC procedure, REST endpoint를 직접 매핑할 수 없음.

**Step 1: frd-writing-guide.md 읽기**

Read `planning/rules/frd-writing-guide.md` — Section 5 (API 계약) 확인.

**Step 2: API 계약 테이블 형식 개선**

Section 5의 tRPC Procedures 테이블을 아래로 교체:

기존:
```
| Procedure | Type | Input | Output | 권한 |
| {feature}.list | query | { page, limit } | PaginatedResult<Entity> | public |
```

개선:
```
| Procedure | Type | Input Schema | Output | 권한 | REST 매핑 |
| {feature}.list | query | PaginationInput (page: number, limit: number) | PaginatedResult<Entity> | publicProcedure | GET /api/{feature} |
| {feature}.create | mutation | Create{Entity}Input (title: string[1..200], content: string[1..]) | Entity | protectedProcedure | POST /api/{feature} |
```

변경 포인트:
- Input을 "Schema명 + 필드 상세"로 표기 → Zod DTO 1:1 대응
- 권한을 tRPC procedure 명칭 그대로 사용 (publicProcedure/protectedProcedure/adminProcedure)
- REST 매핑 열 추가 → api-strategy.md의 "항상 짝으로" 규칙 반영

**Step 3: 코드 대응 예시 섹션 추가**

Section 5 하단에 "코드 대응 예시" 블록 추가:

```markdown
### FRD → 코드 대응 예시

FRD API 계약이 코드로 어떻게 변환되는지 보여준다:

| FRD 항목 | 코드 산출물 | 파일 위치 |
|----------|-----------|----------|
| Procedure 이름 (`blog.create`) | tRPC Router key | `packages/features/{name}/{name}.router.ts` |
| Input Schema (`CreatePostInput`) | Zod DTO 클래스 | `packages/features/{name}/dto/create-{entity}.dto.ts` |
| Output (`Entity`) | Service 반환 타입 | `packages/features/{name}/types/index.ts` |
| 권한 (`protectedProcedure`) | tRPC middleware | `.claude/rules/backend/backend-conventions.md` |
| REST 매핑 (`POST /api/blog`) | Controller method | `packages/features/{name}/controller/{name}.controller.ts` |
```

**Step 4: Commit**

```bash
git add planning/rules/frd-writing-guide.md
git commit -m "docs(planning): align FRD API contract with code patterns"
```

---

## Task 2: QA 작성 가이드 — 화면 상태별 TC 필수화 + Runtime 연결

**Files:**
- Modify: `planning/rules/qa-writing-guide.md`

**Why:**
- Pen 리뷰에서 5가지 상태(Loading/Empty/Error/Disabled/Default)를 검증하지만, QA에서 이 상태들의 TC가 의무가 아님.
- Runtime 검증(`.claude/rules/runtime-verification.md`)과 QA TC가 별도 프로세스로 존재.

**Step 1: qa-writing-guide.md 읽기**

Read `planning/rules/qa-writing-guide.md` — 우선순위 판별 기준 섹션 확인.

**Step 2: 상태별 TC 필수 규칙 추가**

"우선순위 판별 기준" 섹션 뒤에 새 섹션 추가:

```markdown
## 화면 상태별 TC 필수 규칙

Pen 리뷰에서 승인된 5가지 화면 상태는 **각각 최소 1개 TC**가 필요하다.

| 화면 상태 | 최소 TC | 우선순위 | TC 내용 |
|-----------|---------|----------|---------|
| Default | 1개 | P0 | 정상 데이터 표시 확인 |
| Loading | 1개 | P1 | Skeleton/Spinner 표시 + 레이아웃 흔들림 없음 |
| Empty | 1개 | P1 | EmptyState + CTA 표시 확인 |
| Error | 1개 | P0 | 에러 메시지 + 재시도 버튼 동작 |
| Disabled | 1개 | P1 | 권한 없음 안내 표시 확인 |

> 총 5개 TC가 기본 세트. 이를 **State Coverage**라고 부른다.
```

**Step 3: 런타임 검증 연결 규칙 추가**

"증빙 형식" 섹션 뒤에 추가:

```markdown
## 런타임 검증 연결

구현 완료 후 런타임 검증(`.claude/rules/runtime-verification.md`)은 **P0 TC 기준**으로 수행한다.

| 검증 유형 | QA TC 대응 | 검증 방법 |
|-----------|-----------|----------|
| 서버 API | P0 TC 중 API 호출이 포함된 항목 | curl → status 200 |
| 브라우저 렌더링 | P0 TC 중 UI 확인이 포함된 항목 | Playwright → 스크린샷 |

### 런타임 검증 시 TC 상태 갱신

- 런타임 검증 PASS → 해당 TC 결과를 `PASS`로 기록
- 런타임 검증 FAIL → 해당 TC 결과를 `FAIL`로 기록 + 비고에 원인 작성
- 구현 중 TC에 없는 시나리오 발견 → **신규 TC 추가** (피드백 루프)
```

**Step 4: 요약 테이블에 State Coverage 행 추가**

전체 문서 템플릿의 "요약" 테이블에 행 추가:

```markdown
| State Coverage | {5/5} |
```

**Step 5: Commit**

```bash
git add planning/rules/qa-writing-guide.md
git commit -m "docs(planning): enforce state coverage TCs and runtime verification link"
```

---

## Task 3: Pen 리뷰 프로세스 — Go/No-Go 기준 정량화

**Files:**
- Modify: `planning/rules/pen-review-process.md`

**Why:** "핵심 플로우가 화면으로 커버됨", "상태 화면 최소 정의됨" 등이 주관적. 리뷰어마다 기준이 달라짐.

**Step 1: pen-review-process.md 읽기**

Read `planning/rules/pen-review-process.md` — Go/No-Go 판단 기준 섹션 확인.

**Step 2: Go 기준 정량화**

기존:
```
### Go (진행)
- 모든 **Must Fix** 항목이 반영 완료됨
- 핵심 플로우(정상 시나리오)가 화면으로 커버됨
- 상태 화면(Loading/Empty/Error) 최소 정의됨
- 권한별 차이가 주요 화면에 반영됨
```

개선:
```
### Go (진행)

아래 **모든 조건**을 충족해야 Go.

| # | 조건 | 정량 기준 | 확인 방법 |
|---|------|----------|----------|
| 1 | Must Fix 반영 | Must Fix 0건 | 피드백 체크리스트 전수 확인 |
| 2 | FRD 요구사항 커버리지 | FRD P0 요구사항의 100% 화면 매핑 | FRD 요구사항 목록 대조 |
| 3 | 상태 화면 완성도 | 모든 화면 × 5가지 상태 정의 | 화면별 상태 체크리스트 |
| 4 | 권한별 화면 차이 | FRD 권한 매트릭스의 모든 역할 반영 | 역할별 화면 대조 |
| 5 | CTA/네비게이션 일관성 | 화면 간 이동 경로가 FRD 사용자 시나리오와 일치 | 시나리오별 워크스루 |
```

**Step 3: No-Go 기준도 정량화**

기존 "심각하게 불일치" → 아래로 교체:

```
### No-Go (재작업)

아래 **하나라도** 해당하면 No-Go.

| # | 조건 | 판단 기준 |
|---|------|----------|
| 1 | Must Fix 미반영 | Must Fix ≥ 1건 |
| 2 | 핵심 화면 누락 | FRD P0 요구사항 중 화면 매핑 안 된 것 ≥ 1건 |
| 3 | 상태 화면 미정의 | 5가지 상태 중 미정의 ≥ 2개인 화면 존재 |
| 4 | 권한 모델 불일치 | FRD 권한 매트릭스와 화면 접근 규칙 불일치 |
```

**Step 4: Commit**

```bash
git add planning/rules/pen-review-process.md
git commit -m "docs(planning): quantify Pen review Go/No-Go gate criteria"
```

---

## Task 4: 피드백 루프 규칙 신설 — 구현 → 기획 역류 프로세스

**Files:**
- Create: `planning/rules/implementation-feedback-loop.md`
- Modify: `planning/rules/planning-workflow.md` (관련 문서 섹션에 추가)

**Why:** 구현 중 발견한 기획 갭(FRD 모호, 화면정의서 누락, QA 시나리오 미반영)을 기록하고 반영하는 프로세스가 없음.

**Step 1: 신규 파일 작성**

```markdown
# 구현 → 기획 피드백 루프

> 구현 단계에서 기획 갭을 발견했을 때, 기획 문서를 갱신하는 프로세스.

---

## 적용 시점

구현 중 아래 상황이 발생하면 이 프로세스를 따른다:

| 발견 유형 | 예시 | 영향 문서 |
|-----------|------|----------|
| **FRD 모호** | 요구사항이 2가지로 해석됨 | FRD 해당 항목 |
| **화면 누락** | FRD에는 있지만 화면정의서에 없는 인터랙션 | 화면정의서 |
| **상태 미정의** | 특정 조합의 Error 상태가 정의 안 됨 | 화면정의서 + QA |
| **QA 시나리오 갭** | 구현하다 보니 TC에 없는 에지케이스 발견 | QA 문서 |
| **API 계약 변경** | Input/Output이 FRD와 달라져야 함 | FRD Section 5 |

---

## 피드백 기록 형식

```markdown
### 구현 피드백 #{번호}

- **발견일**: YYYY-MM-DD
- **발견자**: {이름/역할}
- **유형**: FRD 모호 / 화면 누락 / 상태 미정의 / QA 갭 / API 변경
- **영향 문서**: {FRD-XX-NNN / 화면정의서명 / TC-XX-NNN}
- **현재 기술**: {기획 문서에 현재 적혀있는 내용}
- **발견 사항**: {구현 중 발견한 갭}
- **제안**: {수정 제안}
- **긴급도**: 블로커 / 비블로커
```

---

## 긴급도별 대응

| 긴급도 | 대응 | 구현 진행 |
|--------|------|----------|
| **블로커** | 즉시 기획자에게 공유 → FRD/화면 수정 → 변경된 TC 반영 | 해당 부분 구현 중단, 다른 부분 먼저 진행 |
| **비블로커** | 피드백 기록 → 구현 완료 후 일괄 반영 | 구현 계속 (가장 합리적인 해석으로) |

---

## 피드백 반영 흐름

```
구현 중 갭 발견
  → 피드백 기록 작성
  → 블로커?
     Yes → 기획자 확인 → FRD 수정 → 화면정의서 수정 → QA TC 추가/수정
     No  → 구현 완료 후 일괄 반영
  → 반영 완료 후 피드백 "해결됨"으로 마킹
```

---

## 피드백 기록 위치

- **위치**: Obsidian `Product Builder/기획 관리 대시보드/02-FRD/{feature}/` 하위에 기록
- **또는**: FRD 문서 하단 "구현 피드백" 섹션에 인라인 기록
- 피드백이 3건 이상이면 별도 문서 분리 권장

---

## 완료 조건

- [ ] 모든 블로커 피드백이 기획 문서에 반영됨
- [ ] 비블로커 피드백이 기록됨 (반영은 후속 버전에서 가능)
- [ ] 피드백으로 인해 변경된 TC가 QA 문서에 갱신됨
```

**Step 2: planning-workflow.md에 참조 추가**

관련 문서 테이블에 행 추가:
```
| `implementation-feedback-loop.md` | 구현 중 | 구현→기획 역류 프로세스, 갭 기록/반영 |
```

**Step 3: Commit**

```bash
git add planning/rules/implementation-feedback-loop.md planning/rules/planning-workflow.md
git commit -m "docs(planning): add implementation feedback loop process"
```

---

## Task 5: planning-workflow.md — 용어 정리 + Phase↔Step 매핑 테이블

**Files:**
- Modify: `planning/rules/planning-workflow.md`

**Why:** "6단계 워크플로우"(기획)와 ".claude/rules/feature/steps.md의 11 Step"(구현)이 별도 번호 체계. 어디서 기획이 끝나고 개발이 시작하는지 혼란.

**Step 1: planning-workflow.md 읽기**

Read `planning/rules/planning-workflow.md` — 상단 워크플로우 개요 확인.

**Step 2: 기획↔구현 연결 매핑 섹션 추가**

"누락 방지 체크리스트" 앞에 새 섹션 추가:

```markdown
## 기획 Phase → 구현 Step 매핑

기획 6단계와 구현 Step은 **별도 번호 체계**이다. 아래 테이블로 연결을 확인한다.

| 기획 Phase | 산출물 | → 구현에서 사용하는 곳 | 구현 Step |
|-----------|--------|----------------------|----------|
| 1. Discovery | 범위/방향 확정 | 구현 범위 결정 | - |
| 2. PRD | 비즈니스 목표, 사용자 스토리 | 기능 우선순위 판단 | - |
| 3. FRD | 요구사항 ID, API 계약, 권한 매트릭스 | Schema 설계, Service 구현, tRPC/REST 구현 | Step 2-8 |
| 4. 화면정의서 | .pen 파일, 데이터 매핑, 상태 디자인 | 컴포넌트 설계, 페이지 구현 | Step 10a-10c |
| 5. Pen 리뷰 | Go 승인 | 구현 시작 허가 | Phase 1 진입 조건 |
| 6. QA | TC 목록, 우선순위 | 런타임 검증 기준 (P0 TC 기반) | Phase 3 (Build & Test) |

### 용어 정리

| 용어 | 문맥 | 의미 |
|------|------|------|
| **Phase** (기획) | `planning-workflow.md` | 기획 6단계 (Discovery ~ QA) |
| **Phase** (구현) | `.claude/rules/feature/steps.md` | 구현 4단계 (Server → Client → Build → PR) |
| **Step** (구현) | `.claude/rules/feature/steps.md` | 구현 세부 단계 (Step 1 ~ Step 11d) |
| **Phase** (라이프사이클) | `documentation-lifecycle.md` | 전체 7-Phase (기획 + 구현 + 문서화) |

> **혼동 주의**: "Phase"가 3곳에서 다른 의미로 사용된다. 문서를 참조할 때 어떤 문맥의 Phase인지 확인할 것.
```

**Step 3: Commit**

```bash
git add planning/rules/planning-workflow.md
git commit -m "docs(planning): add phase-step mapping and terminology guide"
```

---

## Task 6: FRD 작성 가이드 — 개발 네이밍 규칙 반영

**Files:**
- Modify: `planning/rules/frd-writing-guide.md`

**Why:** FRD에서 엔티티명, 필드명을 정할 때 개발 네이밍 컨벤션(`.claude/rules/backend/schema-dev.md`)을 모르면 개발 단계에서 재해석이 필요. 기획 시점부터 코드 네이밍을 정렬하면 갭이 줄어듦.

**Step 1: frd-writing-guide.md 읽기**

Section 3 (핵심 엔티티) 확인.

**Step 2: 엔티티/필드 네이밍 가이드 추가**

Section 3 "핵심 엔티티" 뒤에 추가:

```markdown
### 엔티티/필드 네이밍 규칙 (개발 정렬)

FRD에서 엔티티와 필드를 정의할 때, 아래 개발 네이밍 규칙을 따르면 구현 시 재해석이 불필요하다.

| 항목 | FRD 표기 | DB 컬럼명 | 코드 변수명 | 예시 |
|------|---------|----------|-----------|------|
| 테이블 | `{feature}_{entity}` (snake) | 동일 | camelCase | FRD: `blog_posts` → DB: `blog_posts` → Code: `blogPosts` |
| 필드 | snake_case | 동일 | camelCase | FRD: `created_at` → DB: `created_at` → Code: `createdAt` |
| Enum | `{feature}_{name}` (snake) | 동일 | camelCase | FRD: `blog_post_status` → DB: `blog_post_status` |
| ID 필드 | `{entity}_id` (FK) | 동일 | camelCase | FRD: `author_id` → Code: `authorId` |

> **Feature prefix 필수**: 모든 테이블/enum에 `{feature}_` prefix. Core 테이블(`profiles`, `files`)은 prefix 없음.
> **상세**: `.claude/rules/backend/schema-dev.md`
```

**Step 3: Commit**

```bash
git add planning/rules/frd-writing-guide.md
git commit -m "docs(planning): add entity naming convention aligned with dev rules"
```

---

## Task 7: documentation-lifecycle.md (planning 버전) — FRD 산출물 구체화 + 피드백 루프 연결

**Files:**
- Modify: `planning/rules/documentation-lifecycle.md`

**Why:** Phase 2 (FRD)의 산출물이 "FRD 문서 1건"으로만 기술. FRD가 코드에 직접 매핑되는 핵심 문서인데, 어떤 섹션이 어떤 구현 산출물로 이어지는지 명시 안 됨.

**Step 1: documentation-lifecycle.md 읽기**

Read `planning/rules/documentation-lifecycle.md` — Phase 2 (FRD) 섹션 확인.

**Step 2: Phase 2 FRD에 구현 매핑 추가**

Phase 2 섹션의 "신규" 항목 뒤에 추가:

```markdown
### FRD → 구현 산출물 매핑

| FRD 섹션 | 구현 산출물 | 위치 |
|---------|-----------|------|
| §3 핵심 엔티티 | Drizzle Schema | `packages/drizzle/src/schema/features/{name}/` |
| §4 기능 요구사항 | Service 메서드 | `packages/features/{name}/service/` |
| §5 API 계약 | tRPC Router + REST Controller | `packages/features/{name}/` |
| §6 오류/예외 | DTO validation + Exception handling | `packages/features/{name}/dto/` |
| §2 권한 모델 | tRPC procedure type + Guard | `@repo/core/trpc/middleware` |
```

**Step 3: Phase 5 (구현) 뒤에 피드백 루프 참조 추가**

```markdown
### 구현 중 기획 갭 발견 시

구현 중 FRD/화면정의서/QA 문서의 갭을 발견하면 **피드백 루프** 프로세스를 따른다.

> 상세: `planning/rules/implementation-feedback-loop.md`
```

**Step 4: Commit**

```bash
git add planning/rules/documentation-lifecycle.md
git commit -m "docs(planning): add FRD-to-code mapping and feedback loop reference"
```

---

## Task 8: CLAUDE.md — planning 룰 개선사항 반영

**Files:**
- Modify: `CLAUDE.md`

**Why:** CLAUDE.md가 진입점이므로, 개선된 기획↔개발 연결 포인트를 반영해야 함.

**Step 1: CLAUDE.md 읽기**

현재 상태 확인.

**Step 2: 기획↔개발 연결 테이블 추가**

"참조" 섹션의 "기획 문서" 항목 뒤에:

```markdown
### 기획 → 개발 연결 포인트

| 기획 산출물 | 개발에서 사용 | 상세 |
|-----------|-------------|------|
| FRD §5 API 계약 | tRPC/REST 구현 기준 | `planning/rules/frd-writing-guide.md` |
| FRD §3 엔티티 | Drizzle Schema 설계 기준 | `planning/rules/frd-writing-guide.md` |
| 화면정의서 상태 | QA State Coverage TC | `planning/rules/qa-writing-guide.md` |
| QA P0 TC | 런타임 검증 기준 | `.claude/rules/runtime-verification.md` |
| 구현 중 기획 갭 | 피드백 루프 | `planning/rules/implementation-feedback-loop.md` |
```

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add planning-development bridge references to CLAUDE.md"
```

---

## 실행 순서 요약

| Task | 파일 | 핵심 변경 | 의존성 |
|------|------|----------|--------|
| 1 | frd-writing-guide.md | API 계약 → 코드 패턴 정렬 | 없음 |
| 2 | qa-writing-guide.md | State Coverage TC 필수 + Runtime 연결 | 없음 |
| 3 | pen-review-process.md | Go/No-Go 정량화 | 없음 |
| 4 | implementation-feedback-loop.md (신규) + planning-workflow.md | 피드백 루프 신설 | 없음 |
| 5 | planning-workflow.md | Phase↔Step 매핑 + 용어 정리 | Task 4 (같은 파일) |
| 6 | frd-writing-guide.md | 엔티티 네이밍 규칙 | Task 1 (같은 파일) |
| 7 | documentation-lifecycle.md | FRD→구현 매핑 + 피드백 참조 | Task 4 |
| 8 | CLAUDE.md | 연결 포인트 테이블 | Task 1-7 |

Task 1-4는 **병렬 실행 가능**. Task 5는 Task 4 이후. Task 6은 Task 1 이후. Task 7은 Task 4 이후. Task 8은 모든 Task 이후.
