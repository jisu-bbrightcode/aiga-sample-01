import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isSolapiConfigured, loadSolapiConfig, SolapiConfigError } from "../config/solapi.config";

const validEnv = {
  SOLAPI_ENABLED: "true",
  SOLAPI_API_KEY: "solapi_live_key_123",
  SOLAPI_API_SECRET: "solapi_live_secret_123",
  SOLAPI_DEFAULT_SENDER: "0212345678",
  SOLAPI_WEBHOOK_SECRET: "solapi_webhook_secret_123",
  SOLAPI_API_BASE_URL: "https://api.solapi.com",
};

describe("SOLAPI config", () => {
  it("stays disabled when env is missing", () => {
    assert.equal(isSolapiConfigured({}), false);
  });

  it("stays disabled when copied template env has placeholders and enabled=false", () => {
    assert.equal(
      isSolapiConfigured({
        SOLAPI_ENABLED: "false",
        SOLAPI_API_KEY: "your_solapi_api_key",
        SOLAPI_API_SECRET: "your_solapi_api_secret",
        SOLAPI_DEFAULT_SENDER: "0212345678",
        SOLAPI_WEBHOOK_SECRET: "your_solapi_webhook_secret",
        SOLAPI_API_BASE_URL: "https://api.solapi.com",
      }),
      false,
    );
  });

  it("rejects template placeholders even when SOLAPI_ENABLED=true", () => {
    assert.equal(
      isSolapiConfigured({
        ...validEnv,
        SOLAPI_API_KEY: "your_solapi_api_key",
      }),
      false,
    );
    assert.throws(
      () =>
        loadSolapiConfig({
          ...validEnv,
          SOLAPI_WEBHOOK_SECRET: "your_solapi_webhook_secret",
        }),
      /SOLAPI_WEBHOOK_SECRET/,
    );
  });

  it("stays disabled when real-looking credentials are present but SOLAPI_ENABLED is false", () => {
    assert.equal(isSolapiConfigured({ ...validEnv, SOLAPI_ENABLED: "false" }), false);
  });

  it("loads config when explicitly enabled with non-placeholder credentials", () => {
    const config = loadSolapiConfig(validEnv);

    assert.equal(config.apiKey, "solapi_live_key_123");
    assert.equal(config.apiSecret, "solapi_live_secret_123");
    assert.equal(config.defaultSender, "0212345678");
    assert.equal(config.webhookSecret, "solapi_webhook_secret_123");
    assert.equal(config.apiBaseUrl, "https://api.solapi.com");
  });

  it("throws SolapiConfigError for invalid provider fields after the feature gate passes", () => {
    assert.throws(
      () => loadSolapiConfig({ ...validEnv, SOLAPI_API_BASE_URL: "not-a-url" }),
      SolapiConfigError,
    );
  });
});
