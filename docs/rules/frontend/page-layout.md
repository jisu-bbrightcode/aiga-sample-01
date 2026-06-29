---
description: 페이지 컴포넌트 레이아웃 규칙 (Feature, FeatureHeader, FeatureContents)
globs: "apps/app/**/routes/**/*.tsx, apps/admin/**/routes/**/*.tsx"
alwaysApply: false
---

# Page Layout Rules

> 라우트에서 렌더링하는 페이지 컴포넌트의 레이아웃 규칙

---

## 1. 페이지 컴포넌트 구조

모든 페이지는 `Feature` → `FeatureHeader` → `FeatureContents` 3단 구조를 따른다.

```typescript
import { Feature, FeatureHeader, FeatureContents } from "@repo/ui";

function BlogListPage() {
  return (
    <Feature>
      <FeatureHeader
        title="블로그"
        description="최신 게시물을 확인하세요"
        actions={<Button>새 글 작성</Button>}
      />
      <FeatureContents>
        <BlogList />
      </FeatureContents>
    </Feature>
  );
}
```

---

## 2. Feature 컴포넌트

| 컴포넌트 | import | 역할 |
|----------|--------|------|
| `<Feature>` | `@repo/ui/components/feature` | 페이지 전체 컨테이너 |
| `<FeatureHeader>` | `@repo/ui/components/feature-header` | 제목, 설명, 액션 버튼 |
| `<FeatureContents>` | `@repo/ui/components/feature-contents` | 메인 콘텐츠 영역 |

### FeatureHeader Props

| Prop | 타입 | 설명 |
|------|------|------|
| `title` | `string` | 페이지 제목 (필수) |
| `description` | `string?` | 부제목/설명 |
| `actions` | `ReactNode?` | 우측 액션 버튼 영역 |
| `breadcrumbs` | `BreadcrumbItem[]?` | 경로 표시 |

### FeatureContents Props

| Prop | 타입 | 설명 |
|------|------|------|
| `padding` | `"none" \| "sm" \| "md" \| "lg"` | 내부 패딩 (기본: `"md"`) |

---

## 3. 라우트 파일과 페이지 분리

| 위치 | 역할 | 예시 |
|------|------|------|
| `routes/{name}.tsx` | 라우트 정의 + 페이지 컴포넌트 | `createRoute()` + `BlogListPage` |
| `pages/{name}.tsx` | 메인 콘텐츠 컴포넌트 | `BlogList` (데이터 + UI 로직) |

- 라우트 파일: `Feature` 레이아웃 조립만 담당
- 페이지 파일: 비즈니스 로직과 데이터 표시 담당
- 페이지가 단순하면 라우트 파일에 인라인 작성 허용
