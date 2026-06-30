import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
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
import { buildCursorResult, decodeCursor } from "../helpers/pagination";
import { assertCommunityPermission } from "../helpers/permission";
import type { CreateCommentDto } from "../dto";
import { canRestoreComment } from "./comment-deletion-policy";
import { CommunityService } from "./community.service";
import { CommunityContentModerationService } from "./community-content-moderation.service";
import { CommunityKeywordFilterService } from "./community-keyword-filter.service";
import { CommunityTierService, TIER_PRIVILEGES } from "./community-tier.service";

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
  ) {}

  async create(dto: CreateCommentDto, userId: string): Promise<CommunityComment> {
    const [post] = await this.db
      .select()
      .from(communityPosts)
      .where(eq(communityPosts.id, dto.postId))
      .limit(1);

    if (!post) {
      throw new NotFoundException("게시글을 찾을 수 없습니다.");
    }

    if (post.isLocked) {
      throw new ForbiddenException("잠긴 게시글에는 댓글을 작성할 수 없습니다.");
    }

    let depth = 0;
    if (dto.parentId) {
      const parent = await this.findById(dto.parentId);
      if (!parent) {
        throw new NotFoundException("상위 댓글을 찾을 수 없습니다.");
      }
      depth = parent.depth + 1;
    }

    // 등급 기반 키워드 필터 우회 확인
    const commentTierInfo = await this.tierService.getTierInfo(post.communityId, userId);
    const commentBypass =
      TIER_PRIVILEGES[commentTierInfo.tier as keyof typeof TIER_PRIVILEGES]?.bypassKeywordFilter ??
      false;

    // 키워드 필터 검사
    const filterResult = await this.keywordFilterService.validateContent(
      post.communityId,
      [dto.content],
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
    await this.contentModerationService.assertContentAllowed([dto.content]);

    const [comment] = await this.db
      .insert(communityComments)
      .values({
        ...dto,
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

    const pageConditions = [...visibilityConditions];
    if (options.cursor) {
      const decoded = decodeCursor(options.cursor);
      if (decoded) {
        if (options.sort === "new") {
          pageConditions.push(
            sql`(${communityComments.createdAt}, ${communityComments.id}) < (${decoded.value}, ${decoded.id})`,
          );
        } else {
          pageConditions.push(
            sql`(${communityComments.createdAt}, ${communityComments.id}) > (${decoded.value}, ${decoded.id})`,
          );
        }
      }
    }

    let query = this.db
      .select()
      .from(communityComments)
      .where(and(...pageConditions));

    if (options.sort === "new") {
      query = (query as any).orderBy(desc(communityComments.createdAt), desc(communityComments.id));
    } else {
      query = (query as any).orderBy(asc(communityComments.createdAt), asc(communityComments.id));
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
      value: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
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

    // 멱등: 이미 삭제된 댓글에 대한 재호출은 commentCount 를 다시 감소시키지 않는다.
    // (AC#1 — 게시글 댓글 수가 중복 호출로 어긋나지 않도록 보장한다.)
    if (comment.isDeleted) {
      return;
    }

    await this.db
      .update(communityComments)
      .set({
        isDeleted: true,
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
        updatedAt: new Date(),
      })
      .where(eq(communityComments.id, id))
      .returning();

    // 감사 로그: 모더레이션 제거 이력은 댓글 행과 무관하게 append-only 로 보존된다(AC#1).
    await this.recordModLog({
      communityId: post.communityId,
      moderatorId: userId,
      action: "remove_comment",
      targetId: id,
      reason,
      details: { kind: "comment_removed" },
    });

    return updated as CommunityComment;
  }

  /**
   * 모더레이터가 제거(`isRemoved`)하거나 필터로 숨겨진(`isHidden`) 댓글을 공개로 복구한다.
   *
   * - 작성자 삭제(`isDeleted`)는 작성자 의사이므로 복구 대상이 아니다 → 409.
   * - 이미 공개 상태인 댓글은 복구할 것이 없다 → 409.
   * - 원본 본문은 제거/숨김 시 보존되므로(read 시점 마스킹), 복구하면 그대로 다시 노출된다.
   * - 대댓글/신고/감사 로그는 soft delete 로 보존되어 복구 후에도 일관된다(AC#1).
   */
  async restore(id: string, userId: string): Promise<CommunityComment> {
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

    if (!canRestoreComment(comment)) {
      throw new ConflictException("숨김 또는 제거된 댓글만 복구할 수 있습니다.");
    }

    const [updated] = await this.db
      .update(communityComments)
      .set({
        isRemoved: false,
        isHidden: false,
        removalReason: null,
        removedBy: null,
        updatedAt: new Date(),
      })
      .where(eq(communityComments.id, id))
      .returning();

    await this.recordModLog({
      communityId: post.communityId,
      moderatorId: userId,
      action: "other",
      targetId: id,
      reason: "comment_restored",
      details: { kind: "comment_restored" },
    });

    return updated as CommunityComment;
  }

  /**
   * 모더레이션 감사 로그를 append-only 로 기록한다. 댓글 행/게시글 카운트와 독립적으로
   * 보존되어 삭제·복구 이력의 일관성을 보장한다(AC#1).
   */
  private async recordModLog(entry: {
    communityId: string;
    moderatorId: string;
    action: "remove_comment" | "other";
    targetId: string;
    reason?: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.insert(communityModLogs).values({
      communityId: entry.communityId,
      moderatorId: entry.moderatorId,
      action: entry.action,
      targetType: "comment",
      targetId: entry.targetId,
      reason: entry.reason ?? null,
      details: entry.details ?? {},
    });
  }

  async sticky(id: string, userId: string): Promise<CommunityComment> {
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
        isStickied: true,
        updatedAt: new Date(),
      })
      .where(eq(communityComments.id, id))
      .returning();

    return updated as CommunityComment;
  }

  async distinguish(id: string, userId: string): Promise<CommunityComment> {
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

    const [updated] = await this.db
      .update(communityComments)
      .set({
        distinguished: "moderator",
        updatedAt: new Date(),
      })
      .where(eq(communityComments.id, id))
      .returning();

    return updated as CommunityComment;
  }
}
