import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import {
  type CommunityHiddenContent,
  communityComments,
  communityHiddenContent,
  communityModLogs,
  communityPosts,
} from "@repo/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { CreateHiddenContentDto } from "../dto";
import {
  buildHiddenKeySet,
  type HiddenTargetType,
  partitionHiddenTargets,
} from "../helpers/hidden-content";
import { assertCommunityPermission } from "../helpers/permission";
import { CommunityService } from "./community.service";

const GLOBAL_HIDE_ROLES = ["owner", "admin", "moderator"] as const;

/**
 * 커뮤니티 콘텐츠 숨김 (PB-COMM-HIDE-API-CREATE-001 / BBR-617).
 *
 * - 사용자별 숨김(scope='user'): community_hidden_content 에 per-viewer 레코드를
 *   적재한다. 본인 시야에서만 목록/상세/댓글/리액션 경로에서 제외된다(AC#2).
 * - 관리자 전역 숨김(scope='global'): 기존 모더레이션 모델을 재사용한다.
 *   게시글 status='hidden', 댓글 is_hidden=true 로 전환하고 mod log 를 남긴다.
 *   사용자별 숨김과 저장소·권한이 명확히 구분된다(AC#1).
 */
@Injectable()
export class CommunityHiddenContentService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly communityService: CommunityService,
  ) {}

  /**
   * 사용자별 숨김. (user, type, id) 유니크로 멱등 — 이미 숨긴 경우 기존 레코드를 반환한다.
   */
  async hideForUser(userId: string, dto: CreateHiddenContentDto): Promise<CommunityHiddenContent> {
    await this.resolveTarget(dto.targetType, dto.targetId);

    const [inserted] = await this.db
      .insert(communityHiddenContent)
      .values({
        userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason ?? null,
      })
      .onConflictDoNothing({
        target: [
          communityHiddenContent.userId,
          communityHiddenContent.targetType,
          communityHiddenContent.targetId,
        ],
      })
      .returning();

    if (inserted) return inserted as CommunityHiddenContent;

    // 충돌(이미 숨김) → 기존 레코드 반환 (멱등)
    const [existing] = await this.db
      .select()
      .from(communityHiddenContent)
      .where(this.userTargetWhere(userId, dto.targetType, dto.targetId))
      .limit(1);

    return existing as CommunityHiddenContent;
  }

  /**
   * 사용자별 숨김 해제. 숨김 기록이 없으면 404.
   */
  async unhideForUser(
    userId: string,
    targetType: HiddenTargetType,
    targetId: string,
  ): Promise<void> {
    const [existing] = await this.db
      .select({ id: communityHiddenContent.id })
      .from(communityHiddenContent)
      .where(this.userTargetWhere(userId, targetType, targetId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException("숨김 기록을 찾을 수 없습니다.");
    }

    await this.db
      .delete(communityHiddenContent)
      .where(this.userTargetWhere(userId, targetType, targetId));
  }

  /**
   * 사용자가 숨긴 콘텐츠 전체 목록 (숨김 관리 UI용).
   */
  async listForUser(userId: string): Promise<CommunityHiddenContent[]> {
    const rows = await this.db
      .select()
      .from(communityHiddenContent)
      .where(eq(communityHiddenContent.userId, userId));

    return rows as CommunityHiddenContent[];
  }

  /**
   * 사용자가 숨긴 게시글 id 목록 (목록 쿼리 notInArray 제외용).
   */
  async getHiddenPostIds(userId: string): Promise<string[]> {
    const rows = await this.listForUser(userId);
    return partitionHiddenTargets(rows).postIds;
  }

  /**
   * 사용자가 숨긴 댓글 id 목록 (댓글 쿼리 notInArray 제외용).
   */
  async getHiddenCommentIds(userId: string): Promise<string[]> {
    const rows = await this.listForUser(userId);
    return partitionHiddenTargets(rows).commentIds;
  }

  /**
   * 단건 노출 제외 판정용 키 집합 (상세/리액션 경로).
   */
  async getHiddenKeys(userId: string): Promise<Set<string>> {
    const rows = await this.listForUser(userId);
    return buildHiddenKeySet(rows);
  }

  /**
   * 뷰어가 해당 대상을 숨겼는지 여부.
   */
  async isHidden(userId: string, targetType: HiddenTargetType, targetId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: communityHiddenContent.id })
      .from(communityHiddenContent)
      .where(this.userTargetWhere(userId, targetType, targetId))
      .limit(1);

    return !!row;
  }

  /**
   * 리액션(투표) 정책: 본인이 숨긴 콘텐츠에는 반응할 수 없다 (AC#2).
   */
  async assertReactable(
    userId: string,
    targetType: HiddenTargetType,
    targetId: string,
  ): Promise<void> {
    if (await this.isHidden(userId, targetType, targetId)) {
      throw new ForbiddenException("숨긴 콘텐츠에는 반응할 수 없습니다.");
    }
  }

  /**
   * 관리자/모더레이터 전역 숨김. 커뮤니티 권한을 검증하고 콘텐츠 상태를 숨김으로
   * 전환한 뒤 mod log 를 남긴다 (사용자별 숨김과 구분되는 운영 경로, AC#1).
   */
  async hideGlobally(
    moderatorId: string,
    dto: CreateHiddenContentDto,
  ): Promise<{ targetType: HiddenTargetType; targetId: string; scope: "global" }> {
    const { communityId } = await this.resolveTarget(dto.targetType, dto.targetId);

    await assertCommunityPermission(this.communityService, moderatorId, communityId, [
      ...GLOBAL_HIDE_ROLES,
    ]);

    const reason = dto.reason ?? "모더레이터 전역 숨김";

    if (dto.targetType === "post") {
      await this.db
        .update(communityPosts)
        .set({
          status: "hidden",
          removalReason: reason,
          removedBy: moderatorId,
          updatedAt: new Date(),
        })
        .where(eq(communityPosts.id, dto.targetId));
    } else {
      await this.db
        .update(communityComments)
        .set({
          isHidden: true,
          removalReason: reason,
          removedBy: moderatorId,
          updatedAt: new Date(),
        })
        .where(eq(communityComments.id, dto.targetId));
    }

    await this.db.insert(communityModLogs).values({
      communityId,
      moderatorId,
      action: "other",
      targetType: dto.targetType,
      targetId: dto.targetId,
      reason: `전역 숨김: ${reason}`,
    });

    return { targetType: dto.targetType, targetId: dto.targetId, scope: "global" };
  }

  /**
   * 숨김 대상(게시글/댓글)의 존재를 확인하고 소속 커뮤니티 id 를 반환한다.
   * 삭제된 대상은 노출 대상이 아니므로 404 로 처리한다.
   */
  private async resolveTarget(
    targetType: HiddenTargetType,
    targetId: string,
  ): Promise<{ communityId: string }> {
    if (targetType === "post") {
      const [post] = await this.db
        .select({ communityId: communityPosts.communityId, status: communityPosts.status })
        .from(communityPosts)
        .where(eq(communityPosts.id, targetId))
        .limit(1);

      if (!post || post.status === "deleted") {
        throw new NotFoundException("게시글을 찾을 수 없습니다.");
      }
      return { communityId: post.communityId };
    }

    const [comment] = await this.db
      .select({ postId: communityComments.postId, isDeleted: communityComments.isDeleted })
      .from(communityComments)
      .where(eq(communityComments.id, targetId))
      .limit(1);

    if (!comment || comment.isDeleted) {
      throw new NotFoundException("댓글을 찾을 수 없습니다.");
    }

    const [post] = await this.db
      .select({ communityId: communityPosts.communityId })
      .from(communityPosts)
      .where(eq(communityPosts.id, comment.postId))
      .limit(1);

    if (!post) {
      throw new NotFoundException("게시글을 찾을 수 없습니다.");
    }
    return { communityId: post.communityId };
  }

  private userTargetWhere(userId: string, targetType: HiddenTargetType, targetId: string) {
    return and(
      eq(communityHiddenContent.userId, userId),
      eq(communityHiddenContent.targetType, targetType),
      eq(communityHiddenContent.targetId, targetId),
    );
  }
}
