import { describe, it } from "@jest/globals";
import {
  expectStoryDocBodyValidator,
  VALID_STORY_DOC,
} from "./__tests-helpers__/_body-validator.helper";
import { updateDraftSchema } from "./update-draft.dto";

describe("updateDraftSchema — body field", () => {
  it("accepts StoryDoc / null, rejects plain text / legacy v1", () => {
    expectStoryDocBodyValidator(updateDraftSchema);
  });

  it("keeps description as plain management text separate from StoryDoc body", () => {
    const parsed = updateDraftSchema.parse({
      description: "수정된 관리 설명",
      body: VALID_STORY_DOC,
    });

    expect(parsed.description).toBe("수정된 관리 설명");
    expect(parsed.body).toBe(VALID_STORY_DOC);
  });
});
