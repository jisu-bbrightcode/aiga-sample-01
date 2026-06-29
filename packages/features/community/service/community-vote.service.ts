import { Injectable } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import {
  type CommunityVote,
  communityComments,
  communityPosts,
  communityVotes,
  userKarma,
} from "@repo/drizzle/schema";
import { and, eq, sql } from "drizzle-orm";
import type { RemoveVoteDto, VoteDto } from "../dto";

export interface VoteResult {
  voteScore: number;
  upvoteCount: number;
  downvoteCount: number;
  userVote: number | null;
}

@Injectable()
export class CommunityVoteService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  async vote(dto: VoteDto, userId: string): Promise<VoteResult> {
    const existingVote = await this.findVote(userId, dto.targetType, dto.targetId);

    if (existingVote) {
      if (existingVote.vote === dto.vote) {
        return this.getVoteResult(dto.targetType, dto.targetId, userId);
      }

      await this.db
        .update(communityVotes)
        .set({
          vote: dto.vote,
          updatedAt: new Date(),
        })
        .where(eq(communityVotes.id, existingVote.id));

      const flipUp = dto.vote === 1 ? 1 : -1;
      const flipDown = dto.vote === -1 ? 1 : -1;
      await this.updateVoteScore(dto.targetType, dto.targetId, dto.vote * 2, flipUp, flipDown);
    } else {
      await this.db.insert(communityVotes).values({
        userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        vote: dto.vote,
      });

      const newUp = dto.vote === 1 ? 1 : 0;
      const newDown = dto.vote === -1 ? 1 : 0;
      await this.updateVoteScore(dto.targetType, dto.targetId, dto.vote, newUp, newDown);
    }

    await this.updateKarma(dto.targetType, dto.targetId, userId);

    return this.getVoteResult(dto.targetType, dto.targetId, userId);
  }

  async removeVote(dto: RemoveVoteDto, userId: string): Promise<VoteResult> {
    const existingVote = await this.findVote(userId, dto.targetType, dto.targetId);

    if (existingVote) {
      await this.db
        .delete(communityVotes)
        .where(
          and(
            eq(communityVotes.userId, userId),
            eq(communityVotes.targetType, dto.targetType),
            eq(communityVotes.targetId, dto.targetId),
          ),
        );

      const removeUp = existingVote.vote === 1 ? -1 : 0;
      const removeDown = existingVote.vote === -1 ? -1 : 0;
      await this.updateVoteScore(
        dto.targetType,
        dto.targetId,
        -existingVote.vote,
        removeUp,
        removeDown,
      );

      await this.updateKarma(dto.targetType, dto.targetId, userId);
    }

    return this.getVoteResult(dto.targetType, dto.targetId, userId);
  }

  private async findVote(
    userId: string,
    targetType: "post" | "comment",
    targetId: string,
  ): Promise<CommunityVote | null> {
    const [result] = await this.db
      .select()
      .from(communityVotes)
      .where(
        and(
          eq(communityVotes.userId, userId),
          eq(communityVotes.targetType, targetType),
          eq(communityVotes.targetId, targetId),
        ),
      )
      .limit(1);

    return (result as CommunityVote) ?? null;
  }

  private async updateVoteScore(
    targetType: "post" | "comment",
    targetId: string,
    scoreDelta: number,
    upDelta: number,
    downDelta: number,
  ): Promise<void> {
    if (targetType === "post") {
      await this.db
        .update(communityPosts)
        .set({
          upvoteCount: sql`GREATEST(0, ${communityPosts.upvoteCount} + ${upDelta})`,
          downvoteCount: sql`GREATEST(0, ${communityPosts.downvoteCount} + ${downDelta})`,
          voteScore: sql`${communityPosts.voteScore} + ${scoreDelta}`,
        })
        .where(eq(communityPosts.id, targetId));

      const [post] = await this.db
        .select()
        .from(communityPosts)
        .where(eq(communityPosts.id, targetId))
        .limit(1);

      if (post) {
        const hotScore = this.calculateHotScore(post.voteScore, post.createdAt);
        await this.db
          .update(communityPosts)
          .set({ hotScore })
          .where(eq(communityPosts.id, targetId));
      }
    } else {
      await this.db
        .update(communityComments)
        .set({
          upvoteCount: sql`GREATEST(0, ${communityComments.upvoteCount} + ${upDelta})`,
          downvoteCount: sql`GREATEST(0, ${communityComments.downvoteCount} + ${downDelta})`,
          voteScore: sql`${communityComments.voteScore} + ${scoreDelta}`,
        })
        .where(eq(communityComments.id, targetId));
    }
  }

  private async updateKarma(
    targetType: "post" | "comment",
    targetId: string,
    _voterId: string,
  ): Promise<void> {
    let authorId: string | undefined;

    if (targetType === "post") {
      const [post] = await this.db
        .select()
        .from(communityPosts)
        .where(eq(communityPosts.id, targetId))
        .limit(1);
      authorId = post?.authorId;
    } else {
      const [comment] = await this.db
        .select()
        .from(communityComments)
        .where(eq(communityComments.id, targetId))
        .limit(1);
      authorId = comment?.authorId;
    }

    if (!authorId) return;

    const [posts] = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(${communityPosts.voteScore}), 0)`,
      })
      .from(communityPosts)
      .where(eq(communityPosts.authorId, authorId));

    const [comments] = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(${communityComments.voteScore}), 0)`,
      })
      .from(communityComments)
      .where(eq(communityComments.authorId, authorId));

    const postKarma = Number(posts?.total ?? 0);
    const commentKarma = Number(comments?.total ?? 0);
    const totalKarma = postKarma + commentKarma;

    await this.db
      .insert(userKarma)
      .values({
        userId: authorId,
        postKarma,
        commentKarma,
        totalKarma,
      })
      .onConflictDoUpdate({
        target: userKarma.userId,
        set: {
          postKarma,
          commentKarma,
          totalKarma,
          updatedAt: new Date(),
        },
      });
  }

  private async getVoteResult(
    targetType: "post" | "comment",
    targetId: string,
    userId: string,
  ): Promise<VoteResult> {
    const userVote = await this.findVote(userId, targetType, targetId);

    if (targetType === "post") {
      const [post] = await this.db
        .select()
        .from(communityPosts)
        .where(eq(communityPosts.id, targetId))
        .limit(1);

      return {
        voteScore: post?.voteScore ?? 0,
        upvoteCount: post?.upvoteCount ?? 0,
        downvoteCount: post?.downvoteCount ?? 0,
        userVote: userVote?.vote ?? null,
      };
    }
    const [comment] = await this.db
      .select()
      .from(communityComments)
      .where(eq(communityComments.id, targetId))
      .limit(1);

    return {
      voteScore: comment?.voteScore ?? 0,
      upvoteCount: comment?.upvoteCount ?? 0,
      downvoteCount: comment?.downvoteCount ?? 0,
      userVote: userVote?.vote ?? null,
    };
  }

  private calculateHotScore(voteScore: number, createdAt: Date): number {
    const score = voteScore;
    const order = Math.log10(Math.max(Math.abs(score), 1));
    const sign = score > 0 ? 1 : score < 0 ? -1 : 0;
    const seconds = (createdAt.getTime() - new Date("2005-12-08").getTime()) / 1000;

    return sign * order + seconds / 45000;
  }
}
