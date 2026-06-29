/**
 * AdminRoleService — manage an admin operator's privileged access role.
 *
 * Access to the admin shell is gated by Better Auth organization membership
 * (`members.role` of `owner` / `admin`). This service lets an existing admin
 * promote a fellow member to `admin` or demote them back to `member`, and
 * records every change in the general `admin_audit_log` (AC: "관리자 변경
 * 작업이 감사 로그에 남는다").
 *
 * Safety rules (privileged surface — fail closed):
 *  - Only transitions between `admin` and `member` are allowed.
 *  - `owner` is never modified through this endpoint.
 *  - An actor may not change their own role (no self-lockout / self-promote).
 *  - The target must already be a member of the actor's organization; this
 *    endpoint re-roles existing members, it does not create memberships.
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { type DrizzleDB, InjectDrizzle, members } from "@repo/drizzle";
import { and, eq } from "drizzle-orm";
import { AdminAuditAction, AdminAuditService } from "./admin-audit.service";

export type AssignableAdminRole = "admin" | "member";

export interface ChangeRoleCommand {
  actorUserId: string;
  targetUserId: string;
  role: AssignableAdminRole;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
}

export interface ChangeRoleResult {
  targetUserId: string;
  organizationId: string;
  previousRole: string;
  role: AssignableAdminRole;
}

const ASSIGNABLE_ROLES: readonly AssignableAdminRole[] = ["admin", "member"];

@Injectable()
export class AdminRoleService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly audit: AdminAuditService,
  ) {}

  async changeRole(command: ChangeRoleCommand): Promise<ChangeRoleResult> {
    if (!ASSIGNABLE_ROLES.includes(command.role)) {
      throw new BadRequestException("허용되지 않은 역할입니다.");
    }
    if (command.actorUserId === command.targetUserId) {
      throw new ForbiddenException("본인의 역할은 변경할 수 없습니다.");
    }

    // Resolve the actor's organization (the org where the actor holds an
    // owner/admin membership). Access is already gated by BetterAuthAdminGuard,
    // so the actor is guaranteed to have such a membership.
    const [actorMembership] = await this.db
      .select({ organizationId: members.organizationId, role: members.role })
      .from(members)
      .where(eq(members.userId, command.actorUserId))
      .limit(1);

    if (!actorMembership) {
      throw new ForbiddenException("관리자 조직 멤버십을 찾을 수 없습니다.");
    }

    const organizationId = actorMembership.organizationId;

    const [targetMembership] = await this.db
      .select({ id: members.id, role: members.role })
      .from(members)
      .where(
        and(eq(members.userId, command.targetUserId), eq(members.organizationId, organizationId)),
      )
      .limit(1);

    if (!targetMembership) {
      throw new NotFoundException("대상 사용자가 조직 멤버가 아닙니다.");
    }

    if (targetMembership.role === "owner") {
      throw new ForbiddenException("소유자(owner)의 역할은 변경할 수 없습니다.");
    }

    const previousRole = targetMembership.role;

    if (previousRole !== command.role) {
      await this.db
        .update(members)
        .set({ role: command.role })
        .where(eq(members.id, targetMembership.id));
    }

    await this.audit.log({
      actorUserId: command.actorUserId,
      action: AdminAuditAction.user_role_changed,
      targetType: "user",
      targetId: command.targetUserId,
      payloadBefore: { role: previousRole },
      payloadAfter: { role: command.role },
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
      reason: command.reason,
    });

    return {
      targetUserId: command.targetUserId,
      organizationId,
      previousRole,
      role: command.role,
    };
  }
}
