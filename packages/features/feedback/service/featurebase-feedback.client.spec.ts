import {
  buildFeaturebasePostPayload,
  type SubmitProductFeedbackInput,
  submitFeedbackToFeaturebase,
} from "./featurebase-feedback.client";

const input: SubmitProductFeedbackInput = {
  type: "feature",
  typeLabel: "필요한 기능",
  message: "프로젝트별 피드백 흐름을 <더> 쉽게 확인하고 싶어요.",
  rating: 4,
  path: "/projects",
  url: "https://product-builder.app/projects",
  submittedAt: "2026-05-18T00:00:00.000Z",
  user: {
    id: "user-1",
    email: "user@example.com",
  },
};

describe("Featurebase feedback client", () => {
  it("skips Featurebase writes when the server is not configured", async () => {
    await expect(submitFeedbackToFeaturebase(input, {})).resolves.toEqual({
      status: "skipped",
      reason: "not_configured",
    });
  });

  it("builds a private in-review post payload with escaped content and metadata", () => {
    const payload = buildFeaturebasePostPayload(input, {
      boardId: "board-1",
      tags: ["posthog-survey"],
    });

    expect(payload).toMatchObject({
      title: "Feature request: 프로젝트별 피드백 흐름을 <더> 쉽게 확인하고 싶어요.",
      boardId: "board-1",
      tags: ["product-builder-feedback", "feature", "posthog-survey"],
      inReview: true,
      commentsEnabled: true,
      visibility: "authorOnly",
      author: {
        userId: "user-1",
        email: "user@example.com",
        name: "user@example.com",
      },
    });
    expect(payload.content).toContain("&lt;더&gt;");
    expect(payload.content).toContain("<strong>Rating:</strong> 4/5");
    expect(payload.content).toContain("<strong>Path:</strong> /projects");
  });

  it("creates a Featurebase post through the pinned v2 API", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        id: "post-1",
        postUrl: "https://product-builder.featurebase.app/p/post-1",
      }),
    });

    await expect(
      submitFeedbackToFeaturebase(input, {
        apiKey: "fb_test",
        boardId: "board-1",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toEqual({
      status: "created",
      postId: "post-1",
      postUrl: "https://product-builder.featurebase.app/p/post-1",
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://do.featurebase.app/v2/posts",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer fb_test",
          "Featurebase-Version": "2026-01-01.nova",
        }),
      }),
    );
  });
});
