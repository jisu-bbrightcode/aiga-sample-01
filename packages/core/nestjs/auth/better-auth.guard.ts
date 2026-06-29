import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { parseJwtFromHeader } from "./jwt-parser";
import type { User } from "./user";

/**
 * 동적 import("@repo/core/auth/server") 의 최소 구조 타입.
 * SyncAuthService 와 동일 패턴 — better-auth 런타임을 정적 의존성으로
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
 * REST 컨트롤러용 인증 가드 — 다음 중 하나면 통과:
 *
 * 1. 유효한 3-part JWT Bearer (기존 JwtAuthGuard 경로 그대로)
 * 2. Better Auth 세션 — 쿠키 또는 opaque bearer 세션 토큰
 *    (tRPC createContext 의 auth.api.getSession fallback 과 동일한 검증.
 *    opaque bearer 는 better-auth `bearer()` 플러그인이 세션 쿠키로 변환)
 *
 * JWT 가 invalid/만료여도 그 JWT 자체를 수락하지 않고 세션 fallback 을
 * 시도한다 (브라우저는 stale JWT 와 함께 유효한 세션 쿠키를 보낼 수 있음).
 * 두 경로 모두 실패하면 401.
 *
 * request.user 는 JWT 경로와 동일한 shape({ id, email, activeOrganizationId })로
 * 채워서 @CurrentUser / NestAdminGuard 등 downstream 소비자가 동작하게 한다.
 */
@Injectable()
export class BetterAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<IncomingHttpRequest>();
    const authHeader = Array.isArray(request.headers.authorization)
      ? request.headers.authorization[0]
      : request.headers.authorization;

    // 1. JWT Bearer (외부 API 클라이언트) — 기존 동작 보존
    const jwtUser = parseJwtFromHeader(authHeader);
    if (jwtUser) {
      request.user = jwtUser;
      return true;
    }

    // 2. Better Auth 세션 fallback (쿠키 / opaque bearer)
    try {
      const { auth } = (await import("@repo/core/auth/server")) as BetterAuthSessionModule;
      const session = await auth.api.getSession({ headers: headersFromRequest(request) });
      if (session?.user?.id) {
        const orgId = session.session?.activeOrganizationId;
        request.user = {
          id: session.user.id,
          email: session.user.email ?? undefined,
          activeOrganizationId:
            typeof orgId === "string" && orgId.length > 0 ? orgId : null,
        };
        return true;
      }
    } catch {
      // 세션 해석 실패 — 아래 401 로 수렴 (raw error 비노출)
    }

    throw new UnauthorizedException("인증이 필요합니다.");
  }
}
