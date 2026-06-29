# Browser E2E against a Postgres service container

`@db` Playwright E2E 를 GitHub Actions `postgres:16` service container 또는
이미 실행 중인 real Postgres `DATABASE_URL` 위에서 실행하는 파이프라인. CI 와
로컬 모두 같은 순서로 동작한다.

## 왜 분리된 Postgres?

- **격리**: CI run 마다 신선한 `postgres:16` service container 사용.
- **safe**: 운영 / 공유 dev DB 에 영향 0. 로컬은 명시적으로 제공한
  `DATABASE_URL` 또는 기본 local test DB 만 사용.
- **realistic**: 진짜 Postgres → migration / DB integration 회귀를 잡는다.
- **단순함**: Neon project secrets 없이 GitHub Actions 기본 service container 로 실행.

## CI: `.github/workflows/e2e-against-pg-branch.yml`

트리거: `push` to `develop` / `main` + `workflow_dispatch`.

자동 실행은 PR update 가 아니라 develop/main 에 merge 된 뒤의 branch push 에서만 발생한다.

수동 실행 시 GitHub UI 의 `variant` input 으로 Playwright grep 을 바꿀 수 있다.
기본값은 `@db` 이며, 예: `@db.*payment`, `@payment`, `@critical @db` 등으로
부분 실행한다.

DB 설정:

```yaml
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_USER: product_builder_test
      POSTGRES_PASSWORD: product_builder_test
      POSTGRES_DB: product_builder_test
    ports:
      - 5432:5432
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
env:
  DATABASE_URL: postgresql://product_builder_test:product_builder_test@localhost:5432/product_builder_test
```

플로우:

1. `postgres:16` service container 시작
2. `pnpm --filter @repo/drizzle db:migrate` (service DB 에 schema 적용)
3. Playwright chromium 설치
4. `apps/server` build + start (background)
5. `apps/app` build + preview (background, :3000)
6. `PLAYWRIGHT_GREP='<variant 기본 @db>' pnpm --filter app exec playwright test --reporter=list`
7. 실패 시 trace / server.log / app.log 업로드
8. background process 정리

`concurrency` 그룹으로 동일 target branch 의 이전 run 을 자동 cancel 해 CI 분을 아낀다.

## 로컬: `scripts/e2e-against-branch.sh`

```sh
pnpm e2e:branch                       # 기본 local test DB URL 사용
pnpm e2e:branch -- --grep lore-rail   # 일부만 (extra Playwright args passthrough)
DATABASE_URL=postgresql://user:pass@localhost:5432/db pnpm e2e:branch
```

`DATABASE_URL` 이 없으면 스크립트는 아래 기본값을 사용하고, 이미 local
Postgres 또는 service container 가 실행 중이어야 한다고 안내한다.

```text
postgresql://product_builder_test:product_builder_test@localhost:5432/product_builder_test
```

스크립트는 CI workflow 와 같은 순서 (migrate → install chromium → build
server/app → start → playwright → cleanup) 로 실행한다. `trap EXIT` 로 success /
failure / Ctrl+C 모두 background process 를 정리한다.

## 데이터 lifecycle

| 시점 | 동작 |
| --- | --- |
| CI run 시작 | fresh `postgres:16` service container 시작 |
| migration | `@repo/drizzle db:migrate` 로 schema 적용 |
| Playwright | `@db` spec 만 실행 |
| run 종료 | service container 는 GitHub Actions 가 폐기, background process 는 cleanup |
| 로컬 | 사용자가 제공한 `DATABASE_URL` 또는 기본 local DB 를 재사용하므로 필요 시 직접 reset |

## 트러블슈팅

- **postgres service 시작 timeout**: `pg_isready` health check 가 5회 retry.
  실패 시 GitHub Actions service container log 확인.
- **server / app 안 뜸**: GitHub Actions log 에 `server.log` / `app.log` artifact
  업로드됨. 로컬에서는 `/tmp/product-builder-e2e-server.log`, `/tmp/product-builder-e2e-app.log`.
- **playwright 실패**: trace artifact (`apps/app/test-results/**`,
  `playwright-report/**`) 다운받아 `pnpm --filter app exec playwright show-trace`.
- **DB 상태 오염(로컬)**: 기본 DB 를 직접 drop/recreate 하거나 별도
  `DATABASE_URL` 을 지정해서 실행.

## 데이터 시드

Playwright spec 은 각자 데이터를 만들고 정리한다 (signup → create world →
assert → cleanup). 로컬 DB 를 재사용하면 이전 row 가 영향을 줄 수 있으므로,
고유 suffix 를 쓰고 필요 시 DB 를 reset 한다.

장시간 시드 fixture 가 필요한 경우 `apps/server/src/scripts/seed-super-user.ts`
류 스크립트를 step 으로 추가:

```yaml
- name: Seed super user
  env:
    PRODUCT_BUILDER_SEED_EMAIL: e2e@product-builder.test
    PRODUCT_BUILDER_SEED_PASSWORD: changeme
  run: pnpm --filter server exec tsx src/scripts/seed-super-user.ts
```

## Legacy Neon utilities

`scripts/neon-branch.mjs`, `scripts/neon-gc.mjs`, `db:branch:*` package scripts 는
legacy/manual Neon 작업용으로 남아 있다. 현재 `@db` E2E gate 는 Neon API secret 을 요구하지 않는다.
