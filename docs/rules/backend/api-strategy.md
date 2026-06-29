---
description: "API Strategy: REST + OpenAPI codegen"
globs: "packages/features/**/*.ts, apps/server/**/*.ts"
alwaysApply: true
---

# API Strategy: REST + OpenAPI

## 핵심 원칙

> 모든 Feature API는 NestJS REST Controller와 OpenAPI schema를 단일 계약으로 사용한다.

| 계층 | 역할 | 필수 사항 |
| ---- | ---- | --------- |
| Controller | HTTP route, guard, request/response DTO 연결 | `@Controller`, method decorator, `@ApiResponse({ type })` |
| DTO | request/response schema | zod schema + `createZodDto` 또는 명시 DTO |
| Service | 비즈니스 로직 | controller와 job/worker가 공유하는 단일 진실 소스 |
| Client | generated REST client | `packages/api-client`의 OpenAPI 산출물 사용 |

## Controller 규칙

- route는 `/api/*` prefix 아래에서 노출된다.
- 인증 필요 route는 `BetterAuthGuard`와 `@CurrentUser()`를 사용한다.
- admin route는 `BetterAuthGuard`와 admin guard를 함께 사용한다.
- 사용자에게 노출될 수 있는 error payload에 provider/server raw message를 그대로 전달하지 않는다.
- endpoint 추가/변경 시 OpenAPI schema가 비지 않도록 request/response DTO를 명시한다.

```ts
@Post("projects")
@UseGuards(BetterAuthGuard)
@ApiResponse({ status: 201, type: ProjectResponseDto })
create(@CurrentUser() user: User, @Body() dto: CreateProjectDto) {
  return this.projectService.create(user.id, dto);
}
```

## OpenAPI Codegen Gate

서버 endpoint 또는 DTO를 바꾸면 반드시 다음 순서로 갱신한다.

1. controller/DTO/service 변경
2. `pnpm api:codegen`
3. generated client diff 확인
4. `pnpm api:verify`
5. 관련 package typecheck/test

OpenAPI JSON과 generated client가 drift 되면 merge 대상이 아니다.

## 금지

- 새 RPC router/procedure 추가
- feature service를 API transport 전용 파일에 묶어두기
- controller에서 비즈니스 로직을 중복 구현하기
- `fetch` string literal을 앱 feature 코드에 흩뿌리기
