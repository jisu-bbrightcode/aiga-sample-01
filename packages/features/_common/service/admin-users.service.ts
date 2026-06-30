import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  accounts,
  type DrizzleDB,
  InjectDrizzle,
  members,
  paymentSubscriptions,
  profiles,
  roles,
  sessions,
  user,
  userRoles,
} from "@repo/drizzle";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  notInArray,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { AdminAuditAction, AdminAuditService } from "./admin-audit.service";
import type {
  SortOrder,
  UserAccessRoleFilter,
  UserSortField,
  UserStatusFilter,
} from "./user-list-query";

export interface AdminUsersListOptions {
  limit?: number;
  offset?: number;
  /** Free-text search across name/email (case-insensitive). */
  q?: string;
  /** 계정 상태 필터 (활성/정지). */
  status?: UserStatusFilter;
  /** 접근 역할 필터 (owner/admin/member, none = 멤버십 없음). */
  accessRole?: UserAccessRoleFilter;
  /** 정렬 기준 (기본: 가입일). */
  sort?: UserSortField;
  /** 정렬 방향 (기본: 내림차순). */
  order?: SortOrder;
}

/** Org access role that gates the admin shell (Better Auth membership). */
export type AdminAccessRole = "owner" | "admin" | "member";

export interface AdminUserListItem {
  id: string;
  name: string;
  email: string;
  image: string | null;
  roles: string[];
  /** Org membership role used for admin access, or null if not a member. */
  accessRole: AdminAccessRole | null;
  createdAt: string;
  /** Profile last-updated timestamp, used as the "recent activity" signal. */
  lastActiveAt: string | null;
  emailVerified: boolean;
  isActive: boolean;
}

export interface AdminUsersListResponse {
  users: AdminUserListItem[];
  total: number;
}

/** A linked login method (e.g. google / credential). Secret-free. */
export interface AdminUserAuthProvider {
  providerId: string;
  linkedAt: string;
}

/** Session activity rollup — never carries the session token. */
export interface AdminUserSessionSummary {
  activeCount: number;
  lastActiveAt: string | null;
  lastIpAddress: string | null;
  lastUserAgent: string | null;
}

/** Lightweight billing summary for the operations view. */
export interface AdminUserSubscriptionSummary {
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

/** Slim audit row for the user's change history. */
export interface AdminUserAuditEntry {
  id: string;
  action: string;
  actorUserId: string;
  reason: string | null;
  createdAt: string;
}

/**
 * Full operational detail for one user (admin detail screen).
 *
 * Deliberately excludes every credential: account access/refresh/id tokens,
 * password hashes, scopes and session tokens are never selected, so they
 * cannot reach this surface (AC: 세션 token / provider secret 미노출).
 */
export interface AdminUserDetail {
  id: string;
  name: string;
  email: string;
  image: string | null;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: string;
  lastActiveAt: string | null;
  accessRole: AdminAccessRole | null;
  roles: string[];
  authProviders: AdminUserAuthProvider[];
  sessions: AdminUserSessionSummary;
  subscription: AdminUserSubscriptionSummary | null;
  recentAudit: AdminUserAuditEntry[];
}

export interface ChangeUserStatusCommand {
  actorUserId: string;
  targetUserId: string;
  isActive: boolean;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
}

export interface ChangeUserStatusResult {
  targetUserId: string;
  previousActive: boolean;
  isActive: boolean;
}

/** Highest-privilege first — used to collapse multi-org memberships. */
const ACCESS_ROLE_PRIORITY: readonly AdminAccessRole[] = ["owner", "admin", "member"];

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly audit: AdminAuditService,
  ) {}

  async list(options: AdminUsersListOptions): Promise<AdminUsersListResponse> {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const offset = Math.max(options.offset ?? 0, 0);
    const where = this.buildListFilter(options);
    const orderBy = buildListOrder(options.sort, options.order);

    const [totalRow] = await this.db
      .select({ count: count() })
      .from(user)
      .leftJoin(profiles, eq(profiles.id, user.id))
      .where(where);

    const rows = await this.db
      .select({
        id: user.id,
        userName: user.name,
        userEmail: user.email,
        userImage: user.image,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        profileName: profiles.name,
        profileEmail: profiles.email,
        profileAvatar: profiles.avatar,
        profileUpdatedAt: profiles.updatedAt,
        isActive: profiles.isActive,
      })
      .from(user)
      .leftJoin(profiles, eq(profiles.id, user.id))
      .where(where)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset);

    const userIds = rows.map((row) => row.id);
    const rolesByUserId = await this.loadRbacRoles(userIds);
    const accessRoleByUserId = await this.loadAccessRoles(userIds);

    const users: AdminUserListItem[] = rows.map((row) => ({
      id: row.id,
      name: row.profileName ?? row.userName,
      email: row.profileEmail ?? row.userEmail,
      image: row.profileAvatar ?? row.userImage,
      roles: rolesByUserId.get(row.id) ?? ["user"],
      accessRole: accessRoleByUserId.get(row.id) ?? null,
      createdAt: row.createdAt.toISOString(),
      lastActiveAt: row.profileUpdatedAt ? row.profileUpdatedAt.toISOString() : null,
      emailVerified: row.emailVerified,
      isActive: row.isActive ?? true,
    }));

    return { users, total: totalRow?.count ?? 0 };
  }

  /**
   * Full operational detail for one user — auth providers, session/activity
   * rollup, billing summary, permission summary and recent admin history.
   *
   * Secret-free by construction: only non-sensitive columns are selected, so
   * account tokens/password and session tokens never reach the response.
   */
  async getDetail(userId: string): Promise<AdminUserDetail> {
    const [row] = await this.db
      .select({
        id: user.id,
        userName: user.name,
        userEmail: user.email,
        userImage: user.image,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        profileName: profiles.name,
        profileEmail: profiles.email,
        profileAvatar: profiles.avatar,
        profileUpdatedAt: profiles.updatedAt,
        isActive: profiles.isActive,
      })
      .from(user)
      .leftJoin(profiles, eq(profiles.id, user.id))
      .where(eq(user.id, userId))
      .limit(1);

    if (!row) {
      throw new NotFoundException("사용자를 찾을 수 없습니다.");
    }

    const rolesByUserId = await this.loadRbacRoles([userId]);
    const accessRoleByUserId = await this.loadAccessRoles([userId]);
    const authProviders = await this.loadAuthProviders(userId);
    const sessionSummary = await this.loadSessionSummary(userId);
    const subscription = await this.loadSubscriptionSummary(userId);
    const recentAudit = await this.loadRecentAudit(userId);

    return {
      id: row.id,
      name: row.profileName ?? row.userName,
      email: row.profileEmail ?? row.userEmail,
      image: row.profileAvatar ?? row.userImage,
      emailVerified: row.emailVerified,
      isActive: row.isActive ?? true,
      createdAt: row.createdAt.toISOString(),
      lastActiveAt: row.profileUpdatedAt ? row.profileUpdatedAt.toISOString() : null,
      accessRole: accessRoleByUserId.get(userId) ?? null,
      roles: rolesByUserId.get(userId) ?? ["user"],
      authProviders,
      sessions: sessionSummary,
      subscription,
      recentAudit,
    };
  }

  /**
   * Linked auth providers (login methods). Selects only the provider id and
   * link time — access/refresh/id tokens, password hashes and scopes are never
   * read, so a provider secret cannot leak here. Duplicates collapse to the
   * earliest link.
   */
  private async loadAuthProviders(userId: string): Promise<AdminUserAuthProvider[]> {
    const rows = await this.db
      .select({ providerId: accounts.providerId, createdAt: accounts.createdAt })
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .orderBy(asc(accounts.createdAt));

    const earliestByProvider = new Map<string, string>();
    for (const r of rows) {
      if (!earliestByProvider.has(r.providerId)) {
        earliestByProvider.set(r.providerId, r.createdAt.toISOString());
      }
    }
    return [...earliestByProvider].map(([providerId, linkedAt]) => ({ providerId, linkedAt }));
  }

  /**
   * Session activity rollup. The session token column is never selected (AC:
   * 세션 token 미노출) — only the active count, last-seen time and the latest
   * client fingerprint (ip/user-agent) used to spot anomalies.
   */
  private async loadSessionSummary(userId: string): Promise<AdminUserSessionSummary> {
    const rows = await this.db
      .select({
        expiresAt: sessions.expiresAt,
        updatedAt: sessions.updatedAt,
        createdAt: sessions.createdAt,
        ipAddress: sessions.ipAddress,
        userAgent: sessions.userAgent,
      })
      .from(sessions)
      .where(eq(sessions.userId, userId));

    const now = Date.now();
    let activeCount = 0;
    let latest: { at: Date; ip: string | null; ua: string | null } | null = null;

    for (const r of rows) {
      if (r.expiresAt.getTime() > now) activeCount += 1;
      const seenAt = r.updatedAt ?? r.createdAt;
      if (!latest || seenAt.getTime() > latest.at.getTime()) {
        latest = { at: seenAt, ip: r.ipAddress, ua: r.userAgent };
      }
    }

    return {
      activeCount,
      lastActiveAt: latest ? latest.at.toISOString() : null,
      lastIpAddress: latest?.ip ?? null,
      lastUserAgent: latest?.ua ?? null,
    };
  }

  /** Most recent subscription as a lightweight billing summary, if any. */
  private async loadSubscriptionSummary(
    userId: string,
  ): Promise<AdminUserSubscriptionSummary | null> {
    const [row] = await this.db
      .select({
        status: paymentSubscriptions.status,
        currentPeriodEnd: paymentSubscriptions.currentPeriodEnd,
        cancelAtPeriodEnd: paymentSubscriptions.cancelAtPeriodEnd,
      })
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.userId, userId))
      .orderBy(desc(paymentSubscriptions.currentPeriodEnd))
      .limit(1);

    if (!row) return null;
    return {
      status: row.status,
      currentPeriodEnd: row.currentPeriodEnd ? row.currentPeriodEnd.toISOString() : null,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    };
  }

  /** Recent admin actions targeting this user (change history). */
  private async loadRecentAudit(userId: string): Promise<AdminUserAuditEntry[]> {
    const { rows } = await this.audit.list({
      targetType: "user",
      targetId: userId,
      limit: 20,
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      actorUserId: r.actorUserId,
      reason: r.reason,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Compose the list WHERE clause from search + status + access-role filters.
   * Lives on the service (not a pure helper) because the access-role filter
   * issues a membership subquery against {@link members}.
   */
  private buildListFilter(options: AdminUsersListOptions): SQL | undefined {
    const conditions: SQL[] = [];

    const search = buildSearchFilter(options.q);
    if (search) conditions.push(search);

    if (options.status === "active") {
      // profiles.isActive is null for users without a profile row; the mapper
      // treats those as active, so include them in the "active" filter.
      const activeFilter = or(eq(profiles.isActive, true), isNull(profiles.isActive));
      if (activeFilter) conditions.push(activeFilter);
    } else if (options.status === "inactive") {
      conditions.push(eq(profiles.isActive, false));
    }

    if (options.accessRole === "none") {
      conditions.push(
        notInArray(user.id, this.db.select({ userId: members.userId }).from(members)),
      );
    } else if (options.accessRole) {
      conditions.push(
        inArray(
          user.id,
          this.db
            .select({ userId: members.userId })
            .from(members)
            .where(eq(members.role, options.accessRole)),
        ),
      );
    }

    if (conditions.length === 0) return undefined;
    if (conditions.length === 1) return conditions[0];
    return and(...conditions);
  }

  /**
   * Activate / deactivate a user account (profiles.isActive).
   *
   * Privileged surface — fail closed (mirrors AdminRoleService):
   *  - An actor may not change their own account status.
   *  - An `owner` account may not be deactivated through this endpoint.
   *  - Every change is recorded in `admin_audit_log`.
   */
  async setActive(command: ChangeUserStatusCommand): Promise<ChangeUserStatusResult> {
    if (command.actorUserId === command.targetUserId) {
      throw new ForbiddenException("본인의 계정 상태는 변경할 수 없습니다.");
    }

    const [target] = await this.db
      .select({ id: profiles.id, isActive: profiles.isActive })
      .from(profiles)
      .where(eq(profiles.id, command.targetUserId))
      .limit(1);

    if (!target) {
      throw new NotFoundException("사용자를 찾을 수 없습니다.");
    }

    if (!command.isActive) {
      const [ownerMembership] = await this.db
        .select({ id: members.id })
        .from(members)
        .where(and(eq(members.userId, command.targetUserId), eq(members.role, "owner")))
        .limit(1);
      if (ownerMembership) {
        throw new ForbiddenException("소유자(owner) 계정은 정지할 수 없습니다.");
      }
    }

    const previousActive = target.isActive ?? true;

    if (previousActive !== command.isActive) {
      await this.db
        .update(profiles)
        .set({ isActive: command.isActive })
        .where(eq(profiles.id, command.targetUserId));
    }

    await this.audit.log({
      actorUserId: command.actorUserId,
      action: AdminAuditAction.user_status_changed,
      targetType: "user",
      targetId: command.targetUserId,
      payloadBefore: { isActive: previousActive },
      payloadAfter: { isActive: command.isActive },
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
      reason: command.reason,
    });

    return {
      targetUserId: command.targetUserId,
      previousActive,
      isActive: command.isActive,
    };
  }

  /** RBAC role slugs (user_roles) keyed by user id. */
  private async loadRbacRoles(userIds: string[]): Promise<Map<string, string[]>> {
    const rolesByUserId = new Map<string, string[]>();
    if (userIds.length === 0) return rolesByUserId;

    const roleRows = await this.db
      .select({ userId: userRoles.userId, roleSlug: roles.slug })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(inArray(userRoles.userId, userIds));

    for (const row of roleRows) {
      if (!row.roleSlug) continue;
      const list = rolesByUserId.get(row.userId) ?? [];
      if (!list.includes(row.roleSlug)) list.push(row.roleSlug);
      rolesByUserId.set(row.userId, list);
    }
    return rolesByUserId;
  }

  /** Highest-privilege org membership role keyed by user id. */
  private async loadAccessRoles(userIds: string[]): Promise<Map<string, AdminAccessRole>> {
    const accessRoleByUserId = new Map<string, AdminAccessRole>();
    if (userIds.length === 0) return accessRoleByUserId;

    const memberRows = await this.db
      .select({ userId: members.userId, role: members.role })
      .from(members)
      .where(inArray(members.userId, userIds));

    for (const row of memberRows) {
      const role = normalizeAccessRole(row.role);
      if (!role) continue;
      const current = accessRoleByUserId.get(row.userId);
      if (!current || rank(role) < rank(current)) {
        accessRoleByUserId.set(row.userId, role);
      }
    }
    return accessRoleByUserId;
  }
}

function buildSearchFilter(q: string | undefined): SQL | undefined {
  const term = q?.trim();
  if (!term) return undefined;
  const pattern = `%${term}%`;
  return or(
    ilike(user.name, pattern),
    ilike(user.email, pattern),
    ilike(profiles.name, pattern),
    ilike(profiles.email, pattern),
  );
}

/**
 * Build the ORDER BY for the list, always with a stable `user.id` tiebreaker
 * so pagination is deterministic. Name sorting coalesces the profile name over
 * the Better Auth name to match the value shown in the UI.
 */
function buildListOrder(sort: UserSortField | undefined, order: SortOrder | undefined): SQL[] {
  const direction = order === "asc" ? asc : desc;
  let target: Parameters<typeof asc>[0];
  switch (sort) {
    case "name":
      target = sql`coalesce(${profiles.name}, ${user.name})`;
      break;
    case "status":
      target = profiles.isActive;
      break;
    case "lastActiveAt":
      target = profiles.updatedAt;
      break;
    default:
      target = user.createdAt;
  }
  return [direction(target), desc(user.id)];
}

function normalizeAccessRole(role: string | null | undefined): AdminAccessRole | null {
  return ACCESS_ROLE_PRIORITY.find((candidate) => candidate === role) ?? null;
}

function rank(role: AdminAccessRole): number {
  return ACCESS_ROLE_PRIORITY.indexOf(role);
}
