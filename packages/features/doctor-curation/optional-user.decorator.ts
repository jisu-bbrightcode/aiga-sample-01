import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { parseJwtFromHeader, type User } from "@repo/core/nestjs/auth";

/**
 * Best-effort current user for the UNGATED public detail route (FR-004 / BBR-537).
 *
 * The 명의 컬렉션 상세 surface is browsable without login, but the detail response
 * carries a `viewerState` so the client can tell whether the request was made by
 * an anonymous visitor (guest) or a signed-in member. This decorator reads the
 * Better Auth JWT from the Authorization header if present and returns the user,
 * or `undefined` for anonymous visitors — it NEVER throws, so it must not be
 * paired with an auth guard.
 *
 * (Cookie-only sessions are not resolved here; that path requires the async
 * `BetterAuthGuard`. Anonymous viewers simply fall back to the guest state.)
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
