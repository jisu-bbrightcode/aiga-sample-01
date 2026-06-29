import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import {
  type CommunityAppeal,
  type CommunitySanction,
  communityAppeals,
  communityModLogs,
  communitySanctions,
  type SanctionType,
} from "@repo/drizzle/schema";
import { and, desc, eq, lte } from "drizzle-orm";

const SUSPENSION_DAYS = 7;

@Injectable()
export class CommunitySanctionService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  /**
   * 제재를 적용한다 (경고/공식경고/7일정지/영구밴).
   */
  async applySanction(opts: {
    communityId: string;
    userId: string;
    moderatorId: string;
    type: SanctionType;
    reason: string;
    reportId?: string;
  }): Promise<CommunitySanction> {
    let expiresAt: Date | null = null;

    if (opts.type === "suspension") {
      expiresAt = new Date(Date.now() + SUSPENSION_DAYS * 24 * 60 * 60 * 1000);
    }

    const [sanction] = await this.db
      .insert(communitySanctions)
      .values({
        communityId: opts.communityId,
        userId: opts.userId,
        moderatorId: opts.moderatorId,
        type: opts.type,
        reason: opts.reason,
        expiresAt,
        reportId: opts.reportId,
      })
      .returning();

    // 모드 로그
    await this.db.insert(communityModLogs).values({
      communityId: opts.communityId,
      moderatorId: opts.moderatorId,
      action: opts.type === "permanent_ban" ? "ban_user" : "other",
      targetType: "user",
      targetId: opts.userId,
      reason: `${opts.type}: ${opts.reason}`,
    });

    return sanction as CommunitySanction;
  }

  /**
   * 만료된 제재를 자동으로 expired로 업데이트한다.
   */
  async expireOverdueSanctions(): Promise<number> {
    const result = await this.db
      .update(communitySanctions)
      .set({ status: "expired", updatedAt: new Date() })
      .where(
        and(eq(communitySanctions.status, "active"), lte(communitySanctions.expiresAt, new Date())),
      );

    return (result as any).rowCount ?? 0;
  }

  /**
   * 유저의 활성 제재를 확인한다.
   * 만료된 제재는 쿼리에서 제외하고, 해당 건만 lazy 업데이트.
   */
  async getActiveSanction(communityId: string, userId: string): Promise<CommunitySanction | null> {
    const [sanction] = await this.db
      .select()
      .from(communitySanctions)
      .where(
        and(
          eq(communitySanctions.communityId, communityId),
          eq(communitySanctions.userId, userId),
          eq(communitySanctions.status, "active"),
        ),
      )
      .orderBy(desc(communitySanctions.createdAt))
      .limit(1);

    if (!sanction) return null;

    // 만료된 경우 lazy 업데이트
    if (sanction.expiresAt && sanction.expiresAt <= new Date()) {
      await this.db
        .update(communitySanctions)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(communitySanctions.id, sanction.id));
      return null;
    }

    return sanction as CommunitySanction;
  }

  /**
   * 유저의 제재 이력을 조회한다.
   */
  async getSanctionHistory(communityId: string, userId: string): Promise<CommunitySanction[]> {
    const items = await this.db
      .select()
      .from(communitySanctions)
      .where(
        and(eq(communitySanctions.communityId, communityId), eq(communitySanctions.userId, userId)),
      )
      .orderBy(desc(communitySanctions.createdAt));

    return items as CommunitySanction[];
  }

  // ── Appeals ──────────────────────────────────

  /**
   * 이의신청을 제출한다.
   */
  async submitAppeal(sanctionId: string, userId: string, reason: string): Promise<CommunityAppeal> {
    const [sanction] = await this.db
      .select()
      .from(communitySanctions)
      .where(eq(communitySanctions.id, sanctionId))
      .limit(1);

    if (!sanction) {
      throw new NotFoundException("제재 기록을 찾을 수 없습니다.");
    }

    if (sanction.userId !== userId) {
      throw new ForbiddenException("본인의 제재에 대해서만 이의신청할 수 있습니다.");
    }

    // 이미 이의신청이 있는지 확인
    const [existing] = await this.db
      .select()
      .from(communityAppeals)
      .where(eq(communityAppeals.sanctionId, sanctionId))
      .limit(1);

    if (existing) {
      throw new ConflictException("이미 이의신청이 접수되어 있습니다.");
    }

    const [appeal] = await this.db
      .insert(communityAppeals)
      .values({
        sanctionId,
        userId,
        reason,
      })
      .returning();

    // 제재 상태를 appealed로 변경
    await this.db
      .update(communitySanctions)
      .set({ status: "appealed", updatedAt: new Date() })
      .where(eq(communitySanctions.id, sanctionId));

    return appeal as CommunityAppeal;
  }

  /**
   * 이의신청을 처리한다.
   * 원래 제재한 모더레이터와 다른 모더레이터만 처리 가능.
   */
  async resolveAppeal(opts: {
    appealId: string;
    reviewerId: string;
    status: "upheld" | "overturned" | "modified";
    reviewNote: string;
  }): Promise<CommunityAppeal> {
    const [appeal] = await this.db
      .select()
      .from(communityAppeals)
      .where(eq(communityAppeals.id, opts.appealId))
      .limit(1);

    if (!appeal) {
      throw new NotFoundException("이의신청을 찾을 수 없습니다.");
    }

    // 원래 제재자와 다른 모더레이터인지 확인
    const [sanction] = await this.db
      .select()
      .from(communitySanctions)
      .where(eq(communitySanctions.id, appeal.sanctionId))
      .limit(1);

    if (sanction && sanction.moderatorId === opts.reviewerId) {
      throw new ForbiddenException(
        "원래 제재를 부과한 모더레이터는 이의신청을 처리할 수 없습니다.",
      );
    }

    const [updated] = await this.db
      .update(communityAppeals)
      .set({
        status: opts.status,
        reviewerId: opts.reviewerId,
        reviewNote: opts.reviewNote,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(communityAppeals.id, opts.appealId))
      .returning();

    // 이의신청 인용 시 제재 해제
    if (opts.status === "overturned" && sanction) {
      await this.db
        .update(communitySanctions)
        .set({ status: "overturned", updatedAt: new Date() })
        .where(eq(communitySanctions.id, sanction.id));
    }

    // 모드 로그
    if (sanction) {
      await this.db.insert(communityModLogs).values({
        communityId: sanction.communityId,
        moderatorId: opts.reviewerId,
        action: "other",
        targetType: "user",
        targetId: sanction.userId,
        reason: `이의신청 ${opts.status}: ${opts.reviewNote}`,
      });
    }

    return updated as CommunityAppeal;
  }

  /**
   * 대기 중인 이의신청 목록을 조회한다.
   */
  async getPendingAppeals(communityId: string): Promise<CommunityAppeal[]> {
    const items = await this.db
      .select({
        appeal: communityAppeals,
      })
      .from(communityAppeals)
      .innerJoin(communitySanctions, eq(communityAppeals.sanctionId, communitySanctions.id))
      .where(
        and(
          eq(communitySanctions.communityId, communityId),
          eq(communityAppeals.status, "pending"),
        ),
      )
      .orderBy(desc(communityAppeals.createdAt));

    return items.map((i) => i.appeal) as CommunityAppeal[];
  }
}
