import { NotFoundException } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { EmailService } from "./email.service";
import type { EmailProviderService } from "./email-provider.service";
import type { EmailTemplateService } from "./email-template.service";
import type { EmailTemplateRegistryService } from "./email-template-registry.service";
import type { ResendWebhookPayload } from "../webhooks/resend.payload.schema";

/**
 * QA regression — admin resend (재발송/재시도) + provider-event reconciliation
 * (발송 이력 상태 갱신). PB-NOTI-EMAIL-QA-001 / BBR-663.
 *
 * `EmailService.resendEmail` and `EmailService.recordProviderEvent` are exercised
 * end-to-end by the controller/webhook wiring but had no direct service-level
 * coverage. They are the two acceptance deliverables for this QA item:
 *   - 실패/재시도: resend re-dispatches a recorded log and tracks retryCount /
 *     failureReason / status transitions.
 *   - 발송 이력: webhook events reconcile a log's status with no-regression
 *     precedence (a later "opened" must not downgrade a "bounced" row).
 *
 * The mock DB is stateful: a single `email_logs` row that `update().set().where()`
 * mutates in place, so the second `getEmailLog` read inside `resendEmail` sees the
 * persisted update — mirroring real read-after-write behaviour.
 */

interface LogRow extends Record<string, unknown> {
  id: string;
  status: string;
  retryCount: number;
}

function makeStatefulDb(initial: Partial<LogRow> | null) {
  const state: { log: LogRow | null } = {
    log: initial
      ? {
          id: "log-1",
          recipientEmail: "user@aiga.app",
          recipientName: "User",
          templateType: "welcome",
          subject: "환영합니다",
          status: "pending",
          retryCount: 0,
          metadata: null,
          deliveredAt: null,
          openedAt: null,
          providerMessageId: null,
          ...initial,
        }
      : null,
  };

  let pending: Record<string, unknown> | null = null;
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (state.log ? [{ ...state.log }] : []),
        }),
      }),
    }),
    update: () => ({
      set: (vals: Record<string, unknown>) => {
        pending = vals;
        return {
          where: async () => {
            if (state.log && pending) {
              state.log = { ...state.log, ...pending } as LogRow;
            }
            pending = null;
            return undefined;
          },
        };
      },
    }),
  } as unknown as DrizzleDB;

  return { db, state };
}

function makeService(
  db: DrizzleDB,
  provider: EmailProviderService,
  templateService: Partial<EmailTemplateService> = {},
) {
  return new EmailService(
    db,
    provider,
    { render: jest.fn(() => Promise.resolve("<html>resend</html>")), ...templateService } as EmailTemplateService,
    {} as EmailTemplateRegistryService,
  );
}

function payload(type: string, data: Record<string, unknown> = {}): ResendWebhookPayload {
  return { type, data: { email_id: "provider-msg-1", ...data } } as ResendWebhookPayload;
}

describe("EmailService.resendEmail (재발송/재시도)", () => {
  it("throws NotFound when the log id does not exist", async () => {
    const { db } = makeStatefulDb(null);
    const provider = { send: jest.fn() } as unknown as EmailProviderService;
    const service = makeService(db, provider);

    await expect(service.resendEmail("missing")).rejects.toBeInstanceOf(NotFoundException);
    expect(provider.send).not.toHaveBeenCalled();
  });

  it("re-dispatches, marks the log sent and increments retryCount", async () => {
    const { db, state } = makeStatefulDb({ status: "failed", retryCount: 1 });
    const provider = {
      send: jest.fn(async () => ({ messageId: "provider-msg-2", success: true })),
    } as unknown as EmailProviderService;
    const service = makeService(db, provider);

    const result = await service.resendEmail("log-1");

    expect(provider.send).toHaveBeenCalledWith({
      to: "user@aiga.app",
      subject: "환영합니다",
      html: "<html>resend</html>",
    });
    expect(result.status).toBe("sent");
    expect(result.providerMessageId).toBe("provider-msg-2");
    expect(result.retryCount).toBe(2);
    expect(state.log?.sentAt).toBeInstanceOf(Date);
  });

  it("records failure (status/failureReason/retryCount) and rethrows on provider error", async () => {
    const { db, state } = makeStatefulDb({ status: "sent", retryCount: 0 });
    const provider = {
      send: jest.fn(() => Promise.reject(new Error("Resend 500"))),
    } as unknown as EmailProviderService;
    const service = makeService(db, provider);

    await expect(service.resendEmail("log-1")).rejects.toThrow("Resend 500");
    expect(state.log?.status).toBe("failed");
    expect(state.log?.failureReason).toBe("Resend 500");
    expect(state.log?.retryCount).toBe(1);
  });
});

describe("EmailService.recordProviderEvent (발송 이력 동기화)", () => {
  it("marks a sent log delivered and stamps deliveredAt", async () => {
    const { db, state } = makeStatefulDb({ status: "sent", providerMessageId: "provider-msg-1" });
    const service = makeService(db, { send: jest.fn() } as unknown as EmailProviderService);

    const result = await service.recordProviderEvent(payload("email.delivered"));

    expect(result).toEqual({ matched: true, status: "delivered" });
    expect(state.log?.status).toBe("delivered");
    expect(state.log?.deliveredAt).toBeInstanceOf(Date);
    expect((state.log?.metadata as Record<string, unknown>)?.lastProviderEvent).toBe(
      "email.delivered",
    );
  });

  it("marks a bounce terminal and captures the failure reason", async () => {
    const { db, state } = makeStatefulDb({ status: "sent", providerMessageId: "provider-msg-1" });
    const service = makeService(db, { send: jest.fn() } as unknown as EmailProviderService);

    const result = await service.recordProviderEvent(
      payload("email.bounced", { bounce: { type: "hard", message: "mailbox not found" } }),
    );

    expect(result.status).toBe("bounced");
    expect(state.log?.status).toBe("bounced");
    expect(state.log?.failureReason).toContain("bounce");
  });

  it("does not downgrade a bounced log when a later opened event arrives (no-regression)", async () => {
    const { db, state } = makeStatefulDb({ status: "bounced", providerMessageId: "provider-msg-1" });
    const service = makeService(db, { send: jest.fn() } as unknown as EmailProviderService);

    const result = await service.recordProviderEvent(payload("email.opened"));

    // opened(4) < bounced(6): status is preserved, but openedAt is still observed.
    expect(result.status).toBe("bounced");
    expect(state.log?.status).toBe("bounced");
    expect(state.log?.openedAt).toBeInstanceOf(Date);
  });

  it("returns matched:false when no log carries the provider message id", async () => {
    const { db } = makeStatefulDb(null);
    const service = makeService(db, { send: jest.fn() } as unknown as EmailProviderService);

    const result = await service.recordProviderEvent(payload("email.delivered"));

    expect(result).toEqual({ matched: false });
  });

  it("ignores event types that carry no status meaning (email.clicked)", async () => {
    const { db, state } = makeStatefulDb({ status: "delivered", providerMessageId: "provider-msg-1" });
    const service = makeService(db, { send: jest.fn() } as unknown as EmailProviderService);

    const result = await service.recordProviderEvent(payload("email.clicked"));

    expect(result).toEqual({ matched: false });
    expect(state.log?.status).toBe("delivered");
  });
});
