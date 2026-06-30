/**
 * 커뮤니티 수정/설정 권한 정책 (PB-COMM-SPACE-API-UPDATE-001 / BBR-589)
 *
 * 순수(DB-free) 함수로 두 가지를 분리해 검증한다:
 *  1) AC#1 — owner/admin/moderator 역할별로 "수정 가능한 필드"가 분리되어 있다.
 *  2) AC#2 감사 로그용 — 실제로 바뀐 필드의 before/after diff를 계산한다.
 *
 * 역할 정책:
 *  - owner / admin : 모든 설정 필드 변경 가능 (정체성·노출 정책 포함).
 *  - moderator     : 운영 설정만 변경 가능. 커뮤니티 정체성(name)과 노출 상태(type)는 불가.
 *  - member / 비멤버 / 차단 : 변경 불가.
 */

export type CommunityUpdateRole = "owner" | "admin" | "moderator" | "member";

/** 설정을 변경할 수 있는 역할 (이 외에는 어떤 필드도 변경 불가). */
const SETTINGS_EDITOR_ROLES: ReadonlySet<CommunityUpdateRole> = new Set([
  "owner",
  "admin",
  "moderator",
]);

/** 모든 필드를 변경할 수 있는 역할. */
const FULL_ACCESS_ROLES: ReadonlySet<CommunityUpdateRole> = new Set(["owner", "admin"]);

/**
 * owner/admin 전용 필드. moderator 가 변경하려 하면 거부된다.
 *  - name : 커뮤니티 정체성
 *  - type : 공개/노출 상태 (public | restricted | private)
 */
export const OWNER_ADMIN_ONLY_FIELDS: readonly string[] = ["name", "type"];

export interface UpdatePermission {
  /** 이 역할이 설정 변경 자체를 할 수 있는가. */
  readonly allowed: boolean;
  /** dto 에 포함됐지만 이 역할이 변경할 수 없는 필드 목록. */
  readonly forbiddenFields: readonly string[];
}

/**
 * 역할 + 변경 요청 필드 목록으로 수정 권한을 평가한다.
 *
 * @param role         요청자의 커뮤니티 역할 (멤버가 아니거나 차단이면 null).
 * @param changedKeys  PATCH/PUT body 에 실제로 포함된 필드 키.
 */
export function evaluateCommunityUpdate(
  role: CommunityUpdateRole | null,
  changedKeys: readonly string[],
): UpdatePermission {
  if (!role || !SETTINGS_EDITOR_ROLES.has(role)) {
    return { allowed: false, forbiddenFields: [] };
  }

  if (FULL_ACCESS_ROLES.has(role)) {
    return { allowed: true, forbiddenFields: [] };
  }

  // moderator: owner/admin 전용 필드를 건드리면 거부.
  const forbiddenFields = changedKeys.filter((key) => OWNER_ADMIN_ONLY_FIELDS.includes(key));
  return { allowed: true, forbiddenFields };
}

export interface FieldChange {
  readonly from: unknown;
  readonly to: unknown;
}

/**
 * 변경 전 엔티티와 수정 dto 를 비교해 실제로 값이 바뀐 필드만 diff 로 만든다.
 * (감사 로그 details 에 기록, AC#2). undefined 값(미포함 필드)은 무시한다.
 */
export function buildSettingsChanges(
  before: Record<string, unknown>,
  dto: Record<string, unknown>,
): Record<string, FieldChange> {
  const changes: Record<string, FieldChange> = {};

  for (const [key, nextValue] of Object.entries(dto)) {
    if (nextValue === undefined) continue;

    const prevValue = before[key];
    if (!isEqual(prevValue, nextValue)) {
      changes[key] = { from: prevValue ?? null, to: nextValue };
    }
  }

  return changes;
}

/** 스칼라/배열/객체 값 동등 비교 (감사 diff 용 — 안정적 직렬화 기반). */
function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) return false;
  if (typeof a !== "object" && typeof b !== "object") return false;
  return stableStringify(a) === stableStringify(b);
}

/** 키 순서에 무관한 JSON 직렬화 (객체 비교 안정화). */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([x], [y]) => compareKeys(x, y))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(",")}}`;
}

/** 문자열 키 사전식 비교 (중첩 삼항 없이). */
function compareKeys(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
