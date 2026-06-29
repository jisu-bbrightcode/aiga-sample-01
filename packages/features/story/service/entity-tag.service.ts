import { createLogger } from "@repo/core/logger";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import { storyEntityTags, storyTags } from "@repo/drizzle/schema";
import { Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";

const logger = createLogger("story.entity-tag");

type StoryRelationEntityType =
  | "world"
  | "character"
  | "location"
  | "faction"
  | "codex"
  | "draft";

@Injectable()
export class StoryEntityTagService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  async addEntityTag(entityId: string, entityType: string, tagId: string, id?: string) {
    const [tag] = await this.db
      .select({ projectId: storyTags.projectId })
      .from(storyTags)
      .where(and(eq(storyTags.id, tagId), eq(storyTags.isDeleted, false)))
      .limit(1);
    if (!tag) throw new NotFoundException("Tag not found");

    const [entityTag] = await this.db
      .insert(storyEntityTags)
      .values({
        ...(id ? { id } : {}),
        projectId: tag.projectId,
        entityId,
        entityType: entityType as StoryRelationEntityType,
        tagId,
      })
      .onConflictDoNothing({ target: storyEntityTags.id })
      .returning();
    logger.info("Entity tag added", {
      "story.entity_id": entityId,
      "story.entity_type": entityType,
      "story.tag_id": tagId,
    });
    return entityTag;
  }

  async removeEntityTag(id: string) {
    await this.db
      .update(storyEntityTags)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(eq(storyEntityTags.id, id));
    return { success: true };
  }

  async getEntityTags(entityId: string, entityType: string) {
    return this.db
      .select({
        id: storyEntityTags.id,
        projectId: storyEntityTags.projectId,
        entityId: storyEntityTags.entityId,
        entityType: storyEntityTags.entityType,
        tagId: storyEntityTags.tagId,
        createdAt: storyEntityTags.createdAt,
        tag: {
          id: storyTags.id,
          name: storyTags.name,
          color: storyTags.color,
        },
      })
      .from(storyEntityTags)
      .leftJoin(storyTags, eq(storyEntityTags.tagId, storyTags.id))
      .where(
        and(
          eq(storyEntityTags.entityId, entityId),
          eq(storyEntityTags.entityType, entityType as StoryRelationEntityType),
          eq(storyEntityTags.isDeleted, false),
        ),
      );
  }
}
