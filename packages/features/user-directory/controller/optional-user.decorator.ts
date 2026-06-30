import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { parseJwtFromHeader, type User } from "@repo/core/nestjs/auth";

/**
 * 선택적 인증 파라미터 데코레이터 (FR-001 사용자 상세 / BBR-527).
 *
 * 공개 상세 라우트(`GET /users/:handle`)는 비로그인 사용자도 탐색 가능해야
 * 하지만, 로그인한 사용자에게는 viewer state(본인 여부 등)를 돌려줘야 한다.
 * 가드를 붙이면 비로그인 요청이 401로 막히므로, 가드 대신 Authorization 헤더의
 * Better Auth JWT를 best-effort 로 파싱한다. 토큰이 없거나 유효하지 않으면
 * `null` 을 반환해 익명 viewer 로 처리한다 (요청을 막지 않는다).
 *
 * 서명 검증은 하지 않는다(`parseJwtFromHeader` 와 동일) — 이 값은 공개 projection
 * 의 viewer 표시에만 쓰이며, 어떤 민감 필드 노출도 게이트하지 않는다.
 */
export const OptionalUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User | null => {
    const request = ctx.switchToHttp().getRequest();
    return parseJwtFromHeader(request.headers?.authorization) ?? null;
  },
);
