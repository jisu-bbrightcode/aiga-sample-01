import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import { type CommunityUserBlock, communityUserBlocks } from "@repo/drizzle/schema";
import { and, eq, or } from "drizzle-orm";
import {
  BLOCK_REJECTION_MESSAGES,
  evaluateBlockTarget,
  parseSystemAccountIds,
} from "./block-policy";

@Injectable()
export class CommunityBlockService {
  /** 차단 불가 시스템 계정 ID 집합 (공지/모더레이션 봇 등). */
  private readonly systemAccountIds: ReadonlySet<string>;

  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {
    this.systemAccountIds = new Set(
      parseSystemAccountIds(process.env.COMMUNITY_SYSTEM_ACCOUNT_IDS),
    );
  }

  /**
   * 유저를 차단한다. 자기 자신/시스템 계정은 차단 불가(예외 정책 BBR-615 AC#2).
   */
  async block(blockerId: string, blockedId: string): Promise<CommunityUserBlock> {
    const evaluation = evaluateBlockTarget({
      blockerId,
      blockedId,
      systemAccountIds: this.systemAccountIds,
    });
    if (!evaluation.ok && evaluation.reason) {
      throw new ForbiddenException(BLOCK_REJECTION_MESSAGES[evaluation.reason]);
    }

    const existing = await this.db
      .select()
      .from(communityUserBlocks)
      .where(
        and(
          eq(communityUserBlocks.blockerId, blockerId),
          eq(communityUserBlocks.blockedId, blockedId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException("이미 차단된 사용자입니다.");
    }

    const [block] = await this.db
      .insert(communityUserBlocks)
      .values({ blockerId, blockedId })
      .returning();

    return block as CommunityUserBlock;
  }

  /**
   * 차단을 해제한다.
   */
  async unblock(blockerId: string, blockedId: string): Promise<void> {
    const [existing] = await this.db
      .select()
      .from(communityUserBlocks)
      .where(
        and(
          eq(communityUserBlocks.blockerId, blockerId),
          eq(communityUserBlocks.blockedId, blockedId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException("차단 기록을 찾을 수 없습니다.");
    }

    await this.db
      .delete(communityUserBlocks)
      .where(
        and(
          eq(communityUserBlocks.blockerId, blockerId),
          eq(communityUserBlocks.blockedId, blockedId),
        ),
      );
  }

  /**
   * 양방향 차단 ID 목록을 반환한다.
   * 내가 차단한 유저 + 나를 차단한 유저 모두 포함.
   */
  async getBlockedUserIds(userId: string): Promise<string[]> {
    const blocks = await this.db
      .select({
        blockerId: communityUserBlocks.blockerId,
        blockedId: communityUserBlocks.blockedId,
      })
      .from(communityUserBlocks)
      .where(
        or(eq(communityUserBlocks.blockerId, userId), eq(communityUserBlocks.blockedId, userId)),
      );

    const ids = new Set<string>();
    for (const b of blocks) {
      if (b.blockerId !== userId) ids.add(b.blockerId);
      if (b.blockedId !== userId) ids.add(b.blockedId);
    }
    return [...ids];
  }

  /**
   * 내가 차단한 유저 목록 (차단 관리 UI용)
   */
  async getBlockList(userId: string): Promise<CommunityUserBlock[]> {
    const items = await this.db
      .select()
      .from(communityUserBlocks)
      .where(eq(communityUserBlocks.blockerId, userId));

    return items as CommunityUserBlock[];
  }

  /**
   * 특정 유저를 차단했는지 확인
   */
  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const [result] = await this.db
      .select()
      .from(communityUserBlocks)
      .where(
        or(
          and(
            eq(communityUserBlocks.blockerId, blockerId),
            eq(communityUserBlocks.blockedId, blockedId),
          ),
          and(
            eq(communityUserBlocks.blockerId, blockedId),
            eq(communityUserBlocks.blockedId, blockerId),
          ),
        ),
      )
      .limit(1);

    return !!result;
  }

  /**
   * 알림 차단 정책 — actor 가 recipient 에게 보내는 알림을 발송해야 하는지 판정한다.
   * 양방향 차단(둘 중 한 쪽이 상대를 차단)이 있으면 발송하지 않는다.
   *
   * 커뮤니티 알림 fan-out 이 추가될 때 이 게이트를 단일 진입점으로 사용한다
   * (노출 제외 정책과 동일한 차단 소스를 공유 — docs/reference/community-block-policy.md).
   */
  async shouldNotify(recipientId: string, actorId: string): Promise<boolean> {
    if (recipientId === actorId) return true;
    return !(await this.isBlocked(recipientId, actorId));
  }
}
