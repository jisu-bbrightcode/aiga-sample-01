# PB-UI-001 — 디자인 시스템과 앱 셸 (Design System & App Shell)

- Issue: `BBR-501` `[PB-UI-001]`
- Blueprint: `온라인 서비스` (`online-service-standard`)
- Capability: `ui.design-system-shell`
- Decision (board): `NEW` · Agent role: Design Engineer
- Depends on: `PB-FOUND-001` (BBR-498) — **resolved** (foundation merged to `main`, PR #2)
- Derivation base: `product-builder-base@111d7721` (vendored snapshot)
- Target paths: `packages/*`, `apps/site` (issue `apps/web`), `apps/app`, `apps/admin`

## 1. Disposition: REUSE-derived design system + one EXTEND fix

Like `PB-FOUND-001`, the board decision was `NEW`, recorded **before** `PB-REPO-001`
seeded the delivery repo from `product-builder-base`. After seeding, the shared design
system already exists in-repo and is satisfied by **REUSE of the base**, with **one
genuine delta** found and fixed by this issue (admin token divergence).

Per the workflow rule "재사용 판정(REUSE/EXTEND)과 신규 구현(NEW)은 issue에서 명시적으로
분리한다", the layers are recorded explicitly below.

## 2. Design-system layers — state on entry (verified)

| Layer | Source of truth | site | app | admin |
|-------|-----------------|------|-----|-------|
| **Tokens** (color/radius/shadow/type) | `packages/ui/src/styles.css` (Origo) | ✅ `@import "@repo/ui/styles"` | ✅ `@import "@repo/ui/styles"` | ❌ **divergent** local theme |
| **Typography scale** | `packages/ui/src/typography.css` | ✅ (via styles) | ✅ (via styles) | ✅ |
| **Components** | `packages/ui/src/components/*`, `_shadcn/*` | ✅ | ✅ | ✅ |
| **App shell / layout** | `packages/ui/src/layouts/{sidebar-layout,compact-sidebar,sidebar-user-footer}` | header (`SiteHeader`) | ✅ `app-shell-01` | ✅ `admin-layout` |

- **Tokens** = `packages/ui/src/styles.css`: Origo palette (`--primary: #0f5d66` teal,
  Inter/Pretendard), `@theme inline` map, radius tiers, Origo elevation shadows, dark mode.
- **Shell components** are already shared: both `apps/app` and `apps/admin` import the
  same `@repo/ui/layouts/*` sidebar shell. ✅ (REUSE, no delta)

### The gap (the NEW delta this issue owns)

`apps/admin/src/styles.css` did **not** import `@repo/ui/styles`. It redeclared a separate
`@theme inline` block plus a generic shadcn **stone/oklch** palette (`--primary: oklch(0.22 …)`
near-black, font `"Instrument Sans"`). Result: the **same shared shell components rendered in
admin with a different color system and font** than site + app — a visible break of the
"공통 디자인 토큰을 공개 페이지·서비스 앱·관리자가 공유한다" capability promise.

## 3. Change (EXTEND)

`apps/admin/src/styles.css` — replace the `@import "tailwindcss"` + divergent `@theme inline`
+ `:root`/`.dark` token blocks with `@import "@repo/ui/styles"`, matching `apps/app/src/styles.css`
exactly. Preserved: `@plugin "@tailwindcss/typography"` (admin uses `prose` in
`features/community/pages/post-detail.tsx`), the `@source` scan roots, and the admin scrollbar
overrides. Net: **+5 / −121 lines**.

After the change all three surfaces resolve tokens from the single Origo layer, so admin now
shares the same primary/teal, neutrals, radius, shadows, dark mode, and Inter/Pretendard type as
site + app. The Origo `@theme inline` is a **superset** of admin's previous map (adds
`--success`, `--background-subtle`, `--border-subtle/strong`, `--surface-*`, entity colors,
shadow tiers), so every existing admin utility still resolves — the change only adds tokens and
swaps divergent **values** for the shared ones.

## 4. Acceptance criteria — evidence

| AC | Status | Evidence |
|----|--------|----------|
| 공개/서비스/관리자가 공유 디자인 토큰을 쓴다 | ✅ met | site, app, admin all `@import "@repo/ui/styles"` (Origo) after this change; no app-local `@theme`/`--primary` redefinition remains (`grep` clean in `apps/admin/src`) |
| 공유 컴포넌트·레이아웃 shell | ✅ met (REUSE) | `packages/ui/src/components/*` + `packages/ui/src/layouts/*`; `apps/app` and `apps/admin` both import `@repo/ui/layouts/{sidebar-layout,compact-sidebar,sidebar-user-footer}` |
| Product Builder 고정 템플릿 task 유지 (삭제 금지) | ✅ met | recorded REUSE-derived + EXTEND, not removed |
| 공개 페이지 비로그인 탐색 + 보호 액션 auth 모달 | ✅ unaffected | shell/token change only; auth-modal pattern owned by `auth/public-action-modal` (PB-AUTH track) |

> Runtime Tailwind compile is exercised by the same `@import "@repo/ui/styles"` resolution that
> `apps/site` + `apps/app` already build with (same workspace, same relative depth); full deploy
> verification runs under the Vercel deploy gate (PB-INFRA-001, BBR-499).

## 5. Handoffs

- **PB-INFRA-001 (BBR-499):** Vercel build/deploy of `aiga-admin` will exercise the unified
  token compile end-to-end.
- **PB-WEB-001 / PB-ADMIN-* / FEAT-*:** build pages on top of the now-unified design system;
  do not reintroduce app-local token blocks — extend tokens in `packages/ui/src/styles.css`.
