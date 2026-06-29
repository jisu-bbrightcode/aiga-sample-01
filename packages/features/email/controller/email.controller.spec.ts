import { GUARDS_METADATA } from "@nestjs/common/constants";
import { BetterAuthAdminGuard, BetterAuthGuard } from "@repo/core/nestjs/auth";
import type { EmailService } from "../service/email.service";
import type { EmailTemplateService } from "../service/email-template.service";
import type { EmailTemplateRegistryService } from "../service/email-template-registry.service";
import { EmailController } from "./email.controller";

const user = { id: "admin-1" } as never;

function makeController() {
  const emailService = {} as unknown as EmailService;
  const templateService = {} as unknown as EmailTemplateService;
  const templateRegistry = {
    createTemplate: jest.fn().mockResolvedValue({
      key: "transactional.order-confirmed",
      currentVersion: null,
      currentStatus: null,
      versions: [{ version: 1, status: "draft" }],
    }),
    listTemplates: jest.fn().mockResolvedValue([]),
    getTemplate: jest.fn().mockResolvedValue({ key: "auth.welcome" }),
    archiveTemplate: jest
      .fn()
      .mockResolvedValue({ key: "marketing.custom-blast", isActive: false }),
    restoreTemplate: jest.fn().mockResolvedValue({ key: "marketing.custom-blast", isActive: true }),
  } as unknown as jest.Mocked<EmailTemplateRegistryService>;
  const controller = new EmailController(emailService, templateService, templateRegistry);
  return { controller, templateRegistry };
}

describe("EmailController — admin-only guards", () => {
  // AC (BBR-657 & BBR-658): template management/read is admin-only. The
  // class-level guards enforce authentication (BetterAuthGuard) then admin role
  // (BetterAuthAdminGuard) before any handler runs.
  it("guards the controller with BetterAuthGuard + BetterAuthAdminGuard", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, EmailController);
    expect(Array.isArray(guards)).toBe(true);
    expect(guards).toContain(BetterAuthGuard);
    expect(guards).toContain(BetterAuthAdminGuard);
  });
});

describe("EmailController.createTemplate (BBR-658)", () => {
  it("forwards the authenticated admin id and body to the registry service", async () => {
    const { controller, templateRegistry } = makeController();
    const dto = {
      key: "transactional.order-confirmed",
      name: "주문 확인",
      subject: "{{orderId}} 주문 완료",
      variableSchema: { orderId: { type: "string", required: true } },
    } as never;

    const result = await controller.createTemplate(user, dto);

    expect(templateRegistry.createTemplate).toHaveBeenCalledWith("admin-1", dto);
    expect(result).toMatchObject({ versions: [{ version: 1, status: "draft" }] });
  });
});

describe("EmailController — template read endpoints (BBR-657 / PB-NOTI-EMAIL-API-LIST-001)", () => {
  it("GET templates delegates to the registry list", async () => {
    const { controller, templateRegistry } = makeController();
    await controller.listTemplates();
    expect(templateRegistry.listTemplates).toHaveBeenCalledTimes(1);
  });

  it("GET templates/:key delegates to the registry detail lookup", async () => {
    const { controller, templateRegistry } = makeController();
    await controller.getTemplate("auth.welcome");
    expect(templateRegistry.getTemplate).toHaveBeenCalledWith("auth.welcome");
  });
});

describe("EmailController — archive/restore endpoints (BBR-660 / PB-NOTI-EMAIL-API-DELETE-001)", () => {
  it("DELETE templates/:key delegates to the registry archive", async () => {
    const { controller, templateRegistry } = makeController();
    const result = await controller.archiveTemplate("marketing.custom-blast");
    expect(templateRegistry.archiveTemplate).toHaveBeenCalledWith("marketing.custom-blast");
    expect(result).toMatchObject({ isActive: false });
  });

  it("POST templates/:key/restore delegates to the registry restore", async () => {
    const { controller, templateRegistry } = makeController();
    const result = await controller.restoreTemplate("marketing.custom-blast");
    expect(templateRegistry.restoreTemplate).toHaveBeenCalledWith("marketing.custom-blast");
    expect(result).toMatchObject({ isActive: true });
  });
});
