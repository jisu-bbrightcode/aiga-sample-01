import { describe, it } from "@jest/globals";
import { expectStoryDocBodyValidator } from "./__tests-helpers__/_body-validator.helper";
import { updateFactionSchema } from "./update-faction.dto";

describe("updateFactionSchema — body field", () => {
  it("accepts StoryDoc / null, rejects plain text / legacy v1", () => {
    expectStoryDocBodyValidator(updateFactionSchema);
  });
});
