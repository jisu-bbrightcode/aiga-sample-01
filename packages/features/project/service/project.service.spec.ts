/**
 * ProjectService — DB-backed tests.
 *
 * Same pattern as `payment/service/audit.service.spec.ts`:
 *   - real postgres-js client against `DATABASE_URL` (skip when unset)
 *   - per-test unique orgId/userId for isolation
 *   - explicit cleanup in `afterEach`
 *
 * Coverage targets: every public method on ProjectService.
 *   - list / getById            (read paths, permission guards)
 *   - create                    (handle generation + ProjectEvent.CREATED)
 *   - update                    (mutation, ownership guard)
 *   - uploadCover               (blob upload mocked, DB persists URL)
 *   - delete / archive          (soft archive + ProjectEvent.DELETED)
 *   - permanentlyDelete         (cascade delete + event)
 *   - updateLastOpened          (timestamp bump)
 *   - cross-cutting             (ForbiddenException on owner mismatch)
 */

import { EventEmitter2 } from "@nestjs/event-emitter";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { profiles, projectProjects } from "@repo/drizzle";
import {
  cleanupOrg,
  cleanupUser,
  endTestDb,
  ensureOrg,
  ensureUser,
  getDrizzleDb,
  hasDb,
  newOrgId,
  newUserId,
} from "../../payment/__tests__/test-db";
import { ProjectEvent } from "../events";
import { ProjectService } from "./project.service";

// ProjectService stores ownerId as a FK to `profiles.id`. The shared
// `ensureUser` helper only writes the `users` row (better-auth), so we
// mirror it into `profiles` here. Keeping the helper inline avoids leaking
// project concerns into the payment test-db utility.
async function ensureProfile(userId: string): Promise<void> {
  const db = getDrizzleDb();
  await db
    .insert(profiles)
    .values({
      id: userId,
      name: `profile-${userId}`,
      email: `${userId}@test.local`,
    })
    .onConflictDoNothing();
}

async function cleanupProfile(userId: string): Promise<void> {
  const db = getDrizzleDb();
  await db.delete(profiles).where(eq(profiles.id, userId));
}

// Mock the Vercel Blob uploader — uploadCover() calls it. The test doesn't
// need real network; we just want to confirm the URL is persisted on the
// project row.
jest.mock("@repo/core/storage/blob", () => ({
  uploadDataUrlToBlob: jest.fn(async (_dataUrl: string, _key: string) => ({
    url: "https://blob.test/cover.png",
    size: 1234,
  })),
}));

const describeIfDb = hasDb ? describe : describe.skip;

jest.setTimeout(30_000);

describeIfDb("ProjectService", () => {
  let svc: ProjectService;
  let events: EventEmitter2;
  let captured: { event: ProjectEvent; payload: unknown }[];
  let ownerId: string;
  let orgId: string;
  let createdProjectIds: string[];

  beforeAll(() => {
    events = new EventEmitter2();
    svc = new ProjectService(getDrizzleDb(), events);
  });

  beforeEach(async () => {
    ownerId = newUserId("proj-owner");
    orgId = newOrgId("proj-org");
    createdProjectIds = [];
    captured = [];
    events.removeAllListeners();
    events.on(ProjectEvent.CREATED, (payload) => {
      captured.push({ event: ProjectEvent.CREATED, payload });
    });
    events.on(ProjectEvent.DELETED, (payload) => {
      captured.push({ event: ProjectEvent.DELETED, payload });
    });
    await ensureOrg(orgId);
    await ensureUser(ownerId);
    await ensureProfile(ownerId);
  });

  afterEach(async () => {
    // Clean up any rows we created. permanentlyDelete tests already remove
    // the row, but archive/update tests leave it around.
    const db = getDrizzleDb();
    for (const id of createdProjectIds) {
      await db.delete(projectProjects).where(eq(projectProjects.id, id));
    }
    await cleanupProfile(ownerId);
    await cleanupOrg(orgId);
    await cleanupUser(ownerId);
  });

  afterAll(async () => {
    await endTestDb();
  });

  // ────────────────────────────────────────────────────────────────────────
  // create — handle generation + event emit
  // ────────────────────────────────────────────────────────────────────────
  it("create() persists the project, assigns a slugified handle, and emits CREATED", async () => {
    const project = await svc.create(ownerId, orgId, {
      name: "My Adventure",
      description: "demo",
      genre: "fantasy",
    } as never);

    expect(project).toBeDefined();
    expect(project!.name).toBe("My Adventure");
    expect(project!.ownerId).toBe(ownerId);
    expect(project!.organizationId).toBe(orgId);
    // handle = `slug-<6-char-id>` — "my-adventure-<id>"
    expect(project!.handle).toMatch(/^my-adventure-[a-f0-9]{6}$/);
    createdProjectIds.push(project!.id);

    const created = captured.find((c) => c.event === ProjectEvent.CREATED);
    expect(created).toBeDefined();
    expect(created!.payload).toMatchObject({
      projectId: project!.id,
      ownerId,
      organizationId: orgId,
    });
  });

  it("create() falls back to 'project' slug when name has no ASCII letters", async () => {
    const project = await svc.create(ownerId, orgId, {
      name: "한글 프로젝트 🚀",
    } as never);
    createdProjectIds.push(project!.id);
    expect(project!.handle).toMatch(/^project-[a-f0-9]{6}$/);
  });

  // ────────────────────────────────────────────────────────────────────────
  // list — ordered by lastOpenedAt DESC, excludes archived + soft-deleted
  // ────────────────────────────────────────────────────────────────────────
  it("list() returns only the owner's active projects ordered by lastOpenedAt", async () => {
    const a = await svc.create(ownerId, orgId, { name: "alpha" } as never);
    const b = await svc.create(ownerId, orgId, { name: "beta" } as never);
    createdProjectIds.push(a!.id, b!.id);

    // Bump `b` so it's most recently opened.
    await svc.updateLastOpened(b!.id, ownerId, orgId);

    const rows = await svc.list(ownerId, orgId);
    expect(rows.map((r) => r.id)).toEqual([b!.id, a!.id]);
  });

  it("list() excludes archived projects", async () => {
    const a = await svc.create(ownerId, orgId, { name: "alpha" } as never);
    const b = await svc.create(ownerId, orgId, { name: "beta" } as never);
    createdProjectIds.push(a!.id, b!.id);

    await svc.archive(a!.id, ownerId, orgId);

    const rows = await svc.list(ownerId, orgId);
    expect(rows.map((r) => r.id)).toEqual([b!.id]);
  });

  // ────────────────────────────────────────────────────────────────────────
  // getById — NotFound + ownership guard
  // ────────────────────────────────────────────────────────────────────────
  it("getById() returns the project for its owner", async () => {
    const created = await svc.create(ownerId, orgId, { name: "x" } as never);
    createdProjectIds.push(created!.id);

    const fetched = await svc.getById(created!.id, ownerId, orgId);
    expect(fetched.id).toBe(created!.id);
  });

  it("getById() throws NotFoundException for an unknown id", async () => {
    await expect(
      svc.getById("00000000-0000-0000-0000-000000000000", ownerId, orgId),
    ).rejects.toThrow(NotFoundException);
  });

  it("getById() throws ForbiddenException when caller is not the owner", async () => {
    const created = await svc.create(ownerId, orgId, { name: "x" } as never);
    createdProjectIds.push(created!.id);

    const otherUser = newUserId("proj-other");
    await ensureUser(otherUser);
    await ensureProfile(otherUser);
    try {
      await expect(svc.getById(created!.id, otherUser, orgId)).rejects.toThrow(ForbiddenException);
    } finally {
      await cleanupProfile(otherUser);
      await cleanupUser(otherUser);
    }
  });

  // ────────────────────────────────────────────────────────────────────────
  // update — mutates, returns row
  // ────────────────────────────────────────────────────────────────────────
  it("update() mutates the project row", async () => {
    const created = await svc.create(ownerId, orgId, { name: "x" } as never);
    createdProjectIds.push(created!.id);

    const updated = await svc.update(created!.id, ownerId, orgId, {
      description: "edited",
    } as never);
    expect(updated!.description).toBe("edited");
  });

  // ────────────────────────────────────────────────────────────────────────
  // uploadCover — blob upload mocked, DB persists URL
  // ────────────────────────────────────────────────────────────────────────
  it("uploadCover() persists the returned blob URL on the project", async () => {
    const created = await svc.create(ownerId, orgId, { name: "x" } as never);
    createdProjectIds.push(created!.id);

    const updated = await svc.uploadCover(
      created!.id,
      ownerId,
      orgId,
      "data:image/png;base64,iVBORw0KGgo=",
    );
    expect(updated!.coverImage).toBe("https://blob.test/cover.png");
  });

  // ────────────────────────────────────────────────────────────────────────
  // archive / delete — soft archive + DELETED event
  // ────────────────────────────────────────────────────────────────────────
  it("archive() sets archivedAt + status='archived' and emits DELETED", async () => {
    const created = await svc.create(ownerId, orgId, { name: "x" } as never);
    createdProjectIds.push(created!.id);

    await svc.archive(created!.id, ownerId, orgId);

    const [row] = await getDrizzleDb()
      .select()
      .from(projectProjects)
      .where(eq(projectProjects.id, created!.id));
    expect(row?.archivedAt).toBeInstanceOf(Date);
    expect(row?.status).toBe("archived");

    const deletedEv = captured.filter((c) => c.event === ProjectEvent.DELETED);
    expect(deletedEv).toHaveLength(1);
    expect(deletedEv[0]?.payload).toMatchObject({
      projectId: created!.id,
      ownerId,
      organizationId: orgId,
    });
  });

  it("delete() is an alias for archive() — same side effects", async () => {
    const created = await svc.create(ownerId, orgId, { name: "x" } as never);
    createdProjectIds.push(created!.id);

    await svc.delete(created!.id, ownerId, orgId);

    const [row] = await getDrizzleDb()
      .select()
      .from(projectProjects)
      .where(eq(projectProjects.id, created!.id));
    expect(row?.status).toBe("archived");
  });

  // ────────────────────────────────────────────────────────────────────────
  // permanentlyDelete — cascade + DELETED event
  // ────────────────────────────────────────────────────────────────────────
  it("permanentlyDelete() removes the project row and emits DELETED", async () => {
    const created = await svc.create(ownerId, orgId, { name: "x" } as never);
    // Do NOT push to createdProjectIds — this test removes the row.
    const projectId = created!.id;

    await svc.permanentlyDelete(projectId, ownerId, orgId);

    const rows = await getDrizzleDb()
      .select()
      .from(projectProjects)
      .where(
        and(
          eq(projectProjects.id, projectId),
          eq(projectProjects.ownerId, ownerId),
          eq(projectProjects.organizationId, orgId),
        ),
      );
    expect(rows).toHaveLength(0);

    const deletedEv = captured.filter((c) => c.event === ProjectEvent.DELETED);
    expect(deletedEv.length).toBeGreaterThan(0);
  });

  // ────────────────────────────────────────────────────────────────────────
  // updateLastOpened — timestamp bump
  // ────────────────────────────────────────────────────────────────────────
  it("updateLastOpened() bumps lastOpenedAt to a more recent value", async () => {
    const created = await svc.create(ownerId, orgId, { name: "x" } as never);
    createdProjectIds.push(created!.id);
    const before = created!.lastOpenedAt!;

    // Wait a few ms so the new timestamp is strictly greater.
    await new Promise((r) => setTimeout(r, 5));
    const updated = await svc.updateLastOpened(created!.id, ownerId, orgId);
    expect(updated!.lastOpenedAt!.getTime()).toBeGreaterThan(before.getTime());
  });
});
