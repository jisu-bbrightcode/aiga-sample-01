# E2E spec tag 규칙

## 1. 4-단계 분류

| Tag | 의미 | 기준 |
|---|---|---|
| `@critical` | 깨지면 사용자가 핵심 기능 못 씀 | auth, payment, project CRUD, document 입력/저장 등 |
| `@smoke` | 빠른 위생 (≤30s, 단순 마운트/네비) | 디자인 시스템, 정적 페이지 측정 |
| `@regression` | 위 2개에 안 드는 모든 user-facing 회귀 검증 | 도메인별 회귀 lock |
| `@db` | real Postgres `DATABASE_URL` + NestJS backend 필요 | mock 으로 못 만드는 진짜 DB transaction |

## 2. 룰

- **level tag (`@critical / @smoke / @regression`) 중 정확히 1 개** 부착.
- **도메인 tag (`@auth`, `@payment`, `@document`, `@project`, `@quest`, ...) 1 개 이상** 부착.
- mock 으로 못 만드는 spec 은 `@db` 도 같이.
- tag 는 **첫 번째 `test.describe(...)` 의 title 끝**에 공백 구분.
- `describe` 가 없고 `test()` 만 있으면 그 `test()` 의 title 끝에.

## 3. 예제

```ts
test.describe("Auth sign-in @critical @auth", () => {
  test("email + password 로그인 성공 → /home 이동", async ({ page }) => { … });
});
```

```ts
test.describe("Quest CRUD restore @regression @quest @db", () => {
  test("create quest → reload → 데이터 유지", async ({ page }) => { … });
});
```

```ts
test("measure quest sidebar offsets @smoke @design @db", async ({ page }) => { … });
```

## 4. 자동 차단

`.pi/extensions/rules/e2e-spec-conventions.ts`:

| 위반 | 룰 kind |
|---|---|
| level tag 없음 | `missing-level-tag` |
| level tag 2개 이상 (`@critical @regression` 같이) | `multiple-level-tags` |
| 도메인 tag 없음 | `missing-domain-tag` |

## 5. CI 매트릭스 매핑

| Workflow | grep | grepInvert | blocking |
|---|---|---|---|
| `e2e.yml` smoke/critical | `@smoke|@critical` (always) | `@db` | ✅ |
| `e2e.yml` regression | `@regression` (main only) | `@db` | ✅ |
| `e2e-against-pg-branch.yml` | `@db` | — | ✅ |

상세: `docs/runbooks/e2e-management.md` §4.
