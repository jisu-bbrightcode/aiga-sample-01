import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { type RateLimitConfig, RateLimitService } from "@repo/core/rate-limit";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import {
  type CommunityComment,
  communityComments,
  communityModLogs,
  communityPosts,
  user as userTable,
} from "@repo/drizzle/schema";
import { and, asc, count, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { type EnrichedCommentRow, toPublicCommentItem } from "../comment-visibility";
import type { CreateCommentDto } from "../dto";
import { buildCursorResult, decodeCursor } from "../helpers/pagination";
import { assertCommunityPermission } from "../helpers/permission";
import {
  decodeCommentSortKey,
  encodeCommentSortKey,
  resolveReplyDepth,
} from "./comment-ops-policy";
import { assertCommentablePost } from "./comment-creation-policy";
import { CommunityService } from "./community.service";
import { CommunityContentModerationService } from "./community-content-moderation.service";
import { CommunityKeywordFilterService } from "./community-keyword-filter.service";
import { CommunityTierService, TIER_PRIVILEGES } from "./community-tier.service";

/** 댓글 본문 최대 길이(create-comment.dto.ts의 zod 스키마와 일치). */
const COMMENT_CONTENT_MAX_LENGTH = 10000;

/**
 * 댓글 작성 anti-spam 레이트 리밋.
 * 인증된 작성자(userId) 기준으로 윈도우당 작성 횟수를 제한한다.
 * `RATE_LIMIT_ENABLED=false`면 RateLimitService가 우회한다(개발/테스트).
 */
export const COMMENT_CREATE_RATE_LIMIT: RateLimitConfig = {
  action: "community:comment:create",
  maxRequests: 10,
  windowSeconds: 60,
};

export interface CommentListOptions {
  postId: string;
  sort?: "old" | "new";
  cursor?: string;
  limit?: number;
  blockedUserIds?: string[];
  /** 조회자 id. 키워드 숨김 댓글은 작성자 본인에게만 원문을 노출한다. */
  viewerId?: string;
}

@Injectable()
export class CommunityCommentService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly communityService: CommunityService,
    private readonly keywordFilterService: CommunityKeywordFilterService,
    private readonly tierService: CommunityTierService,
    private readonly contentModerationService: CommunityContentModerationService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async create(dto: CreateCommentDto, userId: string): Promise<CommunityComment> {
    // 본문 검증: 런타임 검증으로 빈/공백/초과 본문을 서비스 경계에서 차단한다.
    const content = dto.content?.trim() ?? "";
    if (content.length === 0) {
      throw new BadRequestException("댓글 내용을 입력해주세요.");
    }
    if (content.length > COMMENT_CONTENT_MAX_LENGTH) {
      throw new BadRequestException("댓글 내용이 너무 깁니다.");
    }

    const [post] = await this.db
      .select()
      .from(communityPosts)
      .where(eq(communityPosts.id, dto.postId))
      .limit(1);

    if (!post) {
      throw new NotFoundException("게시글을 찾을 수 없습니다.");
    }

    // 정책 게이트: 숨김/잠김/삭제/미공개 게시글에는 댓글을 작성할 수 없다.
    assertCommentablePost(post);

    // anti-spam: 작성자(userId) 단위 레이트 리밋. 초과 시 HTTP 429.
    // 정책 필터/Moderation API 호출 전에 검사해 남용을 조기 차단한다.
    await this.rateLimitService.assertRateLimit(userId, COMMENT_CREATE_RATE_LIMIT);

    // 대댓글 depth 제한(AC#2). 정책은 comment-ops-policy.ts 에 단일 출처로 고정한다.
    let depth = 0;
    if (dto.parentId) {
      const parent = await this.findById(dto.parentId);
      if (!parent) {
        throw new NotFoundException("상위 댓글을 찾을 수 없습니다.");
      }
      const resolved = resolveReplyDepth(parent.depth);
      if (!resolved.ok) {
        throw new BadRequestException(
          `대댓글은 최대 ${resolved.maxDepth}단계까지 작성할 수 있습니다.`,
        );
      }
      depth = resolved.depth;
    }

    // 등급 기반 키워드 필터 우회 확인
    const commentTierInfo = await this.tierService.getTierInfo(post.communityId, userId);
    const commentBypass =
      TIER_PRIVILEGES[commentTierInfo.tier as keyof typeof TIER_PRIVILEGES]?.bypassKeywordFilter ??
      false;

    // 키워드 필터 검사
    const filterResult = await this.keywordFilterService.validateContent(
      post.communityId,
      [content],
      { bypassFilter: commentBypass },
    );

    let isHidden = false;
    if (!filterResult.passed) {
      if (filterResult.action === "block") {
        throw new ForbiddenException(
          `금지어가 포함되어 있습니다: ${filterResult.matchedWords.join(", ")}`,
        );
      }
      isHidden = true;
    }

    // Layer 2: OpenAI Moderation API
    await this.contentModerationService.assertContentAllowed([content]);

    const [comment] = await this.db
      .insert(communityComments)
      .values({
        ...dto,
        content,
        authorId: userId,
        depth,
        ...(isHidden && { isHidden: true }),
      })
      .returning();

    await this.db
      .update(communityPosts)
      .set({
        commentCount: sql`${communityPosts.commentCount} + 1`,
        lastActivityAt: new Date(),
      })
      .where(eq(communityPosts.id, dto.postId));

    if (dto.parentId) {
      await this.db
        .update(communityComments)
        .set({
          replyCount: sql`${communityComments.replyCount} + 1`,
        })
        .where(eq(communityComments.id, dto.parentId));
    }

    return comment as CommunityComment;
  }

  async findByPost(options: CommentListOptions) {
    const limit = options.limit ?? 50;

    // 노출 정책 조건(postId + 차단 작성자 제외). 페이지 쿼리와 총 개수 쿼리가
    // 동일한 조건을 공유해야 "댓글 수"와 "실제 노출 댓글"이 일관된다(AC#2).
    const visibilityConditions: any[] = [eq(communityComments.postId, options.postId)];

    // 차단된 유저의 댓글 제외
    if (options.blockedUserIds && options.blockedUserIds.length > 0) {
      visibilityConditions.push(notInArray(communityComments.authorId, options.blockedUserIds));
    }

    // Cursor 페이지네이션 — 정렬 계약과 동일한 3-튜플 (isStickied, createdAt, id) 을
    // 비교한다. 고정 댓글은 isStickied DESC(true 우선)이므로, "cursor 이후" 행은
    //   (isStickied < cursor.stickied)  // 고정이 끝난 뒤의 일반 댓글
    //   OR (isStickied = cursor.stickied AND (createdAt,id) 가 정렬방향상 이후)
    const pageConditions = [...visibilityConditions];
    if (options.cursor) {
      const decoded = decodeCursor(options.cursor);
      const sortKey = decoded ? decodeCommentSortKey(decoded.value) : null;
      if (decoded && sortKey) {
        const sticky = sortKey.stickied;
        const created = sortKey.createdAt;
        if (options.sort === "new") {
          pageConditions.push(
            sql`((${communityComments.isStickied} < ${sticky}) OR (${communityComments.isStickied} = ${sticky} AND (${communityComments.createdAt}, ${communityComments.id}) < (${created}, ${decoded.id})))`,
          );
        } else {
          pageConditions.push(
            sql`((${communityComments.isStickied} < ${sticky}) OR (${communityComments.isStickied} = ${sticky} AND (${communityComments.createdAt}, ${communityComments.id}) > (${created}, ${decoded.id})))`,
          );
        }
      }
    }

    let query = this.db
      .select()
      .from(communityComments)
      .where(and(...pageConditions));

    // 정렬 계약(AC#2): 고정 댓글 상단, 그 안에서 작성순(new=최신, 기본=오래된 순).
    if (options.sort === "new") {
      query = (query as any).orderBy(
        desc(communityComments.isStickied),
        desc(communityComments.createdAt),
        desc(communityComments.id),
      );
    } else {
      query = (query as any).orderBy(
        desc(communityComments.isStickied),
        asc(communityComments.createdAt),
        asc(communityComments.id),
      );
    }

    const items = (await query.limit(limit + 1)) as CommunityComment[];

    // Enrich with author data
    const authorIds = [...new Set(items.map((item) => item.authorId))];
    const authors =
      authorIds.length > 0
        ? await this.db
            .select({ id: userTable.id, name: userTable.name, avatar: userTable.image })
            .from(userTable)
            .where(inArray(userTable.id, authorIds))
        : [];
    const authorMap = new Map(authors.map((a) => [a.id, a]));
    const enrichedItems: EnrichedCommentRow[] = items.map((item) => ({
      ...item,
      authorName: authorMap.get(item.authorId)?.name ?? null,
      authorAvatar: authorMap.get(item.authorId)?.avatar ?? null,
    }));

    const page = buildCursorResult(enrichedItems, limit, (item) => ({
      value: encodeCommentSortKey({
        stickied: item.isStickied,
        createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
      }),
      id: item.id,
    }));

    // 동일한 노출 조건으로 총 개수 산출. 삭제/제거/숨김 댓글은 tombstone 으로
    // 목록에 남기므로 개수에도 포함된다 — 차단 작성자만 양쪽에서 제외된다.
    const totalCountRows = await this.db
      .select({ value: count() })
      .from(communityComments)
      .where(and(...visibilityConditions));
    const totalCount = totalCountRows[0]?.value ?? 0;

    const viewer = { userId: options.viewerId ?? null };
    return {
      items: page.items.map((item) => toPublicCommentItem(item, viewer)),
      nextCursor: page.nextCursor,
      totalCount,
    };
  }

  async findById(id: string): Promise<CommunityComment | null> {
    const [result] = await this.db
      .select()
      .from(communityComments)
      .where(eq(communityComments.id, id))
      .limit(1);

    return (result as CommunityComment) ?? null;
  }

  async update(id: string, content: string, userId: string): Promise<CommunityComment> {
    const comment = await this.findById(id);
    if (!comment) {
      throw new NotFoundException("댓글을 찾을 수 없습니다.");
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException("작성자만 댓글을 수정할 수 있습니다.");
    }

    // 키워드 필터 검사
    const [post] = await this.db
      .select({ communityId: communityPosts.communityId })
      .from(communityPosts)
      .where(eq(communityPosts.id, comment.postId))
      .limit(1);

    const updateValues: Record<string, unknown> = {
      content,
      isEdited: true,
      editedAt: new Date(),
      updatedAt: new Date(),
    };

    if (post) {
      const updateTierInfo = await this.tierService.getTierInfo(post.communityId, userId);
      const updateCommentBypass =
        TIER_PRIVILEGES[updateTierInfo.tier as keyof typeof TIER_PRIVILEGES]?.bypassKeywordFilter ??
        false;

      const filterResult = await this.keywordFilterService.validateContent(
        post.communityId,
        [content],
        { bypassFilter: updateCommentBypass },
      );
      if (!filterResult.passed) {
        if (filterResult.action === "block") {
          throw new ForbiddenException(
            `금지어가 포함되어 있습니다: ${filterResult.matchedWords.join(", ")}`,
          );
        }
        updateValues.isHidden = true;
      }

      // Layer 2: OpenAI Moderation API
      await this.contentModerationService.assertContentAllowed([content]);
    }

    const [updated] = await this.db
      .update(communityComments)
      .set(updateValues)
      .where(eq(communityComments.id, id))
      .returning();

    return updated as CommunityComment;
  }

  async delete(id: string, userId: string): Promise<void> {
    const comment = await this.findById(id);
    if (!comment) {
      throw new NotFoundException("댓글을 찾을 수 없습니다.");
    }

    const [post] = await this.db
      .select()
      .from(communityPosts)
      .where(eq(communityPosts.id, comment.postId))
      .limit(1);

    if (!post) {
      throw new NotFoundException("게시글을 찾을 수 없습니다.");
    }

    const isModerator = await this.communityService.isModerator(post.communityId, userId);
    if (comment.authorId !== userId && !isModerator) {
      throw new ForbiddenException("작성자 또는 관리자만 댓글을 삭제할 수 있습니다.");
    }

    await this.db
      .update(communityComments)
      .set({
        isDeleted: true,
        content: "[삭제됨]",
        updatedAt: new Date(),
      })
      .where(eq(communityComments.id, id));

    await this.db
      .update(communityPosts)
      .set({
        commentCount: sql`${communityPosts.commentCount} - 1`,
      })
      .where(eq(communityPosts.id, comment.postId));
  }

  async remove(id: string, reason: string, userId: string): Promise<CommunityComment> {
    const comment = await this.findById(id);
    if (!comment) {
      throw new NotFoundException("댓글을 찾을 수 없습니다.");
    }

    const [post] = await this.db
      .select()
      .from(communityPosts)
      .where(eq(communityPosts.id, comment.postId))
      .limit(1);

    if (!post) {
      throw new NotFoundException("게시글을 찾을 수 없습니다.");
    }

    await assertCommunityPermission(this.communityService, userId, post.communityId, [
      "owner",
      "admin",
      "moderator",
    ]);

    const [updated] = await this.db
      .update(communityComments)
      .set({
        isRemoved: true,
        removalReason: reason,
        removedBy: userId,
        content: "[removed]",
        updatedAt: new Date(),
      })
      .where(eq(communityComments.id, id))
      .returning();

    // 감사 로그(AC#1): 운영 액션을 community_mod_logs 에 append → 관리자 모드로그 큐에 반영.
    await this.recordCommentModLog({
      communityId: post.communityId,
      moderatorId: userId,
      action: "remove_comment",
      commentId: id,
      reason,
      details: { kind: "remove_comment" },
    });

    return updated as CommunityComment;
  }

  /**
   * 댓글 고정 상태를 설정/토글한다(모더레이터).
   * @param sticky 명시하면 해당 값으로 설정, 생략하면 현재 값을 토글한다.
   */
  async sticky(id: string, userId: string, sticky?: boolean): Promise<CommunityComment> {
    const comment = await this.findById(id);
    if (!comment) {
      throw new NotFoundException("댓글을 찾을 수 없습니다.");
    }

    const [post] = await this.db
      .select()
      .from(communityPosts)
      .where(eq(communityPosts.id, comment.postId))
      .limit(1);

    if (!post) {
      throw new NotFoundException("게시글을 찾을 수 없습니다.");
    }

    await assertCommunityPermission(this.communityService, userId, post.communityId, [
      "owner",
      "admin",
      "moderator",
    ]);

    const desired = sticky ?? !comment.isStickied;

    const [updated] = await this.db
      .update(communityComments)
      .set({
        isStickied: desired,
        updatedAt: new Date(),
      })
      .where(eq(communityComments.id, id))
      .returning();

    await this.recordCommentModLog({
      communityId: post.communityId,
      moderatorId: userId,
      action: "other",
      commentId: id,
      details: { kind: desired ? "sticky_comment" : "unsticky_comment", isStickied: desired },
    });

    return updated as CommunityComment;
  }

  /**
   * 댓글 모더레이터 표시(distinguish)를 설정/토글한다.
   * 자신의 댓글에만 적용 가능하며, 모더레이터 권한이 필요하다.
   * @param distinguished 명시하면 해당 값(`null`=해제)으로 설정, 생략하면 토글한다.
   */
  async distinguish(
    id: string,
    userId: string,
    distinguished?: "moderator" | "admin" | null,
  ): Promise<CommunityComment> {
    const comment = await this.findById(id);
    if (!comment) {
      throw new NotFoundException("댓글을 찾을 수 없습니다.");
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException("작성자만 댓글을 구분 표시할 수 있습니다.");
    }

    const [post] = await this.db
      .select()
      .from(communityPosts)
      .where(eq(communityPosts.id, comment.postId))
      .limit(1);

    if (!post) {
      throw new NotFoundException("게시글을 찾을 수 없습니다.");
    }

    await assertCommunityPermission(this.communityService, userId, post.communityId, [
      "owner",
      "admin",
      "moderator",
    ]);

    let desired: "moderator" | "admin" | null;
    if (distinguished === undefined) {
      desired = comment.distinguished ? null : "moderator";
    } else {
      desired = distinguished;
    }

    const [updated] = await this.db
      .update(communityComments)
      .set({
        distinguished: desired,
        updatedAt: new Date(),
      })
      .where(eq(communityComments.id, id))
      .returning();

    await this.recordCommentModLog({
      communityId: post.communityId,
      moderatorId: userId,
      action: "other",
      commentId: id,
      details: {
        kind: desired ? "distinguish_comment" : "undistinguish_comment",
        distinguished: desired,
      },
    });

    return updated as CommunityComment;
  }

  /**
   * 댓글 운영 액션을 community_mod_logs 에 append-only 로 기록한다(감사 로그).
   * remove 는 전용 action `remove_comment`, sticky/distinguish 는 `other` +
   * `details.kind` 로 구분한다. DI 순환을 피하기 위해 직접 insert 한다.
   */
  private async recordCommentModLog(input: {
    communityId: string;
    moderatorId: string;
    action: "remove_comment" | "other";
    commentId: string;
    reason?: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.insert(communityModLogs).values({
      communityId: input.communityId,
      moderatorId: input.moderatorId,
      action: input.action,
      targetType: "comment",
      targetId: input.commentId,
      reason: input.reason ?? null,
      details: input.details ?? {},
    });
  }
}
