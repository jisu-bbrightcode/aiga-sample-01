/**
 * project.service.events.spec.ts — Phase 7 Task 7.1.
 *
 * Verifies ProjectService list/create/delete behavior with faked DB and
 * EventEmitter2. Keeps the project list path free of content count roll-up
 * queries.
 */
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { DrizzleDB } from "@repo/drizzle";

import { ProjectEvent } from "../events";
import { ProjectService } from "./project.service";

const NOW = new Date("2026-04-26T12:00:00.000Z");

function makeFakeDb(opts: {
  project?: { id: string; ownerId: string; createdAt?: Date };
  projectList?: Array<{ id: string; ownerId: string }>;
}) {
  const project = opts.project ?? null;
  const projectList = opts.projectList ?? [];
  const calls: {
    deletedTables: unknown[];
    updateSets: unknown[];
  } = {
    deletedTables: [],
    updateSets: [],
  };
  let db: unknown;
  db = {
    __calls: calls,
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
    select: () => ({
      from: () => ({
        where: () =>
          Object.assign(Promise.resolve(project ? [project] : []), {
            limit: () => Promise.resolve(project ? [project] : []),
            orderBy: () => Promise.resolve(projectList),
          }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve([{ id: "p1", ownerId: "u1", createdAt: NOW }]),
      }),
    }),
    update: () => ({
      set: (values: unknown) => {
        calls.updateSets.push(values);
        return {
          where: () => ({
            returning: () => Promise.resolve([]),
          }),
        };
      },
    }),
    delete: (table: unknown) => {
      calls.deletedTables.push(table);
      return {
        where: () => ({
          returning: () => Promise.resolve([{ id: "p1" }]),
        }),
      };
    },
  };
  return db as unknown as DrizzleDB;
}

describe("ProjectService", () => {
  it("lists projects without content count roll-up queries", async () => {
    const events = new EventEmitter2();
    const svc = new ProjectService(
      makeFakeDb({ projectList: [{ id: "p1", ownerId: "u1" }] }),
      events,
    );

    const result = await svc.list("u1", "org-a");

    expect(result).toEqual([{ id: "p1", ownerId: "u1" }]);
  });

  it("emits project.created after a successful insert", async () => {
    const events = new EventEmitter2();
    const emit = jest.spyOn(events, "emit");
    const svc = new ProjectService(makeFakeDb({}), events);

    const result = await svc.create("u1", "org-a", { name: "Demo" } as never);

    expect(result?.id).toBe("p1");
    expect(emit).toHaveBeenCalledWith(ProjectEvent.CREATED, {
      projectId: "p1",
      ownerId: "u1",
      organizationId: "org-a",
      createdAt: NOW,
    });
  });

  it("archives projects with archivedAt instead of soft-deleting them", async () => {
    const events = new EventEmitter2();
    const emit = jest.spyOn(events, "emit");
    const db = makeFakeDb({ project: { id: "p1", ownerId: "u1" } });
    const calls = (db as unknown as { __calls: { updateSets: unknown[] } }).__calls;
    const svc = new ProjectService(db, events);

    await svc.delete("p1", "u1", "org-a");

    expect(calls.updateSets[0]).toMatchObject({
      status: "archived",
      deletedAt: null,
      isDeleted: false,
    });
    expect((calls.updateSets[0] as { archivedAt?: unknown }).archivedAt).toBeInstanceOf(Date);

    const deletedCall = emit.mock.calls.find((c) => c[0] === ProjectEvent.DELETED);
    expect(deletedCall).toBeDefined();
    const payload = deletedCall?.[1] as {
      projectId: string;
      ownerId: string;
      organizationId: string;
      deletedAt: Date;
    };
    expect(payload.projectId).toBe("p1");
    expect(payload.ownerId).toBe("u1");
    expect(payload.organizationId).toBe("org-a");
    expect(payload.deletedAt).toBeInstanceOf(Date);
  });

  it("permanently deletes the project row for hard delete", async () => {
    const events = new EventEmitter2();
    const db = makeFakeDb({ project: { id: "p1", ownerId: "u1" } });
    const calls = (db as unknown as { __calls: { deletedTables: unknown[] } }).__calls;
    const svc = new ProjectService(db, events);

    await svc.permanentlyDelete("p1", "u1", "org-a");

    expect(calls.deletedTables.length).toBeGreaterThan(0);
  });
});
