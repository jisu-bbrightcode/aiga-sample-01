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
    completeUpload: jest.fn().mockResolvedValue({
      fileAssetId: "01HX",
      status: "ready",
      pathname: "uploads/private/2026/06/01HX.png",
      url: "https://blob.example.com/uploads/private/2026/06/01HX.png",
      downloadUrl: null,
      contentType: "image/png",
      size: 100,
      visibility: "private",
      targetType: null,
      targetId: null,
      completedAt: "2026-06-30T00:00:00.000Z",
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

  it("forwards the authenticated user id and body to completeUpload", async () => {
    const svc = service();
    const controller = new FileUploadController(svc);

    const dto = { fileAssetId: "01HX" } as never;
    const result = await controller.completeUpload(user, dto);

    // AC#1/#4: only the asset id is forwarded — the caller can't inject a Blob
    // URL, and the service re-checks ownership against this user id.
    expect(svc.completeUpload).toHaveBeenCalledWith("user-1", dto);
    expect(result).toMatchObject({ fileAssetId: "01HX", status: "ready" });
  });

  // AC#1/#4: completion also re-verifies authorization — guarded so an
  // unauthenticated caller can never activate an asset.
  it("guards POST /files/uploads/complete with BetterAuthGuard", () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      FileUploadController.prototype.completeUpload,
    );
    expect(Array.isArray(guards)).toBe(true);
    expect(guards).toContain(BetterAuthGuard);
  });
});
