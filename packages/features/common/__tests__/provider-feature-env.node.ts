import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertProviderFeatureEnvReady,
  isProviderFeatureEnabled,
  isTemplatePlaceholderValue,
  ProviderFeatureEnvError,
} from "../provider-feature-env";

const options = {
  featureName: "example-provider",
  enabledKey: "EXAMPLE_ENABLED",
  placeholderProtectedKeys: ["EXAMPLE_API_KEY", "EXAMPLE_SECRET"] as const,
};

describe("provider feature env helpers", () => {
  it("requires an explicit true enable flag", () => {
    assert.equal(isProviderFeatureEnabled({}, "EXAMPLE_ENABLED"), false);
    assert.equal(isProviderFeatureEnabled({ EXAMPLE_ENABLED: "false" }, "EXAMPLE_ENABLED"), false);
    assert.equal(isProviderFeatureEnabled({ EXAMPLE_ENABLED: " true " }, "EXAMPLE_ENABLED"), true);
  });

  it("detects template placeholders without rejecting real-looking values", () => {
    assert.equal(isTemplatePlaceholderValue("your_provider_key"), true);
    assert.equal(isTemplatePlaceholderValue("replace-me-secret"), true);
    assert.equal(isTemplatePlaceholderValue("changeme"), true);
    assert.equal(isTemplatePlaceholderValue("provider_live_123"), false);
    assert.equal(isTemplatePlaceholderValue("https://api.example.com"), false);
  });

  it("throws when the feature was not explicitly enabled", () => {
    assert.throws(
      () =>
        assertProviderFeatureEnvReady(
          {
            EXAMPLE_API_KEY: "provider_live_123",
            EXAMPLE_SECRET: "provider_secret_123",
          },
          options,
        ),
      ProviderFeatureEnvError,
    );
  });

  it("throws when enabled env still contains template credentials", () => {
    assert.throws(
      () =>
        assertProviderFeatureEnvReady(
          {
            EXAMPLE_ENABLED: "true",
            EXAMPLE_API_KEY: "your_provider_key",
            EXAMPLE_SECRET: "provider_secret_123",
          },
          options,
        ),
      /EXAMPLE_API_KEY/,
    );
  });

  it("passes when explicitly enabled with non-placeholder credentials", () => {
    assert.doesNotThrow(() =>
      assertProviderFeatureEnvReady(
        {
          EXAMPLE_ENABLED: "true",
          EXAMPLE_API_KEY: "provider_live_123",
          EXAMPLE_SECRET: "provider_secret_123",
        },
        options,
      ),
    );
  });
});
