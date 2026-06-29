# Demo deploy — Neon + Vercel (validated 2026-06-15)

> `product-builder-base` 를 Neon(Postgres) + Vercel 에 CLI prebuilt 로 올리는
> 검증된 시퀀스. 인프라 코드(`vercel.json` x4, neon 스크립트)는 이미 존재.
> 계정 creds 는 자매 시스템 `/Users/bright/Projects/flotter/.env.local` 참조.
> 관련: [vercel-deploy-gate.md](./vercel-deploy-gate.md)

## 현재 데모 (live)

| 앱 | URL | 메커니즘 |
|---|---|---|
| app | https://product-builder-app-mu.vercel.app | CLI prebuilt (static BOA) |
| api | https://product-builder-api.vercel.app | CLI prebuilt (`vercel-output.js`) |
| admin | https://product-builder-admin.vercel.app | CLI prebuilt (static BOA) |
| ai-runtime | https://product-builder-ai-runtime.vercel.app | git-integration (develop, Vercel API) |

- Neon project: `product-builder-demo` (id `broad-bird-22259476`, org `org-fancy-hill-71463823`, us-east-2, pg17)
- super-user: `demo@product-builder.test` (pw in `.context/seed-password.txt`, `email_verified=true`)
- Vercel scope: `bb-rightcode` (team BBrightcode)

## 0. 사전 준비

- `neonctl` account 인증: `npx neonctl auth` (브라우저 승인). **flotter 의 `NEON_API_KEY` 는 project-scoped 라 신규 project 생성 불가** — 반드시 account oauth.
- `vercel` 인증: `vercel whoami` (이미 `bright-5194` / `bb-rightcode`).
- 계정 creds 는 flotter `.env.local` 에서 복사 (RESEND/BLOB/AI/INNGEST/POLAR/OAuth).
- 신규 생성: `BETTER_AUTH_SECRET`(`openssl rand -base64 32`), seed pw.

## 1. Neon + 스키마 + 시드

```bash
npx neonctl projects create --name product-builder-demo --org-id <org> --output json
npx neonctl connection-string --project-id <id>            # direct
npx neonctl connection-string --project-id <id> --pooled   # pooled (runtime)
```

`.env.local` 작성: `DATABASE_URL`=direct + flotter 계정 creds + 신규 secret +
`APP_URL`/`BETTER_AUTH_URL`/`VITE_API_URL` (실제 도메인은 2단계 후 확정).

**스키마는 `db:push` (migrate 아님).** migration 0004 가 `sync_changelog.changed_by`(uuid)
→ `profiles.id`(text) FK 를 만들어 fresh replay 시 깨진다 (현재 schema 엔 없음, 0040 에서 drop).
fresh/empty DB 라 destructive flag 안전:

```bash
PRODUCT_BUILDER_DB_ALLOW_DESTRUCTIVE=1 pnpm --filter @repo/drizzle exec drizzle-kit push --force
pnpm db:seed:demo    # super-user(+profile 자동) + payment-catalog + email_verified
```

> `db:seed:profiles`(Supabase `auth.users` 가정) 와 `db:seed:lore-a4`(기존 project 필요)
> 는 이 아키텍처에 부적합 — `seed-demo.mjs` 에서 제외됨. profiles 는 better-auth
> 가입 훅(`packages/core/auth/server.ts`)이 자동 생성.

시드 후 `.env.local DATABASE_URL` 을 pooled 로 교체.

## 2. Vercel — CLI prebuilt (앱별)

각 프로젝트 `vercel link --yes --project <name> --scope bb-rightcode` 로 생성.
`cd ../..` 빌드커맨드 때문에 **단순 `vercel deploy` 로는 안 됨 → prebuilt** 사용.

**api** (serverless):
```bash
pnpm --filter server build
node apps/server/scripts/vercel-output.js          # → apps/server/.vercel/output
cd apps/server && vercel deploy --prebuilt --prod --yes --scope bb-rightcode
```
runtime env (`vercel env add KEY production`): `DATABASE_URL`(pooled),
`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_URL`, `CORS_ORIGINS`(실 app,admin),
`EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`, `GEMINI_API_KEY`,
`INNGEST_*`, `BLOB_READ_WRITE_TOKEN`. **env 변경 시 재배포 필요** (함수에 deploy 시 주입).

**app / admin** (SPA static):
```bash
VITE_API_URL=https://product-builder-api.vercel.app pnpm --filter <app> exec vite build
# Build Output API: .vercel/output/static = dist, config.json = SPA rewrite
mkdir -p .vercel/output/static && cp -R dist/. .vercel/output/static/
printf '{"version":3,"routes":[{"handle":"filesystem"},{"src":"/(.*)","dest":"/index.html"}]}' > .vercel/output/config.json
vercel link --yes --project product-builder-<app> --scope bb-rightcode
vercel deploy --prebuilt --prod --yes --scope bb-rightcode
```

### ⚠️ 도메인 점유 (중요)

canonical `*.vercel.app` 은 글로벌 선점됨 — `product-builder-app.vercel.app` 은
**다른 계정 소유**(squatter). 내 프로젝트 실제 도메인은 `vercel inspect <deploy-url>`
의 Aliases 에서 확인 (예: app → `product-builder-app-mu.vercel.app`).
api/admin 은 canonical 확보 성공. **실제 도메인으로** `CORS_ORIGINS`/`APP_URL`/
`VITE_API_URL` 세팅 후 api 재배포.
origins.ts `DEFAULT_TRUSTED_ORIGINS` 와일드카드(`product-builder-app-*`)가 커버하지만,
fastify CORS 는 exact match 라 `CORS_ORIGINS` 를 실 도메인으로 명시하는 게 안전.

### ai-runtime (git-integration — 배포됨)

Next.js 는 CLI prebuilt(`vercel build`)가 모노레포에서 막힌다:
engines `24.x`(Vercel max 22.x) + Turbopack/outputFileTracingRoot root 추론 +
`.next` 경로 이중화. → **git-integration 으로 배포**(Vercel API):
프로젝트에 GitHub repo 연결 + Root Directory=`apps/ai-runtime` + nodeVersion `22.x`
설정(`PATCH /v9/projects/{id}` + `POST /v10/projects/{id}/link`) 후 develop ref 로
`POST /v13/deployments`. Vercel git 빌드 환경이 모노레포 Next 를 정상 처리한다.
env: `DOMAIN_SERVER_URL`, `ALLOWED_ORIGINS`(실 app,admin), `AI_MOCK=1`.

## 3. 검증

```bash
# api (canonical alias public; deploy URL 은 deployment-protection 401 정상)
curl -i https://product-builder-api.vercel.app/                  # 200 Hello World
curl -i https://product-builder-api.vercel.app/api/auth/ok       # {"ok":true}
# app/admin 실 도메인 200, SPA deep route 200
```
브라우저: app → `demo@product-builder.test` 로그인 → `/workspace-select` 렌더 = 성공.
크로스오리진: api preflight `access-control-allow-origin` = app 도메인 확인.

## 4. 데모 리셋

```bash
node scripts/seed-demo.mjs    # DB 재시드 (스키마 유지)
# 코드 변경 후: 해당 앱 빌드 → .vercel/output 재생성 → vercel deploy --prebuilt --prod
```

## 주의

- deploy gate(vercel-deploy-gate.md)는 **git-integration production promotion** 게이트 —
  현재 CLI prebuilt 배포엔 적용 안 됨. git-integration 전환 시 활성.
- Resend 미설정이면 신규가입/매직링크 불가 → super-user 경로로만 시연.
- 사용자 노출 에러는 CLAUDE.md §5 (raw error 금지) 준수.
- `.context/*.txt` (pooled/direct url, seed pw) 는 gitignored — 재배포용 보관.
