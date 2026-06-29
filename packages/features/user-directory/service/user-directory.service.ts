import { Injectable, NotFoundException } from "@nestjs/common";
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
  type SelfUser,
  toAdminUser,
  toPublicUser,
  toSelfUser,
  type UserDirectoryRow,
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

  async getByHandle(handle: string): Promise<PublicUser> {
    const [row] = await this.baseQuery()
      .where(
        and(eq(profiles.handle, handle), eq(profiles.isActive, true), isNull(profiles.deletedAt)),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException("사용자를 찾을 수 없습니다.");
    }
    return toPublicUser(row as UserDirectoryRow);
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
