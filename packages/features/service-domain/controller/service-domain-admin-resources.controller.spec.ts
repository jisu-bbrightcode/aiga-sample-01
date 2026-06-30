import { GUARDS_METADATA } from "@nestjs/common/constants";
import { BetterAuthAdminGuard, BetterAuthGuard } from "@repo/core/nestjs/auth";
import type { ServiceDomainService } from "../service";
import { ServiceDomainAdminResourcesController } from "./service-domain-admin-resources.controller";

function service() {
  return {
    listAdminDomainResources: jest
      .fn()
      .mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
    archiveDomainResource: jest.fn().mockResolvedValue({
      type: "doctor",
      id: "d1",
      name: "n",
      slug: "s",
      status: "archived",
      isDeleted: false,
    }),
    restoreDomainResource: jest.fn().mockResolvedValue({
      type: "doctor",
      id: "d1",
      name: "n",
      slug: "s",
      status: "draft",
      isDeleted: false,
    }),
    createDoctor: jest.fn().mockResolvedValue({ id: "doc-1", type: "doctor" }),
    createHospital: jest.fn().mockResolvedValue({ id: "hos-1", type: "hospital" }),
    updateDoctor: jest.fn().mockResolvedValue({ id: "d1", type: "doctor", status: "draft" }),
    updateHospital: jest.fn().mockResolvedValue({ id: "h1", type: "hospital", status: "draft" }),
    changeDomainResourceStatus: jest.fn().mockResolvedValue({
      type: "doctor",
      id: "d1",
      name: "n",
      slug: "s",
      status: "published",
      isDeleted: false,
    }),
    getDomainResourceHistory: jest.fn().mockResolvedValue({ rows: [], nextCursor: null }),
  } as unknown as jest.Mocked<ServiceDomainService>;
}

const adminUser = { id: "admin-1" } as never;

describe("ServiceDomainAdminResourcesController (GET /admin/domain/resources)", () => {
  it("forwards the validated query straight to the service", async () => {
    const svc = service();
    const controller = new ServiceDomainAdminResourcesController(svc);
    const query = { page: 2, limit: 20, type: "doctor", sort: "name", order: "asc" } as never;

    const result = await controller.listResources(query);

    expect(svc.listAdminDomainResources).toHaveBeenCalledWith(query);
    expect(result).toMatchObject({ total: 0, page: 1, totalPages: 0 });
  });

  it("forwards archive with the current actor + path params", async () => {
    const svc = service();
    const controller = new ServiceDomainAdminResourcesController(svc);

    const result = await controller.archiveResource(
      { id: "admin-1" } as never,
      { type: "doctor", id: "d1" } as never,
    );

    expect(svc.archiveDomainResource).toHaveBeenCalledWith("admin-1", "doctor", "d1");
    expect(result).toMatchObject({ status: "archived" });
  });

  it("forwards restore with the current actor + path params", async () => {
    const svc = service();
    const controller = new ServiceDomainAdminResourcesController(svc);

    const result = await controller.restoreResource(
      { id: "admin-1" } as never,
      { type: "doctor", id: "d1" } as never,
    );

    expect(svc.restoreDomainResource).toHaveBeenCalledWith("admin-1", "doctor", "d1");
    expect(result).toMatchObject({ status: "draft" });
  });

  it("forwards a doctor create to the service with the actor id (BBR-680)", async () => {
    const svc = service();
    const controller = new ServiceDomainAdminResourcesController(svc);
    const dto = { name: "김명의", slug: "kim", status: "draft" } as never;

    const result = await controller.createDoctor(adminUser, dto);

    expect(svc.createDoctor).toHaveBeenCalledWith("admin-1", dto);
    expect(result).toMatchObject({ id: "doc-1" });
  });

  it("forwards a hospital create to the service with the actor id (BBR-680)", async () => {
    const svc = service();
    const controller = new ServiceDomainAdminResourcesController(svc);
    const dto = { name: "서울병원", slug: "seoul", status: "draft" } as never;

    const result = await controller.createHospital(adminUser, dto);

    expect(svc.createHospital).toHaveBeenCalledWith("admin-1", dto);
    expect(result).toMatchObject({ id: "hos-1" });
  });

  // Security AC: the admin list must be gated like every other /api/admin/* route.
  it("is gated by BetterAuthGuard then BetterAuthAdminGuard (no anonymous access)", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ServiceDomainAdminResourcesController);
    expect(Array.isArray(guards)).toBe(true);
    expect(guards).toContain(BetterAuthGuard);
    expect(guards).toContain(BetterAuthAdminGuard);
  });

  it("forwards a doctor update with the actor id (BBR-681)", async () => {
    const svc = service();
    const controller = new ServiceDomainAdminResourcesController(svc);
    const dto = { shortBio: "갱신" } as never;

    await controller.updateDoctor(adminUser, "d1", dto);

    expect(svc.updateDoctor).toHaveBeenCalledWith("admin-1", "d1", dto);
  });

  it("forwards a hospital update with the actor id (BBR-681)", async () => {
    const svc = service();
    const controller = new ServiceDomainAdminResourcesController(svc);
    const dto = { summary: "갱신" } as never;

    await controller.updateHospital(adminUser, "h1", dto);

    expect(svc.updateHospital).toHaveBeenCalledWith("admin-1", "h1", dto);
  });

  it("forwards a status change with the actor, params, and target status (BBR-681)", async () => {
    const svc = service();
    const controller = new ServiceDomainAdminResourcesController(svc);

    const result = await controller.changeStatus(
      adminUser,
      { type: "doctor", id: "d1" } as never,
      { status: "published" } as never,
    );

    expect(svc.changeDomainResourceStatus).toHaveBeenCalledWith(
      "admin-1",
      "doctor",
      "d1",
      "published",
    );
    expect(result).toMatchObject({ status: "published" });
  });

  it("forwards a history read with the params + cursor query (BBR-681)", async () => {
    const svc = service();
    const controller = new ServiceDomainAdminResourcesController(svc);

    const result = await controller.getResourceHistory(
      { type: "hospital", id: "h1" } as never,
      { limit: 50 } as never,
    );

    expect(svc.getDomainResourceHistory).toHaveBeenCalledWith("hospital", "h1", {
      cursor: undefined,
      limit: 50,
    });
    expect(result).toMatchObject({ rows: [], nextCursor: null });
  });
});
