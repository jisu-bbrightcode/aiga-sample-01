jest.mock("@repo/features/message-sending", () => {
  class MessageSendingModule {}

  return {
    MessageSendingModule,
    isSolapiConfigured: (env: Record<string, string>) =>
      env.SOLAPI_ENABLED === "true" &&
      env.SOLAPI_API_KEY === "solapi_live_key_123" &&
      env.SOLAPI_API_SECRET === "solapi_live_secret_123" &&
      env.SOLAPI_DEFAULT_SENDER === "0212345678",
  };
});

import { MessageSendingModule } from "@repo/features/message-sending";
import { getMessageSendingFeatureWiring } from "./message-sending-feature";

describe("getMessageSendingFeatureWiring", () => {
  it("omits MessageSendingModule when the explicit SOLAPI gate is off", () => {
    const wiring = getMessageSendingFeatureWiring({
      SOLAPI_ENABLED: "false",
      SOLAPI_API_KEY: "solapi_live_key_123",
      SOLAPI_API_SECRET: "solapi_live_secret_123",
      SOLAPI_DEFAULT_SENDER: "0212345678",
    });

    expect(wiring.enabled).toBe(false);
    expect(wiring.imports).toEqual([]);
  });

  it("omits MessageSendingModule when copied template placeholders are present", () => {
    const wiring = getMessageSendingFeatureWiring({
      SOLAPI_ENABLED: "true",
      SOLAPI_API_KEY: "your_solapi_api_key",
      SOLAPI_API_SECRET: "your_solapi_api_secret",
      SOLAPI_DEFAULT_SENDER: "0212345678",
    });

    expect(wiring.enabled).toBe(false);
    expect(wiring.imports).toEqual([]);
  });

  it("registers MessageSendingModule when SOLAPI is explicitly enabled and configured", () => {
    const wiring = getMessageSendingFeatureWiring({
      SOLAPI_ENABLED: "true",
      SOLAPI_API_KEY: "solapi_live_key_123",
      SOLAPI_API_SECRET: "solapi_live_secret_123",
      SOLAPI_DEFAULT_SENDER: "0212345678",
    });

    expect(wiring.enabled).toBe(true);
    expect(wiring.imports).toEqual([MessageSendingModule]);
  });
});
