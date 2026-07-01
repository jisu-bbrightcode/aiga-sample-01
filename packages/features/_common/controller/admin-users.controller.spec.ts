/**
 * admin-users.controller.spec.ts — BBR-691 / PB-ADMIN-USERS-QA-001.
 *
 * QA regression for the admin user-management surface (`/admin/users`).
 *
 * The service/guard layers are already covered in isolation
 * (admin-users.service.spec, admin-role.service.spec, admin-audit.service.spec,
 * suspended-user.guard.spec, better-auth.guard.spec). The one untested surface
 * was the controller wiring itself: whether the privileged endpoints actually
 * apply the admin guards and forward validated input to the right service.
 *
 * AC#1 (CRUD/status changes verified): list + changeRole + changeStatus forward
 * their inputs to the services, and malformed bodies are rejected with 400
 * before any service call.
 *
 * AC#2 (non-admin / permission-less access blocked): the controller is gated by
 * BetterAuthGuard then BetterAuthAdminGuard, so anonymous and non-admin callers
 * never reach the handlers.
 *
 * Pure controller unit test — the services are mocked, so no Postgres is needed.
 */

import { BadRequestException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { BetterAuthAdminGuard, BetterAuthGuard } from "@repo/core/nestjs/auth";
import type { User } from "@repo/core/nestjs/auth";
import { AdminUsersController } from "./admin-users.controller";
import type { AdminRoleService, AdminUsersService } from "../service";

function usersService() {
  return {
    list: jest.fn().mockResolvedValue({ users: [], total: 0 }),
    setActive: jest.fn().mockResolvedValue({
      id: "u1",
      isActive: false,
      changed: true,
    }),
  } as unknown as jest.Mocked<AdminUsersService>;
}

function roleService() {
  return {
    changeRole: jest.fn().mockResolvedValue({
      id: "u1",
      role: "admin",
      changed: true,
    }),
  } as unknown as jest.Mocked<AdminRoleService>;
}

const actor = { id: "admin-1" } as User;
const req = { ip: "10.0.0.1", headers: { "user-agent": "jest" } };

describe("AdminUsersController (/admin/users)", () => {
  describe("AC#2 — admin-only access wiring", () => {
    it("is gated by BetterAuthGuard then BetterAuthAdminGuard (no anonymous/non-admin access)", () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, AdminUsersController);
      expect(Array.isArray(guards)).toBe(true);
      expect(guards).toContain(BetterAuthGuard);
      expect(guards).toContain(BetterAuthAdminGuard);
    });
  });

  describe("AC#1 — list (read/search/filter/sort)", () => {
    it("normalizes the raw query and forwards it to the service", async () => {
      const users = usersService();
      const controller = new AdminUsersController(users, roleService());

      const result = await controller.list("25", "0", "kim", "active", "admin", "name", "asc");

      expect(users.list).toHaveBeenCalledTimes(1);
      const forwarded = users.list.mock.calls[0][0];
      expect(forwarded).toMatchObject({
        limit: 25,
        offset: 0,
        q: "kim",
        status: "active",
        accessRole: "admin",
        sort: "name",
        order: "asc",
      });
      expect(result).toMatchObject({ users: [], total: 0 });
    });
  });

  describe("AC#1 — changeRole", () => {
    it("forwards a valid role change with actor + request metadata", async () => {
      const role = roleService();
      const controller = new AdminUsersController(usersService(), role);

      await controller.changeRole("u1", { role: "admin", reason: "promo" } as never, actor, req);

      expect(role.changeRole).toHaveBeenCalledWith({
        actorUserId: "admin-1",
        targetUserId: "u1",
        role: "admin",
        reason: "promo",
        ipAddress: "10.0.0.1",
        userAgent: "jest",
      });
    });

    it("rejects an invalid role with 400 before touching the service", () => {
      const role = roleService();
      const controller = new AdminUsersController(usersService(), role);

      expect(() =>
        controller.changeRole("u1", { role: "superuser" } as never, actor, req),
      ).toThrow(BadRequestException);
      expect(role.changeRole).not.toHaveBeenCalled();
    });
  });

  describe("AC#1 — changeStatus (activate/suspend)", () => {
    it("forwards a valid status change with actor + request metadata", async () => {
      const users = usersService();
      const controller = new AdminUsersController(users, roleService());

      await controller.changeStatus(
        "u1",
        { isActive: false, reason: "abuse" } as never,
        actor,
        req,
      );

      expect(users.setActive).toHaveBeenCalledWith({
        actorUserId: "admin-1",
        targetUserId: "u1",
        isActive: false,
        reason: "abuse",
        ipAddress: "10.0.0.1",
        userAgent: "jest",
      });
    });

    it("rejects a non-boolean isActive with 400 before touching the service", () => {
      const users = usersService();
      const controller = new AdminUsersController(users, roleService());

      expect(() =>
        controller.changeStatus("u1", { isActive: "no" } as never, actor, req),
      ).toThrow(BadRequestException);
      expect(users.setActive).not.toHaveBeenCalled();
    });
  });
});
