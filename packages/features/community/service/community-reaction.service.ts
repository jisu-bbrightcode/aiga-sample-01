import { Injectable, NotFoundException } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import { communityComments, communityPosts } from "@repo/drizzle/schema";
import { eq } from "drizzle-orm";
import {
  REACTION_TYPES,
  type ReactionCounts,
  type ReactionType,
  type UserReactionStatus,
} from "../../common/types";
import { ReactionService } from "../../reaction/service";
import {
  COMMUNITY_COMMENT_REACTION_TARGET,
  COMMUNITY_POST_REACTION_TARGET,
  isCommentReactable,
  isPostReactable,
} from "./reaction-visibility";

/**
 * 게시글/댓글 리액션 조회 응답 (PB-COMM-REACTION-API-LIST-001 / BBR-611).
 *
 * - `summary`  : 타입별 리액션 count + 총합.
 * - `viewer`   : 로그인 사용자의 내 리액션 상태(비로그인은 null).
 * - `supportedTypes` : 지원하는 reaction type 목록.
 */
export interface ReactionSummaryResult {
  targetType: typeof COMMUNITY_POST_REACTION_TARGET | typeof COMMUNITY_COMMENT_REACTION_TARGET;
  targetId: string;
  summary: ReactionCounts;
  viewer: UserReactionStatus | null;
  supportedTypes: readonly ReactionType[];
}

/**
 * 커뮤니티 게시글/댓글 리액션 읽기 서비스.
 *
 * polymorphic {@link ReactionService}(Flotter 재사용 base)를 그대로 활용해 count·
 * 내 상태를 집계하되, 커뮤니티 고유의 **노출 정책**(숨김/삭제 대상 비노출, AC#2)을
 * 앞단에 둔다. 비노출 대상은 404 로 응답해 리액션 표면 자체를 숨긴다.
 */
@Injectable()
export class CommunityReactionService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly reactionService: ReactionService,
  ) {}

  /** 지원하는 reaction type 목록. */
  getSupportedTypes(): readonly ReactionType[] {
    return REACTION_TYPES;
  }

  /**
   * 게시글 리액션 요약 + 내 상태. 비공개(미게시/숨김/제거/삭제) 게시글은 404 (AC#2).
   */
  async getPostReactionSummary(postId: string, viewerId?: string): Promise<ReactionSummaryResult> {
    const [post] = await this.db
      .select({ status: communityPosts.status })
      .from(communityPosts)
      .where(eq(communityPosts.id, postId))
      .limit(1);

    if (!post || !isPostReactable(post.status)) {
      throw new NotFoundException("게시글을 찾을 수 없습니다.");
    }

    return this.buildSummary(COMMUNITY_POST_REACTION_TARGET, postId, viewerId);
  }

  /**
   * 댓글 리액션 요약 + 내 상태. 부모 게시글이 비공개이거나 댓글이
   * 삭제/제거/숨김이면 404 (AC#2).
   */
  async getCommentReactionSummary(
    commentId: string,
    viewerId?: string,
  ): Promise<ReactionSummaryResult> {
    const [comment] = await this.db
      .select({
        postId: communityComments.postId,
        isDeleted: communityComments.isDeleted,
        isRemoved: communityComments.isRemoved,
        isHidden: communityComments.isHidden,
      })
      .from(communityComments)
      .where(eq(communityComments.id, commentId))
      .limit(1);

    if (!comment) {
      throw new NotFoundException("댓글을 찾을 수 없습니다.");
    }

    const [post] = await this.db
      .select({ status: communityPosts.status })
      .from(communityPosts)
      .where(eq(communityPosts.id, comment.postId))
      .limit(1);

    const reactable =
      post != null &&
      isCommentReactable({
        postStatus: post.status,
        isDeleted: comment.isDeleted,
        isRemoved: comment.isRemoved,
        isHidden: comment.isHidden,
      });

    if (!reactable) {
      throw new NotFoundException("댓글을 찾을 수 없습니다.");
    }

    return this.buildSummary(COMMUNITY_COMMENT_REACTION_TARGET, commentId, viewerId);
  }

  /** count + viewer 상태를 폴리모픽 ReactionService 로부터 집계한다. */
  private async buildSummary(
    targetType: ReactionSummaryResult["targetType"],
    targetId: string,
    viewerId?: string,
  ): Promise<ReactionSummaryResult> {
    const summary = await this.reactionService.getReactionCounts(targetType, targetId);
    const viewer = viewerId
      ? await this.reactionService.getUserReactionStatus(targetType, targetId, viewerId)
      : null;

    return {
      targetType,
      targetId,
      summary,
      viewer,
      supportedTypes: REACTION_TYPES,
    };
  }
}
