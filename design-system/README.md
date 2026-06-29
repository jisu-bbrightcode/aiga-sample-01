# Origo Design System — 회사 표준 (외주개발용)

BBrightCode **외주개발 표준 디자인 시스템**. 원본은 Origo Figma 템플릿(`.fig`),
이 디렉토리는 그걸 **LLM·사람 모두 읽을 수 있는 파일**로 추출·박제한 것.

> 핵심: `.fig`(Figma 바이너리)는 LLM이 직접 못 읽음. 여기 추출기가
> `.fig` → kiwi 디코드 → 토큰/컴포넌트/이미지 **텍스트 산출물**로 변환한다.
> Figma 없이 오프라인으로 전부 재생성 가능.

## 무엇이 들어있나

```
design-system/
├── README.md                  ← 이 파일
├── origo/
│   ├── STANDARD.md            ← 외주개발 표준 계약 (반드시 읽기)
│   ├── tokens/
│   │   ├── design-tokens.json ← 시맨틱 토큰 (머신용, alias resolve 완료)
│   │   ├── tokens.css         ← CSS 변수 (외주 dev가 바로 import)
│   │   └── shadcn-theme.css   ← shadcn(base-vega) 변수 매핑 (packages/ui globals.css 병합)
│   ├── COLORS.md              ← 색 팔레트 + 시맨틱 토큰표
│   ├── TYPOGRAPHY.md          ← 폰트/타입 스케일
│   ├── COMPONENTS.md          ← 컴포넌트·아이콘 인벤토리
│   ├── assets/*.png           ← 각 화면 썸네일(시각 레퍼런스)
│   ├── source/*.fig           ← 원본 Figma 파일 (진실의 원천)
│   └── raw/<file>/extract.json← 파일별 원시 추출 (+ images/)
└── scripts/
    ├── fig-extract.mjs        ← .fig → extract.json 추출기
    └── build-standard.mjs     ← raw/* 합성 → 표준 산출물
```

## 재생성 (Origo 업데이트 시)

```bash
cd design-system/scripts
npm install                              # 1회 (kiwi-schema)
# 새 .fig를 origo/source/ 에 넣고:
for f in ../origo/source/*.fig; do
  name=$(basename "$f" .fig | sed 's/Origo - //; s/ /_/g')
  node fig-extract.mjs "$f" "../origo/raw/$name"
done
node build-standard.mjs                  # 토큰/문서 재생성
git add -A && git commit -m "chore(ds): Origo 토큰 재추출"
```

요구: Node ≥ 22 (zstd 내장), `unzip` CLI.

## LLM은 어떻게 "학습"하나

모델 weight 안 바뀜. 대신 매 작업 시 이 파일들을 컨텍스트로 로드:
- `.claude/skills/origo-design-system` 스킬이 자동 안내
- `tokens/design-tokens.json` + `STANDARD.md` 참조 → 일관된 UI 생성

원본 디자인 바뀌면 → 재생성 → git commit = "갱신된 학습".

## 원본 Figma

프로젝트: https://www.figma.com/files/project/540996291 (Origo 4파일)
폰트: Inter, Manrope (Google Fonts).
