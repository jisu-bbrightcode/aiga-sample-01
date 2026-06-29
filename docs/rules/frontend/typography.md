---
description: Product Builder typography rules. Absolute type scale, base 14px. No arbitrary text-[Npx]. No relative calc.
globs: "apps/app/**/*.tsx, apps/admin/**/*.tsx, packages/ui/**/*.tsx, packages/widgets/**/*.tsx"
alwaysApply: true
---

# Typography Rules

이 규칙은 `/designsystem` 전용이 아니라 Product Builder 전체 제품 UI에 적용한다. `/designsystem > Typography`는 이 규칙을 시각적으로 검증하고 비교하는 표면이다.

## 1. 절대값 스케일 (single source: `packages/ui/src/typography.css`)

토큰은 **절대 px**다. 상대 `calc(var(--text-base-size) …)` 방식은 폐기했다 (이전에 `--text-xs == --text-sm == 12px` 로 위계가 붕괴됐었다). 사다리는 Tailwind 검증된 비율을 한 칸 내려 앵커한다 — Product Builder `text-base`(14) = Tailwind `text-sm`, Product Builder `text-lg`(16) = Tailwind `text-base`.

| token | px | 용도 |
|---|---|---|
| `text-2xs` | 11 | 극소 메타 (배지/카운트) |
| `text-xs` | 12 | compact metadata |
| `text-sm` | 13 | 보조 텍스트 (명시적으로 낮출 때) |
| **`text-base`** | **14** | **Dense UI 기본** — 목록 row, sidebar row, form label, popover option, toolbar |
| `text-lg` | 16 | 강조 본문, 소제목 |
| `text-xl` | 18 | 패널/카드 제목 |
| `text-2xl` | 20 | 섹션 제목 |
| `text-3xl` | 24 | 페이지 제목 |
| `text-4xl` | 30 | 대형 제목 |
| `text-5xl` | 36 | 디스플레이 |
| `text-6xl` | 48 | 히어로 |
| `text-7xl` | 60 | 히어로 (최대) |

Document editor body: `text-editor-sm`(14) / `text-editor-base`(15) / `text-editor-lg`(16) / `text-editor-xlg`(17).

## 2. 유저 text-size 설정

`<html data-text-size>` (apps/app `.../settings/_shared/use-text-size.ts`) 가 `md`(각 +1px) / `lg`(각 +2px) 레벨로 `--fs-*` 변수를 **레벨별 절대값**으로 덮어쓴다. calc 없음. 기본(속성 없음) = 위 표.

## 3. 구현 규칙 (필수)

- **`text-[Npx]` arbitrary class 금지.** 타입 크기를 직접 박지 않는다. 위 토큰만 사용한다.
- 기본은 `text-base`(14). `text-sm`/`text-xs`/`text-2xs` 는 "왜 보조/compact 인지"가 코드 주변에서 명확할 때만.
- 본문 dense UI 기본 = `text-base`. 설명/secondary 도 기본은 `text-base text-muted-foreground`, 무조건 작게 줄이지 않는다.
- line-height 는 토큰에 묶여 있지 않다 — 필요 시 `leading-*` 유틸로 별도 제어한다.
- 아이콘(lucide 글리프) 기본 크기 = `size-3.5`(14px). 의도된 대형만 `size-5`+.
- list-item / row 높이 = `h-8`(32px). 직접 px(`h-[28px]`) 금지.

## 4. 가드

CI/리뷰에서 in-scope(제외: `packages/ui/src/templates`, `shadcn-studio/blocks`, 빌드 산출물)에 `text-\[[0-9.]+px\]` 가 0 이어야 한다.
