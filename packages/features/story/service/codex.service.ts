import { createLogger } from "@repo/core/logger";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import { storyCodex } from "@repo/drizzle/schema";
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, ilike } from "drizzle-orm";
import type { CreateCodexDto, UpdateCodexDto } from "../dto";
import { resolveOrderBy, type SortBy } from "./internal/order-by";

const logger = createLogger("story.codex");

@Injectable()
export class StoryCodexService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  async listCodex(projectId: string, ownerId: string, search?: string, sortBy?: SortBy) {
    const conditions = [
      eq(storyCodex.projectId, projectId),
      eq(storyCodex.ownerId, ownerId),
      eq(storyCodex.isDeleted, false),
    ];
    if (search) conditions.push(ilike(storyCodex.name, `%${search}%`));
    return this.db
      .select()
      .from(storyCodex)
      .where(and(...conditions))
      .orderBy(
        resolveOrderBy(
          {
            name: storyCodex.name,
            updatedAt: storyCodex.updatedAt,
            createdAt: storyCodex.createdAt,
          },
          sortBy,
        ),
      );
  }

  async getCodexEntry(id: string, ownerId: string) {
    const [entry] = await this.db
      .select()
      .from(storyCodex)
      .where(and(eq(storyCodex.id, id), eq(storyCodex.isDeleted, false)))
      .limit(1);
    if (!entry) throw new NotFoundException(`Codex entry not found: ${id}`);
    if (entry.ownerId !== ownerId) throw new ForbiddenException("접근 권한이 없습니다.");
    return entry;
  }

  async createCodexEntry(ownerId: string, data: CreateCodexDto) {
    const [entry] = await this.db
      .insert(storyCodex)
      .values({
        ...(data.id ? { id: data.id } : {}),
        name: data.name,
        description: data.description,
        body: data.body,
        category: data.category,
        projectId: data.projectId,
        ownerId,
      })
      .returning();
    logger.info("Codex entry created", {
      "story.codex_id": entry?.id,
      "story.codex_name": data.name,
      "user.id": ownerId,
    });
    return entry;
  }

  async updateCodexEntry(id: string, ownerId: string, data: UpdateCodexDto) {
    await this.getCodexEntry(id, ownerId);
    const [updated] = await this.db
      .update(storyCodex)
      .set(data)
      .where(eq(storyCodex.id, id))
      .returning();
    logger.info("Codex entry updated", { "story.codex_id": id, "user.id": ownerId });
    return updated;
  }

  async deleteCodexEntry(id: string, ownerId: string) {
    await this.getCodexEntry(id, ownerId);
    await this.db
      .update(storyCodex)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(eq(storyCodex.id, id));
    logger.info("Codex entry deleted", { "story.codex_id": id, "user.id": ownerId });
    return { success: true };
  }
}
