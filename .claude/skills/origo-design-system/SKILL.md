---
name: origo-design-system
description: >
  BBrightCode 외주개발 표준 디자인 시스템(Origo). 외주개발용 UI, 화면, 컴포넌트,
  랜딩, 대시보드를 만들거나 외주 산출물을 리뷰할 때, 또는 회사 디자인 토큰/색/폰트/
  컴포넌트 표준이 필요할 때 사용. Origo Figma(.fig)에서 추출한 토큰(design-tokens.json,
  tokens.css)·색·타이포·컴포넌트 인벤토리·화면 썸네일을 파일로 제공하며 오프라인 재생성
  가능. "외주 표준", "Origo", "디자인 토큰", "회사 디자인 시스템" 트리거.
---

# Origo Design System (외주개발 표준)

BBrightCode 외주개발 표준. 모든 산출물은 `design-system/origo/` 토큰만 사용.

## 작업 전 읽기 (순서)

1. `design-system/origo/STANDARD.md` — 외주개발 표준 계약 (규칙)
2. `design-system/origo/tokens/design-tokens.json` — 시맨틱 토큰 (머신)
3. `design-system/origo/tokens/tokens.css` — CSS 변수 (바로 import)
4. 필요 시: `COLORS.md` / `TYPOGRAPHY.md` / `COMPONENTS.md`
5. 레이아웃 참고: `design-system/origo/assets/*.png`

## 철칙

- 색/폰트/spacing **하드코딩 금지** → 토큰 변수만.
- semantic 토큰(`--text-main-900`, `--bg-weak-100`) 우선, primitive는 토큰 정의용.
- 폰트 Inter 기본, Manrope 강조. SF UI Display는 신규에 쓰지 말 것.
- 신규 컴포넌트도 토큰 기반.

## 토큰 갱신 (Origo .fig 바뀌면)

직접 토큰 파일 수정 금지 (AUTO-GENERATED). 추출기로만:
```bash
cd design-system/scripts && npm install
# .fig를 origo/source/ 교체 후
for f in ../origo/source/*.fig; do
  name=$(basename "$f" .fig | sed 's/Origo - //; s/ /_/g')
  node fig-extract.mjs "$f" "../origo/raw/$name"; done
node build-standard.mjs
```
상세: `design-system/README.md`

## shadcn 통합

`packages/ui` = shadcn base-vega/neutral. Origo 룩 적용:
`design-system/origo/tokens/shadcn-theme.css` → `packages/ui/src/styles/globals.css`
`:root` 병합. 추가 토큰은 `tokens.css` import.

## 같이 쓰기

시각 품질은 `frontend-design` 스킬 병행. 토큰만 사용, 하드코딩 금지.
