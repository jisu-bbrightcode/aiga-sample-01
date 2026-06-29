import { describe, it } from "@jest/globals";
import { expectStoryDocBodyValidator } from "./__tests-helpers__/_body-validator.helper";
import { updateCodexSchema } from "./update-codex.dto";

describe("updateCodexSchema — body field", () => {
  it("accepts StoryDoc / null, rejects plain text / legacy v1", () => {
    expectStoryDocBodyValidator(updateCodexSchema);
  });
});
