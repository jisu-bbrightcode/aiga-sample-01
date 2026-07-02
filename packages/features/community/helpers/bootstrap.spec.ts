/**
 * Community creation bootstrap policy — DB-free unit tests (BBR-588).
 */

import { ForbiddenException } from "@nestjs/common";
import {
  DEFAULT_COMMUNITY_RULES,
  MAX_OWNED_COMMUNITIES,
  OWNER_MODERATOR_PERMISSIONS,
  assertWithinCreationLimit,
  resolveInitialRules,
} from "./bootstrap";

describe("community bootstrap policy", () => {
  describe("DEFAULT_COMMUNITY_RULES", () => {
    it("provides a non-empty rule set within the DTO length limits", () => {
      expect(DEFAULT_COMMUNITY_RULES.length).toBeGreaterThan(0);
      for (const rule of DEFAULT_COMMUNITY_RULES) {
        expect(rule.title.length).toBeGreaterThanOrEqual(1);
        expect(rule.title.length).toBeLessThanOrEqual(100);
        expect(rule.description.length).toBeGreaterThanOrEqual(1);
        expect(rule.description.length).toBeLessThanOrEqual(500);
      }
    });
  });

  describe("OWNER_MODERATOR_PERMISSIONS", () => {
    it("grants every moderator permission to the creator", () => {
      expect(Object.values(OWNER_MODERATOR_PERMISSIONS).every((v) => v === true)).toBe(true);
    });
  });

  describe("resolveInitialRules", () => {
    it("returns the default rules when none are provided", () => {
      expect(resolveInitialRules(undefined)).toEqual([...DEFAULT_COMMUNITY_RULES]);
      expect(resolveInitialRules(null)).toEqual([...DEFAULT_COMMUNITY_RULES]);
      expect(resolveInitialRules([])).toEqual([...DEFAULT_COMMUNITY_RULES]);
    });

    it("returns a fresh copy of the default rules (no shared reference)", () => {
      const result = resolveInitialRules(undefined);
      expect(result).not.toBe(DEFAULT_COMMUNITY_RULES);
      const originalTitle = DEFAULT_COMMUNITY_RULES[0]?.title;
      if (result[0]) result[0].title = "mutated";
      expect(DEFAULT_COMMUNITY_RULES[0]?.title).toBe(originalTitle);
      expect(DEFAULT_COMMUNITY_RULES[0]?.title).not.toBe("mutated");
    });

    it("preserves caller-provided rules", () => {
      const custom = [{ title: "내 규칙", description: "내 설명" }];
      const result = resolveInitialRules(custom);
      expect(result).toEqual(custom);
      expect(result).not.toBe(custom);
    });
  });

  describe("assertWithinCreationLimit", () => {
    it("allows creation below the limit", () => {
      expect(() => assertWithinCreationLimit(0)).not.toThrow();
      expect(() => assertWithinCreationLimit(MAX_OWNED_COMMUNITIES - 1)).not.toThrow();
    });

    it("rejects creation at or above the limit", () => {
      expect(() => assertWithinCreationLimit(MAX_OWNED_COMMUNITIES)).toThrow(ForbiddenException);
      expect(() => assertWithinCreationLimit(MAX_OWNED_COMMUNITIES + 1)).toThrow(ForbiddenException);
    });
  });
});
