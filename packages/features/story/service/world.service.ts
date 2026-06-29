import { createLogger } from "@repo/core/logger";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import { storyWorlds } from "@repo/drizzle/schema";
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, ilike } from "drizzle-orm";
import type { CreateWorldDto, UpdateWorldDto } from "../dto";
import { resolveOrderBy, type SortBy } from "./internal/order-by";

const logger = createLogger("story.world");

/**
 * Worlds — CRUD + soft-delete + onConflictDoNothing-by-id.
 *
 * Extracted from `story.service.ts` to keep that facade thin. The public API
 * (method names, signatures) mirrors the original `StoryService.{listWorlds,
 * getWorld, createWorld, updateWorld, deleteWorld}` so the facade can simply
 * delegate.
 */
@Injectable()
export class StoryWorldService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  async listWorlds(projectId: string, ownerId: string, search?: string, sortBy?: SortBy) {
    const conditions = [
      eq(storyWorlds.projectId, projectId),
      eq(storyWorlds.ownerId, ownerId),
      eq(storyWorlds.isDeleted, false),
    ];
    if (search) conditions.push(ilike(storyWorlds.name, `%${search}%`));

    return this.db
      .select()
      .from(storyWorlds)
      .where(and(...conditions))
      .orderBy(
        resolveOrderBy(
          {
            name: storyWorlds.name,
            updatedAt: storyWorlds.updatedAt,
            createdAt: storyWorlds.createdAt,
          },
          sortBy,
        ),
      );
  }

  async getWorld(id: string, ownerId: string) {
    const [world] = await this.db
      .select()
      .from(storyWorlds)
      .where(and(eq(storyWorlds.id, id), eq(storyWorlds.isDeleted, false)))
      .limit(1);
    if (!world) throw new NotFoundException(`World not found: ${id}`);
    if (world.ownerId !== ownerId) throw new ForbiddenException("접근 권한이 없습니다.");
    return world;
  }

  async createWorld(ownerId: string, data: CreateWorldDto) {
    // Client UUID가 오면 PK로 사용해 server write 재시도를 idempotent 처리한다.
    // ON CONFLICT DO NOTHING — 같은 id 재진입 시 중복 생성을 막는다.
    const [world] = await this.db
      .insert(storyWorlds)
      .values({
        ...(data.id ? { id: data.id } : {}),
        name: data.name,
        description: data.description,
        body: data.body,
        genre: data.genre,
        projectId: data.projectId,
        ownerId,
      })
      .onConflictDoNothing({ target: storyWorlds.id })
      .returning();
    logger.info("World created", {
      "story.world_id": world?.id,
      "story.world_name": data.name,
      "user.id": ownerId,
    });
    return world;
  }

  async updateWorld(id: string, ownerId: string, data: UpdateWorldDto) {
    await this.getWorld(id, ownerId);
    const [updated] = await this.db
      .update(storyWorlds)
      .set(data)
      .where(eq(storyWorlds.id, id))
      .returning();
    logger.info("World updated", { "story.world_id": id, "user.id": ownerId });
    return updated;
  }

  async deleteWorld(id: string, ownerId: string) {
    await this.getWorld(id, ownerId);
    await this.db
      .update(storyWorlds)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(eq(storyWorlds.id, id));
    logger.info("World deleted", { "story.world_id": id, "user.id": ownerId });
    return { success: true };
  }
}
