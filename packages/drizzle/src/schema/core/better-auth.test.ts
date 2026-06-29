import assert from "node:assert/strict";
import test from "node:test";
import { invitations } from "./better-auth";

test("Better Auth invitation schema exposes createdAt", () => {
  assert.equal("createdAt" in invitations, true);
});
