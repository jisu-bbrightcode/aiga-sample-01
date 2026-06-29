# PB-FOUND-001 — Next.js 온라인 서비스 프로젝트 세팅 (Foundation)

- Issue: `BBR-498` `[PB-FOUND-001]`
- Blueprint: `온라인 서비스` (`online-service-standard`)
- Capability: `stack.nextjs-service`
- Depends on: `PB-REPO-001` (BBR-497) — **resolved**; delivery repo seeded
- Derivation base: `product-builder-base@111d7721` (vendored snapshot, NOT a fork)
- Delivery repo: `jisu-bbrightcode/aiga-sample-01` · default branch `main`

## 1. Disposition: REUSE-derived foundation (NEW delta = this document + handoffs)

The original board decision was `NEW`, recorded **before** `PB-REPO-001` seeded the
delivery repo. After seeding, `main` is a vendored derivation of `product-builder-base`,
so every PB-FOUND-001 deliverable — Next.js app, routing/layout, env structure, quality
gates, Vercel config — **already exists in-repo and is satisfied by REUSE of the base**.

Per the issue workflow rules ("재사용 판정(REUSE/EXTEND)과 신규 구현(NEW)은 issue에서
명시적으로 분리한다" / "고객별 구현은 product-builder-base에서 파생되는 구조다"), the
foundation is therefore recorded as **REUSE-derived**. The genuine NEW delta owned by this
issue is: (a) pin the derivation, (b) document the customer build/typecheck/lint/deploy
commands, (c) define Vercel env naming, (d) record acceptance evidence, and (e) hand off
customer-specific implementation to downstream issues. No app is scaffolded from scratch
(that would duplicate the vendored base).

## 2. App topology (verified on `origin/main`)

| App | Path | Stack | Public? | Vercel `framework` | Dev port |
|-----|------|-------|---------|--------------------|----------|
| Public site (issue `apps/web`) | `apps/site` | **Next.js 16 App Router** | public, browsable without login | `nextjs` | 3004 |
| Logged-in app | `apps/app` | **Vite 6 + React 19 SPA** | gated | `vite` (SPA rewrite → `/index.html`) | 3000 |
| Admin entry | `apps/admin` | **Vite 6 + React 19 SPA** | gated | `vite` (SPA rewrite) | 3001 |
| API server | `apps/server` | NestJS | — | (server) | 3002 |

> Note: the issue's `apps/web` maps to base `apps/site`. SEO/AEO/GEO public pages stay on
> Next.js (SSR + metadata); `apps/app` and `apps/admin` are SPAs and must be planned as
> Vite/React routes with SPA rewrites, **not** Next.js pages.

Shared packages: `packages/{core,data,drizzle,features,ui,widgets,api-client,shared,typescript-config}`.

## 3. Routing / layout entry points

- Public layout + metadata: `apps/site/src/app/layout.tsx` (App Router root, typed `Metadata`).
- Public landing: `apps/site/src/app/page.tsx`.
- **Customer assembly manifest:** `apps/site/src/config/site.config.ts` — the single file a
  builder edits to set product `name`, `locale`, and toggle modules/auth providers. AIGA
  branding/config lands here (handed off to PB-WEB-001 — see §7).

## 4. Build / typecheck / lint / deploy commands (AC#2)

Run from repo root (`pnpm@11.1.1` + Turborepo). Workspace install: `pnpm install`.

| Purpose | Command |
|---------|---------|
| Build all | `pnpm build` (`turbo run build`) |
| Build one app | `pnpm --filter site build` / `--filter app` / `--filter admin` |
| Dev (all) | `pnpm dev` (`turbo run dev`) |
| Typecheck | `pnpm check-types` (`turbo run check-types`; per-app `tsc --noEmit`) |
| Lint (changed) | `pnpm lint` (`scripts/biome-changed.mjs`) |
| Lint (oxlint) | `pnpm lint:oxlint` |
| Format check | `pnpm format:check` |
| Copy/paste check | `pnpm copycheck` |
| Test | `pnpm test` (`turbo run test`) |
| Vercel deploy gate | `pnpm verify:vercel-gate` (`scripts/verify-vercel-deploy-gate.mjs`) |
| Neon branch (CI/preview DB) | `pnpm db:branch:new` / `db:branch:url` / `db:branch:rm` |

**Quality gate** (pre-merge, per `PB-REPO-001` branch strategy): `turbo build` +
`check-types` + Biome + `pnpm verify:vercel-gate`. Husky + commitlint enforced on commit.

## 5. Vercel env naming convention (AC#4)

Reference files: root `.env.example` (full canonical naming), `.env.demo.reference`,
per-app `apps/*/.env.example`. DB + deploy fixed to **Neon + Vercel**.

**One Vercel project per deployable app**, each pointed at its `apps/<app>/vercel.json`:

| Vercel project | Root dir | Framework | Public env prefix |
|----------------|----------|-----------|-------------------|
| `aiga-site` | `apps/site` | Next.js | `NEXT_PUBLIC_*` |
| `aiga-app` | `apps/app` | Vite | `VITE_*` |
| `aiga-admin` | `apps/admin` | Vite | `VITE_*` |
| `aiga-server` | `apps/server` | Node | (server-only, no public prefix) |

Env var groups (names from `.env.example`, set per Vercel Environment
Production/Preview/Development):

- **Database (Neon):** `DATABASE_URL` (pooled). Preview branches via `pnpm db:branch:*`.
- **Identity / auth (better-auth):** `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
  optional `BETTER_AUTH_COOKIE_DOMAIN`, `CORS_ORIGINS`.
- **OAuth providers:** `GOOGLE_CLIENT_ID/SECRET`, `LINKEDIN_CLIENT_ID/SECRET`,
  Kakao/Naver (generic OAuth) — callback URL pattern documented in `.env.example`.
- **Client URLs:** `VITE_API_URL` (app/admin), `APP_URL`, `PORT`.
- **Naming rule:** browser-exposed values **must** carry `NEXT_PUBLIC_` (site) or `VITE_`
  (app/admin); everything else is server-only and never prefixed.

> Actual provisioning (create Vercel projects, set secrets, Neon project/branch, domains,
> health checks) is **PB-INFRA-001 (BBR-499)** — see §7. This section fixes the *naming
> contract* those provisioning steps must follow; it does not store any secret value.

## 6. Acceptance criteria — evidence

| AC | Status | Evidence (on `origin/main`) |
|----|--------|------------------------------|
| 공개 페이지가 SSR/metadata를 사용할 수 있다 | ✅ met | `apps/site/src/app/layout.tsx` exports typed `Metadata` (title template + description); Next 16 App Router; `apps/site/vercel.json` `framework: nextjs` |
| 빌드/타입체크/린트 명령이 문서화되어 있다 | ✅ met | §4 above; scripts in root + `apps/site/package.json` |
| 고객별 구현은 product-builder-base에서 파생되는 구조다 | ✅ met | `main` is a vendored snapshot of `product-builder-base@111d7721` (single root commit), customer edits flow through `site.config.ts` assembly manifest |
| Vercel 배포를 전제로 한 env naming이 정리되어 있다 | ✅ met | §5; per-app `vercel.json` + `.env.example` |

## 7. Handoffs (customer-specific NEW/EXTEND, owned downstream)

- **PB-INFRA-001 (BBR-499):** create Vercel projects per §5, wire Neon + secrets, domains,
  health checks, production-readiness evidence.
- **PB-WEB-001/002:** AIGA branding + public SEO/AEO/GEO pages — edit
  `apps/site/src/config/site.config.ts` (`name`/`locale`/modules) and add App Router routes;
  rebrand the Flotter-default values in `.env.example`/`site.config.ts`.
- **FEAT-FR-*-APP / PB-ADMIN-*:** logged-in app + admin features as Vite/React routes
  (SPA rewrites already configured), gated behind the auth-modal pattern.

## 8. Upgrade policy

Base is source of truth. To pull base improvements, re-vendor by **pinned SHA** (not merge):
record the new `product-builder-base` SHA, vendor the snapshot onto a `feat/*` branch, and
PR → `main`. Flotter features are **reference-only**, never copied wholesale.
