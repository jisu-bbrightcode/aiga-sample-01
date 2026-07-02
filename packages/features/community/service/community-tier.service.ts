import { Injectable, NotFoundException } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import { communityMemberships, userKarma } from "@repo/drizzle/schema";
import { and, eq } from "drizzle-orm";

type MemberTier = "newcomer" | "member" | "contributor" | "trusted" | "leader";

/** 카르마 → 등급 매핑 (커스터마이즈 가능) */
const TIER_THRESHOLDS: { tier: MemberTier; minKarma: number }[] = [
  { tier: "leader", minKarma: 1000 },
  { tier: "trusted", minKarma: 500 },
  { tier: "contributor", minKarma: 100 },
  { tier: "member", minKarma: 10 },
  { tier: "newcomer", minKarma: 0 },
];

/** 등급별 권한 */
export const TIER_PRIVILEGES: Record<
  MemberTier,
  {
    bypassKeywordFilter: boolean;
    maxPostsPerDay: number;
    maxCommentsPerDay: number;
    canReportAbuse: boolean;
  }
> = {
  newcomer: {
    bypassKeywordFilter: false,
    maxPostsPerDay: 3,
    maxCommentsPerDay: 10,
    canReportAbuse: true,
  },
  member: {
    bypassKeywordFilter: false,
    maxPostsPerDay: 10,
    maxCommentsPerDay: 50,
    canReportAbuse: true,
  },
  contributor: {
    bypassKeywordFilter: false,
    maxPostsPerDay: 30,
    maxCommentsPerDay: 100,
    canReportAbuse: true,
  },
  trusted: {
    bypassKeywordFilter: true,
    maxPostsPerDay: 100,
    maxCommentsPerDay: 500,
    canReportAbuse: true,
  },
  leader: {
    bypassKeywordFilter: true,
    maxPostsPerDay: 100,
    maxCommentsPerDay: 500,
    canReportAbuse: true,
  },
};

@Injectable()
export class CommunityTierService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  /**
   * 카르마를 기준으로 등급을 산정한다.
   */
  calculateTier(totalKarma: number): MemberTier {
    for (const { tier, minKarma } of TIER_THRESHOLDS) {
      if (totalKarma >= minKarma) return tier;
    }
    return "newcomer";
  }

  /**
   * 유저의 멤버십 등급을 갱신한다 (카르마 기반).
   */
  async refreshTier(communityId: string, userId: string): Promise<MemberTier> {
    const [karma] = await this.db
      .select({ totalKarma: userKarma.totalKarma })
      .from(userKarma)
      .where(eq(userKarma.userId, userId))
      .limit(1);

    const tier = this.calculateTier(karma?.totalKarma ?? 0);

    await this.db
      .update(communityMemberships)
      .set({ tier })
      .where(
        and(
          eq(communityMemberships.communityId, communityId),
          eq(communityMemberships.userId, userId),
        ),
      );

    return tier;
  }

  /**
   * 유저의 현재 등급과 권한을 반환한다.
   */
  async getTierInfo(communityId: string, userId: string) {
    const [membership] = await this.db
      .select({ tier: communityMemberships.tier })
      .from(communityMemberships)
      .where(
        and(
          eq(communityMemberships.communityId, communityId),
          eq(communityMemberships.userId, userId),
        ),
      )
      .limit(1);

    const tier = (membership?.tier ?? "newcomer") as MemberTier;
    return {
      tier,
      privileges: TIER_PRIVILEGES[tier],
    };
  }

  // ── Onboarding ──────────────────────────────────

  /**
   * 온보딩 완료를 기록한다.
   */
  async completeOnboarding(communityId: string, userId: string): Promise<void> {
    await this.db
      .update(communityMemberships)
      .set({ onboardingCompletedAt: new Date() })
      .where(
        and(
          eq(communityMemberships.communityId, communityId),
          eq(communityMemberships.userId, userId),
        ),
      );
  }

  /**
   * 규칙 동의를 기록한다.
   */
  async acceptRules(communityId: string, userId: string): Promise<void> {
    await this.db
      .update(communityMemberships)
      .set({ rulesAcceptedAt: new Date() })
      .where(
        and(
          eq(communityMemberships.communityId, communityId),
          eq(communityMemberships.userId, userId),
        ),
      );
  }

  /**
   * 멤버가 커뮤니티 규칙에 동의했는지 여부를 반환한다.
   * 멤버십이 없으면 false (작성 게이트는 별도 멤버십 검사로 차단).
   */
  async hasAcceptedRules(communityId: string, userId: string): Promise<boolean> {
    const [membership] = await this.db
      .select({ rulesAcceptedAt: communityMemberships.rulesAcceptedAt })
      .from(communityMemberships)
      .where(
        and(
          eq(communityMemberships.communityId, communityId),
          eq(communityMemberships.userId, userId),
        ),
      )
      .limit(1);

    return !!membership?.rulesAcceptedAt;
  }

  /**
   * 온보딩 상태를 조회한다.
   */
  async getOnboardingStatus(communityId: string, userId: string) {
    const [membership] = await this.db
      .select({
        onboardingCompletedAt: communityMemberships.onboardingCompletedAt,
        rulesAcceptedAt: communityMemberships.rulesAcceptedAt,
        joinedAt: communityMemberships.joinedAt,
        tier: communityMemberships.tier,
      })
      .from(communityMemberships)
      .where(
        and(
          eq(communityMemberships.communityId, communityId),
          eq(communityMemberships.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new NotFoundException("멤버십을 찾을 수 없습니다.");
    }

    return {
      isOnboarded: !!membership.onboardingCompletedAt,
      hasAcceptedRules: !!membership.rulesAcceptedAt,
      joinedAt: membership.joinedAt,
      tier: membership.tier,
    };
  }
}
