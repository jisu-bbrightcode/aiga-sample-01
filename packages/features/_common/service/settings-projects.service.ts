import {
  type DrizzleDB,
  InjectDrizzle,
  locLanguages,
  profiles,
  projectMembers,
  projectProjects,
  projectStarred,
  storyDrafts,
  storyTags,
} from "@repo/drizzle";
import { ForbiddenException, Injectable } from "@nestjs/common";
import { and, count, desc, eq, ilike, inArray, isNotNull, isNull, or } from "drizzle-orm";

type ProjectFilter = "active" | "starred" | "archived";

function present<T>(value: T | undefined | null | false): value is T {
  return Boolean(value);
}

@Injectable()
export class SettingsProjectsService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  private async aggregateCounts(
    projectIds: string[],
  ): Promise<Map<string, { memberCount: number; storyCount: number; languageCount: number }>> {
    const map = new Map<
      string,
      { memberCount: number; storyCount: number; languageCount: number }
    >();
    if (projectIds.length === 0) return map;
    for (const id of projectIds) {
      map.set(id, { memberCount: 0, storyCount: 0, languageCount: 0 });
    }
    const [memberRows, storyRows, langRows] = await Promise.all([
      this.db
        .select({ projectId: projectMembers.projectId, n: count() })
        .from(projectMembers)
        .where(inArray(projectMembers.projectId, projectIds))
        .groupBy(projectMembers.projectId),
      this.db
        .select({ projectId: storyDrafts.projectId, n: count() })
        .from(storyDrafts)
        .where(and(inArray(storyDrafts.projectId, projectIds), eq(storyDrafts.isDeleted, false)))
        .groupBy(storyDrafts.projectId),
      this.db
        .select({ projectId: locLanguages.projectId, n: count() })
        .from(locLanguages)
        .where(and(inArray(locLanguages.projectId, projectIds), eq(locLanguages.isDeleted, false)))
        .groupBy(locLanguages.projectId),
    ]);
    for (const row of memberRows) {
      const counts = map.get(row.projectId);
      if (counts) counts.memberCount = Number(row.n);
    }
    for (const row of storyRows) {
      const counts = map.get(row.projectId);
      if (counts) counts.storyCount = Number(row.n);
    }
    for (const row of langRows) {
      const counts = map.get(row.projectId);
      if (counts) counts.languageCount = Number(row.n);
    }
    return map;
  }

  async list(
    userId: string,
    organizationId: string,
    input: { filter?: ProjectFilter; search?: string },
  ) {
    const filter = input.filter ?? "active";
    const q = input.search?.trim();

    const memberIdRows = await this.db
      .select({ projectId: projectMembers.projectId, role: projectMembers.role })
      .from(projectMembers)
      .where(eq(projectMembers.userId, userId));
    const memberRoleMap = new Map(memberIdRows.map((row) => [row.projectId, row.role]));
    const memberIds = memberIdRows.map((row) => row.projectId);

    const accessCond =
      memberIds.length > 0
        ? or(eq(projectProjects.ownerId, userId), inArray(projectProjects.id, memberIds))
        : eq(projectProjects.ownerId, userId);

    const baseConds = [
      eq(projectProjects.organizationId, organizationId),
      accessCond,
      eq(projectProjects.isDeleted, false),
      filter === "archived"
        ? isNotNull(projectProjects.archivedAt)
        : isNull(projectProjects.archivedAt),
    ];
    if (q && q.length > 0) {
      const like = `%${q}%`;
      baseConds.push(or(ilike(projectProjects.name, like), ilike(projectProjects.handle, like)));
    }

    const rows = await this.db
      .select({
        id: projectProjects.id,
        name: projectProjects.name,
        handle: projectProjects.handle,
        description: projectProjects.description,
        visibility: projectProjects.visibility,
        status: projectProjects.status,
        archivedAt: projectProjects.archivedAt,
        ownerId: projectProjects.ownerId,
        updatedAt: projectProjects.updatedAt,
        lastOpenedAt: projectProjects.lastOpenedAt,
      })
      .from(projectProjects)
      .where(and(...baseConds.filter(present)))
      .orderBy(desc(projectProjects.updatedAt));

    const ids = rows.map((row) => row.id);
    const [starredRows, counts] = await Promise.all([
      this.db
        .select({ projectId: projectStarred.projectId })
        .from(projectStarred)
        .where(eq(projectStarred.userId, userId)),
      this.aggregateCounts(ids),
    ]);
    const starredSet = new Set(starredRows.map((row) => row.projectId));

    const decorated = rows.map((row) => ({
      ...row,
      starred: starredSet.has(row.id),
      viewerRole: row.ownerId === userId ? "owner" : (memberRoleMap.get(row.id) ?? "viewer"),
      memberCount: counts.get(row.id)?.memberCount ?? 0,
      storyCount: counts.get(row.id)?.storyCount ?? 0,
      languageCount: counts.get(row.id)?.languageCount ?? 0,
    }));

    if (filter === "starred") {
      return decorated.filter((row) => row.starred);
    }
    return decorated;
  }

  async byId(userId: string, organizationId: string, projectId: string) {
    const [project] = await this.db
      .select()
      .from(projectProjects)
      .where(
        and(
          eq(projectProjects.id, projectId),
          eq(projectProjects.organizationId, organizationId),
          eq(projectProjects.isDeleted, false),
        ),
      )
      .limit(1);
    if (!project) return null;

    const [memberRow] = await this.db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
      .limit(1);

    const isOwner = project.ownerId === userId;
    if (!isOwner && !memberRow) {
      throw new ForbiddenException("이 프로젝트에 접근 권한이 없습니다.");
    }

    const [members, tags, starred, counts, languages] = await Promise.all([
      this.db
        .select({
          userId: projectMembers.userId,
          role: projectMembers.role,
          createdAt: projectMembers.createdAt,
          name: profiles.name,
          email: profiles.email,
          handle: profiles.handle,
          avatar: profiles.avatar,
        })
        .from(projectMembers)
        .leftJoin(profiles, eq(projectMembers.userId, profiles.id))
        .where(eq(projectMembers.projectId, projectId)),
      this.db
        .select({
          id: storyTags.id,
          name: storyTags.name,
          description: storyTags.description,
          createdAt: storyTags.createdAt,
        })
        .from(storyTags)
        .where(eq(storyTags.projectId, projectId)),
      this.db
        .select({ projectId: projectStarred.projectId })
        .from(projectStarred)
        .where(and(eq(projectStarred.userId, userId), eq(projectStarred.projectId, projectId)))
        .limit(1),
      this.aggregateCounts([projectId]),
      this.db
        .select({
          id: locLanguages.id,
          code: locLanguages.code,
          name: locLanguages.name,
          isSource: locLanguages.isSource,
          progress: locLanguages.progress,
        })
        .from(locLanguages)
        .where(and(eq(locLanguages.projectId, projectId), eq(locLanguages.isDeleted, false))),
    ]);

    const projectCounts = counts.get(projectId) ?? {
      memberCount: 0,
      storyCount: 0,
      languageCount: 0,
    };

    return {
      ...project,
      members,
      tags,
      languages,
      starred: starred.length > 0,
      viewerRole: isOwner ? "owner" : (memberRow?.role ?? "viewer"),
      memberCount: projectCounts.memberCount,
      storyCount: projectCounts.storyCount,
      languageCount: projectCounts.languageCount,
    };
  }
}
