import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { parseJwtFromHeader, type User } from "@repo/core/nestjs/auth";

/**
 * Optional authenticated user for the public file-detail endpoint
 * (PB-FILE-API-READ-001 / BBR-551).
 *
 * Unlike {@link import("@repo/core/nestjs/auth").CurrentUser} (which requires a
 * guard and a populated `request.user`), this decorator runs on an unguarded
 * route: it decodes a Bearer JWT when present and yields `undefined` for
 * anonymous callers, so `GET /files/:id` can serve public files to everyone
 * while still recognising an owner for private files.
 *
 * Only the JWT-bearer path is resolved here (synchronous, no session lookup),
 * matching the read-side optional-auth pattern used by the other public service
 * endpoints. Cookie/opaque-session callers that need private access use an
 * authenticated client that sends the Bearer JWT.
 */
export const OptionalUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User | undefined => {
    const request = ctx.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
      user?: User;
    }>();

    // A guard earlier in the chain may already have populated request.user.
    if (request.user) return request.user;

    const authHeader = Array.isArray(request.headers?.authorization)
      ? request.headers?.authorization[0]
      : request.headers?.authorization;

    return parseJwtFromHeader(authHeader);
  },
);
