# Feature Implementation Steps

신규/변경 feature는 REST/OpenAPI 계약을 기준으로 구현한다.

## Backend

1. FRD와 reference 문서를 확인한다.
2. `packages/features/{feature}/service`에 비즈니스 로직을 둔다.
3. `packages/features/{feature}/dto`에 request/response DTO를 둔다.
4. `packages/features/{feature}/controller` 또는 기존 controller에 REST endpoint를 추가한다.
5. `@ApiResponse({ type })`와 필요한 `@ApiBody`, `@ApiParam`, `@ApiQuery`를 연결한다.
6. `apps/server/src/app.module.ts` 또는 feature module에 controller/provider를 등록한다.
7. 외부 provider/env 기반 optional feature는 `docs/rules/feature/provider-env.md`에 따라 `{FEATURE}_ENABLED=false` 기본값, placeholder 거부, 조건부 module/route 등록, config/wiring 테스트를 추가한다.
8. OpenAPI route surface가 feature env에 의존하면 `apps/server/scripts/dump-openapi.sh`에 deterministic fixture env를 추가한다.
9. `pnpm api:codegen`과 `pnpm api:verify`로 generated client를 갱신/검증한다.

## Frontend

1. generated REST client를 feature hook에서 사용한다.
2. Query는 `use-{feature}-queries.ts`, Mutation은 `use-{feature}-mutations.ts`에 둔다.
3. 컴포넌트는 hook만 호출한다.
4. Mutation 성공 시 관련 queryKey를 invalidate 한다.
5. 사용자 노출 에러는 stable code mapping helper를 사용한다.

## Verification

- 관련 package typecheck/test
- `pnpm api:verify`
- optional provider feature는 disabled/placeholder/enabled config test와 server wiring test
- 사용자 흐름이 있으면 browser smoke
- docs/reference와 feature index 갱신

## 금지

- 새 RPC router/procedure 추가
- controller에 비즈니스 로직 중복 구현
- 컴포넌트에서 API 직접 호출
- raw server/provider error message 렌더링
