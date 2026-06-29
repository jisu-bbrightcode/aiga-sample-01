import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeProgress, shouldPersistProgress } from "./progress";

describe("video lecture progress helper", () => {
  it("clamps watched seconds and computes integer percent", () => {
    assert.deepEqual(computeProgress({ currentTimeSeconds: 95.9, totalSeconds: 100 }), {
      watchedSeconds: 95,
      totalSeconds: 100,
      progressPercent: 95,
      lastPositionSeconds: 95,
      completed: true,
    });
  });

  it("throttles writes inside the 15 second window", () => {
    const now = new Date("2026-06-13T00:00:15.000Z");
    assert.equal(shouldPersistProgress(new Date("2026-06-13T00:00:01.000Z"), now), false);
    assert.equal(shouldPersistProgress(new Date("2026-06-13T00:00:00.000Z"), now), true);
  });

  it("does not throttle completion writes", () => {
    const now = new Date("2026-06-13T00:00:02.000Z");
    assert.equal(
      shouldPersistProgress(new Date("2026-06-13T00:00:01.000Z"), now, { force: true }),
      true,
    );
  });
});
