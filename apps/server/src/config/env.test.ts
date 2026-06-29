import assert from "node:assert/strict";
import test from "node:test";

test("server env module can be imported before required runtime env is available", async () => {
  const previous = {
    DATABASE_URL: process.env.DATABASE_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_IMAGE_MODEL: process.env.OPENAI_IMAGE_MODEL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY,
    INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  };

  delete process.env.DATABASE_URL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_IMAGE_MODEL;
  delete process.env.GEMINI_API_KEY;
  delete process.env.INNGEST_EVENT_KEY;
  delete process.env.INNGEST_SIGNING_KEY;
  delete process.env.BLOB_READ_WRITE_TOKEN;

  try {
    const env = await import("./env");

    assert.equal(env.serverEnvSchema.safeParse(process.env).success, false);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});

test("server env schema does not require feature-specific integrations for auth boot", async () => {
  const { serverEnvSchema } = await import("./env");

  const parsed = serverEnvSchema.safeParse({
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/atlas",
  });

  assert.equal(parsed.success, true);
});
