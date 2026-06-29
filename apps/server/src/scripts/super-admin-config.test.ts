import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_ORG_SLUG,
  DEFAULT_SUPER_ADMIN_EMAIL,
  DEFAULT_SUPER_ADMIN_PASSWORD,
  deterministicMemberId,
  isUserAlreadyExistsError,
  OWNER_ROLE,
  resolveSuperAdminConfig,
} from "./super-admin-config";

test("defaults match the acceptance-criteria credentials", () => {
  const cfg = resolveSuperAdminConfig({});
  assert.equal(cfg.email, "first@super.local");
  assert.equal(cfg.password, "q1w2e3r4t5!$");
  assert.equal(cfg.name, "Super Admin");
  assert.equal(cfg.orgName, "AIGA");
  assert.equal(cfg.orgSlug, "aiga");
  assert.equal(cfg.role, "owner");
  // 상수도 같은 값을 노출해야 한다
  assert.equal(DEFAULT_SUPER_ADMIN_EMAIL, "first@super.local");
  assert.equal(DEFAULT_SUPER_ADMIN_PASSWORD, "q1w2e3r4t5!$");
  assert.equal(DEFAULT_ORG_SLUG, "aiga");
  assert.equal(OWNER_ROLE, "owner");
});

test("env overrides take precedence over defaults", () => {
  const cfg = resolveSuperAdminConfig({
    PRODUCT_BUILDER_SEED_EMAIL: "ops@acme.com",
    PRODUCT_BUILDER_SEED_PASSWORD: "S3cret!pw",
    PRODUCT_BUILDER_SEED_NAME: "Ops",
    PRODUCT_BUILDER_SEED_ORG_NAME: "Acme",
    PRODUCT_BUILDER_SEED_ORG_SLUG: "acme",
  });
  assert.equal(cfg.email, "ops@acme.com");
  assert.equal(cfg.password, "S3cret!pw");
  assert.equal(cfg.name, "Ops");
  assert.equal(cfg.orgName, "Acme");
  assert.equal(cfg.orgSlug, "acme");
});

test("blank/whitespace env values fall back to defaults", () => {
  const cfg = resolveSuperAdminConfig({
    PRODUCT_BUILDER_SEED_EMAIL: "   ",
    PRODUCT_BUILDER_SEED_PASSWORD: "",
  });
  assert.equal(cfg.email, "first@super.local");
  assert.equal(cfg.password, "q1w2e3r4t5!$");
});

test("env values are trimmed", () => {
  const cfg = resolveSuperAdminConfig({ PRODUCT_BUILDER_SEED_EMAIL: "  a@b.com  " });
  assert.equal(cfg.email, "a@b.com");
});

test("isUserAlreadyExistsError recognises better-auth duplicate signals", () => {
  assert.equal(isUserAlreadyExistsError("User already exists"), true);
  assert.equal(isUserAlreadyExistsError("USER_ALREADY_EXISTS"), true);
  assert.equal(isUserAlreadyExistsError("duplicate key value violates unique constraint"), true);
  assert.equal(isUserAlreadyExistsError("some network error"), false);
  assert.equal(isUserAlreadyExistsError(undefined), false);
  assert.equal(isUserAlreadyExistsError(null), false);
  assert.equal(isUserAlreadyExistsError(""), false);
});

test("deterministicMemberId is stable for the same (user, org)", () => {
  const a = deterministicMemberId("user-1", "org_aiga");
  const b = deterministicMemberId("user-1", "org_aiga");
  const c = deterministicMemberId("user-2", "org_aiga");
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(a, "mem_user-1_org_aiga");
});
