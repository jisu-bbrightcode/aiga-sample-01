import { describe, it } from "@jest/globals";
import { expectStoryDocBodyValidator } from "./__tests-helpers__/_body-validator.helper";
import { updateLocationSchema } from "./update-location.dto";

describe("updateLocationSchema — body field", () => {
  it("accepts StoryDoc / null, rejects plain text / legacy v1", () => {
    expectStoryDocBodyValidator(updateLocationSchema);
  });
});
