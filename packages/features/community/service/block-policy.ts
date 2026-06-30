/**
 * 작성자 차단 예외 정책 — 순수 함수 (PB-COMM-BLOCK-API-CREATE-001 / BBR-615).
 *
 * AC#2("자기 자신 또는 시스템 계정 차단 같은 예외 정책이 정의되어 있다")를
 * DB-free 로 고정한다. 차단 가능 여부 판정만 담당하고, 예외 throw / DB 접근은
 * 서비스 레이어가 책임진다.
 *
 * 시스템 계정 ID 집합은 환경설정(`COMMUNITY_SYSTEM_ACCOUNT_IDS`)에서 주입된다.
 * 공지/모더레이션 봇 같은 운영 계정을 차단하면 안전 공지가 사용자 화면에서
 * 사라질 수 있으므로 차단 대상에서 제외한다.
 */

export type BlockRejectionReason = "self_block" | "system_account";

export interface BlockTargetEvaluation {
  readonly ok: boolean;
  readonly reason?: BlockRejectionReason;
}

export interface EvaluateBlockTargetInput {
  readonly blockerId: string;
  readonly blockedId: string;
  /** 차단 불가 시스템 계정 ID 집합. 미지정 시 시스템 계정 제약 없음. */
  readonly systemAccountIds?: Iterable<string>;
}

/** 거부 사유별 사용자 노출용 메시지. */
export const BLOCK_REJECTION_MESSAGES: Record<BlockRejectionReason, string> = {
  self_block: "자기 자신을 차단할 수 없습니다.",
  system_account: "차단할 수 없는 계정입니다.",
};

/**
 * 차단 대상이 허용되는지 평가한다. 순수 함수 — 동일 입력에 항상 동일 출력.
 */
export function evaluateBlockTarget(input: EvaluateBlockTargetInput): BlockTargetEvaluation {
  const { blockerId, blockedId } = input;

  if (blockerId === blockedId) {
    return { ok: false, reason: "self_block" };
  }

  if (input.systemAccountIds) {
    const systemAccounts =
      input.systemAccountIds instanceof Set
        ? input.systemAccountIds
        : new Set(input.systemAccountIds);
    if (systemAccounts.has(blockedId)) {
      return { ok: false, reason: "system_account" };
    }
  }

  return { ok: true };
}

/**
 * 환경설정 문자열(쉼표 구분)에서 시스템 계정 ID 목록을 파싱한다.
 * 공백/빈 항목은 제거하고 중복은 제거한다.
 */
export function parseSystemAccountIds(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const ids = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return [...new Set(ids)];
}
