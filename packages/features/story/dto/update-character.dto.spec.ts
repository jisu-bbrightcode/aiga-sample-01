import { describe, expect, it } from "@jest/globals";
import { expectStoryDocBodyValidator } from "./__tests-helpers__/_body-validator.helper";
import { updateCharacterSchema } from "./update-character.dto";

describe("updateCharacterSchema — body field", () => {
  it("accepts StoryDoc / null, rejects plain text / legacy v1", () => {
    expectStoryDocBodyValidator(updateCharacterSchema);
  });
});

describe("updateCharacterSchema — roles field", () => {
  it("accepts replacing the simple roles array", () => {
    expect(updateCharacterSchema.parse({ roles: ["companion", "enemy"] }).roles).toEqual([
      "companion",
      "enemy",
    ]);
  });
});
