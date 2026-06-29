import assert from "node:assert/strict";
import test from "node:test";
import { resolveVideoLectureAccess } from "./access-policy";

test("video lecture access policy does not let preview visibility bypass purchase", () => {
  const access = resolveVideoLectureAccess(
    {
      visibility: "preview",
      entitlementRequirement: "purchase",
      freePreviewSeconds: 0,
    },
    { viewerId: undefined, preview: false, entitlementGranted: false },
  );

  assert.equal(access, "not_logged_in");
});

test("video lecture access policy returns preview_only instead of a full token for free preview", () => {
  const access = resolveVideoLectureAccess(
    {
      visibility: "preview",
      entitlementRequirement: "purchase",
      freePreviewSeconds: 120,
    },
    { viewerId: undefined, preview: true, entitlementGranted: false },
  );

  assert.equal(access, "preview_only");
});

test("video lecture access policy requires entitlement for paid public lessons", () => {
  const withoutEntitlement = resolveVideoLectureAccess(
    {
      visibility: "public",
      entitlementRequirement: "subscription",
      freePreviewSeconds: 0,
    },
    { viewerId: "user-1", preview: false, entitlementGranted: false },
  );
  const withEntitlement = resolveVideoLectureAccess(
    {
      visibility: "public",
      entitlementRequirement: "subscription",
      freePreviewSeconds: 0,
    },
    { viewerId: "user-1", preview: false, entitlementGranted: true },
  );

  assert.equal(withoutEntitlement, "subscription_required");
  assert.equal(withEntitlement, "ready");
});

test("video lecture access policy treats login as an explicit requirement", () => {
  const anonymous = resolveVideoLectureAccess(
    {
      visibility: "public",
      entitlementRequirement: "login",
      freePreviewSeconds: 0,
    },
    { viewerId: undefined, preview: false, entitlementGranted: false },
  );
  const loggedIn = resolveVideoLectureAccess(
    {
      visibility: "public",
      entitlementRequirement: "login",
      freePreviewSeconds: 0,
    },
    { viewerId: "user-1", preview: false, entitlementGranted: false },
  );

  assert.equal(anonymous, "not_logged_in");
  assert.equal(loggedIn, "ready");
});
