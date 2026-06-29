import assert from "node:assert/strict";
import test from "node:test";
import { buildAuthJwtPayload } from "./jwt-payload";

test("buildAuthJwtPayload includes active organization from session", () => {
  const payload = buildAuthJwtPayload({
    user: { id: "user-1", email: "bright@product-builder.app", name: "Bright" },
    session: { activeOrganizationId: "org-1" },
  });

  assert.equal(payload.id, "user-1");
  assert.equal(payload.email, "bright@product-builder.app");
  assert.equal(payload.activeOrganizationId, "org-1");
});

test("buildAuthJwtPayload omits blank active organization", () => {
  const payload = buildAuthJwtPayload({
    user: { id: "user-1", email: "bright@product-builder.app" },
    session: { activeOrganizationId: "" },
  });

  assert.deepEqual(payload, { id: "user-1", email: "bright@product-builder.app" });
});
