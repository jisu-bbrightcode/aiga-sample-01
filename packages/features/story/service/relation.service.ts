import { createLogger } from "@repo/core/logger";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import {
  storyCharacters,
  storyCodex,
  storyDrafts,
  storyFactions,
  storyLocations,
  storyRelations,
  storyWorlds,
} from "@repo/drizzle/schema";
import { Injectable } from "@nestjs/common";
import { and, eq, or } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import type { CreateRelationDto } from "../dto";

const logger = createLogger("story.relation");

type StoryRelationEntityType =
  | "world"
  | "character"
  | "location"
  | "faction"
  | "codex"
  | "draft";

/**
 * `entityType → { table, nameCol }` dispatch used by `getEntityName`.
 * Replaces the 7-way switch from the original service; new entity types
 * extend this map without touching the relation logic.
 */
const ENTITY_NAME_SOURCES: Record<string, { table: PgTable; nameCol: AnyPgColumn }> = {
  world: { table: storyWorlds, nameCol: storyWorlds.name },
  character: { table: storyCharacters, nameCol: storyCharacters.name },
  location: { table: storyLocations, nameCol: storyLocations.name },
  faction: { table: storyFactions, nameCol: storyFactions.name },
  codex: { table: storyCodex, nameCol: storyCodex.name },
  draft: { table: storyDrafts, nameCol: storyDrafts.title },
};

@Injectable()
export class StoryRelationService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  async listRelations(entityId: string, entityType: string) {
    const sourceRelations = await this.db
      .select()
      .from(storyRelations)
      .where(
        and(
          eq(storyRelations.sourceId, entityId),
          eq(storyRelations.sourceType, entityType as StoryRelationEntityType),
          eq(storyRelations.isDeleted, false),
        ),
      );
    const targetRelations = await this.db
      .select()
      .from(storyRelations)
      .where(
        and(
          eq(storyRelations.targetId, entityId),
          eq(storyRelations.targetType, entityType as StoryRelationEntityType),
          eq(storyRelations.isDeleted, false),
        ),
      );
    const normalized = [
      ...sourceRelations.map((r) => ({
        ...r,
        targetEntityId: r.targetId,
        targetEntityType: r.targetType,
      })),
      ...targetRelations.map((r) => ({
        ...r,
        targetEntityId: r.sourceId,
        targetEntityType: r.sourceType,
      })),
    ];
    return Promise.all(
      normalized.map(async (r) => ({
        ...r,
        targetEntityName: await this.getEntityName(r.targetEntityId, r.targetEntityType),
      })),
    );
  }

  private async getEntityName(id: string, type: string): Promise<string | null> {
    const entry = ENTITY_NAME_SOURCES[type];
    if (!entry) return null;
    const [row] = await this.db
      .select({ name: entry.nameCol })
      .from(entry.table)
      .where(eq((entry.table as unknown as { id: AnyPgColumn }).id, id))
      .limit(1);
    return (row?.name as string | null) ?? null;
  }

  async createRelation(data: CreateRelationDto) {
    // Pair dedupe: a relation between the same two entity IDs (in either
    // direction) should only exist once. Surface the existing row instead
    // of duplicating so repeated server writes stay idempotent.
    const [existing] = await this.db
      .select()
      .from(storyRelations)
      .where(
        and(
          eq(storyRelations.isDeleted, false),
          or(
            and(
              eq(storyRelations.sourceId, data.sourceId),
              eq(storyRelations.targetId, data.targetId),
            ),
            and(
              eq(storyRelations.sourceId, data.targetId),
              eq(storyRelations.targetId, data.sourceId),
            ),
          ),
        ),
      )
      .limit(1);
    if (existing) return existing;

    const [relation] = await this.db
      .insert(storyRelations)
      .values({
        ...(data.id ? { id: data.id } : {}),
        sourceId: data.sourceId,
        sourceType: data.sourceType,
        targetId: data.targetId,
        targetType: data.targetType,
        label: data.label,
        projectId: data.projectId,
      })
      .returning();
    logger.info("Relation created", {
      "story.relation_id": relation?.id,
      "story.source_id": data.sourceId,
      "story.target_id": data.targetId,
    });
    return relation;
  }

  async deleteRelation(id: string) {
    await this.db
      .update(storyRelations)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(eq(storyRelations.id, id));
    logger.info("Relation deleted", { "story.relation_id": id });
    return { success: true };
  }
}
