/**
 * User-directory response mappers — pure projection functions.
 *
 * FR-001 사용자 (BBR-526). The list/search API exposes the `profiles` record
 * (REUSED from core, populated by social login) joined with the user's current
 * grade (`user_grades` → `user_grade_definitions`). A strict three-tier field
 * boundary applies:
 *
 * - public (no auth):  안전한 디렉터리 카드. handle/name/bio/avatar + 등급 배지.
 *                      이메일·인증수단·활성여부·동의시점은 절대 노출하지 않는다.
 * - self (본인):       위 공개 필드 + 본인 email/authProvider/isActive/동의시점.
 * - admin (운영자):    전체 레코드 + 등급 출처/일일한도/소프트삭제 부기.
 *
 * Each mapper builds a brand-new object field-by-field rather than deleting
 * keys off the row, so a future column added to `profiles` is excluded from
 * the public/self output by default (fail-closed).
 */
import type { Profile } from "@repo/drizzle";

/** Row shape returned by the directory join (profile + denormalized grade). */
export interface UserDirectoryRow {
  profile: Profile;
  gradeId: string | null;
  gradeSlug: string | null;
  gradeName: string | null;
  gradeDailyUsageLimit: number | null;
  gradeSource: string | null;
  gradeDeterminedAt: Date | string | null;
  gradeExpiresAt: Date | string | null;
}

const iso = (value: Date | string | null | undefined): string | null => {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
};

/** Resolved grade badge, or null when the user has no grade row yet. */
export interface GradeBadge {
  id: string;
  slug: string;
  name: string;
}

function toGradeBadge(row: UserDirectoryRow): GradeBadge | null {
  if (!row.gradeId || !row.gradeSlug || !row.gradeName) return null;
  return { id: row.gradeId, slug: row.gradeSlug, name: row.gradeName };
}

// ---------------------------------------------------------------------------
// Public — member directory card (unauthenticated)
// ---------------------------------------------------------------------------

export interface PublicUser {
  id: string;
  handle: string | null;
  name: string;
  bio: string | null;
  avatar: string | null;
  grade: GradeBadge | null;
  joinedAt: string | null;
}

export function toPublicUser(row: UserDirectoryRow): PublicUser {
  const p = row.profile;
  return {
    id: p.id,
    handle: p.handle,
    name: p.name,
    bio: p.bio,
    avatar: p.avatar,
    grade: toGradeBadge(row),
    joinedAt: iso(p.createdAt),
  };
}

// ---------------------------------------------------------------------------
// Self — own record (authenticated, BetterAuthGuard)
// ---------------------------------------------------------------------------

export interface SelfUser extends PublicUser {
  email: string;
  authProvider: string | null;
  isActive: boolean;
  marketingConsentAt: string | null;
  updatedAt: string | null;
}

export function toSelfUser(row: UserDirectoryRow): SelfUser {
  const p = row.profile;
  return {
    ...toPublicUser(row),
    email: p.email,
    authProvider: p.authProvider,
    isActive: p.isActive,
    marketingConsentAt: iso(p.marketingConsentAt),
    updatedAt: iso(p.updatedAt),
  };
}

// ---------------------------------------------------------------------------
// Admin — full editorial view (BetterAuthGuard + BetterAuthAdminGuard)
// ---------------------------------------------------------------------------

export interface AdminGradeDetail extends GradeBadge {
  dailyUsageLimit: number | null;
  source: string | null;
  determinedAt: string | null;
  expiresAt: string | null;
}

export interface AdminUser {
  id: string;
  handle: string | null;
  name: string;
  email: string;
  bio: string | null;
  avatar: string | null;
  authProvider: string | null;
  isActive: boolean;
  grade: AdminGradeDetail | null;
  marketingConsentAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
}

export function toAdminUser(row: UserDirectoryRow): AdminUser {
  const p = row.profile;
  const badge = toGradeBadge(row);
  return {
    id: p.id,
    handle: p.handle,
    name: p.name,
    email: p.email,
    bio: p.bio,
    avatar: p.avatar,
    authProvider: p.authProvider,
    isActive: p.isActive,
    grade: badge
      ? {
          ...badge,
          dailyUsageLimit: row.gradeDailyUsageLimit,
          source: row.gradeSource,
          determinedAt: iso(row.gradeDeterminedAt),
          expiresAt: iso(row.gradeExpiresAt),
        }
      : null,
    marketingConsentAt: iso(p.marketingConsentAt),
    createdAt: iso(p.createdAt),
    updatedAt: iso(p.updatedAt),
    deletedAt: iso(p.deletedAt),
  };
}
