import { createLogger } from "@repo/core/logger";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import { storyTags } from "@repo/drizzle/schema";
import { Injectable } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import type { CreateTagDto } from "../dto";

const logger = createLogger("story.tag");

@Injectable()
export class StoryTagService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  async listTags(projectId: string) {
    return this.db
      .select()
      .from(storyTags)
      .where(and(eq(storyTags.projectId, projectId), eq(storyTags.isDeleted, false)))
      .orderBy(asc(storyTags.name));
  }

  async createTag(data: CreateTagDto) {
    // Same-name dedupe per project — surface the existing tag instead of
    // duplicating rows on repeated server writes.
    const [existing] = await this.db
      .select()
      .from(storyTags)
      .where(
        and(
          eq(storyTags.projectId, data.projectId),
          eq(storyTags.name, data.name),
          eq(storyTags.isDeleted, false),
        ),
      )
      .limit(1);
    if (existing) return existing;

    const [tag] = await this.db
      .insert(storyTags)
      .values({
        ...(data.id ? { id: data.id } : {}),
        name: data.name,
        color: data.color,
        projectId: data.projectId,
      })
      .returning();
    logger.info("Tag created", { "story.tag_id": tag?.id, "story.tag_name": data.name });
    return tag;
  }

  async deleteTag(id: string) {
    await this.db
      .update(storyTags)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(eq(storyTags.id, id));
    logger.info("Tag deleted", { "story.tag_id": id });
    return { success: true };
  }
}
