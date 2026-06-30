import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { DrizzleDB, Profile } from "@repo/drizzle";
// Import tables from the top-level barrel (NOT `@repo/drizzle/schema`): jest
// maps only `^@repo/drizzle$` to the workspace source, so the subpath would
// resolve to a stale checkout in an isolated worktree.
import { InjectDrizzle, profiles, userGradeDefinitions, userGrades } from "@repo/drizzle";
import { and, asc, desc, eq, ilike, isNotNull, isNull, or, type SQL, sql } from "drizzle-orm";
import { AdminAuditService } from "../../_common/service/admin-audit.service";
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

/**
 * Admin audit actions for the soft-delete lifecycle. Recorded in
 * `admin_audit_log` so an archive/restore is always attributable to an
 * operator even though the user row itself is only flagged, never removed.
 */
const ARCHIVE_AUDIT_ACTION = "user.archived";
const RESTORE_AUDIT_ACTION = "user.restored";

/**
 * Admin audit action for the in-place edit path (BBR-529). 필드 수정은
 * archive/restore 와 동일하게 `admin_audit_log` 에 한 행씩 남겨 "변경 이력" 으로
 * 조회할 수 있게 한다. (활성/비활성 상태 변경은 `_common` AdminUsersService 의
 * `PATCH /admin/users/:id/status` 가 담당 — BBR-684 — 하므로 중복 구현하지 않는다.)
 */
const UPDATE_AUDIT_ACTION = "user.updated";

/** Postgres unique-violation SQLSTATE — handle 충돌을 친화적인 409 로 매핑. */
const PG_UNIQUE_VIOLATION = "23505";

/** Operator context for an archive/restore mutation. */
export interface ArchiveUserInput {
  /** profiles.id of the target user. */
  id: string;
  /** Authenticated admin performing the action (audit actor). */
  actorUserId: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * 관리자 부분 수정 입력 (BBR-529). 허용 필드(name/handle/bio/avatar)만 받는다.
 * `undefined` 인 필드는 변경하지 않으며(부분 업데이트), nullable 필드는 `null` 로
 * 비울 수 있다. email/인증수단/등급/활성여부/삭제부기는 이 경로로 수정할 수 없다.
 */
export interface UpdateAdminUserInput {
  id: string;
  actorUserId: string;
  name?: string;
  handle?: string | null;
  bio?: string | null;
  avatar?: string | null;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}

/** 변경 이력 조회 옵션 (admin_audit_log cursor 페이지네이션). */
export interface UserHistoryQuery {
  cursor?: string;
  limit?: number;
}

/** 감사 payload 에 담을 수정 가능 필드 스냅샷(diff 가능하도록 동일 키 집합). */
function editableSnapshot(p: Profile): Pick<Profile, "name" | "handle" | "bio" | "avatar"> {
  return { name: p.name, handle: p.handle, bio: p.bio, avatar: p.avatar };
}

@Injectable()
export class UserDirectoryService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly audit: AdminAuditService,
  ) {}

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

  // =========================================================================
  // Admin — soft delete (archive) / restore
  // =========================================================================

  /**
   * 사용자 삭제 = soft delete(archive). 레코드를 물리적으로 지우지 않고
   * `deletedAt`을 찍고 `isActive=false`로 내려 공개/앱 노출에서 차단한다.
   *
   * - 노출 차단: 공개 목록/상세(getByHandle)는 `deletedAt`을 404로 가리고,
   *   관리자 목록은 기본적으로 `deletedAt IS NULL`만 보이며 `includeDeleted=true`
   *   로만 보관된 사용자를 조회할 수 있다.
   * - 연결 데이터 보존: profiles 행과 결제/이력/감사 등 연결 데이터는 그대로
   *   남는다(파괴적 삭제·FK cascade 없음) → 복구 가능.
   * - 멱등: 이미 archive된 사용자는 추가 쓰기/감사 없이 현재 상태를 돌려준다.
   *
   * 없는 사용자 → 404. 성공 시 갱신된 관리자 뷰를 반환하고 감사 로그를 남긴다.
   */
  async archiveUser(input: ArchiveUserInput): Promise<AdminUser> {
    const [row] = await this.baseQuery().where(eq(profiles.id, input.id)).limit(1);
    if (!row) {
      throw new NotFoundException("사용자를 찾을 수 없습니다.");
    }
    const directoryRow = row as UserDirectoryRow;
    const before = directoryRow.profile;

    if (before.deletedAt != null) {
      return toAdminUser(directoryRow);
    }

    const archivedAt = new Date();
    await this.db
      .update(profiles)
      .set({ deletedAt: archivedAt, isActive: false, updatedAt: archivedAt })
      .where(eq(profiles.id, input.id));

    const afterRow: UserDirectoryRow = {
      ...directoryRow,
      profile: { ...before, deletedAt: archivedAt, isActive: false, updatedAt: archivedAt },
    };

    await this.audit.log({
      actorUserId: input.actorUserId,
      action: ARCHIVE_AUDIT_ACTION,
      targetType: "user",
      targetId: input.id,
      payloadBefore: { isActive: before.isActive, deletedAt: before.deletedAt },
      payloadAfter: { isActive: false, deletedAt: archivedAt },
      reason: input.reason,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return toAdminUser(afterRow);
  }

  /**
   * archive된 사용자를 복구한다(`deletedAt=null`, `isActive=true`) → 공개/앱
   * 노출 재개. archive되지 않은 사용자는 멱등 no-op으로 현재 상태를 반환한다.
   * 없는 사용자 → 404. 성공 시 감사 로그를 남긴다.
   */
  async restoreUser(input: ArchiveUserInput): Promise<AdminUser> {
    const [row] = await this.baseQuery().where(eq(profiles.id, input.id)).limit(1);
    if (!row) {
      throw new NotFoundException("사용자를 찾을 수 없습니다.");
    }
    const directoryRow = row as UserDirectoryRow;
    const before = directoryRow.profile;

    if (before.deletedAt == null) {
      return toAdminUser(directoryRow);
    }

    const restoredAt = new Date();
    await this.db
      .update(profiles)
      .set({ deletedAt: null, isActive: true, updatedAt: restoredAt })
      .where(eq(profiles.id, input.id));

    const afterRow: UserDirectoryRow = {
      ...directoryRow,
      profile: { ...before, deletedAt: null, isActive: true, updatedAt: restoredAt },
    };

    await this.audit.log({
      actorUserId: input.actorUserId,
      action: RESTORE_AUDIT_ACTION,
      targetType: "user",
      targetId: input.id,
      payloadBefore: { isActive: before.isActive, deletedAt: before.deletedAt },
      payloadAfter: { isActive: true, deletedAt: null },
      reason: input.reason,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return toAdminUser(afterRow);
  }

  // =========================================================================
  // Admin — 부분 수정 (field update) / 활성 상태 변경 / 변경 이력
  // =========================================================================

  /**
   * 관리자 부분 수정(PATCH). 허용 필드(name/handle/bio/avatar)만 교체하고,
   * 변경된 값은 `admin_audit_log` 에 before/after 스냅샷으로 남긴다.
   *
   * - 빈 패치(수정할 필드 없음) → 400.
   * - 없는 사용자 → 404.
   * - handle 유니크 충돌 → 409 (다른 사용자가 이미 사용 중).
   *
   * 활성여부/삭제(보관)·등급·이메일·인증수단은 이 경로로 바꿀 수 없다(허용 필드 외).
   * 활성/비활성 상태 변경은 `_common` 의 `PATCH /admin/users/:id/status`(BBR-684),
   * 삭제/복구는 archive/restore 가 담당한다.
   */
  async updateAdminUser(input: UpdateAdminUserInput): Promise<AdminUser> {
    const patch: Partial<Pick<Profile, "name" | "handle" | "bio" | "avatar">> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.handle !== undefined) patch.handle = input.handle;
    if (input.bio !== undefined) patch.bio = input.bio;
    if (input.avatar !== undefined) patch.avatar = input.avatar;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException("변경할 내용이 없습니다.");
    }

    const [row] = await this.baseQuery().where(eq(profiles.id, input.id)).limit(1);
    if (!row) {
      throw new NotFoundException("사용자를 찾을 수 없습니다.");
    }
    const directoryRow = row as UserDirectoryRow;
    const before = directoryRow.profile;

    const updatedAt = new Date();
    try {
      await this.db
        .update(profiles)
        .set({ ...patch, updatedAt })
        .where(eq(profiles.id, input.id));
    } catch (error) {
      throw this.mapHandleConflict(error);
    }

    const afterProfile: Profile = { ...before, ...patch, updatedAt };
    const afterRow: UserDirectoryRow = { ...directoryRow, profile: afterProfile };

    await this.audit.log({
      actorUserId: input.actorUserId,
      action: UPDATE_AUDIT_ACTION,
      targetType: "user",
      targetId: input.id,
      payloadBefore: editableSnapshot(before),
      payloadAfter: editableSnapshot(afterProfile),
      reason: input.reason,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return toAdminUser(afterRow);
  }

  /**
   * 사용자 변경 이력 조회. 공용 `admin_audit_log` 에서 이 사용자를 대상으로 한
   * 모든 운영 변경(수정/상태변경/보관/복구)을 최신순으로 돌려준다. 별도 이력
   * 테이블 없이 감사 로그를 단일 출처로 재사용한다.
   */
  getUserHistory(id: string, query: UserHistoryQuery = {}) {
    return this.audit.list({
      targetType: "user",
      targetId: id,
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  /** handle 유니크 위반(23505)을 사용자 친화 409 로 매핑. 그 외는 원본 오류 전파. */
  private mapHandleConflict(error: unknown): Error {
    if (
      error != null &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === PG_UNIQUE_VIOLATION
    ) {
      return new ConflictException("이미 사용 중인 핸들입니다.");
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}
