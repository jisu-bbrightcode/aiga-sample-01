/**
 * CommunityContentModerationService — OpenAI Moderation API integration.
 *
 * The service calls `fetch()` directly, so we stub `globalThis.fetch` per
 * test instead of pulling in nock/msw. No DB access — pure unit.
 */

import { UnprocessableEntityException } from "@nestjs/common";
import { CommunityContentModerationService } from "./community-content-moderation.service";

describe("CommunityContentModerationService", () => {
  let svc: CommunityContentModerationService;
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  const ORIG_KEY = process.env.OPENAI_API_KEY;
  const ORIG_FETCH = globalThis.fetch;

  beforeEach(() => {
    svc = new CommunityContentModerationService();
    if (!globalThis.fetch) {
      Object.defineProperty(globalThis, "fetch", {
        configurable: true,
        writable: true,
        value: jest.fn(),
      });
    }
    fetchMock = jest.spyOn(globalThis, "fetch") as never;
    process.env.OPENAI_API_KEY = "sk-test";
  });

  afterEach(() => {
    fetchMock.mockRestore();
    if (!ORIG_FETCH) {
      Reflect.deleteProperty(globalThis, "fetch");
    }
    if (ORIG_KEY === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = ORIG_KEY;
  });

  function mockResponse(body: unknown, ok = true, status = 200) {
    fetchMock.mockResolvedValueOnce({
      ok,
      status,
      json: async () => body,
    } as unknown as Response);
  }

  it("moderateContent() returns allow when OPENAI_API_KEY is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    const r = await svc.moderateContent("anything");
    expect(r).toEqual({ allowed: true, reason: null, categories: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("moderateContent() returns allow when the OpenAI API responds with non-200", async () => {
    mockResponse({}, false, 500);
    const r = await svc.moderateContent("text");
    expect(r.allowed).toBe(true);
  });

  it("moderateContent() returns allow when fetch throws (network error)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    const r = await svc.moderateContent("text");
    expect(r.allowed).toBe(true);
  });

  it("moderateContent() flags categories that hit the default threshold", async () => {
    mockResponse({
      results: [
        {
          flagged: true,
          categories: { harassment: true, hate: false },
          category_scores: { harassment: 0.95, hate: 0.1 },
        },
      ],
    });
    const r = await svc.moderateContent("rude");
    expect(r.allowed).toBe(false);
    expect(r.categories).toEqual(["harassment"]);
    expect(r.reason).toContain("괴롭힘");
  });

  it("moderateContent() applies custom threshold for violence (0.9) — score below threshold passes", async () => {
    mockResponse({
      results: [
        {
          flagged: true, // default API flag set but our threshold is stricter
          categories: { violence: true },
          category_scores: { violence: 0.5 },
        },
      ],
    });
    const r = await svc.moderateContent("scene");
    expect(r.allowed).toBe(true);
    expect(r.categories).toEqual([]);
  });

  it("moderateContent() applies stricter threshold for sexual/minors (0.3)", async () => {
    mockResponse({
      results: [
        {
          flagged: false, // default API didn't flag yet
          categories: { "sexual/minors": false },
          category_scores: { "sexual/minors": 0.4 },
        },
      ],
    });
    const r = await svc.moderateContent("text");
    expect(r.allowed).toBe(false);
    expect(r.categories).toEqual(["sexual/minors"]);
  });

  it("assertContentAllowed() throws UnprocessableEntityException when blocked", async () => {
    mockResponse({
      results: [
        {
          flagged: true,
          categories: { harassment: true },
          category_scores: { harassment: 0.99 },
        },
      ],
    });
    await expect(svc.assertContentAllowed(["bad text"])).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it("assertContentAllowed() short-circuits when all texts are empty", async () => {
    await svc.assertContentAllowed(["", "  ", ""]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
