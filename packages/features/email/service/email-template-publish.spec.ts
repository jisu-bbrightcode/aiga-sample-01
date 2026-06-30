import { NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { emailTemplates, emailTemplateVersions } from "@repo/drizzle/schema";
import type { EmailTemplateService } from "./email-template.service";
import { EmailTemplateRegistryService } from "./email-template-registry.service";

/**
 * publishTemplate-focused tests (PB-NOTI-EMAIL-API-UPDATE-001 / BBR-659).
 *
 * AC#2: 발행 전 변수 스키마와 preview payload 검증이 통과해야 한다.
 *   - malformed stored schema → 422
 *   - preview variables that violate the schema → 422
 *   - subject with an unresolved placeholder → 422
 *   - no body renderer / body source → 422
 * On success the draft becomes published and `currentVersionId` moves to it.
 */
class SelectChain {
  constructor(private readonly value: unknown[]) {}
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
  // biome-ignore lint/suspicious/noThenProperty: thenable so `await chain` resolves the mocked select result
  then<T>(onFulfilled: (value: unknown) => T) {
    return Promise.resolve(this.value).then(onFulfilled);
  }
}

function makeDb(selectResults: unknown[][]) {
  let idx = 0;
  const where = jest.fn().mockResolvedValue(undefined);
  const values = jest.fn().mockResolvedValue(undefined);
  const txChain = { set: () => txChain, where, values };
  const update = jest.fn((..._args: unknown[]) => txChain);
  const insert = jest.fn((..._args: unknown[]) => txChain);
  const tx = { update, insert };

  const db = {
    select: () => new SelectChain(selectResults[idx++] ?? []),
    transaction: (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
  } as unknown as DrizzleDB;

  return { db, update };
}

function makeService(db: DrizzleDB, render?: jest.Mock) {
  const templateService = {
    render: render ?? jest.fn().mockResolvedValue("<html></html>"),
  } as unknown as EmailTemplateService;
  return new EmailTemplateRegistryService(db, templateService);
}

function templateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "tmpl-1",
    key: "transactional.order-confirmed", // no React renderer → body-source path
    name: "주문 확인",
    description: null,
    category: "transactional",
    isActive: true,
    currentVersionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function draftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "ver-2",
    templateId: "tmpl-1",
    version: 2,
    subject: "{{orderId}} 주문 완료",
    variableSchema: { orderId: { type: "string", required: true } },
    bodySource: "본문 {{orderId}}",
    status: "draft",
    changelog: null,
    createdBy: "admin-1",
    publishedAt: null,
    ...overrides,
  };
}

function getTemplateReads(template: unknown, versions: unknown[]) {
  return [[template], versions, []];
}

const tablesUpdated = (update: jest.Mock) => update.mock.calls.map((call) => call[0]);

describe("EmailTemplateRegistryService.publishTemplate", () => {
  it("throws 404 when the template key does not exist", async () => {
    const { db } = makeDb([[]]);
    const service = makeService(db);

    await expect(service.publishTemplate("missing.key", {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("throws 422 when there is no draft to publish", async () => {
    const { db } = makeDb([[templateRow()], []]);
    const service = makeService(db);

    await expect(
      service.publishTemplate("transactional.order-confirmed", {}),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("throws 422 when the stored variable schema is malformed", async () => {
    const draft = draftRow({ variableSchema: { amount: { type: "currency", required: true } } });
    const { db } = makeDb([[templateRow()], [draft]]);
    const service = makeService(db);

    await expect(
      service.publishTemplate("transactional.order-confirmed", {}),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("throws 422 when supplied preview variables violate the schema", async () => {
    const { db } = makeDb([[templateRow()], [draftRow()]]);
    const service = makeService(db);

    await expect(
      // orderId expects a string; a number is a type mismatch.
      service.publishTemplate("transactional.order-confirmed", {
        previewVariables: { orderId: 123 },
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("throws 422 when the subject references an unresolved variable", async () => {
    const draft = draftRow({ subject: "{{foo}} 안내", variableSchema: {}, bodySource: "본문" });
    const { db } = makeDb([[templateRow()], [draft]]);
    const service = makeService(db);

    // Empty schema → synthesized payload is empty → {{foo}} cannot resolve.
    await expect(
      service.publishTemplate("transactional.order-confirmed", {}),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("throws 422 when the draft has no body renderer and no body source", async () => {
    const draft = draftRow({ subject: "정적 제목", variableSchema: {}, bodySource: null });
    const { db } = makeDb([[templateRow()], [draft]]);
    const service = makeService(db);

    await expect(
      service.publishTemplate("transactional.order-confirmed", {}),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("publishes the draft and moves the currentVersionId pointer (synthesized payload)", async () => {
    const template = templateRow();
    const draft = draftRow();
    const published = draftRow({ status: "published", publishedAt: new Date() });
    const { db, update } = makeDb([
      [template], // findTemplateByKey
      [draft], // findLatestDraft
      ...getTemplateReads({ ...template, currentVersionId: "ver-2" }, [published]),
    ]);
    const service = makeService(db);

    // No previewVariables → service synthesizes { orderId: "샘플 orderId" } and renders OK.
    const detail = await service.publishTemplate("transactional.order-confirmed", {});

    const updated = tablesUpdated(update);
    expect(updated).toContain(emailTemplateVersions); // draft → published
    expect(updated).toContain(emailTemplates); // pointer move
    expect(detail.currentVersion).toBe(2);
    expect(detail.currentStatus).toBe("published");
  });

  it("accepts an explicit, schema-valid preview payload", async () => {
    const template = templateRow();
    const draft = draftRow();
    const published = draftRow({ status: "published", publishedAt: new Date() });
    const { db, update } = makeDb([
      [template],
      [draft],
      ...getTemplateReads({ ...template, currentVersionId: "ver-2" }, [published]),
    ]);
    const service = makeService(db);

    await service.publishTemplate("transactional.order-confirmed", {
      previewVariables: { orderId: "A-1024" },
    });

    expect(tablesUpdated(update)).toContain(emailTemplateVersions);
  });
});
