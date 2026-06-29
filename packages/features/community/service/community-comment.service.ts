import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import {
  type CommunityComment,
  communityComments,
  communityPosts,
  user as userTable,
} from "@repo/drizzle/schema";
import { and, asc, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { buildCursorResult, decodeCursor } from "../helpers/pagination";
import { assertCommunityPermission } from "../helpers/permission";
import type { CreateCommentDto } from "../dto";
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
}

@Injectable()
export class CommunityCommentService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly communityService: CommunityService,
    private readonly keywordFilterService: CommunityKeywordFilterService,
    private readonly tierService: CommunityTierService,
    private readonly contentModerationService: CommunityContentModerationService
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

    const conditions: any[] = [eq(communityComments.postId, options.postId)];

    // 차단된 유저의 댓글 제외
    if (options.blockedUserIds && options.blockedUserIds.length > 0) {
      conditions.push(notInArray(communityComments.authorId, options.blockedUserIds));
    }

    if (options.cursor) {
      const decoded = decodeCursor(options.cursor);
      if (decoded) {
        if (options.sort === "new") {
          conditions.push(
            sql`(${communityComments.createdAt}, ${communityComments.id}) < (${decoded.value}, ${decoded.id})`,
          );
        } else {
          conditions.push(
            sql`(${communityComments.createdAt}, ${communityComments.id}) > (${decoded.value}, ${decoded.id})`,
          );
        }
      }
    }

    let query = this.db
      .select()
      .from(communityComments)
      .where(and(...conditions));

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
    const enrichedItems = items.map((item) => ({
      ...item,
      authorName: authorMap.get(item.authorId)?.name ?? null,
      authorAvatar: authorMap.get(item.authorId)?.avatar ?? null,
    }));

    return buildCursorResult(enrichedItems, limit, (item) => ({
      value: item.createdAt.toISOString(),
      id: item.id,
    }));
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

    return updated as CommunityComment;
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
