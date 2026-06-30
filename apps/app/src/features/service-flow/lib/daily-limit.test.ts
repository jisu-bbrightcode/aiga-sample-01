import { describe, expect, it } from "vitest";
import { resolveDailyLimit } from "./daily-limit";

describe("resolveDailyLimit", () => {
  it("treats an absent field (not in the self contract) as unknown", () => {
    expect(resolveDailyLimit(undefined)).toEqual({ kind: "unknown" });
  });

  it("maps null to unlimited (무제한)", () => {
    expect(resolveDailyLimit(null)).toEqual({ kind: "unlimited" });
  });

  it("maps a non-negative number to a concrete limit", () => {
    expect(resolveDailyLimit(20)).toEqual({ kind: "limited", limit: 20 });
    expect(resolveDailyLimit(0)).toEqual({ kind: "limited", limit: 0 });
  });

  it("degrades a nonsensical cap to unknown rather than showing a bad number", () => {
    expect(resolveDailyLimit(-1)).toEqual({ kind: "unknown" });
    expect(resolveDailyLimit(Number.NaN)).toEqual({ kind: "unknown" });
    expect(resolveDailyLimit(Number.POSITIVE_INFINITY)).toEqual({ kind: "unknown" });
  });
});
