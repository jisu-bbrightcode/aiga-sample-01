import { GUARDS_METADATA } from "@nestjs/common/constants";
import { BetterAuthAdminGuard, BetterAuthGuard } from "@repo/core/nestjs/auth";
import type { FileMetadataService } from "../service";
import {
  FileMetadataAdminController,
  FileMetadataController,
} from "./file-metadata.controller";

const user = { id: "user-1" } as never;
const fileId = "11111111-1111-1111-1111-111111111111";

function service() {
  return {
    updateOwnFile: jest.fn().mockResolvedValue({ fileAssetId: fileId }),
    updateFileAsAdmin: jest.fn().mockResolvedValue({ fileAssetId: fileId }),
  } as unknown as jest.Mocked<FileMetadataService>;
}

describe("FileMetadataController (PATCH /files/:id)", () => {
  // AC#1/#2: the owner scope comes from the session, never the body.
  it("forwards the authenticated user id, file id, and patch to the service", async () => {
    const svc = service();
    const controller = new FileMetadataController(svc);
    const dto = { displayName: "profile.png", visibility: "private" } as never;

    const result = await controller.updateOwnFile(user, fileId, dto);

    expect(svc.updateOwnFile).toHaveBeenCalledWith("user-1", fileId, dto);
    expect(result).toMatchObject({ fileAssetId: fileId });
  });

  it("guards PATCH /files/:id with BetterAuthGuard (no anonymous edit)", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, FileMetadataController);
    expect(Array.isArray(guards)).toBe(true);
    expect(guards).toContain(BetterAuthGuard);
  });
});

describe("FileMetadataAdminController (PATCH /admin/files/:id)", () => {
  it("forwards the admin id, file id, and patch (incl. reviewStatus) to the service", async () => {
    const svc = service();
    const controller = new FileMetadataAdminController(svc);
    const dto = { reviewStatus: "approved", visibility: "public" } as never;

    const result = await controller.updateFileAsAdmin(user, fileId, dto);

    expect(svc.updateFileAsAdmin).toHaveBeenCalledWith("user-1", fileId, dto);
    expect(result).toMatchObject({ fileAssetId: fileId });
  });

  // AC#3 surface: admin edits are gated behind both auth and the admin role.
  it("guards PATCH /admin/files/:id with BetterAuthGuard + BetterAuthAdminGuard", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, FileMetadataAdminController);
    expect(Array.isArray(guards)).toBe(true);
    expect(guards).toContain(BetterAuthGuard);
    expect(guards).toContain(BetterAuthAdminGuard);
  });
});
