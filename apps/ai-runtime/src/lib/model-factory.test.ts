import assert from "node:assert/strict";
import test from "node:test";
import {
  FALLBACK_MODEL_INFO,
  resolveGatewayFallbackModels,
  resolveGatewayModelId,
  resolveGatewayProviderOptions,
  resolveModel,
} from "./model-factory";

function withEnv(env: Record<string, string | undefined>, fn: () => void) {
  const previous = new Map<string, string | undefined>();
  for (const key of Object.keys(env)) previous.set(key, process.env[key]);
  try {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("resolveModel uses Vercel AI Gateway default model", () => {
  const model = resolveModel({});

  assert.equal(FALLBACK_MODEL_INFO.provider, "gateway");
  assert.equal(FALLBACK_MODEL_INFO.name, "openai/gpt-4o-mini");
  assert.deepEqual(FALLBACK_MODEL_INFO.fallbackModels, [
    "google/gemini-2.5-flash",
    "anthropic/claude-3.5-haiku",
  ]);
  assert.equal(model.provider, "gateway");
  assert.equal(model.modelId, "openai/gpt-4o-mini");
});

test("resolveModel ignores legacy actor physical model selection", () => {
  const model = resolveModel({
    modelProvider: "anthropic",
    modelName: "claude-3-5-haiku-20241022",
  });

  assert.equal(model.provider, "gateway");
  assert.equal(model.modelId, "openai/gpt-4o-mini");
});

test("gateway model policy can be configured with environment variables", () => {
  withEnv(
    {
      AI_GATEWAY_MODEL: "google/gemini-2.5-flash",
      AI_GATEWAY_FALLBACK_MODELS:
        "openai/gpt-4o-mini, google/gemini-2.5-flash, anthropic/claude-3.5-haiku",
    },
    () => {
      assert.equal(resolveGatewayModelId(), "google/gemini-2.5-flash");
      assert.deepEqual(resolveGatewayFallbackModels(), [
        "openai/gpt-4o-mini",
        "anthropic/claude-3.5-haiku",
      ]);
      assert.deepEqual(resolveGatewayProviderOptions(), {
        gateway: {
          models: ["openai/gpt-4o-mini", "anthropic/claude-3.5-haiku"],
        },
      });
    },
  );
});
