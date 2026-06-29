import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import {
  type CommunityBan,
  type CommunityFlair,
  type CommunityModerator,
  type CommunityReport,
  type CommunityRule,
  communityBans,
  communityComments,
  communityFlairs,
  communityModerators,
  communityModLogs,
  communityPosts,
  communityReports,
  communityRules,
} from "@repo/drizzle/schema";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { assertCommunityPermission } from "../helpers/permission";
import type {
  BanUserDto,
  CreateFlairDto,
  CreateReportDto,
  CreateRuleDto,
  InviteModeratorDto,
  ResolveReportDto,
} from "../dto";
import { CommunityService } from "./community.service";

@Injectable()
export class CommunityModerationService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly communityService: CommunityService
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

  async inviteModerator(dto: InviteModeratorDto, inviterId: string): Promise<CommunityModerator> {
    const community = await this.communityService.findById(dto.communityId);
    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다.");
    }

    await assertCommunityPermission(this.communityService, inviterId, dto.communityId, ["owner"]);

    const [moderator] = await this.db
      .insert(communityModerators)
      .values({
        communityId: dto.communityId,
        userId: dto.userId,
        permissions: dto.permissions,
        appointedBy: inviterId,
      })
      .returning();

    await this.logModAction({
      communityId: dto.communityId,
      moderatorId: inviterId,
      action: "other",
      targetType: "user",
      targetId: dto.userId,
      reason: "Moderator invited",
    });

    return moderator as CommunityModerator;
  }

  async removeModerator(communityId: string, userId: string, removerId: string): Promise<void> {
    const community = await this.communityService.findById(communityId);
    if (!community) {
      throw new NotFoundException("커뮤니티를 찾을 수 없습니다.");
    }

    await assertCommunityPermission(this.communityService, removerId, communityId, ["owner"]);

    await this.db
      .delete(communityModerators)
      .where(
        and(
          eq(communityModerators.communityId, communityId),
          eq(communityModerators.userId, userId),
        ),
      );

    await this.logModAction({
      communityId,
      moderatorId: removerId,
      action: "other",
      targetType: "user",
      targetId: userId,
      reason: "Moderator removed",
    });
  }

  async logModAction(data: {
    communityId: string;
    moderatorId: string;
    action: any;
    targetType?: any;
    targetId?: string;
    reason?: string;
  }): Promise<void> {
    await this.db.insert(communityModLogs).values({
      communityId: data.communityId,
      moderatorId: data.moderatorId,
      action: data.action,
      targetType: data.targetType ?? null,
      targetId: data.targetId,
      reason: data.reason,
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
