---
description: shadcn/ui + Tailwind 4 사용 강제 룰. raw HTML form/button 금지, shadcn 컴포넌트 import 필수.
globs: "**/*.tsx,**/*.jsx"
alwaysApply: true
---

# shadcn/ui 사용 룰 (Iron Rule)

> 모든 폼/버튼/다이얼로그/카드/셀렉트/테이블은 **shadcn 컴포넌트**에서 import한다. raw HTML 금지.

---

## 1. shadcn 컴포넌트 위치

| 경로 | 용도 |
|------|------|
| `@repo/ui/shadcn` | shadcn registry — Button, Input, Dialog, Select, Card, Sheet, Skeleton, Tabs, Tooltip 등 |
| `@repo/ui` | Product Builder 공통 layouts (Feature, FeatureHeader, FeatureContents) |
| `packages/ui/components.json` | shadcn registry 설정 — `base-vega` 스타일 |

**작업 시작 전:** `packages/ui/components.json` + `packages/ui/src/shadcn/` 디렉토리 구조 확인.

---

## 2. 강제 import 매핑

| 사용 의도 | ❌ 금지 | ✅ 사용 |
|----------|--------|--------|
| 버튼 | `<button>`, `<a className="...">` | `import { Button } from "@repo/ui/shadcn/button"` |
| 인풋 | `<input>` (hidden/file 제외) | `import { Input } from "@repo/ui/shadcn/input"` |
| 셀렉트 | `<select>` | `import { Select, SelectContent, SelectItem, ... } from "@repo/ui/shadcn/select"` |
| 텍스트영역 | `<textarea>` | `import { Textarea } from "@repo/ui/shadcn/textarea"` |
| 다이얼로그/모달 | 자체 구현 | `import { Dialog, DialogContent, ... } from "@repo/ui/shadcn/dialog"` |
| 카드 | `<div className="border rounded p-4">` | `import { Card, CardHeader, CardContent } from "@repo/ui/shadcn/card"` |
| 슬라이드 패널 | 자체 구현 | `import { Sheet, SheetContent } from "@repo/ui/shadcn/sheet"` |
| 로딩 | `<div className="animate-pulse">` | `import { Skeleton } from "@repo/ui/shadcn/skeleton"` |
| 탭 | 자체 구현 | `import { Tabs, TabsList, TabsTrigger, TabsContent } from "@repo/ui/shadcn/tabs"` |
| 툴팁 | `title=""` | `import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/shadcn/tooltip"` |
| 드롭다운 | 자체 구현 | `import { DropdownMenu, ... } from "@repo/ui/shadcn/dropdown-menu"` |

**예외 (raw HTML 허용):**
- `<input type="hidden">`, `<input type="file">` — shadcn 미커버
- `<a>` — 라우팅 링크는 TanStack Router의 `<Link>` 사용
- `<form>` — 시맨틱 폼 컨테이너로 허용
- `<div>`, `<span>`, `<p>`, `<h1>` 등 구조 태그 — 허용

**우회는 PreToolUse hook이 차단합니다.** 정당한 예외는 파일 상단 코멘트로 사유 명시.

---

## 3. Tailwind 4 토큰만 사용

| ❌ 금지 | ✅ 사용 |
|--------|--------|
| `bg-[#FFA500]` | `bg-accent` 또는 `bg-[var(--accent)]` |
| `text-[#666]` | `text-muted-foreground` |
| `border-[#E5E5E5]` | `border-border` |
| `w-[120px]` | `w-md` 또는 `w-[var(--spacing-md)]` |
| `p-[17px]` | `p-md` (16px = `--spacing-md`) |
| `gap-[8px]` | `gap-sm` |
| `style={{ color: "#FFA500" }}` | className에 토큰 |
| `font-[Arial]` | `font-sans` |

**토큰 정의 위치:**
- `apps/app/src/styles.css` `@theme inline` 블록 — `--color-*`, `--spacing-*`, `--radius-*`

**spacing scale:**
| 토큰 | 값 | Tailwind |
|------|-----|----------|
| `--sp-2xs` / `--spacing-2xs` | 2px | `w-2xs`, `p-2xs` |
| `--sp-xs` / `--spacing-xs` | 4px | `w-xs`, `p-xs` |
| `--sp-sm` / `--spacing-sm` | 8px | `w-sm`, `p-sm` |
| `--sp-md` / `--spacing-md` | 16px | `w-md`, `p-md` |
| `--sp-lg` / `--spacing-lg` | 24px | `w-lg`, `p-lg` |
| `--sp-xl` / `--spacing-xl` | 32px | `w-xl`, `p-xl` |
| `--sp-2xl` / `--spacing-2xl` | 48px | `w-2xl`, `p-2xl` |
| `--sp-3xl` / `--spacing-3xl` | 64px | `w-3xl`, `p-3xl` |

이 스케일을 벗어나는 값이 정말 필요하면 공용 스타일 토큰에 먼저 추가하고 사용한다.

---

## 3.1 Typography 밀도

Typography 기준은 `docs/rules/frontend/typography.md`를 따른다.

- 제품 전체 dense UI 기본 크기는 `text-base`이다. 현재 기본값은 13px이다.
- `text-[13px]` 같은 arbitrary type size를 쓰지 않고 Tailwind text token을 사용한다.
- `text-sm`은 현재 12px이며 rare compact metadata에만 제한적으로 사용한다.
- `/designsystem > Typography`는 이 전역 기준을 보여주는 표면이지, 디자인시스템 내부 전용 규칙이 아니다.

---

## 4. 새 컴포넌트 추가 워크플로우

```bash
# 1. shadcn registry에 있는지 확인
cd packages/ui && cat components.json
ls src/shadcn/

# 2. 없으면 추가
npx shadcn@latest add <component-name>

# 3. 추가된 파일이 packages/ui/src/shadcn/에 들어가는지 확인
# 4. 다른 앱에서 import하여 사용
```

**임의로 자체 구현 금지** — shadcn registry에 있으면 무조건 그것 사용.

---

## 5. 검증 체크리스트 (작업 완료 전 자가 점검)

- [ ] `<button>`, `<input>`, `<select>`, `<textarea>` 직접 사용 0건 (예외 제외)
- [ ] `text-[#`, `bg-[#` 등 하드코딩 hex 0건
- [ ] `w-[숫자px]`, `p-[숫자px]` 등 arbitrary spacing 0건 (공용 spacing token 사용)
- [ ] `style={{ ... }}` 인라인 객체 0건
- [ ] 모든 form/dialog/card는 `@repo/ui/shadcn`에서 import

---

## 6. 위반 사례

- shadcn/Base-UI primitive를 쓰지 않고 raw form/control을 직접 구현
- 화면 목적과 무관한 탭/필터/CTA를 즉흥 추가
- 서버 데이터 로드 실패를 조용한 빈 화면으로 숨김
- 공용 토큰 대신 arbitrary value와 inline style로 화면을 구성

---

## 7. 강제 메커니즘

| 단계 | 도구 |
|------|------|
| **개발 중** | PreToolUse hook (`check-fe-shadcn-import.sh`) |
| **PR 단위** | Mira(Design Tester) 정적 코드 위반 검증 + 픽셀 비교 |
| **Code review** | Remy가 `@design-ref` 인용 정확성 검증 |
| **최종 게이트** | Iris 종합 판정 — Mira fail이면 PR 거부 |
