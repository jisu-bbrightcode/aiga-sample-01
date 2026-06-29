import type { User } from "@repo/core/nestjs/auth";
import type { ServiceSearchService } from "../service";
import { ServiceSearchController } from "./service-search.controller";
import { ServiceSearchAdminController } from "./service-search-admin.controller";

/**
 * 통합 상세 조회 controller wiring (FR-003 detail / BBR-532).
 *
 * The detail handlers are thin: they delegate to the service and attach the
 * viewer state appropriate to their permission tier. These tests pin that
 * contract — public never reports the privileged view; admin always does.
 */

const PUBLIC_HIT = {
  entityType: "doctor" as const,
  entityId: "22222222-2222-2222-2222-222222222222",
  title: "김명의",
  subtitle: "정형외과 · 강남구",
  slug: "kim-myeongui",
  photoUrl: null,
  regionId: null,
  specialtyId: null,
  ratingAvg: 4.8,
};

const ADMIN_HIT = {
  ...PUBLIC_HIT,
  id: "11111111-1111-1111-1111-111111111111",
  body: "internal bio",
  keywords: "ortho",
  weight: 100,
  isPublished: false,
  sourceUpdatedAt: null,
  createdAt: null,
  updatedAt: null,
};

describe("ServiceSearchController.detail (public)", () => {
  const getPublicDetail = jest.fn().mockResolvedValue(PUBLIC_HIT);
  const service = { getPublicDetail } as unknown as ServiceSearchService;
  const controller = new ServiceSearchController(service);

  beforeEach(() => getPublicDetail.mockClear());

  it("delegates to getPublicDetail and reports an anonymous, non-privileged viewer", async () => {
    const res = await controller.detail("doctor", PUBLIC_HIT.entityId, undefined);

    expect(getPublicDetail).toHaveBeenCalledWith("doctor", PUBLIC_HIT.entityId);
    expect(res).toEqual({
      ...PUBLIC_HIT,
      viewer: { authenticated: false, isAdmin: false, canViewUnpublished: false },
    });
  });

  it("marks a signed-in viewer authenticated but still non-privileged", async () => {
    const res = await controller.detail("doctor", PUBLIC_HIT.entityId, { id: "u1" } as User);

    expect(res.viewer).toEqual({
      authenticated: true,
      isAdmin: false,
      canViewUnpublished: false,
    });
  });
});

describe("ServiceSearchAdminController.detail (admin)", () => {
  const getAdminDetail = jest.fn().mockResolvedValue(ADMIN_HIT);
  const service = { getAdminDetail } as unknown as ServiceSearchService;
  const controller = new ServiceSearchAdminController(service);

  it("delegates to getAdminDetail and reports the privileged viewer", async () => {
    const res = await controller.detail("doctor", ADMIN_HIT.entityId);

    expect(getAdminDetail).toHaveBeenCalledWith("doctor", ADMIN_HIT.entityId);
    expect(res).toEqual({
      ...ADMIN_HIT,
      viewer: { authenticated: true, isAdmin: true, canViewUnpublished: true },
    });
  });
});
