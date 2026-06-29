import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import type { EmailTemplateService } from "./email-template.service";
import { EmailTemplateRegistryService } from "./email-template-registry.service";

/**
 * Minimal chainable Drizzle mock: every query begins with `db.select(...)`, so
 * each `select()` call dequeues the next pre-seeded result. Chain methods are
 * no-ops that return `this`, and the chain is thenable so `await` resolves to
 * the dequeued value regardless of which builder methods were called.
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
  // biome-ignore lint/suspicious/noThenProperty: intentional thenable so `await chain` resolves the mocked query result
  then<T>(onFulfilled: (value: unknown) => T) {
    return Promise.resolve(this.value).then(onFulfilled);
  }
}

class MockDb {
  private queue: unknown[] = [];
  queue_(...values: unknown[]) {
    this.queue.push(...values);
    return this;
  }
  select() {
    return new MockChain(this.queue.shift() ?? []);
  }
}

const NOTIFICATION_SCHEMA = {
  title: { type: "string", required: true },
  body: { type: "string", required: true },
  actionLabel: { type: "string", required: false },
  actionUrl: { type: "url", required: false },
};

function template(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    key: "transactional.notification",
    name: "일반 알림",
    description: null,
    category: "transactional",
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
    bodySource: null,
    status: "published",
    changelog: "initial seed",
    createdBy: null,
    publishedAt: new Date(),
    ...overrides,
  };
}

function makeService(db: MockDb, renderHtml = "<html>body</html>") {
  const templateService = {
    render: jest.fn(async () => renderHtml),
  } as unknown as EmailTemplateService;
  const service = new EmailTemplateRegistryService(db as unknown as DrizzleDB, templateService);
  return { service, templateService };
}

describe("EmailTemplateRegistryService", () => {
  describe("getTemplate", () => {
    it("returns versions and distinguishes draft vs published (AC#3)", async () => {
      const db = new MockDb().queue_(
        [template()], // findTemplateByKey
        [
          publishedVersion({ id: "v1", version: 1 }),
          publishedVersion({ id: "v2", version: 2, status: "draft" }),
        ],
      );
      const { service } = makeService(db);

      const detail = await service.getTemplate("transactional.notification");

      expect(detail.key).toBe("transactional.notification");
      expect(detail.renderer).toBe("notification");
      expect(detail.currentVersion).toBe(1);
      expect(detail.currentStatus).toBe("published");
      expect(detail.versions.map((v) => v.status).sort()).toEqual(["draft", "published"]);
      const current = detail.versions.find((v) => v.isCurrent);
      expect(current?.version).toBe(1);
    });

    it("throws NotFound for an unknown key", async () => {
      const db = new MockDb().queue_([]);
      const { service } = makeService(db);
      await expect(service.getTemplate("nope.key")).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("resolvePublishedVersion", () => {
    it("resolves via the current_version_id pointer when published", async () => {
      const db = new MockDb().queue_([template()], [publishedVersion()]);
      const { service } = makeService(db);

      const resolved = await service.resolvePublishedVersion("transactional.notification");
      expect(resolved.version.id).toBe("v1");
      expect(resolved.renderer).toBe("notification");
    });

    it("throws NotFound when no published version exists", async () => {
      // pointer version is a draft → falls back to latest-published query (empty)
      const db = new MockDb().queue_(
        [template({ currentVersionId: "v9" })],
        [publishedVersion({ id: "v9", status: "draft" })],
        [],
      );
      const { service } = makeService(db);

      await expect(
        service.resolvePublishedVersion("transactional.notification"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("validateVariables", () => {
    it("reports missing required variables against the published schema (AC#2)", async () => {
      const db = new MockDb().queue_([template()], [publishedVersion()]);
      const { service } = makeService(db);

      const result = await service.validateVariables("transactional.notification", {
        body: "본문만 있음",
      });

      expect(result.version).toBe(1);
      expect(result.validation.valid).toBe(false);
      expect(result.validation.issues.map((i) => i.variable)).toContain("title");
    });
  });

  describe("renderByKey / preview", () => {
    it("renders subject interpolation + body via the React renderer", async () => {
      const db = new MockDb().queue_([template()], [publishedVersion()]);
      const { service, templateService } = makeService(db, "<html>RENDERED</html>");

      const rendered = await service.renderByKey(
        "transactional.notification",
        { title: "주문 완료", body: "감사합니다" },
        { requireValid: true },
      );

      expect(rendered.subject).toBe("주문 완료");
      expect(rendered.html).toBe("<html>RENDERED</html>");
      expect(rendered.version).toBe(1);
      expect(rendered.templateVersionId).toBe("v1");
      expect(templateService.render).toHaveBeenCalledWith("notification", {
        title: "주문 완료",
        body: "감사합니다",
      });
    });

    it("throws BadRequest before rendering when requireValid and variables invalid", async () => {
      const db = new MockDb().queue_([template()], [publishedVersion()]);
      const { service, templateService } = makeService(db);

      await expect(
        service.renderByKey(
          "transactional.notification",
          { body: "no title" },
          { requireValid: true },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(templateService.render).not.toHaveBeenCalled();
    });

    it("preview still renders and returns the validation report on gaps", async () => {
      const db = new MockDb().queue_([template()], [publishedVersion()]);
      const { service } = makeService(db, "<html>PREVIEW</html>");

      const rendered = await service.preview("transactional.notification", { body: "no title" });

      expect(rendered.html).toBe("<html>PREVIEW</html>");
      expect(rendered.validation.valid).toBe(false);
      expect(rendered.subjectMissing).toEqual(["title"]);
    });
  });

  describe("listTemplates", () => {
    it("maps rows with derived renderer + current status", async () => {
      const db = new MockDb().queue_([
        {
          key: "transactional.notification",
          name: "일반 알림",
          description: null,
          category: "transactional",
          isActive: true,
          currentVersion: 1,
          currentStatus: "published",
        },
        {
          key: "marketing.custom-blast",
          name: "커스텀",
          description: null,
          category: "marketing",
          isActive: true,
          currentVersion: null,
          currentStatus: null,
        },
      ]);
      const { service } = makeService(db);

      const list = await service.listTemplates();
      expect(list[0]?.renderer).toBe("notification");
      expect(list[0]?.currentStatus).toBe("published");
      expect(list[1]?.renderer).toBeNull();
      expect(list[1]?.currentVersion).toBeNull();
    });
  });
});
