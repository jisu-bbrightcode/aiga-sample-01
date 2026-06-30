import { GUARDS_METADATA } from "@nestjs/common/constants";
import { BetterAuthAdminGuard, BetterAuthGuard } from "@repo/core/nestjs/auth";
import type { FileListService } from "../service";
import { FileAdminController, FileListController } from "./file-list.controller";

const user = { id: "user-1" } as never;

function service() {
  return {
    listOwnFiles: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
    listAdminFiles: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
  } as unknown as jest.Mocked<FileListService>;
}

describe("FileListController (GET /files)", () => {
  // AC#1: the owner scope comes from the authenticated session, never the query.
  it("forwards the authenticated user id and query to the service", async () => {
    const svc = service();
    const controller = new FileListController(svc);
    const query = { page: 1, limit: 20, status: "ready" } as never;

    const result = await controller.listOwnFiles(user, query);

    expect(svc.listOwnFiles).toHaveBeenCalledWith("user-1", query);
    expect(result).toMatchObject({ total: 0, page: 1 });
  });

  it("guards GET /files with BetterAuthGuard (no anonymous listing)", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, FileListController);
    expect(Array.isArray(guards)).toBe(true);
    expect(guards).toContain(BetterAuthGuard);
  });
});

describe("FileAdminController (GET /admin/files)", () => {
  it("forwards the filter query to the service", async () => {
    const svc = service();
    const controller = new FileAdminController(svc);
    const query = { page: 1, limit: 20, ownerUserId: "user-9", status: "deleted" } as never;

    const result = await controller.listAdminFiles(query);

    expect(svc.listAdminFiles).toHaveBeenCalledWith(query);
    expect(result).toMatchObject({ total: 0 });
  });

  // AC#2: the admin console is gated behind both auth and the admin role guard.
  it("guards GET /admin/files with BetterAuthGuard + BetterAuthAdminGuard", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, FileAdminController);
    expect(Array.isArray(guards)).toBe(true);
    expect(guards).toContain(BetterAuthGuard);
    expect(guards).toContain(BetterAuthAdminGuard);
  });
});
