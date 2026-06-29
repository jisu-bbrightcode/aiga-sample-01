# Feature Catalog 페이지 설계

> 개발자용 시각적 Feature 인벤토리 — 시스템 전체 기능을 한눈에 파악하는 대시보드

## 목적

- 개발/QA 참고용 Feature 카탈로그
- 개발 완료 후 항상 업데이트하여 시스템과 동기화
- 모든 기능이 시각적으로 나열되어야 유지 가능

## 핵심 결정사항

| 항목 | 결정 |
|------|------|
| 데이터 소스 | 정적 TypeScript 상수 파일 (서버 API 불필요) |
| 접근 방식 | 사이드바 메뉴 "Feature 카탈로그" → `/features` |
| Feature 클릭 | 아코디언 펼치기 + 각 항목에 이동 링크 |
| 정보 수준 | 그룹별 구분, 간결 카드 + 펼치면 상세 (서비스, 테이블, 라우트) |

## 페이지 구조

```
/features
├── FeatureHeader: "Feature 카탈로그" + 검색/필터
├── 상단 요약 카드 (전체/서버/클라이언트/위젯 개수)
└── 그룹별 섹션 (Collapsible)
    └── Feature 카드 (Accordion)
        ├── 접힌 상태: 아이콘 + 이름 + 설명 + 상태 Badge
        └── 펼친 상태: Pages(링크) + Services + Tables
```

## 데이터 구조

```typescript
interface FeatureCatalogItem {
  id: string;
  name: string;
  icon: string;
  description: string;
  group: "core" | "content" | "ai-creative" | "marketing" | "commerce" | "system" | "widget";
  type: "page" | "widget" | "agent";
  pages: { label: string; path: string }[];
  services: string[];
  tables: string[];
  status: "active" | "wip" | "planned";
}
```

## 그룹 분류

| 그룹 | Features |
|------|----------|
| Core | Auth, Profile, Role-Permission |
| Content | Blog, Board, Community, Course, Data Tracker |
| AI / Creative | Content Studio, AI Image, Story Studio, Agent Desk |
| Marketing | Marketing |
| Commerce | Payment, Booking, Coupon |
| System | Notification, Analytics, Audit Log, Scheduled Job, Email |
| Widget | Comment, Reaction, Review, Bookmark, File Manager, Onboarding |

## 파일 구조

```
apps/app/src/features/feature-catalog/
├── index.ts
├── routes/
│   └── index.ts
├── pages/
│   └── feature-catalog-page.tsx
├── components/
│   ├── feature-group-section.tsx
│   ├── feature-card.tsx
│   └── catalog-summary.tsx
└── data/
    └── feature-catalog.ts
```

## UI 컴포넌트

- Feature / FeatureHeader / FeatureContents (레이아웃)
- Card (요약 통계)
- Collapsible (그룹 접기/펼치기)
- Accordion (Feature 상세)
- Badge (status, type)
- Input (검색)
- Link (페이지 이동)

## 운영 규칙

feature 개발 완료 후 `feature-catalog.ts`에 항목 추가/수정 필수.
