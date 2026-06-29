---
description: "OpenAPI codegen workflow"
globs: "apps/server/**/*.ts, packages/features/**/*.ts, packages/api-client/**/*"
alwaysApply: true
---

# OpenAPI Codegen

서버 API 계약의 단일 소스는 NestJS Swagger가 생성하는 OpenAPI schema다.

## 변경 절차

1. Controller route와 DTO를 수정한다.
2. response DTO는 `@ApiResponse({ type: ... })`로 연결한다.
3. request DTO는 zod schema 기반 `createZodDto` 또는 명시 class DTO를 사용한다.
4. `pnpm api:codegen`으로 `packages/api-client`를 갱신한다.
5. `pnpm api:verify`로 generated client drift가 없는지 확인한다.
6. 관련 feature의 typecheck/test를 실행한다.

## CI Gate

API 계약 변경 PR은 `pnpm api:verify`를 통과해야 한다. generated client가 최신 OpenAPI schema와 다르면 실패가 맞다.

## 금지

- controller endpoint를 추가하고 generated client를 갱신하지 않는 것
- OpenAPI response type 없이 `description`만 추가하는 것
- runtime-only schema를 만들고 client contract를 갱신하지 않는 것
