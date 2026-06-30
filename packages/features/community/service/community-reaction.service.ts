import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import { communityComments, communityPosts } from "@repo/drizzle/schema";
import { ReactionService } from "@repo/features/reaction";
import { eq } from "drizzle-orm";
import type { SetReactionResult } from "../../common/types";
import type { SetReactionDto } from "../dto";
import { CommunityBlockService } from "./community-block.service";
import { CommunityHiddenContentService } from "./community-hidden-content.service";

/**
 * 커뮤니티 리액션 set (생성/변경) — PB-COMM-REACTION-API-SET-001 / BBR-612.
 *
 * 범용 ReactionService.set 의 단일 리액션 보장(중복 방지 / 타입 변경 / idempotency,
 * AC#1)을 재사용하고, 커뮤니티 고유의 가시성 게이트(차단/숨김/삭제 대상 차단, AC#2)를
 * 델타로 추가한다. 저장은 범용 reaction 테이블을 사용하되, 다른 도메인과 섞이지 않도록
 * targetType 을 `community_post` / `community_comment` 로 네임스페이싱한다.
 */
@Injectable()
export class CommunityReactionService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly reactionService: ReactionService,
    private readonly hiddenContentService: CommunityHiddenContentService,
    private readonly blockService: CommunityBlockService,
  ) {}

  private static readonly STORAGE_TARGET_TYPE = {
    post: "community_post",
    comment: "community_comment",
  } as const;

  async set(userId: string, dto: SetReactionDto): Promise<SetReactionResult> {
    await this.assertReactableTarget(userId, dto.targetType, dto.targetId);

    return this.reactionService.set(
      CommunityReactionService.STORAGE_TARGET_TYPE[dto.targetType],
      dto.targetId,
      userId,
      dto.type ?? "like",
    );
  }

  /**
   * AC#2: 차단/숨김/삭제 대상에는 리액션을 추가할 수 없다.
   *
   * - 삭제/제거된 대상(또는 존재하지 않는 대상): 누출 없이 404.
   * - 전역 숨김(게시글 status='hidden' / 댓글 is_hidden) 및 미공개 draft: 403.
   * - 본인이 숨긴 대상(per-viewer mute): 403.
   * - 본인이 차단한 작성자의 대상: 403.
   */
  private async assertReactableTarget(
    userId: string,
    targetType: SetReactionDto["targetType"],
    targetId: string,
  ): Promise<void> {
    const authorId = await this.resolveReactableAuthor(targetType, targetId);

    if (await this.hiddenContentService.isHidden(userId, targetType, targetId)) {
      throw new ForbiddenException("숨긴 콘텐츠에는 반응할 수 없습니다.");
    }

    if (await this.blockService.isBlocked(userId, authorId)) {
      throw new ForbiddenException("차단한 사용자의 콘텐츠에는 반응할 수 없습니다.");
    }
  }

  /**
   * 대상을 조회하고 반응 가능 상태인지 검증한 뒤 작성자 id 를 반환한다.
   */
  private async resolveReactableAuthor(
    targetType: SetReactionDto["targetType"],
    targetId: string,
  ): Promise<string> {
    if (targetType === "post") {
      const [post] = await this.db
        .select({ status: communityPosts.status, authorId: communityPosts.authorId })
        .from(communityPosts)
        .where(eq(communityPosts.id, targetId))
        .limit(1);

      if (!post || post.status === "deleted" || post.status === "removed") {
        throw new NotFoundException("대상 게시글을 찾을 수 없습니다.");
      }
      if (post.status === "hidden") {
        throw new ForbiddenException("숨김 처리된 게시글에는 반응할 수 없습니다.");
      }
      if (post.status === "draft") {
        throw new ForbiddenException("공개되지 않은 게시글에는 반응할 수 없습니다.");
      }
      return post.authorId;
    }

    const [comment] = await this.db
      .select({
        isDeleted: communityComments.isDeleted,
        isRemoved: communityComments.isRemoved,
        isHidden: communityComments.isHidden,
        authorId: communityComments.authorId,
      })
      .from(communityComments)
      .where(eq(communityComments.id, targetId))
      .limit(1);

    if (!comment || comment.isDeleted || comment.isRemoved) {
      throw new NotFoundException("대상 댓글을 찾을 수 없습니다.");
    }
    if (comment.isHidden) {
      throw new ForbiddenException("숨김 처리된 댓글에는 반응할 수 없습니다.");
    }
    return comment.authorId;
  }
}
