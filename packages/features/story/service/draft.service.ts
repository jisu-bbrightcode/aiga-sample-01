import { createLogger } from "@repo/core/logger";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import { storyDrafts } from "@repo/drizzle/schema";
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, ilike } from "drizzle-orm";
import type { CreateDraftDto, UpdateDraftDto } from "../dto";
import { resolveOrderBy, type SortBy } from "./internal/order-by";

const logger = createLogger("story.draft");

@Injectable()
export class StoryDraftService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  async listDrafts(projectId: string, ownerId: string, search?: string, sortBy?: SortBy) {
    const conditions = [
      eq(storyDrafts.projectId, projectId),
      eq(storyDrafts.ownerId, ownerId),
      eq(storyDrafts.isDeleted, false),
    ];
    if (search) conditions.push(ilike(storyDrafts.title, `%${search}%`));
    return this.db
      .select()
      .from(storyDrafts)
      .where(and(...conditions))
      .orderBy(
        resolveOrderBy(
          {
            name: storyDrafts.title, // drafts sort by title for `sortBy: "name"`.
            updatedAt: storyDrafts.updatedAt,
            createdAt: storyDrafts.createdAt,
          },
          sortBy,
        ),
      );
  }

  async getDraft(id: string, ownerId: string) {
    const [draft] = await this.db
      .select()
      .from(storyDrafts)
      .where(and(eq(storyDrafts.id, id), eq(storyDrafts.isDeleted, false)))
      .limit(1);
    if (!draft) throw new NotFoundException(`Draft not found: ${id}`);
    if (draft.ownerId !== ownerId) throw new ForbiddenException("접근 권한이 없습니다.");
    return draft;
  }

  async createDraft(ownerId: string, data: CreateDraftDto) {
    const [draft] = await this.db
      .insert(storyDrafts)
      .values({
        ...(data.id ? { id: data.id } : {}),
        title: data.title,
        description: data.description,
        body: data.body,
        sortOrder: data.sortOrder ?? 0,
        projectId: data.projectId,
        ownerId,
      })
      .returning();
    logger.info("Draft created", {
      "story.draft_id": draft?.id,
      "story.draft_title": data.title,
      "user.id": ownerId,
    });
    return draft;
  }

  async updateDraft(id: string, ownerId: string, data: UpdateDraftDto) {
    await this.getDraft(id, ownerId);
    const [updated] = await this.db
      .update(storyDrafts)
      .set(data)
      .where(eq(storyDrafts.id, id))
      .returning();
    logger.info("Draft updated", { "story.draft_id": id, "user.id": ownerId });
    return updated;
  }

  async deleteDraft(id: string, ownerId: string) {
    await this.getDraft(id, ownerId);
    await this.db
      .update(storyDrafts)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(eq(storyDrafts.id, id));
    logger.info("Draft deleted", { "story.draft_id": id, "user.id": ownerId });
    return { success: true };
  }
}
