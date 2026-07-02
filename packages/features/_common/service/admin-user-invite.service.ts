/**
 * AdminUserInviteService — invite an operator into the admin organization
 * (PB-ADMIN-USERS-CREATE-001 / BBR-687).
 *
 * Identity creation itself stays with Better Auth (social / email sign-up) — we
 * never mint an auth user from a bespoke REST endpoint. What this service owns
 * is the admin-side *invitation*: it writes a pending row into Better Auth's
 * canonical `invitations` table (the same table its organization plugin
 * consumes on accept), sends the invitation email through the shared core
 * sender seam, and records the action in `admin_audit_log`.
 *
 * Acceptance criteria (BBR-687):
 *  - 중복 이메일과 잘못된 role은 validation으로 차단된다 → invalid role = 400,
 *    an email that already has an account or a live pending invite = 409.
 *  - 초대/생성 작업은 감사 로그에 남는다 → every invite/resend appends an audit row.
 */

import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  type AuthOrganizationInvitationInput,
  sendAuthOrganizationInvitationEmail,
} from "@repo/core/auth/organization-invitation-sender";
import {
  type DrizzleDB,
  InjectDrizzle,
  invitations,
  members,
  organizations,
  user,
} from "@repo/drizzle";
import { and, desc, eq, gt, ilike } from "drizzle-orm";
import {
  type InvitableRole,
  inviteExpiresAt,
  isInvitableRole,
  normalizeInviteEmail,
} from "../helpers/invite-policy";
import { AdminAuditAction, AdminAuditService } from "./admin-audit.service";

const INVITATION_TARGET_TYPE = "user_invitation";
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

export interface InviteUserCommand {
  actorUserId: string;
  /** Raw email from the request — normalized + validated here. */
  email: string;
  /** Raw role from the request — validated against the invite allow-list. */
  role: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  /** Injectable clock so expiry is deterministic in tests. */
  now?: Date;
}

export interface ResendInvitationCommand {
  actorUserId: string;
  invitationId: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  now?: Date;
}

export interface ListInvitationsCommand {
  actorUserId: string;
  /** Filter by lifecycle status (e.g. `pending`); omitted = all. */
  status?: string;
  limit?: number;
}

export interface InvitationView {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string | null;
}

@Injectable()
export class AdminUserInviteService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly audit: AdminAuditService,
  ) {}

  /**
   * Invite an operator. Fails closed: invalid role → 400, malformed email →
   * 400, an email that already maps to an account or a live pending invite →
   * 409. On success a pending invitation row + an audit row are written and the
   * invite email is dispatched best-effort.
   */
  async invite(command: InviteUserCommand): Promise<InvitationView> {
    if (!isInvitableRole(command.role)) {
      throw new BadRequestException("허용되지 않은 역할입니다.");
    }
    const email = normalizeInviteEmail(command.email);
    if (!email) {
      throw new BadRequestException("올바른 이메일 주소가 아닙니다.");
    }
    const role: InvitableRole = command.role;
    const now = command.now ?? new Date();

    const organizationId = await this.resolveActorOrganization(command.actorUserId);
    await this.assertEmailInvitable(organizationId, email, now);

    const id = randomUUID();
    const expiresAt = inviteExpiresAt(now);

    await this.db.insert(invitations).values({
      id,
      organizationId,
      email,
      role,
      status: "pending",
      expiresAt,
      inviterId: command.actorUserId,
    });

    await this.audit.log({
      actorUserId: command.actorUserId,
      action: AdminAuditAction.user_invited,
      targetType: INVITATION_TARGET_TYPE,
      targetId: id,
      payloadAfter: { email, role, organizationId, status: "pending" },
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
      reason: command.reason,
    });

    await this.dispatchInvitationEmail({
      invitationId: id,
      organizationId,
      email,
      role,
      inviterUserId: command.actorUserId,
    });

    return {
      id,
      email,
      role,
      status: "pending",
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
    };
  }

  /**
   * Re-send a still-pending invitation (재초대 정책). Extends the expiry window
   * and re-dispatches the email; non-pending or unknown invitations are
   * rejected so a consumed/expired invite is not silently revived.
   */
  async resend(command: ResendInvitationCommand): Promise<InvitationView> {
    const now = command.now ?? new Date();
    const organizationId = await this.resolveActorOrganization(command.actorUserId);

    const [invitation] = await this.db
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        status: invitations.status,
      })
      .from(invitations)
      .where(
        and(
          eq(invitations.id, command.invitationId),
          eq(invitations.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!invitation) {
      throw new NotFoundException("초대를 찾을 수 없습니다.");
    }
    if (invitation.status !== "pending") {
      throw new ConflictException("대기 중인 초대만 다시 보낼 수 있습니다.");
    }

    const expiresAt = inviteExpiresAt(now);
    await this.db.update(invitations).set({ expiresAt }).where(eq(invitations.id, invitation.id));

    await this.audit.log({
      actorUserId: command.actorUserId,
      action: AdminAuditAction.user_invitation_resent,
      targetType: INVITATION_TARGET_TYPE,
      targetId: invitation.id,
      payloadAfter: { email: invitation.email, role: invitation.role, organizationId },
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
      reason: command.reason,
    });

    await this.dispatchInvitationEmail({
      invitationId: invitation.id,
      organizationId,
      email: invitation.email,
      role: invitation.role ?? "member",
      inviterUserId: command.actorUserId,
    });

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role ?? "member",
      status: invitation.status,
      expiresAt: expiresAt.toISOString(),
      createdAt: null,
    };
  }

  /** List invitations for the actor's organization (admin invite console). */
  async listInvitations(command: ListInvitationsCommand): Promise<InvitationView[]> {
    const organizationId = await this.resolveActorOrganization(command.actorUserId);
    const limit = Math.min(Math.max(command.limit ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);

    const filter = command.status
      ? and(eq(invitations.organizationId, organizationId), eq(invitations.status, command.status))
      : eq(invitations.organizationId, organizationId);

    const rows = await this.db
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        status: invitations.status,
        expiresAt: invitations.expiresAt,
        createdAt: invitations.createdAt,
      })
      .from(invitations)
      .where(filter)
      .orderBy(desc(invitations.createdAt))
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role ?? "member",
      status: row.status,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    }));
  }

  /**
   * Resolve the organization where the actor holds membership. Admin access is
   * already gated upstream by BetterAuthAdminGuard, so a missing membership is a
   * configuration error rather than an authz path.
   */
  private async resolveActorOrganization(actorUserId: string): Promise<string> {
    const [membership] = await this.db
      .select({ organizationId: members.organizationId })
      .from(members)
      .where(eq(members.userId, actorUserId))
      .limit(1);

    if (!membership) {
      throw new ForbiddenException("관리자 조직 멤버십을 찾을 수 없습니다.");
    }
    return membership.organizationId;
  }

  /**
   * Block duplicates (AC: 중복 이메일 차단): an email that already has an account,
   * or one with a live (non-expired) pending invitation in this organization.
   */
  private async assertEmailInvitable(
    organizationId: string,
    email: string,
    now: Date,
  ): Promise<void> {
    const [existingUser] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(ilike(user.email, email))
      .limit(1);
    if (existingUser) {
      throw new ConflictException("이미 가입된 이메일입니다.");
    }

    const [pending] = await this.db
      .select({ id: invitations.id })
      .from(invitations)
      .where(
        and(
          eq(invitations.organizationId, organizationId),
          ilike(invitations.email, email),
          eq(invitations.status, "pending"),
          gt(invitations.expiresAt, now),
        ),
      )
      .limit(1);
    if (pending) {
      throw new ConflictException("이미 초대된 이메일입니다.");
    }
  }

  /**
   * Send the invitation email through the shared core sender (the same seam
   * Better Auth's organization plugin uses). Best-effort: a delivery failure or
   * a missing org/inviter row must not roll back an already-audited invite, so
   * we log and move on.
   */
  private async dispatchInvitationEmail(input: {
    invitationId: string;
    organizationId: string;
    email: string;
    role: string;
    inviterUserId: string;
  }): Promise<void> {
    try {
      const [org] = await this.db
        .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
        .from(organizations)
        .where(eq(organizations.id, input.organizationId))
        .limit(1);
      const [inviter] = await this.db
        .select({ email: user.email, name: user.name })
        .from(user)
        .where(eq(user.id, input.inviterUserId))
        .limit(1);

      if (!org || !inviter) return;

      const payload: AuthOrganizationInvitationInput = {
        id: input.invitationId,
        email: input.email,
        role: input.role,
        organization: { id: org.id, name: org.name, slug: org.slug },
        inviter: { user: { id: input.inviterUserId, email: inviter.email, name: inviter.name } },
        invitation: { id: input.invitationId },
      };
      await sendAuthOrganizationInvitationEmail(payload);
    } catch (error) {
      console.error(
        `[AdminUserInviteService] invitation email failed: ${input.invitationId}`,
        error,
      );
    }
  }
}
