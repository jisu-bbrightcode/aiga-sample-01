# Origo Figma 추출 충실성 검증 보고서

작성: 2026-06-17 · 방법: 11-에이전트 적대 검증 워크플로(재현성·추출기감사·독립디코드·토큰역추적·Figma외부대조·적대합성) · run `wf_74ec07c7-63d`

## 최종 판정

| 축 | 판정 | 근거 |
|---|---|---|
| **재현성** | ✅ PASS | 4 .fig 재추출+재합성 → `git diff design-system/origo` = **0 라인**. 결정적. |
| **충실성(포착 범위 내 정확성)** | ✅ PASS | 추출기가 실제 Figma Variables(`type==='VARIABLE'` 노드)에서 토큰을 읽고 alias 재귀 resolve. 독립 디코드 4파일 **허위색 0개**. variables 34/34, components/instances/nodes 카운트 정확 일치. |
| **완전성** | ❌ FAIL | fillPaints SOLID만 집계 → stroke/effect(shadow)/gradient 색 **체계적 누락**. 파일당 13~22색 손실. |
| **외부대조(live Figma)** | ⚠️ BLOCKED | 인증 OK(bright@flotter.io)지만 프로젝트 URL만 있고 fileKey 없음·열거 도구 없음. |

**한 줄 결론: "분석된 31개 시맨틱 컬러 토큰은 실제 Figma Variables에 정확·재현성 있게 근거한다. 단 추출 범위가 fill SOLID로 좁아 stroke/그림자/그래디언트는 통째로 빠졌다 — '완전 분석'은 아님.**

## 핵심 사실

1. **시맨틱 토큰 31개 = 100% 검증.** unsourced 0, 누락 시맨틱변수 0, design-tokens.json↔tokens.css↔COLORS.md 일관. → **theme apply의 핵심 컬러(bg/fg/primary/secondary/muted/accent/border/destructive/success/ring)는 신뢰 가능.**
2. **토큰은 4파일 중 1파일(Project_Management_Dashboard)에만 존재.** 나머지 3파일은 variables 0 — 순수 레이아웃 템플릿. 디자인 시스템 토큰의 단일 출처.
3. **entity/chart hue 판정 — 근거 있음 + 단서.** `#6457F9`(83) `#0EA5E9`(35) `#D946EF`(13)는 4파일 모두 실제 SOLID fillPaint로 존재(임의값 아님). **그러나 Figma Variable(시맨틱 토큰)이 아니라 화면 픽셀 빈도색.** 31토큰 셋엔 없음. `.dark` 동일 hue는 light-only라 합성(추출 아님).

## 결함 (심각도순)

- **major** — strokePaints/effects(shadow,blur)/gradient stops 미추출. `fig-extract.mjs:96-105` fill SOLID만. effects 참조 0. → elevation/shadow/gradient 토큰 부재, stroke-only 브랜드색(`#7B61FF` 등) 누락. 외주가 그림자/외곽선/그래디언트 재현 불가.
- **major** — COLORS.md '사용 빈도' 팔레트 ≠ Figma Variable 토큰 (교집합 `#FFFFFF` 1개뿐). 최고빈도색(`#706F7F` 380회)은 토큰에 전무. 독자가 빈도색을 토큰으로 오인 위험.
- **minor** — variable mode `entries[0]`만 읽음 → 다중모드(다크/테마) .fig 입력 시 silent first-mode-only. 현 단일모드 소스는 실손실 0이나 잠재 버그.
- **minor** — 31토큰 단일파일 의존. 다파일 교차검증 부재.
- **minor** — `.dark` 시맨틱은 합성값, Origo 정본 검증 불가.
- **info** — 타이포 size/lh/ls만, align/decoration/paragraph 누락.

## 권고 (선택, 별도 작업)

1. (추출기) strokePaints/effects/gradient 추출 추가 → shadow/elevation/gradient 토큰. design-system scope.
2. (추출기) 다중모드 변수 읽기 수정(`entries[0]`→전 모드).
3. (문서) COLORS.md에 "빈도 팔레트 ≠ 시맨틱 토큰" 명시.
4. (theme) entity/chart hue는 데이터 근거 있음 → 유지 가능. 단 "토큰"이 아닌 "Origo 화면 추출색"으로 이해.

## 비고

- 검증은 작업트리 비파괴(재추출 후 `git checkout` 복원, 스크래치 제거). 현재 clean.
- live Figma 대조 원하면 개별 파일 URL(`figma.com/design/<fileKey>?node-id=<id>`) 필요.
