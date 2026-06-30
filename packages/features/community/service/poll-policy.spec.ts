/**
 * poll-policy — pure rule helpers for the community poll capability.
 * DB-free; always runs (no Postgres required).
 */

import type { PollData } from "@repo/drizzle/schema";
import {
  buildPollView,
  canViewPollResults,
  isPollClosed,
  rebuildPollOptionCounts,
  validatePollSelection,
} from "./poll-policy";

function poll(overrides: Partial<PollData> = {}): PollData {
  return {
    options: [
      { id: "a", text: "Option A", voteCount: 0 },
      { id: "b", text: "Option B", voteCount: 0 },
    ],
    multipleChoice: false,
    ...overrides,
  };
}

describe("isPollClosed", () => {
  const now = new Date("2026-06-30T12:00:00.000Z");

  it("is open when there is no expiry", () => {
    expect(isPollClosed(poll(), now)).toBe(false);
  });

  it("is open before the expiry", () => {
    expect(isPollClosed(poll({ expiresAt: "2026-06-30T13:00:00.000Z" }), now)).toBe(false);
  });

  it("is closed at/after the expiry", () => {
    expect(isPollClosed(poll({ expiresAt: "2026-06-30T12:00:00.000Z" }), now)).toBe(true);
    expect(isPollClosed(poll({ expiresAt: "2026-06-30T11:59:59.000Z" }), now)).toBe(true);
  });

  it("treats an unparseable expiry as open (never auto-closes)", () => {
    expect(isPollClosed(poll({ expiresAt: "not-a-date" }), now)).toBe(false);
  });
});

describe("validatePollSelection", () => {
  it("rejects an empty selection", () => {
    expect(validatePollSelection(poll(), [])).toEqual({ ok: false, code: "empty" });
  });

  it("rejects duplicate option ids in the request", () => {
    expect(validatePollSelection(poll({ multipleChoice: true }), ["a", "a"])).toEqual({
      ok: false,
      code: "duplicate_option",
    });
  });

  it("rejects multiple options for a single-choice poll", () => {
    expect(validatePollSelection(poll(), ["a", "b"])).toEqual({
      ok: false,
      code: "multiple_not_allowed",
    });
  });

  it("rejects unknown option ids", () => {
    expect(validatePollSelection(poll(), ["z"])).toEqual({ ok: false, code: "unknown_option" });
  });

  it("accepts a valid single-choice selection", () => {
    expect(validatePollSelection(poll(), ["a"])).toEqual({ ok: true });
  });

  it("accepts a valid multi-choice selection", () => {
    expect(validatePollSelection(poll({ multipleChoice: true }), ["a", "b"])).toEqual({ ok: true });
  });
});

describe("canViewPollResults", () => {
  it("hides results from a fresh anonymous/non-voter on an open poll", () => {
    expect(canViewPollResults({ closed: false, hasVoted: false, canModerate: false })).toBe(false);
  });

  it("reveals results once the poll is closed", () => {
    expect(canViewPollResults({ closed: true, hasVoted: false, canModerate: false })).toBe(true);
  });

  it("reveals results to a voter", () => {
    expect(canViewPollResults({ closed: false, hasVoted: true, canModerate: false })).toBe(true);
  });

  it("reveals results to a moderator/author", () => {
    expect(canViewPollResults({ closed: false, hasVoted: false, canModerate: true })).toBe(true);
  });
});

describe("rebuildPollOptionCounts", () => {
  it("rewrites counts immutably from the authoritative map", () => {
    const original = poll();
    const result = rebuildPollOptionCounts(
      original,
      new Map([
        ["a", 3],
        ["b", 5],
      ]),
    );
    expect(result.options).toEqual([
      { id: "a", text: "Option A", voteCount: 3 },
      { id: "b", text: "Option B", voteCount: 5 },
    ]);
    // input untouched
    expect(original.options[0]?.voteCount).toBe(0);
    expect(result).not.toBe(original);
  });

  it("resets options missing from the map to 0", () => {
    const result = rebuildPollOptionCounts(poll(), new Map([["a", 2]]));
    expect(result.options.find((o) => o.id === "b")?.voteCount).toBe(0);
  });
});

describe("buildPollView", () => {
  const filled = poll({
    options: [
      { id: "a", text: "Option A", voteCount: 3 },
      { id: "b", text: "Option B", voteCount: 1 },
    ],
  });

  it("exposes per-option counts + total when results are visible", () => {
    const view = buildPollView({
      poll: filled,
      closed: true,
      resultsVisible: true,
      userVotedOptionIds: ["a"],
    });
    expect(view.totalVotes).toBe(4);
    expect(view.options).toEqual([
      { id: "a", text: "Option A", voteCount: 3 },
      { id: "b", text: "Option B", voteCount: 1 },
    ]);
    expect(view.userVotedOptionIds).toEqual(["a"]);
    expect(view.resultsVisible).toBe(true);
  });

  it("nulls out counts when results are hidden", () => {
    const view = buildPollView({
      poll: filled,
      closed: false,
      resultsVisible: false,
      userVotedOptionIds: [],
    });
    expect(view.totalVotes).toBeNull();
    expect(view.options.every((o) => o.voteCount === null)).toBe(true);
    // option text/ids still exposed so the ballot can render
    expect(view.options.map((o) => o.id)).toEqual(["a", "b"]);
    expect(view.resultsVisible).toBe(false);
  });
});
