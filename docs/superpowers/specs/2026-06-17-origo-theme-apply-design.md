# Origo 테마 적용 설계 — packages/ui shadcn

작성: 2026-06-17 · 브랜치 `design-system-origo-handoff` (base develop) · 선행: PR #8 (design-system/origo) develop 머지 완료

## 목표

Origo 디자인 시스템(`design-system/origo/tokens/`)의 실제 컬러를 회사 shadcn 테마
`packages/ui/src/styles.css`에 **전면 반영**. 기존 양피지/네이비/골드 데모 팔레트를 Origo 라이트 SaaS 팔레트로 교체.

## 락된 결정 (브레인스토밍)

1. **전면 교체** — 현재 테마는 worldbuilding 데모 placeholder. Origo가 진짜 DS.
2. **다크모드: Origo neutral 반전 파생** — Origo는 라이트 전용 → `.dark`는 합성(공식 아님).
3. **범위: 컬러만** — 폰트(Inter/Pretendard)·타입스케일(`typography.css`) 현행 유지.
4. **타깃: `packages/ui/src/styles.css`** `:root`+`.dark`만 수정. app/admin은 `@repo/ui/styles` import라 자동 전파.
5. **장식색: 안B(Origo-extended)** — entity 5종/chart 5종은 Origo 대시보드 파일서 추출된 별색으로 구별셋 구성.

## 구조 (변경 없음)

- 단일 소스: `packages/ui/src/styles.css` — `@theme inline`(변수→유틸 매핑, 유지) + `@layer base :root/.dark`(값, 교체).
- 소비자: `apps/app/src/styles.css`, `apps/admin/src/styles.css` (둘 다 `@import "@repo/ui/styles"` 후 오버라이드만). 변경 불필요.
- entity 변수 소비자: `meta-dot.tsx`, `entity-badge.tsx`(`bg-entity-*` 유틸), `relation-picker.tsx`/`lore-list-page.tsx`/`lore-translation-page.tsx`(`var(--entity-*)`). → 5종 모두 정의 유지 필수.
- `--background-warm` 소비자: `cover-picker-dialog.tsx`. → 정의 유지.

## Light `:root` 매핑 (Origo 시맨틱 직매핑)

| 변수 | 값 | Origo 출처 |
|---|---|---|
| `--background` | `#FFFFFF` | bg/white-0 |
| `--background-subtle` | `#F6F8FA` | bg/weak-100 |
| `--background-warm` | `#F6F8FA` | bg/weak-100 (warm 무정의 → weak) |
| `--foreground` | `#0A0D14` | text/main-900 |
| `--card` | `#FFFFFF` | neutral-0 |
| `--card-foreground` | `#0A0D14` | text/main-900 |
| `--popover` | `#FFFFFF` | neutral-0 |
| `--popover-foreground` | `#0A0D14` | text/main-900 |
| `--primary` | `#0F5D66` | Primary/800 |
| `--primary-foreground` | `#FFFFFF` | text/white-0 |
| `--secondary` | `#F6F8FA` | bg/weak-100 |
| `--secondary-foreground` | `#0A0D14` | text/main-900 |
| `--muted` | `#F6F8FA` | bg/weak-100 |
| `--muted-foreground` | `#525866` | text/sub-500 |
| `--accent` | `#E2E4E9` | bg/soft-200 |
| `--accent-foreground` | `#0A0D14` | text/main-900 |
| `--destructive` | `#DF1C41` | red/base |
| `--destructive-foreground` | `#FFFFFF` | text/white-0 |
| `--border` | `#E2E4E9` | stroke/soft-200 |
| `--border-subtle` | `#E2E4E9` | stroke/soft-200 |
| `--border-strong` | `#CDD0D5` | stroke/sub-300 |
| `--input` | `#E2E4E9` | stroke/soft-200 |
| `--ring` | `#868C98` | neutral-400 |
| `--radius` | `0.5rem` | Origo radius |
| `--surface-page` | `#FFFFFF` | bg/white-0 |
| `--surface-elevated` | `#FFFFFF` | neutral-0 |

신규: `--success: #38C793` (green/base) + `@theme inline`에 `--color-success: var(--success)` 추가.

## 장식색 — 안B (Origo 대시보드 추출 별색)

entity (기능 구별색):
- `--entity-world` `#0EA5E9` (sky) / `--entity-character` `#6457F9` (purple) / `--entity-location` `#38C793` (green) / `--entity-faction` `#D946EF` (magenta) / `--entity-codex` `#0F5D66` (teal)

chart:
- `--chart-1` `#0F5D66` / `--chart-2` `#38C793` / `--chart-3` `#0EA5E9` / `--chart-4` `#6457F9` / `--chart-5` `#D946EF`

레거시:
- `--accent-gold` → `#0F5D66` (teal로 흡수; 변수 자체는 소비자 호환 위해 유지)

## Dark `.dark` 매핑 (Origo neutral 반전 + 표면 합성)

| 변수 | 값 | 근거 |
|---|---|---|
| `--background` | `#0A0D14` | neutral-900 |
| `--background-subtle` | `#0A0D14` | = bg |
| `--background-warm` | `#14181F` | 합성 표면 |
| `--foreground` | `#F6F8FA` | neutral-100 |
| `--card` / `--popover` / `--surface-elevated` | `#14181F` | 합성 1단 |
| `--card-foreground` / `--popover-foreground` | `#F6F8FA` | neutral-100 |
| `--secondary` / `--muted` / `--accent` | `#1C2027` | 합성 2단 |
| `*-foreground`(secondary/accent) | `#F6F8FA` | neutral-100 |
| `--muted-foreground` | `#868C98` | neutral-400 |
| `--border` / `--border-subtle` / `--input` | `#2A2F38` | 합성 3단 |
| `--border-strong` | `#525866` | neutral-500 |
| `--primary` | `#2FA3AD` | teal 라이트닝(다크 대비) |
| `--primary-foreground` | `#0A0D14` | neutral-900 |
| `--destructive` | `#FB3748` | red 라이트닝 |
| `--destructive-foreground` | `#FFFFFF` | white |
| `--success` | `#38C793` | green/base |
| `--ring` | `#525866` | neutral-500 |
| `--surface-page` | `#0A0D14` | neutral-900 |
| entity / chart | light와 동일 | 다크서도 대비 OK |

`--radius`는 `:root`서만 정의(다크 동일). sidebar-* 변수는 현재 키 유지하되 위 매핑에 맞춰 갱신(primary→teal, bg→white/neutral-900 등).

## 검증

1. `pnpm --filter @repo/ui typecheck` + 영향 앱 빌드(`pnpm --filter app build` 또는 dev 기동).
2. 시각: `apps/app/src/pages/designsystem/designsystem-registry.tsx` 쇼케이스 페이지 라이트/다크 스크린샷.
3. 정책: raw error 무관(CSS only). i18n 무관.

## 비범위 (YAGNI)

- 폰트/타입스케일 교체 — 안 함.
- spacing/radius 추가 토큰 추출 — 안 함(별 작업).
- shadcn-theme.css(외주 dropin) 수정 — 안 함(이건 외주용, repo 적용은 styles.css 직접).
