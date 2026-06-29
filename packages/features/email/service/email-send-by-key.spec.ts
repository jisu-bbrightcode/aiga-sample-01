import { BadRequestException } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { EmailService } from "./email.service";
import type { EmailProviderService } from "./email-provider.service";
import type { EmailTemplateService } from "./email-template.service";
import type { EmailTemplateRegistryService } from "./email-template-registry.service";

/**
 * sendByKey: the key-based send path validates the published template's variable
 * schema BEFORE the provider is called (AC: 발송 전 검증), and records which
 * template version was used.
 */
function makeDb(inserted: Record<string, unknown>[]) {
  return {
    // checkDuplicateSend -> no recent log
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => [] }) }),
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

describe("EmailService.sendByKey", () => {
  it("validates before send: a failing template never reaches the provider", async () => {
    const inserted: Record<string, unknown>[] = [];
    const provider = { send: jest.fn() } as unknown as EmailProviderService;
    const registry = {
      renderByKey: jest.fn(() =>
        Promise.reject(new BadRequestException("이메일 변수 검증에 실패했습니다.")),
      ),
    } as unknown as EmailTemplateRegistryService;

    const service = new EmailService(
      makeDb(inserted),
      provider,
      {} as EmailTemplateService,
      registry,
    );

    await expect(
      service.sendByKey({
        key: "password.password-reset",
        recipientEmail: "user@aiga.app",
        variables: { userName: "홍길동" },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(registry.renderByKey).toHaveBeenCalledWith(
      "password.password-reset",
      { userName: "홍길동" },
      { requireValid: true },
    );
    expect(provider.send).not.toHaveBeenCalled();
    expect(inserted).toHaveLength(0);
  });

  it("on success logs the template key + version and sends the rendered subject/html", async () => {
    const inserted: Record<string, unknown>[] = [];
    const provider = {
      send: jest.fn(async () => ({ messageId: "msg-1", success: true })),
    } as unknown as EmailProviderService;
    const registry = {
      renderByKey: jest.fn(async () => ({
        key: "auth.welcome",
        templateVersionId: "ver-1",
        version: 1,
        status: "published",
        renderer: "welcome",
        subject: "AIGA에 오신 것을 환영합니다",
        html: "<html>welcome</html>",
        validation: { valid: true, issues: [], unknownVariables: [] },
        subjectMissing: [],
      })),
    } as unknown as EmailTemplateRegistryService;

    const service = new EmailService(
      makeDb(inserted),
      provider,
      {} as EmailTemplateService,
      registry,
    );

    const log = await service.sendByKey({
      key: "auth.welcome",
      recipientEmail: "user@aiga.app",
      recipientName: "홍길동",
      variables: { userName: "홍길동", loginUrl: "https://aiga.app/login" },
    });

    expect(inserted[0]).toMatchObject({
      templateType: "welcome",
      templateKey: "auth.welcome",
      templateVersionId: "ver-1",
      subject: "AIGA에 오신 것을 환영합니다",
      status: "pending",
    });
    expect(provider.send).toHaveBeenCalledWith({
      to: "user@aiga.app",
      subject: "AIGA에 오신 것을 환영합니다",
      html: "<html>welcome</html>",
    });
    expect(log.id).toBe("log-1");
  });
});
