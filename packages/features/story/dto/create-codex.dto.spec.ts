import { describe, it } from "@jest/globals";
import { expectStoryDocBodyValidator } from "./__tests-helpers__/_body-validator.helper";
import { createCodexSchema } from "./create-codex.dto";

describe("createCodexSchema — body field", () => {
  it("accepts StoryDoc / null, rejects plain text / legacy v1", () => {
    expectStoryDocBodyValidator(createCodexSchema, {
      projectId: "00000000-0000-0000-0000-000000000001",
      name: "test codex",
    });
  });
});
