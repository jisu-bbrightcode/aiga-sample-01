# Pi extension shared rules

이 폴더는 여러 Pi extension 이 재사용하는 룰 데이터 + detection 로직을
보관한다. **framework-free** (pi 런타임 / fs / process 의존성 0) 라
어떤 hook 에서든 import 해서 쓸 수 있다.

모든 룰은 `shouldGuard(path)` + `findViolations(text)` + `ADVICE` 세 입을
내보내고, `.pi/extensions/no-banned-patterns/index.ts` hook 이 그들을 일괄
dispatch 한다.

## 룰 목록

| 룰 | 검사 대상 | 원본 oxlint 룰 |
| --- | --- | --- |
| `no-raw-sql.ts` | raw SQL 작성 + disable directive | `packages/oxlint-plugin/src/rules/no-raw-sql-query.mjs` |
| `no-schema-outside-drizzle.ts` | `pgTable(`/`pgEnum(` 등 in features | `no-schema-outside-drizzle.mjs` |
| `no-db-in-controller.ts` | `db.<op>` in controller/router | `no-db-in-controller.mjs` |
| `no-manual-memoization.ts` | `useMemo`/`useCallback`/`memo()` | `no-manual-memoization.mjs` |
| `no-local-css-import.ts` | `import "./x.css"` outside entry | `no-local-css-import.mjs` |

## 새 룰 추가

1. `rules/<name>.ts` 생성 — `shouldGuard(path)`, `findViolations(text)`,
   `ADVICE` 내보내기.
2. `rules/lib.ts` 의 `Violation` shape 사용 (`rule`/`kind`/`snippet`).
3. `no-banned-patterns/index.ts` 의 `RULES` 배열에 entry 추가.
4. `rules/all-rules.test.mjs` 에 smoke assertion 추가.
5. oxlint 일치 룰이 있다면 ALLOWED 패턴 / regex 를 함께 동기화.

## framework-free 이다

`rules/` 의 모든 파일은 pi / fs / process 의존 0. 다른 hook (turn_end,
session_start, bash gate, fetch gate) 에서 그대로 import 해서 재사용 가능.

## 변경 시 동기화

각 룰 파일 상단 도석에 대응 oxlint 룰 경로 명시. 새 예외/패턴
추가 시 두 파일 모두 PR 에 포함시켜야 write 차단과 lint 가 어긋나지
않는다.

## 테스트

```sh
node .pi/extensions/rules/no-raw-sql.test.mjs
node .pi/extensions/rules/all-rules.test.mjs
```
