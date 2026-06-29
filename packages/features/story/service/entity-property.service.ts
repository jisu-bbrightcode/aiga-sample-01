import { createLogger } from "@repo/core/logger";
import { uploadBufferToBlob } from "@repo/core/storage/blob";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import { type StoryPropertyValue, storyEntityProperties } from "@repo/drizzle/schema";
import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { StoryCharacterService } from "./character.service";
import { StoryCodexService } from "./codex.service";
import { StoryDraftService } from "./draft.service";
import { StoryFactionService } from "./faction.service";
import { StoryLocationService } from "./location.service";
import { StoryWorldService } from "./world.service";

const logger = createLogger("story.entity-property");

type StoryEntityType = "world" | "character" | "location" | "faction" | "codex" | "draft";

const IMAGE_SMALL_PROPERTY_KEY = "imageSmallUrl";
const IMAGE_SMALL_MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_SMALL_CONTENT_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const IMAGE_SMALL_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function upsertPropertyValue(
  properties: StoryPropertyValue[] | null | undefined,
  key: string,
  value: string,
): StoryPropertyValue[] {
  const next = [...(properties ?? [])];
  const index = next.findIndex((p) => p.key === key);
  if (index >= 0) {
    next[index] = { key, value };
    return next;
  }
  return [...next, { key, value }];
}

@Injectable()
export class StoryEntityPropertyService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly worlds: StoryWorldService,
    private readonly characters: StoryCharacterService,
    private readonly locations: StoryLocationService,
    private readonly factions: StoryFactionService,
    private readonly codex: StoryCodexService,
    private readonly drafts: StoryDraftService,
  ) {}

  /**
   * Dispatch table mapping entity type → the per-domain `get*` method that
   * also enforces ownership. Splitting this out of a `switch` lets us
   * extend the entity-type set without touching the property service.
   */
  private async getStoryEntityForProperties(
    entityId: string,
    entityType: StoryEntityType,
    ownerId: string,
  ) {
    switch (entityType) {
      case "world":
        return this.worlds.getWorld(entityId, ownerId);
      case "character":
        return this.characters.getCharacter(entityId, ownerId);
      case "location":
        return this.locations.getLocation(entityId, ownerId);
      case "faction":
        return this.factions.getFaction(entityId, ownerId);
      case "codex":
        return this.codex.getCodexEntry(entityId, ownerId);
      case "draft":
        return this.drafts.getDraft(entityId, ownerId);
      default:
        throw new BadRequestException("지원하지 않는 엔티티 타입입니다.");
    }
  }

  async getEntityProperties(entityId: string, entityType: StoryEntityType, ownerId: string) {
    const entity = await this.getStoryEntityForProperties(entityId, entityType, ownerId);
    const [row] = await this.db
      .select()
      .from(storyEntityProperties)
      .where(
        and(
          eq(storyEntityProperties.entityId, entityId),
          eq(storyEntityProperties.entityType, entityType),
          eq(storyEntityProperties.projectId, entity.projectId),
          eq(storyEntityProperties.isDeleted, false),
        ),
      )
      .limit(1);
    return (
      row ?? {
        entityId,
        entityType,
        projectId: entity.projectId,
        properties: [],
      }
    );
  }

  async upsertEntityProperty(input: {
    projectId: string;
    entityId: string;
    entityType: StoryEntityType;
    key: string;
    value: string;
    ownerId: string;
  }) {
    const entity = await this.getStoryEntityForProperties(
      input.entityId,
      input.entityType,
      input.ownerId,
    );
    if (entity.projectId !== input.projectId) {
      throw new ForbiddenException("프로젝트 접근 권한이 없습니다.");
    }

    const [existing] = await this.db
      .select()
      .from(storyEntityProperties)
      .where(
        and(
          eq(storyEntityProperties.projectId, input.projectId),
          eq(storyEntityProperties.entityId, input.entityId),
          eq(storyEntityProperties.entityType, input.entityType),
          eq(storyEntityProperties.isDeleted, false),
        ),
      )
      .limit(1);

    const properties = upsertPropertyValue(existing?.properties ?? [], input.key, input.value);
    if (existing) {
      const [updated] = await this.db
        .update(storyEntityProperties)
        .set({ properties })
        .where(eq(storyEntityProperties.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await this.db
      .insert(storyEntityProperties)
      .values({
        projectId: input.projectId,
        entityId: input.entityId,
        entityType: input.entityType,
        properties,
      })
      .returning();
    return created;
  }

  async uploadEntityImageSmall(input: {
    projectId: string;
    entityId: string;
    entityType: StoryEntityType;
    fileName: string;
    contentType: string;
    bytesBase64: string;
    ownerId: string;
  }) {
    const contentType = input.contentType.toLowerCase();
    if (!IMAGE_SMALL_CONTENT_TYPES.has(contentType)) {
      throw new BadRequestException("지원하지 않는 이미지 형식입니다.");
    }
    const bytes = Buffer.from(input.bytesBase64, "base64");
    if (bytes.byteLength > IMAGE_SMALL_MAX_BYTES) {
      throw new BadRequestException("이미지는 5MB 이하만 업로드할 수 있습니다.");
    }
    const ext = IMAGE_SMALL_EXTENSIONS[contentType] ?? "bin";
    const key = [
      "story-entity-properties",
      input.projectId,
      input.entityType,
      input.entityId,
      "image-small",
      `${crypto.randomUUID()}.${ext}`,
    ].join("/");
    const blob = await uploadBufferToBlob(bytes, key, contentType, { addRandomSuffix: false });
    await this.upsertEntityProperty({
      projectId: input.projectId,
      entityId: input.entityId,
      entityType: input.entityType,
      key: IMAGE_SMALL_PROPERTY_KEY,
      value: blob.url,
      ownerId: input.ownerId,
    });
    logger.info("Entity imageSmallUrl uploaded", {
      "story.entity_id": input.entityId,
      "story.entity_type": input.entityType,
      "story.blob_size": blob.size,
    });
    return { imageSmallUrl: blob.url };
  }
}
