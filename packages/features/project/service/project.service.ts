import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { createLogger } from "@repo/core/logger";
import { uploadDataUrlToBlob } from "@repo/core/storage/blob";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import {
  projectProjects,
} from "@repo/drizzle/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { type ProjectCreatedPayload, type ProjectDeletedPayload, ProjectEvent } from "../events";
import type { CreateProjectDto, UpdateProjectDto } from "../dto";

const logger = createLogger("project");

/** Settings redesign Phase 4 — slugify a project name into a URL handle.
 * Names that produce an empty slug (Korean, symbols, emoji-only) fall back
 * to the literal "project" so the final handle is never `-abcdef`.
 */
function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug.length > 0 ? slug : "project";
}

@Injectable()
export class ProjectService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly events: EventEmitter2,
  ) {}

  async list(ownerId: string, organizationId: string) {
    const projects = await this.db
      .select()
      .from(projectProjects)
      .where(
        and(
          eq(projectProjects.ownerId, ownerId),
          eq(projectProjects.organizationId, organizationId),
          eq(projectProjects.isDeleted, false),
          isNull(projectProjects.archivedAt),
        ),
      )
      .orderBy(desc(projectProjects.lastOpenedAt));

    return projects;
  }

  async getById(id: string, ownerId: string, organizationId: string) {
    const [project] = await this.db
      .select()
      .from(projectProjects)
      .where(
        and(
          eq(projectProjects.id, id),
          eq(projectProjects.organizationId, organizationId),
          eq(projectProjects.isDeleted, false),
        ),
      )
      .limit(1);

    if (!project) {
      throw new NotFoundException(`Project not found: ${id}`);
    }

    if (project.ownerId !== ownerId) {
      throw new ForbiddenException("접근 권한이 없습니다.");
    }

    return project;
  }

  async create(ownerId: string, organizationId: string, data: CreateProjectDto) {
    const [project] = await this.db
      .insert(projectProjects)
      .values({
        name: data.name,
        description: data.description,
        genre: data.genre,
        template: data.template,
        aiMode: data.aiMode,
        ownerId,
        organizationId,
        lastOpenedAt: new Date(),
      })
      .returning();

    if (project) {
      // Settings redesign Phase 4 follow-up: assign the read-only handle
      // `slug-<6-char-id>` so the URL `product-builder.app/{org}/{handle}` is
      // stable and never falls back to a UUID slice on cards.
      const handle = `${slugify(data.name)}-${project.id.slice(0, 6)}`;
      await this.db
        .update(projectProjects)
        .set({ handle })
        .where(eq(projectProjects.id, project.id));
      project.handle = handle;

      const payload: ProjectCreatedPayload = {
        projectId: project.id,
        ownerId,
        organizationId,
        createdAt: project.createdAt ?? new Date(),
      };
      this.events.emit(ProjectEvent.CREATED, payload);
    }

    logger.info("Project created", {
      "project.project_id": project?.id,
      "project.name": data.name,
      "user.id": ownerId,
      "organization.id": organizationId,
    });

    return project;
  }

  async update(id: string, ownerId: string, organizationId: string, data: UpdateProjectDto) {
    await this.getById(id, ownerId, organizationId);

    const [updated] = await this.db
      .update(projectProjects)
      .set(data)
      .where(eq(projectProjects.id, id))
      .returning();

    logger.info("Project updated", {
      "project.project_id": id,
      "user.id": ownerId,
      "organization.id": organizationId,
    });

    return updated;
  }

  /**
   * Upload a cover artwork to Vercel Blob and persist its public URL on the
   * project. Accepts a `data:` URL (frontend reads File → FileReader). DB
   * holds the URL only — keeps `project_projects.cover_image` small even
   * when the user uploads a 4MB JPEG.
   */
  async uploadCover(id: string, ownerId: string, organizationId: string, dataUrl: string) {
    await this.getById(id, ownerId, organizationId);

    const { url, size } = await uploadDataUrlToBlob(dataUrl, `project-covers/${id}`);

    const [updated] = await this.db
      .update(projectProjects)
      .set({ coverImage: url })
      .where(eq(projectProjects.id, id))
      .returning();

    logger.info("Project cover uploaded", {
      "project.project_id": id,
      "user.id": ownerId,
      "organization.id": organizationId,
      "blob.size": size,
      "blob.url": url,
    });

    return updated;
  }

  async delete(id: string, ownerId: string, organizationId: string) {
    return this.archive(id, ownerId, organizationId);
  }

  async archive(id: string, ownerId: string, organizationId: string) {
    await this.getById(id, ownerId, organizationId);

    const archivedAt = new Date();
    await this.db
      .update(projectProjects)
      .set({
        archivedAt,
        deletedAt: null,
        isDeleted: false,
        status: "archived",
      })
      .where(eq(projectProjects.id, id));

    const deletedPayload: ProjectDeletedPayload = {
      projectId: id,
      ownerId,
      organizationId,
      deletedAt: archivedAt,
    };
    this.events.emit(ProjectEvent.DELETED, deletedPayload);

    logger.info("Project archived", {
      "project.project_id": id,
      "user.id": ownerId,
      "organization.id": organizationId,
    });

    return { success: true };
  }

  async permanentlyDelete(id: string, ownerId: string, organizationId: string) {
    await this.getById(id, ownerId, organizationId);

    const deletedAt = new Date();
    await this.db.transaction(async (tx) => {
      await tx
        .delete(projectProjects)
        .where(
          and(
            eq(projectProjects.id, id),
            eq(projectProjects.ownerId, ownerId),
            eq(projectProjects.organizationId, organizationId),
          ),
        );
    });

    this.events.emit(ProjectEvent.DELETED, {
      projectId: id,
      ownerId,
      organizationId,
      deletedAt,
    });

    logger.info("Project permanently deleted", {
      "project.project_id": id,
      "user.id": ownerId,
      "organization.id": organizationId,
    });

    return { success: true };
  }

  async updateLastOpened(id: string, ownerId: string, organizationId: string) {
    await this.getById(id, ownerId, organizationId);

    const [updated] = await this.db
      .update(projectProjects)
      .set({ lastOpenedAt: new Date() })
      .where(eq(projectProjects.id, id))
      .returning();

    return updated;
  }
}
