# Feature Catalog Design

> SaaS Feature 마켓플레이스 — 고객이 Feature를 탐색·선택하고, 프로젝트를 조립하는 첫 단계

## Context

Product Builder의 궁극적 목적: Agent Desk에서 대화 → AI가 Feature 추천 → 카탈로그 UI에서 확인/수정 → monorepo 포크로 GitHub repo 생성 → upstream sync.

이 설계는 그 여정의 **첫 번째 빌딩 블록**: Feature Catalog.

### 결정 사항

| 항목 | 결정 |
|------|------|
| 프로젝트 산출물 | GitHub repo (Product Builder monorepo 포크, 선택한 Feature만 포함) |
| 고객 여정 | 하이브리드 (대화 + 카탈로그 UI) |
| 타겟 사용자 | 개발자 |
| 생성 후 관계 | Upstream sync (Product Builder 업데이트를 고객 repo에 반영) |
| MVP 범위 | Feature 카탈로그 UI (탐색 + 선택 + 의존성 검증) |

### 전체 로드맵에서의 위치

```
[1단계] Feature Catalog ← 이 설계
[2단계] Agent Desk 연동 — 대화 결과 → 카탈로그 Feature 자동 추천
[3단계] Project Builder — 선택 조합 → monorepo 포크 → GitHub repo push
[4단계] 멀티 테넌시 — Organization/Workspace 스키마
[5단계] Upstream Sync — Product Builder 업데이트 → 고객 repo PR 자동 생성
```

---

## Data Model

### feature_catalog 테이블

Feature 메타데이터를 DB에서 동적 관리. 기존 `registry/features.json`을 대체.

```
feature_catalog
├── id (uuid, PK)
├── slug (varchar, unique) — "blog", "payment", "community"
├── name (varchar) — "블로그", "결제"
├── description (text) — 마케팅용 설명
├── icon (varchar) — lucide 아이콘명
├── group (enum: core, content, commerce, system) — 분류
├── tags (jsonb, string[]) — 검색/필터용 태그
├── preview_images (jsonb, string[]) — 스크린샷 URL 목록
├── capabilities (jsonb, string[]) — "게시물 CRUD", "댓글", "SEO"
├── tech_stack (jsonb, object) — { server: ["NestJS"], client: ["React"] }
├── is_core (boolean) — 필수 Feature (auth, profile 등)
├── is_published (boolean) — 카탈로그 노출 여부
├── order (integer) — 표시 순서
├── created_at (timestamp)
├── updated_at (timestamp)
```

### feature_dependencies 테이블

Feature 간 의존성 그래프.

```
feature_dependencies
├── id (uuid, PK)
├── feature_id (uuid, FK → feature_catalog.id)
├── depends_on_id (uuid, FK → feature_catalog.id)
├── dependency_type (enum: required, recommended, optional)
├── created_at (timestamp)
```

### DB 선택 이유 (JSON 파일 대신)

- 카탈로그 페이지에서 tRPC로 조회 필요
- Admin에서 설명/이미지/순서 동적 관리
- 의존성 그래프 쿼리 (A 선택 → B도 필수)
- 고객 프로젝트에 포함된 Feature 추적

---

## Server Feature

### 디렉토리 구조

```
packages/features/feature-catalog/
├── index.ts
├── feature-catalog.module.ts
├── feature-catalog.router.ts
├── controller/
│   └── feature-catalog.controller.ts
├── service/
│   └── feature-catalog.service.ts
├── dto/
│   ├── index.ts
│   ├── create-feature-catalog.dto.ts
│   └── update-feature-catalog.dto.ts
└── types/
    └── index.ts
```

### Schema 위치

```
packages/drizzle/src/schema/features/feature-catalog/index.ts
```

### tRPC Procedures

| Procedure | Auth | 설명 |
|-----------|------|------|
| `catalog.list` | public | 카탈로그 목록 (필터: group, tags, 검색어) |
| `catalog.getBySlug` | public | 단일 Feature 상세 |
| `catalog.getDependencyGraph` | public | 선택한 Feature들의 의존성 트리 반환 |
| `catalog.validateSelection` | public | Feature 조합 유효성 검증 (필수 의존성 누락 체크) |
| `catalog.adminList` | admin | Admin용 전체 목록 (비공개 포함) |
| `catalog.adminCreate` | admin | Feature 등록 |
| `catalog.adminUpdate` | admin | Feature 수정 |
| `catalog.adminReorder` | admin | 순서 변경 |

### 핵심 서비스 로직: 의존성 해석

Feature A를 선택하면 → A가 requires하는 B, C도 자동 포함 → 재귀적 해석.

```
고객이 "blog" 선택
→ blog requires: auth, profile (core)
→ blog recommended: comment, reaction (widget)
→ 결과: { required: [auth, profile, blog], recommended: [comment, reaction] }
```

`validateSelection`은 선택된 Feature 조합에서 required 의존성 누락을 검출하고, recommended를 안내.

---

## Client Feature

### 공개 카탈로그 페이지 (apps/app)

| 라우트 | 페이지 | 설명 |
|--------|--------|------|
| `/features` | FeatureCatalogPage | 카드 그리드 + 필터 사이드바 |
| `/features/:slug` | FeatureDetailPage | 상세 페이지 |

**FeatureCatalogPage 구성**:
- 좌측: group/tag 필터 + 검색 입력
- 우측: Feature 카드 그리드 (아이콘, 이름, 설명, 태그)
- 카드 클릭 → 상세 페이지 이동

**FeatureDetailPage 구성**:
- Feature 이름, 설명, 스크린샷 갤러리
- 포함 기능(capabilities) 목록
- 의존성 표시 ("이 기능을 쓰려면 Auth, Profile이 필요합니다")
- "프로젝트에 추가" CTA 버튼 (2단계 Agent Desk 연동 시 활성화)

### Admin 페이지 (apps/system-admin)

| 라우트 | 페이지 | 설명 |
|--------|--------|------|
| `/admin/feature-catalog` | AdminCatalogListPage | Feature 목록 관리 (정렬, 공개 토글) |
| `/admin/feature-catalog/:id` | AdminCatalogEditPage | Feature 편집 (설명, 이미지, 의존성, 공개 여부) |

---

## 향후 확장 포인트 (MVP 미포함)

| 단계 | 기능 | 연결점 |
|------|------|--------|
| 2단계 | Agent Desk 연동 | `catalog.list` + `catalog.validateSelection`을 Agent Desk에서 호출 |
| 3단계 | Project Builder | 선택 조합 → monorepo 포크 → Feature 제거 → GitHub repo push |
| 4단계 | 멀티 테넌시 | Organization 스키마 → 프로젝트별 소유자 관리 |
| 5단계 | Upstream Sync | Product Builder 업데이트 → 고객 repo에 PR 자동 생성 |
