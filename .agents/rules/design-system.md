---
description: Product Builder 디자인 시스템 — UI 컴포넌트, 토큰, 패턴. TSX 파일 작업 시 적용.
activation: glob
glob: "**/*.tsx"
---

# Design System & UI Components

## packages/ui Structure

```
packages/ui/src/
├── components/     # 단일 기능 컴포넌트 (Button, Card, Feature)
├── blocks/         # 컴포넌트 묶음 템플릿 (SignInForm, PricingTable)
└── layouts/        # Application Shell (SidebarLayout, DashboardLayout)
```

## 핵심 컴포넌트 Import

```tsx
// 페이지 레이아웃
import { Feature, FeatureHeader, FeatureContents } from "@repo/ui";

// shadcn/ui 컴포넌트
import { Button } from "@repo/ui/shadcn/button";
import { Card, CardContent, CardHeader } from "@repo/ui/shadcn/card";
import { Input } from "@repo/ui/shadcn/input";
import { Dialog, DialogContent, DialogTrigger } from "@repo/ui/shadcn/dialog";

// Form 컴포넌트
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@repo/ui/shadcn/form";
```

## Color Tokens (Semantic)

하드코딩 색상 금지. Semantic Token만 사용:

| Token | Usage |
|-------|-------|
| `bg-background` / `text-foreground` | 기본 배경/텍스트 |
| `bg-muted` / `text-muted-foreground` | 보조 배경/텍스트 |
| `bg-primary` / `text-primary-foreground` | 주요 액션 |
| `bg-destructive` | 삭제/위험 액션 |
| `bg-card` | 카드 배경 |
| `border` | 테두리 |
| `ring` | 포커스 링 |

```tsx
// ✅ Semantic Token
<div className="bg-background text-foreground">
<Button className="bg-primary text-primary-foreground">

// ❌ 하드코딩 색상
<div className="bg-white text-gray-900">
<Button className="bg-blue-600 text-white">
```

## Spacing System

Tailwind 기본 스케일 사용:
- `gap-1` (4px), `gap-2` (8px), `gap-3` (12px), `gap-4` (16px)
- `p-4` (16px), `p-5` (20px), `p-6` (24px)
- `space-y-2`, `space-y-4` for vertical stacking

## Form Pattern (React Hook Form + Zod)

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@repo/ui/shadcn/form";

const schema = z.object({
  title: z.string().min(1, "제목을 입력하세요"),
  content: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

function CreateForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", content: "" },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem>
            <FormLabel>제목</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit">저장</Button>
      </form>
    </Form>
  );
}
```

## Mobile Scaffold (모바일 프로세스 화면)

```tsx
import { Scaffold, ScaffoldHeader, ScaffoldContent, ScaffoldFooter } from "@repo/ui/mobile/scaffold";
import { ScaffoldCTAButton } from "@repo/ui/mobile/scaffold-cta-button";

function MobilePage() {
  return (
    <Scaffold variant="secondary">
      <ScaffoldHeader title="타이틀" onBack={handleBack} />
      <ScaffoldContent>
        {/* 콘텐츠 */}
      </ScaffoldContent>
      <ScaffoldFooter>
        <ScaffoldCTAButton onClick={handleNext}>다음</ScaffoldCTAButton>
      </ScaffoldFooter>
    </Scaffold>
  );
}
```

## Data Table Pattern

Structure-First Loading 필수:
```tsx
// ✅ 구조 먼저, 데이터 영역만 로딩
<TableHeader>{/* 항상 렌더 */}</TableHeader>
{isLoading ? <TableSkeleton /> : <TableBody data={data} />}

// ❌ 전체 교체 금지
if (isLoading) return <FullSkeleton />;
```
