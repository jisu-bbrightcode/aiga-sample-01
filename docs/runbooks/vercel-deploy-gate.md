# Vercel deploy gate — Deployment Checks (GitHub Checks integration)

> **상태 점검**: `pnpm verify:vercel-gate` 으로 3 project 의 Deployment
> Checks 설정 상태 확인. "checks: 0개" 가 나오면 Dashboard 셋팅이
> 아직 안 된 것 — 아래 절차 따라 필수 설정.

main 으로 push 가 들어가면 두 가지가 병렬로 일어난다:

1. **GH Actions `all-tests-postgres` workflow** 실행 (5 job parallel)
2. **Vercel git integration** — production deployment 생성

기본 동작은 (2) 가 (1) 결과를 안 보고 그대로 production domain 에 promote
한다. 이 게이트를 강제하기 위해 **Vercel Deployment Checks 의 GitHub Checks
integration** 을 켠다.

> "When you add Deployment Checks to a project, Vercel will hold each
> production deployment until all required checks pass before assigning it
> to your custom production domains."
> — https://vercel.com/docs/deployment-checks

## 왜 이 방식인가 (다른 후보 대비)

| 방식 | 평가 |
|---|---|
| **Deployment Checks + GitHub Checks** ← 채택 | Vercel 공식. 스크립트 0, secret 0. preview URL 즉시 사용 가능 (build 는 진행되고 production domain promotion 만 hold). Pro plan 이상 필요 — 보유 중. |
| Ignored Build Step + GH API 폴링 | 비공식 hack. timing race (Vercel webhook 이 GH workflow 보다 빠를 때 매번 cancelled). dashboard 에 noise. fail-open. |
| Vercel git OFF + GH Actions 가 `vercel deploy` 호출 | 완전 단방향이지만 Vercel 의 preview URL 자동화 / git integration 의 모든 편의 (PR 코멘트, status check) 잃음. |

## 셋업 (1회, 3 project)

각 Vercel project 에 동일:

1. Vercel Dashboard → 해당 project → **Settings** → **Git** 섹션
2. **Deployment Checks** 영역으로 스크롤
3. **GitHub Checks** 토글을 **On**
4. 게이트할 workflow 선택: `all tests (real Postgres)`
5. (선택) "Required" 체크: 이 check 가 fail 이면 production promotion 차단
6. **Save**

대상 project:
- `product-builder-app` (root, vite)
- `product-builder-api` (apps/server, NestJS)

## 동작

```
git push main
   │
   ├─► GH Actions all-tests-postgres   (5 job 병렬, ~15분)
   │
   └─► Vercel
        ├─► production build           (병렬, 평소대로)
        ├─► deployment state = ready
        ├─► (hold) GitHub Checks 결과 폴링
        │      │
        │      ├─ success → production domain 에 promote
        │      └─ fail    → promotion 안 함, 이전 prod 유지, Dashboard 에
        │                   "Failed checks" 로 표시
        └─► (preview URL 은 즉시 사용 가능 — dev 확인 가능)
```

## 상태 검증 방법

```bash
pnpm verify:vercel-gate
```

결과 예시 — 셋팅 전:

```
[product-builder-app]
  deployment: dpl_xxx (READY)
  https://product-builder-xxx.vercel.app
  ⚠️  checks: 0개 — Deployment Checks 가 켜져 있지 않음
```

모든 project 에 `✓ checks: 1개` 이상 이어야 게이트 작동.

## 사전 부채 안 잡히는 이유

`all tests (real Postgres)` workflow 의 conclusion 만 본다. 안의 개별 job
중 `continue-on-error: true` 로 표시된 4개는 workflow conclusion 에 영향
안 줘서 자동으로 게이트에서 빠진다:

| job | 현재 상태 |
|---|---|
| `vitest packages` | non-blocking |
| `features — payment` | non-blocking (~17 spec pre-existing) |
| `features — story` | non-blocking (~14 spec pre-existing) |
| **`server — real Postgres`** | **blocking** |
| **`features — misc (real Postgres)`** | **blocking** |
| **`drizzle-kit push`** | **blocking** (schema sync) |

위 사전 부채가 fix 되면 workflow 의 `continue-on-error` 만 떼면
자동으로 blocking 으로 승격된다 (Vercel 측 설정 변경 불필요).

## 운영 팁

- Vercel Dashboard → Deployments 의 각 entry 에 GH check 상태가 같이
  표시됨. fail 시 클릭하면 GH Actions log 로 deeplink.
- 긴급 hot-fix: Vercel Dashboard → 해당 deployment → "Promote to
  Production" 으로 check 무시하고 수동 승격 가능 (audit log 남음).
- preview deployment (PR / 비-main 브랜치) 는 영향 없음 — production
  domain 에만 적용된다.
