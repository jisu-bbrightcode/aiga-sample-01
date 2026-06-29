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
  } as unknown as jest.Mocked<EmailTemplateRegistryService>;
  const controller = new EmailController(emailService, templateService, templateRegistry);
  return { controller, templateRegistry };
}

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

  // AC: template management is admin-only. The class-level guards enforce
  // authentication (BetterAuthGuard) then admin role (BetterAuthAdminGuard).
  it("guards the controller with BetterAuthGuard + BetterAuthAdminGuard", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, EmailController);
    expect(guards).toContain(BetterAuthGuard);
    expect(guards).toContain(BetterAuthAdminGuard);
  });
});
