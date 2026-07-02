/**
 * Community creation bootstrap policy.
 *
 * Pure helpers that make the "생성 권한/제한 정책" (BBR-588) explicit and
 * testable without a database:
 *   - per-user creation limit
 *   - default rule set seeded when the creator supplies none
 *   - the full moderator permission set granted to the creator
 */

import { ForbiddenException } from "@nestjs/common";
import type { ModeratorPermissions } from "@repo/drizzle/schema";

/** 한 사용자가 소유(생성)할 수 있는 커뮤니티 최대 개수. */
export const MAX_OWNED_COMMUNITIES = 10;

/** 커뮤니티 규칙 1건. `communities.rules` jsonb 컬럼의 요소 형태와 동일. */
export interface CommunityRuleInput {
  title: string;
  description: string;
}

/**
 * 생성자가 규칙을 입력하지 않았을 때 적용하는 기본 규칙.
 * UGC 안전(App Store/Play) 요구를 반영해 괴롭힘·불법 콘텐츠 금지를 포함한다.
 */
export const DEFAULT_COMMUNITY_RULES: readonly CommunityRuleInput[] = [
  {
    title: "서로 존중하기",
    description: "괴롭힘, 혐오 발언, 인신공격은 허용되지 않습니다.",
  },
  {
    title: "주제 관련성 유지",
    description: "커뮤니티 주제와 관련된 게시물과 댓글만 작성해 주세요.",
  },
  {
    title: "스팸 및 불법 콘텐츠 금지",
    description: "광고성 스팸, 사기, 불법 정보 또는 저작권 침해 콘텐츠를 게시하지 마세요.",
  },
];

/** 커뮤니티 생성자에게 부여하는 모더레이터 권한 (모든 권한 허용). */
export const OWNER_MODERATOR_PERMISSIONS: ModeratorPermissions = {
  managePosts: true,
  manageComments: true,
  manageUsers: true,
  manageFlairs: true,
  manageRules: true,
  manageSettings: true,
  manageModerators: true,
  viewModLog: true,
  viewReports: true,
};

/**
 * 생성 시 적용할 규칙을 결정한다.
 * 입력 규칙이 비어 있으면 기본 규칙을 새 배열로 반환한다 (불변성 유지).
 */
export function resolveInitialRules(
  rules?: readonly CommunityRuleInput[] | null,
): CommunityRuleInput[] {
  if (rules && rules.length > 0) {
    return rules.map((rule) => ({ title: rule.title, description: rule.description }));
  }
  return DEFAULT_COMMUNITY_RULES.map((rule) => ({ ...rule }));
}

/**
 * 사용자별 커뮤니티 생성 한도를 검증한다.
 * 이미 보유한 커뮤니티 수가 한도 이상이면 ForbiddenException 을 던진다.
 */
export function assertWithinCreationLimit(ownedCount: number): void {
  if (ownedCount >= MAX_OWNED_COMMUNITIES) {
    throw new ForbiddenException(
      `사용자당 최대 ${MAX_OWNED_COMMUNITIES}개의 커뮤니티만 생성할 수 있습니다.`,
    );
  }
}
