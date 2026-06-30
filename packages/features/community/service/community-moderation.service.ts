import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import {
  type CommunityBan,
  type CommunityFlair,
  type CommunityModerator,
  type CommunityReport,
  type CommunityRule,
  communities,
  communityBans,
  communityComments,
  communityFlairs,
  communityMemberships,
  communityModerators,
  communityModLogs,
  communityPosts,
  communityReports,
  communityRules,
} from "@repo/drizzle/schema";
import { and, count, desc, eq, sql } from "drizzle-orm";
import type {
  BanUserDto,
  CreateFlairDto,
  CreateReportDto,
  CreateRuleDto,
  InviteModeratorDto,
  ResolveReportDto,
  TransferOwnershipDto,
  UpdateModeratorPermissionsDto,
} from "../dto";
import {
  type CommunityRole,
  canManageModerators,
  canRespondToInvite,
  canRevokeAppointment,
  canTransferOwnership,
  canUpdatePermissions,
  type ModeratorActor,
  type ModeratorStatus,
  nextStatusForResponse,
  normalizeModeratorPermissions,
  sanitizeGrantablePermissions,
} from "../helpers/moderator-policy";
import { assertCommunityPermission } from "../helpers/permission";
import { CommunityService } from "./community.service";

@Injectable()
export class CommunityModerationService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly communityService: CommunityService,
  ) {}

  async createReport(dto: CreateReportDto, userId: string): Promise<CommunityReport> {
    const severity = dto.severity ?? this.inferSeverity(dto.reason);

    const [report] = await this.db
      .insert(communityReports)
      .values({
        ...dto,
        reporterId: userId,
        severity,
      })
      .returning();

    await this.logModAction({
      communityId: dto.communityId,
      moderatorId: userId,
      action: "other",
      targetType: dto.targetType,
      targetId: dto.targetId,
      reason: `Report created (severity: ${severity})`,
    });

    // Auto-hide: 동일 target에 10건+ 신고 시 자동 숨김
    await this.checkAutoHide(dto.communityId, dto.targetType, dto.targetId);

    return report as CommunityReport;
  }

  /**
   * 동일 콘텐츠에 대한 신고 수를 확인하고, threshold(10건) 초과 시 자동 숨김 처리.
   * 모더레이터에게 대량 신고 로그를 남긴다.
   */
  private async checkAutoHide(
    communityId: string,
    targetType: string,
    targetId: string,
  ): Promise<void> {
    const AUTO_HIDE_THRESHOLD = 10;

    const [result] = await this.db
      .select({ reportCount: count() })
      .from(communityReports)
      .where(
        and(
          eq(communityReports.targetType, targetType as any),
          eq(communityReports.targetId, targetId),
        ),
      );

    const reportCount = result?.reportCount ?? 0;
    if (reportCount < AUTO_HIDE_THRESHOLD) return;

    // 이미 숨김 처리되었는지 확인 (중복 방지)
    if (targetType === "post") {
      const [post] = await this.db
        .select({ status: communityPosts.status })
        .from(communityPosts)
        .where(eq(communityPosts.id, targetId))
        .limit(1);

      if (post && post.status === "published") {
        await this.db
          .update(communityPosts)
          .set({
            status: "hidden",
            removalReason: `자동 숨김: ${reportCount}건 신고 누적`,
            updatedAt: new Date(),
          })
          .where(eq(communityPosts.id, targetId));
      }
    } else if (targetType === "comment") {
      const [comment] = await this.db
        .select({ isHidden: communityComments.isHidden })
        .from(communityComments)
        .where(eq(communityComments.id, targetId))
        .limit(1);

      if (comment && !comment.isHidden) {
        await this.db
          .update(communityComments)
          .set({ isHidden: true, updatedAt: new Date() })
          .where(eq(communityComments.id, targetId));
      }
    }

    // 대량 신고 감지 로그 (모더레이터 알림 역할)
    await this.logModAction({
      communityId,
      moderatorId: "system",
      action: "other",
      targetType: targetType as any,
      targetId,
      reason: `대량 신고 감지: ${reportCount}건 누적 → 자동 숨김 처리`,
    });
  }

  private inferSeverity(reason: string): "low" | "medium" | "high" | "critical" {
    const severityMap: Record<string, "low" | "medium" | "high" | "critical"> = {
      spam: "low",
      other: "low",
      misinformation: "medium",
      nsfw: "medium",
      copyright: "medium",
      harassment: "high",
      hate_speech: "high",
      violence: "critical",
    };
    return severityMap[reason] ?? "medium";
  }

  async resolveReport(dto: ResolveReportDto, userId: string): Promise<CommunityReport> {
    const report = await this.findReportById(dto.reportId);
    if (!report) {
      throw new NotFoundException("신고를 찾을 수 없습니다.");
    }

    await assertCommunityPermission(this.communityService, userId, report.communityId, [
      "owner",
      "admin",
      "moderator",
    ]);

    const [updated] = await this.db
      .update(communityReports)
      .set({
        status: "resolved",
        actionTaken: dto.action,
        resolution: dto.reason,
        resolvedBy: userId,
        resolvedAt: new Date(),
        // SLA: 최초 응답 시각 기록 (아직 없으면)
        ...(report.firstResponseAt ? {} : { firstResponseAt: new Date() }),
      })
      .where(eq(communityReports.id, dto.reportId))
      .returning();

    await this.logModAction({
      communityId: report.communityId,
      moderatorId: userId,
      action: "other",
      targetType: report.targetType,
      targetId: report.targetId,
      reason: `Resolved report: ${dto.action}`,
    });

    return updated as CommunityReport;
  }

  async getReports(communityId: string, status?: string) {
    const conditions = [eq(communityReports.communityId, communityId)];
    if (status) {
      conditions.push(eq(communityReports.status, status as any));
    }

    const items = await this.db
      .select()
      .from(communityReports)
      .where(and(...conditions))
      .orderBy(
        sql`CASE ${communityReports.severity} WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END`,
        desc(communityReports.createdAt),
      );
    return items as CommunityReport[];
  }

  async findReportById(id: string): Promise<CommunityReport | null> {
    const [result] = await this.db
      .select()
      .from(communityReports)
      .where(eq(communityReports.id, id))
      .limit(1);

    return (result as CommunityReport) ?? null;
  }

  async getModQueue(communityId: string) {
    const reports = await this.db
      .select()
      .from(communityReports)
      .where(
        and(eq(communityReports.communityId, communityId), eq(communityReports.status, "pending")),
      )
      .orderBy(
        sql`CASE ${communityReports.severity} WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END`,
        desc(communityReports.createdAt),
      );

    return {
      reports: reports as CommunityReport[],
      spam: [],
      removed: [],
    };
  }

  async banUser(dto: BanUserDto, moderatorId: string): Promise<CommunityBan> {
    await assertCommunityPermission(this.communityService, moderatorId, dto.communityId, [
      "owner",
      "admin",
      "moderator",
    ]);

    const existing = await this.findBan(dto.communityId, dto.userId);
    if (existing) {
      throw new ConflictException("이미 차단된 사용자입니다.");
    }

    const expiresAt = dto.isPermanent
      ? null
      : new Date(Date.now() + (dto.durationDays ?? 0) * 24 * 60 * 60 * 1000);

    const [ban] = await this.db
      .insert(communityBans)
      .values({
        communityId: dto.communityId,
        userId: dto.userId,
        bannedBy: moderatorId,
        reason: dto.reason,
        note: dto.note,
        isPermanent: dto.isPermanent,
        expiresAt,
      })
      .returning();

    await this.logModAction({
      communityId: dto.communityId,
      moderatorId,
      action: "ban_user",
      targetType: "user",
      targetId: dto.userId,
      reason: dto.reason,
    });

    return ban as CommunityBan;
  }

  async unbanUser(communityId: string, userId: string, moderatorId: string): Promise<void> {
    await assertCommunityPermission(this.communityService, moderatorId, communityId, [
      "owner",
      "admin",
      "moderator",
    ]);

    await this.db
      .delete(communityBans)
      .where(and(eq(communityBans.communityId, communityId), eq(communityBans.userId, userId)));

    await this.logModAction({
      communityId,
      moderatorId,
      action: "unban_user",
      targetType: "user",
      targetId: userId,
      reason: "User unbanned",
    });
  }

  async findBan(communityId: string, userId: string): Promise<CommunityBan | null> {
    const [result] = await this.db
      .select()
      .from(communityBans)
      .where(and(eq(communityBans.communityId, communityId), eq(communityBans.userId, userId)))
      .limit(1);

    return (result as CommunityBan) ?? null;
  }

  async getBannedUsers(communityId: string): Promise<CommunityBan[]> {
    const items = await this.db
      .select()
      .from(communityBans)
      .where(eq(communityBans.communityId, communityId))
      .orderBy(desc(communityBans.createdAt));

    return items as CommunityBan[];
  }

  async createRule(dto: CreateRuleDto, moderatorId: string): Promise<CommunityRule> {
    await assertCommunityPermission(this.communityService, moderatorId, dto.communityId, [
      "owner",
      "admin",
      "moderator",
    ]);

    const [rule] = await this.db
      .insert(communityRules)
      .values({
        communityId: dto.communityId,
        title: dto.title,
        description: dto.description,
        appliesTo: dto.appliesTo,
        violationAction: dto.violationAction,
      })
      .returning();

    await this.logModAction({
      communityId: dto.communityId,
      moderatorId,
      action: "edit_rules",
      targetType: "community",
      targetId: dto.communityId,
      reason: "Rule created",
    });

    return rule as CommunityRule;
  }

  async getRules(communityId: string): Promise<CommunityRule[]> {
    const items = await this.db
      .select()
      .from(communityRules)
      .where(eq(communityRules.communityId, communityId))
      .orderBy(communityRules.displayOrder);

    return items as CommunityRule[];
  }

  async createFlair(dto: CreateFlairDto, moderatorId: string): Promise<CommunityFlair> {
    await assertCommunityPermission(this.communityService, moderatorId, dto.communityId, [
      "owner",
      "admin",
      "moderator",
    ]);

    const [flair] = await this.db.insert(communityFlairs).values(dto).returning();

    await this.logModAction({
      communityId: dto.communityId,
      moderatorId,
      action: "add_flair",
      targetType: "community",
      targetId: dto.communityId,
      reason: "Flair created",
    });

    return flair as CommunityFlair;
  }

  async getFlairs(communityId: string, type?: "post" | "user"): Promise<CommunityFlair[]> {
    let query = this.db
      .select()
      .from(communityFlairs)
      .where(eq(communityFlairs.communityId, communityId));

    if (type) {
      query = (query as any).where(
        and(eq(communityFlairs.communityId, communityId), eq(communityFlairs.type, type)),
      );
    }

    const items = await query.orderBy(communityFlairs.displayOrder);
    return items as CommunityFlair[];
  }

  /**
   * Load the actor's role + (for a moderator) their own appointment context,
   * used to authorize moderator-management actions.
   */
  private async resolveModeratorActor(
    communityId: string,
    userId: string,
  ): Promise<ModeratorActor> {
    const membership = await this.communityService.getMembership(communityId, userId);
    if (!membership || membership.isBanned) {
      return { role: "member" };
    }
    const role = membership.role as CommunityRole;
    if (role !== "moderator") {
      return { role };
    }
    const [mod] = await this.db
      .select()
      .from(communityModerators)
      .where(
        and(
          eq(communityModerators.communityId, communityId),
          eq(communityModerators.userId, userId),
        ),
      )
      .limit(1);
    return {
      role,
      permissions: mod?.permissions ?? null,
      status: (mod?.status as ModeratorStatus | undefined) ?? null,
    };
  }

  /** Authorize a moderator-management action (AC#1) and return the actor context. */
  private async assertCanManageModerators(
    communityId: string,
    userId: string,
  ): Promise<ModeratorActor> {
    const actor = await this.resolveModeratorActor(communityId, userId);
    if (!canManageModerators(actor)) {
      throw new ForbiddenException("모더레이터를 관리할 권한이 없습니다.");
    }
    return actor;
  }

  private async findModeratorRow(
    communityId: string,
    userId: string,
  ): Promise<CommunityModerator | null> {
    const [row] = await this.db
      .select()
      .from(communityModerators)
      .where(
        and(
          eq(communityModerators.communityId, communityId),
          eq(communityModerators.userId, userId),
        ),
      )
      .limit(1);
    return (row as CommunityModerator) ?? null;
  }

  /**
   * Invite a member to become a moderator. Creates a pending appointment that
   * the invitee must accept before any moderator powers take effect (AC#2).
   */
  async inviteModerator(dto: InviteModeratorDto, inviterId: string): Promise<CommunityModerator> {
    const community = await this.communityService.findById(dto.communityId);
    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다.");
    }

    const actor = await this.assertCanManageModerators(dto.communityId, inviterId);

    const targetMembership = await this.communityService.getMembership(dto.communityId, dto.userId);
    if (!targetMembership) {
      throw new NotFoundException("초대 대상이 커뮤니티 멤버가 아닙니다.");
    }
    if (targetMembership.isBanned) {
      throw new ConflictException("차단된 사용자는 모더레이터로 초대할 수 없습니다.");
    }

    const permissions = sanitizeGrantablePermissions(
      actor.role,
      normalizeModeratorPermissions(dto.permissions),
    );

    const existing = await this.findModeratorRow(dto.communityId, dto.userId);
    if (existing && (existing.status === "pending" || existing.status === "active")) {
      throw new ConflictException("이미 모더레이터로 초대되었거나 활동 중입니다.");
    }

    // Re-invite a previously declined/revoked appointment by resetting the row,
    // since (community_id, user_id) is unique.
    const [moderator] = existing
      ? await this.db
          .update(communityModerators)
          .set({
            permissions,
            status: "pending",
            appointedBy: inviterId,
            appointedAt: new Date(),
            respondedAt: null,
            revokedAt: null,
          })
          .where(eq(communityModerators.id, existing.id))
          .returning()
      : await this.db
          .insert(communityModerators)
          .values({
            communityId: dto.communityId,
            userId: dto.userId,
            permissions,
            appointedBy: inviterId,
            status: "pending",
          })
          .returning();

    await this.logModAction({
      communityId: dto.communityId,
      moderatorId: inviterId,
      action: "other",
      targetType: "user",
      targetId: dto.userId,
      reason: "Moderator invited",
      details: { kind: "invite_moderator", status: "pending" },
    });

    return moderator as CommunityModerator;
  }

  /**
   * The invitee accepts or declines a pending moderator invite. On accept the
   * appointment becomes active and the membership role is promoted to moderator.
   */
  async respondToModeratorInvite(
    communityId: string,
    userId: string,
    accept: boolean,
  ): Promise<CommunityModerator> {
    const row = await this.findModeratorRow(communityId, userId);
    if (!row) {
      throw new NotFoundException("모더레이터 초대를 찾을 수 없습니다.");
    }
    if (!canRespondToInvite(row.status as ModeratorStatus)) {
      throw new ConflictException("이미 처리된 초대입니다.");
    }

    const status = nextStatusForResponse(accept);
    const [updated] = await this.db
      .update(communityModerators)
      .set({ status, respondedAt: new Date() })
      .where(eq(communityModerators.id, row.id))
      .returning();

    if (accept) {
      // Promote only a plain member; never demote an existing admin/owner.
      await this.db
        .update(communityMemberships)
        .set({ role: "moderator" })
        .where(
          and(
            eq(communityMemberships.communityId, communityId),
            eq(communityMemberships.userId, userId),
            eq(communityMemberships.role, "member"),
          ),
        );
    }

    await this.logModAction({
      communityId,
      moderatorId: userId,
      action: "other",
      targetType: "user",
      targetId: userId,
      reason: accept ? "Moderator invite accepted" : "Moderator invite declined",
      details: { kind: "respond_moderator_invite", accepted: accept, status },
    });

    return updated as CommunityModerator;
  }

  /** Change an active moderator's permission set (AC#1 authorization, AC#2 audit). */
  async updateModeratorPermissions(
    dto: UpdateModeratorPermissionsDto,
    actorId: string,
  ): Promise<CommunityModerator> {
    const community = await this.communityService.findById(dto.communityId);
    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다.");
    }

    const actor = await this.assertCanManageModerators(dto.communityId, actorId);

    const row = await this.findModeratorRow(dto.communityId, dto.userId);
    if (!row) {
      throw new NotFoundException("모더레이터를 찾을 수 없습니다.");
    }
    if (!canUpdatePermissions(row.status as ModeratorStatus)) {
      throw new ConflictException("활동 중인 모더레이터만 권한을 변경할 수 있습니다.");
    }

    const before = row.permissions;
    const after = sanitizeGrantablePermissions(
      actor.role,
      normalizeModeratorPermissions({ ...before, ...dto.permissions }),
    );

    const [updated] = await this.db
      .update(communityModerators)
      .set({ permissions: after })
      .where(eq(communityModerators.id, row.id))
      .returning();

    await this.logModAction({
      communityId: dto.communityId,
      moderatorId: actorId,
      action: "other",
      targetType: "user",
      targetId: dto.userId,
      reason: "Moderator permissions updated",
      details: { kind: "update_moderator_permissions", before, after },
    });

    return updated as CommunityModerator;
  }

  /**
   * Remove a moderator. Soft-revokes the appointment (keeping the invite-state
   * record for audit) and demotes the membership back to member.
   */
  async removeModerator(communityId: string, userId: string, removerId: string): Promise<void> {
    const community = await this.communityService.findById(communityId);
    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다.");
    }

    await this.assertCanManageModerators(communityId, removerId);

    const row = await this.findModeratorRow(communityId, userId);
    if (!row || !canRevokeAppointment(row.status as ModeratorStatus)) {
      throw new NotFoundException("해제할 모더레이터를 찾을 수 없습니다.");
    }

    await this.db
      .update(communityModerators)
      .set({ status: "revoked", revokedAt: new Date() })
      .where(eq(communityModerators.id, row.id));

    // Demote the membership back to plain member if it was promoted.
    await this.db
      .update(communityMemberships)
      .set({ role: "member" })
      .where(
        and(
          eq(communityMemberships.communityId, communityId),
          eq(communityMemberships.userId, userId),
          eq(communityMemberships.role, "moderator"),
        ),
      );

    await this.logModAction({
      communityId,
      moderatorId: removerId,
      action: "other",
      targetType: "user",
      targetId: userId,
      reason: "Moderator removed",
      details: { kind: "remove_moderator", status: "revoked" },
    });
  }

  /**
   * Transfer community ownership to another member (owner-only). The previous
   * owner is demoted to admin; the new owner's membership is promoted to owner.
   */
  async transferOwnership(
    dto: TransferOwnershipDto,
    actorId: string,
  ): Promise<{ communityId: string; previousOwnerId: string; newOwnerId: string }> {
    const community = await this.communityService.findById(dto.communityId);
    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다.");
    }

    const actorMembership = await this.communityService.getMembership(dto.communityId, actorId);
    if (
      !actorMembership ||
      !canTransferOwnership(actorMembership.role as CommunityRole) ||
      community.ownerId !== actorId
    ) {
      throw new ForbiddenException("소유권을 양도할 권한이 없습니다.");
    }

    if (dto.newOwnerId === actorId) {
      throw new ConflictException("이미 소유자입니다.");
    }

    const targetMembership = await this.communityService.getMembership(
      dto.communityId,
      dto.newOwnerId,
    );
    if (!targetMembership || targetMembership.isBanned) {
      throw new NotFoundException("양도 대상이 커뮤니티 멤버가 아닙니다.");
    }

    await this.db
      .update(communities)
      .set({ ownerId: dto.newOwnerId })
      .where(eq(communities.id, dto.communityId));

    await this.db
      .update(communityMemberships)
      .set({ role: "admin" })
      .where(
        and(
          eq(communityMemberships.communityId, dto.communityId),
          eq(communityMemberships.userId, actorId),
        ),
      );

    await this.db
      .update(communityMemberships)
      .set({ role: "owner" })
      .where(
        and(
          eq(communityMemberships.communityId, dto.communityId),
          eq(communityMemberships.userId, dto.newOwnerId),
        ),
      );

    await this.logModAction({
      communityId: dto.communityId,
      moderatorId: actorId,
      action: "other",
      targetType: "community",
      targetId: dto.communityId,
      reason: "Community ownership transferred",
      details: {
        kind: "transfer_ownership",
        previousOwnerId: actorId,
        newOwnerId: dto.newOwnerId,
      },
    });

    return {
      communityId: dto.communityId,
      previousOwnerId: actorId,
      newOwnerId: dto.newOwnerId,
    };
  }

  async logModAction(data: {
    communityId: string;
    moderatorId: string;
    action: any;
    targetType?: any;
    targetId?: string;
    reason?: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.insert(communityModLogs).values({
      communityId: data.communityId,
      moderatorId: data.moderatorId,
      action: data.action,
      targetType: data.targetType ?? null,
      targetId: data.targetId,
      reason: data.reason,
      details: data.details ?? {},
    });
  }

  async getModLogs(communityId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;

    const [items, totalResult] = await Promise.all([
      this.db
        .select()
        .from(communityModLogs)
        .where(eq(communityModLogs.communityId, communityId))
        .orderBy(desc(communityModLogs.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(communityModLogs)
        .where(eq(communityModLogs.communityId, communityId)),
    ]);

    const total = totalResult[0]?.count ?? 0;

    return {
      items,
      total,
      page,
      limit,
      hasMore: offset + items.length < total,
    };
  }

  async getAllReports(input: { status?: string; page: number; limit: number }) {
    const { page, limit, status } = input;
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    if (status) {
      conditions.push(eq(communityReports.status, status as any));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, totalResult] = await Promise.all([
      this.db
        .select()
        .from(communityReports)
        .where(whereClause)
        .orderBy(desc(communityReports.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ count: count() }).from(communityReports).where(whereClause),
    ]);

    const total = totalResult[0]?.count ?? 0;
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getReportStats() {
    const results = await this.db
      .select({
        status: communityReports.status,
        count: count(),
      })
      .from(communityReports)
      .groupBy(communityReports.status);

    const stats = { pending: 0, reviewing: 0, resolved: 0, dismissed: 0 };
    for (const row of results) {
      if (row.status in stats) {
        stats[row.status as keyof typeof stats] = row.count;
      }
    }
    return stats;
  }

  // ── SLA Tracking ──────────────────────────────────

  /**
   * 커뮤니티별 SLA 메트릭을 계산한다.
   * TTFR (Time to First Response), TTR (Time to Resolution) — severity별 평균.
   */
  async getSlaMetrics(communityId: string) {
    const metrics = await this.db
      .select({
        severity: communityReports.severity,
        avgTtfrMinutes: sql<number>`
          AVG(
            EXTRACT(EPOCH FROM (${communityReports.firstResponseAt} - ${communityReports.createdAt})) / 60
          )
        `.as("avg_ttfr_minutes"),
        avgTtrMinutes: sql<number>`
          AVG(
            EXTRACT(EPOCH FROM (${communityReports.resolvedAt} - ${communityReports.createdAt})) / 60
          )
        `.as("avg_ttr_minutes"),
        totalReports: count(),
        resolvedCount: sql<number>`
          COUNT(*) FILTER (WHERE ${communityReports.status} = 'resolved')
        `.as("resolved_count"),
      })
      .from(communityReports)
      .where(eq(communityReports.communityId, communityId))
      .groupBy(communityReports.severity);

    // SLA 초과 신고 건수 (24시간 이상 pending)
    const [overdueResult] = await this.db
      .select({ overdueCount: count() })
      .from(communityReports)
      .where(
        and(
          eq(communityReports.communityId, communityId),
          eq(communityReports.status, "pending"),
          sql`${communityReports.createdAt} < NOW() - INTERVAL '24 hours'`,
        ),
      );

    return {
      bySeverity: metrics,
      overdueCount: overdueResult?.overdueCount ?? 0,
    };
  }

  /**
   * SLA 초과 신고 목록을 반환한다 (24시간 이상 pending).
   */
  async getOverdueReports(communityId: string): Promise<CommunityReport[]> {
    const items = await this.db
      .select()
      .from(communityReports)
      .where(
        and(
          eq(communityReports.communityId, communityId),
          eq(communityReports.status, "pending"),
          sql`${communityReports.createdAt} < NOW() - INTERVAL '24 hours'`,
        ),
      )
      .orderBy(
        sql`CASE ${communityReports.severity} WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END`,
        desc(communityReports.createdAt),
      );

    return items as CommunityReport[];
  }
}
