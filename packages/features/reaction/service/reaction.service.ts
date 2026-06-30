import { Inject, Injectable } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { DRIZZLE_TOKEN } from "@repo/drizzle";
import { reactions } from "@repo/drizzle/schema";
import { and, count, eq, inArray } from "drizzle-orm";
import type {
  ReactionCounts,
  ReactionType,
  RemoveReactionResult,
  SetReactionResult,
  ToggleReactionResult,
  UserReactionStatus,
} from "../../common/types";

@Injectable()
export class ReactionService {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDB) {}

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
   * Set (create or change) the current user's reaction on a target — a single
   * authoritative reaction per (user, target).
   *
   * This is the "set" semantics that backs PUT-style endpoints, distinct from
   * `toggle` (which lets a user hold multiple reaction types at once):
   *
   * - 중복 방지: at most one row per (targetType, targetId, userId). A second
   *   call never creates a duplicate — an existing reaction is changed in place.
   * - 타입 변경: switching type updates the existing row rather than inserting.
   * - idempotency: setting the same type the user already has is a no-op that
   *   returns `changed: false` with unchanged, freshly-derived counts.
   *
   * Visibility/permission gating (blocked/hidden/deleted targets) is the
   * caller's responsibility — this method only owns the storage invariant.
   */
  async set(
    targetType: string,
    targetId: string,
    userId: string,
    type: ReactionType = "like",
  ): Promise<SetReactionResult> {
    const [existing] = await this.db
      .select()
      .from(reactions)
      .where(
        and(
          eq(reactions.targetType, targetType),
          eq(reactions.targetId, targetId),
          eq(reactions.userId, userId),
        ),
      )
      .limit(1);

    if (existing) {
      if (existing.type === type) {
        const counts = await this.getReactionCounts(targetType, targetId);
        return { type, changed: false, counts };
      }

      // Update the existing row in place so the (user, target) pair can never
      // hold two reactions — duplicate prevention by construction.
      await this.db
        .update(reactions)
        .set({ type, updatedAt: new Date() })
        .where(eq(reactions.id, existing.id));

      const counts = await this.getReactionCounts(targetType, targetId);
      return { type, changed: true, counts };
    }

    await this.db.insert(reactions).values({
      targetType,
      targetId,
      userId,
      type,
    });

    const counts = await this.getReactionCounts(targetType, targetId);
    return { type, changed: true, counts };
  }

  /**
   * Remove (cancel) the current user's reaction on a target — idempotent.
   *
   * Scoped to `userId`, so a caller can only ever delete their own reaction
   * (a user can never cancel another user's reaction).
   *
   * Idempotent: calling repeatedly leaves the target in the same removed
   * state. The second call simply deletes 0 rows (`removed: false`). Because
   * counts are derived via aggregation (no denormalized counter column), the
   * returned count can never drift or go negative no matter how many times
   * delete is called.
   *
   * @param type - when provided, only that reaction type is removed; when
   *   omitted, every reaction this user has on the target is removed.
   */
  async remove(
    targetType: string,
    targetId: string,
    userId: string,
    type?: ReactionType,
  ): Promise<RemoveReactionResult> {
    const conditions = [
      eq(reactions.targetType, targetType),
      eq(reactions.targetId, targetId),
      eq(reactions.userId, userId),
    ];

    if (type) {
      conditions.push(eq(reactions.type, type));
    }

    const deleted = await this.db
      .delete(reactions)
      .where(and(...conditions))
      .returning({ id: reactions.id });

    const counts = await this.getReactionCounts(targetType, targetId);

    return { removed: deleted.length > 0, counts };
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
