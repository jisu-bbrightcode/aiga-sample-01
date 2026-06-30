import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import {
  type AutomodConfig,
  type CommunityFilterLog,
  communityComments,
  communityFilterLogs,
  communityModLogs,
  communityPosts,
  type FilterReviewStatus,
} from "@repo/drizzle/schema";
import { and, count, desc, eq } from "drizzle-orm";
import { assertCommunityPermission } from "../helpers/permission";
import { CommunityService } from "./community.service";
import {
  combineDecision,
  evaluateAttachmentPolicy,
  evaluateLinkPolicy,
  extractUrls,
  type FilterDecision,
  type FilterViolation,
} from "./content-filter-policy";

const MODERATOR_ROLES = ["owner", "admin", "moderator"] as const;

export interface RecordFilterDecisionParams {
  communityId: string;
  authorId: string;
  /** null when the content was blocked (never persisted). */
  target: { type: "post" | "comment"; id: string } | null;
  decision: FilterDecision;
}

export interface FilterLogQuery {
  reviewStatus?: FilterReviewStatus;
  action?: "blocked" | "hidden_for_review";
  page?: number;
  limit?: number;
}

/**
 * CommunityFilterService (PB-COMM-FILTER-API-001).
 *
 * 자동 콘텐츠 필터(금칙어/URL/첨부)의 감사 로그와 수동 검토 큐를 담당한다.
 *  - 정책 평가: link/attachment 정책을 순수 모듈에 위임하고 결정을 병합한다.
 *  - 필터 로그: 모든 자동 조치를 community_filter_logs 에 append-only 기록(AC#2).
 *  - 검토 큐: hidden_for_review + pending 행이 검토 큐를 형성한다(AC#1).
 *  - 검토 처리: pending → approved(공개) | rejected(제거) 상태 전이 + 감사(AC#1/AC#2).
 */
@Injectable()
export class CommunityFilterService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly communityService: CommunityService,
  ) {}

  /**
   * 게시글 본문/링크/첨부에 link·attachment 정책을 적용한다. 금칙어 검사는
   * CommunityKeywordFilterService 가 별도로 수행하므로 여기서는 다루지 않는다.
   */
  evaluatePostPolicy(
    config: AutomodConfig | null | undefined,
    input: { texts: string[]; linkUrls?: string[]; mediaUrls?: string[] },
  ): FilterDecision {
    const cfg = config ?? {};
    const urls = [...extractUrls(input.texts), ...(input.linkUrls ?? [])];
    const violations: Array<FilterViolation | null> = [
      evaluateLinkPolicy(urls, cfg),
      evaluateAttachmentPolicy(input.mediaUrls ?? [], cfg),
    ];
    return combineDecision(violations);
  }

  /**
   * 자동 필터 조치를 감사 로그로 기록한다(AC#2). 위반이 없으면 기록하지 않는다.
   *  - block  → action=blocked, reviewStatus=rejected(검토 불필요, 콘텐츠 미생성)
   *  - review → action=hidden_for_review, reviewStatus=pending(검토 큐 진입)
   * 검토 큐 1:1 보장을 위해 이벤트당 한 행만 남기고, 위반 사유는 합쳐서 기록한다.
   */
  async recordFilterDecision(
    params: RecordFilterDecisionParams,
  ): Promise<CommunityFilterLog | null> {
    const { decision } = params;
    const primary = decision.violations[0];
    if (decision.action === "allow" || !primary) {
      return null;
    }

    const matchedTerms = [...new Set(decision.violations.flatMap((v) => v.matchedTerms))];
    const reason = decision.violations.map((v) => v.reason).join("; ");
    const isBlock = decision.action === "block";

    const [row] = await this.db
      .insert(communityFilterLogs)
      .values({
        communityId: params.communityId,
        authorId: params.authorId,
        targetType: params.target?.type ?? null,
        targetId: params.target?.id ?? null,
        ruleType: primary.ruleType,
        action: isBlock ? "blocked" : "hidden_for_review",
        matchedTerms,
        reason,
        reviewStatus: isBlock ? "rejected" : "pending",
        ...(isBlock ? { reviewedAt: new Date() } : {}),
      })
      .returning();

    return (row as CommunityFilterLog) ?? null;
  }

  /** 필터 로그 감사 조회(모더레이터 전용, AC#2). */
  async getFilterLogs(communityId: string, requesterId: string, query: FilterLogQuery = {}) {
    await assertCommunityPermission(this.communityService, requesterId, communityId, [
      ...MODERATOR_ROLES,
    ]);

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const offset = (page - 1) * limit;

    const conditions = [eq(communityFilterLogs.communityId, communityId)];
    if (query.reviewStatus) {
      conditions.push(eq(communityFilterLogs.reviewStatus, query.reviewStatus));
    }
    if (query.action) {
      conditions.push(eq(communityFilterLogs.action, query.action));
    }
    const whereClause = and(...conditions);

    const [items, totalResult] = await Promise.all([
      this.db
        .select()
        .from(communityFilterLogs)
        .where(whereClause)
        .orderBy(desc(communityFilterLogs.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ count: count() }).from(communityFilterLogs).where(whereClause),
    ]);

    const total = totalResult[0]?.count ?? 0;
    return { items, total, page, limit, hasMore: offset + items.length < total };
  }

  /**
   * 검토 큐: 자동 숨김(hidden_for_review)되어 아직 검토되지 않은(pending) 항목.
   * 정책 위반 후보가 공개되지 않은 상태로 모더레이터에게 연결된다(AC#1).
   */
  async getReviewQueue(communityId: string, requesterId: string) {
    await assertCommunityPermission(this.communityService, requesterId, communityId, [
      ...MODERATOR_ROLES,
    ]);

    const items = await this.db
      .select()
      .from(communityFilterLogs)
      .where(
        and(
          eq(communityFilterLogs.communityId, communityId),
          eq(communityFilterLogs.action, "hidden_for_review"),
          eq(communityFilterLogs.reviewStatus, "pending"),
        ),
      )
      .orderBy(desc(communityFilterLogs.createdAt));

    return { items, total: items.length };
  }

  /**
   * 검토 처리(모더레이터 전용). pending hidden 항목을
   *  - approve → 콘텐츠 공개(post: published / comment: unhide), reviewStatus=approved
   *  - reject  → 콘텐츠 제거(post: removed / comment: removed), reviewStatus=rejected
   * 상태 전이와 결과를 필터 로그 + community_mod_logs 에 모두 남긴다(AC#1/AC#2).
   */
  async reviewFilterEntry(
    logId: string,
    requesterId: string,
    input: { decision: "approve" | "reject"; note?: string },
  ): Promise<CommunityFilterLog> {
    const log = await this.findById(logId);
    if (!log) {
      throw new NotFoundException("필터 로그를 찾을 수 없습니다.");
    }

    await assertCommunityPermission(this.communityService, requesterId, log.communityId, [
      ...MODERATOR_ROLES,
    ]);

    if (log.action !== "hidden_for_review") {
      throw new ConflictException("검토할 수 있는 항목이 아닙니다.");
    }
    if (log.reviewStatus !== "pending") {
      throw new ConflictException("이미 검토된 항목입니다.");
    }
    if (!log.targetType || !log.targetId) {
      throw new ConflictException("검토 대상 콘텐츠가 없습니다.");
    }

    const approve = input.decision === "approve";
    const { targetType, targetId } = log;
    await this.applyContentTransition({
      targetType,
      targetId,
      approve,
      requesterId,
      reason: log.reason,
    });

    const [updated] = await this.db
      .update(communityFilterLogs)
      .set({
        reviewStatus: approve ? "approved" : "rejected",
        reviewedBy: requesterId,
        reviewedAt: new Date(),
        reviewNote: input.note ?? null,
      })
      .where(eq(communityFilterLogs.id, logId))
      .returning();

    const rejectAction = targetType === "post" ? "remove_post" : "remove_comment";
    await this.db.insert(communityModLogs).values({
      communityId: log.communityId,
      moderatorId: requesterId,
      action: approve ? "other" : rejectAction,
      targetType,
      targetId,
      reason: approve ? "필터 자동 숨김 콘텐츠 공개 승인" : "필터 자동 숨김 콘텐츠 제거",
      details: {
        kind: "filter_review",
        decision: input.decision,
        filterLogId: logId,
        ruleType: log.ruleType,
      },
    });

    return updated as CommunityFilterLog;
  }

  /** approve → 공개 / reject → 제거. 대상 유형(post/comment)별 상태 전이. */
  private async applyContentTransition(input: {
    targetType: "post" | "comment";
    targetId: string;
    approve: boolean;
    requesterId: string;
    reason: string | null;
  }): Promise<void> {
    const { targetType, targetId, approve, requesterId, reason } = input;
    const removalReason = reason ?? "필터 위반으로 제거됨";

    if (targetType === "post") {
      await this.db
        .update(communityPosts)
        .set(
          approve
            ? { status: "published", removalReason: null, updatedAt: new Date() }
            : { status: "removed", removedBy: requesterId, removalReason, updatedAt: new Date() },
        )
        .where(eq(communityPosts.id, targetId));
      return;
    }

    await this.db
      .update(communityComments)
      .set(
        approve
          ? { isHidden: false, updatedAt: new Date() }
          : {
              isHidden: true,
              isRemoved: true,
              removedBy: requesterId,
              removalReason,
              updatedAt: new Date(),
            },
      )
      .where(eq(communityComments.id, targetId));
  }

  async findById(id: string): Promise<CommunityFilterLog | null> {
    const [row] = await this.db
      .select()
      .from(communityFilterLogs)
      .where(eq(communityFilterLogs.id, id))
      .limit(1);
    return (row as CommunityFilterLog) ?? null;
  }
}
