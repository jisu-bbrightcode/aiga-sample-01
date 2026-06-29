import assert from "node:assert/strict";
import test from "node:test";
import {
  EMAIL_TEMPLATE_SEEDS,
  validateEmailTemplateSeeds,
} from "./email-templates.catalog";

test("seed catalog is internally valid", () => {
  assert.deepEqual(validateEmailTemplateSeeds(), []);
});

test("seed keys cover auth / password-reset / transactional (acceptance criteria)", () => {
  const keys = EMAIL_TEMPLATE_SEEDS.map((s) => s.key);
  assert.ok(keys.includes("auth.welcome"));
  assert.ok(keys.includes("auth.email-verification"));
  assert.ok(keys.includes("password.password-reset"));
  assert.ok(keys.includes("transactional.notification"));
});

test("every seed key is unique", () => {
  const keys = EMAIL_TEMPLATE_SEEDS.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length);
});

test("every seed has a published-able v1 with subject", () => {
  for (const seed of EMAIL_TEMPLATE_SEEDS) {
    assert.equal(seed.version.version, 1, `${seed.key} should seed version 1`);
    assert.notEqual(seed.version.subject.trim(), "", `${seed.key} subject empty`);
  }
});

test("required variables are flagged required in the schema", () => {
  const reset = EMAIL_TEMPLATE_SEEDS.find((s) => s.key === "password.password-reset");
  assert.ok(reset);
  assert.equal(reset?.version.variableSchema.resetUrl.required, true);
  assert.equal(reset?.version.variableSchema.expiresIn.required, true);

  const notification = EMAIL_TEMPLATE_SEEDS.find((s) => s.key === "transactional.notification");
  // optional action variables must not be required
  assert.equal(notification?.version.variableSchema.actionUrl.required, false);
});

test("validator catches a duplicate key", () => {
  const dup = [...EMAIL_TEMPLATE_SEEDS, EMAIL_TEMPLATE_SEEDS[0]];
  const problems = validateEmailTemplateSeeds(dup);
  assert.ok(problems.some((p) => p.includes("duplicate key")));
});

test("validator catches a missing required category", () => {
  const withoutPassword = EMAIL_TEMPLATE_SEEDS.filter((s) => s.category !== "password");
  const problems = validateEmailTemplateSeeds(withoutPassword);
  assert.ok(problems.some((p) => p.includes("missing required category: password")));
});
