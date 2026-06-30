/**
 * 커뮤니티 멤버/모더레이터 response mappers — 순수 projection (PB-COMM-MEMBER-API-001 / BBR-592).
 *
 * AC#1("공개 멤버 정보와 관리자/모더레이터용 운영 정보가 분리된다")의 필드 경계를
 * 한 곳에 고정한다. mappers.ts(게시글)와 동일하게 row 에서 `delete` 하지 않고 필드를
 * 하나씩 새 객체로 복사한다 → 나중에 추가되는 컬럼은 기본적으로 공개 projection 에서
 * 제외된다(fail-closed).
 *
 * - public: 표시용 공개 필드만(userId/role/joinedAt/tier/flair). ban/mute/알림 설정 등
 *   운영 필드는 노출하지 않으며, 서비스 레이어가 banned 행 자체를 공개 목록에서 제외한다.
 * - operational(모더레이터/관리자): 공개 필드 + ban/mute/알림 등 운영 필드 전체.
 *
 * banned/left/deleted 노출 정책(AC#2):
 * - left  → 탈퇴 시 membership row 삭제 → 모든 목록에서 자연 제외.
 * - deleted → user 삭제 시 FK cascade 로 membership row 삭제 → 자연 제외.
 * - banned → row 는 남지만 공개 목록에서 제외, 운영 뷰에서만 노출(status=banned 로 조회).
 */
import type { CommunityMembership, CommunityModerator } from "@repo/drizzle/schema";

const iso = (value: Date | string | null | undefined): string | null => {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
};

// ---- members ---------------------------------------------------------------

/** 공개 멤버 목록에 노출되는 필드 (운영 필드 제외). */
export interface PublicMemberItem {
  userId: string;
  role: CommunityMembership["role"];
  tier: CommunityMembership["tier"];
  flairText: string | null;
  flairColor: string | null;
  joinedAt: string | null;
}

export function toPublicMemberItem(row: CommunityMembership): PublicMemberItem {
  return {
    userId: row.userId,
    role: row.role,
    tier: row.tier,
    flairText: row.flairText,
    flairColor: row.flairColor,
    joinedAt: iso(row.joinedAt),
  };
}

/** 운영(모더레이터/관리자) 멤버 view: 공개 필드 + ban/mute/알림 등 운영 필드. */
export interface OperationalMemberItem extends PublicMemberItem {
  id: string;
  communityId: string;
  isBanned: boolean;
  bannedAt: string | null;
  bannedReason: string | null;
  bannedBy: string | null;
  banExpiresAt: string | null;
  isMuted: boolean;
  mutedUntil: string | null;
  notificationsEnabled: boolean;
  onboardingCompletedAt: string | null;
  rulesAcceptedAt: string | null;
}

export function toOperationalMemberItem(row: CommunityMembership): OperationalMemberItem {
  return {
    ...toPublicMemberItem(row),
    id: row.id,
    communityId: row.communityId,
    isBanned: row.isBanned,
    bannedAt: iso(row.bannedAt),
    bannedReason: row.bannedReason,
    bannedBy: row.bannedBy,
    banExpiresAt: iso(row.banExpiresAt),
    isMuted: row.isMuted,
    mutedUntil: iso(row.mutedUntil),
    notificationsEnabled: row.notificationsEnabled,
    onboardingCompletedAt: iso(row.onboardingCompletedAt),
    rulesAcceptedAt: iso(row.rulesAcceptedAt),
  };
}

// ---- moderators ------------------------------------------------------------

/** 공개 모더레이터 목록: 누가 모더레이터인지만 노출(세부 권한은 비공개). */
export interface PublicModeratorItem {
  userId: string;
  appointedAt: string | null;
}

export function toPublicModeratorItem(row: CommunityModerator): PublicModeratorItem {
  return {
    userId: row.userId,
    appointedAt: iso(row.appointedAt),
  };
}

/** 운영 모더레이터 view: 공개 필드 + 권한/임명자 등 운영 필드. */
export interface OperationalModeratorItem extends PublicModeratorItem {
  id: string;
  communityId: string;
  permissions: CommunityModerator["permissions"];
  appointedBy: string;
}

export function toOperationalModeratorItem(row: CommunityModerator): OperationalModeratorItem {
  return {
    ...toPublicModeratorItem(row),
    id: row.id,
    communityId: row.communityId,
    permissions: row.permissions,
    appointedBy: row.appointedBy,
  };
}
