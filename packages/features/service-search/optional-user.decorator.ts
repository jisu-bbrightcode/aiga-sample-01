import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { parseJwtFromHeader, type User } from "@repo/core/nestjs/auth";

/**
 * Best-effort current user for UNGATED routes (FR-003 / BBR-531).
 *
 * The public unified search is browsable without login, but when a signed-in
 * user searches we want to attribute the query log to them so their 최근 검색어
 * works. This decorator reads the Better Auth JWT from the Authorization header
 * if present and returns the user, or `undefined` for anonymous visitors — it
 * NEVER throws, so it must not be paired with an auth guard.
 *
 * (Cookie-only sessions are not resolved here; that path requires the async
 * `BetterAuthGuard`. Anonymous attribution simply falls back to null userId.)
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
