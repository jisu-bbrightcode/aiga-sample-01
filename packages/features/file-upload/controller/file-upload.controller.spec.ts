import { GUARDS_METADATA } from "@nestjs/common/constants";
import { BetterAuthGuard } from "@repo/core/nestjs/auth";
import type { FileUploadService } from "../service";
import { FileUploadController } from "./file-upload.controller";

const user = { id: "user-1" } as never;

function service() {
  return {
    createUpload: jest.fn().mockResolvedValue({
      fileAssetId: "01HX",
      pathname: "uploads/private/2026/06/01HX.png",
      clientToken: "tok",
      contentType: "image/png",
      maximumSizeInBytes: 100,
      visibility: "private",
      expiresAt: "2026-06-30T00:00:00.000Z",
    }),
  } as unknown as jest.Mocked<FileUploadService>;
}

describe("FileUploadController", () => {
  it("forwards the authenticated user id and body to the service", async () => {
    const svc = service();
    const controller = new FileUploadController(svc);

    const dto = {
      filename: "a.png",
      contentType: "image/png",
      size: 100,
      visibility: "private",
    } as never;
    const result = await controller.createUpload(user, dto);

    expect(svc.createUpload).toHaveBeenCalledWith("user-1", dto);
    expect(result).toMatchObject({ fileAssetId: "01HX", clientToken: "tok" });
  });

  // AC#1: unauthenticated callers must not receive a token. Enforced by guarding
  // the route with BetterAuthGuard (Nest returns 401 before the handler runs).
  it("guards POST /files/uploads with BetterAuthGuard", () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      FileUploadController.prototype.createUpload,
    );
    expect(Array.isArray(guards)).toBe(true);
    expect(guards).toContain(BetterAuthGuard);
  });
});
