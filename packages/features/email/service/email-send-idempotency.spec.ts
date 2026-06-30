import type { DrizzleDB } from "@repo/drizzle";
import { EmailService } from "./email.service";
import type { EmailProviderService } from "./email-provider.service";
import type { EmailTemplateService } from "./email-template.service";
import type { EmailTemplateRegistryService } from "./email-template-registry.service";

/**
 * sendByKey idempotency (PB-NOTI-EMAIL-SEND-001 / BBR-661).
 *
 * When a caller supplies an idempotency key, a retried send must NOT re-invoke
 * the provider: the prior log is returned. A concurrent insert that loses the
 * unique-index race is also treated as idempotent rather than surfacing a 500.
 */
function makeDb(opts: {
  selectResults?: unknown[][];
  inserted?: Record<string, unknown>[];
  insertError?: unknown;
}) {
  const selectQueue = [...(opts.selectResults ?? [])];
  const inserted = opts.inserted ?? [];
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => selectQueue.shift() ?? [],
        }),
      }),
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        inserted.push(values);
        return {
          returning: async () => {
            if (opts.insertError) {
              throw opts.insertError;
            }
            return [{ id: "log-1", retryCount: 0, ...values }];
          },
        };
      },
    }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  } as unknown as DrizzleDB;
}

function makeRegistry() {
  return {
    renderByKey: jest.fn(async () => ({
      key: "auth.welcome",
      templateVersionId: "ver-1",
      version: 1,
      status: "published",
      renderer: "welcome",
      subject: "환영합니다",
      html: "<html>welcome</html>",
      validation: { valid: true, issues: [], unknownVariables: [] },
      subjectMissing: [],
    })),
  } as unknown as EmailTemplateRegistryService;
}

describe("EmailService.sendByKey — idempotency", () => {
  it("returns the existing log without re-sending when the idempotency key matches", async () => {
    const existing = { id: "existing-log", status: "sent", providerMessageId: "msg-prev" };
    const inserted: Record<string, unknown>[] = [];
    const provider = { send: jest.fn() } as unknown as EmailProviderService;

    const service = new EmailService(
      makeDb({ selectResults: [[existing]], inserted }),
      provider,
      {} as EmailTemplateService,
      makeRegistry(),
    );

    const log = await service.sendByKey({
      key: "auth.welcome",
      recipientEmail: "user@aiga.app",
      variables: { userName: "홍길동", loginUrl: "https://aiga.app/login" },
      idempotencyKey: "order-123",
    });

    expect(log).toBe(existing);
    expect(provider.send).not.toHaveBeenCalled();
    expect(inserted).toHaveLength(0);
  });

  it("persists the idempotency key on the first send", async () => {
    const inserted: Record<string, unknown>[] = [];
    const provider = {
      send: jest.fn(async () => ({ messageId: "msg-1", success: true })),
    } as unknown as EmailProviderService;

    const service = new EmailService(
      makeDb({ selectResults: [[]], inserted }),
      provider,
      {} as EmailTemplateService,
      makeRegistry(),
    );

    const log = await service.sendByKey({
      key: "auth.welcome",
      recipientEmail: "user@aiga.app",
      variables: { userName: "홍길동", loginUrl: "https://aiga.app/login" },
      idempotencyKey: "order-123",
    });

    expect(inserted[0]).toMatchObject({ idempotencyKey: "order-123", status: "pending" });
    expect(provider.send).toHaveBeenCalledTimes(1);
    expect(log.status).toBe("sent");
  });

  it("treats a unique-index race as idempotent and returns the winning log", async () => {
    const winner = { id: "winner-log", status: "sent" };
    const inserted: Record<string, unknown>[] = [];
    const provider = { send: jest.fn() } as unknown as EmailProviderService;

    // 1st select (pre-check) -> none; insert -> 23505; 2nd select -> winner.
    const service = new EmailService(
      makeDb({ selectResults: [[], [winner]], inserted, insertError: { code: "23505" } }),
      provider,
      {} as EmailTemplateService,
      makeRegistry(),
    );

    const log = await service.sendByKey({
      key: "auth.welcome",
      recipientEmail: "user@aiga.app",
      variables: { userName: "홍길동", loginUrl: "https://aiga.app/login" },
      idempotencyKey: "order-123",
    });

    expect(log).toBe(winner);
    expect(provider.send).not.toHaveBeenCalled();
  });
});
