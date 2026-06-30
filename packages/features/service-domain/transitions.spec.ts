import { UnprocessableEntityException } from "@nestjs/common";
import { assertStatusTransition, canChangeStatus } from "./transitions";

describe("service-domain status transitions (BBR-681 AC#1)", () => {
  describe("canChangeStatus", () => {
    it("allows every documented transition", () => {
      expect(canChangeStatus("draft", "published")).toBe(true);
      expect(canChangeStatus("draft", "archived")).toBe(true);
      expect(canChangeStatus("published", "draft")).toBe(true);
      expect(canChangeStatus("published", "archived")).toBe(true);
      expect(canChangeStatus("archived", "draft")).toBe(true);
    });

    it("forbids jumping from archived straight back to published", () => {
      expect(canChangeStatus("archived", "published")).toBe(false);
    });

    it("treats a no-op (same state) as allowed", () => {
      expect(canChangeStatus("draft", "draft")).toBe(true);
      expect(canChangeStatus("published", "published")).toBe(true);
      expect(canChangeStatus("archived", "archived")).toBe(true);
    });
  });

  describe("assertStatusTransition", () => {
    it("does not throw for an allowed transition", () => {
      expect(() => assertStatusTransition("draft", "published")).not.toThrow();
    });

    it("throws a 422 for a disallowed transition", () => {
      expect(() => assertStatusTransition("archived", "published")).toThrow(
        UnprocessableEntityException,
      );
    });

    it("throws a 422 for an unknown target state", () => {
      expect(() => assertStatusTransition("draft", "bogus" as never)).toThrow(
        UnprocessableEntityException,
      );
    });
  });
});
