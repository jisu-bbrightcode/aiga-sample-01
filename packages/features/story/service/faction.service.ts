import { createLogger } from "@repo/core/logger";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import { storyFactions } from "@repo/drizzle/schema";
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, ilike } from "drizzle-orm";
import type { CreateFactionDto, UpdateFactionDto } from "../dto";
import { resolveOrderBy, type SortBy } from "./internal/order-by";

const logger = createLogger("story.faction");

@Injectable()
export class StoryFactionService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  async listFactions(projectId: string, ownerId: string, search?: string, sortBy?: SortBy) {
    const conditions = [
      eq(storyFactions.projectId, projectId),
      eq(storyFactions.ownerId, ownerId),
      eq(storyFactions.isDeleted, false),
    ];
    if (search) conditions.push(ilike(storyFactions.name, `%${search}%`));
    return this.db
      .select()
      .from(storyFactions)
      .where(and(...conditions))
      .orderBy(
        resolveOrderBy(
          {
            name: storyFactions.name,
            updatedAt: storyFactions.updatedAt,
            createdAt: storyFactions.createdAt,
          },
          sortBy,
        ),
      );
  }

  async getFaction(id: string, ownerId: string) {
    const [faction] = await this.db
      .select()
      .from(storyFactions)
      .where(and(eq(storyFactions.id, id), eq(storyFactions.isDeleted, false)))
      .limit(1);
    if (!faction) throw new NotFoundException(`Faction not found: ${id}`);
    if (faction.ownerId !== ownerId) throw new ForbiddenException("접근 권한이 없습니다.");
    return faction;
  }

  async createFaction(ownerId: string, data: CreateFactionDto) {
    const [faction] = await this.db
      .insert(storyFactions)
      .values({
        ...(data.id ? { id: data.id } : {}),
        name: data.name,
        description: data.description,
        body: data.body,
        goal: data.goal,
        influence: data.influence,
        projectId: data.projectId,
        ownerId,
      })
      .returning();
    logger.info("Faction created", {
      "story.faction_id": faction?.id,
      "story.faction_name": data.name,
      "user.id": ownerId,
    });
    return faction;
  }

  async updateFaction(id: string, ownerId: string, data: UpdateFactionDto) {
    await this.getFaction(id, ownerId);
    const [updated] = await this.db
      .update(storyFactions)
      .set(data)
      .where(eq(storyFactions.id, id))
      .returning();
    logger.info("Faction updated", { "story.faction_id": id, "user.id": ownerId });
    return updated;
  }

  async deleteFaction(id: string, ownerId: string) {
    await this.getFaction(id, ownerId);
    await this.db
      .update(storyFactions)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(eq(storyFactions.id, id));
    logger.info("Faction deleted", { "story.faction_id": id, "user.id": ownerId });
    return { success: true };
  }
}
