import { makeMockDb } from "./__tests__/mock-db";
import { SessionRevocationService } from "./session-revocation.service";

describe("SessionRevocationService.revokeAllForUser", () => {
  it("deletes the user's sessions and returns the removed count", async () => {
    const db = makeMockDb([], [[{ id: "s1" }, { id: "s2" }, { id: "s3" }]]);
    // biome-ignore lint/suspicious/noExplicitAny: inject test double.
    const svc = new SessionRevocationService(db as any);

    const removed = await svc.revokeAllForUser("u1");

    expect(removed).toBe(3);
    expect(db.deletes).toHaveLength(1);
  });

  it("is idempotent and returns 0 when the user has no sessions", async () => {
    const db = makeMockDb([], [[]]);
    // biome-ignore lint/suspicious/noExplicitAny: inject test double.
    const svc = new SessionRevocationService(db as any);

    const removed = await svc.revokeAllForUser("u-without-sessions");

    expect(removed).toBe(0);
    expect(db.deletes).toHaveLength(1);
  });
});
