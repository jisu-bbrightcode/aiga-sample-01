import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { parseJwtFromHeader } from "./jwt-parser";
import type { User } from "./user";

/**
 * 동적 import("@repo/core/auth/server") 의 최소 구조 타입.
 * BetterAuthGuard 와 동일 패턴 — better-auth 런타임을 정적 의존성으로
 * 끌고 오지 않기 위해 dynamic import 를 유지한다 (테스트에서 모킹 용이).
 */
interface BetterAuthSessionModule {
  auth: {
    api: {
      getSession(input: { headers: Headers }): Promise<{
        user?: { id?: string; email?: string | null };
        session?: { activeOrganizationId?: unknown };
      } | null>;
    };
  };
}

interface IncomingHttpRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: User;
}

function headersFromRequest(request: IncomingHttpRequest): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers ?? {})) {
    if (value) headers.append(key, Array.isArray(value) ? value.join(", ") : String(value));
  }
  return headers;
}

/**
 * 선택적(optional) 인증 가드 — 공개 엔드포인트에서 "로그인했다면 누구인지"만
 * 알아내고 싶을 때 사용한다. {@link BetterAuthGuard} 와 동일한 방식으로
 * JWT Bearer → Better Auth 세션 순서로 사용자를 해석해 `request.user` 에
 * 채우되, **인증 실패/미인증(비회원)이어도 절대 401 을 던지지 않고 통과**시킨다.
 *
 * 따라서 다운스트림 핸들러는 `@CurrentUser()` 로 `User | undefined` 를 받아
 * 비회원(guest) 과 회원을 구분해 처리할 수 있다.
 *
 * 예) 등급별 게시글 열람 일일 제한 — 비회원/일반은 제한, 인증회원은 무제한.
 */
@Injectable()
export class OptionalBetterAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<IncomingHttpRequest>();
    const authHeader = Array.isArray(request.headers.authorization)
      ? request.headers.authorization[0]
      : request.headers.authorization;

    // 1. JWT Bearer (외부 API 클라이언트)
    const jwtUser = parseJwtFromHeader(authHeader);
    if (jwtUser) {
      request.user = jwtUser;
      return true;
    }

    // 2. Better Auth 세션 (쿠키 / opaque bearer)
    try {
      const { auth } = (await import("@repo/core/auth/server")) as BetterAuthSessionModule;
      const session = await auth.api.getSession({ headers: headersFromRequest(request) });
      if (session?.user?.id) {
        const orgId = session.session?.activeOrganizationId;
        request.user = {
          id: session.user.id,
          email: session.user.email ?? undefined,
          activeOrganizationId: typeof orgId === "string" && orgId.length > 0 ? orgId : null,
        };
      }
    } catch {
      // 세션 해석 실패 — 비회원으로 간주하고 통과 (raw error 비노출)
    }

    // 미인증(비회원)이어도 항상 통과. request.user 는 undefined 로 남는다.
    return true;
  }
}
