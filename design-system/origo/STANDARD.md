# Origo — 외주개발 표준 (STANDARD)

BBrightCode 외주개발 시 **반드시 따르는** 디자인 표준. 이 문서 + `tokens/` =
디자인 계약. 외주 개발자/AI 에이전트 모두 여기 토큰만 사용한다.

규칙 위반(하드코딩 색/임의 폰트/임의 spacing)은 리뷰에서 반려.

---

## 1. 토큰 사용 (필수)

- 색은 **하드코딩 금지**. `tokens/tokens.css`의 CSS 변수만 사용.
- 머신/빌드용은 `tokens/design-tokens.json`.
- 토큰은 **primitive → semantic** 2계층:
  - primitive: `--neutral-0..900`, `--green-base`, `--red-base`, `--Primary-800` …
  - semantic(우선 사용): `--text-main-900`, `--bg-weak-100`, `--icon-soft-400`, `--stroke-soft-200` …

```css
/* 좋음 */  color: var(--text-main-900); background: var(--bg-weak-100);
/* 나쁨 */  color: #0A0D14;             background: #F6F8FA;
```

## 2. 색 (요약)

| 역할 | 토큰 | 값 |
|------|------|-----|
| 본문 텍스트 | `--text-main-900` | `#0A0D14` |
| 보조 텍스트 | `--text-sub-500` | `#525866` |
| 약한 텍스트 | `--text-soft-400` | `#868C98` |
| 기본 배경 | `--bg-white-0` | `#FFFFFF` |
| 약한 배경 | `--bg-weak-100` | `#F6F8FA` |
| 외곽선 | `--stroke-soft-200` | `#E2E4E9` |
| 브랜드 | `--Primary-800` | `#0F5D66` |
| 성공 | `--green-base` | `#38C793` |
| 위험 | `--red-base` | `#DF1C41` |

전체: [COLORS.md](./COLORS.md)

## 3. 타이포그래피

- 폰트: **Inter**(기본 UI), **Manrope**(강조/버튼 일부). SF UI Display는 레거시 — 신규는 Inter로 대체.
- 본문 14–16px, 캡션 12px, 제목 20–30px, 히어로 40–56px.
- 전체 스케일: [TYPOGRAPHY.md](./TYPOGRAPHY.md)

## 4. 컴포넌트 / 아이콘

- 아이콘 69종 — Tabler + Vuesax 계열. 인벤토리: [COMPONENTS.md](./COMPONENTS.md)
- 신규 컴포넌트는 토큰 기반으로 구현, 임의 값 금지.
- 화면 레이아웃 레퍼런스: `assets/*.png` (4개 화면 썸네일).

## 5. 화면 템플릿 (Origo 4종)

| 화면 | 용도 | 썸네일 |
|------|------|--------|
| Project Management Dashboard | 프로젝트 대시보드 (토큰 정의 원본) | `assets/Project_Management_Dashboard.png` |
| Document Page Dashboard | 문서 페이지 | `assets/Document_Page_Dashboard.png` |
| Task Management Landing Page | 랜딩 | `assets/Task_Management_Landing_Page.png` |
| Timeline Page | 타임라인 뷰 | `assets/Timeline_Page_Project_Management_Dashboard.png` |

## 6. 권장 스택 (외주 가이드)

product-builder-base 정합: React + TypeScript + Tailwind v4(CSS 변수) + shadcn/ui.
`packages/ui` shadcn = **base-vega / neutral / cssVariables**.

shadcn 컴포넌트가 그대로 Origo 룩을 입도록:
- `tokens/shadcn-theme.css` → 외주 프로젝트 `packages/ui/src/styles/globals.css`
  의 `:root` 에 병합 (Origo semantic → shadcn `--background/--primary/--border/...` 매핑).
- 추가 토큰은 `tokens/tokens.css` import → `bg-bg-weak-100`, `text-text-main-900`
  식 유틸로 사용 (`@theme` 노출).
- AUTO-GENERATED 파일 — 직접 수정 금지, 추출기로만 갱신.

## 7. 변경 관리

원본은 Figma. 디자인 변경 → `.fig` 교체 → `design-system/scripts`에서 재생성 →
PR. 이 표준 파일은 **수기 편집 금지(AUTO-GENERATED 표기 파일)**, 추출기로만 갱신.
재생성 방법: [../README.md](../README.md)
