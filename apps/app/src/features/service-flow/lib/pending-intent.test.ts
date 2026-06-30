import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPendingIntent,
  type PendingIntent,
  readPendingIntent,
  storePendingIntent,
} from "./pending-intent";

const STORAGE_KEY = "aiga.service-flow.pending-intent";

const intent: PendingIntent = { kind: "save", targetType: "doctor", targetId: "doc-1" };

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("pending-intent", () => {
  it("round-trips a stored intent", () => {
    storePendingIntent(intent);
    expect(readPendingIntent()).toEqual(intent);
  });

  it("returns null when nothing is stored", () => {
    expect(readPendingIntent()).toBeNull();
  });

  it("clears the intent (single-use after replay)", () => {
    storePendingIntent(intent);
    clearPendingIntent();
    expect(readPendingIntent()).toBeNull();
  });

  it("drops a malformed payload rather than acting on it", () => {
    window.sessionStorage.setItem(STORAGE_KEY, "{ not json");
    expect(readPendingIntent()).toBeNull();
  });

  it("rejects an intent with an unknown kind", () => {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ kind: "delete", targetType: "doctor", targetId: "x" }),
    );
    expect(readPendingIntent()).toBeNull();
  });

  it("rejects an intent with an unknown target type or empty id", () => {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ kind: "save", targetType: "clinic", targetId: "x" }),
    );
    expect(readPendingIntent()).toBeNull();

    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ kind: "interest", targetType: "hospital", targetId: "" }),
    );
    expect(readPendingIntent()).toBeNull();
  });

  it("accepts a valid interest intent", () => {
    const interestIntent: PendingIntent = {
      kind: "interest",
      targetType: "hospital",
      targetId: "h-9",
    };
    storePendingIntent(interestIntent);
    expect(readPendingIntent()).toEqual(interestIntent);
  });
});
