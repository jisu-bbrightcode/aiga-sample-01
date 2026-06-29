import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import type { EmailTemplateService } from "./email-template.service";
import { EmailTemplateRegistryService } from "./email-template-registry.service";

/**
 * Archive / restore + send-guard tests (PB-NOTI-EMAIL-API-DELETE-001 / BBR-660).
 *
 * The mock models both the read path (`db.select(...)` — a thenable chain that
 * dequeues the next pre-seeded result) and the write path (`db.update(...).set
 * (...).where(...)` — resolves and records the `set` payload so tests can assert
 * what was written without a real DB).
 */
class MockChain {
  constructor(private readonly value: unknown) {}
  select() {
    return this;
  }
  from() {
    return this;
  }
  leftJoin() {
    return this;
  }
  where() {
    return this;
  }
  orderBy() {
    return this;
  }
  limit() {
    return this;
  }
  groupBy() {
    return this;
  }
  // biome-ignore lint/suspicious/noThenProperty: thenable so `await chain` resolves the mocked query result
  then<T>(onFulfilled: (value: unknown) => T) {
    return Promise.resolve(this.value).then(onFulfilled);
  }
}

class MockDb {
  private queue: unknown[] = [];
  readonly updates: Record<string, unknown>[] = [];

  queue_(...values: unknown[]) {
    this.queue.push(...values);
    return this;
  }
  select() {
    return new MockChain(this.queue.shift() ?? []);
  }
  update() {
    const updates = this.updates;
    return {
      set(payload: Record<string, unknown>) {
        updates.push(payload);
        return { where: () => Promise.resolve(undefined) };
      },
    };
  }
}

const NOTIFICATION_SCHEMA = {
  title: { type: "string", required: true },
  body: { type: "string", required: true },
};

function template(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    key: "marketing.custom-blast",
    name: "커스텀 블라스트",
    description: null,
    category: "marketing",
    isActive: true,
    currentVersionId: "v1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function publishedVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: "v1",
    templateId: "t1",
    version: 1,
    subject: "{{title}}",
    variableSchema: NOTIFICATION_SCHEMA,
    bodySource: "{{body}}",
    status: "published",
    changelog: null,
    createdBy: null,
    publishedAt: new Date(),
    ...overrides,
  };
}

function makeService(db: MockDb) {
  const templateService = {
    render: jest.fn(async () => "<html>RENDERED</html>"),
  } as unknown as EmailTemplateService;
  const service = new EmailTemplateRegistryService(db as unknown as DrizzleDB, templateService);
  return { service, templateService };
}

describe("EmailTemplateRegistryService.archiveTemplate (BBR-660)", () => {
  it("archives a non-system template (isActive=false) and keeps it queryable", async () => {
    const db = new MockDb().queue_(
      [template()], // archiveTemplate: findTemplateByKey (active)
      // getTemplate re-fetch (now archived)
      [template({ isActive: false })], // findTemplateByKey
      [publishedVersion()], // versions
      [], // getSendSummaries
    );
    const { service } = makeService(db);

    const detail = await service.archiveTemplate("marketing.custom-blast");

    // It wrote isActive=false ...
    expect(db.updates).toEqual([expect.objectContaining({ isActive: false })]);
    // ... and the template is still returned for history (AC: 이력 조회 가능)
    expect(detail.key).toBe("marketing.custom-blast");
    expect(detail.isActive).toBe(false);
    expect(detail.isSystem).toBe(false);
    expect(detail.versions).toHaveLength(1);
  });

  it("refuses to archive a protected system template with 403 (AC)", async () => {
    const db = new MockDb().queue_([template({ key: "auth.welcome", id: "sys" })]);
    const { service } = makeService(db);

    await expect(service.archiveTemplate("auth.welcome")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    // No write happened.
    expect(db.updates).toHaveLength(0);
  });

  it("throws NotFound for an unknown key", async () => {
    const db = new MockDb().queue_([]);
    const { service } = makeService(db);

    await expect(service.archiveTemplate("nope.key")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("is idempotent — archiving an already-archived template does not re-write", async () => {
    const db = new MockDb().queue_(
      [template({ isActive: false })], // already archived
      // getTemplate re-fetch
      [template({ isActive: false })],
      [publishedVersion()],
      [],
    );
    const { service } = makeService(db);

    const detail = await service.archiveTemplate("marketing.custom-blast");

    expect(db.updates).toHaveLength(0);
    expect(detail.isActive).toBe(false);
  });
});

describe("EmailTemplateRegistryService.restoreTemplate (BBR-660 복구 정책)", () => {
  it("restores an archived template (isActive=true)", async () => {
    const db = new MockDb().queue_(
      [template({ isActive: false })], // findTemplateByKey (archived)
      // getTemplate re-fetch (now active)
      [template({ isActive: true })],
      [publishedVersion()],
      [],
    );
    const { service } = makeService(db);

    const detail = await service.restoreTemplate("marketing.custom-blast");

    expect(db.updates).toEqual([expect.objectContaining({ isActive: true })]);
    expect(detail.isActive).toBe(true);
  });

  it("is idempotent — restoring an active template does not re-write", async () => {
    const db = new MockDb().queue_(
      [template({ isActive: true })],
      [template({ isActive: true })],
      [publishedVersion()],
      [],
    );
    const { service } = makeService(db);

    await service.restoreTemplate("marketing.custom-blast");

    expect(db.updates).toHaveLength(0);
  });
});

describe("EmailTemplateRegistryService send guard for archived templates (BBR-660 AC)", () => {
  it("blocks sending (requireValid) from an archived template", async () => {
    const db = new MockDb().queue_(
      [template({ isActive: false })], // resolvePublishedVersion: findTemplateByKey
      [publishedVersion()], // current version pointer lookup
    );
    const { service, templateService } = makeService(db);

    await expect(
      service.renderByKey(
        "marketing.custom-blast",
        { title: "제목", body: "본문" },
        { requireValid: true },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    // Guard fires before any rendering.
    expect(templateService.render).not.toHaveBeenCalled();
  });

  it("still previews an archived template for history/inspection", async () => {
    const db = new MockDb().queue_([template({ isActive: false })], [publishedVersion()]);
    const { service } = makeService(db);

    const rendered = await service.preview("marketing.custom-blast", {
      title: "제목",
      body: "본문",
    });

    expect(rendered.subject).toBe("제목");
    // No React renderer for this key → body source is interpolated instead.
    expect(rendered.html).toBe("본문");
  });
});
