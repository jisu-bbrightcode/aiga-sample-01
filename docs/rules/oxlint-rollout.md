# Product Builder oxlint rollout

`packages/oxlint-plugin` 의 커스텀 룰 도입 단계.

## 운영 원칙

- **changed-files only 가 기본 강제 채널**. `pnpm lint:oxlint` 는 `git diff` 로 바뀐 파일에만 oxlint 를 돌린다. PR 단위 enforce.
- 전체 lint (`pnpm exec oxlint`) 는 baseline 정리 용도. 빨강이 떠도 CI 차단 신호로 쓰지 않는다.
- 룰은 **error / warn / off** 로 단계 운영:
  - `error` — changed-files 에서 PR 차단. 위반량 적거나 0 인 룰만.
  - `warn` — 노출은 하되 PR 차단 안 함. 점진 정리 중.
  - `off` — 보류.

## 현 상태 (2025-XX)

| rule | violations (full repo) | level | 다음 단계 |
|---|---|---|---|
| `product-builder/no-schema-outside-drizzle` | 0 | error | — |
| `product-builder/no-local-css-import` | 5 | error | 5건 정리 후 유지 |
| `product-builder/no-useeffect-data-fetch` | 10 | error | 10건 정리 |
| `product-builder/no-raw-sql-query` | 55 (electron-main baseline) | error | server/features/core: 0. electron-main `repository.ts`/`connection.ts`: 55 (DYNAMIC_TABLE, STATIC_DML, DYNAMIC_SETS 부채). changed-files 에만 적용되므로 신규 위반은 즉시 차단, 기존 baseline 은 점진 마이그 (`docs/architecture/electron-raw-sql-inventory.md`). |
| `product-builder/no-db-in-controller` | 61 | warn | service 레이어 분리 후 error 승격 |
| `product-builder/no-manual-memoization` | 281 | warn | React Compiler 안정화 후 일괄 제거 → error |
| `product-builder/enforce-shadcn` | 342 | warn | UI 마이그레이션 진행률에 따라 분할 error 승격 (예: aria/role 먼저, raw HTML 다음) |
| `product-builder/no-inline-static-style` | 1569 | warn | playground 데모 면제 검토 + Tailwind 마이그레이션. 가장 큰 부채. |
| `product-builder/function-file-structure` | (이미 안정) | error | — |
| `product-builder/no-formatter-ignore-comment` | (이미 안정) | error | — |
| `product-builder/no-predicate-variable-prefix` | (이미 안정) | error | — |
| `product-builder/component-file-structure` | (large legacy) | off | 신규 파일 대상 검토 |
| `product-builder/hook-file-structure` | (large legacy) | off | 동일 |

## 승격 기준

`warn → error` 로 올리려면:
1. 전체 위반량 0 또는 화이트리스트로 명시
2. 또는 영향 경로가 좁아서 한 PR 로 정리 가능
3. CI changed-files 검사가 한 달 이상 안정적으로 통과

## 검사 명령

```bash
pnpm lint:oxlint                # changed-files 만 (PR 단위 enforce)
pnpm exec oxlint apps packages  # 전체 (정리 진척도 확인용)
```

## 새 룰 추가 절차

1. `packages/oxlint-plugin/src/rules/<name>.mjs` 단일 파일 작성 (단일 책임)
2. `packages/oxlint-plugin/src/index.mjs` 에 등록
3. `.oxlintrc.json` 에 추가 — **처음엔 `warn`**
4. 전체 repo 위반량 측정 → 이 문서에 기록
5. 위반량 적으면 다음 PR 에 `error` 승격
