import { UnprocessableEntityException } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import type { EmailTemplateService } from "./email-template.service";
import {
  type CreateTemplateInput,
  EmailTemplateRegistryService,
} from "./email-template-registry.service";

/**
 * createTemplate-focused tests (PB-NOTI-EMAIL-API-CREATE-001 / BBR-658).
 *
 * The registry-read tests in `email-template-registry.service.spec.ts` only
 * exercise `select`. Create additionally needs `transaction` + `insert(...).
 * values(...).returning()`, so this mock models the write path: a thenable
 * chain for the dup-key `select`, and a transaction whose `tx` dequeues a
 * pre-seeded row for each `.returning()`.
 */
class WriteChain {
  constructor(private readonly value: unknown) {}
  select() {
    return this;
  }
  from() {
    return this;
  }
  where() {
    return this;
  }
  limit() {
    return this;
  }
  insert() {
    return this;
  }
  values() {
    return this;
  }
  returning() {
    return Promise.resolve(this.value);
  }
  // biome-ignore lint/suspicious/noThenProperty: thenable so `await chain` resolves the mocked select result
  then<T>(onFulfilled: (value: unknown) => T) {
    return Promise.resolve(this.value).then(onFulfilled);
  }
}

interface MockDbOptions {
  /** Row returned by the duplicate-key pre-check select (empty = no dup). */
  existing?: unknown[];
  /** Rows handed out by successive tx `.returning()` calls (template, version). */
  inserted?: unknown[][];
  /** When set, `transaction` rejects with this (e.g. a unique-violation race). */
  txError?: unknown;
}

function makeDb(options: MockDbOptions = {}) {
  const inserted = options.inserted ?? [];
  let insertIdx = 0;

  const tx = {
    insert: () => tx,
    values: () => tx,
    returning: () => Promise.resolve(inserted[insertIdx++] ?? []),
  };

  return {
    select: () => new WriteChain(options.existing ?? []),
    transaction: (cb: (t: typeof tx) => Promise<unknown>) =>
      options.txError ? Promise.reject(options.txError) : cb(tx),
  } as unknown as DrizzleDB;
}

function makeService(db: DrizzleDB) {
  const templateService = { render: jest.fn() } as unknown as EmailTemplateService;
  return new EmailTemplateRegistryService(db, templateService);
}

const VALID_INPUT: CreateTemplateInput = {
  key: "transactional.order-confirmed",
  name: "주문 확인",
  description: "주문 완료 안내",
  category: "transactional",
  subject: "{{orderId}} 주문이 완료되었습니다",
  variableSchema: {
    orderId: { type: "string", required: true },
    total: { type: "number", required: false },
  },
};

function templateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "tmpl-1",
    key: VALID_INPUT.key,
    name: VALID_INPUT.name,
    description: VALID_INPUT.description ?? null,
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
    subject: VALID_INPUT.subject,
    variableSchema: { orderId: { type: "string", required: true } },
    bodySource: null,
    status: "draft",
    changelog: null,
    createdBy: "admin-1",
    publishedAt: null,
    ...overrides,
  };
}

describe("EmailTemplateRegistryService.createTemplate", () => {
  it("creates a template with an initial draft v1 (AC: draft 상태 + 버전 정보)", async () => {
    const db = makeDb({ existing: [], inserted: [[templateRow()], [versionRow()]] });
    const service = makeService(db);

    const detail = await service.createTemplate("admin-1", VALID_INPUT);

    expect(detail.key).toBe(VALID_INPUT.key);
    // No published pointer yet → current* are null.
    expect(detail.currentVersion).toBeNull();
    expect(detail.currentStatus).toBeNull();
    expect(detail.versions).toHaveLength(1);
    expect(detail.versions[0]?.version).toBe(1);
    expect(detail.versions[0]?.status).toBe("draft");
    expect(detail.versions[0]?.isCurrent).toBe(false);
  });

  it("rejects a duplicate key with 422 (AC)", async () => {
    const db = makeDb({ existing: [{ id: "already-there" }] });
    const service = makeService(db);

    await expect(service.createTemplate("admin-1", VALID_INPUT)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it("rejects an invalid variable schema with 422 before touching the DB (AC)", async () => {
    const db = makeDb({ existing: [], inserted: [[templateRow()], [versionRow()]] });
    const service = makeService(db);

    await expect(
      service.createTemplate("admin-1", {
        ...VALID_INPUT,
        variableSchema: { amount: { type: "currency", required: true } },
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("maps a concurrent unique-violation (23505) to 422", async () => {
    const db = makeDb({ existing: [], txError: { code: "23505" } });
    const service = makeService(db);

    await expect(service.createTemplate("admin-1", VALID_INPUT)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it("accepts an absent variable schema (optional)", async () => {
    const db = makeDb({
      existing: [],
      inserted: [[templateRow()], [versionRow({ variableSchema: null })]],
    });
    const service = makeService(db);

    const { variableSchema, ...withoutSchema } = VALID_INPUT;
    const detail = await service.createTemplate("admin-1", withoutSchema);

    expect(detail.versions[0]?.status).toBe("draft");
  });
});
