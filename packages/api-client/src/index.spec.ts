import { describe, expect, it, vi } from "vitest";
import { createProductBuilderApi, mergePageParamIntoInit } from "./index";

describe("createProductBuilderApi", () => {
  it("attaches auth headers from getHeaders on every request", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const { client } = createProductBuilderApi({
      baseUrl: "http://test",
      getHeaders: () => ({ Authorization: "Bearer tok123" }),
      fetch: fetchSpy as unknown as typeof fetch,
    });
    await client.GET("/projects" as never);
    const req = fetchSpy.mock.calls[0]![0] as Request;
    expect(req.headers.get("Authorization")).toBe("Bearer tok123");
    expect(req.credentials).toBe("include");
  });

  it("works without getHeaders (no auth)", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const { client } = createProductBuilderApi({
      baseUrl: "http://test",
      fetch: fetchSpy as unknown as typeof fetch,
    });
    await client.GET("/projects" as never);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("supports async getHeaders", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const { client } = createProductBuilderApi({
      baseUrl: "http://test",
      getHeaders: async () => ({ Authorization: "Bearer async-tok" }),
      fetch: fetchSpy as unknown as typeof fetch,
    });
    await client.GET("/projects" as never);
    const req = fetchSpy.mock.calls[0]![0] as Request;
    expect(req.headers.get("Authorization")).toBe("Bearer async-tok");
  });

  it("returns both client and $api", () => {
    const { client, $api } = createProductBuilderApi({ baseUrl: "http://test" });
    expect(client).toBeDefined();
    expect($api).toBeDefined();
    expect(typeof $api.queryOptions).toBe("function");
  });

  it("does not inject cursor for the first infinite-query page", () => {
    const init = {
      params: {
        path: { id: "post-1" },
        query: { sort: "old" },
      },
    };
    const firstPage = mergePageParamIntoInit(init, "cursor", undefined);
    expect(firstPage.params?.query).toEqual({ sort: "old" });

    const nextPage = mergePageParamIntoInit(init, "cursor", "next-1");
    expect(nextPage.params?.query).toEqual({ sort: "old", cursor: "next-1" });
    expect(nextPage.params?.path).toEqual({ id: "post-1" });
  });
});
