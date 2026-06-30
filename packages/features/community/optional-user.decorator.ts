import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { parseJwtFromHeader, type User } from "@repo/core/nestjs/auth";

/**
 * Best-effort current user for the UNGATED public community read routes
 * (PB-COMM-SPACE-API-LIST-001 / BBR-587).
 *
 * 커뮤니티 목록·상세는 비로그인 사용자도 탐색할 수 있어야 하지만, 응답에는
 * `viewerState`(가입/구독/차단/제재)와 역할별 필드 분리가 필요하다. 이 데코레이터는
 * Authorization 헤더의 Better Auth JWT가 있으면 사용자(User)를 반환하고, 익명
 * 방문자면 `undefined`를 반환한다 — 절대 throw 하지 않으므로 auth 가드와 함께
 * 쓰면 안 된다.
 *
 * (쿠키 전용 세션은 여기서 해석하지 않는다. 익명 뷰어는 guest 상태로 폴백된다.)
 */
export const OptionalUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User | undefined => {
    const request = ctx.switchToHttp().getRequest<{
      user?: User;
      headers?: Record<string, string | string[] | undefined>;
    }>();
    if (request.user) return request.user;
    const header = request.headers?.authorization;
    const value = Array.isArray(header) ? header[0] : header;
    return parseJwtFromHeader(value);
  },
);
