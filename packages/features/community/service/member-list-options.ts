/**
 * 멤버/모더레이터 목록 필터 파싱 — 순수 함수 (PB-COMM-MEMBER-API-001 / BBR-592).
 *
 * role/status query 파라미터를 안전한 enum 값으로 정규화한다. 알 수 없는 값은
 * undefined(필터 없음)로 떨어뜨려 fail-safe 하게 동작한다. status=banned/muted 는
 * 운영(모더레이터/관리자) 뷰에서만 의미가 있으며, 공개 뷰는 항상 활성 멤버만 본다.
 */

export const MEMBER_ROLES = ["member", "moderator", "admin", "owner"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const MEMBER_STATUSES = ["active", "banned", "muted"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const DEFAULT_MEMBER_LIST_LIMIT = 50;
export const MAX_MEMBER_LIST_LIMIT = 100;

/** 알 수 없는 role 값은 undefined(필터 없음)로 떨어뜨린다. */
export function parseMemberRole(raw: string | undefined | null): MemberRole | undefined {
  if (!raw) return undefined;
  return (MEMBER_ROLES as readonly string[]).includes(raw) ? (raw as MemberRole) : undefined;
}

/** 알 수 없는 status 값은 undefined(필터 없음)로 떨어뜨린다. */
export function parseMemberStatus(raw: string | undefined | null): MemberStatus | undefined {
  if (!raw) return undefined;
  return (MEMBER_STATUSES as readonly string[]).includes(raw) ? (raw as MemberStatus) : undefined;
}

export function normalizeMemberLimit(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw) || raw < 1) return DEFAULT_MEMBER_LIST_LIMIT;
  return Math.min(Math.floor(raw), MAX_MEMBER_LIST_LIMIT);
}

export function normalizeMemberPage(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw) || raw < 1) return 1;
  return Math.floor(raw);
}

/**
 * 운영 권한과 요청 status 를 합쳐 실제 적용할 상태 필터를 결정한다.
 *
 * - 공개 뷰(isOperational=false): status 파라미터는 무시되고 항상 "active"(banned 제외).
 *   banned/muted 같은 운영 상태를 공개 요청으로 끌어올 수 없다(권한 상승 방지).
 * - 운영 뷰(isOperational=true): 요청 status 그대로 적용. 미지정 시 undefined(전체).
 */
export function resolveMemberStatusFilter(
  status: MemberStatus | undefined,
  isOperational: boolean,
): MemberStatus | "active" | undefined {
  if (!isOperational) return "active";
  return status;
}
