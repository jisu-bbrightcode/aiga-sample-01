import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
// Import tables from the top-level barrel (NOT `@repo/drizzle/schema`): jest
// maps only `^@repo/drizzle$` to the workspace source, so the subpath would
// resolve to a stale checkout in an isolated worktree.
import { InjectDrizzle, profiles, userGradeDefinitions, userGrades } from "@repo/drizzle";
import { and, asc, desc, eq, ilike, isNotNull, isNull, or, type SQL, sql } from "drizzle-orm";
import type { ListAdminUsersQueryDto, ListUsersQueryDto } from "../dto";
import {
  type AdminUser,
  type PublicUser,
  type PublicUserDetail,
  type SelfUser,
  toAdminUser,
  toPublicUser,
  toPublicUserDetail,
  toSelfUser,
  type UserDirectoryRow,
  type ViewerContext,
} from "../mappers";

/**
 * The columns every directory query selects: the full profile plus the
 * denormalized current grade (one grade row per user). Both list + detail
 * reads share this shape so the mappers receive a consistent `UserDirectoryRow`.
 */
const userSelection = {
  profile: profiles,
  gradeId: userGrades.gradeId,
  gradeSlug: userGradeDefinitions.slug,
  gradeName: userGradeDefinitions.name,
  gradeDailyUsageLimit: userGradeDefinitions.dailyUsageLimit,
  gradeSource: userGrades.source,
  gradeDeterminedAt: userGrades.determinedAt,
  gradeExpiresAt: userGrades.expiresAt,
};

@Injectable()
export class UserDirectoryService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  private baseQuery() {
    return this.db
      .select(userSelection)
      .from(profiles)
      .leftJoin(userGrades, eq(userGrades.userId, profiles.id))
      .leftJoin(userGradeDefinitions, eq(userGradeDefinitions.id, userGrades.gradeId));
  }

  private countQuery(where: SQL | undefined) {
    return this.db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(profiles)
      .leftJoin(userGrades, eq(userGrades.userId, profiles.id))
      .leftJoin(userGradeDefinitions, eq(userGradeDefinitions.id, userGrades.gradeId))
      .where(where);
  }

  // =========================================================================
  // Public — member directory (no auth)
  // =========================================================================

  async listUsers(query: ListUsersQueryDto): Promise<{
    items: PublicUser[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit, q, grade, sort } = query;
    // Privacy: only active, non-deleted members who opted into a public handle
    // are enumerable. Members without a handle are never exposed publicly.
    const where = and(
      eq(profiles.isActive, true),
      isNull(profiles.deletedAt),
      isNotNull(profiles.handle),
      grade ? eq(userGradeDefinitions.slug, grade) : undefined,
      q ? or(ilike(profiles.name, `%${q}%`), ilike(profiles.handle, `%${q}%`)) : undefined,
    );

    const orderBy =
      sort === "name" ? [asc(profiles.name)] : [desc(profiles.createdAt), asc(profiles.id)];

    const [rows, countRows] = await Promise.all([
      this.baseQuery()
        .where(where)
        .orderBy(...orderBy)
        .limit(limit)
        .offset((page - 1) * limit),
      this.countQuery(where),
    ]);

    return {
      items: (rows as UserDirectoryRow[]).map(toPublicUser),
      total: countRows[0]?.count ?? 0,
      page,
      limit,
    };
  }

  /**
   * 공개 사용자 상세 (viewer-aware, BBR-527).
   *
   * 핸들 기준으로 단건 조회하되, 가시성 상태에 따라 오류 contract 가 갈린다:
   * - 핸들에 해당하는 프로필 없음 → 404 (없는 리소스).
   * - 요청자 본인(self)이면 비활성/탈퇴 여부와 무관하게 항상 200 (자기 자신은 항상 조회 가능).
   * - 탈퇴/삭제된 프로필(`deletedAt`) → 404 (존재 자체를 노출하지 않음).
   * - 비활성(`isActive=false`) 프로필 → 인증된 타인은 403 (권한 없는 리소스),
   *   비로그인 요청은 404 (익명 열거 방지).
   * - 그 외 활성 공개 회원 → 200.
   *
   * 200 응답에는 항상 공개 projection + viewer state 가 함께 실린다.
   */
  async getByHandle(
    handle: string,
    viewer: ViewerContext | null = null,
  ): Promise<PublicUserDetail> {
    const [row] = await this.baseQuery().where(eq(profiles.handle, handle)).limit(1);
    if (!row) {
      throw new NotFoundException("사용자를 찾을 수 없습니다.");
    }

    const directoryRow = row as UserDirectoryRow;
    const profile = directoryRow.profile;
    const isSelf = viewer != null && viewer.id === profile.id;

    if (!isSelf) {
      if (profile.deletedAt != null) {
        // 탈퇴/삭제: 누구에게도 존재를 노출하지 않는다.
        throw new NotFoundException("사용자를 찾을 수 없습니다.");
      }
      if (!profile.isActive) {
        // 존재하지만 공개되지 않은 리소스. 인증된 호출자에게만 권한 없음을
        // 명확히 알리고, 익명 호출자에게는 열거를 막기 위해 404 로 응답한다.
        if (viewer != null) {
          throw new ForbiddenException("비활성화된 사용자입니다.");
        }
        throw new NotFoundException("사용자를 찾을 수 없습니다.");
      }
    }

    return toPublicUserDetail(directoryRow, viewer);
  }

  // =========================================================================
  // Self — own record (authenticated)
  // =========================================================================

  async getSelf(userId: string): Promise<SelfUser> {
    const [row] = await this.baseQuery().where(eq(profiles.id, userId)).limit(1);
    if (!row) {
      throw new NotFoundException("사용자를 찾을 수 없습니다.");
    }
    return toSelfUser(row as UserDirectoryRow);
  }

  // =========================================================================
  // Admin — user management list / detail
  // =========================================================================

  async listAdminUsers(query: ListAdminUsersQueryDto): Promise<{
    items: AdminUser[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit, q, grade, authProvider, isActive, includeDeleted, sort } = query;
    const where = and(
      includeDeleted ? undefined : isNull(profiles.deletedAt),
      isActive === undefined ? undefined : eq(profiles.isActive, isActive),
      authProvider ? eq(profiles.authProvider, authProvider) : undefined,
      grade ? eq(userGradeDefinitions.slug, grade) : undefined,
      q
        ? or(
            ilike(profiles.name, `%${q}%`),
            ilike(profiles.email, `%${q}%`),
            ilike(profiles.handle, `%${q}%`),
          )
        : undefined,
    );

    const orderByMap = {
      name: [asc(profiles.name)],
      email: [asc(profiles.email)],
      recent: [desc(profiles.createdAt), asc(profiles.id)],
    } as const;
    const orderBy = orderByMap[sort];

    const [rows, countRows] = await Promise.all([
      this.baseQuery()
        .where(where)
        .orderBy(...orderBy)
        .limit(limit)
        .offset((page - 1) * limit),
      this.countQuery(where),
    ]);

    return {
      items: (rows as UserDirectoryRow[]).map(toAdminUser),
      total: countRows[0]?.count ?? 0,
      page,
      limit,
    };
  }

  async getAdminUser(id: string): Promise<AdminUser> {
    const [row] = await this.baseQuery().where(eq(profiles.id, id)).limit(1);
    if (!row) {
      throw new NotFoundException("사용자를 찾을 수 없습니다.");
    }
    return toAdminUser(row as UserDirectoryRow);
  }
}
