/**
 * NestJS Suspended-User Guard
 *
 * BetterAuthGuard 이후에 실행되어, 정지(suspended)된 계정이 보호 기능·결제·
 * 커뮤니티 액션을 수행하지 못하도록 차단한다. 관리자가 `PATCH /admin/users/:id/status`
 * 로 `profiles.is_active = false` 로 정지하면, 그 사용자의 인증된 요청은 여기서 403 으로
 * 거부된다. (PB-ADMIN-USERS-STATUS-001 / BBR-689 AC: "정지된 사용자는 보호 기능과
 * 결제/커뮤니티 액션이 제한된다".)
 *
 * 공개(비인증) 라우트는 BetterAuthGuard 를 거치지 않으므로 이 가드도 적용되지 않는다 →
 * 비로그인 탐색은 그대로 유지된다.
 *
 * 조회 실패(프로필 행 없음 / DB 오류)는 fail-open 으로 처리한다: 정지 여부를 확정할 수
 * 없을 때 일시적 장애로 정상 사용자를 대량 잠그지 않기 위함이다. 명시적으로
 * `is_active = false` 인 경우에만 차단한다.
 *
 * @example
 * ```ts
 * @UseGuards(BetterAuthGuard, SuspendedUserGuard)
 * @Post("posts")
 * async createPost() { ... }
 * ```
 */
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { DRIZZLE, profiles } from "@repo/drizzle";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

@Injectable()
export class SuspendedUserGuard implements CanActivate {
  constructor(
    @Inject(DRIZZLE)
    private readonly _db: NodePgDatabase<Record<string, never>>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // BetterAuthGuard 가 선행 실행되어 request.user 를 채워야 한다. 없으면 인증 단계
    // 문제이므로 보수적으로 거부한다 (이 가드 단독 사용은 권장되지 않음).
    if (!user?.id) {
      throw new ForbiddenException("인증이 필요합니다.");
    }

    let suspended = false;

    try {
      const [profile] = await this._db
        .select({ isActive: profiles.isActive })
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1);

      // 프로필 행이 존재하고 명시적으로 비활성일 때만 정지로 간주한다.
      suspended = profile ? profile.isActive === false : false;
    } catch {
      // 조회 실패 시 fail-open (정상 사용자 보호) — 정지 확정 불가.
      suspended = false;
    }

    if (suspended) {
      throw new ForbiddenException("정지된 계정입니다. 자세한 내용은 고객센터로 문의해 주세요.");
    }

    return true;
  }
}
