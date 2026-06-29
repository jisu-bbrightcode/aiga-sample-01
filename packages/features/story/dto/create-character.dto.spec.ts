import { describe, expect, it } from "@jest/globals";
import { expectStoryDocBodyValidator } from "./__tests-helpers__/_body-validator.helper";
import { createCharacterSchema } from "./create-character.dto";

describe("createCharacterSchema — body field", () => {
  it("accepts StoryDoc / null, rejects plain text / legacy v1", () => {
    expectStoryDocBodyValidator(createCharacterSchema, {
      projectId: "00000000-0000-0000-0000-000000000001",
      name: "test character",
    });
  });
});

describe("createCharacterSchema — roles field", () => {
  it("accepts a simple roles array", () => {
    expect(
      createCharacterSchema.parse({
        projectId: "00000000-0000-0000-0000-000000000001",
        name: "test character",
        roles: ["playable", "npc"],
      }).roles,
    ).toEqual(["playable", "npc"]);
  });
});
