/**
 * suspended-user.guard.spec.ts — BBR-689 / PB-ADMIN-USERS-STATUS-001 AC#2.
 *
 * SuspendedUserGuard runs after BetterAuthGuard (which populates request.user)
 * and blocks accounts an admin has suspended (`profiles.is_active = false`)
 * from protected features and payment/community actions.
 *
 * The guard reads only `profiles.isActive` via the injected Drizzle db, so the
 * db is faked with a chainable select(...).from(...).where(...).limit(...) that
 * resolves to the rows under test — no real Postgres needed.
 */

import type { ExecutionContext } from "@nestjs/common";
import { ForbiddenException } from "@nestjs/common";
import { SuspendedUserGuard } from "../../../../packages/core/nestjs/auth";

interface FakeRequest {
  user?: { id?: string };
}

function contextFor(request: FakeRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

/**
 * Build a db whose select chain resolves to `rows`. If `throwOn` is set, the
 * terminal `.limit()` rejects, exercising the fail-open path.
 */
function fakeDb(rows: Array<{ isActive: boolean }>, throwOn = false) {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: () => (throwOn ? Promise.reject(new Error("db down")) : Promise.resolve(rows)),
  };
  return { select: () => chain } as never;
}

describe("SuspendedUserGuard", () => {
  it("allows an active user", async () => {
    const guard = new SuspendedUserGuard(fakeDb([{ isActive: true }]));
    await expect(guard.canActivate(contextFor({ user: { id: "u1" } }))).resolves.toBe(true);
  });

  it("blocks a suspended user (is_active = false) with 403", async () => {
    const guard = new SuspendedUserGuard(fakeDb([{ isActive: false }]));
    await expect(guard.canActivate(contextFor({ user: { id: "u1" } }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("allows when the profile row is missing (cannot confirm suspension)", async () => {
    const guard = new SuspendedUserGuard(fakeDb([]));
    await expect(guard.canActivate(contextFor({ user: { id: "ghost" } }))).resolves.toBe(true);
  });

  it("fails open on a lookup error (does not lock out on transient db failure)", async () => {
    const guard = new SuspendedUserGuard(fakeDb([], true));
    await expect(guard.canActivate(contextFor({ user: { id: "u1" } }))).resolves.toBe(true);
  });

  it("rejects when request.user is missing (guard misused without auth)", async () => {
    const guard = new SuspendedUserGuard(fakeDb([{ isActive: true }]));
    await expect(guard.canActivate(contextFor({}))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
