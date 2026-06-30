import {
  canManageModerators,
  canRespondToInvite,
  canRevokeAppointment,
  canTransferOwnership,
  canUpdatePermissions,
  DEFAULT_MODERATOR_PERMISSIONS,
  type ModeratorStatus,
  nextStatusForResponse,
  normalizeModeratorPermissions,
  sanitizeGrantablePermissions,
} from "./moderator-policy";

describe("moderator-policy", () => {
  describe("canManageModerators", () => {
    it("allows owner and admin unconditionally", () => {
      expect(canManageModerators({ role: "owner" })).toBe(true);
      expect(canManageModerators({ role: "admin" })).toBe(true);
    });

    it("allows an active moderator only with manageModerators", () => {
      const perms = { ...DEFAULT_MODERATOR_PERMISSIONS, manageModerators: true };
      expect(canManageModerators({ role: "moderator", status: "active", permissions: perms })).toBe(
        true,
      );
    });

    it("denies a moderator lacking manageModerators", () => {
      expect(
        canManageModerators({
          role: "moderator",
          status: "active",
          permissions: DEFAULT_MODERATOR_PERMISSIONS,
        }),
      ).toBe(false);
    });

    it("denies a moderator whose appointment is not active", () => {
      const perms = { ...DEFAULT_MODERATOR_PERMISSIONS, manageModerators: true };
      expect(
        canManageModerators({ role: "moderator", status: "pending", permissions: perms }),
      ).toBe(false);
    });

    it("denies a plain member", () => {
      expect(canManageModerators({ role: "member" })).toBe(false);
    });
  });

  describe("canTransferOwnership", () => {
    it("permits only the owner", () => {
      expect(canTransferOwnership("owner")).toBe(true);
      expect(canTransferOwnership("admin")).toBe(false);
      expect(canTransferOwnership("moderator")).toBe(false);
      expect(canTransferOwnership("member")).toBe(false);
    });
  });

  describe("invite response transitions", () => {
    it("only a pending appointment can be responded to", () => {
      expect(canRespondToInvite("pending")).toBe(true);
      for (const s of ["active", "declined", "revoked"] as ModeratorStatus[]) {
        expect(canRespondToInvite(s)).toBe(false);
      }
    });

    it("maps accept/decline to the resulting status", () => {
      expect(nextStatusForResponse(true)).toBe("active");
      expect(nextStatusForResponse(false)).toBe("declined");
    });
  });

  describe("revoke / update guards", () => {
    it("revokes only pending or active appointments", () => {
      expect(canRevokeAppointment("pending")).toBe(true);
      expect(canRevokeAppointment("active")).toBe(true);
      expect(canRevokeAppointment("declined")).toBe(false);
      expect(canRevokeAppointment("revoked")).toBe(false);
    });

    it("updates permissions only on an active appointment", () => {
      expect(canUpdatePermissions("active")).toBe(true);
      for (const s of ["pending", "declined", "revoked"] as ModeratorStatus[]) {
        expect(canUpdatePermissions(s)).toBe(false);
      }
    });
  });

  describe("normalizeModeratorPermissions", () => {
    it("returns defaults for empty input", () => {
      expect(normalizeModeratorPermissions()).toEqual(DEFAULT_MODERATOR_PERMISSIONS);
      expect(normalizeModeratorPermissions(null)).toEqual(DEFAULT_MODERATOR_PERMISSIONS);
    });

    it("merges a partial patch over defaults", () => {
      const result = normalizeModeratorPermissions({ manageRules: true, managePosts: false });
      expect(result.manageRules).toBe(true);
      expect(result.managePosts).toBe(false);
      expect(result.manageComments).toBe(DEFAULT_MODERATOR_PERMISSIONS.manageComments);
    });
  });

  describe("sanitizeGrantablePermissions", () => {
    const escalated = {
      ...DEFAULT_MODERATOR_PERMISSIONS,
      manageModerators: true,
      manageSettings: true,
    };

    it("passes escalated permissions through for owner/admin", () => {
      expect(sanitizeGrantablePermissions("owner", escalated)).toEqual(escalated);
      expect(sanitizeGrantablePermissions("admin", escalated)).toEqual(escalated);
    });

    it("strips escalated permissions for a managing moderator", () => {
      const result = sanitizeGrantablePermissions("moderator", escalated);
      expect(result.manageModerators).toBe(false);
      expect(result.manageSettings).toBe(false);
      // non-escalated grants survive
      expect(result.managePosts).toBe(escalated.managePosts);
    });
  });
});
