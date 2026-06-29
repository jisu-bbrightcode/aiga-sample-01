# Origo 추출기 보강 설계 — stroke/effect/gradient

작성: 2026-06-17 · 선행: 추출 검증 보고서(`2026-06-17-origo-extraction-verification.md`)가 fillPaints SOLID만 집계하는 완전성 결함(major) 식별.

## 목표

`fig-extract.mjs`가 누락하던 **strokePaints / DROP_SHADOW effects / linear gradients**를 추출하고, `build-standard.mjs`가 **shadow/gradient 토큰**을 합성하도록 보강. 검증된 데이터 손실(파일당 13~22색 + 그림자/그래디언트 전무) 복구.

## 락된 결정 (승인됨)

- shadow 11종 **전부** 추출(완전성, 노이즈컷 X).
- 범위 = **design-system 표준 산출물만** (`raw/*/extract.json`, `tokens/design-tokens.json`, `tokens/tokens.css`, `COLORS.md`). **packages/ui 테마 적용·shadcn-theme.css·다중모드 변수버그는 제외**(별도 작업).
- BLUR(FOREGROUND/BACKGROUND_BLUR) 제외 (YAGNI).
- shadow 토큰 = 빈도순 번호 `--shadow-N` (가짜 elevation 티어 X — 데이터 과해석 회피).
- gradient stops 정확, angle은 transform서 best-effort + 시각확인 권고.

## 확인된 kiwi 필드 (PMD 디코드)

- `node.effects[]`: `{type:DROP_SHADOW|FOREGROUND_BLUR|BACKGROUND_BLUR, color{r,g,b,a}, offset{x,y}, radius, spread, blendMode, ...}`
- `node.fillPaints[]` gradient: `{type:GRADIENT_LINEAR, stops:[{color{rgba},position}], transform{m00..m12}, opacity}`
- `node.strokePaints[]` SOLID: `{type:SOLID, color{rgba}, opacity, visible}` (fill과 동일 구조)

## 집계 사실 (4파일)

- distinct DROP_SHADOW 11, gradient(LINEAR) 8, stroke-only 색 3 (`#7B61FF` `#525062` `#E5E5E5`).

## 변경 — fig-extract.mjs

1. **stroke 색 합침**: 색 집계 루프가 `strokePaints`도 순회(fill과 동일 SOLID/visible/opacity 처리). → `colors[]` 46→49.
2. **shadows[]**: DROP_SHADOW만. key = `${inset?}${x}px ${y}px ${blur}px ${spread}px ${colorHex}` (INNER_SHADOW→`inset ` 접두). dedup, count. 정렬 count desc → css asc(결정적).
   - 항목: `{ x, y, blur, spread, color, inset, css, count }`.
3. **gradients[]**: type startsWith GRADIENT. stops=`[{color:hex, position:round2}]`. angle=transform서 산출. css=`linear-gradient(${deg}deg, ${stops})`. key=`${type}|${stops}`. dedup count. 정렬 count desc → css asc.
4. **stats**: `shadows`, `gradients` 카운트 추가.

angle 산출: `deg = ((round(atan2(m10,m00)*180/π)+90)%360+360)%360` (best-effort, 결정적).

## 변경 — build-standard.mjs

1. **shadow 합산**: 전 파일 `shadows[]` css 키로 count 합산 → 빈도순. `design-tokens.json.shadow = {"shadow-1": css, ...}` + tokens.css `--shadow-1: css;`.
2. **gradient 합산**: 동일 방식 → `design-tokens.json.gradient = {"gradient-1": css, ...}` + `--gradient-1: css;`.
3. **COLORS.md**: Shadow 섹션(번호·css·count) + Gradient 섹션 추가. 상단에 **"빈도 팔레트 ≠ 시맨틱 토큰"** 한 줄 면책(검증 결함#2 문서보완).
4. **summary**: shadows/gradients 카운트 추가.
5. tokens.css에 shadow/gradient 블록 append (기존 `:root{...}` 뒤 별도 `:root{}` 블록).

## 검증

1. 4 .fig 재추출 + build. extract.json에 shadows/gradients 존재, colors 49.
2. design-tokens.json에 shadow/gradient 키, tokens.css에 `--shadow-*`/`--gradient-*`.
3. **결정적 재현**: 연속 2회 재생성 → `git diff` 2회차 = 0.
4. 기존 31 시맨틱 토큰·타이포·컴포넌트 카운트 불변(회귀 없음).

## 비범위 (YAGNI)

packages/ui 적용, shadcn-theme.css shadow, 다중모드 변수버그, BLUR, 타이포 align/decoration. 전부 후속.
