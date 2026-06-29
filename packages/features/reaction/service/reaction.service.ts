import { Inject, Injectable } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { DRIZZLE_TOKEN } from "@repo/drizzle";
import { reactions } from "@repo/drizzle/schema";
import { and, count, eq, inArray } from "drizzle-orm";
import type {
  ReactionCounts,
  ReactionType,
  ToggleReactionResult,
  UserReactionStatus,
} from "../../common/types";

@Injectable()
export class ReactionService {
  constructor(
		@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDB
	) {}

  /**
   * Toggle reaction
   */
  async toggle(
    targetType: string,
    targetId: string,
    userId: string,
    type: ReactionType = "like",
  ): Promise<ToggleReactionResult> {
    const [existing] = await this.db
      .select()
      .from(reactions)
      .where(
        and(
          eq(reactions.targetType, targetType),
          eq(reactions.targetId, targetId),
          eq(reactions.userId, userId),
          eq(reactions.type, type),
        ),
      )
      .limit(1);

    if (existing) {
      await this.db.delete(reactions).where(eq(reactions.id, existing.id));
      return { added: false, type };
    }

    await this.db.insert(reactions).values({
      targetType,
      targetId,
      userId,
      type,
    });

    return { added: true, type };
  }

  /**
   * Get reaction counts by type
   */
  async getReactionCounts(targetType: string, targetId: string): Promise<ReactionCounts> {
    const results = await this.db
      .select({
        type: reactions.type,
        count: count(),
      })
      .from(reactions)
      .where(and(eq(reactions.targetType, targetType), eq(reactions.targetId, targetId)))
      .groupBy(reactions.type);

    const byType = results.map((r) => ({
      type: r.type as ReactionType,
      count: Number(r.count),
    }));

    const total = byType.reduce((sum, r) => sum + r.count, 0);

    return { total, byType };
  }

  /**
   * Get reaction counts for multiple targets
   */
  async getReactionCountsBatch(
    targetType: string,
    targetIds: string[],
  ): Promise<Map<string, ReactionCounts>> {
    if (targetIds.length === 0) {
      return new Map();
    }

    const results = await this.db
      .select({
        targetId: reactions.targetId,
        type: reactions.type,
        count: count(),
      })
      .from(reactions)
      .where(and(eq(reactions.targetType, targetType), inArray(reactions.targetId, targetIds)))
      .groupBy(reactions.targetId, reactions.type);

    const countsMap = new Map<string, ReactionCounts>();

    for (const id of targetIds) {
      countsMap.set(id, { total: 0, byType: [] });
    }

    for (const r of results) {
      const existing = countsMap.get(r.targetId) ?? { total: 0, byType: [] };
      existing.byType.push({
        type: r.type as ReactionType,
        count: Number(r.count),
      });
      existing.total += Number(r.count);
      countsMap.set(r.targetId, existing);
    }

    return countsMap;
  }

  /**
   * Get user reaction status
   */
  async getUserReactionStatus(
    targetType: string,
    targetId: string,
    userId: string,
  ): Promise<UserReactionStatus> {
    const userReactions = await this.db
      .select({ type: reactions.type })
      .from(reactions)
      .where(
        and(
          eq(reactions.targetType, targetType),
          eq(reactions.targetId, targetId),
          eq(reactions.userId, userId),
        ),
      );

    return {
      hasReacted: userReactions.length > 0,
      types: userReactions.map((r) => r.type as ReactionType),
    };
  }

  /**
   * Get user reaction status for multiple targets
   */
  async getUserReactionStatusBatch(
    targetType: string,
    targetIds: string[],
    userId: string,
  ): Promise<Map<string, UserReactionStatus>> {
    if (targetIds.length === 0) {
      return new Map();
    }

    const results = await this.db
      .select({
        targetId: reactions.targetId,
        type: reactions.type,
      })
      .from(reactions)
      .where(
        and(
          eq(reactions.targetType, targetType),
          eq(reactions.userId, userId),
          inArray(reactions.targetId, targetIds),
        ),
      );

    const statusMap = new Map<string, UserReactionStatus>();

    for (const id of targetIds) {
      statusMap.set(id, { hasReacted: false, types: [] });
    }

    for (const r of results) {
      const existing = statusMap.get(r.targetId) ?? {
        hasReacted: false,
        types: [],
      };
      existing.hasReacted = true;
      existing.types.push(r.type as ReactionType);
      statusMap.set(r.targetId, existing);
    }

    return statusMap;
  }

  /**
   * Delete all reactions for a target (called when target is deleted)
   */
  async deleteAllForTarget(targetType: string, targetId: string): Promise<void> {
    await this.db
      .delete(reactions)
      .where(and(eq(reactions.targetType, targetType), eq(reactions.targetId, targetId)));
  }
}
