import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  type DrizzleDB,
  InjectDrizzle,
  members,
  profiles,
  roles,
  user,
  userRoles,
} from "@repo/drizzle";
import { and, count, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import { AdminAuditAction, AdminAuditService } from "./admin-audit.service";

export interface AdminUsersListOptions {
  limit?: number;
  offset?: number;
  /** Free-text search across name/email (case-insensitive). */
  q?: string;
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
  emailVerified: boolean;
  isActive: boolean;
}

export interface AdminUsersListResponse {
  users: AdminUserListItem[];
  total: number;
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
    const where = buildSearchFilter(options.q);

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
        isActive: profiles.isActive,
      })
      .from(user)
      .leftJoin(profiles, eq(profiles.id, user.id))
      .where(where)
      .orderBy(desc(user.createdAt))
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
      emailVerified: row.emailVerified,
      isActive: row.isActive ?? true,
    }));

    return { users, total: totalRow?.count ?? 0 };
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

function normalizeAccessRole(role: string | null | undefined): AdminAccessRole | null {
  return ACCESS_ROLE_PRIORITY.find((candidate) => candidate === role) ?? null;
}

function rank(role: AdminAccessRole): number {
  return ACCESS_ROLE_PRIORITY.indexOf(role);
}
