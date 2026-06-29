import {
  DEFAULT_CHARACTER_CHAT_MODEL,
  DEFAULT_CHARACTER_CHAT_MODEL_NAME,
  DEFAULT_CHARACTER_CHAT_MODEL_PROVIDER,
} from "./model-defaults";

describe("character chat model defaults", () => {
  it("uses the AI Runtime Gateway policy model", () => {
    expect(DEFAULT_CHARACTER_CHAT_MODEL_PROVIDER).toBe("gateway");
    expect(DEFAULT_CHARACTER_CHAT_MODEL_NAME).toBe("openai/gpt-4o-mini");
    expect(DEFAULT_CHARACTER_CHAT_MODEL).toEqual({
      provider: "gateway",
      model: "openai/gpt-4o-mini",
    });
  });
});
