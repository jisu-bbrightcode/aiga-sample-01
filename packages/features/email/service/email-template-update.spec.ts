import { NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { emailTemplates, emailTemplateVersions } from "@repo/drizzle/schema";
import type { EmailTemplateService } from "./email-template.service";
import {
  EmailTemplateRegistryService,
  type UpdateTemplateInput,
} from "./email-template-registry.service";

/**
 * updateTemplate-focused tests (PB-NOTI-EMAIL-API-UPDATE-001 / BBR-659).
 *
 * AC#1: 수정은 기존 published 버전을 깨지 않고 새 draft/version으로 관리된다.
 *   - latest version is a DRAFT → edited in place (no new version).
 *   - latest version is PUBLISHED → a NEW draft is forked (published untouched).
 *
 * The mock models the read/write split: `select()` dequeues a pre-seeded result
 * per call, and `transaction(cb)` hands `cb` a tx whose update/insert calls are
 * spies so we can assert which write path ran without a real DB.
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

  return { db, update, insert };
}

function makeService(db: DrizzleDB) {
  const templateService = { render: jest.fn() } as unknown as EmailTemplateService;
  return new EmailTemplateRegistryService(db, templateService);
}

function templateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "tmpl-1",
    key: "transactional.order-confirmed",
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

function versionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "ver-1",
    templateId: "tmpl-1",
    version: 1,
    subject: "{{orderId}} 주문 완료",
    variableSchema: { orderId: { type: "string", required: true } },
    bodySource: "본문",
    status: "draft",
    changelog: null,
    createdBy: "admin-1",
    publishedAt: null,
    ...overrides,
  };
}

/** Select results for the final `getTemplate(key)` re-read (3 selects). */
function getTemplateReads(template: unknown, versions: unknown[]) {
  return [[template], versions, []];
}

const tablesUpdated = (update: jest.Mock) => update.mock.calls.map((call) => call[0]);

describe("EmailTemplateRegistryService.updateTemplate", () => {
  it("throws 404 when the template key does not exist", async () => {
    const { db } = makeDb([[]]);
    const service = makeService(db);

    await expect(
      service.updateTemplate("missing.key", "admin-1", { name: "x" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects a malformed variableSchema with 422 (no write)", async () => {
    const { db, update, insert } = makeDb([[templateRow()]]);
    const service = makeService(db);

    await expect(
      service.updateTemplate("transactional.order-confirmed", "admin-1", {
        variableSchema: { amount: { type: "currency", required: true } },
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(update).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("edits the working draft in place when the latest version is a draft (AC#1)", async () => {
    const template = templateRow();
    const draft = versionRow({ status: "draft" });
    const { db, update, insert } = makeDb([
      [template], // findTemplateByKey
      [draft], // findLatestVersion
      ...getTemplateReads(template, [draft]),
    ]);
    const service = makeService(db);

    const input: UpdateTemplateInput = { subject: "{{orderId}} 변경됨" };
    await service.updateTemplate("transactional.order-confirmed", "admin-1", input);

    // Draft updated in place → no new version inserted.
    expect(insert).not.toHaveBeenCalled();
    expect(tablesUpdated(update)).toContain(emailTemplateVersions);
  });

  it("forks a NEW draft when the latest version is published — published untouched (AC#1)", async () => {
    const template = templateRow({ currentVersionId: "ver-1" });
    const published = versionRow({ id: "ver-1", status: "published", version: 1 });
    const { db, update, insert } = makeDb([
      [template], // findTemplateByKey
      [published], // findLatestVersion (published)
      ...getTemplateReads(template, [published]),
    ]);
    const service = makeService(db);

    await service.updateTemplate("transactional.order-confirmed", "admin-1", {
      subject: "{{orderId}} 새 초안",
    });

    // A new draft version is inserted; the template row is only touched (updatedAt).
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0]?.[0]).toBe(emailTemplateVersions);
    expect(tablesUpdated(update)).toContain(emailTemplates);
    // The published version row itself is never updated.
    expect(tablesUpdated(update)).not.toContain(emailTemplateVersions);
  });

  it("updates only the template row for metadata-only changes (no version read/write)", async () => {
    const template = templateRow();
    const { db, update, insert } = makeDb([
      [template], // findTemplateByKey
      ...getTemplateReads(template, [versionRow()]),
    ]);
    const service = makeService(db);

    await service.updateTemplate("transactional.order-confirmed", "admin-1", {
      name: "주문 확인 v2",
      isActive: false,
    });

    expect(insert).not.toHaveBeenCalled();
    expect(tablesUpdated(update)).toEqual([emailTemplates]);
  });
});
