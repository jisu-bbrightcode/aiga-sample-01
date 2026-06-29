# Test gates per branch

브랜치별 강제 테스트 워크플로 — develop 와 main 머지 전에 진짜 무엇이
돌아가는지 한 곳에서 본다.

## 요약

| Branch event | Workflow | DB | 시간 |
| --- | --- | --- | --- |
| **PR to `main` or `develop`** | package/app checks + optional manual `e2e.yml` | 없음 또는 필요 시 postgres:16 service | 3-20 min |
| **Push to `develop`** | `e2e.yml` smoke/critical + `e2e-against-pg-branch.yml` | postgres:16 service | 8-35 min |
| **PR to `main`** | `all-tests-postgres.yml` | postgres:16 service | 13-20 min |
| **Push to `main`** | `e2e.yml` smoke/critical/regression + `all-tests-postgres.yml` + `e2e-against-pg-branch.yml` | postgres:16 service | 15-45 min |

## PR 시 동작

1. **브라우저 Playwright E2E (`e2e.yml`) 는 PR 에서 자동 실행하지 않는다.**
   필요하면 PR 작성자가 `workflow_dispatch` 로 `grep` 을 지정해 수동 실행한다.
2. **데이터/도메인 변경 PR** 에서는 `@db` Playwright E2E 를 돌리지 않는다.
   이 게이트는 merge 후 `develop` / `main` push 에서 실행해 PR feedback 을 가볍게 유지한다.
3. **main 행 PR** 은 `all-tests-postgres.yml` 이 켜져 features/server
   의 real-PG spec 까지 강제.

## develop / main merge 시

- `e2e.yml` 은 `develop` push 에서 mock-only `@smoke|@critical` 만 실행한다.
- `e2e.yml` 의 `@regression` job 은 `main` push 또는 수동 실행에서만 실행한다.
- `e2e.yml` / `e2e-against-pg-branch.yml` 은 docs, `.pi`, `.crew`, `.github`, root Markdown only push 에서는 실행하지 않는다.
- `e2e-against-pg-branch.yml` 은 `develop` / `main` push 에서만 실행된다.
- `main` push 에서는 `all-tests-postgres.yml` 도 함께 작동한다.
- production deploy (Vercel) 는 main push trigger 라 이 게이트 통과 후
  배포되는 흐름.

## 왜 두 단계?

- **PR 빠른 피드백** — 매 push 마다 15-30 min 기다리면 개발 흐름이 느려진다.
  브라우저 E2E는 필요 시 수동 실행하고, DB 회귀는 서버 권위 경로의 real Postgres 게이트에서 본다.
- **main 보장** — 실 Postgres 에서만 잡히는 회귀 (sequence, trigger,
  FOR UPDATE, jsonb default 등) 를 production 전에 차단.

## DB-backed spec 의 동작

`packages/features/payment/__tests__/test-db.ts` 의 `hasDb` 패턴:

```ts
export const hasDb = Boolean(process.env.DATABASE_URL);
const describeIfDb = hasDb ? describe : describe.skip;
```

- PR 워크플로 (DATABASE_URL 없음) → `describe.skip` → spec 통과 (실행 안 함)
- main 워크플로 (DATABASE_URL 셋팅) → 실행

## 알려진 한계 — 사전 부채 (non-blocking)

| job | 상태 | 배경 |
|---|---|---|
| `vitest packages` | fail 허용 | 일부 legacy vitest package debt. |
| `features payment` / `story` | fail 허용 | payment trpc + story DTO 몇 spec 이 사전 부채 (~31 fail in develop). |
| `drizzle-kit push` | 적용 중 | 0001 historical migration 의 FK type mismatch 단점. `db:migrate` 대신 schema push 로 우회. |

이들은 각자 독립적으로 조사·수정 대상.

## 트러블슈팅

- **service container 시작 timeout**: `pg_isready` health check 가 5회 retry.
  실패 시 GH Actions log 확인 — 보통 postgres:16 이미지 pull 지연.
- **DB-backed spec 실패**: `DATABASE_URL` 의 schema 가 drizzle migration 과
  drift 가능. `pnpm --filter @repo/drizzle db:migrate` 가 step 으로 들어가
  매 run 마다 적용됨.
- **vitest 패키지 실패**: 도메인-specific. 해당 package owner 확인.
