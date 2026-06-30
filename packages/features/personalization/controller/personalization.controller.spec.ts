import { GUARDS_METADATA } from "@nestjs/common/constants";
import { BetterAuthGuard } from "@repo/core/nestjs/auth";
import type { PersonalizationService } from "../service";
import { PersonalizationController } from "./personalization.controller";

const user = { id: "user-1" } as never;

function service() {
  return {
    createSavedItem: jest.fn().mockResolvedValue({ id: "s1", created: true }),
    createInterest: jest.fn().mockResolvedValue({ id: "i1", created: true }),
    updateSavedItem: jest.fn().mockResolvedValue({ id: "s1", memo: "edited" }),
    removeSavedItem: jest.fn().mockResolvedValue(undefined),
    removeInterest: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<PersonalizationService>;
}

describe("PersonalizationController — create (BBR-726)", () => {
  it("forwards the authenticated user id + body to createSavedItem", async () => {
    const svc = service();
    const controller = new PersonalizationController(svc);
    const dto = { targetType: "doctor", targetId: "uuid" } as never;

    await controller.createSavedItem(user, dto);

    expect(svc.createSavedItem).toHaveBeenCalledWith("user-1", dto);
  });

  it("forwards the authenticated user id + body to createInterest", async () => {
    const svc = service();
    const controller = new PersonalizationController(svc);
    const dto = { targetType: "hospital", targetId: "uuid" } as never;

    await controller.createInterest(user, dto);

    expect(svc.createInterest).toHaveBeenCalledWith("user-1", dto);
  });

  it("forwards the authenticated user id + path id + body to updateSavedItem", async () => {
    const svc = service();
    const controller = new PersonalizationController(svc);
    const id = "11111111-1111-1111-1111-111111111111";
    const dto = { memo: "edited", tags: ["t"] } as never;

    await controller.updateSavedItem(user, id, dto);

    expect(svc.updateSavedItem).toHaveBeenCalledWith("user-1", id, dto);
  });

  it("forwards the authenticated user id + path id to removeSavedItem (해제)", async () => {
    const svc = service();
    const controller = new PersonalizationController(svc);
    const id = "22222222-2222-2222-2222-222222222222";

    await controller.removeSavedItem(user, id);

    expect(svc.removeSavedItem).toHaveBeenCalledWith("user-1", id);
  });

  it("forwards the authenticated user id + path id to removeInterest (해제)", async () => {
    const svc = service();
    const controller = new PersonalizationController(svc);
    const id = "33333333-3333-3333-3333-333333333333";

    await controller.removeInterest(user, id);

    expect(svc.removeInterest).toHaveBeenCalledWith("user-1", id);
  });

  // 인증 필수: the guard is declared at class level, so it covers the POST
  // create routes (and every other route) — unauthenticated callers get 401
  // before any handler runs.
  it("guards the controller (incl. create routes) with BetterAuthGuard", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, PersonalizationController);
    expect(guards).toContain(BetterAuthGuard);
  });
});
