/**
 * Super Admin Bootstrap — configuration & pure helpers
 *
 * 순수 함수만 모아두는 모듈. DB/네트워크 의존성이 없어 단위 테스트가 쉽다.
 * 실제 부트스트랩 로직은 bootstrap-super-admin.ts 에서 이 값을 사용한다.
 */

/**
 * Acceptance Criteria 가 고정한 기본 슈퍼 계정 자격 증명.
 * 알려진 값이므로 production 인수 전 반드시 교체/비활성 처리해야 한다.
 */
export const DEFAULT_SUPER_ADMIN_EMAIL = "first@super.local";
export const DEFAULT_SUPER_ADMIN_PASSWORD = "q1w2e3r4t5!$";
export const DEFAULT_SUPER_ADMIN_NAME = "Super Admin";

/**
 * 슈퍼 계정에 admin 접근 권한을 부여하기 위한 기본 조직.
 * admin 앱은 Better Auth organization 멤버십의 role(owner/admin)로 접근을 게이트한다
 * (packages/core/auth/guards/admin-guard.tsx, hooks/use-profile-sync.ts 참고).
 */
export const DEFAULT_ORG_NAME = "AIGA";
export const DEFAULT_ORG_SLUG = "aiga";

/** admin-guard 가 허용하는 최상위 역할. */
export const OWNER_ROLE = "owner";

export interface SuperAdminBootstrapConfig {
  email: string;
  password: string;
  name: string;
  orgName: string;
  orgSlug: string;
  role: string;
}

type EnvLike = Record<string, string | undefined>;

function pick(env: EnvLike, key: string, fallback: string): string {
  const value = env[key];
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
}

/**
 * 환경변수 오버라이드를 적용해 부트스트랩 설정을 만든다.
 * 오버라이드가 없으면 Acceptance Criteria 의 기본값을 사용한다.
 */
export function resolveSuperAdminConfig(env: EnvLike): SuperAdminBootstrapConfig {
  return {
    email: pick(env, "PRODUCT_BUILDER_SEED_EMAIL", DEFAULT_SUPER_ADMIN_EMAIL),
    password: pick(env, "PRODUCT_BUILDER_SEED_PASSWORD", DEFAULT_SUPER_ADMIN_PASSWORD),
    name: pick(env, "PRODUCT_BUILDER_SEED_NAME", DEFAULT_SUPER_ADMIN_NAME),
    orgName: pick(env, "PRODUCT_BUILDER_SEED_ORG_NAME", DEFAULT_ORG_NAME),
    orgSlug: pick(env, "PRODUCT_BUILDER_SEED_ORG_SLUG", DEFAULT_ORG_SLUG),
    role: OWNER_ROLE,
  };
}

/**
 * Better Auth signUpEmail 이 "이미 존재" 의미로 던지는 에러인지 판별한다.
 * 이 경우 idempotent 하게 생성을 건너뛴다.
 */
export function isUserAlreadyExistsError(message: string | undefined | null): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("already exists") ||
    normalized.includes("user_already_exists") ||
    normalized.includes("existing user") ||
    normalized.includes("unique") // users.email unique 충돌
  );
}

/**
 * member row 의 PK 를 (userId, orgId) 로 결정적으로 만든다.
 * 같은 입력 → 같은 id → onConflictDoNothing 으로 멱등 보장.
 */
export function deterministicMemberId(userId: string, organizationId: string): string {
  return `mem_${userId}_${organizationId}`;
}
