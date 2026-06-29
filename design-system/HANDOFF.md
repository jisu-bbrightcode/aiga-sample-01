# HANDOFF — Origo 디자인 시스템 (외주개발 표준)

작성: 2026-06-17 · 브랜치 `feature/design-system-origo` · 커밋 `9cb30040` · PR [#8](https://github.com/BBrightcode-atlas/product-builder-base/pull/8) (base `develop`, 머지 대기)

---

## 1. 한 줄 요약

Origo Figma 템플릿(`.fig` 4종)을 **LLM·사람이 읽는 파일 표준**으로 박제했다.
`.fig`는 바이너리라 직접 못 읽음 → 추출기가 토큰/색/타이포/컴포넌트/이미지를
텍스트로 변환. **Figma 없이 오프라인 재생성** 가능.

## 2. 왜 이렇게 했나 (결정 기록)

- **`.fig` 직접 학습 불가** → kiwi 디코드로 텍스트 추출이 유일한 길.
  - `.fig` = ZIP → `canvas.fig`(magic `fig-kiwi`) → [deflate schema] + [zstd data] → kiwi 메시지.
  - Node ≥ 22 `zlib.zstdDecompressSync` 내장 활용 (외부 zstd 불필요, cli fallback 있음).
- **내부 `ui/`(Paperclip 다크테마) 오염 금지** → Origo(라이트)는 별도 `design-system/`에 격리.
  외주 프로젝트는 자기 shadcn에 `shadcn-theme.css`만 병합.
- **AUTO-GENERATED 원칙** → 토큰/문서 수기수정 금지. `.fig` 교체 후 추출기로만 갱신.
- **repo 경량화** → raw 이미지·node_modules·package-lock gitignore (source `.fig`에서 재생성).

## 3. 산출물 지도

```
design-system/
├── README.md                      재생성 방법 + 디렉토리 설명
├── HANDOFF.md                     이 문서
├── origo/
│   ├── STANDARD.md                ★ 외주개발 표준 계약 (규칙)
│   ├── tokens/
│   │   ├── design-tokens.json     시맨틱 토큰 31 (머신, alias resolve 완료)
│   │   ├── tokens.css             CSS 변수 (--text-main-900 등)
│   │   └── shadcn-theme.css       ★ Origo→shadcn 변수 매핑 (외주 dropin)
│   ├── COLORS.md / TYPOGRAPHY.md / COMPONENTS.md
│   ├── assets/*.png               화면 4종 썸네일
│   ├── source/*.fig               원본 (진실의 원천)
│   └── raw/<file>/extract.json    파일별 원시 추출 (images/는 gitignore)
└── scripts/
    ├── fig-extract.mjs            .fig → extract.json
    ├── build-standard.mjs         raw/* 합성 → 표준 산출물
    └── package.json               의존: kiwi-schema
```

LLM 자동 로드: `.claude/skills/origo-design-system/SKILL.md`

## 4. 토큰 체계

- **primitive**: `neutral/0..900`, `green/teal/red/*`, `Primary-800`, `Secondary-400`
- **semantic(우선 사용)**: `text/main-900`, `text/sub-500`, `bg/weak-100`, `bg/white-0`,
  `icon/soft-400`, `stroke/soft-200` …
- 폰트: **Inter**(기본 UI) / **Manrope**(강조). SF UI Display = 레거시, 신규 금지.
- 통계: 토큰 31 · 색 46 · 타입스타일 30 · 아이콘 69 · 컴포넌트 2(Interaction, Property 1)
  - Origo는 **페이지템플릿 중심** → 컴포넌트 라이브러리 빈약. 외주는 토큰 기반 직접 구현.

## 5. 재생성 (Origo `.fig` 갱신 시)

```bash
cd design-system/scripts && npm install          # 1회 (kiwi-schema)
# 새 .fig를 ../origo/source/ 에 교체 후:
for f in ../origo/source/*.fig; do
  name=$(basename "$f" .fig | sed 's/Origo - //; s/ /_/g')
  node fig-extract.mjs "$f" "../origo/raw/$name"
done
node build-standard.mjs
git add -A && git commit -m "chore(ds): Origo 토큰 재추출"
```

요구: Node ≥ 22, `unzip` CLI.
재현성 검증됨 (raw 삭제 → 재생성 → `git diff` = 0).

## 6. 외주 프로젝트 연동 (shadcn)

회사 shadcn = new-york / Tailwind v4 / cssVariables / baseColor neutral.
외주는 동일 설정 후 `origo/tokens/shadcn-theme.css`를 globals.css `:root`에 병합 →
`bg-bg-weak-100`, `text-text-main-900` 식 유틸 사용.

## 7. 다음 작업 (TODO)

- [ ] PR #8 리뷰·머지
- [ ] `shadcn-theme.css` 실제 외주 샘플 프로젝트에서 E2E 검증 (변수 충돌 확인)
- [ ] spacing/radius 토큰 추출 — 현재 색/타이포 위주, 레이아웃 토큰 미추출
- [ ] Origo 외 회사 자체 컴포넌트 표준 추가 시 `design-system/<name>/`로 확장
- [ ] (선택) Figma MCP로 컴포넌트 props/variant 보강 — 프로젝트 540996291

## 8. 함정 메모

- `.fig` ZIP 엔트리명에 공백 → 스크립트는 `unzip -p` + basename 처리로 회피.
- data 블록 = **zstd**(magic `28 b5 2f fd`), schema 블록 = **deflate**. 혼동 주의.
- alias 토큰은 `assetRef.key` 참조 → key→변수 맵으로 resolve (재귀 depth 10 제한).
- 아이콘 분류: `Icon/`·`vuesax/`·`*/outline|bold|fill/*`·소문자-dash → 아이콘으로 폴드.
