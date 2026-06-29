import { createLogger } from "@repo/core/logger";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import { storyCharacters } from "@repo/drizzle/schema";
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, ilike } from "drizzle-orm";
import type { CreateCharacterDto, UpdateCharacterDto } from "../dto";
import { resolveOrderBy, type SortBy } from "./internal/order-by";

const logger = createLogger("story.character");

@Injectable()
export class StoryCharacterService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  async listCharacters(projectId: string, ownerId: string, search?: string, sortBy?: SortBy) {
    const conditions = [
      eq(storyCharacters.projectId, projectId),
      eq(storyCharacters.ownerId, ownerId),
      eq(storyCharacters.isDeleted, false),
    ];
    if (search) conditions.push(ilike(storyCharacters.name, `%${search}%`));
    return this.db
      .select()
      .from(storyCharacters)
      .where(and(...conditions))
      .orderBy(
        resolveOrderBy(
          {
            name: storyCharacters.name,
            updatedAt: storyCharacters.updatedAt,
            createdAt: storyCharacters.createdAt,
          },
          sortBy,
        ),
      );
  }

  async getCharacter(id: string, ownerId: string) {
    const [character] = await this.db
      .select()
      .from(storyCharacters)
      .where(and(eq(storyCharacters.id, id), eq(storyCharacters.isDeleted, false)))
      .limit(1);
    if (!character) throw new NotFoundException(`Character not found: ${id}`);
    if (character.ownerId !== ownerId) throw new ForbiddenException("접근 권한이 없습니다.");
    return character;
  }

  async createCharacter(ownerId: string, data: CreateCharacterDto) {
    const [character] = await this.db
      .insert(storyCharacters)
      .values({
        ...(data.id ? { id: data.id } : {}),
        name: data.name,
        description: data.description,
        body: data.body,
        age: data.age,
        occupation: data.occupation,
        personality: data.personality,
        voice: data.voice,
        roles: data.roles ?? [],
        projectId: data.projectId,
        ownerId,
      })
      .returning();
    logger.info("Character created", {
      "story.character_id": character?.id,
      "story.character_name": data.name,
      "user.id": ownerId,
    });
    return character;
  }

  async updateCharacter(id: string, ownerId: string, data: UpdateCharacterDto) {
    await this.getCharacter(id, ownerId);
    const [updated] = await this.db
      .update(storyCharacters)
      .set(data)
      .where(eq(storyCharacters.id, id))
      .returning();
    logger.info("Character updated", { "story.character_id": id, "user.id": ownerId });
    return updated;
  }

  async deleteCharacter(id: string, ownerId: string) {
    await this.getCharacter(id, ownerId);
    await this.db
      .update(storyCharacters)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(eq(storyCharacters.id, id));
    logger.info("Character deleted", { "story.character_id": id, "user.id": ownerId });
    return { success: true };
  }
}
