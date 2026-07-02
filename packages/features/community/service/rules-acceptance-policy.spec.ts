import type { AutomodConfig } from "@repo/drizzle/schema";
import { evaluateRulesGate, requiresRulesAcceptance } from "./rules-acceptance-policy";

describe("rules-acceptance-policy (PB-COMM-RULES-FLAIR-API-001 / AC#1)", () => {
  describe("requiresRulesAcceptance", () => {
    it("returns false for null/undefined config", () => {
      expect(requiresRulesAcceptance(null)).toBe(false);
      expect(requiresRulesAcceptance(undefined)).toBe(false);
    });

    it("returns false when the flag is absent or off", () => {
      expect(requiresRulesAcceptance({})).toBe(false);
      expect(requiresRulesAcceptance({ requireRulesAcceptance: false })).toBe(false);
    });

    it("returns true only when the flag is explicitly true", () => {
      expect(requiresRulesAcceptance({ requireRulesAcceptance: true })).toBe(true);
    });

    it("ignores unrelated automod settings", () => {
      const config: AutomodConfig = { enableKeywordFilter: true, requireRulesAcceptance: true };
      expect(requiresRulesAcceptance(config)).toBe(true);
      expect(requiresRulesAcceptance({ enableKeywordFilter: true })).toBe(false);
    });
  });

  describe("evaluateRulesGate", () => {
    it("allows when acceptance is not required (regardless of acceptance state)", () => {
      expect(evaluateRulesGate(null, false)).toEqual({ allowed: true });
      expect(evaluateRulesGate({}, false)).toEqual({ allowed: true });
      expect(evaluateRulesGate({ requireRulesAcceptance: false }, false)).toEqual({
        allowed: true,
      });
    });

    it("allows when acceptance is required and the member has accepted", () => {
      expect(evaluateRulesGate({ requireRulesAcceptance: true }, true)).toEqual({ allowed: true });
    });

    it("blocks when acceptance is required and the member has not accepted", () => {
      const decision = evaluateRulesGate({ requireRulesAcceptance: true }, false);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBeTruthy();
    });

    it("blocking reason is a non-technical, user-facing message", () => {
      const { reason } = evaluateRulesGate({ requireRulesAcceptance: true }, false);
      expect(reason).toBe("커뮤니티 규칙에 동의한 후 작성할 수 있습니다.");
      // never leaks technical detail
      expect(reason).not.toMatch(/error|exception|undefined|null/i);
    });
  });
});
