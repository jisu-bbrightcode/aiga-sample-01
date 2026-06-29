import { createLogger } from "@repo/core/logger";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import { storyLocations } from "@repo/drizzle/schema";
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, ilike } from "drizzle-orm";
import type { CreateLocationDto, UpdateLocationDto } from "../dto";
import { resolveOrderBy, type SortBy } from "./internal/order-by";

const logger = createLogger("story.location");

@Injectable()
export class StoryLocationService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  async listLocations(projectId: string, ownerId: string, search?: string, sortBy?: SortBy) {
    const conditions = [
      eq(storyLocations.projectId, projectId),
      eq(storyLocations.ownerId, ownerId),
      eq(storyLocations.isDeleted, false),
    ];
    if (search) conditions.push(ilike(storyLocations.name, `%${search}%`));
    return this.db
      .select()
      .from(storyLocations)
      .where(and(...conditions))
      .orderBy(
        resolveOrderBy(
          {
            name: storyLocations.name,
            updatedAt: storyLocations.updatedAt,
            createdAt: storyLocations.createdAt,
          },
          sortBy,
        ),
      );
  }

  async getLocation(id: string, ownerId: string) {
    const [location] = await this.db
      .select()
      .from(storyLocations)
      .where(and(eq(storyLocations.id, id), eq(storyLocations.isDeleted, false)))
      .limit(1);
    if (!location) throw new NotFoundException(`Location not found: ${id}`);
    if (location.ownerId !== ownerId) throw new ForbiddenException("접근 권한이 없습니다.");
    return location;
  }

  async createLocation(ownerId: string, data: CreateLocationDto) {
    const [location] = await this.db
      .insert(storyLocations)
      .values({
        ...(data.id ? { id: data.id } : {}),
        name: data.name,
        description: data.description,
        body: data.body,
        region: data.region,
        climate: data.climate,
        projectId: data.projectId,
        ownerId,
      })
      .returning();
    logger.info("Location created", {
      "story.location_id": location?.id,
      "story.location_name": data.name,
      "user.id": ownerId,
    });
    return location;
  }

  async updateLocation(id: string, ownerId: string, data: UpdateLocationDto) {
    await this.getLocation(id, ownerId);
    const [updated] = await this.db
      .update(storyLocations)
      .set(data)
      .where(eq(storyLocations.id, id))
      .returning();
    logger.info("Location updated", { "story.location_id": id, "user.id": ownerId });
    return updated;
  }

  async deleteLocation(id: string, ownerId: string) {
    await this.getLocation(id, ownerId);
    await this.db
      .update(storyLocations)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(eq(storyLocations.id, id));
    logger.info("Location deleted", { "story.location_id": id, "user.id": ownerId });
    return { success: true };
  }
}
