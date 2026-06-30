import { HttpException, HttpStatus } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { EmailService } from "./email.service";
import type { EmailProviderService } from "./email-provider.service";
import type { EmailTemplateService } from "./email-template.service";
import type { EmailTemplateRegistryService } from "./email-template-registry.service";

/**
 * sendTestEmail (PB-NOTI-EMAIL-SEND-001 / BBR-661).
 *
 * Operator test send: renders the published template (synthesizing sample
 * variables when none are supplied), sends through the provider and records the
 * result. Test sends are rate-limited per (template, recipient) and never throw
 * on provider failure — the failed log is returned so the operator sees why.
 */
function makeDb(opts: { rateRows?: unknown[]; inserted?: Record<string, unknown>[] }) {
  const inserted = opts.inserted ?? [];
  return {
    // assertTestSendRate -> select({id}).from().where().limit()
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => opts.rateRows ?? [],
        }),
      }),
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        inserted.push(values);
        return { returning: async () => [{ id: "log-1", retryCount: 0, ...values }] };
      },
    }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  } as unknown as DrizzleDB;
}

function makeRendered(overrides: Record<string, unknown> = {}) {
  return {
    key: "auth.welcome",
    templateVersionId: "ver-1",
    version: 1,
    status: "published",
    renderer: "welcome",
    subject: "환영합니다",
    html: "<html>welcome</html>",
    validation: { valid: true, issues: [], unknownVariables: [] },
    subjectMissing: [],
    ...overrides,
  };
}

describe("EmailService.sendTestEmail", () => {
  it("synthesizes sample variables from the schema when none are supplied", async () => {
    const inserted: Record<string, unknown>[] = [];
    const provider = {
      send: jest.fn(async () => ({ messageId: "msg-1", success: true })),
    } as unknown as EmailProviderService;
    const registry = {
      resolvePublishedVersion: jest.fn(async () => ({
        schema: { userName: { type: "string", required: true } },
      })),
      renderByKey: jest.fn(async () => makeRendered()),
    } as unknown as EmailTemplateRegistryService;

    const service = new EmailService(
      makeDb({ inserted }),
      provider,
      {} as EmailTemplateService,
      registry,
    );

    const log = await service.sendTestEmail({
      key: "auth.welcome",
      recipientEmail: "ops@aiga.app",
      actorUserId: "admin-1",
    });

    expect(registry.resolvePublishedVersion).toHaveBeenCalledWith("auth.welcome");
    // sample synthesized from schema, then rendered with requireValid
    expect(registry.renderByKey).toHaveBeenCalledWith(
      "auth.welcome",
      { userName: "샘플 userName" },
      { requireValid: true },
    );
    expect(provider.send).toHaveBeenCalledTimes(1);
    expect(inserted[0]?.metadata).toMatchObject({
      userName: "샘플 userName",
      test: true,
      sentBy: "admin-1",
    });
    expect(log.status).toBe("sent");
    expect(log.providerMessageId).toBe("msg-1");
  });

  it("uses operator-supplied variables and does not synthesize a sample", async () => {
    const provider = {
      send: jest.fn(async () => ({ messageId: "msg-2", success: true })),
    } as unknown as EmailProviderService;
    const registry = {
      resolvePublishedVersion: jest.fn(),
      renderByKey: jest.fn(async () => makeRendered()),
    } as unknown as EmailTemplateRegistryService;

    const service = new EmailService(makeDb({}), provider, {} as EmailTemplateService, registry);

    await service.sendTestEmail({
      key: "auth.welcome",
      recipientEmail: "ops@aiga.app",
      variables: { userName: "QA", loginUrl: "https://aiga.app/login" },
    });

    expect(registry.resolvePublishedVersion).not.toHaveBeenCalled();
    expect(registry.renderByKey).toHaveBeenCalledWith(
      "auth.welcome",
      { userName: "QA", loginUrl: "https://aiga.app/login" },
      { requireValid: true },
    );
  });

  it("records the failure reason and returns the log without throwing when the provider fails", async () => {
    const inserted: Record<string, unknown>[] = [];
    const provider = {
      send: jest.fn(async () => {
        throw new Error("Resend 500");
      }),
    } as unknown as EmailProviderService;
    const registry = {
      renderByKey: jest.fn(async () => makeRendered()),
    } as unknown as EmailTemplateRegistryService;

    const service = new EmailService(
      makeDb({ inserted }),
      provider,
      {} as EmailTemplateService,
      registry,
    );

    const log = await service.sendTestEmail({
      key: "auth.welcome",
      recipientEmail: "ops@aiga.app",
      variables: { userName: "QA", loginUrl: "https://aiga.app/login" },
    });

    expect(log.status).toBe("failed");
    expect(log.failureReason).toBe("Resend 500");
  });

  it("rejects with 429 when the test-send rate limit is exceeded", async () => {
    const provider = { send: jest.fn() } as unknown as EmailProviderService;
    const registry = { renderByKey: jest.fn() } as unknown as EmailTemplateRegistryService;
    // five rows already in the window -> at the limit
    const rateRows = [1, 2, 3, 4, 5];

    const service = new EmailService(
      makeDb({ rateRows }),
      provider,
      {} as EmailTemplateService,
      registry,
    );

    let error: unknown;
    try {
      await service.sendTestEmail({
        key: "auth.welcome",
        recipientEmail: "ops@aiga.app",
        variables: { userName: "QA", loginUrl: "https://aiga.app/login" },
      });
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(registry.renderByKey).not.toHaveBeenCalled();
    expect(provider.send).not.toHaveBeenCalled();
  });
});
