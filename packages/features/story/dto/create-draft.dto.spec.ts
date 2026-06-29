import { describe, it } from "@jest/globals";
import {
  expectStoryDocBodyValidator,
  VALID_STORY_DOC,
} from "./__tests-helpers__/_body-validator.helper";
import { createDraftSchema } from "./create-draft.dto";

describe("createDraftSchema — body field", () => {
  it("accepts StoryDoc / null, rejects plain text / legacy v1", () => {
    expectStoryDocBodyValidator(createDraftSchema, {
      projectId: "00000000-0000-0000-0000-000000000001",
      title: "test draft",
    });
  });

  it("keeps description as plain management text separate from StoryDoc body", () => {
    const parsed = createDraftSchema.parse({
      projectId: "00000000-0000-0000-0000-000000000001",
      title: "test draft",
      description: "관리용 설명은 plain text",
      body: VALID_STORY_DOC,
    });

    expect(parsed.description).toBe("관리용 설명은 plain text");
    expect(parsed.body).toBe(VALID_STORY_DOC);
  });
});
