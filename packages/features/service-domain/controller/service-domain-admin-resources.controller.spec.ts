import { GUARDS_METADATA } from "@nestjs/common/constants";
import { BetterAuthAdminGuard, BetterAuthGuard } from "@repo/core/nestjs/auth";
import type { ServiceDomainService } from "../service";
import { ServiceDomainAdminResourcesController } from "./service-domain-admin-resources.controller";

function service() {
  return {
    listAdminDomainResources: jest
      .fn()
      .mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
  } as unknown as jest.Mocked<ServiceDomainService>;
}

describe("ServiceDomainAdminResourcesController (GET /admin/domain/resources)", () => {
  it("forwards the validated query straight to the service", async () => {
    const svc = service();
    const controller = new ServiceDomainAdminResourcesController(svc);
    const query = { page: 2, limit: 20, type: "doctor", sort: "name", order: "asc" } as never;

    const result = await controller.listResources(query);

    expect(svc.listAdminDomainResources).toHaveBeenCalledWith(query);
    expect(result).toMatchObject({ total: 0, page: 1, totalPages: 0 });
  });

  // Security AC: the admin list must be gated like every other /api/admin/* route.
  it("is gated by BetterAuthGuard then BetterAuthAdminGuard (no anonymous access)", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ServiceDomainAdminResourcesController);
    expect(Array.isArray(guards)).toBe(true);
    expect(guards).toContain(BetterAuthGuard);
    expect(guards).toContain(BetterAuthAdminGuard);
  });
});
