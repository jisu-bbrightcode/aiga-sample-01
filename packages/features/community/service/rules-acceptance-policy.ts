import type { AutomodConfig } from "@repo/drizzle/schema";

/**
 * Rules acceptance gate (PB-COMM-RULES-FLAIR-API-001 / AC#1).
 *
 * 커뮤니티가 `automodConfig.requireRulesAcceptance` 를 켜면, 멤버는 규칙에
 * 동의(`communityMemberships.rulesAcceptedAt`)하기 전까지 게시글/댓글을
 * 작성할 수 없다. 동의 여부 판정은 순수 함수로 분리해 게시글/댓글 양쪽
 * 작성 경로가 동일한 규칙을 공유하도록 한다.
 */

export interface RulesGateDecision {
  /** 작성을 허용할지 여부. */
  allowed: boolean;
  /** 차단 시 사용자에게 보여줄 안내 문구(허용이면 undefined). */
  reason?: string;
}

const RULES_NOT_ACCEPTED_MESSAGE = "커뮤니티 규칙에 동의한 후 작성할 수 있습니다.";

/**
 * 커뮤니티가 작성 전 규칙 동의를 요구하는지 판정한다.
 * automodConfig 가 없거나 플래그가 꺼져 있으면 false.
 */
export function requiresRulesAcceptance(config: AutomodConfig | null | undefined): boolean {
  return config?.requireRulesAcceptance === true;
}

/**
 * 작성 시점 규칙 동의 게이트를 평가한다.
 *
 * - 규칙 동의가 필요 없으면 항상 허용.
 * - 필요한데 동의하지 않았으면 차단(+안내 문구).
 * - 필요하고 동의했으면 허용.
 */
export function evaluateRulesGate(
  config: AutomodConfig | null | undefined,
  hasAcceptedRules: boolean,
): RulesGateDecision {
  if (!requiresRulesAcceptance(config)) {
    return { allowed: true };
  }
  if (hasAcceptedRules) {
    return { allowed: true };
  }
  return { allowed: false, reason: RULES_NOT_ACCEPTED_MESSAGE };
}
