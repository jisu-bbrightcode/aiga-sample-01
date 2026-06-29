# Product Builder Data Runtime Policy

적용 범위: Product Builder 워크스페이스의 신규 기능, 리팩터, QA, 문서 작성.

## Decision

Product Builder는 서버 권위 데이터 경로를 기준으로 한다.

## Rules

- 데이터의 canonical source는 서버 DB와 서버 API 검증 경로다.
- 클라이언트 캐시는 허용되지만 성능 보조 수단이다. 캐시는 서버 데이터를 대체하지 않는다.
- 로컬 DB를 canonical source로 두지 않는다.

## Allowed Cache Pattern

캐시가 필요하면 다음 기준을 따른다.

- 서버 응답을 빠르게 다시 보여주기 위한 query cache 또는 bounded client cache로 제한한다.
- cache hit는 background refresh와 함께 사용한다.
- write commit은 서버 API 성공을 기준으로 한다.
- optimistic UI는 가능하지만 실패 시 서버 응답 기준으로 되돌린다.
- 사용자에게 오프라인에서도 전체 작업이 안전하게 보존된다고 약속하지 않는다.

## Implementation Guidance

- API 계약, 권한, validation, persistence는 서버 feature module에서 먼저 정의한다.
- 프론트엔드는 서버 API client와 query/mutation cache를 통해 데이터를 소비한다.

## Verification

Product Builder 데이터 기능을 변경할 때 확인한다.

```sh
pnpm --filter server exec tsc --noEmit --pretty false
pnpm --filter app run check-types
```
