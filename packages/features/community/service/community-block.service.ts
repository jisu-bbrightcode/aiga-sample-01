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

@Injectable()
export class CommunityBlockService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  /**
   * 유저를 차단한다. 자기 자신은 차단 불가.
   */
  async block(blockerId: string, blockedId: string): Promise<CommunityUserBlock> {
    if (blockerId === blockedId) {
      throw new ForbiddenException("자기 자신을 차단할 수 없습니다.");
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
}
