import {
  BLOCK_REJECTION_MESSAGES,
  evaluateBlockTarget,
  parseSystemAccountIds,
} from "./block-policy";

describe("block-policy / evaluateBlockTarget (BBR-615 AC#2)", () => {
  it("allows blocking a normal other user", () => {
    expect(evaluateBlockTarget({ blockerId: "u1", blockedId: "u2" })).toEqual({ ok: true });
  });

  it("rejects self-block", () => {
    expect(evaluateBlockTarget({ blockerId: "u1", blockedId: "u1" })).toEqual({
      ok: false,
      reason: "self_block",
    });
  });

  it("rejects blocking a system account", () => {
    expect(
      evaluateBlockTarget({
        blockerId: "u1",
        blockedId: "system-bot",
        systemAccountIds: ["system-bot", "announce"],
      }),
    ).toEqual({ ok: false, reason: "system_account" });
  });

  it("allows blocking a non-system user even when a system set is provided", () => {
    expect(
      evaluateBlockTarget({
        blockerId: "u1",
        blockedId: "u2",
        systemAccountIds: ["system-bot"],
      }),
    ).toEqual({ ok: true });
  });

  it("self-block takes precedence over system-account check", () => {
    expect(
      evaluateBlockTarget({
        blockerId: "sys",
        blockedId: "sys",
        systemAccountIds: ["sys"],
      }),
    ).toEqual({ ok: false, reason: "self_block" });
  });

  it("accepts a Set for systemAccountIds", () => {
    expect(
      evaluateBlockTarget({
        blockerId: "u1",
        blockedId: "sys",
        systemAccountIds: new Set(["sys"]),
      }),
    ).toEqual({ ok: false, reason: "system_account" });
  });

  it("every rejection reason has a user-facing message", () => {
    expect(BLOCK_REJECTION_MESSAGES.self_block).toBeTruthy();
    expect(BLOCK_REJECTION_MESSAGES.system_account).toBeTruthy();
  });
});

describe("block-policy / parseSystemAccountIds", () => {
  it("returns [] for empty/undefined", () => {
    expect(parseSystemAccountIds(undefined)).toEqual([]);
    expect(parseSystemAccountIds("")).toEqual([]);
    expect(parseSystemAccountIds("   ")).toEqual([]);
  });

  it("splits on comma and trims whitespace", () => {
    expect(parseSystemAccountIds(" a , b ,c ")).toEqual(["a", "b", "c"]);
  });

  it("drops empty segments and dedupes", () => {
    expect(parseSystemAccountIds("a,,a,b,")).toEqual(["a", "b"]);
  });
});
