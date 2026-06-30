import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import {
  type CommunityPost,
  communityPollVotes,
  communityPosts,
  type PollData,
} from "@repo/drizzle/schema";
import { and, eq, sql } from "drizzle-orm";
import { CommunityService } from "./community.service";
import {
  buildPollView,
  canViewPollResults,
  isPollClosed,
  type PollSelectionErrorCode,
  type PollView,
  rebuildPollOptionCounts,
  validatePollSelection,
} from "./poll-policy";

const SELECTION_ERROR_MESSAGES: Record<PollSelectionErrorCode, string> = {
  empty: "투표할 항목을 선택해 주세요.",
  unknown_option: "유효하지 않은 투표 항목입니다.",
  multiple_not_allowed: "이 투표는 하나의 항목만 선택할 수 있습니다.",
  duplicate_option: "같은 항목을 중복으로 선택할 수 없습니다.",
};

interface PollPost extends CommunityPost {
  pollData: PollData;
}

/**
 * CommunityPollService — 게시글 투표(poll) cast / remove / 결과 조회.
 *
 * `community_poll_votes`가 (게시글, 사용자, 선택지) 단위 투표의 권위 소스이며,
 * 매 변경마다 집계 카운트를 `communityPosts.pollData` 캐시에 immutable하게 재기록한다.
 * 종료/삭제/숨김/차단 상태는 게시글 정책과 동일하게 다룬다(AC#2).
 */
@Injectable()
export class CommunityPollService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly communityService: CommunityService,
  ) {}

  /** 투표 결과 + 본인 선택 조회. 비로그인 허용(결과는 공개 정책에 따름). */
  async getPoll(postId: string, userId?: string): Promise<PollView> {
    const post = await this.loadPollPost(postId);
    const userVotedOptionIds = userId ? await this.getUserOptionIds(postId, userId) : [];
    return this.buildView(post, userId, userVotedOptionIds);
  }

  /** 투표하기. 중복 투표 차단(AC#1), 종료/잠금/미가입/차단 상태 검증(AC#2). */
  async castVote(postId: string, userId: string, optionIds: string[]): Promise<PollView> {
    const post = await this.loadPollPost(postId);

    // 차단(밴) 일관성: 밴된 멤버는 isMember=false → 투표 불가.
    const isMember = await this.communityService.isMember(post.communityId, userId);
    if (!isMember) {
      throw new ForbiddenException("커뮤니티에 가입한 회원만 투표할 수 있습니다.");
    }

    if (post.isLocked) {
      throw new ForbiddenException("잠긴 게시글에는 투표할 수 없습니다.");
    }

    if (isPollClosed(post.pollData, new Date())) {
      throw new ConflictException("이미 종료된 투표입니다.");
    }

    const cleanIds = this.normalizeOptionIds(optionIds);
    const validation = validatePollSelection(post.pollData, cleanIds);
    if (!validation.ok) {
      throw new BadRequestException(SELECTION_ERROR_MESSAGES[validation.code]);
    }

    const existing = await this.getUserOptionIds(postId, userId);

    // 중복 투표 방지(AC#1).
    if (!post.pollData.multipleChoice && existing.length > 0) {
      throw new ConflictException("이미 투표하셨습니다. 다시 투표하려면 기존 투표를 취소해 주세요.");
    }
    const newIds = cleanIds.filter((id) => !existing.includes(id));
    if (newIds.length === 0) {
      throw new ConflictException("이미 선택한 항목입니다.");
    }

    await this.db.insert(communityPollVotes).values(
      newIds.map((optionId) => ({
        postId,
        userId,
        optionId,
      })),
    );

    const synced = await this.syncCountCache(post);
    return this.buildView(synced, userId, [...existing, ...newIds]);
  }

  /** 투표 취소(본인 표 전체 제거). 표가 없으면 현재 상태를 그대로 반환(no-op). */
  async removeVote(postId: string, userId: string): Promise<PollView> {
    const post = await this.loadPollPost(postId);

    if (isPollClosed(post.pollData, new Date())) {
      throw new ConflictException("종료된 투표는 취소할 수 없습니다.");
    }

    const existing = await this.getUserOptionIds(postId, userId);
    if (existing.length === 0) {
      return this.buildView(post, userId, []);
    }

    await this.db
      .delete(communityPollVotes)
      .where(and(eq(communityPollVotes.postId, postId), eq(communityPollVotes.userId, userId)));

    const synced = await this.syncCountCache(post);
    return this.buildView(synced, userId, []);
  }

  // --------------------------------------------------------------------------

  private normalizeOptionIds(optionIds: string[]): string[] {
    if (!Array.isArray(optionIds)) return [];
    return optionIds.filter((id): id is string => typeof id === "string" && id.length > 0);
  }

  private async loadPollPost(postId: string): Promise<PollPost> {
    const [row] = await this.db
      .select()
      .from(communityPosts)
      .where(eq(communityPosts.id, postId))
      .limit(1);

    const post = row as CommunityPost | undefined;
    if (!post) {
      throw new NotFoundException("게시글을 찾을 수 없습니다.");
    }

    // 삭제/숨김/제거/임시 상태는 게시글 정책과 동일하게 비공개 처리(no-leak).
    if (post.status !== "published") {
      throw new NotFoundException("게시글을 찾을 수 없습니다.");
    }

    if (post.type !== "poll" || !post.pollData || post.pollData.options.length === 0) {
      throw new BadRequestException("투표 게시글이 아닙니다.");
    }

    return post as PollPost;
  }

  private async getUserOptionIds(postId: string, userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ optionId: communityPollVotes.optionId })
      .from(communityPollVotes)
      .where(and(eq(communityPollVotes.postId, postId), eq(communityPollVotes.userId, userId)));
    return rows.map((r) => r.optionId);
  }

  private async aggregateCounts(postId: string): Promise<Map<string, number>> {
    const rows = await this.db
      .select({
        optionId: communityPollVotes.optionId,
        count: sql<number>`count(*)`,
      })
      .from(communityPollVotes)
      .where(eq(communityPollVotes.postId, postId))
      .groupBy(communityPollVotes.optionId);
    return new Map(rows.map((r) => [r.optionId, Number(r.count)]));
  }

  /** poll_votes 집계로 jsonb 캐시를 재기록하고 갱신된 게시글을 반환한다. */
  private async syncCountCache(post: PollPost): Promise<PollPost> {
    const counts = await this.aggregateCounts(post.id);
    const updatedPoll = rebuildPollOptionCounts(post.pollData, counts);
    await this.db
      .update(communityPosts)
      .set({ pollData: updatedPoll })
      .where(eq(communityPosts.id, post.id));
    return { ...post, pollData: updatedPoll };
  }

  private async buildView(
    post: PollPost,
    userId: string | undefined,
    userVotedOptionIds: string[],
  ): Promise<PollView> {
    const closed = isPollClosed(post.pollData, new Date());
    const canModerate = userId ? await this.canModerate(post, userId) : false;
    const resultsVisible = canViewPollResults({
      closed,
      hasVoted: userVotedOptionIds.length > 0,
      canModerate,
    });
    return buildPollView({
      poll: post.pollData,
      closed,
      resultsVisible,
      userVotedOptionIds,
    });
  }

  private async canModerate(post: PollPost, userId: string): Promise<boolean> {
    if (post.authorId === userId) return true;
    return await this.communityService.isModerator(post.communityId, userId);
  }
}
