/**
 * Pure parsing/normalization for the admin user-list query string
 * (BBR-685 / PB-ADMIN-USERS-LIST-001).
 *
 * Extends the BBR-684 list (limit/offset/q) with the customer-requested
 * filter + sort surface:
 *  - status     활성/정지 필터
 *  - accessRole 접근 역할 필터 (owner/admin/member/none)
 *  - sort/order 가입일·최근활동·상태·이름 기준 정렬
 *
 * Kept free of NestJS / drizzle so it can be unit-tested in isolation and
 * reused by the controller. Unknown / malformed values fall back to safe
 * defaults instead of throwing — the list endpoint should degrade to "no
 * extra filter, default sort" rather than 400 on a stray query param.
 */

export type UserStatusFilter = "active" | "inactive";
export type UserAccessRoleFilter = "owner" | "admin" | "member" | "none";
export type UserSortField = "createdAt" | "name" | "status" | "lastActiveAt";
export type SortOrder = "asc" | "desc";

export const DEFAULT_USER_LIST_LIMIT = 20;
export const MAX_USER_LIST_LIMIT = 100;
export const DEFAULT_USER_SORT: UserSortField = "createdAt";
export const DEFAULT_USER_SORT_ORDER: SortOrder = "desc";

const STATUS_VALUES: readonly UserStatusFilter[] = ["active", "inactive"];
const ACCESS_ROLE_VALUES: readonly UserAccessRoleFilter[] = ["owner", "admin", "member", "none"];
const SORT_VALUES: readonly UserSortField[] = ["createdAt", "name", "status", "lastActiveAt"];
const ORDER_VALUES: readonly SortOrder[] = ["asc", "desc"];

export interface RawUserListQuery {
  limit?: string;
  offset?: string;
  q?: string;
  status?: string;
  accessRole?: string;
  sort?: string;
  order?: string;
}

export interface NormalizedUserListQuery {
  limit: number;
  offset: number;
  q?: string;
  status?: UserStatusFilter;
  accessRole?: UserAccessRoleFilter;
  sort: UserSortField;
  order: SortOrder;
}

function parseBoundedInt(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function parseEnum<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  if (!value) return undefined;
  return allowed.includes(value as T) ? (value as T) : undefined;
}

/** Normalize a raw query string into a validated, clamped list query. */
export function normalizeUserListQuery(raw: RawUserListQuery): NormalizedUserListQuery {
  const q = raw.q?.trim();
  return {
    limit: parseBoundedInt(raw.limit, DEFAULT_USER_LIST_LIMIT, 1, MAX_USER_LIST_LIMIT),
    offset: parseBoundedInt(raw.offset, 0, 0, Number.MAX_SAFE_INTEGER),
    q: q ? q : undefined,
    status: parseEnum(raw.status, STATUS_VALUES),
    accessRole: parseEnum(raw.accessRole, ACCESS_ROLE_VALUES),
    sort: parseEnum(raw.sort, SORT_VALUES) ?? DEFAULT_USER_SORT,
    order: parseEnum(raw.order, ORDER_VALUES) ?? DEFAULT_USER_SORT_ORDER,
  };
}
