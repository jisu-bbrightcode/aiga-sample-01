import { GUARDS_METADATA } from "@nestjs/common/constants";
import { BetterAuthAdminGuard, BetterAuthGuard } from "@repo/core/nestjs/auth";
import type { FileDetailService } from "../service";
import { FileAdminDetailController, FileDetailController } from "./file-detail.controller";

const user = { id: "user-1" } as never;

function service() {
  return {
    getAccessibleById: jest.fn().mockResolvedValue({ fileAssetId: "f1", access: "owner" }),
    getAdminById: jest.fn().mockResolvedValue({ fileAssetId: "f1" }),
  } as unknown as jest.Mocked<FileDetailService>;
}

describe("FileDetailController (GET /files/:id)", () => {
  // AC#1/#3: the optional viewer is forwarded so the service can apply the
  // public/owner access policy.
  it("forwards the id and the optional user to the service", async () => {
    const svc = service();
    const controller = new FileDetailController(svc);

    const result = await controller.getFile("f1", user);

    expect(svc.getAccessibleById).toHaveBeenCalledWith("f1", user);
    expect(result).toMatchObject({ access: "owner" });
  });

  it("forwards undefined for an anonymous caller (public file access)", async () => {
    const svc = service();
    const controller = new FileDetailController(svc);

    await controller.getFile("f1", undefined);

    expect(svc.getAccessibleById).toHaveBeenCalledWith("f1", undefined);
  });

  // AC#2: the public detail route is intentionally unguarded so anonymous
  // callers can read public files; the policy (not a guard) protects private ones.
  it("does not put an auth guard on GET /files/:id", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, FileDetailController);
    expect(guards).toBeFalsy();
  });
});

describe("FileAdminDetailController (GET /admin/files/:id)", () => {
  it("forwards the id to the service", async () => {
    const svc = service();
    const controller = new FileAdminDetailController(svc);

    const result = await controller.getAdminFile("f1");

    expect(svc.getAdminById).toHaveBeenCalledWith("f1");
    expect(result).toMatchObject({ fileAssetId: "f1" });
  });

  it("guards GET /admin/files/:id with BetterAuthGuard + BetterAuthAdminGuard", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, FileAdminDetailController);
    expect(Array.isArray(guards)).toBe(true);
    expect(guards).toContain(BetterAuthGuard);
    expect(guards).toContain(BetterAuthAdminGuard);
  });
});
