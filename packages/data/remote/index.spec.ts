import { createRemoteBackend } from "./index";

function response(status = 200): Response {
  return { status } as Response;
}

function apiResult<T>(data: T, status = 200) {
  return Promise.resolve({ data, response: response(status) });
}

describe("createRemoteBackend", () => {
  it("sends draft update input as a REST body", async () => {
    const api = {
      PUT: jest.fn(() => apiResult({ id: "draft-1" })),
    };
    const backend = createRemoteBackend({ api: api as never });

    await backend.drafts.update("draft-1", {
      description: "Saved card content",
      title: "Draft title",
    });

    expect(api.PUT).toHaveBeenCalledWith("/api/story/drafts/{id}", {
      params: { path: { id: "draft-1" } },
      body: {
        description: "Saved card content",
        title: "Draft title",
      },
    });
  });

});
