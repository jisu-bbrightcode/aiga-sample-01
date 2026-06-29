---
description: Product Builder 프로젝트에서 새 UI 컴포넌트를 생성합니다. React 19 + Tailwind + shadcn/Base-UI 컨벤션에 맞춰 파일을 생성하고 export를 설정합니다.
---

# Create Component

Product Builder 컨벤션에 맞는 UI 컴포넌트를 생성하는 워크플로우입니다.

## Step 1: 컴포넌트 유형 결정

사용자에게 어떤 종류의 컴포넌트인지 확인:
- **Feature 전용**: `apps/app/src/features/{name}/components/`
- **공유 UI**: `packages/ui/src/components/`
- **Widget**: `packages/widgets/src/{name}/`

## Step 2: 파일 생성

파일명은 **kebab-case**: `blog-card.tsx`, `rating-stars.tsx`

### 컴포넌트 템플릿

```tsx
import { cn } from "@repo/ui/lib/utils";

interface {Name}Props {
  className?: string;
  // props 정의
}

export function {Name}({ className, ...props }: {Name}Props) {
  return (
    <div className={cn("", className)}>
      {/* 구현 */}
    </div>
  );
}
```

### 규칙 적용
- Named Export만 (`export function`)
- Props interface를 컴포넌트 바로 위에 선언
- `cn()` 유틸리티로 className 병합
- Semantic Token만 사용
- 삼항 연산자로 조건부 렌더링

## Step 3: 하위 컴포넌트 분리

컴포넌트 내부에 하위 컴포넌트를 정의하지 않습니다.
파일 하단 `/* Components */` 섹션에 분리합니다.

```tsx
export function ParentComponent() {
  return <ChildComponent />;
}

/* Components */

function ChildComponent() {
  return <div>...</div>;
}
```

## Step 4: Export 설정

`index.ts`에서 public export를 설정합니다:
```tsx
export { BlogCard } from "./blog-card";
export { RatingStars } from "./rating-stars";
```

## Step 5: 검증

1. TypeScript 빌드 확인: `npx tsc --noEmit`
2. 사용처에서 import 후 브라우저 렌더링 확인
3. 스크린샷 캡처
